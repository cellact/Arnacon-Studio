import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { ok } from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintOutput, sdkBindings } from '../lib/lint-output.mjs';
import { pairingUriFor } from '../host/browser-pairing.mjs';
import { lintSkinDir } from './lint-skin.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

ok(!existsSync(join(root, 'studio.mjs')), 'studio UI should be removed');
ok(!existsSync(join(root, 'index.html')), 'studio index.html should be removed');
ok(!existsSync(join(root, 'lib/pipeline.mjs')), 'studio pipeline should be removed');
ok(!existsSync(join(root, 'scripts/serve.mjs')), 'studio static server should be removed');

ok(!lintOutput({ 'x.html': 'fetch("/api/messages")' }, sdkBindings()).ok);
ok(lintOutput({ 'x.html': 'controller.sendMessage("1","hi")' }, sdkBindings()).ok);
ok(!lintOutput({ 'pairing.html': 'new WebSocket("wss://x")' }, sdkBindings()).ok);

ok(pairingUriFor('ABC123').includes('room=ABC123'));
ok(pairingUriFor('ABC123').startsWith('arnacon://browser-relay?'));

ok(readFileSync(join(root, 'host/boot.mjs'), 'utf8').includes('installArnaconWebApp'));
ok(readFileSync(join(root, 'host/index.html'), 'utf8').includes('bootHost'));
ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('window.top.controller'));
const runtime = readFileSync(join(root, 'host/runtime.mjs'), 'utf8');
ok(runtime.includes('export async function installArnaconWebApp'));
ok(runtime.includes('installBrowserPairing'));
ok(runtime.includes('installBrowserCall'));
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
ok(JSON.stringify(vercel).includes('Access-Control-Allow-Origin'));
ok(readFileSync(join(root, 'host/serve.mjs'), 'utf8').includes('Access-Control-Allow-Origin'));

const identities = readFileSync(join(root, 'host/identities.mjs'), 'utf8');
ok(identities.includes('export function installIdentities'));
ok(identities.includes('get-identity-list'), 'identity list must use the native relay action');
ok(identities.includes('set-active-identity'), 'switching must use the native relay action');
ok(runtime.includes('installIdentities'), 'runtime must install the identity bridge');
ok(lintOutput({ 'x.html': 'controller.listIdentities()' }, sdkBindings()).ok);
ok(lintOutput({ 'x.html': "controller.on('identity-list', f)" }, sdkBindings()).ok);

const ployPrompt = readFileSync(join(root, 'docs/ploy-prompt.md'), 'utf8');
for (const needle of [
  'installArnaconWebApp',
  'startBrowserPairing',
  'lastMessageContent',
  'sendMessage(String(sessionId), text)',
  'rejectCall',
  'browserCall',
  'listIdentities',
  'switchIdentity',
  'host/identities.mjs',
]) {
  ok(ployPrompt.includes(needle), `paste-in prompt must cover ${needle}`);
}
for (const skill of ['.agents', '.cursor']) {
  const text = readFileSync(join(root, skill, 'skills/arnacon-skin/SKILL.md'), 'utf8');
  ok(text.includes('docs/ploy-prompt.md'), `${skill} skill must point at the paste-in prompt`);
}

const skinLint = lintSkinDir(join(root, 'skin'));
ok(skinLint.fileCount > 0, 'skin/ must contain the product HTML');
ok(skinLint.ok, JSON.stringify(skinLint.errors));

const chat = readFileSync(join(root, 'skin/chat.html'), 'utf8');
ok(/sendMessage\(String\(sessionId\), text\)/.test(chat));
ok(!/new\s+WebSocket/.test(chat));
ok(/rejectCall/.test(readFileSync(join(root, 'skin/voicecall.html'), 'utf8')));
ok(/browserCall/.test(readFileSync(join(root, 'skin/incomingcall.html'), 'utf8')));

const restForbidden = mkdtempSync(join(tmpdir(), 'arnacon-rest-'));
try {
  writeFileSync(join(restForbidden, 'index.html'), '<script>fetch("/api/login")</script>');
  ok(!lintSkinDir(restForbidden).ok);
} finally {
  rmSync(restForbidden, { recursive: true, force: true });
}

console.log('self-check passed');
