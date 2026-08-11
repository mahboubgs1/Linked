/**
 * `npm run preview` — show the full content of a draft (or all drafts for a
 * topic) exactly as it would be published, including the infographic prompt.
 *
 * Usage:
 *   npm run preview -- --id <draftId>
 *   npm run preview -- --topic-id <topicId>
 */

import { DraftService } from '../core/draft/draft.service';
import { parseArgs, getString, run } from './util/cli';
import { renderDraftPreview } from './util/render';

run(() => {
  const args = parseArgs();
  const id = getString(args, 'id');
  const topicId = getString(args, 'topic-id');

  const service = new DraftService();

  if (id) {
    console.log(renderDraftPreview(service.get(id)));
    return;
  }

  if (topicId) {
    const drafts = service.getByTopic(topicId);
    if (drafts.length === 0) {
      throw new Error(`No drafts found for topic id "${topicId}".`);
    }
    drafts.forEach((d) => console.log(renderDraftPreview(d)));
    return;
  }

  throw new Error(
    'Provide --id <draftId> or --topic-id <topicId>. See `npm run drafts` for ids.',
  );
});
