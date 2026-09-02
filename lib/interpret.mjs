import { mergeDefaults } from './defaults.mjs';
import { applyIncompatibilities, promptDropWarnings } from './incompatibilities.mjs';

function norm(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * @param {{ prompt: string, spec: object }[]} examples
 */
export function matchExample(prompt, examples = []) {
  const n = norm(prompt);
  if (!n) return null;
  for (const example of examples) {
    if (norm(example.prompt) === n) return example;
  }
  for (const example of examples) {
    const p = norm(example.prompt);
    if (p && (n.includes(p) || p.includes(n))) return example;
  }
  return null;
}

function applyKeywords(spec, prompt) {
  const t = norm(prompt);
  if (!t) return spec;

  const noWhatsapp = /\bno whatsapp\b|\bwithout whatsapp\b|\bnot whatsapp\b/.test(t);
  const whatsappOnly = /\bwhatsapp only\b|\bonly whatsapp\b/.test(t);
  const wantsWhatsapp = /\bwhatsapp\b/.test(t) && !noWhatsapp;

  if (noWhatsapp) {
    spec.identity.activeKinds = spec.identity.activeKinds.filter((k) => k !== 'whatsapp');
    if (!spec.identity.activeKinds.length) spec.identity.activeKinds = ['arnacon'];
  } else if (whatsappOnly) {
    spec.identity.activeKinds = ['whatsapp'];
    spec.identity.addressing = [];
  } else if (wantsWhatsapp && !spec.identity.activeKinds.includes('whatsapp')) {
    spec.identity.activeKinds.push('whatsapp');
  }

  if (/\b(1:1|one-to-one|one to one|direct only|no groups?)\b/.test(t)) {
    spec.sessions.groups = false;
  }
  if (/\bgroups?\b/.test(t) && !/\bno groups?\b/.test(t)) {
    spec.sessions.groups = true;
  }

  if (/\b(text only|messages? only|no calls?|without calls?)\b/.test(t)) {
    spec.calls.voice = false;
    spec.calls.video = false;
    spec.calls.mute = false;
    spec.calls.hold = false;
    spec.calls.switchCamera = false;
    spec.calls.audioDevice = false;
    spec.calls.dialer = false;
  }
  if (/\bvideo\b/.test(t) && !/\bno video\b/.test(t)) {
    spec.calls.voice = true;
    spec.calls.video = true;
  }
  if (/\bvoice\b/.test(t) && !/\bno (voice|calls?)\b/.test(t)) {
    spec.calls.voice = true;
  }

  if (/\b(photos?|files?|images?|attachments?|camera)\b/.test(t)) {
    spec.messaging.files = true;
    spec.device.camera = true;
    spec.device.imagePicker = true;
  }
  if (/\b(no files?|text only|messages? only)\b/.test(t) && !/\bphotos?\b/.test(t)) {
    spec.messaging.files = false;
    spec.device.camera = false;
    spec.device.imagePicker = false;
  }

  if (/\b(simple|minimal)\b/.test(t)) {
    spec.sessions.groups = false;
    spec.calls.voice = false;
    spec.calls.video = false;
    spec.messaging.files = false;
    spec.messaging.reactions = false;
    spec.device.camera = false;
    spec.device.imagePicker = false;
    spec.device.contactPicker = false;
    spec.identity.activeKinds = spec.identity.activeKinds.filter((k) => k !== 'whatsapp');
    if (!spec.identity.activeKinds.length) spec.identity.activeKinds = ['arnacon'];
  }

  if (/\b(support|inbox|email)\b/.test(t) && !whatsappOnly) {
    spec.identity.activeKinds = ['email'];
    spec.identity.addressing = ['email'];
    spec.sessions.groups = false;
    spec.device.contactPicker = true;
    spec.messaging.block = true;
    spec.messaging.typing = true;
    spec.messaging.readReceipts = true;
    if (/\b(support|inbox)\b/.test(t) && !/\bcall/.test(t)) {
      spec.calls.voice = false;
      spec.calls.video = false;
    }
  }

  if (/\b(gsm|sms|phone number)\b/.test(t) && !/\bno phone\b/.test(t)) {
    if (!spec.identity.addressing.includes('gsm')) spec.identity.addressing.push('gsm');
  }

  if (/\bfamily\b/.test(t)) {
    spec.sessions.groups = true;
    spec.identity.addressing = spec.identity.addressing.filter((a) => a !== 'gsm');
    if (!spec.identity.addressing.includes('ens')) spec.identity.addressing.push('ens');
    if (!spec.identity.addressing.includes('temp')) spec.identity.addressing.push('temp');
  }

  if (/\b(browser only|in (a )?browser|no phone|without (the )?phone)\b/.test(t)) {
    spec.runtime.mode = 'browser-relay';
  }

  if (/\b(reactions?)\b/.test(t)) spec.messaging.reactions = true;
  if (/\bblock\b/.test(t)) spec.messaging.block = true;

  return spec;
}

function titleFromPrompt(prompt) {
  const trimmed = (prompt || '').trim();
  if (!trimmed) return 'Arnacon';
  const first = trimmed.split(/[.!?]/)[0].trim();
  return first.slice(0, 80) || 'Arnacon';
}

/**
 * Prompt → merged, incompatibility-adjusted intent spec.
 * Exact few-shot prompts win over keyword overlay.
 */
export function interpret(prompt, examples = []) {
  const matched = matchExample(prompt, examples);
  if (matched) {
    const spec = mergeDefaults(matched.spec);
    spec.app = {
      name: matched.spec.app?.name || spec.app.name,
      summary: matched.spec.app?.summary || spec.app.summary,
    };
    spec.warnings = [
      ...(matched.spec.warnings || []),
      ...promptDropWarnings(prompt),
    ];
    return applyIncompatibilities(spec);
  }

  const spec = mergeDefaults({
    app: {
      name: titleFromPrompt(prompt),
      summary: (prompt || '').trim().slice(0, 280),
    },
    warnings: promptDropWarnings(prompt),
  });

  if (!(prompt || '').trim() || /^\s*(clone|default|the web app)\s*$/i.test(prompt)) {
    return applyIncompatibilities(spec);
  }

  applyKeywords(spec, prompt);
  return applyIncompatibilities(spec);
}
