/** Capability packs. Flags only — the compiler derives screens and controller bindings. */

export const PACK_IDS = Object.freeze([
  'communication',
  'identity',
  'device',
  'subscription',
  'commerce',
]);

/** Packs the generator may emit screens/methods for. */
export const GENERATABLE_PACKS = Object.freeze(['communication', 'identity', 'device']);

/** Packs that are classified from prompts but never compiled until native grows methods. */
export const GAP_PACKS = Object.freeze(['subscription', 'commerce']);

/**
 * Native SDK contract per pack. Missing methods must not appear in generated HTML.
 * Identity is partial: PAIRING + injected localId work; list/switch do not.
 */
export const PACK_CATALOG = Object.freeze({
  communication: {
    native: 'yes',
    methods: [],
    events: [],
    message: 'Sessions, messages, and calls on arnacon-controller.',
  },
  device: {
    native: 'yes',
    methods: ['camera', 'imagePicker', 'contactPicker', 'scanQrCode', 'downloadFile'],
    events: ['image-picker-result', 'inject-remote-id'],
    message: 'Device pickers already exist on arnacon-controller.',
  },
  identity: {
    native: 'partial',
    methods: ['scanQrCode', 'startBrowserPairing', 'stopBrowserPairing', 'getBrowserPairing'],
    events: ['identity-change', 'pairing-status', 'pairing-ready'],
    missingMethods: ['listIdentities', 'switchIdentity', 'getActiveIdentity'],
    message: 'Identity switching is native chrome, not the controller. Generated apps may show the injected identity and PAIRING only.',
  },
  subscription: {
    native: 'no',
    missingMethods: ['getEntitlement', 'subscribe', 'unsubscribe'],
    missingEvents: ['entitlement-change'],
    message: 'Arnacon has no subscription API for generated apps. ZK proofs stay inside native; never put a proving key or RPC URL in the spec.',
  },
  commerce: {
    native: 'no',
    missingMethods: ['listListings', 'getListing', 'createListing', 'buyListing'],
    message: 'Arnacon has no commerce API for generated apps.',
  },
});

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isLegacySpec(src) {
  if (!isPlainObject(src)) return false;
  if (src.version === 1 || src.kind === 'communication-client') return true;
  if (src.sessions && !src.capabilities) return true;
  return false;
}

/**
 * Wrap a v1 communication-client spec as a v2 envelope.
 * Top-level sessions/messaging/calls/device move under capabilities.
 */
export function wrapLegacySpec(src) {
  const {
    version: _version,
    kind: _kind,
    sessions,
    messaging,
    calls,
    device,
    capabilities,
    ...rest
  } = src;
  const communication = {};
  if (isPlainObject(sessions)) communication.sessions = sessions;
  if (isPlainObject(messaging)) communication.messaging = messaging;
  if (isPlainObject(calls)) communication.calls = calls;
  const nextCaps = isPlainObject(capabilities) ? { ...capabilities } : {};
  if (Object.keys(communication).length) nextCaps.communication = communication;
  if (isPlainObject(device)) nextCaps.device = device;
  return {
    ...rest,
    version: 2,
    kind: 'arnacon-app',
    capabilities: nextCaps,
  };
}

export function communicationOf(spec) {
  return isPlainObject(spec?.capabilities?.communication) ? spec.capabilities.communication : null;
}

export function deviceOf(spec) {
  return isPlainObject(spec?.capabilities?.device) ? spec.capabilities.device : null;
}

export function identityPackOf(spec) {
  return isPlainObject(spec?.capabilities?.identity) ? spec.capabilities.identity : null;
}

export function enabledPacks(spec) {
  return PACK_IDS.filter((id) => isPlainObject(spec?.capabilities?.[id]));
}

export function nativeGapsFor(spec) {
  const gaps = [];
  for (const pack of enabledPacks(spec)) {
    const info = PACK_CATALOG[pack];
    if (!info || info.native === 'yes') continue;
    if (pack === 'identity' && !spec.capabilities?.identity?.switcher) continue;
    gaps.push({
      pack,
      native: info.native,
      missingMethods: info.missingMethods || [],
      missingEvents: info.missingEvents || [],
      message: info.message,
    });
  }
  return gaps;
}
