# Ploy / Base44 on Arnacon

Ploy and Base44 can restyle an Arnacon product. They cannot become Arnacon. There is no REST adapter, no OAuth, and no invented `/api`.

## What this repo provides

1. **Boot page** (`host/index.html`) — creates `window.top.controller` (native bridge, or a mock when you run `npm run host`).
2. **Skin folder** (`skin/`) — drop Ploy Code Sync / Base44 export here. The boot iframe loads `app.html`, else `index.html`, else `mainscreen.html`.
3. **Lint** (`npm run lint:skin`) — merge gate. Forbidden: `fetch`, `/api/`, Express, OAuth, wallets. Allowed: `controller.*` methods on the SDK allowlist.
4. **Skills** — [AGENTS.md](../AGENTS.md), `.agents/skills/arnacon-skin/SKILL.md`, and `.agents/skills/arnacon-translate/SKILL.md`. Point Ploy at this repo (or copy both skills into the ployspace repo). Translate is only for a brand-new product idea and still emits the site in the same turn. Restyles use the skin skill only.
5. **Paste-in prompt** — [ploy-prompt.md](ploy-prompt.md). The same contract as one instruction block, for a builder with no skill attached. Plain-language ideas: [user-prompt.md](user-prompt.md) (recipe: [translate.md](translate.md)).

## Host the web app on Ploy or Base44

A published Ploy/Base44 site can be the web app itself. It does not need to be
framed by an Arnacon-owned page.

Copy these files into the site's public output, preserving their relative paths:

- `host/runtime.mjs`
- `host/browser-pairing.mjs`
- `host/browser-call.mjs`
- `host/identities.mjs`
- `host/ice-config.mjs`

Install the runtime before the UI uses the controller:

```html
<script type="module">
  import { installArnaconWebApp } from "/host/runtime.mjs";
  window.arnaconController = await installArnaconWebApp();
</script>
```

Framework applications should call `installArnaconWebApp()` in their entry module
before mounting the app. The returned value and `window.top.controller` are the
same controller.

Runtime behavior:

- **Published site in a browser:** no `localId` initially; show PAIRING, call
  `startBrowserPairing()`, render its `pairingUri`, then use the controller for
  messages and calls after `pairing-ready`.
- **Published site loaded as an Arnacon product on the phone:** the runtime detects
  the native bridge and uses the installed product directly.

The editor's isolated preview may block public modules or lack a native bridge.
Validate the published HTTPS URL.

## Local flow

```bash
# restyle skin/ in Ploy, Base44, or by hand
npm run lint:skin
npm run host         # http://127.0.0.1:4175/
```

## Phone / emulator

Android already has a product URL override (`setProductUrlOverride`). Point it at the host origin:

- Local USB: `http://10.0.2.2:4175/` (emulator) or your machine LAN IP.
- Deployed: `https://<this-vercel>/` or `https://<this-vercel>/app`

Native injects `#screen=&localId=&identityKind=` onto that URL. The host forwards the hash into `skin/`. `receiveData` lands on the boot frame's `window.controller`, which is the same object as `window.top.controller` inside the skin.

Per-product `htmlUrl` on the installed product is not wired yet. Until it is,
Product URL Override is the way to load the published Ploy/Base44 URL inside the
phone. CallActivity uses the same `getProductUrl`, so calls load it too.

## What Ploy must not emit

| Instead of | Use |
|---|---|
| `fetch('/api/...')` | `controller.sendMessage` / `getRecentSessions` / … |
| Login / JWT | Installed product (`localId` from the URL) |
| Stripe / checkout | Nothing — commerce has no native methods |
| Wallet / RPC | Nothing — identity is the product |
| `localId = 'alice.eth'` | Read `localId` from the hash |

Skin (HTML/CSS) is free. The controller contract is locked.

## Messages and calls (match ArnaconWeb)

The skin must use `arnacon-controller` payloads:

| Surface | Contract |
|---|---|
| Session preview | `lastMessageContent` |
| Message body | `content` / `author` (mine when `author === localId`) |
| `new-message` | `{ message }` |
| Send | `sendMessage(sessionId, text)` after `createSession` / `getSessionId` |
| Image | `imagePicker()` → `imageId` → `sendFileMessage` |
| Outgoing call | `callSession` / `videoCallSession` |
| Incoming call | `receiving-call` then `window.top.browserCall.accept(id, { video })` or `acceptCall(id)` |
| Hang up | `rejectCall(callId)` |

Computer-tab audio/video is `window.top.browserCall` from the portable runtime.
The UI must not open a WebSocket or `RTCPeerConnection`.
