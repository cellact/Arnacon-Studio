# Ploy / Base44 on Arnacon

Ploy and Base44 can restyle an Arnacon product. They cannot become Arnacon. There is no REST adapter, no OAuth, and no invented `/api`.

## What this repo provides

1. **Boot page** (`host/index.html`) — creates `window.top.controller` (native bridge, or a mock when you run `npm run host`).
2. **Skin folder** (`skin/`) — drop Ploy Code Sync / Base44 export here. The boot iframe loads `app.html`, else `index.html`, else `mainscreen.html`.
3. **Lint** (`npm run lint:skin`) — merge gate. Forbidden: `fetch`, `/api/`, Express, OAuth, wallets. Allowed: `controller.*` methods on the SDK allowlist.
4. **Skills** — [AGENTS.md](../AGENTS.md) and `.agents/skills/arnacon-skin/SKILL.md`. Point Ploy at this repo (or copy the skill into the ployspace repo).

## Local flow

```bash
npm run seed-skin    # compiled default messenger into skin/
# restyle skin/ in Ploy, Base44, or by hand
npm run lint:skin
npm run host         # http://127.0.0.1:4175/
```

Studio (prompt → spec → compiler) stays at http://127.0.0.1:4173/

## Phone / emulator

Android already has a product URL override (`setProductUrlOverride`). Point it at the host origin:

- Local USB: `http://10.0.2.2:4175/` (emulator) or your machine LAN IP.
- Deployed: `https://<this-vercel>/app`

Native injects `#screen=&localId=&identityKind=` onto that URL. The host forwards the hash into `skin/`. `receiveData` lands on the boot frame's `window.controller`, which is the same object as `window.top.controller` inside the skin.

Per-product `htmlUrl` on the installed product is not wired yet. Until it is, override is the way to load a custom host. CallActivity uses the same `getProductUrl`, so calls load this host too when override is set.

## What Ploy must not emit

| Instead of | Use |
|---|---|
| `fetch('/api/...')` | `controller.sendMessage` / `getRecentSessions` / … |
| Login / JWT | Installed product (`localId` from the URL) |
| Stripe / checkout | Nothing — commerce pack is downscoped |
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

Computer-tab audio/video is `window.top.browserCall` on the host. Skin HTML must not open a WebSocket or `RTCPeerConnection`. Ploy preview (no Arnacon parent) cannot pair, message, or call.

