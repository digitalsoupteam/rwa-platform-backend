import { existsSync, mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class StorageClient {
  constructor(private readonly rootDir: string) {
    // Ensure root directory exists
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
    }
  }

  /**
   * Generates a relative storage path based on current date/hour.
   * Returns e.g. "2025/06/27/15/uuid.pdf" — relative, without rootDir.
   */
  @TraceDecorator()
  generatePath(originalName: string): string {
    const uuid = randomUUID();
    const ext = originalName.split('.').pop() || '';
    const now = new Date();
    const date = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const hour = String(now.getHours());
    return `${date}/${hour}/${uuid}.${ext}`;
  }

  /**
   * Saves file data to disk. relativePath is from generatePath().
   */
  @TraceDecorator()
  async saveFile(relativePath: string, data: Buffer): Promise<void> {
    const fullPath = join(this.rootDir, relativePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await writeFile(fullPath, data);
  }

  /**
   * Deletes file from disk. relativePath is from generatePath().
   */
  @TraceDecorator()
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = join(this.rootDir, relativePath);
    if (!existsSync(fullPath)) {
      return;
    }

    await unlink(fullPath);
  }

  /**
   * Checks if file exists. relativePath is from generatePath().
   */
  @TraceDecorator()
  fileExists(relativePath: string): boolean {
    const fullPath = join(this.rootDir, relativePath);
    return existsSync(fullPath);
  }
}