/**
 * Lessons learned — practical takeaways that give posts a genuine point of view.
 */

export interface LessonEntry {
  id: string;
  lesson: string;
  relatesTo: string[];
}

export const LESSONS: LessonEntry[] = [
  {
    id: 'les_process_before_tools',
    lesson:
      'Tools rarely fix a broken process. Clear ownership and a simple process beat expensive tooling.',
    relatesTo: ['automation', 'change', 'monitoring', 'application-management'],
  },
  {
    id: 'les_symptom_vs_cause',
    lesson:
      'Treating symptoms feels productive but compounds cost. The cheapest fix is closing the root cause.',
    relatesTo: ['incident', 'problem', 'root-cause'],
  },
  {
    id: 'les_speak_business',
    lesson:
      'If you cannot explain an IT metric in business terms, it will not get attention or budget.',
    relatesTo: ['sla', 'kpi', 'business'],
  },
  {
    id: 'les_proactive_pays',
    lesson:
      'Proactive monitoring looks like overhead until the first outage it prevents.',
    relatesTo: ['monitoring'],
  },
];
