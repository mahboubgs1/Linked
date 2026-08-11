/**
 * Brand validator — checks a draft against concrete voice rules:
 * length, hashtag count, and presence of an engagement cue.
 */

import { Draft } from '../types';
import { VOICE_RULES, ENGAGEMENT_CUES } from '../brand/voice-rules';
import { ValidationIssue, ValidationResult } from './validation.types';

export function validateBrand(draft: Draft): ValidationResult {
  const issues: ValidationIssue[] = [];
  const len = draft.body.length;

  if (len < VOICE_RULES.minLength) {
    issues.push({
      severity: 'error',
      code: 'BODY_TOO_SHORT',
      message: `Body is ${len} chars; minimum is ${VOICE_RULES.minLength}.`,
    });
  }
  if (len > VOICE_RULES.maxLength) {
    issues.push({
      severity: 'error',
      code: 'BODY_TOO_LONG',
      message: `Body is ${len} chars; LinkedIn limit is ${VOICE_RULES.maxLength}.`,
    });
  }

  const tags = draft.hashtags.length;
  if (tags < VOICE_RULES.minHashtags) {
    issues.push({
      severity: 'warning',
      code: 'FEW_HASHTAGS',
      message: `Only ${tags} hashtags; recommended at least ${VOICE_RULES.minHashtags}.`,
    });
  }
  if (tags > VOICE_RULES.maxHashtags) {
    issues.push({
      severity: 'warning',
      code: 'MANY_HASHTAGS',
      message: `${tags} hashtags; recommended at most ${VOICE_RULES.maxHashtags}.`,
    });
  }

  if (VOICE_RULES.requireEngagementCue) {
    const hasCue = ENGAGEMENT_CUES.some((c) => draft.body.includes(c));
    if (!hasCue) {
      issues.push({
        severity: 'warning',
        code: 'NO_ENGAGEMENT_CUE',
        message: 'No question or call-to-action detected near the post.',
      });
    }
  }

  return { passed: !issues.some((i) => i.severity === 'error'), issues };
}
