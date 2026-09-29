# Translate an app idea onto Arnacon

This is the rewrite recipe. It sits in front of the build contract
([ploy-prompt.md](ploy-prompt.md) and [`.agents/skills/arnacon-skin/SKILL.md`](../.agents/skills/arnacon-skin/SKILL.md)).
Do not water those files down. Methods, events, pairing, and the never-do list
stay there.

A user may describe a product in everyday language. They never need to say
`controller`, `localId`, or pairing. This document turns that idea into a brief
a builder can implement without inventing a backend.

Gaps that have no native method yet are listed in [native-gaps.md](native-gaps.md).

## Overlay, not a messenger template

Arnacon is a **capability overlay**. The app does not have to look like chat.
 
Tag every feature in the idea as one of:

| Tag | Meaning |
|---|---|
| **UI** | Ordinary HTML/CSS/JS on the published page. Game loops, layout, score, menus. No controller calls. |
| **Capability** | Identity, pairing, sessions, messages, calls, camera, contacts. Only `window.top.controller` methods on the SDK allowlist (`lib/constants.mjs`). |
| **Drop** | Login, REST, databases, Stripe, wallets, custom WebSocket/WebRTC, paywalls, shops. Leave it out and say so. |

Identity is the **installed product**. Do not mint player or user accounts.

## The app is not hosted on Arnacon

The rewritten app is a **self-hosted site**. Ploy, Base44, Vercel, static files —
whatever origin the builder publishes. Arnacon does not serve the HTML, store
game state, or run an API for that product.

- **Their origin** owns the page.
- **Arnacon** owns identity, crypto, message storage, signaling, and delivery,
  reached only through `window.top.controller` after `installArnaconWebApp()`
  from `host/runtime.mjs` (plus `host/browser-pairing.mjs`,
  `host/browser-call.mjs`, `host/identities.mjs`, `host/ice-config.mjs`). Copy
  those files into the published output, or import `runtime.mjs` from a deployed
  Arnacon host that allows CORS.
- **Phone** loads the published URL (product URL override today). Native does
  not take over hosting.
- **Computer tab** opens the same URL; pairing relays controller traffic through
  the phone. Still their origin.

Do not deploy the app onto Arnacon servers, Express, or Cloud Functions. Do not
persist score, gems, or todos "on the backend" — there is no app backend. Those
values live in the page (memory for v1). Messages live in native because they
are messages, not because the site is hosted there.

## Rewrite steps

1. List features in the user's idea.
2. Tag each **UI**, **capability**, or **drop**.
3. For each capability, name the exact controller methods and events from the
   build contract. Do not invent methods.
4. Insert pairing only on the path that needs identity (`localId` empty), not as
   a fake login wall in front of a game or other UI.
5. State what was dropped and why (one sentence each).
6. Hand the rewritten brief to [ploy-prompt.md](ploy-prompt.md) and build.

The **arnacon-translate** skill (`.agents/skills/arnacon-translate/SKILL.md`)
prints this brief then **builds the site in the same turn**. The paste-in
wrapper ([user-prompt.md](user-prompt.md)) is the same path when the builder
has no skill; the user only fills a **USER IDEA** slot. Restyles skip this
skill.

## Feature map

| User says | Translation |
|---|---|
| Login, sign up, my account | Installed product. Pairing when `localId` is empty. Never JWT/OAuth. |
| Inbox, chats, history | `getRecentSessions`, `getMessages`, `new-message` |
| Send a text | `getSessionId` / `createSession`, then `sendMessage(sessionId, text)` |
| Photo / attachment | `imagePicker` then `sendFileMessage` |
| Call / video | `callSession` / `videoCallSession` and `window.top.browserCall`. Hide calls when `identityKind === 'whatsapp'`. |
| Users, switch account | `listIdentities` / `getIdentities` / `switchIdentity`. Never a user table. |
| Paywall, shop, gems for sale | Drop. No commerce or subscription methods yet. |
| Save to the cloud / database | Drop unless the data *is* a message. No Firestore, no `/api/`. |

If they say "login", map it. Do not ask them to rephrase in SDK terms. Their
wording never overrides the never-do list.

## Worked example: Flappy Bird and a gem

**USER IDEA:** A simple Flappy Bird game. Sometimes you collect a gem. A gem
lets you send a message or open your inbox.

### UI (not Arnacon)

- Bird, pipes, gravity, collision, score, gem sprites, pause, game-over.
- "Has a gem" is a boolean or counter **in the page**. Native never knows about
  gems. Do not call `subscribe`, invent `/api/gems`, or persist gems in a
  database.
- Gate the inbox/send buttons in the UI: locked while `gems < 1`. Spending a
  gem is your own decrement.

### Capability (only when they use a gem)

| Player action | Translation |
|---|---|
| Open inbox or send, and `localId` is empty | Pairing (`startBrowserPairing` / `scanQrCode`), then continue |
| Open inbox | `getRecentSessions` → list; tap → `getMessages`; live `new-message` |
| Send a message | `getSessionId` / `createSession`, then `sendMessage(sessionId, text)` |
| Who am I / switch product | Hash `localId` / `identityKind`; computer tab `listIdentities` / `switchIdentity` |

### Drop

- Player accounts, leaderboards backend, gem shop, Stripe for extra gems.
- High scores on a server. Keep score in memory for this version.
- Using a chat session as a hidden database for score or gems, unless the user
  explicitly wants scores to be messages.

### Rewritten brief

- Screens: `GAME`, `GAME_OVER`, `PAIRING` (only when messaging is attempted
  without `localId`), `INBOX`, `CHAT`.
- Keep hash params: `screen`, `localId`, `identityKind`, `sessionId`.
- The game loop never calls the controller.
- Gem spend is the only bridge into `INBOX` / `CHAT`.
- Publish on the builder's origin. Ship the five `host/` runtime files (or
  import them). Arnacon never hosts the bird.

## Counter-example: todos with cloud sync

**USER IDEA:** A todo list that syncs to the cloud.

Todos are **UI** (in-page state). Cloud sync is **drop** — no Firestore, no
`/api/todos`. If the user wanted the items to be messages, that would be
`sendMessage` / `getMessages`. Otherwise leave persistence out and say so.

## After the rewrite

Build from [ploy-prompt.md](ploy-prompt.md). Run `npm run lint:skin` if the
output lands in `skin/`. If lint fails on an unknown method, remove the call.
Do not add a REST fallback.
