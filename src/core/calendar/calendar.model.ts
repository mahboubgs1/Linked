/**
 * Weekly content calendar.
 *
 * Default cadence (V1): 3 connected posts per week around a single topic.
 *   Sunday   → Industry Insight / Executive Opinion (teaser)
 *   Tuesday  → Training / Educational               (training)
 *   Thursday → Case Study / Scenario                (case_study)
 *
 * Config-driven: if `data/calendar.json` exists it overrides the default, so
 * additional slots can be added later without any code changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ContentSlot } from '../../types';
import { logger } from '../../logging/logger';

export const DEFAULT_CALENDAR: ContentSlot[] = [
  {
    day: 'sunday',
    type: 'teaser',
    label: 'Industry Insight / Executive Opinion',
    objective:
      'Spark curiosity around the weekly topic with a thought-provoking hook.',
    audience: 'IT leaders, application managers, business stakeholders',
  },
  {
    day: 'tuesday',
    type: 'training',
    label: 'Training / Educational',
    objective:
      'Explain the concept clearly and practically, supported by an infographic.',
    audience: 'Practitioners and teams in application support and IT operations',
  },
  {
    day: 'thursday',
    type: 'case_study',
    label: 'Case Study / Scenario',
    objective:
      'Present a realistic scenario, checklist or discussion question to drive engagement.',
    audience: 'Experienced professionals and decision makers',
  },
];

const CALENDAR_FILE = path.resolve(process.cwd(), 'data', 'calendar.json');

/**
 * Load the active calendar. Falls back to the default when no config file is
 * present or the file is invalid.
 */
export function loadCalendar(): ContentSlot[] {
  try {
    if (!fs.existsSync(CALENDAR_FILE)) return DEFAULT_CALENDAR;
    const raw = fs.readFileSync(CALENDAR_FILE, 'utf8').trim();
    if (!raw) return DEFAULT_CALENDAR;
    const parsed = JSON.parse(raw) as ContentSlot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CALENDAR;
    return parsed;
  } catch (err) {
    logger.warn(
      'info',
      `Could not read calendar config, using default: ${(err as Error).message}`,
    );
    return DEFAULT_CALENDAR;
  }
}
