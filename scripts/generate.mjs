import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFromPrompt, buildFromSpec, slugFor } from '../lib/pipeline.mjs';
import { loadExamples } from './examples.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'output');

function writeFiles(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
}

const examples = loadExamples();
const arg = process.argv.slice(2).join(' ').trim();

if (arg) {
  const matched = examples.find((ex) => ex.id === arg || ex.title === arg);
  const result = matched ? buildFromSpec(matched.spec) : buildFromPrompt(arg, examples);
  if (!result.ok) {
    console.error(result.validation?.errors || result.lint?.errors);
    process.exit(1);
  }
  const dir = join(outputDir, slugFor(result.compiled));
  writeFiles(dir, result.files);
  console.log(`Wrote ${Object.keys(result.files).length} files to ${dir}`);
} else {
  for (const example of examples) {
    const result = buildFromSpec(example.spec);
    if (!result.ok) {
      console.error(example.id, result.validation?.errors || result.lint?.errors);
      process.exit(1);
    }
    const dir = join(outputDir, example.id);
    writeFiles(dir, result.files);
    console.log(`Wrote ${example.id} (${Object.keys(result.files).length} files)`);
  }
}
