/**
 * In-process controller with SDK field names. Used by gold-path tests.
 * Not a network mock of native.
 */

export function createMockController(options = {}) {
  const localId = options.localId === undefined ? '' : options.localId;
  const sent = [];
  const pairing = {
    room: 'GOLD01',
    pairingUri: 'arnacon://browser-relay?room=GOLD01',
    status: localId ? 'paired' : 'waiting',
    useScanQrCode: false,
  };

  const sessions = [
    {
      sessionId: '42',
      sessionName: 'Ada',
      lastMessageContent: 'hello',
      unreadCount: 0,
      isGroup: false,
    },
  ];

  const messages = [
    {
      messageId: 'm1',
      content: 'hello',
      author: 'ada',
      time: 1,
      status: 6,
    },
  ];

  const controller = {
    localId,
    sent,
    pairing,
    async getRecentSessions(limit) {
      void limit;
      return { sessions: sessions.map((s) => ({ ...s })) };
    },
    async getMessages(sessionId, count, before, inclusive) {
      void count;
      void before;
      void inclusive;
      if (!sessionId) throw new Error('getMessages requires sessionId');
      return { messages: messages.map((m) => ({ ...m })) };
    },
    async sendMessage(sessionId, text) {
      if (arguments.length !== 2) {
        throw new Error('sendMessage requires sessionId and text');
      }
      if (sessionId == null || sessionId === '') {
        throw new Error('sendMessage sessionId is missing');
      }
      if (typeof text !== 'string') {
        throw new Error('sendMessage text must be a string');
      }
      const row = { sessionId: String(sessionId), text };
      sent.push(row);
      return row;
    },
    async startBrowserPairing() {
      return { ...pairing };
    },
    async stopBrowserPairing() {
      pairing.status = 'idle';
      return { ...pairing };
    },
    on() {},
    off() {},
  };

  return controller;
}
