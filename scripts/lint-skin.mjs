import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintOutput, sdkBindings } from '../lib/lint-output.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, acc = {}, prefix = '') {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) {
      walk(full, acc, rel);
      continue;
    }
    acc[rel] = readFileSync(full, 'utf8');
  }
  return acc;
}

export function lintSkinDir(skinDir) {
  const files = walk(skinDir);
  return { ...lintOutput(files, sdkBindings()), fileCount: Object.keys(files).length };
}

function resolveTarget(arg) {
  if (!arg) return join(root, 'skin');
  return arg.startsWith('/') ? arg : join(process.cwd(), arg);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = lintSkinDir(resolveTarget(process.argv[2]));
  if (result.fileCount === 0) {
    console.error('skin/ is empty.');
    process.exit(1);
  }
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(`${err.file}: ${err.message}`);
    }
    process.exit(1);
  }
  console.log(`skin lint passed (${result.fileCount} files)`);
}
