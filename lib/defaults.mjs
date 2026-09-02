/** Defaults match the current ArnaconWeb client ("clone the web app"). */

export const DEFAULT_SPEC = Object.freeze({
  version: 1,
  kind: 'communication-client',
  app: {
    name: 'Arnacon',
    summary: 'Clone of the current Arnacon web client.',
  },
  runtime: {
    mode: 'webview',
  },
  identity: {
    source: 'installed-product',
    activeKinds: ['arnacon', 'whatsapp'],
    addressing: ['email', 'temp', 'ens', 'gsm'],
  },
  sessions: {
    direct: true,
    groups: true,
    rename: true,
    delete: true,
  },
  messaging: {
    text: true,
    files: true,
    replies: true,
    edits: true,
    forwards: true,
    delete: true,
    reactions: true,
    typing: true,
    readReceipts: true,
    block: true,
    reachability: false,
  },
  calls: {
    voice: true,
    video: true,
    mute: true,
    hold: true,
    dtmf: false,
    transfer: false,
    switchCamera: true,
    audioDevice: true,
    dialer: false,
  },
  device: {
    camera: true,
    imagePicker: true,
    contactPicker: true,
    qr: false,
    downloadFile: true,
  },
  theme: {
    preset: 'arnacon-default',
  },
  warnings: [],
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeSection(defaults, overlay) {
  if (!isPlainObject(overlay)) return { ...defaults };
  return { ...defaults, ...overlay };
}

/**
 * Fill unspecified flags from ArnaconWeb defaults.
 * Arrays on identity replace rather than concat when provided.
 */
export function mergeDefaults(partial = {}) {
  const src = isPlainObject(partial) ? partial : {};
  const identityOverlay = isPlainObject(src.identity) ? src.identity : {};
  const result = {
    version: src.version ?? DEFAULT_SPEC.version,
    kind: src.kind ?? DEFAULT_SPEC.kind,
    app: mergeSection(DEFAULT_SPEC.app, src.app),
    runtime: mergeSection(DEFAULT_SPEC.runtime, src.runtime),
    identity: {
      ...DEFAULT_SPEC.identity,
      ...identityOverlay,
      activeKinds: Array.isArray(identityOverlay.activeKinds)
        ? [...identityOverlay.activeKinds]
        : [...DEFAULT_SPEC.identity.activeKinds],
      addressing: Array.isArray(identityOverlay.addressing)
        ? [...identityOverlay.addressing]
        : [...DEFAULT_SPEC.identity.addressing],
    },
    sessions: mergeSection(DEFAULT_SPEC.sessions, src.sessions),
    messaging: mergeSection(DEFAULT_SPEC.messaging, src.messaging),
    calls: mergeSection(DEFAULT_SPEC.calls, src.calls),
    device: mergeSection(DEFAULT_SPEC.device, src.device),
    theme: mergeSection(DEFAULT_SPEC.theme, src.theme),
    warnings: Array.isArray(src.warnings) ? [...src.warnings] : [],
  };
  for (const key of Object.keys(src)) {
    if (!(key in result)) result[key] = src[key];
  }
  return result;
}
