import { deepStrictEqual, ok } from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintOutput, sdkBindings } from '../lib/lint-output.mjs';
import { wrapLegacySpec } from '../lib/packs.mjs';
import { zipFiles } from '../lib/zip.mjs';
import { pairingUriFor } from '../host/browser-pairing.mjs';
import { DEFAULT_SPEC } from '../lib/defaults.mjs';
import { buildFromPrompt, buildFromSpec } from '../lib/pipeline.mjs';
import { loadExamples } from './examples.mjs';
import { lintSkinDir } from './lint-skin.mjs';
import { seedSkin } from './seed-skin.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examples = loadExamples();
ok(examples.length >= 7, 'expected at least 7 few-shot examples');

const commExampleIds = new Set(['direct-chat', 'family-groups-video', 'email-support-inbox', 'zk-subscription']);

for (const example of examples) {
  const fromFile = buildFromSpec(example.spec);
  ok(fromFile.validation.ok, `${example.id} spec failed: ${JSON.stringify(fromFile.validation.errors)}`);
  ok(fromFile.lint.ok, `${example.id} lint failed: ${JSON.stringify(fromFile.lint.errors)}`);
  ok(fromFile.compiled.screens.includes('MAIN'), `${example.id} must include MAIN`);
  if (commExampleIds.has(example.id)) {
    ok(fromFile.compiled.screens.includes('CHAT'), `${example.id} must include CHAT`);
  } else {
    ok(!fromFile.compiled.screens.includes('CHAT'), `${example.id} must omit CHAT`);
  }

  const fromPrompt = buildFromPrompt(example.prompt, examples);
  ok(fromPrompt.ok, `${example.id} prompt interpret failed`);
  ok(fromPrompt.spec.identity.source === 'installed-product');
  ok(fromPrompt.spec.kind === 'arnacon-app');
  ok(fromPrompt.spec.version === 2);
}

const direct = examples.find((ex) => ex.id === 'direct-chat');
const family = examples.find((ex) => ex.id === 'family-groups-video');
const inbox = examples.find((ex) => ex.id === 'email-support-inbox');
const pairing = examples.find((ex) => ex.id === 'phone-pairing');
const zk = examples.find((ex) => ex.id === 'zk-subscription');
const shop = examples.find((ex) => ex.id === 'shop-listings');
const switcher = examples.find((ex) => ex.id === 'identity-switcher');

const wrapped = wrapLegacySpec(direct.spec);
ok(wrapped.kind === 'arnacon-app');
ok(wrapped.capabilities.communication.sessions.direct === true);

const directBuild = buildFromSpec(direct.spec);
ok(!directBuild.compiled.screens.includes('CALL'), '1:1 chat must omit call screens');
ok(!directBuild.compiled.methods.includes('callSession'));
ok(directBuild.compiled.screens.includes('NEW_CHAT'));
ok(!directBuild.compiled.screens.includes('CREATE_GROUP'));
ok(directBuild.spec.capabilities.communication);

const familyBuild = buildFromSpec(family.spec);
ok(familyBuild.compiled.screens.includes('CREATE_GROUP'));
ok(familyBuild.compiled.screens.includes('CALL'));
ok(familyBuild.spec.identity.activeKinds.includes('arnacon'));
ok(!familyBuild.spec.identity.activeKinds.includes('whatsapp'));
ok(familyBuild.compiled.methods.includes('videoCallSession'));
ok(familyBuild.compiled.methods.includes('sendFileMessage'));

const inboxBuild = buildFromSpec(inbox.spec);
ok(inboxBuild.spec.identity.activeKinds.includes('email'));
ok(inboxBuild.spec.identity.addressing.includes('email'));
ok(inboxBuild.compiled.methods.includes('contactPicker'));
ok(inboxBuild.compiled.methods.includes('setBlocked'));
ok(!inboxBuild.compiled.screens.includes('CALL'));
ok(!inboxBuild.compiled.screens.includes('CREATE_GROUP'));

const pairingBuild = buildFromSpec(pairing.spec);
ok(pairingBuild.compiled.screens.includes('PAIRING'));
ok(pairingBuild.compiled.methods.includes('startBrowserPairing'));
ok(pairingBuild.compiled.methods.includes('stopBrowserPairing'));
ok(pairingBuild.compiled.methods.includes('getBrowserPairing'));
ok(pairingBuild.compiled.events.includes('pairing-status'));
ok(!/new\s+WebSocket/.test(pairingBuild.files['pairing.html']));
ok(!pairingBuild.compiled.screens.includes('CHAT'));
ok(!pairingBuild.compiled.methods.includes('getRecentSessions'));
ok(!pairingBuild.spec.capabilities.communication);
ok(pairingBuild.spec.capabilities.identity.pairing);

const zkBuild = buildFromSpec(zk.spec);
ok(zkBuild.compiled.screens.includes('CHAT'));
ok(zkBuild.compiled.screens.includes('CREATE_GROUP'));
ok(!zkBuild.spec.capabilities.subscription);
ok(zkBuild.spec.warnings.some((w) => /subscription/i.test(w)));
ok(!Object.prototype.hasOwnProperty.call(zkBuild.spec, 'wallet'));
ok(!/fetch\s*\(/.test(Object.values(zkBuild.files).join('\n')));

const shopBuild = buildFromSpec(shop.spec);
ok(shopBuild.compiled.screens.includes('MAIN'));
ok(!shopBuild.compiled.screens.includes('CHAT'));
ok(!shopBuild.spec.capabilities.commerce);
ok(shopBuild.spec.warnings.some((w) => /commerce/i.test(w)));
ok(!shopBuild.files['chat.html']);

const switcherBuild = buildFromSpec(switcher.spec);
ok(switcherBuild.compiled.screens.includes('IDENTITIES'));
ok(!switcherBuild.compiled.screens.includes('CHAT'));
ok(!switcherBuild.compiled.methods.includes('listIdentities'));
ok(!switcherBuild.compiled.methods.includes('switchIdentity'));
ok(switcherBuild.compiled.nativeGaps.some((g) => g.pack === 'identity'));
ok(switcherBuild.files['identities.html']);
ok(!/controller\.listIdentities/.test(switcherBuild.files['identities.html']));
ok(!/controller\.switchIdentity/.test(switcherBuild.files['identities.html']));

const crm = buildFromPrompt('A CRM with OAuth login and a Postgres customer database', examples);
ok(crm.spec.kind === 'arnacon-app');
ok(!Object.prototype.hasOwnProperty.call(crm.spec, 'database'));
ok(!crm.spec.capabilities.communication);
ok(!crm.compiled.screens.includes('CHAT'));
ok(crm.spec.warnings.some((w) => /database/i.test(w)));
ok(crm.spec.warnings.some((w) => /installed product/i.test(w)));

const mixed = buildFromPrompt('Messenger with WhatsApp and video calls', examples);
ok(mixed.spec.identity.activeKinds.includes('whatsapp'));
ok(mixed.spec.capabilities.communication.calls.video === true);
ok(mixed.compiled.gates.whatsappOmitsCalls);
ok(mixed.spec.warnings.some((w) => /hidden on WhatsApp/i.test(w)));
ok(mixed.ok, JSON.stringify(mixed.lint?.errors));

const waOnly = buildFromPrompt('WhatsApp only inbox', examples);
ok(waOnly.spec.identity.activeKinds[0] === 'whatsapp');
ok(waOnly.spec.capabilities.communication.calls.voice === false);
ok(waOnly.spec.capabilities.communication.calls.video === false);
ok(!waOnly.compiled.methods.includes('callSession'));

const zkPrompt = buildFromPrompt('A ZK subscription service for a private group', examples);
ok(zkPrompt.spec.kind === 'arnacon-app');
ok(zkPrompt.spec.capabilities.communication);
ok(!zkPrompt.spec.capabilities.subscription);
ok(zkPrompt.spec.warnings.some((w) => /subscription/i.test(w)));
ok(!zkPrompt.compiled.methods.includes('subscribe'));
ok(!JSON.stringify(zkPrompt.files).includes('wallet'));

const shopPrompt = buildFromPrompt('An on-chain shop with listings and checkout', examples);
ok(!shopPrompt.spec.capabilities.commerce);
ok(!shopPrompt.compiled.screens.includes('CHAT'));
ok(shopPrompt.spec.warnings.some((w) => /commerce/i.test(w)));

const pairingPrompt = buildFromPrompt('Pair my phone so I can use Arnacon in the browser. No chat.', examples);
ok(pairingPrompt.compiled.screens.includes('PAIRING'));
ok(!pairingPrompt.compiled.screens.includes('CHAT'));

const switcherPrompt = buildFromPrompt('An app to switch between installed Arnacon identities. No chat.', examples);
ok(switcherPrompt.compiled.screens.includes('IDENTITIES'));
ok(!switcherPrompt.compiled.methods.includes('listIdentities'));

const bad = buildFromSpec({
  version: 2,
  kind: 'crm',
  runtime: { mode: 'webview' },
  identity: { source: 'installed-product', activeKinds: ['arnacon'] },
  localId: 'alice.eth',
});
ok(!bad.ok);
ok(bad.validation.errors.some((e) => e.path === 'kind'));
ok(bad.validation.errors.some((e) => e.path === 'localId'));

const familyFiles = { ...familyBuild.files };
familyFiles['chat.html'] += '\nfetch("/api/messages");\n';
const poisoned = lintOutput(familyFiles, familyBuild.compiled);
ok(!poisoned.ok);
ok(poisoned.errors.some((e) => /fetch/i.test(e.message)));

const schema = JSON.parse(readFileSync(join(root, 'schema/capability-spec.schema.json'), 'utf8'));
deepStrictEqual(schema.properties.kind.const, 'arnacon-app');
deepStrictEqual(schema.properties.version.const, 2);
ok(schema.additionalProperties === false);
ok(schema.properties.capabilities.properties.communication);
ok(schema.properties.theme.properties.colors);

const restyle = buildFromSpec({
  ...family.spec,
  theme: { preset: 'custom', colors: { accent: '#0a7aff' } },
});
ok(restyle.ok, JSON.stringify(restyle.validation?.errors || restyle.lint?.errors));
deepStrictEqual(restyle.compiled.methods, familyBuild.compiled.methods);
deepStrictEqual(restyle.compiled.screens, familyBuild.compiled.screens);
ok(restyle.files['app.css'].includes('#0a7aff'));
ok(restyle.files['chat.html'] === familyBuild.files['chat.html']);

const zipped = zipFiles({ 'hello.txt': 'ok' });
ok(zipped.length > 30);
ok(String.fromCharCode(zipped[0], zipped[1], zipped[2], zipped[3]) === 'PK\u0003\u0004');

ok(!lintOutput({ 'x.html': 'fetch("/api/messages")' }, sdkBindings()).ok);
ok(lintOutput({ 'x.html': 'controller.sendMessage("1","hi")' }, sdkBindings()).ok);
ok(pairingUriFor('ABC123').includes('room=ABC123'));
ok(pairingUriFor('ABC123').startsWith('arnacon://browser-relay?'));

const defaultBuild = buildFromSpec(DEFAULT_SPEC);
ok(defaultBuild.ok, JSON.stringify(defaultBuild.validation?.errors || defaultBuild.lint?.errors));
ok(defaultBuild.compiled.screens.includes('PAIRING'));
ok(defaultBuild.compiled.methods.includes('scanQrCode'));
ok(defaultBuild.compiled.methods.includes('startBrowserPairing'));
ok(/startBrowserPairing/.test(defaultBuild.files['pairing.html']));
ok(!/new\s+WebSocket/.test(defaultBuild.files['pairing.html']));
ok(!lintOutput({ 'pairing.html': 'new WebSocket("wss://x")' }, sdkBindings()).ok);

const skinTmp = mkdtempSync(join(tmpdir(), 'arnacon-skin-'));
try {
  seedSkin(skinTmp);
  const skinLint = lintSkinDir(skinTmp);
  ok(skinLint.ok, JSON.stringify(skinLint.errors));
  ok(skinLint.fileCount > 0);
} finally {
  rmSync(skinTmp, { recursive: true, force: true });
}

const restForbidden = mkdtempSync(join(tmpdir(), 'arnacon-rest-'));
try {
  writeFileSync(join(restForbidden, 'index.html'), '<script>fetch("/api/login")</script>');
  ok(!lintSkinDir(restForbidden).ok);
} finally {
  rmSync(restForbidden, { recursive: true, force: true });
}

ok(readFileSync(join(root, 'host/index.html'), 'utf8').includes('bootHost'));
ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('window.top.controller'));

console.log('studio self-check passed');
