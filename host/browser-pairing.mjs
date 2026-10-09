/**
 * Browser-relay pairing on window.top.controller.
 * The skin never opens a WebSocket. This module owns the WSS room, QR payload,
 * pairing token, and (once paired) forwards controller send/receive over the relay.
 *
 * Computer tab: startBrowserPairing() → show pairingUri → phone scans.
 * Phone WebView: startBrowserPairing() returns useScanQrCode; skin calls scanQrCode().
 */

// The proxy pins a room to one backend relay and is the only host the phone
// accepts in a pairing QR. Talking to a backend directly makes scans a no-op.
export const DEFAULT_RELAY_WSS = 'wss://arnacon-phone-relay-proxy-zmu4vmardq-ew.a.run.app';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEEPALIVE_MS = 15000;
const KEEPALIVE_TIMEOUT_MS = 60000;
const HELLO_RETRY_MS = 4000;
const TOKEN_RACE_MS = 600;
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
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let lastPongAt = 0;
  let stayConnected = false;
  let sessionReady = false;
  let serverStopped = false;
  let helloInFlight = null;
  let helloRetryTimer = null;
  let pairingTokenIgnoreTimer = null;

  function clearKeepalive() {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearHelloRetry() {
    if (helloRetryTimer) {
      clearInterval(helloRetryTimer);
      helloRetryTimer = null;
    }
  }

  function clearPairingTokenIgnore() {
    if (pairingTokenIgnoreTimer) {
      clearTimeout(pairingTokenIgnoreTimer);
      pairingTokenIgnoreTimer = null;
    }
  }

  function sendHello(ws, token) {
    if (!token || !ws || ws.readyState !== WebSocket.OPEN) return;
    helloInFlight = token;
    try {
      ws.send(JSON.stringify({ action: 'hello', body: { token } }));
    } catch {
      /* closed */
    }
  }

  function acceptPairingToken(token, ws) {
    if (!token) return;
    helloInFlight = token;
    persist(TOKEN_KEY, token);
    sendHello(ws, token);
  }

  function startKeepalive(ws) {
    lastPongAt = Date.now();
    clearKeepalive();
    keepaliveTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastPongAt > KEEPALIVE_TIMEOUT_MS) {
        // Half-open socket: the relay stopped answering. Drop it so onclose reconnects.
        try {
          ws.close(4000, 'keepalive-timeout');
        } catch {
          /* already closed */
        }
        return;
      }
      try {
        ws.send(JSON.stringify({ action: 'ws-ping', body: {} }));
      } catch {
        /* closed */
      }
    }, KEEPALIVE_MS);
  }

  function scheduleReconnect() {
    if (!stayConnected || !room) return;
    if (serverStopped && !read(TOKEN_KEY)) return;
    clearReconnect();
    reconnectAttempt += 1;
    const delay = reconnectAttempt === 1
      ? 400
      : Math.min(8000, 400 * Math.pow(1.5, reconnectAttempt - 1));
    reconnectTimer = setTimeout(() => connect(room, { reconnect: true }), delay);
  }

  function handleSocketClosed(reason) {
    clearKeepalive();
    // A signaling flap must not end the call. The phone's call-ended message
    // tears the media down; this socket only reconnects.
    if (reason === 'server-shutdown') {
      if (read(TOKEN_KEY)) {
        stayConnected = true;
        serverStopped = false;
        if (sessionReady) {
          setStatus('disconnected', {
            detail: 'Waiting for your phone…',
            localId: controller.localId,
          });
        }
        scheduleReconnect();
        return;
      }
      sessionReady = false;
      stayConnected = false;
      serverStopped = true;
      setStatus('error', { detail: 'Phone stopped the session.' });
      return;
    }
    if (stayConnected) {
      if (sessionReady) {
        setStatus('disconnected', {
          detail: 'Waiting for your phone…',
          localId: controller.localId,
        });
      } else if (status !== 'idle') {
        setStatus('disconnected');
      }
      scheduleReconnect();
    }
  }

  function startFreshRoom(detail) {
    clearPairingTokenIgnore();
    clearHelloRetry();
    helloInFlight = null;
    sessionReady = false;
    persist(TOKEN_KEY, '');
    controller.localId = '';
    connect(newRoomCode(), { detail });
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
    clearHelloRetry();
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

  function connect(nextRoom, options = {}) {
    room = nextRoom;
    persist(ROOM_KEY, room);
    stayConnected = true;
    serverStopped = false;
    clearReconnect();
    const quiet = !!(options.reconnect && sessionReady);
    const detail = options.detail ? { detail: options.detail } : {};
    if (!quiet) setStatus('connecting', detail);
    if (mock) {
      setStatus('waiting');
      const offer = snapshot();
      setTimeout(() => {
        controller.localId = controller.localId || 'preview.arnacon';
        sessionReady = true;
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
      // A socket that dies before pairing-token or connection-established
      // must keep backing off. Those two signals reset reconnectAttempt.
      if (!quiet) setStatus('waiting', detail);
      startKeepalive(ws);
      helloInFlight = read(TOKEN_KEY) || null;
      clearPairingTokenIgnore();
      clearHelloRetry();
      const token = read(TOKEN_KEY);
      if (token) {
        sendHello(ws, token);
        helloRetryTimer = setInterval(() => {
          if (socket !== ws || sessionReady || ws.readyState !== WebSocket.OPEN) {
            clearHelloRetry();
            return;
          }
          sendHello(ws, read(TOKEN_KEY));
        }, HELLO_RETRY_MS);
      }
      flushBuffer();
    };
    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      lastPongAt = Date.now();
      try {
        const data = JSON.parse(raw);
        if (data.action === 'ws-pong') return;
        if (data.action === 'pairing-token' && data.body && data.body.token) {
          const incoming = String(data.body.token);
          reconnectAttempt = 0;
          // Phone re-announce can overwrite a hello already in flight.
          // Wait briefly for hello-rejected; only then accept the new token.
          if (helloInFlight && helloInFlight !== incoming) {
            clearPairingTokenIgnore();
            pairingTokenIgnoreTimer = setTimeout(() => {
              pairingTokenIgnoreTimer = null;
              if (socket !== ws || !helloInFlight || helloInFlight === incoming) return;
              acceptPairingToken(incoming, ws);
            }, TOKEN_RACE_MS);
            return;
          }
          acceptPairingToken(incoming, ws);
          return;
        }
        if (data.action === 'hello-rejected') {
          // Remembered token does not match this room. Keep the room so the
          // phone can still find this tab. A new QR only happens if the user unlinks.
          setStatus('error', {
            detail: 'Phone did not accept this computer. Open Arnacon or link a different phone.',
            localId: controller.localId,
          });
          return;
        }
        if (data.action === 'pairing-taken') {
          startFreshRoom('This room was paired by another tab. New QR ready.');
          return;
        }
        if (data.action === 'server-shutdown' && !read(TOKEN_KEY)) {
          serverStopped = true;
          stayConnected = false;
        }
        if (data.action === 'connection-established') {
          reconnectAttempt = 0;
          clearHelloRetry();
          sessionReady = true;
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
    ws.onerror = () => {
      if (sessionReady && stayConnected) return;
      setStatus('error', { detail: 'relay connection failed' });
    };
    ws.onclose = (event) => {
      if (socket !== ws) return;
      socket = null;
      const reason = serverStopped || (event && event.reason === 'server-shutdown')
        ? 'server-shutdown'
        : ((event && event.reason) || 'closed');
      handleSocketClosed(reason);
    };
    return snapshot();
  }

  controller.startBrowserPairing = async function startBrowserPairing() {
    const next = room || newRoomCode();
    return connect(next);
  };

  controller.stopBrowserPairing = function stopBrowserPairing() {
    stayConnected = false;
    serverStopped = true;
    sessionReady = false;
    helloInFlight = null;
    clearReconnect();
    clearHelloRetry();
    clearPairingTokenIgnore();
    reconnectAttempt = 0;
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
