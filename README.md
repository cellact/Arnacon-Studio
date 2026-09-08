# Arnacon skin host

This repo hosts an Arnacon product. Native owns identity, crypto, storage, signaling, and delivery. The files in `skin/` are presentation only.

## Run locally

```bash
npm run lint:skin
npm run host
```

Open http://127.0.0.1:4175/

`npm run dev` is the same as `npm run host`.

## Layout

- `host/` — boot page. Creates `window.top.controller`, then loads `skin/`.
- `skin/` — Ploy/Base44 HTML. Prefer `app.html`, else `index.html` or `mainscreen.html`.
- Hash routing: `#screen=MAIN&localId=…&identityKind=…&sessionId=…`

On a phone, set the product URL override to this origin (or the deployed `/` or `/app` URL).

See [AGENTS.md](AGENTS.md) and [docs/ploy-base44.md](docs/ploy-base44.md).
