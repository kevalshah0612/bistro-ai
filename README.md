# The Intelligent Bistro

The Intelligent Bistro is a full-stack restaurant ordering app with an upscale dark-mode mobile experience, a PostgreSQL database, and an AI waiter that turns natural-language requests into structured cart updates.

## Features

- **Menu** — Browse 30+ bistro items by category (Starters, Mains, Sides, Drinks, Desserts) with tags and quantity controls.
- **Cart** — Rich line items, tax estimate, order summary, and **recent order history** from the database.
- **AI waiter** — Chat in plain English; Claude updates the cart with structured actions. Suggested prompts and popular-item chips included.
- **AI caching** — Repeated questions reuse saved answers (server file cache + mobile memory) to reduce API calls and cost.
- **Orders API** — `POST /api/orders` to place orders, `GET /api/orders` to list recent orders.

## Folder Structure

```text
apps/
  api/      Express + TypeScript REST API, Prisma, PostgreSQL, Anthropic Claude
  mobile/   Expo React Native app (Expo Router tabs: Menu, Cart, AI Order)
docker-compose.yml   Local PostgreSQL
```

## Prerequisites

- Node.js 18+
- Docker Desktop (for local PostgreSQL)
- [Expo Go](https://expo.dev/go) on your phone (SDK 54)
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

## Setup

1. Clone the repo.
2. Run `npm install` at the root.
3. Copy `apps/api/.env.example` to `apps/api/.env` and set your `ANTHROPIC_API_KEY`.
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env`.
5. Start Docker Desktop, then run:
   ```powershell
   npm run db:up
   npm run setup:db
   ```
6. Start the API (terminal 1):
   ```powershell
   npm run dev:api
   ```
7. Start the mobile app (terminal 2):
   ```powershell
   npm run dev:mobile
   ```

Default database URL (no change needed for local dev):

```env
DATABASE_URL=postgresql://bistro:bistro@localhost:5432/intelligent_bistro?schema=public
```

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description |
| --- | --- |
| `PORT` | API port (default `3001`) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |
| `ANTHROPIC_MODEL` | Claude model id (default `claude-sonnet-4-6`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGIN` | CORS origin (`*` for development) |
| `AI_CACHE_ENABLED` | Enable AI response cache (`true` / `false`) |
| `AI_CACHE_TTL_MS` | Cache lifetime in ms (default `3600000` = 1 hour) |
| `AI_REQUEST_TIMEOUT_MS` | Anthropic request timeout (default `60000`) |
| `AI_MAX_RETRIES` | Retries on network failure (default `3`) |

### Mobile (`apps/mobile/.env`)

| Variable | Description |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API base URL |

**Emulator / simulator:**

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

**Physical device** (use your computer's LAN IP):

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api
```

## How To Test

```powershell
# Database
npm run db:up
npm run setup:db

# API health
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health

# Menu from PostgreSQL
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/menu

# Mobile
npm run dev:mobile
```

In the app:

1. **Menu** — Items load from the API; filter by category; add to cart.
2. **Cart** — Review line items and summary; place order; see **Recent orders** below.
3. **AI Order** — Tap a suggestion or popular item, or type e.g. `Add a bistro burger and sparkling water`.
4. Repeat the same AI message — should respond faster with **Saved reply** when cached.

```powershell
npm run db:studio
```

Open Prisma Studio to verify orders in the database.

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/menu` | Full menu (optional `?category=`) |
| `POST` | `/api/orders` | Place order from cart items |
| `GET` | `/api/orders` | List recent orders |
| `POST` | `/api/ai/parse` | Parse a single order phrase → cart actions |
| `POST` | `/api/ai/chat` | Multi-turn AI waiter chat |

AI responses may include `"cached": true` when served from cache. The `X-AI-Cache: HIT` header is set on cached server responses.

## AI Response Caching

Caching avoids calling Anthropic for identical requests:

| Layer | Location | Notes |
| --- | --- | --- |
| Server | `apps/api/.cache/ai-responses.json` | Keyed by message + cart + menu fingerprint; TTL configurable |
| Mobile | In-memory | Same chat + cart returns instantly without a network call |

If Anthropic is unreachable but a stale cache entry exists, the API returns the last saved answer.

**Disable cache:** set `AI_CACHE_ENABLED=false` in `apps/api/.env`.

## Troubleshooting

### Expo: `TypeError: fetch failed` on `npm run dev:mobile`

Expo CLI is trying to reach expo.dev for version checks. The project uses **offline mode** by default:

```powershell
npm run dev:mobile          # uses expo start --offline
npm run start:online --workspace=apps/mobile   # when you have internet
```

### Expo: "Welcome to Expo" / empty app

Run from the repo root with `npm run dev:mobile`, not from `apps/` alone. The mobile app uses Expo Router with `app/` under `apps/mobile`. If issues persist, clear cache: the start script already passes `--clear`.

### AI: `fetch failed` or 500 from `/api/ai/chat`

1. Confirm `ANTHROPIC_API_KEY` in `apps/api/.env` is valid.
2. Confirm the API machine has internet (firewall/VPN can block `api.anthropic.com`).
3. Use `ANTHROPIC_MODEL=claude-sonnet-4-6` (older ids like `claude-sonnet-4-20250514` may 404).
4. Restart the API after changing `.env`.
5. Retry the same message — caching may return a saved reply if the first call succeeded once.

### Mobile cannot reach API on a real device

`localhost` on the phone points to the phone, not your PC. Set `EXPO_PUBLIC_API_URL` to your computer's LAN IP and ensure port `3001` is allowed on Windows Firewall.

### Port 8081 already in use

Press `y` when Expo asks for another port, or stop the other Metro process.

## Code Overview

### Backend

| File | Purpose |
| --- | --- |
| `apps/api/src/index.ts` | Express app, middleware, routes |
| `apps/api/src/routes/menu.ts` | Menu from PostgreSQL |
| `apps/api/src/routes/orders.ts` | Create and list orders |
| `apps/api/src/routes/ai.ts` | AI parse + chat endpoints |
| `apps/api/src/services/aiService.ts` | Anthropic client, retries, cache integration |
| `apps/api/src/services/aiCache.ts` | File-backed AI response cache |
| `apps/api/src/services/orderService.ts` | Order persistence |
| `apps/api/src/data/menu.json` | Seed data for Prisma |

### Mobile

| File | Purpose |
| --- | --- |
| `apps/mobile/app/(tabs)/index.tsx` | Menu screen |
| `apps/mobile/app/(tabs)/cart.tsx` | Cart, checkout, order history |
| `apps/mobile/app/(tabs)/chat.tsx` | AI waiter, suggestions, popular items |
| `apps/mobile/babel.config.js` | Expo Router babel plugin (monorepo-safe) |
| `apps/mobile/metro.config.js` | Monorepo Metro config |
| `apps/mobile/src/store/cartStore.ts` | Cart state (Zustand) |
| `apps/mobile/src/store/ordersStore.ts` | Order history state |
| `apps/mobile/src/api/client.ts` | HTTP client + client-side AI cache |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev:api` | Start API with nodemon |
| `npm run dev:mobile` | Start Expo (offline) |
| `npm run db:up` | Start PostgreSQL in Docker |
| `npm run setup:db` | Generate Prisma client, push schema, seed menu |
| `npm run db:seed` | Re-seed menu after editing `menu.json` |
| `npm run db:studio` | Open Prisma Studio |

## License

Private / internship project — see repository owner for usage terms.
