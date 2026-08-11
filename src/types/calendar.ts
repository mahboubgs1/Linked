/**
 * Content calendar types.
 *
 * The calendar is intentionally config-driven: the default is 3 posts per week
 * (Sunday / Tuesday / Thursday) but additional slots can be added later without
 * touching the architecture — see `core/calendar/calendar.model.ts`.
 */

import { PostType } from './content';

export type WeekDay =
  | 'saturday'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday';

/**
 * A single publishing slot in the weekly calendar.
 */
export interface ContentSlot {
  day: WeekDay;
  /** The post type produced for this slot. */
  type: PostType;
  /** Human label for the slot, e.g. "Industry Insight / Executive Opinion". */
  label: string;
  /** The editorial objective of the slot. */
  objective: string;
  /** Primary audience the slot targets. */
  audience: string;
}
