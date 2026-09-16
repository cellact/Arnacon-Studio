import { installArnaconWebApp } from './runtime.mjs';

function pageHash() {
  return String(location.hash || '').replace(/^#/, '');
}

async function exists(path) {
  try {
    const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

async function findSkinEntry() {
  for (const path of ['/skin/app.html', '/skin/index.html', '/skin/mainscreen.html']) {
    if (await exists(path)) return path;
  }
  return '/skin/app.html';
}

const SCREEN_FILES = {
  MAIN: '/skin/mainscreen.html',
  CHAT: '/skin/chat.html',
  NEW_CHAT: '/skin/newchat.html',
  CREATE_GROUP: '/skin/creategroup.html',
  CALL: '/skin/voicecall.html',
  RING: '/skin/ringing.html',
  INCOMING: '/skin/incomingcall.html',
  DIALER: '/skin/dialer.html',
  PAIRING: '/skin/pairing.html',
  IDENTITIES: '/skin/identities.html',
};

function hashFor(screen, extra = {}) {
  const params = new URLSearchParams(pageHash());
  params.set('screen', screen || params.get('screen') || 'MAIN');
  for (const key of ['localId', 'identityKind', 'sessionId', 'remoteId', 'sessionName', 'from', 'to', 'callId', 'videoCall']) {
    const value = extra[key];
    if (value !== undefined && value !== '' && value !== false) params.set(key, String(value));
  }
  return params.toString();
}

export async function bootHost() {
  const controller = await installArnaconWebApp();
  if (typeof controller.endCall !== 'function' && typeof controller.rejectCall === 'function') {
    controller.endCall = function endCall(id) {
      const bc = window.top.browserCall;
      if (bc && typeof bc.close === 'function') bc.close();
      controller.rejectCall(id);
    };
  }
  const iframe = document.getElementById('skin');
  const entry = await findSkinEntry();
  const usesAppShell = entry.endsWith('/app.html');

  function load(path, screen, extra) {
    iframe.src = `${path}#${hashFor(screen, extra)}`;
  }

  load(entry, new URLSearchParams(pageHash()).get('screen') || 'MAIN', {});

  window.addEventListener('message', async (event) => {
    if (!event.data || event.data.action !== 'arnacon-navigate') return;
    if (usesAppShell) return;
    const screen = event.data.screen || 'MAIN';
    const extra = event.data.extra || {};
    const dest = SCREEN_FILES[screen];
    if (dest && await exists(dest)) {
      load(dest, screen, extra);
      return;
    }
    load(entry, screen, extra);
  });
}
