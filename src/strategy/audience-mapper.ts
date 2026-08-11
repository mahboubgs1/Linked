/**
 * Audience mapper — resolves the target audience for a given post type/topic,
 * combining the calendar slot's intent with the brand's audience segments.
 */

import { PostType } from '../types';
import { AUDIENCE_SEGMENTS, AudienceSegment, PRIMARY_AUDIENCE } from '../brand/audience';

export function audienceFor(type: PostType): AudienceSegment {
  const key = PRIMARY_AUDIENCE[type];
  return AUDIENCE_SEGMENTS[key] ?? AUDIENCE_SEGMENTS.managers;
}
