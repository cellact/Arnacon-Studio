import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../lib/compile.mjs';
import { mergeDefaults } from '../lib/defaults.mjs';
import { applyIncompatibilities } from '../lib/incompatibilities.mjs';
import { lintOutput, sdkBindings } from '../lib/lint-output.mjs';
import { validateSpec } from '../lib/validate-spec.mjs';

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

function bindingsFor(skinDir) {
  const open = sdkBindings();
  const specPath = join(skinDir, 'spec.json');
  if (!existsSync(specPath)) return open;
  try {
    const raw = JSON.parse(readFileSync(specPath, 'utf8'));
    const spec = applyIncompatibilities(mergeDefaults(raw));
    const validation = validateSpec(spec);
    if (!validation.ok) return open;
    const compiled = compile(spec);
    return {
      ...compiled,
      methods: [...new Set([...open.methods, ...compiled.methods])],
      events: [...new Set([...open.events, ...compiled.events])],
      screens: [...new Set([...open.screens, ...compiled.screens])],
      gates: {},
    };
  } catch {
    return open;
  }
}

export function lintSkinDir(skinDir) {
  const files = walk(skinDir);
  const compiled = bindingsFor(skinDir);
  return { ...lintOutput(files, compiled), fileCount: Object.keys(files).length, compiled };
}

function resolveTarget(arg) {
  if (!arg) return join(root, 'skin');
  return arg.startsWith('/') ? arg : join(process.cwd(), arg);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = lintSkinDir(resolveTarget(process.argv[2]));
  if (result.fileCount === 0) {
    console.error('skin/ is empty. Run: npm run seed-skin');
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
