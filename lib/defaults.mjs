/** Defaults match the current ArnaconWeb client ("clone the web app"). */

import { isLegacySpec, isPlainObject, wrapLegacySpec } from './packs.mjs';
import { DEFAULT_COLORS } from './theme.mjs';

export const DEFAULT_COMMUNICATION = Object.freeze({
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
});

export const DEFAULT_DEVICE = Object.freeze({
  camera: true,
  imagePicker: true,
  contactPicker: true,
  qr: false,
  downloadFile: true,
});

export const DEFAULT_IDENTITY_PACK = Object.freeze({
  switcher: false,
  pairing: false,
  qr: false,
});

export const DEFAULT_SPEC = Object.freeze({
  version: 2,
  kind: 'arnacon-app',
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
  capabilities: {
    communication: DEFAULT_COMMUNICATION,
    device: DEFAULT_DEVICE,
  },
  theme: {
    preset: 'arnacon-default',
    colors: DEFAULT_COLORS,
  },
  warnings: [],
});

function mergeSection(defaults, overlay) {
  if (!isPlainObject(overlay)) return { ...defaults };
  return { ...defaults, ...overlay };
}

/**
 * Fill unspecified flags from ArnaconWeb defaults.
 * Arrays on identity replace rather than concat when provided.
 * Passing `capabilities` without `communication` omits the messenger pack
 * (shell / identity-only apps). Omitting `capabilities` clones the web app.
 */
export function mergeDefaults(partial = {}) {
  let src = isPlainObject(partial) ? { ...partial } : {};
  if (isLegacySpec(src)) src = wrapLegacySpec(src);

  const identityOverlay = isPlainObject(src.identity) ? src.identity : {};
  const capsIn = isPlainObject(src.capabilities) ? src.capabilities : undefined;
  const cloneWebApp = capsIn === undefined;
  const wantsCommunication = cloneWebApp || isPlainObject(capsIn.communication);
  const wantsDevice = cloneWebApp || isPlainObject(capsIn.device);
  const wantsIdentity = isPlainObject(capsIn?.identity);

  const capabilities = {};
  if (wantsCommunication) {
    const comm = isPlainObject(capsIn?.communication) ? capsIn.communication : {};
    capabilities.communication = {
      sessions: mergeSection(DEFAULT_COMMUNICATION.sessions, comm.sessions),
      messaging: mergeSection(DEFAULT_COMMUNICATION.messaging, comm.messaging),
      calls: mergeSection(DEFAULT_COMMUNICATION.calls, comm.calls),
    };
  }
  if (wantsDevice) {
    capabilities.device = mergeSection(DEFAULT_DEVICE, capsIn?.device);
  }
  if (wantsIdentity) {
    capabilities.identity = mergeSection(DEFAULT_IDENTITY_PACK, capsIn.identity);
  }

  const result = {
    version: src.version ?? 2,
    kind: src.kind ?? 'arnacon-app',
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
    capabilities,
    theme: {
      preset: isPlainObject(src.theme) && src.theme.preset ? src.theme.preset : DEFAULT_SPEC.theme.preset,
      colors: mergeSection(DEFAULT_COLORS, isPlainObject(src.theme) ? src.theme.colors : undefined),
    },
    warnings: Array.isArray(src.warnings) ? [...src.warnings] : [],
  };

  for (const key of Object.keys(src)) {
    if (key === 'capabilities' || key === 'sessions' || key === 'messaging' || key === 'calls' || key === 'device') {
      continue;
    }
    if (!(key in result)) result[key] = src[key];
  }
  return result;
}
