# Prompt to paste into Ploy or Base44

Use this when the builder has no Arnacon skill attached. It is the same contract as
[`.agents/skills/arnacon-skin/SKILL.md`](../.agents/skills/arnacon-skin/SKILL.md),
written as a single instruction block.

For an idea in everyday language, the **arnacon-translate** skill rewrites then
builds in the **same turn**. Without skills, paste [user-prompt.md](user-prompt.md)
instead. The rewrite recipe is [translate.md](translate.md). Do not replace this
file with a casual prompt.

Replace `<ARNACON_HOST>` with the deployed Arnacon host origin before pasting, or
delete that option if you copy the runtime files into the project.

---

Build an Arnacon web app. You own the UI only. Arnacon owns identity, encryption,
message storage, signaling, and delivery. Never build a backend for any of it.

**Runtime (required)**

The published site is the web app; it is not framed by an Arnacon page. Start the
runtime in the document `<head>`, in a **plain** `<script>` (no `type="module"`,
no `defer`), so the promise exists before any component mounts:

```html
<script>
  window.__arnaconRuntimePromise =
    import("/host/runtime.mjs").then((m) => m.installArnaconWebApp());
</script>
```

Every component then awaits that same promise:

```js
const controller = await window.__arnaconRuntimePromise;
```

Do not bootstrap with `<script type="module">` and a static
`import { installArnaconWebApp } from "/host/runtime.mjs"`. Module scripts are
deferred and their body runs only after the whole module graph downloads, so a
component that hydrates on load reads `window.__arnaconRuntimePromise` before it
is set. Never throw when it is missing — await it.

Include these five files in the published output at those exact paths:
`host/runtime.mjs`, `host/browser-pairing.mjs`, `host/browser-call.mjs`,
`host/identities.mjs`, `host/ice-config.mjs`. If you cannot add files, import from
the hosted copy instead: `https://<ARNACON_HOST>/host/runtime.mjs`.

`installArnaconWebApp()` returns the controller and also sets
`window.top.controller`. In a desktop browser it enables QR pairing with the phone.
Inside the Arnacon phone app it uses the installed product directly. Your code
never needs to know which one is active. The runtime also fires an
`arnacon-ready` event on `window` with `{ controller, browserCall, native }`.

**Identity**

Identity is the installed Arnacon product. Do not build sign-up, login, JWT, OAuth,
or profile creation, and never hard-code a `localId`. Read `localId` and
`identityKind` from `controller.localId` or from the URL hash/query
(`#screen=MAIN&localId=…&identityKind=…&sessionId=…`). Keep those hash params when
you navigate.

**Pairing**

When `controller.localId` is empty, show a pairing screen first:

1. Call `await controller.startBrowserPairing()`.
2. If the result has `useScanQrCode`, call `controller.scanQrCode()` instead (phone).
3. Otherwise render the returned `pairingUri` as a QR code using a local QR
   library. Generate the image in the browser; do not call a QR web service.
4. Listen for `pairing-status` for progress and `pairing-ready` for success, then
   read `localId` from that payload and show the main screen.
5. Offer an unlink button that calls `controller.stopBrowserPairing()`.

The runtime keeps the relay link alive and reconnects on its own, so treat both
events as repeatable:

- `pairing-status` reports `idle`, `connecting`, `waiting`, `paired`,
  `disconnected`, or `error`. Only `stopBrowserPairing()` means unpaired.
  `disconnected` is transient — show a quiet "reconnecting" hint, keep `localId`,
  and do not send the user back to the pairing screen or call
  `startBrowserPairing()` again.
- `pairing-ready` fires again after every reconnect. Navigate to the main screen
  only when the user is still on the pairing screen; never interrupt an open chat
  or call.

**Identities (all installed products)**

A user usually owns several Arnacon products. The one that scanned the QR is only
the active one — show them all.

- `await controller.listIdentities()` → `{ identities, activeLocalId }`. Each entry
  is `{ id, label, localId, kind, selected }`. Call it after `pairing-ready`.
- `controller.getIdentities()` returns the last cached answer with no round trip.
- `controller.on('identity-list', ...)` fires whenever the phone sends a new list,
  including after a switch. Re-render from it; do not cache your own copy.
- `await controller.switchIdentity(identity)` activates one, passing an entry from
  the list. It resolves with the new `{ identities, activeLocalId }` once the phone
  confirms, and rejects after 12 seconds if it never does. Show a spinner while it
  is pending and an error on rejection — never leave the screen stuck.
- After it resolves, `controller.localId` is already the new product and an
  `identity-change` event has fired. Reload sessions and messages, and update the
  `localId` hash param. Do not wait for any other confirmation, and do not poll.
- Render the active one with `selected`, not by comparing against a stored value.
- `listIdentities()` rejects if the phone does not answer within 8 seconds. Catch
  it and show a retry, do not crash the screen.
- Do not invent products, prices, or a purchase flow. The list is whatever native
  reports.

**Messages**

- List: `await controller.getRecentSessions(20)` → `result.sessions`, each with
  `sessionId`, `sessionName`, `lastMessageContent`, `unreadCount`, `isGroup`.
- History: `await controller.getMessages(sessionId, 50, null, true)` →
  `result.messages`, each with `messageId`, `content`, `author`, `time`, `status`.
- A message is mine when `msg.author === localId`.
- Live: `controller.on('new-message', data => { const b = data.body || data; const msg = b.message || b; })`.
  Also handle `message-updated` and `message-reaction`.
- Send: `controller.sendMessage(String(sessionId), text)` — exactly two arguments.
  Resolve the session first with `getSessionId(remoteId)` or `createSession(remoteId, name)`.
  Never pass a remote id where a `sessionId` is expected.
- Attachments: `const r = await controller.imagePicker()` then
  `controller.sendFileMessage(sessionId, r.imageId, caption)`.
- Also available: `markRead`, `updateSessionTimestamp`, `sendChatstate(sessionId, 'composing')`,
  `sendReplyMessage`, `sendEditMessage`, `deleteMessage`, `sendReaction`,
  `setSessionName`, `deleteSession`, `setBlocked`, `downloadFile`.

**Calls**

- Start: `controller.callSession(sessionId)` or `controller.videoCallSession(sessionId)`
  (`callRemote` / `videoCallRemote` when you only have a remote id).
- Incoming: `controller.on('receiving-call', …)` with `from`, `callId`,
  `sessionName`, `videoCall`. Accept with `window.top.browserCall.accept(callId, { video })`
  when `window.top.browserCall` exists, otherwise `controller.acceptCall(callId)`.
- Hang up: `controller.rejectCall(callId)`, and `window.top.browserCall.close()` when
  present. There is no `endCall` on native.
- In-call: `setMute(callId, muted)`, `setHold(callId, held)`, `switchCamera(callId)`,
  `getAudioDevices()`, `changeAudioDevice(callId, deviceId)`.
- Video: create `<video>` elements and pass them with
  `window.top.browserCall.setVideoElements({ remote, local })`. Do not build WebRTC yourself.
- Other events: `ringing`, `call-started`, `call-connected`, `call-ended`,
  `call-answered-elsewhere`, `mute-state`, `webrtc-disconnected`.
- Hide all call UI when `identityKind === 'whatsapp'`.

**Screens**

Conversation list, chat, new chat, new group, pairing, identities, ringing,
incoming call, voice call, video call. Styling, layout, framework, and navigation
are entirely your choice.

**Never do these**

- No `fetch`, `XMLHttpRequest`, `/api/` routes, Express, or any server.
- No database, ORM, Firebase, Supabase, or message storage of your own.
- No OAuth, login, signup, session cookies, or JWT.
- No Stripe, checkout, paywalls, or subscriptions.
- No wallets, Web3 RPC, or chain calls.
- No `new WebSocket(...)` and no `new RTCPeerConnection(...)`. The runtime owns both.
- No `subscribe`, `getEntitlement`, `getActiveIdentity`, or any controller method
  not listed above. They do not exist.
- No hard-coded `localId` value.

If a feature would need any of the above, leave it out and say so instead of
inventing an API.

---

## After the build

1. Publish the site over HTTPS and open it in a desktop browser: it should show
   pairing, then a QR you can scan with the Arnacon phone app.
2. To run it as the phone's product UI, set the Arnacon Android Product URL
   Override (`setProductUrlOverride`) to the published URL. Per-product `htmlUrl`
   is not wired on native yet, so the override is the only route today.

The builder's in-editor preview may block external modules and has no native
bridge, so pairing can fail there. Judge the published URL.
