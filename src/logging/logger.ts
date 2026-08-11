/**
 * Minimal structured logger.
 *
 * Logs to the console and appends JSON lines to `logs/app.log`. Every important
 * lifecycle event flows through here: content generation, approval, publishing,
 * LinkedIn responses and errors.
 */

import * as fs from 'fs';
import * as path from 'path';
import { config, LogLevel } from '../config/env';

export type LogEvent =
  | 'generated'
  | 'approval'
  | 'rejection'
  | 'publishing'
  | 'linkedin_response'
  | 'error'
  | 'info';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[config.logLevel];
}

function write(
  level: LogLevel,
  event: LogEvent,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;

  const entry = {
    ts: nowIso(),
    level,
    event,
    message,
    ...(data ? { data } : {}),
  };

  // Console (human friendly).
  const consoleLine = `[${entry.ts}] ${level.toUpperCase().padEnd(5)} ${event} — ${message}`;
  if (level === 'error') console.error(consoleLine);
  else if (level === 'warn') console.warn(consoleLine);
  else console.log(consoleLine);

  // File (machine friendly). Never let logging crash the app.
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    /* swallow logging IO errors */
  }
}

export const logger = {
  debug: (event: LogEvent, message: string, data?: Record<string, unknown>) =>
    write('debug', event, message, data),
  info: (event: LogEvent, message: string, data?: Record<string, unknown>) =>
    write('info', event, message, data),
  warn: (event: LogEvent, message: string, data?: Record<string, unknown>) =>
    write('warn', event, message, data),
  error: (event: LogEvent, message: string, data?: Record<string, unknown>) =>
    write('error', event, message, data),
};
