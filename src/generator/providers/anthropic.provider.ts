/**
 * Anthropic (Claude) implementation of IAIProvider.
 *
 * Uses the official @anthropic-ai/sdk. Credentials come from the environment
 * (ANTHROPIC_API_KEY) — never hardcoded. Model and effort are configurable.
 *
 * When a JSON Schema is supplied, the response is constrained to valid JSON via
 * structured outputs (`output_config.format`), so the generator can parse it
 * without brittle string handling.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/env';
import { logger } from '../../logging/logger';
import { AICompletionRequest, IAIProvider } from '../ai-provider.interface';

export class AnthropicProvider implements IAIProvider {
  readonly name = 'anthropic';
  private client?: Anthropic;

  isConfigured(): boolean {
    return !!config.ai.apiKey;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      if (!config.ai.apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is not set. Cannot use the Claude generator.',
        );
      }
      this.client = new Anthropic({ apiKey: config.ai.apiKey });
    }
    return this.client;
  }

  async complete(request: AICompletionRequest): Promise<string> {
    const client = this.getClient();

    // Stream so large / thinking-enabled responses don't hit HTTP timeouts.
    const stream = client.messages.stream({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: config.ai.effort,
        ...(request.jsonSchema
          ? { format: { type: 'json_schema', schema: request.jsonSchema } }
          : {}),
      },
      system: request.system,
      messages: [{ role: 'user', content: request.user }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      logger.error('error', 'Claude refused the generation request', {
        stopDetails: message.stop_details,
      });
      throw new Error('Content generation was refused by the model.');
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!text) {
      throw new Error('Claude returned an empty response.');
    }
    return text;
  }
}
