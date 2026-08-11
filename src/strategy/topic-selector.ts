/**
 * Topic selector — smarter "what to publish next" logic.
 *
 * Default behaviour still respects series order, but this adds pillar-balancing:
 * it prefers the next unused topic whose pillar has been used least recently, so
 * the program doesn't post three "reliability" topics in a row.
 */

import { Topic } from '../types';
import { pillarForTopic } from './content-pillar';

export interface TopicSelection {
  topic: Topic;
  pillar: string;
  reason: string;
}

/**
 * Choose the next topic from the unused set.
 * @param all      all topics (used + unused)
 * @param unused   unused topics, in series order
 */
export function selectNextTopic(all: Topic[], unused: Topic[]): TopicSelection | undefined {
  if (unused.length === 0) return undefined;

  // Count how often each pillar has already been used.
  const usedPillarCounts = new Map<string, number>();
  for (const t of all.filter((x) => x.status === 'used')) {
    const p = pillarForTopic(t.title).key;
    usedPillarCounts.set(p, (usedPillarCounts.get(p) ?? 0) + 1);
  }

  // Prefer the unused topic whose pillar is least used; tie-break by series order.
  let best: TopicSelection | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const topic of unused) {
    const pillar = pillarForTopic(topic.title);
    const score = usedPillarCounts.get(pillar.key) ?? 0;
    if (score < bestScore) {
      bestScore = score;
      best = {
        topic,
        pillar: pillar.label,
        reason:
          score === 0
            ? `Pillar "${pillar.label}" not yet covered`
            : `Balancing pillars ("${pillar.label}" used ${score}x)`,
      };
    }
  }
  return best;
}
