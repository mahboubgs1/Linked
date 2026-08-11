/**
 * Publishing validator — the final gate composed of the status check plus the
 * brand and quality validators. Used by the publish command as a guardrail.
 *
 * The hard status rule (must be `approved`) always produces an ERROR, so it
 * cannot be bypassed. Brand/quality errors also block; warnings are surfaced but
 * do not block.
 */

import { Draft } from '../types';
import { validateBrand } from './brand.validator';
import { validateQuality } from './quality.validator';
import { combine, ValidationResult } from './validation.types';

export function validateForPublishing(draft: Draft): ValidationResult {
  const statusResult: ValidationResult = {
    passed: draft.status === 'approved',
    issues:
      draft.status === 'approved'
        ? []
        : [
            {
              severity: 'error',
              code: 'NOT_APPROVED',
              message: `Draft status is "${draft.status}"; must be "approved" to publish.`,
            },
          ],
  };

  return combine([statusResult, validateBrand(draft), validateQuality(draft)]);
}
