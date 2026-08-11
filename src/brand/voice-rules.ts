/**
 * Voice rules — concrete, checkable constraints for the brand voice.
 * Consumed by the brand validator.
 */

export interface VoiceRules {
  /** Post body length guardrails (characters). */
  minLength: number;
  maxLength: number;
  /** Hashtag count guardrails. */
  minHashtags: number;
  maxHashtags: number;
  /** Preferred: at least one call-to-action / question near the end. */
  requireEngagementCue: boolean;
}

export const VOICE_RULES: VoiceRules = {
  minLength: 200,
  maxLength: 3000, // LinkedIn post hard limit
  minHashtags: 3,
  maxHashtags: 10,
  requireEngagementCue: true,
};

/**
 * Simple cues that indicate an engagement prompt is present (Arabic + English).
 * Covers questions, "share/save" calls-to-action, and opinion prompts.
 */
export const ENGAGEMENT_CUES = [
  '؟',
  'شارك', // matches شاركني / شاركنا / شاركه / شارك المنشور
  'احفظ', // save-the-post CTA
  'رأيك',
  'التعليقات',
  'ما القرار',
  'comment',
  'share',
  'save',
];
