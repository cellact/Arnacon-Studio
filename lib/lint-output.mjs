import {
  CALL_METHODS,
  EVENT_ALLOWLIST,
  METHOD_ALLOWLIST,
  OUTPUT_LINT_FORBIDDEN,
} from './constants.mjs';

const CONTROLLER_MEMBER = /controller\.([A-Za-z][A-Za-z0-9]*)/g;
const CONTROLLER_ON = /controller\.on\(\s*['"`]([^'"`]+)['"`]/g;

const SKIP_FILES = new Set(['spec.json', 'bindings.json']);

function isCodeFile(name) {
  return /\.(html|js|mjs|css)$/.test(name) && !SKIP_FILES.has(name);
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Lint generated files against the compiled allowlist.
 * @returns {{ ok: boolean, errors: { file: string, message: string }[], warnings: { file: string, message: string }[] }}
 */
export function lintOutput(files, compiled) {
  const errors = [];
  const allowedMethods = new Set(compiled.methods || []);
  const allowedEvents = new Set(compiled.events || []);
  const screens = new Set(compiled.screens || []);
  const fail = (file, message) => errors.push({ file, message });

  for (const [file, raw] of Object.entries(files)) {
    if (!isCodeFile(file) || typeof raw !== 'string') continue;
    if (file === 'controller.mjs') continue;

    const source = stripComments(raw);

    for (const rule of OUTPUT_LINT_FORBIDDEN) {
      if (rule.re.test(source)) fail(file, rule.message);
    }

    if (/\bnew\s+WebSocket\b/.test(source) && file !== 'pairing.html') {
      fail(file, 'WebSocket is only allowed on the PAIRING screen for browser-relay.');
    }
    if (file === 'pairing.html' && !screens.has('PAIRING')) {
      fail(file, 'pairing.html was generated but PAIRING is not in the compiled screen list.');
    }

    let match;
    const members = new Set();
    CONTROLLER_MEMBER.lastIndex = 0;
    while ((match = CONTROLLER_MEMBER.exec(source))) {
      members.add(match[1]);
    }
    for (const name of members) {
      if (!METHOD_ALLOWLIST.includes(name)) {
        fail(file, `unknown controller method "${name}"`);
        continue;
      }
      if (!allowedMethods.has(name)) {
        fail(file, `controller.${name} is not in this spec's compiled bindings`);
      }
    }

    CONTROLLER_ON.lastIndex = 0;
    while ((match = CONTROLLER_ON.exec(source))) {
      const eventName = match[1];
      if (!EVENT_ALLOWLIST.includes(eventName)) {
        fail(file, `unknown controller event "${eventName}"`);
      } else if (!allowedEvents.has(eventName)) {
        fail(file, `event "${eventName}" is not in this spec's compiled bindings`);
      }
    }

    const usedCallMethods = [...members].filter((m) => CALL_METHODS.includes(m));
    if (compiled.gates?.whatsappOmitsCalls && usedCallMethods.length) {
      if (!/identityKind\s*===?\s*['"]whatsapp['"]/.test(source)) {
        fail(
          file,
          'Call methods are present with WhatsApp enabled; this file must gate them with identityKind === "whatsapp".',
        );
      }
    }
    if (compiled.gates?.whatsappOnly && usedCallMethods.length) {
      fail(file, 'WhatsApp-only apps must not include call methods.');
    }
  }

  return { ok: errors.length === 0, errors, warnings: [] };
}
