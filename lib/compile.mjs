import { ADDRESSING_UI, CALL_METHODS } from './constants.mjs';
import {
  communicationOf,
  deviceOf,
  enabledPacks,
  identityPackOf,
  nativeGapsFor,
} from './packs.mjs';

function add(set, items) {
  for (const item of items) set.add(item);
}

function compileCommunication(comm, screens, methods, events) {
  screens.add('CHAT');
  add(methods, ['getRecentSessions', 'getMessages', 'updateSessionTimestamp']);
  events.add('new-message');

  const sessions = comm.sessions || {};
  const messaging = comm.messaging || {};
  const calls = comm.calls || {};

  if (sessions.direct) {
    screens.add('NEW_CHAT');
    add(methods, ['createSession', 'getSessionId', 'getSessionName']);
  }
  if (sessions.groups) {
    screens.add('CREATE_GROUP');
    methods.add('createGroup');
  }
  if (sessions.rename) methods.add('setSessionName');
  if (sessions.delete) methods.add('deleteSession');

  if (messaging.text) methods.add('sendMessage');
  if (messaging.files) methods.add('sendFileMessage');
  if (messaging.replies) {
    methods.add('sendReplyMessage');
    events.add('message-updated');
  }
  if (messaging.edits) {
    methods.add('sendEditMessage');
    events.add('message-updated');
  }
  if (messaging.forwards) {
    methods.add('forwardMessage');
    events.add('message-updated');
  }
  if (messaging.delete) {
    methods.add('deleteMessage');
    events.add('message-updated');
  }
  if (messaging.reactions) {
    methods.add('sendReaction');
    events.add('message-reaction');
  }
  if (messaging.typing) {
    methods.add('sendChatstate');
    events.add('chatstate');
  }
  if (messaging.readReceipts) methods.add('markRead');
  if (messaging.block) {
    add(methods, ['setBlocked', 'getBlockStatus', 'fetchBlocklist']);
    add(events, ['block-status', 'block-result']);
  }
  if (messaging.reachability) methods.add('pingReachability');
  if (messaging.files) events.add('message-updated');

  const callsEnabled = !!(calls.voice || calls.video);
  if (callsEnabled) {
    add(screens, ['CALL', 'RING', 'INCOMING']);
    add(methods, ['callSession', 'callRemote', 'acceptCall', 'rejectCall', 'endCall']);
    add(events, [
      'receiving-call', 'ringing', 'call-started', 'call-ended',
      'call-connected', 'call-answered-elsewhere', 'connecting',
    ]);
  }
  if (calls.video) {
    add(methods, ['videoCallSession', 'videoCallRemote']);
    add(events, ['video-frame', 'webrtc-disconnected']);
  }
  if (calls.mute) {
    methods.add('setMute');
    events.add('mute-state');
  }
  if (calls.hold) {
    methods.add('setHold');
    events.add('local-hold-state');
    events.add('active-calls');
  }
  if (calls.dtmf) methods.add('sendDtmf');
  if (calls.transfer) methods.add('transferCall');
  if (calls.switchCamera) methods.add('switchCamera');
  if (calls.audioDevice) {
    add(methods, ['changeAudioDevice', 'getAudioDevices']);
  }
  if (calls.dialer) screens.add('DIALER');
  return callsEnabled;
}

function compileDevice(device, methods, events) {
  if (device.camera) methods.add('camera');
  if (device.imagePicker) {
    methods.add('imagePicker');
    events.add('image-picker-result');
  }
  if (device.contactPicker) {
    methods.add('contactPicker');
    events.add('inject-remote-id');
  }
  if (device.qr) methods.add('scanQrCode');
  if (device.downloadFile) methods.add('downloadFile');
}

function compileIdentityPack(pack, screens, methods) {
  if (pack.pairing) screens.add('PAIRING');
  if (pack.switcher) screens.add('IDENTITIES');
  if (pack.qr) methods.add('scanQrCode');
}

/**
 * Deterministic compiler: pack flags → screens, methods, events, gates.
 * Starts from a shell (MAIN). Communication is not always-on.
 */
export function compile(spec) {
  const screens = new Set(['MAIN']);
  const methods = new Set(['on', 'off']);
  const events = new Set(['identity-change', 'error']);

  const comm = communicationOf(spec);
  const device = deviceOf(spec);
  const identityPack = identityPackOf(spec);

  let callsEnabled = false;
  if (comm) {
    callsEnabled = compileCommunication(comm, screens, methods, events);
  }
  if (device) compileDevice(device, methods, events);
  if (identityPack) compileIdentityPack(identityPack, screens, methods);

  const relay = spec.runtime.mode === 'browser-relay' || spec.runtime.mode === 'both';
  if (relay) screens.add('PAIRING');

  const kinds = spec.identity.activeKinds || [];
  const addressing = spec.identity.addressing || [];
  const whatsappOmitsCalls = kinds.includes('whatsapp') && callsEnabled;

  const addressingUi = {};
  for (const provider of addressing) {
    if (ADDRESSING_UI[provider]) addressingUi[provider] = ADDRESSING_UI[provider];
  }

  const methodList = [...methods].sort();
  const callMethods = methodList.filter((m) => CALL_METHODS.includes(m));
  const packs = enabledPacks(spec);
  const nativeGaps = nativeGapsFor(spec);

  return {
    spec,
    packs,
    nativeGaps,
    screens: [...screens],
    methods: methodList,
    events: [...events].sort(),
    callMethods,
    addressingUi,
    gates: {
      whatsappOmitsCalls,
      contactPickerEmailOnly: !!(device && device.contactPicker),
      callsEnabled,
      whatsappOnly: kinds.length === 1 && kinds[0] === 'whatsapp',
      hasCommunication: !!comm,
    },
    warnings: [...(spec.warnings || [])],
  };
}
