# Arnacon Studio

Standalone builder for Arnacon communication apps. A prompt fills a capability spec; a compiler derives screens and `arnacon-controller` bindings; HTML is generated and linted. The preview uses a mock controller (no native phone required).

This repo is **only** the studio. It is not the live Arnacon web client.

## Run locally

```bash
npm run check
npm run dev
```

Open http://127.0.0.1:4173/

`npm run studio:dev` is an alias for `npm run dev`.

## Generate example apps

```bash
npm run generate
```

Writes themed clients under `output/`.

## Vercel

New project from this repo. Root Directory = repo root (not a subfolder). Framework = Other. No build command.

## Pipeline

Prompt → capability spec (`schema/capability-spec.schema.json`) → compile screens/methods/events → generate HTML → lint (controller allowlist only, no invented backend).
