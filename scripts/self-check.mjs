import { deepStrictEqual, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintOutput } from '../lib/lint-output.mjs';
import { zipFiles } from '../lib/zip.mjs';
import { buildFromPrompt, buildFromSpec } from '../lib/pipeline.mjs';
import { loadExamples } from './examples.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examples = loadExamples();
ok(examples.length === 3, 'expected 3 few-shot examples');

for (const example of examples) {
  const fromFile = buildFromSpec(example.spec);
  ok(fromFile.validation.ok, `${example.id} spec failed: ${JSON.stringify(fromFile.validation.errors)}`);
  ok(fromFile.lint.ok, `${example.id} lint failed: ${JSON.stringify(fromFile.lint.errors)}`);
  ok(fromFile.compiled.screens.includes('MAIN') && fromFile.compiled.screens.includes('CHAT'));

  const fromPrompt = buildFromPrompt(example.prompt, examples);
  ok(fromPrompt.ok, `${example.id} prompt interpret failed`);
  ok(fromPrompt.spec.identity.source === 'installed-product');
  ok(fromPrompt.spec.kind === 'communication-client');
}

const direct = examples.find((ex) => ex.id === 'direct-chat');
const family = examples.find((ex) => ex.id === 'family-groups-video');
const inbox = examples.find((ex) => ex.id === 'email-support-inbox');

const directBuild = buildFromSpec(direct.spec);
ok(!directBuild.compiled.screens.includes('CALL'), '1:1 chat must omit call screens');
ok(!directBuild.compiled.methods.includes('callSession'));
ok(directBuild.compiled.screens.includes('NEW_CHAT'));
ok(!directBuild.compiled.screens.includes('CREATE_GROUP'));

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

const crm = buildFromPrompt('A CRM with OAuth login and a Postgres customer database', examples);
ok(crm.spec.kind === 'communication-client');
ok(!Object.prototype.hasOwnProperty.call(crm.spec, 'database'));
ok(crm.spec.warnings.some((w) => /database/i.test(w)));
ok(crm.spec.warnings.some((w) => /installed product/i.test(w)));

const mixed = buildFromPrompt('Messenger with WhatsApp and video calls', examples);
ok(mixed.spec.identity.activeKinds.includes('whatsapp'));
ok(mixed.spec.calls.video === true);
ok(mixed.compiled.gates.whatsappOmitsCalls);
ok(mixed.spec.warnings.some((w) => /hidden on WhatsApp/i.test(w)));
ok(mixed.ok, JSON.stringify(mixed.lint?.errors));

const waOnly = buildFromPrompt('WhatsApp only inbox', examples);
ok(waOnly.spec.identity.activeKinds[0] === 'whatsapp');
ok(waOnly.spec.calls.voice === false);
ok(waOnly.spec.calls.video === false);
ok(!waOnly.compiled.methods.includes('callSession'));

const bad = buildFromSpec({
  version: 1,
  kind: 'crm',
  runtime: { mode: 'webview' },
  identity: { source: 'installed-product', activeKinds: ['arnacon'] },
  sessions: { direct: true },
  messaging: { text: true },
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
deepStrictEqual(schema.properties.kind.const, 'communication-client');
ok(schema.additionalProperties === false);

const zipped = zipFiles({ 'hello.txt': 'ok' });
ok(zipped.length > 30);
ok(String.fromCharCode(zipped[0], zipped[1], zipped[2], zipped[3]) === 'PK\u0003\u0004');

console.log('studio self-check passed');
