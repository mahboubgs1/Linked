/**
 * Forbidden patterns — phrasing that signals generic, low-value "AI content".
 * Consumed by the quality validator to keep posts human and grounded.
 */

export interface ForbiddenPattern {
  /** Case-insensitive substring to flag. */
  phrase: string;
  /** Why it's discouraged. */
  reason: string;
}

export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  { phrase: 'في عالم اليوم', reason: 'Empty opener cliché' },
  { phrase: 'في عصرنا الحالي', reason: 'Empty opener cliché' },
  { phrase: 'لا يخفى على أحد', reason: 'Filler phrase' },
  { phrase: 'مما لا شك فيه', reason: 'Filler phrase' },
  { phrase: 'كما نعلم جميعًا', reason: 'Assumes/filler' },
  { phrase: 'في نهاية المطاف', reason: 'Motivational filler' },
  { phrase: 'game changer', reason: 'Hype term' },
  { phrase: 'revolutionary', reason: 'Hype term' },
  { phrase: 'unlock your potential', reason: 'Motivational fluff' },
  { phrase: 'in today\'s fast-paced world', reason: 'Generic AI opener' },
  { phrase: 'the future is here', reason: 'Hype cliché' },
];
