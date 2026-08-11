/**
 * Draft persistence. Backed by data/drafts.json.
 */

import { Draft, DraftStatus } from '../../types';
import { JsonStore } from '../storage/json-store';

export class DraftRepository {
  private readonly store = new JsonStore<Draft>('drafts.json');

  findAll(): Draft[] {
    return this.store.readAll();
  }

  findById(id: string): Draft | undefined {
    return this.findAll().find((d) => d.id === id);
  }

  findByStatus(status: DraftStatus): Draft[] {
    return this.findAll().filter((d) => d.status === status);
  }

  findByTopicId(topicId: string): Draft[] {
    return this.findAll().filter((d) => d.topicId === topicId);
  }

  save(drafts: Draft[]): void {
    this.store.writeAll(drafts);
  }

  add(draft: Draft): void {
    const all = this.findAll();
    all.push(draft);
    this.save(all);
  }

  update(draft: Draft): void {
    const all = this.findAll();
    const idx = all.findIndex((d) => d.id === draft.id);
    if (idx < 0) throw new Error(`Draft not found: ${draft.id}`);
    all[idx] = draft;
    this.save(all);
  }
}
