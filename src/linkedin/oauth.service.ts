/**
 * LinkedIn OAuth 2.0 (Authorization Code flow).
 *
 * Implements the direct link to a LinkedIn account:
 *   1. buildAuthorizationUrl → user approves in the browser
 *   2. exchangeCodeForToken  → swap the returned code for an access token
 *   3. fetchMemberUrn        → resolve the author URN (urn:li:person:...)
 *   4. refreshAccessToken    → renew without re-approving (when a refresh token
 *                              is available on the app)
 *
 * Uses global fetch (Node 18+). No external dependencies.
 */

import { config } from '../config/env';
import { StoredToken } from './token-store';

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/**
 * Default scopes:
 *   - openid, profile → allow reading the member id via /userinfo
 *   - w_member_social → allow posting on the member's behalf
 * Override via LINKEDIN_SCOPES (space-separated) to match your app's products.
 */
export function scopes(): string[] {
  const fromEnv = process.env.LINKEDIN_SCOPES;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().split(/\s+/);
  return ['openid', 'profile', 'w_member_social'];
}

export interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds
  scope?: string;
}

function requireOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const { clientId, clientSecret, redirectUri } = config.linkedIn;
  const missing: string[] = [];
  if (!clientId) missing.push('LINKEDIN_CLIENT_ID');
  if (!clientSecret) missing.push('LINKEDIN_CLIENT_SECRET');
  if (!redirectUri) missing.push('LINKEDIN_REDIRECT_URI');
  if (missing.length > 0) {
    throw new Error(`Missing OAuth config: ${missing.join(', ')} (see .env.example).`);
  }
  return { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri! };
}

export function buildAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = requireOAuthConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes().join(' '),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireOAuthConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Token exchange failed (${res.status}): ${json.error_description || json.error || JSON.stringify(json)}`,
    );
  }
  return json;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = requireOAuthConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Token refresh failed (${res.status}): ${json.error_description || json.error || JSON.stringify(json)}`,
    );
  }
  return json;
}

/**
 * Resolve the author URN from an access token.
 * Primary: OpenID /userinfo (`sub`). If the app lacks openid scope, the caller
 * can set LINKEDIN_AUTHOR_URN manually instead.
 */
export async function fetchMemberUrn(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `Could not fetch member info (${res.status}). Ensure your app has the "Sign In with LinkedIn using OpenID Connect" product, or set LINKEDIN_AUTHOR_URN manually.`,
    );
  }
  const json = (await res.json()) as { sub?: string };
  if (!json.sub) throw new Error('userinfo response did not include a member id (sub).');
  return `urn:li:person:${json.sub}`;
}

/** Convert a raw token response + URN into the persisted token shape. */
export function toStoredToken(resp: TokenResponse, authorUrn: string): StoredToken {
  const now = Date.now();
  return {
    accessToken: resp.access_token,
    expiresAt: now + resp.expires_in * 1000,
    refreshToken: resp.refresh_token,
    refreshExpiresAt: resp.refresh_token_expires_in
      ? now + resp.refresh_token_expires_in * 1000
      : undefined,
    authorUrn,
    obtainedAt: now,
  };
}
