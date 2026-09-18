# Native gaps

Skins may only call methods that already exist on `window.top.controller`. Do not invent REST, wallets, or proving keys to fill a gap.

## Identity (partial)

Available today:

- Injected `localId` / `identityKind` (native URL or host pairing)
- `identity-change` event
- `scanQrCode` → `{ qrContent }` (phone scans a pairing QR)
- `startBrowserPairing` / `stopBrowserPairing` / `getBrowserPairing` (computer tab owns the WSS room)
- Events `pairing-status`, `pairing-ready`
- `listIdentities` / `switchIdentity` / `getIdentities` on the computer tab

The WebSocket to `arnacon-phone-relay` lives on the host controller (`host/browser-pairing.mjs`), matching ArnaconWeb. Native still joins as `role=phone` after scanning `arnacon://browser-relay?room=&relay=`.

The paired phone answers `get-identity-list` with every installed product and accepts `set-active-identity`, the same pair of relay actions behind ArnaconWeb's nav rail. `host/identities.mjs` wraps them so a skin sees `listIdentities()` → `{ identities, activeLocalId }`, `switchIdentity(identity)`, `getIdentities()` (last cached answer), and the `identity-list` event. Native replies with either a prebuilt `navMenu` or raw `identityList` rows (`[id, label, localId]`); the module normalizes both and drops section headers.

A switch is confirmed by a fresh identity list carrying the new `activeLocalId` — native sends no `identity-change` of its own, which is why ArnaconWeb reads `body.activeLocalId` instead of listening for the event. The module resolves the `switchIdentity` promise on that payload, updates `controller.localId`, and emits `identity-change` so skins have a single signal. A switch the phone never confirms rejects after 12s rather than hanging.

Inside the phone WebView the native chrome owns the switcher, so these are installed for the computer tab only.

Still missing:

| Method | Purpose |
|---|---|
| `getActiveIdentity` | Current `{ localId, identityKind }` without parsing the URL |

## Subscription (blocked)

Do not generate paywalls.

| Method / event | Purpose |
|---|---|
| `getEntitlement` | Whether the active identity may use the app |
| `subscribe` | Start a plan (native owns payment and proof) |
| `unsubscribe` | End a plan |
| `entitlement-change` | Push when access changes |

## Commerce (blocked)

Do not generate shops, listings, or checkout.

| Method | Purpose |
|---|---|
| `listListings` | Catalog owned by Arnacon identity |
| `getListing` | One listing |
| `createListing` | Publish a listing |
| `buyListing` | Purchase against native settlement |

## Communication and device

These already bind to `arnacon-controller` (sessions, messages, calls, camera, contacts, files). See `lib/constants.mjs` for the allowlist.

On the computer tab, after pairing, `sendMessage` / `callSession` ride the same relay WebSocket. Media is `window.top.browserCall` on the host (`host/browser-call.mjs`), matching ArnaconWeb. Hang up with `rejectCall(callId)`. Message rows use `content` / `author`; session previews use `lastMessageContent`.
