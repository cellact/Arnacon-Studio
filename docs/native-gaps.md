# Native gaps for generated Arnacon apps

Generated HTML may only call methods that already exist on `window.top.controller`. A capability pack that has no native binding is classified from the prompt, omitted from the spec, and recorded as a warning. Do not invent REST, wallets, or proving keys to fill the gap.

## Identity pack (partial)

Available today:

- Injected `localId` / `identityKind` (native URL or shell)
- `identity-change` event
- `scanQrCode`
- PAIRING screen (browser-relay stub; no generated WebSocket)

Still required on the controller before an identity-switcher app is real:

| Method | Purpose |
|---|---|
| `listIdentities` | Return installed products the user can switch to |
| `switchIdentity` | Activate one of those products |
| `getActiveIdentity` | Current `{ localId, identityKind }` without parsing the URL |

Until those exist, the IDENTITIES screen only displays the injected identity.

## Subscription pack (blocked)

Prompts about paid access, memberships, or ZK gates downscope. Do not generate PAYWALL HTML that pretends to charge.

| Method / event | Purpose |
|---|---|
| `getEntitlement` | Whether the active identity may use the app |
| `subscribe` | Start a plan (native owns payment and proof) |
| `unsubscribe` | End a plan |
| `entitlement-change` | Push when access changes |

ZK stays inside native. If a spec ever gains this pack, the only legal flag is `subscription.proof: "native"` — never a proving key, circuit, or RPC URL.

## Commerce pack (blocked)

Prompts about shops, listings, or checkout downscope.

| Method | Purpose |
|---|---|
| `listListings` | Catalog owned by Arnacon identity |
| `getListing` | One listing |
| `createListing` | Publish a listing |
| `buyListing` | Purchase against native settlement |

Do not add these methods to generated apps until native owns the protocol.

## Communication and device packs

These already bind to `arnacon-controller` (sessions, messages, calls, camera, contacts, files). See `lib/constants.mjs` for the allowlist.
