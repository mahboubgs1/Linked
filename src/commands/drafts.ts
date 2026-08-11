/**
 * `npm run drafts` — list drafts, optionally filtered by status.
 *
 * Usage:
 *   npm run drafts
 *   npm run drafts -- --status approved
 */

import { DraftService } from '../core/draft/draft.service';
import { DraftStatus } from '../types';
import { parseArgs, getString, run, line } from './util/cli';
import { renderDraftRow } from './util/render';

const VALID: DraftStatus[] = ['draft', 'approved', 'published', 'rejected'];

run(() => {
  const args = parseArgs();
  const status = getString(args, 'status') as DraftStatus | undefined;

  if (status && !VALID.includes(status)) {
    throw new Error(`Invalid --status "${status}". Valid: ${VALID.join(', ')}.`);
  }

  const service = new DraftService();
  const drafts = service.list(status);

  console.log(line('═'));
  console.log(status ? `Drafts (status = ${status})` : 'All drafts');
  console.log(line('─'));

  if (drafts.length === 0) {
    console.log('No drafts found. Run `npm run generate` to create some.');
  } else {
    drafts.forEach((d) => console.log(renderDraftRow(d)));
  }

  console.log(line('─'));
  const counts = VALID.map((s) => `${s}: ${service.list(s).length}`).join('   ');
  console.log(counts);
  console.log(line('═'));
});
