/**
 * LinkedIn publishing service.
 *
 * Behaviour:
 *  - If LINKEDIN_DRY_RUN=true, or no access token is configured, the publish is
 *    SIMULATED (no network call) and clearly logged. This lets the whole
 *    approval → publish workflow be tested safely without real credentials.
 *  - Otherwise it posts to the LinkedIn UGC Posts API using the access token.
 *
 * Credentials come exclusively from environment variables.
 */

import { config } from '../config/env';
import { logger } from '../logging/logger';
import { resolveLinkedInCredentials } from './credentials';
import {
  ILinkedInProvider,
  LinkedInPostContent,
  LinkedInPublishResult,
} from './linkedin.interface';

const UGC_ENDPOINT = 'https://api.linkedin.com/v2/ugcPosts';

export class LinkedInService implements ILinkedInProvider {
  readonly name = 'linkedin';

  async publish(content: LinkedInPostContent): Promise<LinkedInPublishResult> {
    const creds = resolveLinkedInCredentials();
    const token = creds.accessToken;
    const useDryRun = config.linkedIn.dryRun || !token;

    if (useDryRun) {
      const id = `dryrun_${Date.now().toString(36)}`;
      const reason = config.linkedIn.dryRun
        ? 'LINKEDIN_DRY_RUN=true'
        : 'no access token (run `npm run login`)';
      logger.warn(
        'publishing',
        `DRY-RUN publish (no real API call). Reason: ${reason}.`,
        { author: content.authorUrn, chars: content.text.length },
      );
      return { id, dryRun: true, raw: { simulated: true, text: content.text } };
    }

    if (creds.expired) {
      throw new Error(
        'LinkedIn access token has expired. Run `npm run login` again to re-link.',
      );
    }

    const payload = {
      author: content.authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content.text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    try {
      const res = await fetch(UGC_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': config.linkedIn.apiVersion,
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.json().catch(() => ({}));

      if (!res.ok) {
        logger.error('linkedin_response', `LinkedIn API error ${res.status}`, {
          status: res.status,
          body: raw,
        });
        throw new Error(
          `LinkedIn API returned ${res.status}: ${JSON.stringify(raw)}`,
        );
      }

      const id =
        (raw as { id?: string }).id ||
        res.headers.get('x-restli-id') ||
        `post_${Date.now().toString(36)}`;

      logger.info('linkedin_response', `LinkedIn accepted post ${id}`, {
        status: res.status,
      });
      return { id, dryRun: false, raw };
    } catch (err) {
      logger.error('error', `Publish failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
