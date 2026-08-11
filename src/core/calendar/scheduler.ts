/**
 * Scheduler architecture (V1: preparation only — NO automatic publishing).
 *
 * This module intentionally does not run anything on a timer. It only computes
 * *suggested* publish dates for a weekly series so the UI/CLI can show them and
 * a future version can plug in a real scheduler. Publishing always remains a
 * manual, explicitly-approved action.
 */

import { ContentSlot, WeekDay } from '../../types';

const DAY_INDEX: Record<WeekDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ScheduledSlot {
  slot: ContentSlot;
  /** Suggested date (ISO, date only) — advisory, never auto-published. */
  suggestedDate: string;
}

/**
 * Given a week-start date and the calendar slots, compute suggested dates.
 * Pure and deterministic — the caller supplies `weekStart` (no hidden clock).
 */
export function planWeek(
  weekStart: Date,
  slots: ContentSlot[],
): ScheduledSlot[] {
  const startIdx = weekStart.getDay(); // 0=Sunday
  return slots.map((slot) => {
    const offset = (DAY_INDEX[slot.day] - startIdx + 7) % 7;
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    return {
      slot,
      suggestedDate: date.toISOString().slice(0, 10),
    };
  });
}
