import { createMockController } from '../preview/mock-controller.mjs';
import { installBrowserPairing } from './browser-pairing.mjs';

function pageHash() {
  return String(location.hash || '').replace(/^#/, '');
}

function localIdFromLocation() {
  const hash = new URLSearchParams(pageHash());
  const query = new URLSearchParams(location.search);
  return hash.get('localId') || query.get('localId') || '';
}

function hasNativeBridge() {
  if (window.AndroidBridge && typeof window.AndroidBridge.processAction === 'function') return true;
  const wk = window.webkit && window.webkit.messageHandlers;
  return Boolean(wk && (wk.controller || wk.arnacon || wk.native));
}

function nativeSend(payload) {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (window.AndroidBridge && typeof window.AndroidBridge.processAction === 'function') {
    window.AndroidBridge.processAction(json);
    return true;
  }
  const wk = window.webkit && window.webkit.messageHandlers;
  const handler = wk && (wk.controller || wk.arnacon || wk.native);
  if (handler && typeof handler.postMessage === 'function') {
    handler.postMessage(json);
    return true;
  }
  return false;
}

async function createController(localId) {
  if (hasNativeBridge()) {
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/arnacon-controller@1.8.0/dist/index.mjs');
      const controller = new mod.Controller({
        localId,
        send: (payload) => { nativeSend(payload); },
      });
      return installBrowserPairing(controller, { native: true });
    } catch (err) {
      console.warn('[arnacon-host] SDK import failed, using mock', err);
    }
  }
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/arnacon-controller@1.8.0/dist/index.mjs');
    let pairingSend = () => {};
    const controller = new mod.Controller({
      localId,
      send: (payload) => pairingSend(payload),
    });
    return installBrowserPairing(controller, {
      mock: false,
      bindSend: (fn) => { pairingSend = fn; },
    });
  } catch (err) {
    console.warn('[arnacon-host] SDK import failed, using mock pairing', err);
  }
  return createMockController();
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
  for (const key of ['localId', 'identityKind', 'sessionId', 'remoteId', 'sessionName', 'from', 'to', 'videoCall']) {
    const value = extra[key];
    if (value !== undefined && value !== '' && value !== false) params.set(key, String(value));
  }
  return params.toString();
}

export async function bootHost() {
  const localId = localIdFromLocation();
  const controller = await createController(localId);
  if (localId) controller.localId = localId;
  window.controller = controller;
  window.top.controller = controller;

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
