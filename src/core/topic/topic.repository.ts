/**
 * Topic persistence. Backed by data/topics.json.
 */

import { Topic } from '../../types';
import { JsonStore } from '../storage/json-store';

export class TopicRepository {
  private readonly store = new JsonStore<Topic>('topics.json');

  findAll(): Topic[] {
    return this.store.readAll();
  }

  findById(id: string): Topic | undefined {
    return this.findAll().find((t) => t.id === id);
  }

  findBySlug(slug: string): Topic | undefined {
    return this.findAll().find((t) => t.slug === slug);
  }

  save(topics: Topic[]): void {
    this.store.writeAll(topics);
  }

  upsert(topic: Topic): void {
    const all = this.findAll();
    const idx = all.findIndex((t) => t.id === topic.id);
    if (idx >= 0) all[idx] = topic;
    else all.push(topic);
    this.save(all);
  }
}
