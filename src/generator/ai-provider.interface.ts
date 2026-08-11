/**
 * AI provider abstraction.
 *
 * The template generator runs with NO API key. An AI provider (Claude via the
 * Anthropic SDK, or another backend) implements this interface, and the AI
 * generator uses it. Prompts are supplied by the prompt-management layer, not
 * hardcoded in the provider.
 */

export interface AICompletionRequest {
  system: string;
  user: string;
  /**
   * Optional JSON Schema. When provided, the provider must constrain the model
   * to return JSON matching the schema and return that JSON as a string.
   */
  jsonSchema?: Record<string, unknown>;
  /** 0..1 creativity hint (advisory; providers may ignore). */
  temperature?: number;
}

export interface IAIProvider {
  readonly name: string;
  /** Whether the provider is configured and usable (e.g. API key present). */
  isConfigured(): boolean;
  /** Run a completion. Returns the model's text (JSON string when jsonSchema is set). */
  complete(request: AICompletionRequest): Promise<string>;
}
