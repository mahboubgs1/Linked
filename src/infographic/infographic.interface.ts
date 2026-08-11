/**
 * Infographic prompt-builder abstraction.
 *
 * Produces a detailed, ready-to-use image-generation prompt from a structured
 * brief plus the brand style. Kept as an interface so alternative prompt
 * strategies can be swapped in.
 */

import { InfographicBrief } from '../types';

export interface IInfographicPromptBuilder {
  build(topic: string, brief: InfographicBrief): string;
}
