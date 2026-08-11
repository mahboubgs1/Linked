/**
 * LinkedIn token storage.
 *
 * Persists the OAuth token obtained via `npm run login` to
 * `data/linkedin-token.json` (git-ignored, since all of `data/` is ignored).
 * Never commit this file — it grants posting access to your account.
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'linkedin-token.json');

export interface StoredToken {
  accessToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  refreshToken?: string;
  /** Epoch ms when the refresh token expires. */
  refreshExpiresAt?: number;
  /** Author URN this token belongs to, e.g. urn:li:person:XXXX. */
  authorUrn: string;
  /** Epoch ms when the token was obtained. */
  obtainedAt: number;
}

export function loadToken(): StoredToken | undefined {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return undefined;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (!raw) return undefined;
    return JSON.parse(raw) as StoredToken;
  } catch {
    return undefined;
  }
}

export function saveToken(token: StoredToken): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${TOKEN_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(token, null, 2), 'utf8');
  fs.renameSync(tmp, TOKEN_FILE);
}

export function clearToken(): void {
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
}

/** True when the access token is missing or within `skewMs` of expiring. */
export function isExpired(token: StoredToken, skewMs = 60_000): boolean {
  return !token.accessToken || Date.now() >= token.expiresAt - skewMs;
}
