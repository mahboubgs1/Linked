/**
 * Default infographic prompt builder.
 *
 * Turns a structured InfographicBrief into a detailed English image-generation
 * prompt that encodes the brand style (navy / white / gold, Arabic RTL
 * typography, LinkedIn vertical layout, modern IT icons).
 */

import { InfographicBrief } from '../types';
import { IInfographicPromptBuilder } from './infographic.interface';
import { BRAND_STYLE } from './brand';

export class DefaultInfographicPromptBuilder
  implements IInfographicPromptBuilder
{
  build(topic: string, brief: InfographicBrief): string {
    const { palette, layout, iconStyle, descriptors } = BRAND_STYLE;

    const points = brief.keyPoints
      .map((p, i) => `${i + 1}. ${p}`)
      .join('\n');

    return [
      `Professional Arabic infographic for a LinkedIn post about "${topic}".`,
      ``,
      `HEADLINE (Arabic, right-to-left, bold): "${brief.title}"`,
      ``,
      `KEY POINTS to lay out as a clean numbered/iconed list (Arabic text):`,
      points,
      ``,
      `BOTTOM TAKEAWAY (Arabic, highlighted): "${brief.takeaway}"`,
      ``,
      `STYLE:`,
      `- Color palette: primary ${palette.primary}, background ${palette.background}, accent ${palette.accent}.`,
      `- Layout: ${layout}.`,
      `- Icons: ${iconStyle}.`,
      `- ${descriptors.join('\n- ')}`,
      ``,
      `Include a small, tasteful area for a personal brand logo in a corner.`,
      `Text must be legible; do not distort Arabic letterforms. No watermarks.`,
    ].join('\n');
  }
}
