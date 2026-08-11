/**
 * Environment configuration loader.
 *
 * Credentials are NEVER hardcoded — everything is read from environment
 * variables (via a local `.env` file in development, see `.env.example`).
 * Validation is lazy: the app can generate/preview/approve without any LinkedIn
 * credentials; they are only required at publish time.
 */

import * as dotenv from 'dotenv';

dotenv.config();

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LinkedInConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  authorUrn?: string;
  apiVersion: string;
  dryRun: boolean;
}

export type AIEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AIConfig {
  /** Anthropic API key (from ANTHROPIC_API_KEY). */
  apiKey?: string;
  /** Model id, default claude-opus-5. */
  model: string;
  /** Reasoning/effort level. */
  effort: AIEffort;
  /** Max output tokens (streamed). */
  maxTokens: number;
  /** Whether AI generation is preferred when a key is available. */
  enabled: boolean;
}

export interface AppConfig {
  linkedIn: LinkedInConfig;
  ai: AIConfig;
  logLevel: LogLevel;
}

const AI_EFFORTS: AIEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function parseEffort(value: string | undefined): AIEffort {
  const v = (value ?? 'medium').trim().toLowerCase();
  return (AI_EFFORTS as string[]).includes(v) ? (v as AIEffort) : 'medium';
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function parseLogLevel(value: string | undefined): LogLevel {
  const v = (value ?? 'info').trim().toLowerCase();
  return (LOG_LEVELS as string[]).includes(v) ? (v as LogLevel) : 'info';
}

export const config: AppConfig = {
  linkedIn: {
    clientId: process.env.LINKEDIN_CLIENT_ID || undefined,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || undefined,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || undefined,
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN || undefined,
    authorUrn: process.env.LINKEDIN_AUTHOR_URN || undefined,
    apiVersion: process.env.LINKEDIN_API_VERSION || '202401',
    dryRun: bool(process.env.LINKEDIN_DRY_RUN, false),
  },
  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY || undefined,
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
    effort: parseEffort(process.env.ANTHROPIC_EFFORT),
    maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS) || 16000,
    // AI is preferred by default when a key is present; set CONTENT_AI=false to force templates.
    enabled: bool(process.env.CONTENT_AI, true),
  },
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
};

/**
 * Validate that the credentials required to publish are present.
 * Returns the list of missing variable names (empty when ready).
 */
export function missingPublishCredentials(): string[] {
  const missing: string[] = [];
  if (!config.linkedIn.accessToken) missing.push('LINKEDIN_ACCESS_TOKEN');
  if (!config.linkedIn.authorUrn) missing.push('LINKEDIN_AUTHOR_URN');
  return missing;
}
