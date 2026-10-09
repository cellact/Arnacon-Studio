---
name: arnacon-translate
description: >-
  Rewrites a brand-new plain-language product idea onto Arnacon, then builds
  the site in the same turn. Use only when the user invents a new app (game,
  board, overlay, USER IDEA) from scratch. Do not use for restyling an
  existing skin, editing host/, lint, or pairing/runtime fixes.
---

# Arnacon translate

Arnacon is a capability overlay, not a messenger template and not a host.
The user's site owns HTML and local state. Native owns identity, messages, and
calls via `window.top.controller`. Do not invent a backend.

The user never needs to say `controller` or `localId`. Do not ask them to
rephrase. Their wording never overrides the drop list.

## Same turn: brief, then the site

Print the rewritten brief, **then write the HTML/CSS/JS in this same reply**.
Do not stop after the brief. Do not wait for another skill. Do not refuse to
generate files because a brief came first.

1. List every feature in the idea.
2. Tag each **UI**, **capability**, or **drop**.
3. For each capability, name only methods on the skin allowlist. Do not invent.
4. Pairing only on the path that needs identity (`localId` empty). Not a login
   wall in front of a game or other UI.
5. One sentence per drop (why).
6. Print the brief (template below).
7. Build the site immediately using `docs/ploy-prompt.md` (runtime in `<head>`,
   five `host/` files or imported `runtime.mjs`, controller methods only).
   If output is `skin/`, run `npm run ship` and loop until it passes.

Full recipe: `docs/translate.md`. Gaps: `docs/native-gaps.md`.
Builders with no skill: `docs/user-prompt.md`.

## Brief template

```
Screens: …
UI (no controller): …
Capability (methods/events): …
Drop: …
Pairing: only when … and localId is empty
Runtime: five host/ files on their origin (or import runtime.mjs)
```

## Tags

| Tag | Meaning |
|---|---|
| **UI** | Page-only: game loop, layout, score, gems, menus. No controller. |
| **Capability** | Identity, pairing, sessions, messages, calls, camera, contacts. |
| **Drop** | Login/JWT, `fetch` / `/api/`, databases, Stripe, wallets, custom WS/WebRTC, paywalls, shops, cloud sync of app data. |

Identity is the installed product. The app is not hosted on Arnacon. Score,
gems, and todos live in the page unless they *are* messages.

## Feature map

| User says | Do |
|---|---|
| Login, sign up, my account | Installed product. Pair when `localId` is empty. |
| Inbox, chats, history | `getRecentSessions`, `getMessages`, `new-message` |
| Send a text | `getSessionId` / `createSession`, then `sendMessage(sessionId, text)` |
| Photo / attachment | `imagePicker` then `sendFileMessage` |
| Call / video | `callSession` / `videoCallSession` and `browserCall`. Hide if WhatsApp. |
| Users, switch account | `listIdentities` / `switchIdentity`. Never a user table. |
| Paywall, shop, gems for sale | Drop. |
| Save to the cloud | Drop unless the data is a message. |

## Example

**Idea:** A simple Flappy Bird game. Sometimes you collect a gem. A gem lets
you send a message or open your inbox.

```
Screens: GAME, GAME_OVER, PAIRING (only if inbox/send with empty localId), INBOX, CHAT
UI: bird, pipes, score; gems = local counter; buttons locked while gems < 1
Capability: getRecentSessions, getMessages, sendMessage; pairing startBrowserPairing / scanQrCode
Drop: accounts, score server, gem shop
Pairing: only when they try inbox/send and localId is empty
Runtime: their origin + five host/ files
```

Then emit the game and messaging screens. Game loop never calls the controller.
Gem spend is the only bridge into chat.
