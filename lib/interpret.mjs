import { mergeDefaults } from './defaults.mjs';
import { applyIncompatibilities, promptDropWarnings } from './incompatibilities.mjs';
import { communicationOf, isPlainObject } from './packs.mjs';

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

export function detectPacks(prompt) {
  const t = norm(prompt);
  if (!t) {
    return { communication: true, identity: false, subscription: false, commerce: false, crm: false };
  }
  const withoutNegations = t.replace(/\bno (chats?|messages?|messenger|groups?|calls?|files?)\b/g, '');
  const communication = /\b(chat|chats|message|messages|messenger|inbox|group|groups|call|calls|video|voice|whatsapp|sms|family|conversation|support|typing|reaction|reactions|1:1|one-to-one|one to one)\b/.test(withoutNegations);
  const identity = /\b(pair|pairing|identit(?:y|ies)|qr|browser-relay|switch (?:product|identity)|installed product)\b/.test(t);
  const subscription = /\b(subscri|zk|zero[- ]knowledge|entitlement|membership|paywall|paid access)\b/.test(t);
  const commerce = /\b(shop|store|listing|listings|checkout|catalog|commerce|buy|sell|stripe|payment)\b/.test(t);
  const crm = /\b(crm|database|postgres|mongo|oauth|spreadsheet)\b/.test(t);
  return { communication, identity, subscription, commerce, crm };
}

function ensureCommunication(spec) {
  if (communicationOf(spec)) return communicationOf(spec);
  const merged = mergeDefaults({
    ...spec,
    capabilities: {
      ...(isPlainObject(spec.capabilities) ? spec.capabilities : {}),
      communication: {},
    },
  });
  spec.capabilities = merged.capabilities;
  return communicationOf(spec);
}

function applyKeywords(spec, prompt) {
  const t = norm(prompt);
  if (!t) return spec;

  const comm = communicationOf(spec);
  const device = spec.capabilities?.device;
  if (!comm) return spec;

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
    comm.sessions.groups = false;
  }
  if (/\bgroups?\b/.test(t) && !/\bno groups?\b/.test(t)) {
    comm.sessions.groups = true;
  }

  if (/\b(text only|messages? only|no calls?|without calls?)\b/.test(t)) {
    comm.calls.voice = false;
    comm.calls.video = false;
    comm.calls.mute = false;
    comm.calls.hold = false;
    comm.calls.switchCamera = false;
    comm.calls.audioDevice = false;
    comm.calls.dialer = false;
  }
  if (/\bvideo\b/.test(t) && !/\bno video\b/.test(t)) {
    comm.calls.voice = true;
    comm.calls.video = true;
  }
  if (/\bvoice\b/.test(t) && !/\bno (voice|calls?)\b/.test(t)) {
    comm.calls.voice = true;
  }

  if (device && /\b(photos?|files?|images?|attachments?|camera)\b/.test(t)) {
    comm.messaging.files = true;
    device.camera = true;
    device.imagePicker = true;
  }
  if (device && /\b(no files?|text only|messages? only)\b/.test(t) && !/\bphotos?\b/.test(t)) {
    comm.messaging.files = false;
    device.camera = false;
    device.imagePicker = false;
  }

  if (/\b(simple|minimal)\b/.test(t)) {
    comm.sessions.groups = false;
    comm.calls.voice = false;
    comm.calls.video = false;
    comm.messaging.files = false;
    comm.messaging.reactions = false;
    if (device) {
      device.camera = false;
      device.imagePicker = false;
      device.contactPicker = false;
    }
    spec.identity.activeKinds = spec.identity.activeKinds.filter((k) => k !== 'whatsapp');
    if (!spec.identity.activeKinds.length) spec.identity.activeKinds = ['arnacon'];
  }

  if (/\b(support|inbox|email)\b/.test(t) && !whatsappOnly) {
    spec.identity.activeKinds = ['email'];
    spec.identity.addressing = ['email'];
    comm.sessions.groups = false;
    if (device) device.contactPicker = true;
    comm.messaging.block = true;
    comm.messaging.typing = true;
    comm.messaging.readReceipts = true;
    if (/\b(support|inbox)\b/.test(t) && !/\bcall/.test(t)) {
      comm.calls.voice = false;
      comm.calls.video = false;
    }
  }

  if (/\b(gsm|sms|phone number)\b/.test(t) && !/\bno phone\b/.test(t)) {
    if (!spec.identity.addressing.includes('gsm')) spec.identity.addressing.push('gsm');
  }

  if (/\bfamily\b/.test(t)) {
    comm.sessions.groups = true;
    spec.identity.addressing = spec.identity.addressing.filter((a) => a !== 'gsm');
    if (!spec.identity.addressing.includes('ens')) spec.identity.addressing.push('ens');
    if (!spec.identity.addressing.includes('temp')) spec.identity.addressing.push('temp');
  }

  if (/\b(reactions?)\b/.test(t)) comm.messaging.reactions = true;
  if (/\bblock\b/.test(t)) comm.messaging.block = true;

  return spec;
}

function applyIdentityKeywords(spec, prompt) {
  const t = norm(prompt);
  const wantsPairing = /\b(pair|pairing|browser only|in (a )?browser|no phone|without (the )?phone|browser-relay)\b/.test(t);
  const wantsSwitcher = /\b(switch (?:product|identity)|identit(?:y|ies)|installed product)\b/.test(t);
  const wantsQr = /\bqr\b/.test(t);

  if (!wantsPairing && !wantsSwitcher && !wantsQr) return spec;

  const identity = {
    switcher: wantsSwitcher,
    pairing: wantsPairing,
    qr: wantsQr || wantsPairing,
  };
  spec.capabilities = spec.capabilities || {};
  spec.capabilities.identity = {
    ...(spec.capabilities.identity || {}),
    ...identity,
  };

  if (wantsPairing) {
    spec.runtime.mode = 'browser-relay';
  }
  if (wantsQr) {
    spec.capabilities.device = spec.capabilities.device || {};
    spec.capabilities.device.qr = true;
  }
  return spec;
}

function titleFromPrompt(prompt) {
  const trimmed = (prompt || '').trim();
  if (!trimmed) return 'Arnacon';
  const first = trimmed.split(/[.!?]/)[0].trim();
  return first.slice(0, 80) || 'Arnacon';
}

function basePartial(prompt) {
  const detected = detectPacks(prompt);
  const trimmed = (prompt || '').trim();
  const clone = !trimmed || /^\s*(clone|default|the web app)\s*$/i.test(prompt);
  const partial = {
    app: {
      name: titleFromPrompt(prompt),
      summary: trimmed.slice(0, 280),
    },
    warnings: promptDropWarnings(prompt),
  };

  const wantsComms = clone || detected.communication;
  const shellOnly = !clone && !wantsComms && (detected.subscription || detected.commerce || detected.crm || detected.identity);

  if (shellOnly) {
    partial.capabilities = {};
    if (detected.identity) {
      partial.capabilities.identity = { switcher: false, pairing: false, qr: false };
    }
  }

  return { partial, detected, clone, wantsComms, shellOnly };
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

  const { partial, detected, clone, wantsComms, shellOnly } = basePartial(prompt);
  let spec = mergeDefaults(partial);

  if (clone) {
    return applyIncompatibilities(spec);
  }

  if (shellOnly && !wantsComms) {
    applyIdentityKeywords(spec, prompt);
    if (!spec.capabilities) spec.capabilities = {};
    delete spec.capabilities.communication;
    if (!detected.identity && spec.capabilities.device) {
      delete spec.capabilities.device;
    }
    return applyIncompatibilities(spec);
  }

  if (wantsComms) ensureCommunication(spec);
  applyKeywords(spec, prompt);
  applyIdentityKeywords(spec, prompt);
  if (detected.identity || detected.subscription || detected.commerce) {
    applyIdentityKeywords(spec, prompt);
  }
  return applyIncompatibilities(spec);
}
