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

export interface AppConfig {
  linkedIn: LinkedInConfig;
  logLevel: LogLevel;
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
