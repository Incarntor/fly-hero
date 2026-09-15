import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { ReadFile } from '../src/sim/brain';

export const DATA_DIR = new URL('../public/data/', import.meta.url);

export const hasData = (): boolean => existsSync(new URL('manifest.json', DATA_DIR));

/** Чтение public/data с диска — для тестов и бенчмарков в Node. */
export const fsReader: ReadFile = async (path) => {
  const buffer = await readFile(new URL(path, DATA_DIR));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};
