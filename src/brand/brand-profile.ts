/**
 * Brand profile — the executive identity every generated post must reflect.
 *
 * This is intentionally data, not logic: it is consumed by the generator, the
 * strategy engine and the brand validator. Edit this file to re-tune the voice.
 */

export interface BrandProfile {
  /** How the author is positioned professionally. */
  positioning: string;
  /** Industries the author operates in. */
  industries: string[];
  /** Areas of demonstrated expertise. */
  expertise: string[];
  /** Primary audience roles. */
  audience: string[];
  /** Overall tone descriptor. */
  tone: string;
  /** One-line description of the writing style. */
  writingStyle: string;
}

export const BRAND_PROFILE: BrandProfile = {
  positioning: 'IT Application Manager & Business Transformation Leader',
  industries: [
    'ERP',
    'Property Technology',
    'Digital Transformation',
    'IT Operations',
  ],
  expertise: [
    'Application Support & Management',
    'Incident & Problem Management',
    'Change & Release Management',
    'Application Monitoring & Governance',
    'IT–Business alignment & value delivery',
  ],
  audience: ['CIO', 'IT Managers', 'Application Support Teams', 'Business Leaders'],
  tone: 'professional, practical, executive — grounded, not motivational',
  writingStyle:
    'Arabic-first, concise, real-world; technical English terms used naturally; no hype, no empty inspiration',
};
