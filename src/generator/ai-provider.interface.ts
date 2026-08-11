/**
 * AI provider abstraction (stub in V1).
 *
 * The template generator runs with NO API key. When an AI provider is wired in
 * later (OpenAI, Claude, ...), it implements this interface and the AI generator
 * uses it. Prompts are supplied by the prompt-management layer, not hardcoded.
 */

export interface AICompletionRequest {
  system: string;
  user: string;
  /** 0..1 creativity hint. */
  temperature?: number;
}

export interface IAIProvider {
  readonly name: string;
  complete(request: AICompletionRequest): Promise<string>;
}
