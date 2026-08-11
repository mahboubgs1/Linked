/**
 * Knowledge service — retrieves relevant real-experience anchors for a topic.
 *
 * Matching is keyword-based against each entry's `relatesTo` tags (derived from
 * the topic slug). Returns the best lesson/experience so the generator can
 * ground content in something real rather than generic.
 */

import { EXPERIENCE, ExperienceEntry } from './experience';
import { PROJECTS, ProjectEntry } from './projects';
import { ACHIEVEMENTS, AchievementEntry } from './achievements';
import { LESSONS, LessonEntry } from './lessons';

export interface KnowledgeContext {
  experience?: ExperienceEntry;
  project?: ProjectEntry;
  achievement?: AchievementEntry;
  lesson?: LessonEntry;
}

/** Split a topic slug/title into lowercase keyword tokens. */
function tokens(topicSlug: string): string[] {
  return topicSlug.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

function bestMatch<T extends { relatesTo: string[] }>(
  items: T[],
  toks: string[],
): T | undefined {
  let best: { item: T; score: number } | undefined;
  for (const item of items) {
    const score = item.relatesTo.reduce(
      (s, tag) => s + (toks.some((t) => tag.includes(t) || t.includes(tag)) ? 1 : 0),
      0,
    );
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}

export class KnowledgeService {
  /** Get grounding context for a topic (by slug or title). */
  forTopic(topicSlug: string): KnowledgeContext {
    const toks = tokens(topicSlug);
    return {
      experience: bestMatch(EXPERIENCE, toks),
      project: bestMatch(PROJECTS, toks),
      achievement: bestMatch(ACHIEVEMENTS, toks),
      lesson: bestMatch(LESSONS, toks),
    };
  }
}
