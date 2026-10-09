/**
 * Static harness conformance for a generated app (skin/ plus host runtime files).
 * Does not replace lintOutput; run both.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const HOST_RUNTIME_FILES = Object.freeze([
  'host/runtime.mjs',
  'host/browser-pairing.mjs',
  'host/browser-call.mjs',
  'host/identities.mjs',
  'host/ice-config.mjs',
]);

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
    if (/\.(html|js|mjs|css)$/.test(name)) acc[rel] = readFileSync(full, 'utf8');
  }
  return acc;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function joined(files) {
  return Object.values(files).map((s) => stripComments(String(s))).join('\n');
}

function sendMessageCallsHaveTwoArgs(source) {
  const re = /sendMessage\s*\(/g;
  let match;
  while ((match = re.exec(source))) {
    let i = match.index + match[0].length;
    let depth = 1;
    let commaAt1 = false;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      else if (c === ',' && depth === 1) commaAt1 = true;
      i += 1;
    }
    if (depth === 0 && !commaAt1) return false;
  }
  return true;
}

/**
 * @param {{ root: string, skinDir?: string, files?: Record<string, string> }} options
 */
export function checkConformance(options) {
  const errors = [];
  const fail = (file, message) => errors.push({ file, message });
  const root = options.root;
  const skinDir = options.skinDir || join(root, 'skin');
  const files = options.files || walk(skinDir);

  for (const rel of HOST_RUNTIME_FILES) {
    if (!existsSync(join(root, rel))) {
      fail(rel, 'required runtime file is missing from the published tree');
    }
  }

  const boot = existsSync(join(root, 'host/boot.mjs'))
    ? readFileSync(join(root, 'host/boot.mjs'), 'utf8')
    : '';
  const indexHtml = existsSync(join(root, 'host/index.html'))
    ? readFileSync(join(root, 'host/index.html'), 'utf8')
    : '';
  const skinSource = joined(files);
  const allApp = `${boot}\n${indexHtml}\n${skinSource}`;

  if (!/installArnaconWebApp/.test(allApp) && !/__arnaconRuntimePromise/.test(allApp)) {
    fail(
      'runtime',
      'install the portable runtime (installArnaconWebApp or window.__arnaconRuntimePromise)',
    );
  }

  if (!/window\.top\.controller|top\.controller/.test(allApp)) {
    fail('runtime', 'UI must read window.top.controller');
  }

  for (const [file, raw] of Object.entries(files)) {
    const source = stripComments(raw);
    if (/\bnew\s+WebSocket\b/.test(source)) {
      fail(file, 'WebSocket belongs on the runtime, not in the app');
    }
    if (/\bnew\s+RTCPeerConnection\b/.test(source)) {
      fail(file, 'RTCPeerConnection belongs on the host, not in the app');
    }
    if (/\blastMessage\b/.test(source) && !/\blastMessageContent\b/.test(source)) {
      fail(file, 'session preview field is lastMessageContent, not lastMessage');
    }
    if (!sendMessageCallsHaveTwoArgs(source)) {
      fail(file, 'sendMessage takes two arguments: sessionId, text');
    }
  }

  const usesMessaging = /\b(getRecentSessions|getMessages|sendMessage)\b/.test(skinSource);
  if (usesMessaging) {
    if (!/\bstartBrowserPairing\b/.test(allApp)) {
      fail('pairing', 'messaging requires startBrowserPairing when localId is empty');
    }
    if (!/\blocalId\b/.test(allApp)) {
      fail('pairing', 'read localId from the controller or the hash; do not skip pairing');
    }
  }

  return { ok: errors.length === 0, errors, fileCount: Object.keys(files).length };
}
