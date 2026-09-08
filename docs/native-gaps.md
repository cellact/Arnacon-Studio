# Native gaps

Skins may only call methods that already exist on `window.top.controller`. Do not invent REST, wallets, or proving keys to fill a gap.

## Identity (partial)

Available today:

- Injected `localId` / `identityKind` (native URL or host pairing)
- `identity-change` event
- `scanQrCode` → `{ qrContent }` (phone scans a pairing QR)
- `startBrowserPairing` / `stopBrowserPairing` / `getBrowserPairing` (computer tab owns the WSS room)
- Events `pairing-status`, `pairing-ready`

The WebSocket to `arnacon-phone-relay` lives on the host controller (`host/browser-pairing.mjs`), matching ArnaconWeb. Native still joins as `role=phone` after scanning `arnacon://browser-relay?room=&relay=`.

Still required on the controller before an identity-switcher UI is real:

| Method | Purpose |
|---|---|
| `listIdentities` | Return installed products the user can switch to |
| `switchIdentity` | Activate one of those products |
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
