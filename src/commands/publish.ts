/**
 * `npm run publish` — publish an APPROVED draft to LinkedIn.
 *
 * Usage:
 *   npm run publish -- --id <draftId>
 *
 * Hard rule: publishing fails unless the draft's status is `approved`.
 * With no access token configured (or LINKEDIN_DRY_RUN=true) the publish is
 * simulated so the workflow can be tested safely.
 */

import { DraftService } from '../core/draft/draft.service';
import { LinkedInService } from '../linkedin/linkedin.service';
import { config, missingPublishCredentials } from '../config/env';
import { logger } from '../logging/logger';
import { validateForPublishing } from '../validators/publishing.validator';
import { parseArgs, getString, run, line } from './util/cli';

run(async () => {
  const args = parseArgs();
  const id = getString(args, 'id');
  if (!id) {
    throw new Error('Provide --id <draftId>. See `npm run drafts -- --status approved`.');
  }

  const drafts = new DraftService();
  const linkedIn = new LinkedInService();

  const draft = drafts.get(id);

  // SAFETY CORE: refuse to publish anything that is not approved.
  drafts.assertPublishable(draft);

  // GUARDRAILS: brand + quality + status checks. Errors block; warnings inform.
  const validation = validateForPublishing(draft);
  if (validation.issues.length > 0) {
    console.log('Guardrail checks:');
    for (const issue of validation.issues) {
      const mark = issue.severity === 'error' ? '  ✖' : '  ⚠';
      console.log(`${mark} [${issue.code}] ${issue.message}`);
    }
    console.log('');
  }
  if (!validation.passed) {
    logger.warn('publishing', `Publish blocked by guardrails: ${draft.id}`, {
      issues: validation.issues,
    });
    throw new Error('Draft failed publishing guardrails (see errors above).');
  }

  const willReallyPost = !config.linkedIn.dryRun && !!config.linkedIn.accessToken;
  if (willReallyPost) {
    const missing = missingPublishCredentials();
    if (missing.length > 0) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}.`);
    }
  } else {
    console.log('ℹ️  Running in DRY-RUN mode (no real LinkedIn post). See .env to configure real publishing.\n');
  }

  const text = `${draft.body}\n\n${draft.hashtags.join(' ')}`;
  logger.info('publishing', `Publishing draft ${draft.id}`, { dryRun: !willReallyPost });

  const result = await linkedIn.publish({
    text,
    authorUrn: config.linkedIn.authorUrn ?? 'urn:li:person:DRYRUN',
  });

  const updated = drafts.markPublished(draft.id, result.id);

  console.log(line('═'));
  console.log(`📢 Published draft ${updated.id}`);
  console.log(`   LinkedIn id: ${result.id}${result.dryRun ? ' (dry-run)' : ''}`);
  console.log(`   Status:      ${updated.status}`);
  console.log(`   Published at:${updated.publishedAt}`);
  console.log(line('═'));
});
