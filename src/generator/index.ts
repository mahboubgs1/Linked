/**
 * Generator factory.
 *
 * Selects the content generator at runtime:
 *  - the Claude (AI) generator when an API key is configured and AI isn't
 *    disabled, otherwise
 *  - the deterministic template generator (always available, no key required).
 *
 * A caller can force a choice with `preferred`.
 */

import { config } from '../config/env';
import { logger } from '../logging/logger';
import { IContentGenerator } from './content-generator.interface';
import { TemplateContentGenerator } from './template.generator';
import { AIContentGenerator } from './ai.generator';
import { AnthropicProvider } from './providers/anthropic.provider';

export type GeneratorChoice = 'ai' | 'template';

export function createContentGenerator(
  preferred?: GeneratorChoice,
): IContentGenerator {
  const wantAI =
    preferred === 'ai' || (preferred === undefined && config.ai.enabled);

  if (wantAI) {
    const provider = new AnthropicProvider();
    if (provider.isConfigured()) {
      logger.info('info', `Using AI generator (${config.ai.model}).`);
      return new AIContentGenerator(provider);
    }
    if (preferred === 'ai') {
      throw new Error(
        'AI generator requested but ANTHROPIC_API_KEY is not set. Set it in .env or use the template generator.',
      );
    }
    logger.warn('info', 'AI not configured (no ANTHROPIC_API_KEY); falling back to template generator.');
  }

  return new TemplateContentGenerator();
}

export { TemplateContentGenerator } from './template.generator';
export { AIContentGenerator } from './ai.generator';
