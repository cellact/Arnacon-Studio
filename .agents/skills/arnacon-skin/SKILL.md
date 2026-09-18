---
name: arnacon-skin
description: >-
  Builds and restyles Arnacon product skins that talk only to window.top.controller.
  Use when editing skin/, host/, Ploy or Base44 exports, Arnacon HTML, or when the
  user mentions controller methods, capability packs, lint:skin, or product URL.
---

# Arnacon skin

Arnacon is not a SaaS backend. Native owns identity, crypto, storage, signaling, and delivery. Ploy/Base44 UI may talk **only** to `window.top.controller`.

## Do

- Edit HTML/CSS/colors in `skin/`.
- Call existing `arnacon-controller` methods (`sendMessage`, `getRecentSessions`, `callSession`, `scanQrCode`, …).
- PAIRING / QR pairing is allowed. Computer tab: `startBrowserPairing()` → `{ room, pairingUri, status }`; unlink with `stopBrowserPairing()`; listen `pairing-status` and `pairing-ready`. Phone WebView: `useScanQrCode` then `scanQrCode()`. Do not open a WebSocket in skin HTML.
- Keep hash params: `screen`, `localId`, `identityKind`, `sessionId`. Never invent `localId`.
- Run `npm run lint:skin` before finishing.

## Self-hosted Ploy / Base44 site

The published site does not need an Arnacon parent iframe. Install the portable
runtime before the UI calls the controller:

```js
import { installArnaconWebApp } from '/host/runtime.mjs';
const controller = await installArnaconWebApp();
```

Ship `host/runtime.mjs`, `host/browser-pairing.mjs`, `host/browser-call.mjs`,
`host/identities.mjs`, and `host/ice-config.mjs` at the same relative paths.
Alternatively import `runtime.mjs` from the deployed Arnacon host; its module
responses must allow CORS.

- In a phone WebView, the runtime uses the native bridge and the installed product.
- In a normal browser, it exposes browser QR pairing and relays controller traffic through the phone.
- The UI still contains no WebSocket, API, or WebRTC implementation.
- Render PAIRING when `controller.localId` is empty, then call `startBrowserPairing()`.
- The Ploy/Base44 editor preview may restrict modules; test the published HTTPS URL.

## Identities

The computer tab can list every installed product, not just the one that paired.

- `listIdentities()` → `{ identities, activeLocalId }`; entries are
  `{ id, label, localId, kind, selected }`. Rejects after 8s with no phone answer.
- `getIdentities()` returns the cached answer; `identity-list` fires on every update.
- `await switchIdentity(identity)` resolves with the new list once the phone
  confirms and rejects after 12s. Native answers a switch with a fresh identity
  list, not `identity-change`; the runtime updates `controller.localId` and
  synthesizes `identity-change` from it. Never block on a bare `identity-change`.
- Inside the phone WebView the native chrome owns switching; these are browser-only.
- `getActiveIdentity` still does not exist. Read the hash.

## Messages (same contract as ArnaconWeb)

Use SDK field names, not mock aliases.

- `getRecentSessions(20)` → `session.lastMessageContent` (not `lastMessage`)
- `getMessages(sessionId, 50, null, true)` → `msg.content`, `msg.author`
- Mine = `msg.author === localId` (from the hash). Incoming status is `6`.
- `new-message` payload is `{ message }`. Unwrap `data.body || data`, then `body.message`.
- `sendMessage(sessionId, text)` — two arguments. Create/resolve a session first. Do not pass a remote id as `sessionId`.
- Attachments: `imagePicker()` returns `{ imageId }`; send with `sendFileMessage(sessionId, imageId, caption)`.

## Calls (same contract as ArnaconWeb)

Host owns media. Skin never creates a `RTCPeerConnection`.

- Outgoing: `callSession(sessionId)` / `videoCallSession(sessionId)` (or `callRemote` / `videoCallRemote`).
- Incoming: listen `receiving-call` (`from`, `callId`, `sessionName`, `videoCall`).
- Accept in the computer tab: `window.top.browserCall.accept(id, { video })` when present, else `acceptCall(id)`.
- Hang up: `rejectCall(callId)` (there is no native `endCall`). Also `browserCall.close()` when present.
- Mute/hold/camera: `setMute(callId, muted)`, `setHold(callId, held)`, `switchCamera(callId)`.
- Bind video tags with `browserCall.setVideoElements({ remote, local })`.
- Hide call UI when `identityKind === 'whatsapp'`.

## Do not

- Emit `fetch`, `XMLHttpRequest`, `/api/`, Express, OAuth, Stripe, Mongo/Postgres, wallets, Web3 RPC, or Firebase Auth.
- Create login that mints users. Identity is the installed product.
- Add `getActiveIdentity` / `subscribe` / checkout. Those native methods do not exist yet.
- Remove the portable runtime unless the site is loaded by the full `host/` boot page.

## After changing skin/

```bash
npm run lint:skin
```

If lint fails on an unknown method, remove the call. Do not add a REST fallback.

## Builders without skill support

Give the user `docs/ploy-prompt.md`, the same contract as one paste-in block.
Change it and this file together.
