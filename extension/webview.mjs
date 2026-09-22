import { installArnaconWebApp } from '../host/runtime.mjs';

const app = document.getElementById('app');
let controller;
let browserCall = null;
let identityKind = 'arnacon';
let currentView = 'pairing';
let currentSession = null;
let encodeQr = null;
// Audio only: the sidebar never requests a camera or places a video call.
let call = null;
let callMuted = false;

function eventBody(data) {
  return data && data.body && typeof data.body === 'object' ? data.body : (data || {});
}

function messageFrom(data) {
  const body = eventBody(data);
  return body.message || body;
}

function messageText(message) {
  return typeof message?.content === 'string'
    ? message.content
    : (message?.body || message?.text || '');
}

function isMine(message) {
  if (typeof message?.outgoing === 'boolean') return message.outgoing;
  return !!controller.localId && message?.author === controller.localId;
}

function button(label, onClick, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function showError(error) {
  const element = document.getElementById('status');
  if (element) element.textContent = error.message || String(error);
}

function renderShell() {
  app.replaceChildren();
  const header = document.createElement('header');
  const title = document.createElement('strong');
  title.textContent = 'Arnacon';
  header.append(
    title,
    button('Chats', () => renderSessions()),
    button('Products', () => renderIdentities()),
    button('Pair', () => renderPairing()),
  );
  const callBar = document.createElement('div');
  callBar.id = 'callbar';
  callBar.hidden = true;
  const content = document.createElement('section');
  content.id = 'content';
  app.append(header, callBar, content);
}

function canCall() {
  return identityKind !== 'whatsapp';
}

function callPeerLabel() {
  return call?.peerName || call?.callId || 'Call';
}

function renderCallBar() {
  const bar = document.getElementById('callbar');
  if (!bar) return;
  bar.replaceChildren();
  bar.hidden = !call;
  if (!call) return;

  const peer = document.createElement('strong');
  peer.textContent = callPeerLabel();
  const state = document.createElement('span');
  state.id = 'callstate';
  state.textContent = {
    incoming: 'Incoming call',
    outgoing: 'Calling…',
    active: 'Connected',
  }[call.state] || '';
  const details = document.createElement('div');
  details.append(peer, state);

  const actions = document.createElement('div');
  actions.className = 'actions';
  if (call.state === 'incoming') {
    actions.append(
      button('Accept', () => acceptCall(), 'primary'),
      button('Decline', () => hangUp(), 'danger'),
    );
  } else {
    actions.append(
      button(callMuted ? 'Unmute' : 'Mute', () => toggleMute()),
      button('Hang up', () => hangUp(), 'danger'),
    );
  }
  bar.append(details, actions);
}

function setCall(next) {
  call = next;
  if (!next) callMuted = false;
  renderCallBar();
}

function callError(message) {
  const state = document.getElementById('callstate');
  if (state) state.textContent = message;
}

/**
 * Fail before signaling when the webview cannot reach a microphone, so the
 * phone is never left ringing an unanswerable leg.
 */
async function ensureMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('this webview has no microphone access');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

async function startCall(session) {
  setCall({
    callId: session.sessionId,
    peerName: session.sessionName || session.remoteId || '',
    state: 'outgoing',
  });
  try {
    await ensureMicrophone();
    controller.callSession(session.sessionId);
  } catch (error) {
    callError(`Microphone unavailable: ${error.message}`);
  }
}

async function acceptCall() {
  const id = call?.callId;
  if (!id) return;
  try {
    await ensureMicrophone();
  } catch (error) {
    callError(`Microphone unavailable: ${error.message}`);
    return;
  }
  if (!call) return;
  if (browserCall) browserCall.accept(id, { video: false });
  else controller.acceptCall(id);
  setCall({ ...call, state: 'active' });
}

function hangUp() {
  const id = call?.callId;
  if (browserCall) browserCall.close();
  if (id) controller.rejectCall(id);
  setCall(null);
}

function toggleMute() {
  callMuted = !callMuted;
  if (call?.callId) controller.setMute(call.callId, callMuted);
  if (browserCall) browserCall.setMuted(callMuted);
  renderCallBar();
}

function content() {
  const element = document.getElementById('content');
  element.replaceChildren();
  return element;
}

async function drawQr(canvas, pairingUri) {
  if (!pairingUri) {
    canvas.hidden = true;
    return;
  }
  if (!encodeQr) ({ encode: encodeQr } = await import('../skin/vendor/uqr.mjs'));
  let encoded;
  try {
    encoded = encodeQr(pairingUri, { ecc: 'H', border: 2 });
  } catch {
    encoded = encodeQr(pairingUri, { ecc: 'M', border: 2 });
  }
  const scale = Math.max(2, Math.ceil(240 / encoded.size));
  canvas.width = encoded.size * scale;
  canvas.height = encoded.size * scale;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111';
  for (let y = 0; y < encoded.size; y += 1) {
    for (let x = 0; x < encoded.size; x += 1) {
      if (encoded.data[y][x]) context.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  canvas.hidden = false;
}

async function renderPairing() {
  currentView = 'pairing';
  currentSession = null;
  const root = content();
  const heading = document.createElement('h2');
  heading.textContent = 'Pair your phone';
  const status = document.createElement('p');
  status.id = 'status';
  status.className = 'muted';
  const canvas = document.createElement('canvas');
  canvas.className = 'qr';
  const uri = document.createElement('p');
  uri.className = 'pairing-uri';
  const actions = document.createElement('div');
  actions.className = 'actions';

  async function show(offer) {
    status.textContent = offer?.status || 'idle';
    uri.textContent = offer?.pairingUri || '';
    await drawQr(canvas, offer?.pairingUri || '');
  }

  actions.append(
    button('Start pairing', async () => show(await controller.startBrowserPairing()), 'primary'),
    button('Unlink', () => show(controller.stopBrowserPairing())),
  );
  root.append(heading, status, canvas, uri, actions);
  await show(await controller.startBrowserPairing());
}

function appendMessage(container, message) {
  const bubble = document.createElement('div');
  bubble.className = isMine(message) ? 'bubble mine' : 'bubble';
  bubble.textContent = messageText(message);
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

async function renderChat(session) {
  currentView = 'chat';
  currentSession = session;
  const root = content();
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const title = document.createElement('h2');
  title.textContent = session.sessionName || session.remoteId || 'Chat';
  toolbar.append(button('Back', () => renderSessions()), title);
  if (canCall()) toolbar.append(button('Call', () => startCall(session)));

  const messages = document.createElement('div');
  messages.className = 'messages';
  const composer = document.createElement('form');
  composer.className = 'composer';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Message';
  const send = button('Send', () => {}, 'primary');
  send.type = 'submit';
  composer.append(input, send);
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    controller.sendMessage(String(session.sessionId), text);
    appendMessage(messages, { content: text, author: controller.localId });
  });
  root.append(toolbar, messages, composer);

  try {
    const result = await controller.getMessages(session.sessionId, 50, null, true);
    for (const message of result?.messages || []) appendMessage(messages, message);
    controller.markRead(session.sessionId);
  } catch (error) {
    showError(error);
  }
}

async function renderSessions() {
  currentView = 'sessions';
  currentSession = null;
  const root = content();
  const heading = document.createElement('h2');
  heading.textContent = 'Chats';
  const status = document.createElement('p');
  status.id = 'status';
  status.className = 'muted';
  status.textContent = 'Loading…';
  const list = document.createElement('div');
  list.className = 'list';
  root.append(heading, status, list);

  try {
    const result = await controller.getRecentSessions(20);
    const sessions = result?.sessions || [];
    status.textContent = sessions.length ? '' : 'No conversations yet.';
    for (const session of sessions) {
      const row = button('', () => renderChat(session), 'row');
      const name = document.createElement('strong');
      name.textContent = session.sessionName || session.remoteId || `Session ${session.sessionId}`;
      const preview = document.createElement('span');
      preview.textContent = session.lastMessageContent || '';
      row.append(name, preview);
      list.appendChild(row);
    }
  } catch (error) {
    showError(error);
  }
}

async function renderIdentities() {
  currentView = 'identities';
  currentSession = null;
  const root = content();
  const heading = document.createElement('h2');
  heading.textContent = 'Installed products';
  const status = document.createElement('p');
  status.id = 'status';
  status.className = 'muted';
  status.textContent = 'Loading…';
  const list = document.createElement('div');
  list.className = 'list';
  root.append(heading, status, list);

  try {
    const result = await controller.listIdentities();
    const identities = result.identities || [];
    status.textContent = identities.length ? '' : 'No installed products returned by the phone.';
    for (const identity of identities) {
      const row = document.createElement('div');
      row.className = 'identity';
      const details = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = identity.label || identity.localId || 'Installed product';
      const localId = document.createElement('span');
      localId.textContent = identity.localId || '';
      details.append(name, localId);
      const select = button(identity.selected ? 'Active' : 'Switch', async () => {
        select.disabled = true;
        status.textContent = 'Switching…';
        try {
          await controller.switchIdentity(identity);
          await renderSessions();
        } catch (error) {
          select.disabled = false;
          showError(error);
        }
      }, identity.selected ? 'primary' : '');
      select.disabled = !!identity.selected;
      row.append(details, select);
      list.appendChild(row);
    }
  } catch (error) {
    showError(error);
  }
}

try {
  controller = await installArnaconWebApp();
  browserCall = window.browserCall || null;
  renderShell();
  controller.on('pairing-status', (data) => {
    if (currentView !== 'pairing') return;
    const status = document.getElementById('status');
    if (status) status.textContent = eventBody(data).status || '';
  });
  controller.on('pairing-ready', (data) => {
    identityKind = eventBody(data).identityKind || identityKind;
    renderSessions();
  });
  controller.on('identity-change', (data) => {
    identityKind = eventBody(data).identityKind || identityKind;
    renderSessions();
  });

  controller.on('receiving-call', (data) => {
    const body = eventBody(data);
    if (!canCall() || body.videoCall) return;
    setCall({
      callId: body.callId || body.from || '',
      peerName: body.sessionName || body.from || '',
      state: 'incoming',
    });
  });
  controller.on('ringing', (data) => {
    const body = eventBody(data);
    if (!call) return;
    setCall({ ...call, callId: body.callId || body.to || call.callId, state: 'outgoing' });
  });
  controller.on('call-started', (data) => {
    const body = eventBody(data);
    setCall({
      callId: body.callId || body.from || body.to || call?.callId || '',
      peerName: body.sessionName || call?.peerName || '',
      state: 'active',
    });
  });
  controller.on('call-connected', () => {
    if (call) setCall({ ...call, state: 'active' });
  });
  controller.on('mute-state', (data) => {
    const body = eventBody(data);
    if (typeof body.mute === 'boolean') {
      callMuted = body.mute;
      renderCallBar();
    }
  });
  controller.on('call-ended', () => setCall(null));
  controller.on('call-answered-elsewhere', () => setCall(null));
  controller.on('new-message', (data) => {
    const message = messageFrom(data);
    if (
      currentView === 'chat'
      && currentSession
      && String(message.sessionId) === String(currentSession.sessionId)
      && !isMine(message)
    ) {
      appendMessage(document.querySelector('.messages'), message);
    } else if (currentView === 'sessions') {
      renderSessions();
    }
  });
  controller.on('message-updated', () => {
    if (currentView === 'chat' && currentSession) renderChat(currentSession);
  });

  if (controller.localId) await renderSessions();
  else await renderPairing();
} catch (error) {
  app.textContent = `Arnacon could not start: ${error.message}`;
}
