/**
 * OAuth placeholder.
 *
 * V1 uses a pre-obtained access token from the environment. This module marks
 * where the OAuth 2.0 Authorization Code flow will live so it can be added later
 * without disturbing the publishing path.
 *
 * Planned flow:
 *   1. Build authorization URL (client id + redirect uri + scopes: w_member_social).
 *   2. User authorizes; LinkedIn redirects back with a `code`.
 *   3. Exchange `code` for an access token at /oauth/v2/accessToken.
 *   4. Persist/refresh the token securely.
 */

import { config } from '../config/env';

export function buildAuthorizationUrl(scopes: string[] = ['w_member_social']): string {
  const { clientId, redirectUri } = config.linkedIn;
  if (!clientId || !redirectUri) {
    throw new Error(
      'OAuth is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI. (Full OAuth flow is planned for a later version.)',
    );
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function exchangeCodeForToken(): never {
  throw new Error(
    'OAuth token exchange is not implemented in V1. Provide LINKEDIN_ACCESS_TOKEN via environment instead.',
  );
}
