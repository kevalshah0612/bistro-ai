# The Intelligent Bistro

The Intelligent Bistro is a full-stack restaurant ordering app with an upscale dark-mode mobile experience and an AI waiter that turns natural-language requests into structured cart updates.

## Folder Structure

```text
apps/
  api/      Express + TypeScript REST API and Anthropic integration
  mobile/   Expo React Native app with menu, cart, and AI chat tabs
```

## Setup

1. Clone the repo.
2. Run `npm install` at the root.
3. Copy `apps/api/.env.example` to `apps/api/.env` and fill in `ANTHROPIC_API_KEY`.
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL`.
5. Run `npm run dev:api` in one terminal.
6. Run `npm run dev:mobile` in another terminal.

## Environment Variables

| Location | Variable | Description |
| --- | --- | --- |
| `apps/api/.env` | `PORT` | API port, defaults to `3001` |
| `apps/api/.env` | `ANTHROPIC_API_KEY` | Anthropic API key used by the AI waiter |
| `apps/api/.env` | `CORS_ORIGIN` | Allowed CORS origin, use `*` in development |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` | API base URL, for example `http://localhost:3001/api` |

On a real device, use your machine's local network IP instead of `localhost`.
