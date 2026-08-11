/**
 * Tiny JSON-file backed collection store.
 *
 * Chosen over a database to keep V1 dependency-free, inspectable and easy to
 * diff. Each store owns one JSON file under `data/` holding an array of records.
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export class JsonStore<T> {
  private readonly filePath: string;

  constructor(fileName: string) {
    this.filePath = path.join(DATA_DIR, fileName);
  }

  private ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /** Read all records. Returns an empty array when the file does not exist. */
  readAll(): T[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf8').trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (err) {
      throw new Error(
        `Failed to read data file ${this.filePath}: ${(err as Error).message}`,
      );
    }
  }

  /** Overwrite all records atomically (write-temp-then-rename). */
  writeAll(records: T[]): void {
    this.ensureDir();
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }
}
