/**
 * `npm run generate` — generate a weekly series for a topic and save as drafts.
 *
 * Usage:
 *   npm run generate                         # next unused topic
 *   npm run generate -- --topic "Change Management"
 *
 * Auto-seeds the topic set on first run if the store is empty.
 */

import { TopicService } from '../core/topic/topic.service';
import { DraftService } from '../core/draft/draft.service';
import { TemplateContentGenerator } from '../generator/template.generator';
import { loadCalendar } from '../core/calendar/calendar.model';
import { SEED_TOPICS } from '../data/seed-topics';
import { logger } from '../logging/logger';
import { parseArgs, getString, run, line } from './util/cli';
import { renderDraftRow } from './util/render';

run(() => {
  const args = parseArgs();
  const requestedTopic = getString(args, 'topic');

  const topics = new TopicService();
  const drafts = new DraftService();
  const generator = new TemplateContentGenerator();
  const calendar = loadCalendar();

  // First-run convenience: seed topics if the store is empty.
  if (topics.list().length === 0) {
    topics.seed(SEED_TOPICS);
    console.log('(First run) seeded initial topics.\n');
  }

  const topic = topics.resolveForGeneration(requestedTopic);

  // Guard against accidental duplication of an already-used topic.
  const existing = drafts.getByTopic(topic.id);
  if (existing.length > 0 && topic.status === 'used') {
    throw new Error(
      `Topic "${topic.title}" was already generated (${existing.length} drafts exist). ` +
        `Use a different topic, or delete its drafts to regenerate.`,
    );
  }

  const series = generator.generateSeries(topic, calendar);
  const created = series.posts.map((post) =>
    drafts.createFromGenerated(post, topic),
  );

  topics.markUsed(topic.id);

  logger.info('generated', `Generated ${created.length} drafts for "${topic.title}"`, {
    generator: generator.name,
  });

  console.log(line('═'));
  console.log(`Topic: ${topic.title}`);
  console.log(`Generated ${created.length} connected drafts:`);
  console.log(line('─'));
  created.forEach((d) => console.log(renderDraftRow(d)));
  console.log(line('═'));
  console.log('Next: `npm run drafts` to list, `npm run preview -- --id <id>` to review.');
});
