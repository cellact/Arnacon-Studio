/**
 * Interpreter/compiler rules that warn or force flags.
 * Never invent extra spec keys (database, oauth, …).
 */

import { communicationOf, deviceOf, GAP_PACKS, PACK_CATALOG, identityPackOf } from './packs.mjs';

export function applyIncompatibilities(spec) {
  const next = structuredClone(spec);
  next.warnings = [...new Set(Array.isArray(next.warnings) ? next.warnings : [])];
  const warn = (message) => {
    if (!next.warnings.includes(message)) next.warnings.push(message);
  };

  if (next.capabilities) {
    for (const pack of GAP_PACKS) {
      if (next.capabilities[pack] !== undefined) {
        delete next.capabilities[pack];
        warn(PACK_CATALOG[pack].message);
      }
    }
  }

  if (identityPackOf(next)?.switcher) {
    warn(PACK_CATALOG.identity.message);
  }

  const comm = communicationOf(next);
  const device = deviceOf(next);
  const kinds = next.identity?.activeKinds || [];
  const addressing = next.identity?.addressing || [];
  const whatsappOnly = kinds.length === 1 && kinds[0] === 'whatsapp';
  const hasWhatsapp = kinds.includes('whatsapp');

  if (comm?.calls) {
    if (whatsappOnly) {
      if (comm.calls.voice || comm.calls.video) {
        comm.calls.voice = false;
        comm.calls.video = false;
        comm.calls.mute = false;
        comm.calls.hold = false;
        comm.calls.dtmf = false;
        comm.calls.transfer = false;
        comm.calls.switchCamera = false;
        comm.calls.audioDevice = false;
        comm.calls.dialer = false;
        warn('WhatsApp-only apps cannot show call UI; voice and video were turned off.');
      }
    } else if (hasWhatsapp && (comm.calls.voice || comm.calls.video)) {
      warn('Video and voice are hidden on WhatsApp sessions.');
    }

    if (comm.calls.video && !comm.calls.voice) {
      comm.calls.voice = true;
    }
    if ((comm.calls.voice || comm.calls.video) && comm.calls.switchCamera && !comm.calls.video) {
      comm.calls.switchCamera = false;
    }
  }

  if (device?.contactPicker && !addressing.includes('email')) {
    device.contactPicker = false;
    warn('contactPicker requires email addressing; it was turned off.');
  }

  if (hasWhatsapp && addressing.length && kinds.length === 1) {
    warn('WhatsApp uses its own identity tree; addressing forms are unused for WhatsApp-only apps.');
  }

  if (next.runtime?.mode === 'browser-relay') {
    warn('Browser-relay requires the phone to stay paired on the WSS room.');
  }

  if (next.runtime?.mode === 'both') {
    warn('Browser-relay mode requires the phone to stay paired; WebView does not.');
  }

  return next;
}

/** Extra warnings from prompt keywords that never become spec keys. */
export function promptDropWarnings(prompt) {
  const text = (prompt || '').toLowerCase();
  const warnings = [];
  if (/\b(database|crm|spreadsheet|postgres|mongo)\b/.test(text)) {
    warnings.push('Dropped custom database; Arnacon apps cannot invent a database.');
  }
  if (/\b(oauth|signup|sign up|login|log in|auth0)\b/.test(text)) {
    warnings.push('Uses the installed product, not signup.');
  }
  if (/\b(stripe|payment|checkout|shop|store|listing|catalog|commerce)\b/.test(text)) {
    warnings.push(PACK_CATALOG.commerce.message);
  }
  if (/\b(subscri|zk|zero[- ]knowledge|entitlement|membership|paywall|paid access)\b/.test(text)) {
    warnings.push(PACK_CATALOG.subscription.message);
  }
  return warnings;
}
