# Arnacon skin host

This repo hosts an Arnacon product. Native owns identity, crypto, storage, signaling, and delivery. The files in `skin/` are presentation only.

## Rules

- Talk only to `window.top.controller` (`arnacon-controller`). Native (or `npm run host`) creates it on the boot page.
- Do not invent REST, `fetch('/api/...')`, Express, OAuth, Stripe, databases, wallets, FCM, ICE/TURN, or `localId` literals.
- Identity is the **installed product**. Do not add login screens that mint accounts.
- You may change HTML, CSS, and colors freely.
- You may not add controller methods or events that are not on the SDK allowlist. `npm run lint:skin` is the merge gate.
- `subscription` and `commerce` have no native methods yet. Do not generate paywalls, checkout, or chain RPC.

## Layout

- `host/index.html` — boot page. Creates `window.top.controller`, then loads `skin/`.
- `skin/` — Ploy/Base44 (or studio) output. Prefer `app.html`, else `index.html` or `mainscreen.html`.
- Hash routing: `#screen=MAIN&localId=…&identityKind=…&sessionId=…`

## Commands

```bash
npm run seed-skin
npm run lint:skin
npm run host
```

Open http://127.0.0.1:4175/

Copy `.agents/skills/arnacon-skin/SKILL.md` into the Ploy skill folder if Code Sync does not pick up this repo's skills automatically.
