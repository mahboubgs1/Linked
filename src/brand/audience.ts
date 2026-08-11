/**
 * Audience definitions — who each kind of post is written for.
 * Used by the strategy engine (audience mapping) and for validation context.
 */

import { PostType } from '../types';

export interface AudienceSegment {
  key: string;
  label: string;
  /** What this segment cares about. */
  caresAbout: string[];
}

export const AUDIENCE_SEGMENTS: Record<string, AudienceSegment> = {
  cio: {
    key: 'cio',
    label: 'CIO / IT Leadership',
    caresAbout: ['business value', 'risk', 'cost', 'strategy'],
  },
  managers: {
    key: 'managers',
    label: 'IT / Application Managers',
    caresAbout: ['process', 'ownership', 'team performance', 'SLAs'],
  },
  practitioners: {
    key: 'practitioners',
    label: 'Application Support & Ops Teams',
    caresAbout: ['practical how-to', 'tools', 'day-to-day operations'],
  },
  business: {
    key: 'business',
    label: 'Business Leaders / Stakeholders',
    caresAbout: ['user experience', 'outcomes', 'reliability'],
  },
};

/** The primary audience segment for each post type. */
export const PRIMARY_AUDIENCE: Record<PostType, string> = {
  teaser: 'business',
  training: 'practitioners',
  case_study: 'managers',
};
