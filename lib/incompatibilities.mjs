/**
 * Interpreter/compiler rules that warn or force flags.
 * Never invent extra spec keys (database, oauth, …).
 */

export function applyIncompatibilities(spec) {
  const next = structuredClone(spec);
  next.warnings = Array.isArray(next.warnings) ? [...next.warnings] : [];
  const warn = (message) => {
    if (!next.warnings.includes(message)) next.warnings.push(message);
  };

  const kinds = next.identity?.activeKinds || [];
  const addressing = next.identity?.addressing || [];
  const whatsappOnly = kinds.length === 1 && kinds[0] === 'whatsapp';
  const hasWhatsapp = kinds.includes('whatsapp');
  const hasArnaconFamily = kinds.some((k) => k !== 'whatsapp');

  if (whatsappOnly) {
    if (next.calls.voice || next.calls.video) {
      next.calls.voice = false;
      next.calls.video = false;
      next.calls.mute = false;
      next.calls.hold = false;
      next.calls.dtmf = false;
      next.calls.transfer = false;
      next.calls.switchCamera = false;
      next.calls.audioDevice = false;
      next.calls.dialer = false;
      warn('WhatsApp-only apps cannot show call UI; voice and video were turned off.');
    }
  } else if (hasWhatsapp && (next.calls.voice || next.calls.video)) {
    warn('Video and voice are hidden on WhatsApp sessions.');
  }

  if (next.device.contactPicker && !addressing.includes('email')) {
    next.device.contactPicker = false;
    warn('contactPicker requires email addressing; it was turned off.');
  }

  if (!hasArnaconFamily && addressing.length && !whatsappOnly) {
    // email/temp kinds still use addressing forms
  }

  if (hasWhatsapp && addressing.length && kinds.length === 1) {
    // WhatsApp does not use the email/ens/gsm new-chat form.
    warn('WhatsApp uses its own identity tree; addressing forms are unused for WhatsApp-only apps.');
  }

  if (next.runtime?.mode === 'browser-relay') {
    warn('Browser-relay requires the phone to stay paired on the WSS room.');
  }

  if (next.runtime?.mode === 'both') {
    warn('Browser-relay mode requires the phone to stay paired; WebView does not.');
  }

  if (next.calls.video && !next.calls.voice) {
    next.calls.voice = true;
  }

  if ((next.calls.voice || next.calls.video) && next.calls.switchCamera && !next.calls.video) {
    next.calls.switchCamera = false;
  }

  return next;
}

/** Extra warnings from prompt keywords that never become spec keys. */
export function promptDropWarnings(prompt) {
  const text = (prompt || '').toLowerCase();
  const warnings = [];
  if (/\b(database|crm|spreadsheet|postgres|mongo)\b/.test(text)) {
    warnings.push('Dropped custom database; using native sessions.');
  }
  if (/\b(oauth|signup|sign up|login|log in|auth0)\b/.test(text)) {
    warnings.push('Uses the installed product, not signup.');
  }
  if (/\b(stripe|payment|checkout|shop)\b/.test(text)) {
    warnings.push('Dropped payments; Arnacon has no general commerce API for generated apps.');
  }
  if (/\b(without (the )?phone|no phone|browser only|in (a )?browser)\b/.test(text)
      && !/\bphone\b/.test(text.replace(/without (the )?phone|no phone/g, ''))) {
    // handled in interpret via runtime.mode
  }
  return warnings;
}
