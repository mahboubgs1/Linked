/**
 * Notable projects — concrete anchors that make content credible.
 * Keep publishable and non-confidential.
 */

export interface ProjectEntry {
  id: string;
  name: string;
  summary: string;
  relatesTo: string[];
}

export const PROJECTS: ProjectEntry[] = [
  {
    id: 'proj_erp',
    name: 'ERP implementation & support',
    summary:
      'End-to-end involvement in ERP rollout and ongoing application support, from cutover stabilization to steady-state operations.',
    relatesTo: ['application-management', 'change', 'release', 'lifecycle'],
  },
  {
    id: 'proj_proptech',
    name: 'Property technology platform',
    summary:
      'Managing a property-technology application landscape where uptime directly affects operational and tenant experience.',
    relatesTo: ['monitoring', 'sla', 'user-experience', 'incident'],
  },
  {
    id: 'proj_transformation',
    name: 'Digital transformation initiative',
    summary:
      'Supporting a digital transformation program by aligning application governance with business priorities.',
    relatesTo: ['governance', 'business', 'automation'],
  },
];
