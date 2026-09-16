import { installBrowserCall } from './browser-call.mjs';
import { installBrowserPairing } from './browser-pairing.mjs';

const CONTROLLER_SDK =
  'https://cdn.jsdelivr.net/npm/arnacon-controller@1.8.0/dist/index.mjs';

function locationLocalId() {
  const hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  return hash.get('localId') || query.get('localId') || '';
}

function topController() {
  try {
    return window.top.controller;
  } catch {
    return window.controller;
  }
}

function expose(name, value) {
  window[name] = value;
  try {
    window.top[name] = value;
  } catch {
    /* Cross-origin editor frames can only use the local window. */
  }
}

export function hasNativeBridge() {
  if (window.AndroidBridge && typeof window.AndroidBridge.processAction === 'function') {
    return true;
  }
  const handlers = window.webkit && window.webkit.messageHandlers;
  return Boolean(handlers && (handlers.controller || handlers.arnacon || handlers.native));
}

function sendToNative(payload) {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (window.AndroidBridge && typeof window.AndroidBridge.processAction === 'function') {
    window.AndroidBridge.processAction(json);
    return;
  }
  const handlers = window.webkit && window.webkit.messageHandlers;
  const handler = handlers && (handlers.controller || handlers.arnacon || handlers.native);
  if (handler && typeof handler.postMessage === 'function') {
    handler.postMessage(json);
    return;
  }
  throw new Error('Arnacon native bridge is unavailable');
}

/**
 * Install Arnacon on a Ploy/Base44 page hosted at its own origin.
 *
 * Native WebView: controller traffic goes directly to the installed product.
 * Browser: controller traffic goes through browser pairing and the phone relay.
 *
 * @param {{ localId?: string, relayWss?: string, sdkUrl?: string }} options
 * @returns {Promise<object>} window.top.controller
 */
export async function installArnaconWebApp(options = {}) {
  const existing = topController();
  if (existing) return existing;

  const native = hasNativeBridge();
  const localId = options.localId || locationLocalId();
  const sdk = await import(options.sdkUrl || CONTROLLER_SDK);
  let bindRelaySend = () => {};

  const controller = new sdk.Controller({
    localId,
    send: native
      ? (payload) => sendToNative(payload)
      : (payload) => bindRelaySend(payload),
  });

  installBrowserPairing(controller, native
    ? { native: true }
    : {
        relayWss: options.relayWss,
        bindSend: (send) => { bindRelaySend = send; },
      });

  expose('controller', controller);

  let browserCall = null;
  if (!native) {
    browserCall = installBrowserCall(controller);
    expose('browserCall', browserCall);
  }

  const detail = { controller, browserCall, native };
  window.dispatchEvent(new CustomEvent('arnacon-ready', { detail }));
  return controller;
}

