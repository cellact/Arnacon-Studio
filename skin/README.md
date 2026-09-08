# skin/

Ploy / Base44 (or studio) HTML for this product. The boot page at `/` (local host) or `/app` (Vercel) creates `window.top.controller` and loads:

1. `app.html` if present
2. otherwise `index.html`
3. otherwise `mainscreen.html`

```bash
npm run seed-skin
npm run lint:skin
```

Do not add REST or invent `localId`. See [AGENTS.md](../AGENTS.md).
