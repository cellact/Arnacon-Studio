import { cssForTheme } from './theme.mjs';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function has(compiled, method) {
  return compiled.methods.includes(method);
}

function hasScreen(compiled, name) {
  return compiled.screens.includes(name);
}

const PAGE_BOOT = `function pageParams() {
  const preview = (window.top && window.top.__studioPreview) || {};
  const hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const get = (k, d) => {
    if (preview[k] !== undefined && preview[k] !== '' && preview[k] !== null) return preview[k];
    const raw = hash.get(k);
    const q = query.get(k);
    const v = (raw !== null && raw !== '') ? raw : q;
    if (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') {
      return d === undefined ? '' : d;
    }
    return v;
  };
  const videoRaw = get('videoCall', false);
  return {
    screen: get('screen', 'MAIN'),
    localId: get('localId', '') || '',
    identityKind: get('identityKind', 'arnacon'),
    sessionId: get('sessionId', ''),
    remoteId: get('remoteId', ''),
    sessionName: get('sessionName', ''),
    videoCall: videoRaw === true || videoRaw === 'true',
    from: get('from', ''),
    to: get('to', ''),
    callId: get('callId', '')
  };
}
function requireController() {
  if (!controller) {
    document.body.innerHTML = '<p class="banner">This app must run inside the Arnacon client (or studio preview).</p>';
    throw new Error('missing controller');
  }
}
function navigate(screen, extra) {
  const payload = { action: 'arnacon-navigate', screen: screen, extra: extra || {} };
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*');
  }
}
function eventBody(data) {
  if (data && data.body && typeof data.body === 'object') return data.body;
  return data || {};
}
function eventMessage(data) {
  const body = eventBody(data);
  return body.message || body;
}
function messageText(msg) {
  if (!msg) return '';
  if (typeof msg.content === 'string') return msg.content;
  return msg.body || msg.text || '';
}
function isMine(msg) {
  if (!msg) return false;
  if (typeof msg.outgoing === 'boolean') return msg.outgoing;
  const author = msg.author || '';
  const local = pageParams().localId || '';
  return !!local && author === local && author !== 'SYSTEM';
}
function sessionPreview(session) {
  return (session && (session.lastMessageContent || session.lastMessage)) || '';
}
function callPeerId(params) {
  const p = params || pageParams();
  return p.callId || p.from || p.to || p.remoteId || p.sessionId || '';
}
`;

function htmlPage(title, body, script) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="app.css">
</head>
<body>
${body}
<script>
const controller = window.top.controller;
${PAGE_BOOT}
${script}
</script>
</body>
</html>
`;
}

function appCss(compiled) {
  return cssForTheme(compiled.spec?.theme);
}

function identityJs() {
  return `const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
function canonicalizeGsmInput(rawInput) {
  return String(rawInput || '').replace(/[\\s\\-]/g, '').replace(/^\\+/, '');
}
function validateInput(rawInput, provider) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return 'Enter a value.';
  if (provider === 'email') return EMAIL_PATTERN.test(trimmed) ? null : 'Enter a valid email address.';
  if (provider === 'temp' || provider === 'ens') return /\\s/.test(trimmed) ? 'Value cannot contain whitespace.' : null;
  if (provider === 'gsm') {
    const digits = canonicalizeGsmInput(trimmed);
    return /^[0-9]{7,15}$/.test(digits) ? null : 'Use international format with country code, no leading "+".';
  }
  return 'Unknown provider.';
}
function canonicalizeRemote(rawInput, provider) {
  if (provider === 'gsm') return canonicalizeGsmInput(rawInput);
  return String(rawInput || '').trim();
}
`;
}

function hasVideo(compiled) {
  return !!(compiled.spec.capabilities?.communication?.calls?.video);
}

function appHtml(compiled) {
  const name = compiled.spec.app?.name || 'Arnacon';
  const video = hasVideo(compiled);
  const screensJson = JSON.stringify(compiled.screens);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${esc(name)}</title>
  <link rel="stylesheet" href="app.css">
</head>
<body>
<iframe id="screenFrame" title="screen"></iframe>
<script>
const controller = window.top.controller;
${PAGE_BOOT}
const SCREENS = ${screensJson};
const HAS_VIDEO = ${video ? 'true' : 'false'};
function fileFor(screen, extra) {
  const files = { MAIN: 'mainscreen.html', CHAT: 'chat.html' };
${hasScreen(compiled, 'NEW_CHAT') ? "  files.NEW_CHAT = 'newchat.html';" : ''}
${hasScreen(compiled, 'CREATE_GROUP') ? "  files.CREATE_GROUP = 'creategroup.html';" : ''}
${hasScreen(compiled, 'RING') ? "  files.RING = 'ringing.html';" : ''}
${hasScreen(compiled, 'INCOMING') ? "  files.INCOMING = 'incomingcall.html';" : ''}
${hasScreen(compiled, 'PAIRING') ? "  files.PAIRING = 'pairing.html';" : ''}
${hasScreen(compiled, 'DIALER') ? "  files.DIALER = 'dialer.html';" : ''}
${hasScreen(compiled, 'IDENTITIES') ? "  files.IDENTITIES = 'identities.html';" : ''}
${hasScreen(compiled, 'CALL') ? "  files.CALL = (HAS_VIDEO && extra && extra.videoCall) ? 'videocall.html' : 'voicecall.html';" : ''}
  return files[screen] || files.MAIN;
}
function buildQuery(screen, extra) {
  const p = pageParams();
  const next = new URLSearchParams();
  next.set('screen', screen);
  if (p.localId) next.set('localId', p.localId);
  if (p.identityKind) next.set('identityKind', p.identityKind);
  const merged = Object.assign({}, extra);
  for (const key of ['sessionId', 'remoteId', 'sessionName', 'from', 'to', 'callId', 'videoCall']) {
    const value = merged[key] !== undefined ? merged[key] : p[key];
    if (value !== undefined && value !== '' && value !== false) next.set(key, String(value));
  }
  return next.toString();
}
function loadScreen(screen, extra) {
  const dest = SCREENS.indexOf(screen) >= 0 ? screen : 'MAIN';
  document.getElementById('screenFrame').src = fileFor(dest, extra) + '?' + buildQuery(dest, extra);
}
requireController();
const bootParams = pageParams();
let bootScreen = bootParams.screen || 'MAIN';
if (!bootParams.localId && SCREENS.indexOf('PAIRING') >= 0 && (!bootScreen || bootScreen === 'MAIN')) {
  bootScreen = 'PAIRING';
}
loadScreen(bootScreen, bootParams);
window.addEventListener('message', function (event) {
  if (event.data && event.data.action === 'arnacon-navigate') {
    loadScreen(event.data.screen, event.data.extra || {});
  }
});
${has(compiled, 'on') && compiled.events.includes('identity-change') ? `
controller.on('identity-change', function (data) {
  const body = eventBody(data);
  const next = pageParams();
  if (body.localId) next.localId = body.localId;
  if (body.identityKind) next.identityKind = body.identityKind;
  const params = new URLSearchParams(location.search);
  if (next.localId) params.set('localId', next.localId);
  if (next.identityKind) params.set('identityKind', next.identityKind);
  history.replaceState({}, '', location.pathname + '?' + params.toString() + location.hash);
  loadScreen('MAIN', next);
});
` : ''}
${compiled.events.includes('receiving-call') ? `
controller.on('receiving-call', function (data) {
  const body = eventBody(data);
  loadScreen('INCOMING', {
    from: body.from || body.remoteId || '',
    callId: body.callId || body.from || '',
    sessionName: body.sessionName || '',
    sessionId: body.sessionId || '',
    videoCall: !!body.videoCall
  });
});
` : ''}
${compiled.events.includes('ringing') ? `
controller.on('ringing', function (data) {
  const body = eventBody(data);
  loadScreen('RING', {
    to: body.to || body.callId || '',
    callId: body.callId || body.to || '',
    sessionId: body.sessionId || '',
    sessionName: body.sessionName || '',
    videoCall: !!body.videoCall
  });
});
` : ''}
${compiled.events.includes('call-started') ? `
controller.on('call-started', function (data) {
  const body = eventBody(data);
  loadScreen('CALL', {
    to: body.to || body.remoteId || body.from || '',
    callId: body.callId || body.from || body.to || '',
    sessionId: body.sessionId || '',
    sessionName: body.sessionName || '',
    videoCall: !!body.videoCall
  });
});
` : ''}
${compiled.events.includes('call-ended') ? `
controller.on('call-ended', function () { loadScreen('MAIN', pageParams()); });
` : ''}
${compiled.events.includes('error') ? `
controller.on('error', function () {});
` : ''}
</script>
</body>
</html>
`;
}

function mainscreenHtml(compiled) {
  const name = compiled.spec.app?.name || 'Arnacon';
  const newChat = hasScreen(compiled, 'NEW_CHAT');
  const group = hasScreen(compiled, 'CREATE_GROUP');
  const pairing = hasScreen(compiled, 'PAIRING');
  const dialer = hasScreen(compiled, 'DIALER');
  const identities = hasScreen(compiled, 'IDENTITIES');
  const canDelete = has(compiled, 'deleteSession');
  const hasSessions = has(compiled, 'getRecentSessions');
  return htmlPage(name, `
<div class="column">
  <div class="topbar">
    <h1>${esc(name)}</h1>
    ${identities ? '<button class="icon-btn" id="idBtn" type="button">Identity</button>' : ''}
    ${pairing ? '<button class="icon-btn" id="pairBtn" type="button">Pair</button>' : ''}
    ${dialer ? '<button class="icon-btn" id="dialBtn" type="button">Dial</button>' : ''}
    ${group ? '<button class="icon-btn" id="groupBtn" type="button">Group</button>' : ''}
    ${newChat ? '<button class="btn primary" id="newBtn" type="button">New</button>' : ''}
  </div>
  ${hasSessions ? '<ul class="list" id="sessions"></ul><p class="empty" id="empty">No conversations yet.</p>' : '<p class="banner" id="empty">This app uses the installed product. Native owns identity; this UI does not invent a backend.</p>'}
</div>
`, `
requireController();
const params = pageParams();
${hasSessions ? `
const list = document.getElementById('sessions');
const empty = document.getElementById('empty');
async function render() {
  const result = await controller.getRecentSessions(20);
  const sessions = (result && result.sessions) ? result.sessions : [];
  list.innerHTML = '';
  empty.style.display = sessions.length ? 'none' : 'block';
  sessions.forEach(function (session) {
    const li = document.createElement('li');
    li.className = 'row';
    const title = session.sessionName || session.remoteId || ('Session ' + session.sessionId);
    li.innerHTML = '<div><div>' + title + '</div><div class="meta">' + sessionPreview(session) + '</div></div>';
    li.addEventListener('click', function () {
      navigate('CHAT', {
        sessionId: session.sessionId,
        sessionName: title,
        remoteId: session.remoteId || ''
      });
    });
    ${canDelete ? `
    li.addEventListener('contextmenu', function (event) {
      event.preventDefault();
      if (confirm('Delete this conversation?')) controller.deleteSession(session.sessionId);
    });
    ` : ''}
    list.appendChild(li);
  });
}
render();
controller.on('new-message', function () { render(); });
${compiled.events.includes('message-updated') ? `controller.on('message-updated', function () { render(); });` : ''}
` : ''}
${newChat ? `document.getElementById('newBtn').addEventListener('click', function () { navigate('NEW_CHAT'); });` : ''}
${group ? `document.getElementById('groupBtn').addEventListener('click', function () { navigate('CREATE_GROUP'); });` : ''}
${pairing ? `document.getElementById('pairBtn').addEventListener('click', function () { navigate('PAIRING'); });` : ''}
${dialer ? `document.getElementById('dialBtn').addEventListener('click', function () { navigate('DIALER'); });` : ''}
${identities ? `document.getElementById('idBtn').addEventListener('click', function () { navigate('IDENTITIES'); });` : ''}
`);
}

function identitiesHtml(compiled) {
  const canQr = has(compiled, 'scanQrCode');
  return htmlPage('Identity', `
<div class="column">
  <div class="topbar">
    <button class="icon-btn" id="backBtn" type="button">Back</button>
    <h1>Identity</h1>
  </div>
  <p class="banner">The active identity is injected by native. Switching products needs listIdentities / switchIdentity on the controller — those methods are not available yet.</p>
  <div class="panel">
    <p class="hint" id="kind"></p>
    <p id="local"></p>
  </div>
  ${canQr ? '<div class="panel"><button class="btn primary" id="qrBtn" type="button">Scan QR</button><p class="hint" id="qrOut"></p></div>' : ''}
</div>
`, `
requireController();
const params = pageParams();
function showIdentity() {
  document.getElementById('kind').textContent = params.identityKind || 'arnacon';
  document.getElementById('local').textContent = params.localId || 'Waiting for native to inject localId.';
}
showIdentity();
document.getElementById('backBtn').addEventListener('click', function () { navigate('MAIN'); });
controller.on('identity-change', function (data) {
  const body = eventBody(data);
  if (body.identityKind) params.identityKind = body.identityKind;
  if (body.localId) params.localId = body.localId;
  showIdentity();
});
${canQr ? `
document.getElementById('qrBtn').addEventListener('click', async function () {
  const result = await controller.scanQrCode();
  const out = document.getElementById('qrOut');
  out.textContent = (result && result.qrContent) ? result.qrContent : '';
});
` : ''}
`);
}

function chatHtml(compiled) {
  const gate = compiled.gates.whatsappOmitsCalls;
  const voice = has(compiled, 'callSession');
  const video = has(compiled, 'videoCallSession');
  const parts = [];
  parts.push(`
<div class="column">
  <div class="topbar">
    <button class="icon-btn" id="backBtn" type="button">Back</button>
    <h1 id="title">Chat</h1>
`);
  if (has(compiled, 'setBlocked')) {
    parts.push('<button class="icon-btn" id="blockBtn" type="button">Block</button>');
  }
  if (voice) parts.push('<button class="icon-btn" id="callBtn" type="button">Call</button>');
  if (video) parts.push('<button class="icon-btn" id="videoBtn" type="button">Video</button>');
  parts.push(`</div>
  <div class="messages" id="messages"></div>
  <div class="composer">`);
  if (has(compiled, 'imagePicker') || has(compiled, 'camera')) {
    parts.push('<button class="icon-btn" id="attachBtn" type="button">+</button>');
  }
  parts.push(`<input id="input" type="text" placeholder="Message" autocomplete="off">
    <button class="btn primary" id="sendBtn" type="button">Send</button>
  </div>
</div>
`);
  const script = `
requireController();
const params = pageParams();
document.getElementById('title').textContent = params.sessionName || params.remoteId || 'Chat';
let sessionId = params.sessionId;
const messagesEl = document.getElementById('messages');
${gate ? `function isWhatsApp() { return params.identityKind === 'whatsapp'; }` : ''}
function appendBubble(text, mine) {
  const div = document.createElement('div');
  div.className = 'bubble' + (mine ? ' mine' : '');
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
async function ensureSession() {
  ${has(compiled, 'getSessionId') ? `
  if (!sessionId && params.remoteId) {
    const resolved = await controller.getSessionId(params.remoteId);
    if (resolved && resolved.sessionId) sessionId = resolved.sessionId;
  }
  ` : ''}
  ${has(compiled, 'getSessionName') ? `
  if (sessionId && !params.sessionName) {
    const named = await controller.getSessionName(sessionId);
    if (named && named.sessionName) document.getElementById('title').textContent = named.sessionName;
  }
  ` : ''}
}
async function loadHistory() {
  await ensureSession();
  if (!sessionId) return;
  const result = await controller.getMessages(sessionId, 50, null, true);
  const messages = (result && result.messages) ? result.messages : [];
  messagesEl.innerHTML = '';
  messages.forEach(function (msg) {
    appendBubble(messageText(msg), isMine(msg));
  });
  ${has(compiled, 'markRead') ? `controller.markRead(sessionId);` : ''}
  ${has(compiled, 'updateSessionTimestamp') ? `controller.updateSessionTimestamp(sessionId);` : ''}
}
loadHistory();
document.getElementById('backBtn').addEventListener('click', function () { navigate('MAIN'); });
async function sendText(text) {
  await ensureSession();
  ${has(compiled, 'createSession') ? `
  if (!sessionId && params.remoteId) {
    const created = await controller.createSession(params.remoteId, params.sessionName || params.remoteId);
    if (created && created.sessionId) sessionId = created.sessionId;
  }
  ` : ''}
  if (!sessionId) return;
  controller.sendMessage(String(sessionId), text);
}
document.getElementById('sendBtn').addEventListener('click', async function () {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendBubble(text, true);
  await sendText(text);
});
document.getElementById('input').addEventListener('keydown', function (event) {
  if (event.key === 'Enter') document.getElementById('sendBtn').click();
});
controller.on('new-message', function (data) {
  const msg = eventMessage(data);
  if (!msg) return;
  if (sessionId && String(msg.sessionId) !== String(sessionId)) return;
  if (isMine(msg)) return;
  appendBubble(messageText(msg), false);
});
${compiled.events.includes('message-updated') ? `controller.on('message-updated', function () { loadHistory(); });` : ''}
${compiled.events.includes('message-reaction') ? `controller.on('message-reaction', function () { loadHistory(); });` : ''}
${has(compiled, 'sendChatstate') ? `
const input = document.getElementById('input');
input.addEventListener('input', function () {
  if (sessionId) controller.sendChatstate(sessionId, 'composing');
});
` : ''}
${compiled.events.includes('chatstate') ? `
controller.on('chatstate', function (data) {
  const body = eventBody(data);
  if (body.kind === 'composing' || body.state === 'composing') document.getElementById('title').dataset.typing = '1';
});
` : ''}
${has(compiled, 'sendReplyMessage') ? `function replyTo(id, text) { controller.sendReplyMessage(sessionId || params.remoteId, text, id, !!sessionId); }` : ''}
${has(compiled, 'sendEditMessage') ? `function editMessage(id, text) { controller.sendEditMessage(id, text); }` : ''}
${has(compiled, 'deleteMessage') ? `function removeMessage(id) { controller.deleteMessage(id); }` : ''}
${has(compiled, 'forwardMessage') ? `function forwardMessage(id, target) { controller.forwardMessage(id, target); }` : ''}
${has(compiled, 'sendReaction') ? `function react(id, emoji) { controller.sendReaction(sessionId, id, emoji || ''); }` : ''}
${has(compiled, 'pingReachability') ? `if (params.remoteId) controller.pingReachability(params.remoteId);` : ''}
${has(compiled, 'getBlockStatus') ? `if (sessionId) controller.getBlockStatus(sessionId);` : ''}
${has(compiled, 'setBlocked') ? `
document.getElementById('blockBtn').addEventListener('click', function () {
  if (sessionId) controller.setBlocked(sessionId, true);
});
controller.on('block-status', function () {});
controller.on('block-result', function () {});
` : ''}
${has(compiled, 'fetchBlocklist') ? `controller.fetchBlocklist();` : ''}
${has(compiled, 'imagePicker') || has(compiled, 'camera') ? `
document.getElementById('attachBtn').addEventListener('click', async function () {
  ${has(compiled, 'imagePicker') ? `const picked = await controller.imagePicker();
  const body = eventBody(picked);
  const fileId = body.imageId || body.fileId;
  if (sessionId && fileId) controller.sendFileMessage(sessionId, fileId, body.caption || '');` : 'controller.camera();'}
});
` : ''}
${compiled.events.includes('image-picker-result') && has(compiled, 'sendFileMessage') ? `
controller.on('image-picker-result', function (data) {
  const body = eventBody(data);
  const fileId = body.imageId || body.fileId;
  if (sessionId && fileId) controller.sendFileMessage(sessionId, fileId, body.caption || '');
});
` : ''}
${has(compiled, 'downloadFile') ? `function saveFile(messageId, fileId) { controller.downloadFile(messageId, fileId); }` : ''}
${has(compiled, 'setSessionName') ? `function renameSession(name) { if (sessionId) controller.setSessionName(sessionId, name); }` : ''}
${voice ? `
document.getElementById('callBtn').addEventListener('click', function () {
  ${gate ? 'if (isWhatsApp()) return;' : ''}
  if (sessionId) controller.callSession(sessionId);
  else if (params.remoteId) controller.callRemote(params.remoteId);
  navigate('RING', { to: params.remoteId, sessionId: sessionId, sessionName: params.sessionName, callId: params.remoteId || sessionId, videoCall: false });
});
` : ''}
${video ? `
document.getElementById('videoBtn').addEventListener('click', function () {
  ${gate ? 'if (isWhatsApp()) return;' : ''}
  if (sessionId) controller.videoCallSession(sessionId);
  else if (params.remoteId) controller.videoCallRemote(params.remoteId);
  navigate('RING', { to: params.remoteId, sessionId: sessionId, sessionName: params.sessionName, callId: params.remoteId || sessionId, videoCall: true });
});
` : ''}
${gate && (voice || video) ? `
if (isWhatsApp()) {
  const callBtn = document.getElementById('callBtn');
  const videoBtn = document.getElementById('videoBtn');
  if (callBtn) callBtn.style.display = 'none';
  if (videoBtn) videoBtn.style.display = 'none';
}
` : ''}
`;
  return htmlPage(compiled.spec.app?.name || 'Chat', parts.join('\n'), script);
}

function newchatHtml(compiled) {
  const providers = Object.keys(compiled.addressingUi);
  const fallback = providers[0] || 'temp';
  const options = providers.map((p) => {
    const ui = compiled.addressingUi[p];
    return `<option value="${esc(p)}">${esc(ui.label)}</option>`;
  }).join('');
  const picker = has(compiled, 'contactPicker');
  return htmlPage('New chat', `
<div class="column">
  <div class="topbar">
    <button class="icon-btn" id="backBtn" type="button">Back</button>
    <h1>New chat</h1>
  </div>
  <div class="panel">
    ${providers.length > 1 ? `<select class="field" id="provider">${options}</select>` : `<input type="hidden" id="provider" value="${esc(fallback)}">`}
    <input class="field" id="remote" placeholder="${esc(compiled.addressingUi[fallback]?.placeholder || 'Recipient')}">
    <p class="hint" id="help">${esc(compiled.addressingUi[fallback]?.help || '')}</p>
    <p class="error" id="error"></p>
    <div style="display:flex;gap:8px;margin-top:16px;">
      ${picker ? '<button class="icon-btn" id="contactsBtn" type="button">Contacts</button>' : ''}
      <button class="btn primary" id="startBtn" type="button">Start chat</button>
    </div>
  </div>
</div>
<script src="identity.js"><\/script>
`, `
requireController();
const params = pageParams();
const providerEl = document.getElementById('provider');
const remote = document.getElementById('remote');
const help = document.getElementById('help');
const error = document.getElementById('error');
const ui = ${JSON.stringify(compiled.addressingUi)};
function currentProvider() { return providerEl.value || '${fallback}'; }
function refreshHelp() {
  const cfg = ui[currentProvider()] || {};
  remote.placeholder = cfg.placeholder || '';
  remote.inputMode = cfg.inputMode || 'text';
  help.textContent = cfg.help || '';
}
if (providerEl.tagName === 'SELECT') providerEl.addEventListener('change', refreshHelp);
refreshHelp();
document.getElementById('backBtn').addEventListener('click', function () { navigate('MAIN'); });
document.getElementById('startBtn').addEventListener('click', async function () {
  const provider = currentProvider();
  const raw = remote.value;
  const err = validateInput(raw, provider);
  error.textContent = err || '';
  if (err) return;
  const remoteId = canonicalizeRemote(raw, provider);
  const result = await controller.createSession(remoteId, remoteId);
  navigate('CHAT', {
    sessionId: result && result.sessionId,
    remoteId: (result && result.remoteId) || remoteId,
    sessionName: (result && result.sessionName) || remoteId
  });
});
${picker ? `
const contactsBtn = document.getElementById('contactsBtn');
function syncPicker() {
  contactsBtn.hidden = params.identityKind !== 'email' && currentProvider() !== 'email';
}
syncPicker();
contactsBtn.addEventListener('click', async function () {
  const res = await controller.contactPicker(1);
  const value = (res && res.injectRemoteId) ? String(res.injectRemoteId).trim() : '';
  if (value) remote.value = value;
});
${compiled.events.includes('inject-remote-id') ? `
controller.on('inject-remote-id', function (data) {
  const body = eventBody(data);
  if (body.injectRemoteId) remote.value = String(body.injectRemoteId);
});
` : ''}
` : ''}
`);
}

function creategroupHtml(compiled) {
  return htmlPage('New group', `
<div class="column">
  <div class="topbar">
    <button class="icon-btn" id="backBtn" type="button">Back</button>
    <h1>New group</h1>
  </div>
  <div class="panel">
    <input class="field" id="name" placeholder="Group name">
    <input class="field" id="description" placeholder="Description" style="margin-top:10px">
    <input class="field" id="participant" placeholder="Add participant" style="margin-top:10px">
    <button class="icon-btn" id="addBtn" type="button" style="margin-top:10px">Add</button>
    <ul class="list" id="people"></ul>
    <button class="btn primary" id="createBtn" type="button" style="margin-top:16px">Create group</button>
  </div>
</div>
`, `
requireController();
const people = [];
const list = document.getElementById('people');
function render() {
  list.innerHTML = people.map(function (p) { return '<li class="row"><div>' + p + '</div></li>'; }).join('');
}
document.getElementById('backBtn').addEventListener('click', function () { navigate('MAIN'); });
document.getElementById('addBtn').addEventListener('click', function () {
  const value = document.getElementById('participant').value.trim();
  if (!value) return;
  people.push(value);
  document.getElementById('participant').value = '';
  render();
});
document.getElementById('createBtn').addEventListener('click', function () {
  controller.createGroup({
    name: document.getElementById('name').value.trim(),
    description: document.getElementById('description').value.trim(),
    participants: people
  });
  navigate('MAIN');
});
`);
}

function callHtml(compiled, { video }) {
  const title = video ? 'Video call' : 'Voice call';
  const fileControls = [];
  if (has(compiled, 'setMute')) fileControls.push('<button class="icon-btn" id="muteBtn" type="button">Mute</button>');
  if (has(compiled, 'setHold')) fileControls.push('<button class="icon-btn" id="holdBtn" type="button">Hold</button>');
  if (video && has(compiled, 'switchCamera')) fileControls.push('<button class="icon-btn" id="camBtn" type="button">Flip</button>');
  if (has(compiled, 'changeAudioDevice')) fileControls.push('<button class="icon-btn" id="audioBtn" type="button">Audio</button>');
  if (has(compiled, 'sendDtmf')) fileControls.push('<button class="icon-btn" id="dtmfBtn" type="button">#</button>');
  if (has(compiled, 'transferCall')) fileControls.push('<button class="icon-btn" id="xferBtn" type="button">Transfer</button>');
  fileControls.push('<button class="btn danger" id="endBtn" type="button">End</button>');
  return htmlPage(title, `
<div class="call-stage">
  <div>
    <p>${esc(title)}</p>
    <h2 id="peer">Calling</h2>
    ${video ? '<div id="videoStage"><video id="remoteVideo" autoplay playsinline muted></video><div id="localVideoContainer"><video id="localVideo" autoplay playsinline muted></video></div></div>' : ''}
  </div>
  <div class="call-actions">${fileControls.join('')}</div>
</div>
`, `
requireController();
${whatsappCallGuard(compiled)}
${callHelpers(compiled)}
const params = pageParams();
document.getElementById('peer').textContent = params.sessionName || params.to || params.remoteId || 'Call';
${video ? `
const bc = window.top.browserCall;
if (bc && typeof bc.setVideoElements === 'function') {
  bc.setVideoElements({
    remote: document.getElementById('remoteVideo'),
    local: document.getElementById('localVideo')
  });
}
` : ''}
${has(compiled, 'rejectCall') || has(compiled, 'endCall') ? `document.getElementById('endBtn').addEventListener('click', function () { hangUp(); navigate('MAIN'); });` : ''}
${has(compiled, 'setMute') ? `let muted = false;
document.getElementById('muteBtn').addEventListener('click', function () {
  muted = !muted;
  setCallMuted(muted);
});
controller.on('mute-state', function (data) {
  const body = eventBody(data);
  if (typeof body.mute === 'boolean') muted = body.mute;
});` : ''}
${has(compiled, 'setHold') ? `let held = false;
document.getElementById('holdBtn').addEventListener('click', function () {
  held = !held;
  if (controller.setHold) controller.setHold(callPeerId(params), held);
});
controller.on('local-hold-state', function () {});
controller.on('active-calls', function () {});` : ''}
${video && has(compiled, 'switchCamera') ? `document.getElementById('camBtn').addEventListener('click', function () { flipCamera(); });` : ''}
${has(compiled, 'changeAudioDevice') ? `
document.getElementById('audioBtn').addEventListener('click', async function () {
  const result = await controller.getAudioDevices();
  const devices = (result && result.audioDevices) ? result.audioDevices : result;
  let deviceId = Array.isArray(devices) ? devices[0] : (devices && Object.keys(devices)[0]);
  if (deviceId !== undefined) controller.changeAudioDevice(callPeerId(params), deviceId);
});
` : ''}
${has(compiled, 'sendDtmf') ? `document.getElementById('dtmfBtn').addEventListener('click', function () { controller.sendDtmf(callPeerId(params), '#'); });` : ''}
${has(compiled, 'transferCall') ? `document.getElementById('xferBtn').addEventListener('click', function () { controller.transferCall(callPeerId(params), params.remoteId); });` : ''}
${compiled.events.includes('connecting') ? `controller.on('connecting', function () {});` : ''}
${compiled.events.includes('call-connected') ? `controller.on('call-connected', function () {});` : ''}
${compiled.events.includes('call-ended') ? `controller.on('call-ended', function () { navigate('MAIN'); });` : ''}
${video && compiled.events.includes('video-frame') ? `controller.on('video-frame', function () {});` : ''}
${video && compiled.events.includes('webrtc-disconnected') ? `controller.on('webrtc-disconnected', function () { navigate('MAIN'); });` : ''}
`);
}

function whatsappCallGuard(compiled) {
  if (!compiled.gates.whatsappOmitsCalls) return '';
  return `
function isWhatsApp() { return pageParams().identityKind === 'whatsapp'; }
if (isWhatsApp()) { navigate('MAIN'); }
`;
}

function callHelpers(compiled) {
  const mute = has(compiled, 'setMute');
  const camera = has(compiled, 'switchCamera');
  return `
function hangUp(callId) {
  const id = callId || callPeerId();
  const bc = window.top.browserCall;
  if (bc && typeof bc.close === 'function') bc.close();
  ${has(compiled, 'rejectCall') ? 'controller.rejectCall(id);' : has(compiled, 'endCall') ? 'controller.endCall(id);' : ''}
}
function acceptIncoming(callId, videoCall) {
  const id = callId || callPeerId();
  const bc = window.top.browserCall;
  if (bc && typeof bc.accept === 'function') bc.accept(id, { video: !!videoCall });
  ${has(compiled, 'acceptCall') ? 'else controller.acceptCall(id);' : ''}
}
${mute ? `function setCallMuted(muted) {
  const id = callPeerId();
  controller.setMute(id, !!muted);
  const bc = window.top.browserCall;
  if (bc && typeof bc.setMuted === 'function') bc.setMuted(!!muted);
}` : ''}
${camera ? `async function flipCamera() {
  const bc = window.top.browserCall;
  if (bc && typeof bc.switchCamera === 'function') {
    await bc.switchCamera();
    return;
  }
  controller.switchCamera(callPeerId());
}` : ''}
`;
}

function ringingHtml(compiled) {
  return htmlPage('Ringing', `
<div class="call-stage">
  <div>
    <p>Ringing</p>
    <h2 id="peer">Calling</h2>
  </div>
  <div class="call-actions">
    <button class="btn danger" id="endBtn" type="button">Cancel</button>
  </div>
</div>
`, `
requireController();
${whatsappCallGuard(compiled)}
${callHelpers(compiled)}
const params = pageParams();
document.getElementById('peer').textContent = params.sessionName || params.to || 'Call';
document.getElementById('endBtn').addEventListener('click', function () {
  hangUp();
  navigate('MAIN');
});
${compiled.events.includes('call-started') ? `controller.on('call-started', function () {});` : ''}
${compiled.events.includes('ringing') ? `controller.on('ringing', function () {});` : ''}
${compiled.events.includes('call-ended') ? `controller.on('call-ended', function () { navigate('MAIN'); });` : ''}
`);
}

function incomingHtml(compiled) {
  return htmlPage('Incoming call', `
<div class="call-stage">
  <div>
    <p>Incoming call</p>
    <h2 id="peer">Caller</h2>
  </div>
  <div class="call-actions">
    <button class="btn danger" id="rejectBtn" type="button">Decline</button>
    <button class="btn ok" id="acceptBtn" type="button">Accept</button>
  </div>
</div>
`, `
requireController();
${whatsappCallGuard(compiled)}
${callHelpers(compiled)}
const params = pageParams();
document.getElementById('peer').textContent = params.sessionName || params.from || 'Incoming';
document.getElementById('acceptBtn').addEventListener('click', function () {
  acceptIncoming(params.from || params.callId, params.videoCall);
  navigate('CALL', { to: params.from, callId: params.callId || params.from, sessionId: params.sessionId, sessionName: params.sessionName, videoCall: params.videoCall });
});
document.getElementById('rejectBtn').addEventListener('click', function () {
  hangUp(params.from || params.callId);
  navigate('MAIN');
});
${compiled.events.includes('call-ended') ? `controller.on('call-ended', function () { navigate('MAIN'); });` : ''}
${compiled.events.includes('call-answered-elsewhere') ? `controller.on('call-answered-elsewhere', function () { navigate('MAIN'); });` : ''}
`);
}

function pairingHtml() {
  return htmlPage('Pair phone', `
<div class="column">
  <div class="topbar">
    <button class="icon-btn" id="backBtn" type="button">Back</button>
    <h1>Pair phone</h1>
  </div>
  <p class="banner">The computer tab creates a room on the controller. The phone scans that QR. This page does not open a WebSocket.</p>
  <div class="panel">
    <p class="hint" id="status">Idle</p>
    <p id="uri"></p>
    <button class="btn primary" id="startBtn" type="button">Start pairing</button>
    <button class="btn" id="stopBtn" type="button" style="margin-top:8px">Unlink</button>
    <button class="btn" id="scanBtn" type="button" style="margin-top:8px">Scan QR on this phone</button>
    <p class="hint" id="qrOut"></p>
  </div>
</div>
`, `
requireController();
function payload(data) { return eventBody(data); }
function show(offer) {
  const status = document.getElementById('status');
  const uri = document.getElementById('uri');
  if (!offer) return;
  status.textContent = offer.status || '';
  uri.textContent = offer.pairingUri || offer.room || '';
}
document.getElementById('backBtn').addEventListener('click', function () { navigate('MAIN'); });
async function beginPairing() {
  const offer = await controller.startBrowserPairing();
  show(offer);
  document.getElementById('scanBtn').hidden = !(offer && offer.useScanQrCode);
  return offer;
}
document.getElementById('startBtn').addEventListener('click', function () { beginPairing(); });
document.getElementById('stopBtn').addEventListener('click', function () {
  show(controller.stopBrowserPairing());
});
document.getElementById('scanBtn').addEventListener('click', async function () {
  const result = await controller.scanQrCode();
  document.getElementById('qrOut').textContent = (result && result.qrContent) ? result.qrContent : '';
});
if (controller.getBrowserPairing) show(controller.getBrowserPairing());
beginPairing();
controller.on('pairing-status', function (data) { show(payload(data)); });
controller.on('pairing-ready', function (data) {
  const body = payload(data);
  document.getElementById('status').textContent = 'paired ' + (body.localId || '');
  navigate('MAIN', { localId: body.localId, identityKind: body.identityKind || 'arnacon' });
});
`);
}

function dialerHtml(compiled) {
  return htmlPage('Dialer', `
<div class="column">
  <div class="topbar">
    <button class="icon-btn" id="backBtn" type="button">Back</button>
    <h1>Dialer</h1>
  </div>
  <div class="panel">
    <input class="field" id="number" placeholder="Remote id">
    <button class="btn primary" id="callBtn" type="button" style="margin-top:16px">Call</button>
  </div>
</div>
`, `
requireController();
${whatsappCallGuard(compiled)}
document.getElementById('backBtn').addEventListener('click', function () { navigate('MAIN'); });
document.getElementById('callBtn').addEventListener('click', function () {
  const remoteId = document.getElementById('number').value.trim();
  if (!remoteId) return;
  ${has(compiled, 'callRemote') ? 'controller.callRemote(remoteId);' : ''}
  navigate('RING', { to: remoteId });
});
`);
}

function slugFor(compiled) {
  const name = compiled.spec.app?.name || 'arnacon-app';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arnacon-app';
}

/**
 * @returns {Record<string, string>}
 */
export function generateFiles(compiled) {
  const files = {
    'app.css': appCss(compiled),
    'identity.js': identityJs(),
    'controller.mjs': `/** Re-export. Native WebView injects window.top.controller; this module is for browser tooling. */\nexport * from 'https://cdn.jsdelivr.net/npm/arnacon-controller@1.8.0/dist/index.mjs';\n`,
    'app.html': appHtml(compiled),
    'mainscreen.html': mainscreenHtml(compiled),
    'spec.json': JSON.stringify(compiled.spec, null, 2) + '\n',
    'bindings.json': JSON.stringify({
      packs: compiled.packs,
      nativeGaps: compiled.nativeGaps,
      screens: compiled.screens,
      methods: compiled.methods,
      events: compiled.events,
      gates: compiled.gates,
      warnings: compiled.warnings,
    }, null, 2) + '\n',
  };

  if (hasScreen(compiled, 'CHAT')) files['chat.html'] = chatHtml(compiled);
  if (hasScreen(compiled, 'IDENTITIES')) files['identities.html'] = identitiesHtml(compiled);
  if (hasScreen(compiled, 'NEW_CHAT')) files['newchat.html'] = newchatHtml(compiled);
  if (hasScreen(compiled, 'CREATE_GROUP')) files['creategroup.html'] = creategroupHtml(compiled);
  if (hasScreen(compiled, 'CALL')) {
    files['voicecall.html'] = callHtml(compiled, { video: false });
    if (hasVideo(compiled)) files['videocall.html'] = callHtml(compiled, { video: true });
  }
  if (hasScreen(compiled, 'RING')) files['ringing.html'] = ringingHtml(compiled);
  if (hasScreen(compiled, 'INCOMING')) files['incomingcall.html'] = incomingHtml(compiled);
  if (hasScreen(compiled, 'PAIRING')) files['pairing.html'] = pairingHtml();
  if (hasScreen(compiled, 'DIALER')) files['dialer.html'] = dialerHtml(compiled);
  return files;
}

export { slugFor, cssForTheme };
