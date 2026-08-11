/**
 * Content pillars — the thematic buckets the content program rotates through.
 * Each seed topic maps to a pillar, which helps keep the series balanced.
 */

export interface ContentPillar {
  key: string;
  label: string;
  /** Keywords that map a topic to this pillar. */
  keywords: string[];
}

export const CONTENT_PILLARS: ContentPillar[] = [
  {
    key: 'operations',
    label: 'IT Operations & Support',
    keywords: ['support', 'management', 'operations', 'access', 'documentation', 'knowledge'],
  },
  {
    key: 'reliability',
    label: 'Reliability & Resolution',
    keywords: ['incident', 'problem', 'monitoring', 'root cause', 'debt'],
  },
  {
    key: 'delivery',
    label: 'Change & Delivery',
    keywords: ['change', 'release', 'lifecycle', 'automation'],
  },
  {
    key: 'value',
    label: 'Business Value & Leadership',
    keywords: ['sla', 'kpi', 'business', 'vendor', 'user experience', 'priorities'],
  },
];

/** Classify a topic title into a pillar (falls back to 'operations'). */
export function pillarForTopic(title: string): ContentPillar {
  const lower = title.toLowerCase();
  return (
    CONTENT_PILLARS.find((p) => p.keywords.some((k) => lower.includes(k))) ??
    CONTENT_PILLARS[0]
  );
}
