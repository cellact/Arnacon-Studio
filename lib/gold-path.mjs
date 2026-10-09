/**
 * Gold path against a controller: SDK session/message fields and sendMessage arity.
 */

export async function runGoldPath(controller) {
  const errors = [];
  const fail = (message) => errors.push({ file: 'gold-path', message });

  const listed = await controller.getRecentSessions(20);
  const session = listed && listed.sessions && listed.sessions[0];
  if (!session) {
    fail('getRecentSessions must return { sessions } with at least one row');
  } else {
    if (!('lastMessageContent' in session)) {
      fail('session preview field is lastMessageContent, not lastMessage');
    }
    if (!session.sessionId) fail('session.sessionId is required');
  }

  const sessionId = session ? session.sessionId : '42';
  const history = await controller.getMessages(sessionId, 50, null, true);
  const msg = history && history.messages && history.messages[0];
  if (!msg) {
    fail('getMessages must return { messages } with at least one row');
  } else {
    if (!('content' in msg)) fail('message body field is content');
    if (!('author' in msg)) fail('message author field is author');
  }

  try {
    await controller.sendMessage(String(sessionId), 'hi');
  } catch (err) {
    fail(`sendMessage(sessionId, text) must succeed: ${err.message}`);
  }

  let arityRejected = false;
  try {
    await controller.sendMessage('hi');
  } catch {
    arityRejected = true;
  }
  if (!arityRejected) {
    fail('sendMessage with one argument must fail');
  }

  if (!controller.localId) {
    const offer = await controller.startBrowserPairing();
    if (!offer || (!offer.pairingUri && !offer.useScanQrCode)) {
      fail('empty localId must start pairing (pairingUri or useScanQrCode)');
    }
  }

  return { ok: errors.length === 0, errors };
}
