/**
 * `npm run token:status` — show the current LinkedIn linking state.
 *
 * Reports where credentials come from (env vs stored OAuth token), the author
 * URN, time until expiry, refresh-token availability, and whether the next
 * publish would post for real or run in dry-run.
 */

import { config } from '../config/env';
import { resolveLinkedInCredentials } from '../linkedin/credentials';
import { loadToken } from '../linkedin/token-store';
import { run, line } from './util/cli';

function humanizeMs(ms: number): string {
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days} day(s) ${hours} hour(s)`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours} hour(s) ${mins} min(s)`;
}

run(() => {
  const creds = resolveLinkedInCredentials();
  const stored = loadToken();

  console.log(line('═'));
  console.log('LinkedIn link status');
  console.log(line('─'));

  if (creds.source === 'none') {
    console.log('State:        ❌ Not linked');
    console.log('Action:       run `npm run login` (or set LINKEDIN_ACCESS_TOKEN in .env)');
    console.log(line('─'));
    console.log('Publish mode: DRY-RUN (no real posts until linked)');
    console.log(line('═'));
    return;
  }

  const sourceLabel =
    creds.source === 'env' ? 'environment (.env)' : 'stored OAuth token (npm run login)';

  console.log(`State:        ${creds.expired ? '⚠️  Linked but EXPIRED' : '✅ Linked'}`);
  console.log(`Source:       ${sourceLabel}`);
  console.log(`Author URN:   ${creds.authorUrn ?? '(not set — set LINKEDIN_AUTHOR_URN)'}`);

  if (creds.source === 'oauth' && stored) {
    const untilExpiry = stored.expiresAt - Date.now();
    console.log(
      untilExpiry <= 0
        ? 'Access token: expired'
        : `Access token: expires in ${humanizeMs(untilExpiry)}`,
    );
    if (stored.refreshToken) {
      const refreshLeft =
        stored.refreshExpiresAt !== undefined
          ? `expires in ${humanizeMs(stored.refreshExpiresAt - Date.now())}`
          : 'available';
      console.log(`Refresh token: ${refreshLeft}`);
    } else {
      console.log('Refresh token: none (re-run `npm run login` when the token expires)');
    }
    console.log(`Obtained at:  ${new Date(stored.obtainedAt).toISOString()}`);
  }

  console.log(line('─'));
  const dryRun = config.linkedIn.dryRun || !creds.accessToken || creds.expired;
  if (dryRun) {
    const why = config.linkedIn.dryRun
      ? 'LINKEDIN_DRY_RUN=true'
      : creds.expired
        ? 'token expired'
        : 'no access token';
    console.log(`Publish mode: DRY-RUN (${why})`);
  } else {
    console.log('Publish mode: 🔴 LIVE — `npm run publish` will post for real');
  }
  console.log(line('═'));
});
