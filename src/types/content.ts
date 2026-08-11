/**
 * Content domain types shared between the generator, the infographic builder
 * and the draft store.
 */

import { WeekDay } from './calendar';

/**
 * The three connected post types published each week for a single topic.
 * (Intentionally small in V1 — extended in a later pass.)
 */
export type PostType = 'teaser' | 'training' | 'case_study';

/**
 * A structured brief describing the infographic that should accompany a post.
 * It is turned into a concrete image-generation prompt by the infographic module.
 */
export interface InfographicBrief {
  /** Short title to render on the infographic (Arabic). */
  title: string;
  /** 3-6 concise key points to visualise. */
  keyPoints: string[];
  /** One-line takeaway / conclusion. */
  takeaway: string;
}

/**
 * A single generated post, before it is persisted as a Draft.
 */
export interface GeneratedPost {
  type: PostType;
  day: WeekDay;
  /** Internal title used for listings/preview (not necessarily posted). */
  title: string;
  /** Post body text (Arabic-first, technical English terms allowed). */
  body: string;
  hashtags: string[];
  /** Fully rendered image-generation prompt. */
  infographicPrompt: string;
}

/**
 * A full weekly series of connected posts around one topic.
 */
export interface GeneratedSeries {
  topicId: string;
  topic: string;
  posts: GeneratedPost[];
}
