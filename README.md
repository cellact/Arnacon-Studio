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
- `host/runtime.mjs` — portable runtime for a Ploy/Base44 site hosted at its own origin.
- `skin/` — Ploy/Base44 HTML. Prefer `app.html`, else `index.html` or `mainscreen.html`.
- Hash routing: `#screen=MAIN&localId=…&identityKind=…&sessionId=…`

A Ploy/Base44 deployment can copy the four runtime modules from `host/` and call
`installArnaconWebApp()` before mounting its UI. In a browser it pairs through the
phone relay; in the Arnacon phone WebView it uses the installed product directly.

On a phone, set the product URL override to the published site URL. Per-product
skin URLs are not yet persisted by native.

If the builder has no Arnacon skill attached, paste
[docs/ploy-prompt.md](docs/ploy-prompt.md) into it instead.

See [AGENTS.md](AGENTS.md) and [docs/ploy-base44.md](docs/ploy-base44.md).

## Cursor extension

The Cursor extension is an additional Arnacon product surface; it does not
replace or modify the Ploy skin above. It shares the browser pairing runtime,
then provides its own sidebar UI for pairing, installed-product switching,
conversation history, text messages, and audio calls. Video is not wired into
the sidebar; media still lives on the host (`window.browserCall`).

Build the installable extension:

```bash
npm install
npm run package:extension
```

Install the generated `arnacon-studio-0.1.0.vsix` from Cursor's
**Extensions: Install from VSIX…** command. For development, run the
**Run Arnacon Extension** launch configuration.
