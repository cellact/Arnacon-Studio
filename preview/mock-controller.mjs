/** In-memory controller for studio preview. Not used in generated production apps. */

export function createMockController() {
  const listeners = new Map();
  const sessions = [
    { sessionId: 101, sessionName: 'Alex', remoteId: 'alex', lastMessageContent: 'See you at 6.', lastMessageAuthor: 'alex', lastMessageTime: Date.now(), unreadCount: 0, isGroup: false, transport: 'arnacon' },
    { sessionId: 102, sessionName: 'Sam', remoteId: 'sam', lastMessageContent: 'Sent the photos.', lastMessageAuthor: 'sam', lastMessageTime: Date.now(), unreadCount: 0, isGroup: false, transport: 'arnacon' },
  ];
  const messages = {
    101: [
      { messageId: 'm1', time: Date.now() - 60000, author: 'alex', content: 'See you at 6.', sessionId: 101, contact: null, status: 6, fileId: null, replyTo: null, isEdited: false, forwardInfo: null, transport: 'arnacon', reactions: null },
      { messageId: 'm2', time: Date.now() - 30000, author: 'preview.arnacon', content: 'On my way.', sessionId: 101, contact: null, status: 5, fileId: null, replyTo: null, isEdited: false, forwardInfo: null, transport: 'arnacon', reactions: null },
    ],
    102: [
      { messageId: 'm3', time: Date.now() - 120000, author: 'sam', content: 'Sent the photos.', sessionId: 102, contact: null, status: 6, fileId: null, replyTo: null, isEdited: false, forwardInfo: null, transport: 'arnacon', reactions: null },
    ],
  };
  let nextId = 200;
  let nextMessage = 10;

  function emit(event, body) {
    for (const fn of listeners.get(event) || []) fn(body || {});
  }

  const controller = {
    localId: 'preview.arnacon',
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    off(event, fn) {
      const list = listeners.get(event) || [];
      listeners.set(event, list.filter((x) => x !== fn));
    },
    async getRecentSessions() {
      return { sessions: [...sessions] };
    },
    async getMessages(sessionId) {
      return { messages: [...(messages[sessionId] || messages[Number(sessionId)] || [])] };
    },
    async createSession(remoteId, sessionName) {
      const sessionId = nextId++;
      sessions.unshift({
        sessionId,
        sessionName: sessionName || remoteId,
        remoteId,
        lastMessageContent: '',
        lastMessageAuthor: '',
        lastMessageTime: Date.now(),
        unreadCount: 0,
        isGroup: false,
        transport: 'arnacon',
      });
      messages[sessionId] = [];
      return { sessionId, remoteId, sessionName: sessionName || remoteId, transport: 'arnacon', requestId: 'preview' };
    },
    createGroup(groupData) {
      const sessionId = nextId++;
      sessions.unshift({
        sessionId,
        sessionName: groupData.name || 'Group',
        remoteId: '',
        lastMessageContent: '',
        lastMessageAuthor: '',
        lastMessageTime: Date.now(),
        unreadCount: 0,
        isGroup: true,
        transport: 'arnacon',
      });
      messages[sessionId] = [];
    },
    deleteSession(sessionId) {
      const i = sessions.findIndex((s) => String(s.sessionId) === String(sessionId));
      if (i >= 0) sessions.splice(i, 1);
    },
    async getSessionId() { return { sessionId: String(sessions[0]?.sessionId || ''), requestId: 'preview' }; },
    async getSessionName(sessionId) {
      const s = sessions.find((x) => String(x.sessionId) === String(sessionId));
      return { sessionName: s?.sessionName || '', requestId: 'preview' };
    },
    setSessionName(sessionId, name) {
      const s = sessions.find((x) => String(x.sessionId) === String(sessionId));
      if (s) s.sessionName = name;
    },
    updateSessionTimestamp() {},
    sendMessage(sessionId, text) {
      const sid = Number(sessionId) || sessions[0]?.sessionId;
      if (!messages[sid]) messages[sid] = [];
      const msg = {
        messageId: 'm' + (nextMessage++),
        time: Date.now(),
        author: controller.localId || 'preview.arnacon',
        content: text,
        sessionId: sid,
        contact: null,
        status: 5,
        fileId: null,
        replyTo: null,
        isEdited: false,
        forwardInfo: null,
        transport: 'arnacon',
        reactions: null,
      };
      messages[sid].push(msg);
      const session = sessions.find((s) => String(s.sessionId) === String(sid));
      if (session) {
        session.lastMessageContent = text;
        session.lastMessageAuthor = msg.author;
        session.lastMessageTime = msg.time;
      }
      emit('new-message', { message: msg });
    },
    sendReplyMessage(_t, text) { controller.sendMessage(_t, text); },
    sendEditMessage() {},
    sendFileMessage(sessionId, _fileId, caption) {
      controller.sendMessage(sessionId, caption || 'Photo');
    },
    forwardMessage() {},
    deleteMessage() {},
    sendReaction() {},
    markRead() {},
    sendChatstate() {},
    setBlocked() {},
    getBlockStatus() { return { blocked: false }; },
    fetchBlocklist() { return { blocklist: [] }; },
    pingReachability() {},
    callSession() { emit('ringing', { to: 'alex', callId: 'alex' }); },
    callRemote(remoteId) { emit('ringing', { to: remoteId, callId: remoteId }); },
    videoCallSession() { emit('ringing', { to: 'alex', callId: 'alex', videoCall: true }); },
    videoCallRemote(remoteId) { emit('ringing', { to: remoteId, callId: remoteId, videoCall: true }); },
    acceptCall(callId) { emit('call-started', { from: callId, callId, videoCall: false }); },
    rejectCall(callId) { emit('call-ended', { from: callId }); },
    endCall(callId) { controller.rejectCall(callId); },
    setMute(_callId, muted) { emit('mute-state', { mute: !!muted }); },
    setHold() {},
    transferCall() {},
    sendDtmf() {},
    switchCamera() {},
    async getAudioDevices() { return { audioDevices: ['speaker'], requestId: 'preview' }; },
    changeAudioDevice() {},
    camera() {},
    async imagePicker() {
      const body = { imagePickerResult: 'preview', imageId: 'preview', requestId: 'preview' };
      emit('image-picker-result', body);
      return body;
    },
    async contactPicker() { return { injectRemoteId: 'customer@example.com', requestId: 'preview' }; },
    async scanQrCode() { return { qrContent: 'arnacon://browser-relay?room=PREVW1&relay=wss://arnacon-phone-relay-309305771885.europe-west1.run.app', requestId: 'preview' }; },
    async startBrowserPairing() {
      const offer = {
        room: 'PREVW1',
        pairingUri: 'arnacon://browser-relay?room=PREVW1&relay=wss://arnacon-phone-relay-309305771885.europe-west1.run.app',
        relay: 'wss://arnacon-phone-relay-309305771885.europe-west1.run.app',
        status: 'waiting',
        useScanQrCode: false,
      };
      emit('pairing-status', offer);
      setTimeout(() => {
        controller.localId = controller.localId || 'preview.arnacon';
        emit('pairing-status', { ...offer, status: 'paired', localId: controller.localId, identityKind: 'arnacon' });
        emit('pairing-ready', { localId: controller.localId, identityKind: 'arnacon', room: offer.room });
        emit('identity-change', { localId: controller.localId, identityKind: 'arnacon' });
      }, 40);
      return offer;
    },
    stopBrowserPairing() {
      const idle = { room: '', pairingUri: '', relay: '', status: 'idle', useScanQrCode: false };
      emit('pairing-status', idle);
      return idle;
    },
    getBrowserPairing() {
      return {
        room: 'PREVW1',
        pairingUri: 'arnacon://browser-relay?room=PREVW1&relay=wss://arnacon-phone-relay-309305771885.europe-west1.run.app',
        relay: 'wss://arnacon-phone-relay-309305771885.europe-west1.run.app',
        status: 'idle',
        useScanQrCode: false,
      };
    },
    downloadFile() {},
    receiveData(raw) {
      try {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const eventName = msg?.action || msg?.event;
        if (eventName) emit(eventName, msg.body || msg);
      } catch {
        /* native may send non-JSON; preview ignores it */
      }
    },
  };
  return controller;
}
