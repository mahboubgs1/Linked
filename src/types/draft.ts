/**
 * Draft domain types.
 *
 * A Draft is the persisted unit of content. Every generated post is saved as a
 * Draft *before* it can be previewed, approved or published. The `status` field
 * is the safety core of the system: publishing is only allowed when a draft is
 * `approved`.
 */

import { WeekDay } from './calendar';
import { PostType } from './content';

/**
 * Draft lifecycle statuses (V1).
 *
 * draft ──approve──► approved ──publish──► published
 *   └────reject────► rejected
 *
 * The extended lifecycle (idea / review / scheduled / analyzed) is planned for a
 * later pass; the store already tolerates unknown future statuses.
 */
export type DraftStatus = 'draft' | 'approved' | 'published' | 'rejected';

export interface Draft {
  /** Stable unique id. */
  id: string;
  /** Internal title for listing / preview. */
  title: string;
  /** Topic title this draft belongs to. */
  topic: string;
  /** Topic id this draft belongs to. */
  topicId: string;
  /** Post type. */
  type: PostType;
  /** Calendar day this draft is intended for. */
  day: WeekDay;
  /** Post body (Arabic-first). */
  body: string;
  hashtags: string[];
  /** Rendered image-generation prompt for the accompanying infographic. */
  infographic_prompt: string;
  /** Lifecycle status. */
  status: DraftStatus;
  /** ISO creation timestamp. */
  created_at: string;
  /** ISO last-update timestamp. */
  updated_at: string;
  /** ISO publish timestamp (set once published). */
  publishedAt?: string;
  /** Id returned by LinkedIn once published. */
  linkedInPostId?: string;
  /** Reason recorded when a draft is rejected. */
  rejectionReason?: string;
}
