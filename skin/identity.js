const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function canonicalizeGsmInput(rawInput) {
  return String(rawInput || '').replace(/[\s\-]/g, '').replace(/^\+/, '');
}
function validateInput(rawInput, provider) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return 'Enter a value.';
  if (provider === 'email') return EMAIL_PATTERN.test(trimmed) ? null : 'Enter a valid email address.';
  if (provider === 'temp' || provider === 'ens') return /\s/.test(trimmed) ? 'Value cannot contain whitespace.' : null;
  if (provider === 'gsm') {
    const digits = canonicalizeGsmInput(trimmed);
    return /^[0-9]{7,15}$/.test(digits) ? null : 'Use international format with country code, no leading "+".';
  }
  return 'Unknown provider.';
}
function canonicalizeRemote(rawInput, provider) {
  if (provider === 'gsm') return canonicalizeGsmInput(rawInput);
  return String(rawInput || '').trim();
}
