# Arnacon skin host

This repo hosts an Arnacon product. Native owns identity, crypto, storage, signaling, and delivery. The files in `skin/` are presentation only.

## Rules

- Talk only to `window.top.controller` (`arnacon-controller`). Native, the full
  boot page, or `installArnaconWebApp()` from `host/runtime.mjs` creates it.
- Do not invent REST, `fetch('/api/...')`, Express, OAuth, Stripe, databases, wallets, FCM, ICE/TURN, or `localId` literals.
- Identity is the **installed product**. Do not add login screens that mint accounts.
- You may change HTML, CSS, and colors freely.
- You may not add controller methods or events that are not on the SDK allowlist. `npm run ship` is the merge gate (lint, harness conformance, gold-path mock, live origin). Browser pairing is `startBrowserPairing` / `stopBrowserPairing` / `getBrowserPairing` plus `scanQrCode` on the phone. Skins must not open a WebSocket. Computer-tab calls use `window.top.browserCall` on the host; hang up with `rejectCall(callId)`. The computer tab lists installed products with `listIdentities` / `getIdentities` / `switchIdentity` and the `identity-list` event.
- `subscription` and `commerce` have no native methods yet. Do not generate paywalls, checkout, or chain RPC.

## Layout

- `host/index.html` — boot page. Creates `window.top.controller`, then loads `skin/`.
- `host/runtime.mjs` — portable bootstrap for a Ploy/Base44 site hosted at its own origin.
- `host/identities.mjs` — installed-product list and switching for the computer tab.
- `skin/` — Ploy/Base44 output. Prefer `app.html`, else `index.html` or `mainscreen.html`.
- Hash routing: `#screen=MAIN&localId=…&identityKind=…&sessionId=…`

## Commands

```bash
npm run ship
npm run host
```

Do not treat a generate as done until `npm run ship` exits 0. Fix and re-run. Optional live origin: `npm run ship -- --url=https://example.com`.

Open http://127.0.0.1:4175/

Copy `.agents/skills/arnacon-skin/SKILL.md` and `.agents/skills/arnacon-translate/SKILL.md` into the Ploy skill folder if Code Sync does not pick up this repo's skills automatically. Builders with no skill support take the paste-in prompt in [docs/ploy-prompt.md](docs/ploy-prompt.md) instead; keep the skin skill and that file in sync. A brand-new product idea may use **arnacon-translate** in the same turn as the build (paste: [docs/user-prompt.md](docs/user-prompt.md); recipe: [docs/translate.md](docs/translate.md)). Restyles use **arnacon-skin** only. Do not dilute the Ploy contract. Do not stop after a rewrite brief.
