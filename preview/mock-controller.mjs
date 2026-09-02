/** In-memory controller for studio preview. Not used in generated production apps. */

export function createMockController() {
  const listeners = new Map();
  const sessions = [
    { sessionId: 101, sessionName: 'Alex', remoteId: 'alex', lastMessage: 'See you at 6.' },
    { sessionId: 102, sessionName: 'Sam', remoteId: 'sam', lastMessage: 'Sent the photos.' },
  ];
  const messages = {
    101: [
      { body: 'See you at 6.', outgoing: false },
      { body: 'On my way.', outgoing: true },
    ],
    102: [{ body: 'Sent the photos.', outgoing: false }],
  };
  let nextId = 200;

  function emit(event, body) {
    for (const fn of listeners.get(event) || []) fn({ body });
  }

  const controller = {
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
      return { messages: [...(messages[sessionId] || [])] };
    },
    async createSession(remoteId, sessionName) {
      const sessionId = nextId++;
      sessions.unshift({ sessionId, sessionName: sessionName || remoteId, remoteId, lastMessage: '' });
      messages[sessionId] = [];
      return { sessionId, remoteId, sessionName: sessionName || remoteId };
    },
    createGroup(groupData) {
      const sessionId = nextId++;
      sessions.unshift({
        sessionId,
        sessionName: groupData.name || 'Group',
        remoteId: '',
        lastMessage: '',
      });
      messages[sessionId] = [];
    },
    deleteSession(sessionId) {
      const i = sessions.findIndex((s) => s.sessionId === sessionId);
      if (i >= 0) sessions.splice(i, 1);
    },
    async getSessionId() { return { sessionId: sessions[0]?.sessionId }; },
    async getSessionName(sessionId) {
      const s = sessions.find((x) => x.sessionId === sessionId);
      return { sessionName: s?.sessionName || '' };
    },
    setSessionName(sessionId, name) {
      const s = sessions.find((x) => x.sessionId === sessionId);
      if (s) s.sessionName = name;
    },
    updateSessionTimestamp() {},
    sendMessage(target, text, isSession) {
      const sessionId = isSession ? target : sessions[0]?.sessionId;
      if (!messages[sessionId]) messages[sessionId] = [];
      messages[sessionId].push({ body: text, outgoing: true });
    },
    sendReplyMessage(_t, text) { controller.sendMessage(_t, text, true); },
    sendEditMessage() {},
    sendFileMessage(sessionId, _fileId, caption) {
      controller.sendMessage(sessionId, caption || 'Photo', true);
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
    callSession() { emit('ringing', {}); },
    callRemote() { emit('ringing', {}); },
    videoCallSession() { emit('ringing', { videoCall: true }); },
    videoCallRemote() { emit('ringing', { videoCall: true }); },
    acceptCall() { emit('call-started', {}); },
    rejectCall() { emit('call-ended', {}); },
    endCall() { emit('call-ended', {}); },
    setMute() {},
    setHold() {},
    transferCall() {},
    sendDtmf() {},
    switchCamera() {},
    async getAudioDevices() { return ['speaker']; },
    changeAudioDevice() {},
    camera() {},
    imagePicker() { emit('image-picker-result', { fileId: 'preview', caption: '' }); },
    async contactPicker() { return { injectRemoteId: 'customer@example.com' }; },
    scanQrCode() { return { text: '' }; },
    downloadFile() {},
  };
  return controller;
}
