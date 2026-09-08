# skin/

Ploy / Base44 HTML for this product. The boot page at `/` creates `window.top.controller` and loads:

1. `app.html` if present
2. otherwise `index.html`
3. otherwise `mainscreen.html`

```bash
npm run lint:skin
npm run host
```

Do not add REST or invent `localId`. See [AGENTS.md](../AGENTS.md).
