---
name: arnacon-skin
description: >-
  Builds and restyles Arnacon product skins that talk only to window.top.controller.
  Use when editing skin/, host/, Ploy or Base44 exports, Arnacon HTML, or when the
  user mentions controller methods, capability packs, lint:skin, or product URL.
---

# Arnacon skin

Arnacon is not a SaaS backend. Native owns identity, crypto, storage, signaling, and delivery. Generated or Ploy/Base44 UI may talk **only** to `window.top.controller`.

## Do

- Edit HTML/CSS/colors in `skin/`.
- Call existing `arnacon-controller` methods (`sendMessage`, `getRecentSessions`, `callSession`, `scanQrCode`, …).
- PAIRING / QR pairing is allowed. Computer tab: `startBrowserPairing()` → `{ room, pairingUri, status }`; unlink with `stopBrowserPairing()`; listen `pairing-status` and `pairing-ready`. Phone WebView: `useScanQrCode` then `scanQrCode()`. Do not open a WebSocket in skin HTML.
- Keep hash params: `screen`, `localId`, `identityKind`, `sessionId`. Never invent `localId`.
- Run `npm run lint:skin` before finishing.

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

Opening the Ploy preview origin (not inside the Arnacon host) cannot pair, message, or call.

## Do not

- Emit `fetch`, `XMLHttpRequest`, `/api/`, Express, OAuth, Stripe, Mongo/Postgres, wallets, Web3 RPC, or Firebase Auth.
- Create login that mints users. Identity is the installed product.
- Add `listIdentities` / `switchIdentity` / `subscribe` / checkout. Those native methods do not exist yet.
- Replace `host/`. The boot page must keep creating `window.top.controller`.

## After changing skin/

```bash
npm run lint:skin
```

If lint fails on an unknown method, remove the call. Do not add a REST fallback.
