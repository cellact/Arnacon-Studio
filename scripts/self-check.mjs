import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { ok } from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintOutput, sdkBindings } from '../lib/lint-output.mjs';
import { checkConformance } from '../lib/conformance.mjs';
import { runGoldPath } from '../lib/gold-path.mjs';
import { createMockController } from '../lib/mock-controller.mjs';
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
ok(!lintOutput({ 'x.html': 'new RTCPeerConnection()' }, sdkBindings()).ok);

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

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
ok(packageJson.main === './extension/extension.cjs');
ok(packageJson.contributes?.views?.arnacon?.some((view) => view.id === 'arnacon.sidebar'));
const extension = readFileSync(join(root, 'extension/extension.cjs'), 'utf8');
ok(extension.includes('registerWebviewViewProvider'));
ok(extension.includes('Content-Security-Policy'));
ok(extension.includes('retainContextWhenHidden'));
const extensionWebview = readFileSync(join(root, 'extension/webview.mjs'), 'utf8');
ok(extensionWebview.includes('installArnaconWebApp'));
ok(extensionWebview.includes('controller.startBrowserPairing()'));
ok(extensionWebview.includes('controller.listIdentities()'));
ok(extensionWebview.includes('controller.switchIdentity(identity)'));
ok(extensionWebview.includes('controller.sendMessage(String(session.sessionId), text)'));
ok(extensionWebview.includes("identityKind !== 'whatsapp'"), 'WhatsApp identities omit calls');
// Cursor webviews are denied microphone access, so calls hand off to the host page.
ok(!/getUserMedia/.test(extensionWebview), 'the sidebar must not request media it cannot get');
ok(extensionWebview.includes("type: 'open-call'"), 'calls must hand off to the extension host');
ok(extensionWebview.includes('controller.rejectCall(call.callId)'), 'decline must use rejectCall');
ok(extension.includes("message?.type !== 'open-call'"), 'the host must handle the call handoff');
ok(extension.includes('openExternal'), 'the call page must open outside the webview');
ok(extension.includes("server.listen(0, '127.0.0.1'"), 'the call page needs a loopback secure context');

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

const gold = await runGoldPath(createMockController({ localId: '' }));
ok(gold.ok, JSON.stringify(gold.errors));

const oneArg = await runGoldPath({
  localId: '',
  async getRecentSessions() {
    return { sessions: [{ sessionId: '1', lastMessageContent: 'x' }] };
  },
  async getMessages() {
    return { messages: [{ content: 'x', author: 'a' }] };
  },
  async sendMessage() {},
  async startBrowserPairing() {
    return { pairingUri: 'arnacon://browser-relay?room=X' };
  },
});
ok(!oneArg.ok, 'gold-path must fail sendMessage with one argument');

const noRuntime = checkConformance({
  root: join(root, 'no-such-root'),
  files: { 'app.html': 'controller.sendMessage("1", "hi")' },
});
ok(!noRuntime.ok);

const badSend = checkConformance({
  root,
  files: {
    'chat.html': 'controller.sendMessage(text); controller.startBrowserPairing(); const localId = "";',
  },
});
ok(badSend.errors.some((e) => /two arguments/.test(e.message)));

console.log('self-check passed');
