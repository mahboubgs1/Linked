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

  const draft = service.approve(id);
  console.log(renderDraftPreview(draft));
  console.log(`\n✅ Draft ${draft.id} approved. It can now be published with:`);
  console.log(`   npm run publish -- --id ${draft.id}`);
});
