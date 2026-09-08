/**
 * Browser-relay pairing on window.top.controller.
 * The skin never opens a WebSocket. This module owns the WSS room, QR payload,
 * pairing token, and (once paired) forwards controller send/receive over the relay.
 *
 * Computer tab: startBrowserPairing() → show pairingUri → phone scans.
 * Phone WebView: startBrowserPairing() returns useScanQrCode; skin calls scanQrCode().
 */

export const DEFAULT_RELAY_WSS = 'wss://arnacon-phone-relay-309305771885.europe-west1.run.app';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_KEY = 'arnacon.pairingToken';
const ROOM_KEY = 'arnacon.pairingRoom';

function emitOn(controller, action, body) {
  if (typeof controller.receiveData === 'function') {
    controller.receiveData(JSON.stringify({ action, body }));
    return;
  }
  if (typeof controller._emit === 'function') {
    controller._emit(action, body);
  }
}

function newRoomCode() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ROOM_ALPHABET.charAt(Math.floor(Math.random() * ROOM_ALPHABET.length));
  }
  return out;
}

function relayHost(relayWss) {
  return String(relayWss || DEFAULT_RELAY_WSS).replace(/\/$/, '');
}

export function pairingUriFor(room, relayWss) {
  const host = relayHost(relayWss);
  let url = 'arnacon://browser-relay?room=' + encodeURIComponent(room);
  if (host) url += '&relay=' + encodeURIComponent(host);
  return url;
}

function browserWsUrl(room, relayWss) {
  return `${relayHost(relayWss)}/${room}?role=browser`;
}

function persist(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

function read(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function attachNativeScanPairing(controller) {
  const snapshot = {
    room: '',
    pairingUri: '',
    relay: '',
    status: 'scan',
    useScanQrCode: true,
  };
  controller.startBrowserPairing = async () => ({ ...snapshot });
  controller.stopBrowserPairing = () => {};
  controller.getBrowserPairing = () => ({ ...snapshot });
}

function attachBrowserRelayPairing(controller, options) {
  const relayWss = options.relayWss || DEFAULT_RELAY_WSS;
  const mock = !!options.mock;
  let socket = null;
  let status = 'idle';
  let room = read(ROOM_KEY);
  let sendBuffer = [];
  let keepaliveTimer = null;

  function clearKeepalive() {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }

  function startKeepalive(ws) {
    clearKeepalive();
    keepaliveTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ action: 'ws-ping', body: {} }));
      } catch {
        /* closed */
      }
    }, 15000);
  }

  function snapshot() {
    return {
      room,
      pairingUri: room ? pairingUriFor(room, relayWss) : '',
      relay: relayHost(relayWss),
      status,
      useScanQrCode: false,
    };
  }

  function setStatus(next, extra = {}) {
    status = next;
    emitOn(controller, 'pairing-status', { ...snapshot(), ...extra });
  }

  function sendPayload(payload) {
    const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(json);
      return true;
    }
    sendBuffer.push(json);
    return false;
  }

  controller._pairingSend = sendPayload;
  if (typeof options.bindSend === 'function') {
    options.bindSend(sendPayload);
  } else if (typeof controller.send !== 'function') {
    controller.send = sendPayload;
  }

  function flushBuffer() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    for (const json of sendBuffer) socket.send(json);
    sendBuffer = [];
  }

  function closeSocket() {
    clearKeepalive();
    if (!socket) return;
    const ws = socket;
    socket = null;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'unlink');
      }
    } catch {
      /* already closed */
    }
  }

  function connect(nextRoom) {
    room = nextRoom;
    persist(ROOM_KEY, room);
    setStatus('connecting');
    if (mock) {
      setStatus('waiting');
      const offer = snapshot();
      setTimeout(() => {
        controller.localId = controller.localId || 'preview.arnacon';
        setStatus('paired', { localId: controller.localId, identityKind: 'arnacon' });
        emitOn(controller, 'pairing-ready', {
          localId: controller.localId,
          identityKind: 'arnacon',
          room,
        });
        emitOn(controller, 'identity-change', {
          localId: controller.localId,
          identityKind: 'arnacon',
        });
      }, 40);
      return offer;
    }

    closeSocket();
    const url = browserWsUrl(room, relayWss);
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) return;
      setStatus('waiting');
      startKeepalive(ws);
      const token = read(TOKEN_KEY);
      if (token) sendPayload({ action: 'hello', body: { token } });
      flushBuffer();
    };
    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      try {
        const data = JSON.parse(raw);
        if (data.action === 'ws-pong') return;
        if (data.action === 'pairing-token' && data.body && data.body.token) {
          persist(TOKEN_KEY, data.body.token);
          sendPayload({ action: 'hello', body: { token: data.body.token } });
          return;
        }
        if (data.action === 'connection-established') {
          const localId = data.body && data.body.localId;
          const identityKind = (data.body && data.body.identityKind) || 'arnacon';
          if (localId) controller.localId = localId;
          setStatus('paired', { localId: controller.localId, identityKind });
          emitOn(controller, 'pairing-ready', {
            localId: controller.localId,
            identityKind,
            room,
          });
          emitOn(controller, 'identity-change', {
            localId: controller.localId,
            identityKind,
          });
        }
      } catch {
        /* non-JSON frames still go to receiveData */
      }
      if (typeof controller.receiveData === 'function') {
        controller.receiveData(raw);
      }
    };
    ws.onerror = () => setStatus('error', { detail: 'relay connection failed' });
    ws.onclose = () => {
      if (socket === ws) socket = null;
      if (status !== 'idle') setStatus('disconnected');
    };
    return snapshot();
  }

  controller.startBrowserPairing = async function startBrowserPairing() {
    const next = room || newRoomCode();
    return connect(next);
  };

  controller.stopBrowserPairing = function stopBrowserPairing() {
    persist(TOKEN_KEY, '');
    persist(ROOM_KEY, '');
    room = '';
    closeSocket();
    setStatus('idle');
    return snapshot();
  };

  controller.getBrowserPairing = function getBrowserPairing() {
    return snapshot();
  };
}

/**
 * @param {object} controller
 * @param {{ native?: boolean, mock?: boolean, relayWss?: string }} [options]
 */
export function installBrowserPairing(controller, options = {}) {
  if (!controller) return controller;
  if (options.native) {
    attachNativeScanPairing(controller);
    return controller;
  }
  attachBrowserRelayPairing(controller, options);
  return controller;
}
