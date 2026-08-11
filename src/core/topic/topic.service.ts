/**
 * Topic management service.
 *
 * Responsibilities:
 *  - seed the initial 15-topic set (supports a 30-post / multi-week series),
 *  - track which topics have already been used,
 *  - prevent accidental duplication,
 *  - hand out the next unused topic for generation.
 */

import { Topic } from '../../types';
import { logger } from '../../logging/logger';
import { TopicRepository } from './topic.repository';

/** Create a file/URL-safe slug used for de-duplication. */
export function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function id(): string {
  return `topic_${Date.now().toString(36)}_${Math.floor(
    // deterministic-enough uniqueness without extra deps
    performance.now() * 1000,
  ).toString(36)}`;
}

export class TopicService {
  constructor(private readonly repo = new TopicRepository()) {}

  list(): Topic[] {
    return this.repo.findAll().sort((a, b) => a.seriesOrder - b.seriesOrder);
  }

  usedCount(): number {
    return this.repo.findAll().filter((t) => t.status === 'used').length;
  }

  /**
   * Seed topics from a list of titles. Idempotent: existing slugs are skipped,
   * so re-running never duplicates. Returns the number of newly added topics.
   */
  seed(titles: string[]): number {
    const existing = this.repo.findAll();
    const existingSlugs = new Set(existing.map((t) => t.slug));
    let order =
      existing.reduce((max, t) => Math.max(max, t.seriesOrder), 0) + 1;

    let added = 0;
    for (const title of titles) {
      const slug = slugify(title);
      if (existingSlugs.has(slug)) continue;
      existing.push({
        id: id(),
        title: title.trim(),
        slug,
        status: 'unused',
        seriesOrder: order++,
      });
      existingSlugs.add(slug);
      added++;
    }

    this.repo.save(existing);
    logger.info('info', `Seeded topics: ${added} added, ${titles.length - added} skipped (already present)`);
    return added;
  }

  /**
   * Resolve a topic to generate for.
   *  - If `title` is provided, find (or create) it, guarding against duplicates.
   *  - Otherwise return the next unused topic by series order.
   */
  resolveForGeneration(title?: string): Topic {
    if (title && title.trim()) {
      const slug = slugify(title);
      const existing = this.repo.findBySlug(slug);
      if (existing) return existing;

      // New ad-hoc topic — append to the series.
      const all = this.repo.findAll();
      const order = all.reduce((max, t) => Math.max(max, t.seriesOrder), 0) + 1;
      const topic: Topic = {
        id: id(),
        title: title.trim(),
        slug,
        status: 'unused',
        seriesOrder: order,
      };
      this.repo.upsert(topic);
      return topic;
    }

    const next = this.list().find((t) => t.status === 'unused');
    if (!next) {
      throw new Error(
        'No unused topics available. Add a new one with `npm run generate -- --topic "Your Topic"` or seed more topics.',
      );
    }
    return next;
  }

  /** Mark a topic as used once its series has been generated. */
  markUsed(topicId: string): void {
    const topic = this.repo.findById(topicId);
    if (!topic) return;
    topic.status = 'used';
    topic.usedAt = new Date().toISOString();
    this.repo.upsert(topic);
  }
}
