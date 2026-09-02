import { ADDRESSING_UI, CALL_METHODS } from './constants.mjs';

function add(set, items) {
  for (const item of items) set.add(item);
}

/**
 * Deterministic compiler: flags → screens, methods, events, gates.
 * The LLM must not pick these lists.
 */
export function compile(spec) {
  const screens = new Set(['MAIN', 'CHAT']);
  const methods = new Set(['on', 'off', 'getRecentSessions', 'getMessages', 'updateSessionTimestamp']);
  const events = new Set(['identity-change', 'error', 'new-message']);

  if (spec.sessions.direct) {
    screens.add('NEW_CHAT');
    add(methods, ['createSession', 'getSessionId', 'getSessionName']);
  }
  if (spec.sessions.groups) {
    screens.add('CREATE_GROUP');
    methods.add('createGroup');
  }
  if (spec.sessions.rename) methods.add('setSessionName');
  if (spec.sessions.delete) methods.add('deleteSession');

  if (spec.messaging.text) methods.add('sendMessage');
  if (spec.messaging.files) methods.add('sendFileMessage');
  if (spec.messaging.replies) {
    methods.add('sendReplyMessage');
    events.add('message-updated');
  }
  if (spec.messaging.edits) {
    methods.add('sendEditMessage');
    events.add('message-updated');
  }
  if (spec.messaging.forwards) {
    methods.add('forwardMessage');
    events.add('message-updated');
  }
  if (spec.messaging.delete) {
    methods.add('deleteMessage');
    events.add('message-updated');
  }
  if (spec.messaging.reactions) {
    methods.add('sendReaction');
    events.add('message-reaction');
  }
  if (spec.messaging.typing) {
    methods.add('sendChatstate');
    events.add('chatstate');
  }
  if (spec.messaging.readReceipts) methods.add('markRead');
  if (spec.messaging.block) {
    add(methods, ['setBlocked', 'getBlockStatus', 'fetchBlocklist']);
    add(events, ['block-status', 'block-result']);
  }
  if (spec.messaging.reachability) methods.add('pingReachability');
  if (spec.messaging.files) events.add('message-updated');

  const callsEnabled = !!(spec.calls.voice || spec.calls.video);
  if (callsEnabled) {
    add(screens, ['CALL', 'RING', 'INCOMING']);
    add(methods, ['callSession', 'callRemote', 'acceptCall', 'rejectCall', 'endCall']);
    add(events, [
      'receiving-call', 'ringing', 'call-started', 'call-ended',
      'call-connected', 'call-answered-elsewhere', 'connecting',
    ]);
  }
  if (spec.calls.video) {
    add(methods, ['videoCallSession', 'videoCallRemote']);
    add(events, ['video-frame', 'webrtc-disconnected']);
  }
  if (spec.calls.mute) {
    methods.add('setMute');
    events.add('mute-state');
  }
  if (spec.calls.hold) {
    methods.add('setHold');
    events.add('local-hold-state');
    events.add('active-calls');
  }
  if (spec.calls.dtmf) methods.add('sendDtmf');
  if (spec.calls.transfer) methods.add('transferCall');
  if (spec.calls.switchCamera) methods.add('switchCamera');
  if (spec.calls.audioDevice) {
    add(methods, ['changeAudioDevice', 'getAudioDevices']);
  }
  if (spec.calls.dialer) screens.add('DIALER');

  if (spec.device.camera) methods.add('camera');
  if (spec.device.imagePicker) {
    methods.add('imagePicker');
    events.add('image-picker-result');
  }
  if (spec.device.contactPicker) {
    methods.add('contactPicker');
    events.add('inject-remote-id');
  }
  if (spec.device.qr) methods.add('scanQrCode');
  if (spec.device.downloadFile) methods.add('downloadFile');

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

  return {
    spec,
    screens: [...screens],
    methods: methodList,
    events: [...events].sort(),
    callMethods,
    addressingUi,
    gates: {
      whatsappOmitsCalls,
      contactPickerEmailOnly: !!spec.device.contactPicker,
      callsEnabled,
      whatsappOnly: kinds.length === 1 && kinds[0] === 'whatsapp',
    },
    warnings: [...(spec.warnings || [])],
  };
}
