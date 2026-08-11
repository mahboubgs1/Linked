/**
 * Shared validation types.
 */

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
}

export interface ValidationResult {
  passed: boolean; // false if any `error` issues exist
  issues: ValidationIssue[];
}

export function combine(results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((r) => r.issues);
  return { passed: !issues.some((i) => i.severity === 'error'), issues };
}

export function ok(): ValidationResult {
  return { passed: true, issues: [] };
}
