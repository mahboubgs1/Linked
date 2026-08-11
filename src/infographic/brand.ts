/**
 * Infographic brand style constants.
 *
 * These describe the visual identity applied to every generated infographic
 * prompt. They are deliberately provider-agnostic (see image-provider.interface).
 */

export interface BrandStyle {
  palette: {
    primary: string; // navy blue
    background: string; // white
    accent: string; // gold
  };
  fontDirection: 'rtl' | 'ltr';
  layout: string;
  iconStyle: string;
  descriptors: string[];
}

export const BRAND_STYLE: BrandStyle = {
  palette: {
    primary: 'deep navy blue (#0A2540)',
    background: 'clean white (#FFFFFF)',
    accent: 'gold (#C9A227)',
  },
  fontDirection: 'rtl',
  layout:
    'clean LinkedIn-friendly vertical layout (portrait 4:5 / 1080x1350), generous whitespace, clear visual hierarchy',
  iconStyle: 'modern minimal line icons for IT / operations concepts',
  descriptors: [
    'professional corporate appearance',
    'clear Arabic typography (right-to-left)',
    'consistent grid and alignment',
    'high contrast and readable at small sizes',
    'no clutter, no stock-photo look',
  ],
};
