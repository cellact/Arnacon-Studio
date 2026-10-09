/**
 * Ship gate: lint + static conformance + gold-path mock + live origin fetch.
 * Do not treat a generate as done until this exits 0. Re-run until green.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConformance } from '../lib/conformance.mjs';
import { checkLocalHarness, checkOrigin } from '../lib/conformance-live.mjs';
import { runGoldPath } from '../lib/gold-path.mjs';
import { createMockController } from '../lib/mock-controller.mjs';
import { lintSkinDir } from './lint-skin.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function printErrors(label, errors) {
  for (const err of errors) {
    console.error(`${label} ${err.file}: ${err.message}`);
  }
}

function urlFlag(argv) {
  const raw = argv.find((a) => a.startsWith('--url='));
  return raw ? raw.slice('--url='.length) : '';
}

export async function ship(options = {}) {
  const errors = [];
  const skinDir = options.skinDir || join(options.root || root, 'skin');
  const projectRoot = options.root || root;

  const lint = lintSkinDir(skinDir);
  if (lint.fileCount === 0) errors.push({ file: 'skin/', message: 'skin/ is empty' });
  if (!lint.ok) errors.push(...lint.errors);

  const conform = checkConformance({ root: projectRoot, skinDir });
  if (!conform.ok) errors.push(...conform.errors);

  const gold = await runGoldPath(createMockController({ localId: '' }));
  if (!gold.ok) errors.push(...gold.errors);

  const live = options.url
    ? await checkOrigin(options.url)
    : await checkLocalHarness(projectRoot);
  if (!live.ok) errors.push(...live.errors);

  return { ok: errors.length === 0, errors, lint, conform, gold, live };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await ship({ url: urlFlag(process.argv.slice(2)) });
  if (!result.ok) {
    printErrors('ship', result.errors);
    console.error('ship failed — do not publish. Fix and run npm run ship again.');
    process.exit(1);
  }
  console.log('ship passed (lint, conformance, gold-path, live harness)');
}
