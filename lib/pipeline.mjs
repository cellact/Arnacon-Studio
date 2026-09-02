import { compile } from './compile.mjs';
import { mergeDefaults } from './defaults.mjs';
import { generateFiles, slugFor } from './generate.mjs';
import { applyIncompatibilities } from './incompatibilities.mjs';
import { interpret } from './interpret.mjs';
import { lintOutput } from './lint-output.mjs';
import { validateSpec } from './validate-spec.mjs';

export function buildFromSpec(partial) {
  const spec = applyIncompatibilities(mergeDefaults(partial));
  const validation = validateSpec(spec);
  if (!validation.ok) {
    return { ok: false, spec, compiled: null, files: null, validation, lint: null };
  }
  const compiled = compile(spec);
  const files = generateFiles(compiled);
  const lint = lintOutput(files, compiled);
  return { ok: lint.ok, spec, compiled, files, validation, lint };
}

export function buildFromPrompt(prompt, examples = []) {
  const spec = interpret(prompt, examples);
  return buildFromSpec(spec);
}

export { slugFor };
