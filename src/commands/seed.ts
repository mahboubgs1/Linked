/**
 * `npm run seed` — load the initial topic set into the store (idempotent).
 */

import { TopicService } from '../core/topic/topic.service';
import { SEED_TOPICS } from '../data/seed-topics';
import { run, line } from './util/cli';

run(() => {
  const topics = new TopicService();
  const added = topics.seed(SEED_TOPICS);

  console.log(line('═'));
  console.log(`Seeded topics. ${added} added, ${SEED_TOPICS.length - added} already present.`);
  console.log(`Total topics: ${topics.list().length} (used: ${topics.usedCount()}).`);
  console.log(line('═'));
  console.log('Next: `npm run generate` to create the next weekly series.');
});
