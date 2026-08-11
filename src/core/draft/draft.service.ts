/**
 * Draft service — owns the draft lifecycle and its state machine.
 *
 * SAFETY CORE: the only path to `published` is through `approved`. Any attempt
 * to publish a draft that is not `approved` throws. This guarantees the system
 * never publishes without explicit user approval (V1 requirement).
 */

import { Draft, DraftStatus, GeneratedPost, Topic } from '../../types';
import { logger } from '../../logging/logger';
import { DraftRepository } from './draft.repository';

/** Allowed status transitions. */
const TRANSITIONS: Record<DraftStatus, DraftStatus[]> = {
  draft: ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  rejected: ['draft'], // allow re-opening a rejected draft for editing/regeneration
  published: [], // terminal
};

function draftId(): string {
  return `draft_${Date.now().toString(36)}_${Math.floor(
    performance.now() * 1000,
  ).toString(36)}`;
}

export class DraftError extends Error {}

export class DraftService {
  constructor(private readonly repo = new DraftRepository()) {}

  list(status?: DraftStatus): Draft[] {
    const all = status ? this.repo.findByStatus(status) : this.repo.findAll();
    return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  get(id: string): Draft {
    const draft = this.repo.findById(id);
    if (!draft) throw new DraftError(`Draft not found: ${id}`);
    return draft;
  }

  getByTopic(topicId: string): Draft[] {
    return this.repo.findByTopicId(topicId);
  }

  /** Persist a freshly generated post as a `draft`. */
  createFromGenerated(post: GeneratedPost, topic: Topic): Draft {
    const now = new Date().toISOString();
    const draft: Draft = {
      id: draftId(),
      title: post.title,
      topic: topic.title,
      topicId: topic.id,
      type: post.type,
      day: post.day,
      body: post.body,
      hashtags: post.hashtags,
      infographic_prompt: post.infographicPrompt,
      status: 'draft',
      created_at: now,
      updated_at: now,
    };
    this.repo.add(draft);
    logger.info('generated', `Draft created: ${draft.id} (${draft.type})`, {
      topic: topic.title,
      type: draft.type,
    });
    return draft;
  }

  private transition(draft: Draft, to: DraftStatus): void {
    const allowed = TRANSITIONS[draft.status];
    if (!allowed.includes(to)) {
      throw new DraftError(
        `Illegal status transition: ${draft.status} → ${to} (draft ${draft.id})`,
      );
    }
    draft.status = to;
    draft.updated_at = new Date().toISOString();
  }

  approve(id: string): Draft {
    const draft = this.get(id);
    this.transition(draft, 'approved');
    this.repo.update(draft);
    logger.info('approval', `Draft approved: ${draft.id}`, { type: draft.type });
    return draft;
  }

  reject(id: string, reason: string): Draft {
    const draft = this.get(id);
    this.transition(draft, 'rejected');
    draft.rejectionReason = reason;
    this.repo.update(draft);
    logger.info('rejection', `Draft rejected: ${draft.id}`, { reason });
    return draft;
  }

  /**
   * Guard used by the publish command. Throws unless the draft is approved.
   * This is the single enforcement point of the "no publish without approval"
   * rule.
   */
  assertPublishable(draft: Draft): void {
    if (draft.status !== 'approved') {
      throw new DraftError(
        `Cannot publish draft ${draft.id}: status is "${draft.status}", must be "approved". Run \`npm run approve -- --id ${draft.id}\` first.`,
      );
    }
  }

  /** Mark a draft as published after a successful LinkedIn response. */
  markPublished(id: string, linkedInPostId: string): Draft {
    const draft = this.get(id);
    this.transition(draft, 'published');
    draft.publishedAt = new Date().toISOString();
    draft.linkedInPostId = linkedInPostId;
    this.repo.update(draft);
    logger.info('publishing', `Draft marked published: ${draft.id}`, {
      linkedInPostId,
    });
    return draft;
  }
}
