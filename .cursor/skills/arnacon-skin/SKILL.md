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
- Call existing `arnacon-controller` methods (`sendMessage`, `getRecentSessions`, `callSession`, …).
- Keep hash params: `screen`, `localId`, `identityKind`, `sessionId`. Never invent `localId`.
- Run `npm run lint:skin` before finishing.

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
