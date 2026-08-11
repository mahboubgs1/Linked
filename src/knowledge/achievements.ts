/**
 * Achievements — outcome statements usable as credibility anchors.
 * Keep them qualitative and safe to publish (no confidential figures).
 */

export interface AchievementEntry {
  id: string;
  statement: string;
  relatesTo: string[];
}

export const ACHIEVEMENTS: AchievementEntry[] = [
  {
    id: 'ach_reduced_recurring',
    statement:
      'Reduced recurring incidents by shifting effort from repeated fixes to root-cause elimination.',
    relatesTo: ['incident', 'problem', 'root-cause'],
  },
  {
    id: 'ach_fewer_outages',
    statement:
      'Lowered avoidable outages by introducing practical change and release controls.',
    relatesTo: ['change', 'release'],
  },
  {
    id: 'ach_business_trust',
    statement:
      'Improved business trust in IT by reporting on outcomes and user experience, not just ticket volume.',
    relatesTo: ['sla', 'kpi', 'business', 'user-experience'],
  },
];
