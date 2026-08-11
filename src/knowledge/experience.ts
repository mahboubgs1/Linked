/**
 * Real experience corpus.
 *
 * Grounds generated content in genuine background so posts don't read as
 * generic. In V1 this is seed data the generator can weave in; when an AI
 * provider is added, these entries become retrieval context.
 *
 * NOTE: keep entries factual and safe to publish. Do not store anything
 * confidential here.
 */

export interface ExperienceEntry {
  id: string;
  area: string;
  summary: string;
  /** Topic slugs/keywords this experience is relevant to. */
  relatesTo: string[];
}

export const EXPERIENCE: ExperienceEntry[] = [
  {
    id: 'exp_app_mgmt',
    area: 'Application Management',
    summary:
      'Leading application support and management across business-critical systems, balancing day-to-day stability with longer-term improvement.',
    relatesTo: ['application-support', 'application-management', 'lifecycle', 'governance'],
  },
  {
    id: 'exp_incident_problem',
    area: 'Incident & Problem Management',
    summary:
      'Moving teams from repeated firefighting toward structured problem management and root-cause elimination.',
    relatesTo: ['incident', 'problem', 'root-cause', 'monitoring'],
  },
  {
    id: 'exp_change_release',
    area: 'Change & Release Management',
    summary:
      'Introducing lightweight change and release discipline that reduced avoidable outages without slowing delivery.',
    relatesTo: ['change', 'release'],
  },
  {
    id: 'exp_business_value',
    area: 'IT–Business Alignment',
    summary:
      'Translating IT operations metrics into business language so stakeholders see value, not just tickets.',
    relatesTo: ['sla', 'kpi', 'business', 'user-experience'],
  },
];
