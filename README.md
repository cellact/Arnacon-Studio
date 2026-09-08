# Arnacon Studio

Standalone builder for apps that run on Arnacon. A prompt fills a capability spec; a compiler derives screens and `arnacon-controller` bindings; HTML is generated and linted. The preview uses a mock controller (no native phone required).

This repo is **only** the studio. It is not the live Arnacon web client.

An app type is which **capability packs** are on (`communication`, `identity`, `device`), not a new `kind`. Subscription and commerce prompts are understood and downscoped until native methods exist. See [docs/native-gaps.md](docs/native-gaps.md).

## Run locally

```bash
npm run check
npm run dev
```

Open http://127.0.0.1:4173/

Hard-refresh the tab if an old messenger-only UI is cached.

`npm run studio:dev` is an alias for `npm run dev`.

## Ploy / Base44 host

Skins from Ploy or Base44 do not talk to REST. They run inside a host page that owns `window.top.controller`. See [docs/ploy-base44.md](docs/ploy-base44.md) and [AGENTS.md](AGENTS.md).

```bash
npm run seed-skin   # default messenger into skin/
npm run lint:skin
npm run host        # http://127.0.0.1:4175/
```

On a phone, set the product URL override to that origin (or the deployed `/app` URL).

## Generate example apps

```bash
npm run generate
```

Writes themed clients under `output/`.

## Vercel

New project from this repo. Root Directory = repo root (not a subfolder). Framework = Other. No build command.

- Studio UI: `/`
- Host (WebView product URL): `/app`

## Pipeline

Prompt → classify packs → capability spec (`schema/capability-spec.schema.json`) → compile screens/methods/events → generate HTML → lint (controller allowlist only, no invented backend).
