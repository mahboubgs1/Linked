/**
 * Quality validator — guards against generic "AI content".
 *
 * Checks the guardrail questions from the spec:
 *  - Is it generic AI content? (forbidden patterns)
 *  - Does it read as real/practical? (heuristic signals)
 *  - Does it provide business value? (value keywords present)
 */

import { Draft } from '../types';
import { FORBIDDEN_PATTERNS } from '../brand/forbidden-patterns';
import { ValidationIssue, ValidationResult } from './validation.types';

const VALUE_SIGNALS = [
  'business value',
  'القيمة',
  'الأعمال',
  'المستخدم',
  'user',
  'cost',
  'التكلفة',
  'المخاطر',
  'risk',
  'SLA',
  'KPI',
];

export function validateQuality(draft: Draft): ValidationResult {
  const issues: ValidationIssue[] = [];
  const lower = draft.body.toLowerCase();

  for (const p of FORBIDDEN_PATTERNS) {
    if (lower.includes(p.phrase.toLowerCase())) {
      issues.push({
        severity: 'error',
        code: 'GENERIC_PHRASE',
        message: `Contains discouraged phrase "${p.phrase}" (${p.reason}).`,
      });
    }
  }

  const hasValueSignal = VALUE_SIGNALS.some((s) =>
    draft.body.toLowerCase().includes(s.toLowerCase()),
  );
  if (!hasValueSignal) {
    issues.push({
      severity: 'warning',
      code: 'NO_VALUE_SIGNAL',
      message:
        'No clear business-value signal (cost, risk, user experience, value...) detected.',
    });
  }

  return { passed: !issues.some((i) => i.severity === 'error'), issues };
}
