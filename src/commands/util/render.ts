/**
 * Shared rendering helpers for CLI output.
 */

import { Draft } from '../../types';
import { line } from './cli';

const STATUS_ICON: Record<Draft['status'], string> = {
  draft: '📝',
  approved: '✅',
  published: '📢',
  rejected: '🚫',
};

/** One-line summary row for the drafts list. */
export function renderDraftRow(d: Draft): string {
  const icon = STATUS_ICON[d.status] ?? '•';
  return `${icon} ${d.id}  [${d.status.padEnd(9)}] ${d.type.padEnd(10)} ${d.day.padEnd(9)} — ${d.topic}`;
}

/** Full preview of a single draft. */
export function renderDraftPreview(d: Draft): string {
  return [
    line('═'),
    `ID:        ${d.id}`,
    `Topic:     ${d.topic}`,
    `Type:      ${d.type}   Day: ${d.day}`,
    `Status:    ${d.status}`,
    `Created:   ${d.created_at}`,
    d.publishedAt ? `Published: ${d.publishedAt}` : '',
    line('─'),
    'POST BODY:',
    '',
    d.body,
    '',
    line('─'),
    `HASHTAGS:  ${d.hashtags.join('  ')}`,
    line('─'),
    'INFOGRAPHIC PROMPT:',
    '',
    d.infographic_prompt,
    line('═'),
  ]
    .filter((l) => l !== '')
    .join('\n');
}
