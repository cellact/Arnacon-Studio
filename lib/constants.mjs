/** Closed ontology for Arnacon app specs (envelope + capability packs). */

export const SPEC_VERSION = 2;
export const SPEC_VERSION_V1 = 1;
export const KIND = 'arnacon-app';
export const KIND_V1 = 'communication-client';

export const RUNTIME_MODES = Object.freeze(['webview', 'browser-relay', 'both']);
export const ACTIVE_KINDS = Object.freeze(['arnacon', 'whatsapp', 'email', 'temp']);
export const ADDRESSING = Object.freeze(['email', 'temp', 'ens', 'gsm']);
export const THEME_PRESETS = Object.freeze(['arnacon-default', 'custom']);

export const FORBIDDEN_SPEC_KEYS = Object.freeze([
  'localId',
  'database',
  'oauth',
  'restBase',
  'apiUrl',
  'iceServers',
  'fcm',
  'wallet',
  'appKey',
  'productJson',
  'rpc',
  'signalingServer',
  'turn',
  'auth',
]);

/** Methods a generated app may call on window.top.controller. */
export const METHOD_ALLOWLIST = Object.freeze([
  'on',
  'off',
  'createSession',
  'createGroup',
  'deleteSession',
  'getRecentSessions',
  'getMessages',
  'getSessionId',
  'getSessionName',
  'setSessionName',
  'updateSessionTimestamp',
  'sendMessage',
  'sendReplyMessage',
  'sendEditMessage',
  'sendFileMessage',
  'forwardMessage',
  'deleteMessage',
  'sendReaction',
  'markRead',
  'sendChatstate',
  'setBlocked',
  'getBlockStatus',
  'fetchBlocklist',
  'pingReachability',
  'callSession',
  'callRemote',
  'videoCallSession',
  'videoCallRemote',
  'acceptCall',
  'rejectCall',
  'endCall',
  'setMute',
  'setHold',
  'transferCall',
  'sendDtmf',
  'switchCamera',
  'changeAudioDevice',
  'getAudioDevices',
  'camera',
  'imagePicker',
  'contactPicker',
  'scanQrCode',
  'downloadFile',
]);

export const EVENT_ALLOWLIST = Object.freeze([
  'new-message',
  'message-updated',
  'message-reaction',
  'chatstate',
  'receiving-call',
  'ringing',
  'call-started',
  'call-ended',
  'call-connected',
  'call-answered-elsewhere',
  'connecting',
  'video-frame',
  'webrtc-disconnected',
  'mute-state',
  'local-hold-state',
  'active-calls',
  'identity-change',
  'error',
  'block-status',
  'block-result',
  'image-picker-result',
  'inject-remote-id',
]);

export const CALL_METHODS = Object.freeze([
  'callSession',
  'callRemote',
  'videoCallSession',
  'videoCallRemote',
  'acceptCall',
  'rejectCall',
  'endCall',
  'setMute',
  'setHold',
  'transferCall',
  'sendDtmf',
  'switchCamera',
  'changeAudioDevice',
  'getAudioDevices',
]);

export const ADDRESSING_UI = Object.freeze({
  email: {
    label: 'Email address',
    placeholder: 'e.g. user@example.com',
    help: 'Recipient email — used as-is (no hashing).',
    inputMode: 'email',
  },
  temp: {
    label: 'Private identifier',
    placeholder: 'e.g. matansada',
    help: 'Recipient private name — used as-is (no hashing).',
    inputMode: 'text',
  },
  ens: {
    label: 'ENS name',
    placeholder: 'e.g. alice.eth',
    help: 'Recipient ENS name — used as-is (no hashing).',
    inputMode: 'text',
  },
  gsm: {
    label: 'Phone number',
    placeholder: 'e.g. 14155551234',
    help: 'Recipient phone in international format (digits only, no "+").',
    inputMode: 'tel',
  },
});

export const OUTPUT_LINT_FORBIDDEN = Object.freeze([
  { id: 'fetch', re: /\bfetch\s*\(/, message: 'Generated apps must not call fetch(); use arnacon-controller.' },
  { id: 'xhr', re: /\bXMLHttpRequest\b/, message: 'Generated apps must not use XMLHttpRequest.' },
  { id: 'express', re: /\bexpress\b/i, message: 'Generated apps must not invent an Express backend.' },
  { id: 'oauth', re: /\boauth\b/i, message: 'Auth is the installed product, not OAuth.' },
  { id: 'mongodb', re: /\b(mongodb|mongoose|postgres|sqlite3)\b/i, message: 'Message history lives in native SQLite, not a generated database.' },
  { id: 'firebase-auth', re: /firebase\s*\.\s*auth/i, message: 'Do not invent Firebase Auth.' },
  { id: 'rest-api', re: /['"`]\/api\//, message: 'Do not invent REST /api/ endpoints.' },
  { id: 'localId-literal', re: /\blocalId\s*=\s*['"`][^'"`]+['"`]/, message: 'Do not invent localId; native injects it at runtime.' },
  { id: 'wallet', re: /\b(ethers\.|web3|walletconnect|metamask)\b/i, message: 'Do not invent a wallet or chain RPC; identity is the installed product.' },
  { id: 'stripe', re: /\bstripe\b/i, message: 'Do not invent payments; Arnacon has no commerce API for generated apps.' },
]);
