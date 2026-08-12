/**
 * `npm run login` — link the system to a LinkedIn account via OAuth.
 *
 * Flow:
 *   1. Starts a tiny local server on the redirect URI.
 *   2. Opens (or prints) the LinkedIn authorization URL.
 *   3. Captures the redirect, exchanges the code for an access token.
 *   4. Resolves the author URN and saves everything to data/linkedin-token.json.
 *
 * After this, `npm run publish` posts for real (set LINKEDIN_DRY_RUN=false).
 */

import * as http from 'http';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { config } from '../config/env';
import { logger } from '../logging/logger';
import {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchMemberUrn,
  toStoredToken,
  scopes,
} from '../linkedin/oauth.service';
import { saveToken } from '../linkedin/token-store';
import { run, line } from './util/cli';

function tryOpenBrowser(url: string): void {
  const platform = process.platform;
  try {
    let child;
    if (platform === 'win32') {
      // On Windows, cmd's `start` treats `&` as a command separator, which
      // truncates an OAuth URL at the first `&` (dropping client_id, scope,
      // etc.). Wrap the whole command in one verbatim string with the URL
      // quoted so `&` is taken literally.
      child = spawn('cmd.exe', ['/c', `start "" "${url}"`], {
        windowsVerbatimArguments: true,
        stdio: 'ignore',
        detached: true,
      });
    } else {
      const cmd = platform === 'darwin' ? 'open' : 'xdg-open';
      child = spawn(cmd, [url], { stdio: 'ignore', detached: true });
    }
    child.on('error', () => {
      /* ignore — the URL is printed as a fallback */
    });
    child.unref();
  } catch {
    /* ignore */
  }
}

/** Wait for the OAuth redirect and return the authorization code. */
function waitForCallback(
  redirectUri: string,
  expectedState: string,
): Promise<string> {
  const url = new URL(redirectUri);
  const port = Number(url.port) || 80;
  const callbackPath = url.pathname;

  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const reqUrl = new URL(req.url, `http://${url.host}`);
      if (reqUrl.pathname !== callbackPath) {
        res.writeHead(404).end('Not found');
        return;
      }

      const error = reqUrl.searchParams.get('error');
      const code = reqUrl.searchParams.get('code');
      const state = reqUrl.searchParams.get('state');

      const finish = (ok: boolean, message: string) => {
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          `<html><body style="font-family:sans-serif;text-align:center;padding:3rem">
             <h2>${ok ? '✅ LinkedIn linked' : '⚠️ Linking failed'}</h2>
             <p>${message}</p>
             <p>You can close this tab and return to the terminal.</p>
           </body></html>`,
        );
        server.close();
      };

      if (error) {
        finish(false, `LinkedIn returned an error: ${error}`);
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }
      if (state !== expectedState) {
        finish(false, 'State mismatch (possible CSRF). Please try again.');
        reject(new Error('OAuth state mismatch.'));
        return;
      }
      if (!code) {
        finish(false, 'No authorization code received.');
        reject(new Error('No authorization code in callback.'));
        return;
      }

      finish(true, 'Token captured successfully.');
      resolve(code);
    });

    server.on('error', reject);
    server.listen(port, () => {
      logger.info('info', `OAuth callback server listening on ${redirectUri}`);
    });
  });
}

run(async () => {
  const { redirectUri } = config.linkedIn;
  if (!redirectUri) {
    throw new Error('Set LINKEDIN_REDIRECT_URI in .env (see .env.example).');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildAuthorizationUrl(state);

  console.log(line('═'));
  console.log('Linking to LinkedIn…');
  console.log(`Scopes: ${scopes().join(' ')}`);
  console.log(line('─'));
  console.log('A browser window should open automatically. If it shows an error');
  console.log('or does not open, COPY the entire URL below and paste it into your');
  console.log('browser address bar (copy the whole line — it is long):');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log(line('─'));
  console.log('Waiting for you to authorize in the browser…');

  tryOpenBrowser(authUrl);

  const code = await waitForCallback(redirectUri, state);
  console.log('Authorization received. Exchanging for an access token…');

  const tokenResp = await exchangeCodeForToken(code);

  let authorUrn = config.linkedIn.authorUrn;
  if (!authorUrn) {
    try {
      authorUrn = await fetchMemberUrn(tokenResp.access_token);
    } catch (err) {
      throw new Error(
        `Got a token but could not resolve your author URN: ${(err as Error).message}`,
      );
    }
  }

  const stored = toStoredToken(tokenResp, authorUrn);
  saveToken(stored);
  logger.info('info', 'LinkedIn token saved', { authorUrn, hasRefresh: !!stored.refreshToken });

  const expiresInDays = Math.round((stored.expiresAt - Date.now()) / 86_400_000);
  console.log(line('═'));
  console.log('✅ Linked to LinkedIn.');
  console.log(`   Author URN:   ${authorUrn}`);
  console.log(`   Token expires: ~${expiresInDays} day(s)`);
  console.log(`   Refresh token: ${stored.refreshToken ? 'yes' : 'no (re-run login when it expires)'}`);
  console.log(`   Saved to:      data/linkedin-token.json (git-ignored)`);
  console.log(line('─'));
  console.log('Set LINKEDIN_DRY_RUN=false in .env to publish for real, then:');
  console.log('   npm run publish -- --id <approvedDraftId>');
  console.log(line('═'));
});
