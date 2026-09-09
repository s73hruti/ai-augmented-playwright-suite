import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Write a file, creating parent directories as needed. */
export async function writeFileEnsuringDir(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf-8');
}