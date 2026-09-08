import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');

export function loadExamples() {
  return readdirSync(examplesDir)
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .sort()
    .map((name) => JSON.parse(readFileSync(join(examplesDir, name), 'utf8')))
    .filter((example) => example && typeof example === 'object' && example.id && example.spec);
}
