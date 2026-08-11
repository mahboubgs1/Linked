/**
 * Writing style constraints and shared building blocks for generated content.
 *
 * Voice: professional, human, practical, not overly motivational, grounded in
 * real IT application management experience. Arabic-first, with technical
 * English terms used naturally.
 */

export const WRITING_STYLE = {
  language: 'arabic-first',
  tone: 'professional, human, practical, grounded — not motivational fluff',
  allowEnglishTechnicalTerms: true,
};

/** Base hashtags always relevant to the niche (Arabic + English mix). */
export const BASE_HASHTAGS = [
  '#IT_Application_Management',
  '#إدارة_التطبيقات',
  '#Application_Support',
  '#IT_Operations',
];

/**
 * Topic-specific hashtag hints. Falls back to BASE_HASHTAGS when a topic isn't
 * listed. Keys are lowercased substrings matched against the topic title.
 */
export const TOPIC_HASHTAGS: Array<{ match: string; tags: string[] }> = [
  { match: 'incident', tags: ['#Incident_Management', '#Problem_Management', '#إدارة_الحوادث'] },
  { match: 'problem', tags: ['#Problem_Management', '#Root_Cause_Analysis', '#RCA'] },
  { match: 'monitoring', tags: ['#Monitoring', '#Observability', '#Proactive_IT'] },
  { match: 'change', tags: ['#Change_Management', '#ITIL', '#إدارة_التغيير'] },
  { match: 'release', tags: ['#Release_Management', '#DevOps', '#Deployment'] },
  { match: 'sla', tags: ['#SLA', '#User_Experience', '#Service_Management'] },
  { match: 'kpi', tags: ['#KPIs', '#IT_Metrics', '#Business_Value'] },
  { match: 'technical debt', tags: ['#Technical_Debt', '#Software_Quality', '#Modernization'] },
  { match: 'lifecycle', tags: ['#ALM', '#Application_Lifecycle', '#Governance'] },
  { match: 'vendor', tags: ['#Vendor_Management', '#Procurement', '#Contracts'] },
  { match: 'root cause', tags: ['#RCA', '#Problem_Management', '#Reliability'] },
  { match: 'access', tags: ['#Access_Management', '#IAM', '#Security'] },
  { match: 'automation', tags: ['#Automation', '#Efficiency', '#DevOps'] },
  { match: 'business', tags: ['#Business_Value', '#IT_Leadership', '#Alignment'] },
  { match: 'documentation', tags: ['#Documentation', '#Knowledge_Transfer', '#KnowledgeManagement'] },
];

/** Build a de-duplicated hashtag list for a given topic. */
export function hashtagsForTopic(topic: string): string[] {
  const lower = topic.toLowerCase();
  const matched = TOPIC_HASHTAGS.filter((h) => lower.includes(h.match)).flatMap(
    (h) => h.tags,
  );
  const combined = [...BASE_HASHTAGS, ...matched];
  return Array.from(new Set(combined)).slice(0, 8);
}
