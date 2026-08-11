/**
 * Resolves the credentials used to publish.
 *
 * Precedence:
 *   1. Environment variables (LINKEDIN_ACCESS_TOKEN / LINKEDIN_AUTHOR_URN) —
 *      useful for CI or a manually-pasted token.
 *   2. The stored token from `npm run login` (data/linkedin-token.json).
 *
 * This lets the same publish path work whether you linked via OAuth or pasted a
 * token into `.env`.
 */

import { config } from '../config/env';
import { loadToken, isExpired } from './token-store';

export interface ResolvedCredentials {
  accessToken?: string;
  authorUrn?: string;
  source: 'env' | 'oauth' | 'none';
  /** Set when the resolved token is known to be expired. */
  expired?: boolean;
}

export function resolveLinkedInCredentials(): ResolvedCredentials {
  if (config.linkedIn.accessToken) {
    return {
      accessToken: config.linkedIn.accessToken,
      authorUrn: config.linkedIn.authorUrn,
      source: 'env',
    };
  }

  const stored = loadToken();
  if (stored) {
    return {
      accessToken: stored.accessToken,
      authorUrn: stored.authorUrn,
      source: 'oauth',
      expired: isExpired(stored),
    };
  }

  return { source: 'none' };
}
