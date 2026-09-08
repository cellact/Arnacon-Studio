import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SPEC } from '../lib/defaults.mjs';
import { buildFromSpec } from '../lib/pipeline.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultSkinDir = join(root, 'skin');

/**
 * Write the default Arnacon messenger (compiled + linted) into skin/
 * so Ploy/Base44 have a working host to restyle.
 */
export function seedSkin(dir = defaultSkinDir) {
  const result = buildFromSpec(DEFAULT_SPEC);
  if (!result.ok) {
    throw new Error(`seed-skin failed: ${JSON.stringify(result.validation?.errors || result.lint?.errors)}`);
  }
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(result.files)) {
    writeFileSync(join(dir, name), content);
  }
  return { dir, files: Object.keys(result.files).length };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { dir, files } = seedSkin();
  console.log(`Seeded ${files} files into ${dir}`);
}
