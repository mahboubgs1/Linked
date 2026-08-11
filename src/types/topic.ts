/**
 * Topic domain types.
 *
 * Topics are the backbone of the weekly content series. Each topic is used to
 * produce one connected weekly set of posts (teaser / training / case study).
 */

export type TopicStatus = 'unused' | 'used';

export interface Topic {
  /** Stable unique id. */
  id: string;
  /** Human-readable topic title, e.g. "Incident Management vs Problem Management". */
  title: string;
  /** URL/file-safe slug derived from the title. Used for de-duplication. */
  slug: string;
  /** Whether this topic has already been turned into a content series. */
  status: TopicStatus;
  /** Position in the planned content series (1..N). */
  seriesOrder: number;
  /** ISO timestamp of when the topic was first used. */
  usedAt?: string;
}
