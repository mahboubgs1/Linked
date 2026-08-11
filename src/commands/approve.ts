/**
 * `npm run approve` — approve (or reject) a draft.
 *
 * Usage:
 *   npm run approve -- --id <draftId>
 *   npm run approve -- --id <draftId> --reject --reason "too generic"
 *
 * Approval is the required gate before publishing.
 */

import { DraftService } from '../core/draft/draft.service';
import { validateBrand } from '../validators/brand.validator';
import { validateQuality } from '../validators/quality.validator';
import { combine } from '../validators/validation.types';
import { parseArgs, getString, getFlag, run, line } from './util/cli';
import { renderDraftPreview } from './util/render';

run(() => {
  const args = parseArgs();
  const id = getString(args, 'id');
  if (!id) {
    throw new Error('Provide --id <draftId>. See `npm run drafts` for ids.');
  }

  const service = new DraftService();

  if (getFlag(args, 'reject')) {
    const reason = getString(args, 'reason') ?? 'No reason provided';
    const draft = service.reject(id, reason);
    console.log(line('═'));
    console.log(`🚫 Draft ${draft.id} rejected. Reason: ${reason}`);
    console.log(line('═'));
    return;
  }

  // Show brand/quality feedback before approving (non-blocking at this stage).
  const preCheck = combine([validateBrand(service.get(id)), validateQuality(service.get(id))]);
  if (preCheck.issues.length > 0) {
    console.log('Pre-approval checks:');
    for (const issue of preCheck.issues) {
      const mark = issue.severity === 'error' ? '  ✖' : '  ⚠';
      console.log(`${mark} [${issue.code}] ${issue.message}`);
    }
    console.log('');
  }

  const draft = service.approve(id);
  console.log(renderDraftPreview(draft));
  console.log(`\n✅ Draft ${draft.id} approved. It can now be published with:`);
  console.log(`   npm run publish -- --id ${draft.id}`);
});
