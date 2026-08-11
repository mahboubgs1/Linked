/**
 * Per-post-type guidance. The three connected weekly posts each have a distinct
 * job; these guides tell the model what each one must achieve.
 */

import { PostType } from '../types';

export const POST_TYPE_GUIDES: Record<PostType, string> = {
  teaser: [
    'TEASER (Sunday): create curiosity around the weekly topic.',
    'Open with a thought-provoking hook or a recurring pain point.',
    'Do NOT explain the full concept — leave the reader wanting the follow-up.',
    'End with a short question that invites reflection or comments.',
  ].join('\n'),
  training: [
    'TRAINING (Tuesday): educate clearly and practically.',
    'Explain the concept, its business value, correct application, and the common mistake.',
    'Reference a practical rule of thumb from real experience.',
    'This post is supported by an infographic — keep the structure clean and listable.',
  ].join('\n'),
  case_study: [
    'CASE STUDY (Thursday): present a realistic scenario or checklist.',
    'Describe a concrete situation, then pose a decision the audience must weigh.',
    'Show the trade-offs (quick fix vs. root-cause) without giving a single "right" answer.',
    'End by asking the audience what they would do.',
  ].join('\n'),
};
