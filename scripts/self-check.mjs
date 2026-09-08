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

ok(readFileSync(join(root, 'host/boot.mjs'), 'utf8').includes('installBrowserCall'));
ok(readFileSync(join(root, 'host/index.html'), 'utf8').includes('bootHost'));
ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('window.top.controller'));

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
