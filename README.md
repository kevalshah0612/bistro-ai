# The Intelligent Bistro

Full-stack restaurant ordering app: dark-mode mobile UI (Expo), PostgreSQL, REST API, and an **AI waiter** (Claude) that turns natural language into cart updates.

## What it does

| Area | Functionality |
| --- | --- |
| **Menu** | 30+ items by category (Starters, Mains, Sides, Drinks, Desserts), tags, quantity controls |
| **Cart** | Line items, tax estimate, checkout, **recent orders** from the database |
| **AI waiter** | Chat in plain English; suggested prompts and popular-item chips; cart updates via structured actions |
| **AI cache** | Server file cache + mobile memory — repeated questions skip Anthropic (lower cost, faster) |
| **API** | Menu, orders, health, AI parse/chat — see [API endpoints](#api-endpoints) |

## How to run (pick one)

| Goal | Commands | Opens |
| --- | --- | --- |
| **Browser only** (all in Docker) | `copy .env.docker.example .env.docker` → edit key → `npm run docker:demo` | http://localhost:8080 |
| **Backend in Docker + phone (QR)** | `npm run docker:up` then `npm run dev:mobile` | Expo QR in terminal → **Expo Go** |
| **Full local dev** (no Docker API) | `npm run db:up` → `npm run setup:db` → `npm run dev:api` + `npm run dev:mobile` | API :3001, Expo QR |

**Important:** `npm run docker:up` starts **Postgres + API only** (no QR, no UI). The QR code comes from `npm run dev:mobile` on your PC. For a website without Expo, use `npm run docker:demo` instead.

```text
docker:up     →  Postgres + API (:3001)
docker:demo   →  above + static web UI (:8080)  ← browser, one command
dev:mobile    →  Expo Metro + QR               ← Android/iOS via Expo Go
```

## Docker (recommended for demos)

### 1. Secrets — use `.env.docker` only

```powershell
copy .env.docker.example .env.docker
```

Edit `.env.docker` and set `ANTHROPIC_API_KEY`. Docker Compose loads **this file** into the API container.

- Do **not** rely on a root `.env` for Docker — secrets live in `.env.docker`.
- `DATABASE_URL` in `.env.docker` is **ignored** in Docker; the API always uses the Postgres container in the stack.
- Put only API/AI settings in `.env.docker` (see `.env.docker.example`).

### 2. Backend only

```powershell
npm install
npm run docker:up
```

| Service | URL |
| --- | --- |
| PostgreSQL | `localhost:5432` |
| API | http://localhost:3001 |

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/menu
npm run docker:logs    # API logs
npm run docker:down    # stop
```

### 3. Browser demo (no phone, no QR)

```powershell
npm run docker:demo
```

| Service | URL |
| --- | --- |
| Web app | http://localhost:8080 |
| API | http://localhost:3001 |

First build can take several minutes (Expo web export + nginx). Use F12 → device toolbar for a phone-sized window.

### 4. Android / Expo Go (Docker API + host Expo)

1. `npm run docker:up`
2. Find your development machine’s **LAN hostname or address** on the same network as the phone (e.g. `ipconfig` on Windows, `ip addr` on Linux). Do not commit this value to git.
3. `apps/mobile/.env` — point the app at the API on your machine (not `localhost`; on a physical device, `localhost` is the phone itself):
   ```env
   EXPO_PUBLIC_API_URL=http://<your-dev-machine-host>:3001/api
   ```
4. Phone and PC on the same Wi‑Fi; allow inbound port **3001** in the host firewall if needed.
5. `npm run dev:mobile` → scan QR with **[Expo Go](https://expo.dev/go)** (SDK 54)

Press **`w`** in the Expo terminal to open web locally (optional; uses host Expo, not `docker:demo`).

### Architecture

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Web :8080  │────▶│  API :3001  │────▶│ Postgres     │
│ docker:demo │     │  (Docker)   │     │  (Docker)    │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
              Expo Go ← dev:mobile (your laptop, not Docker)
```

## Local development (without Docker API)

1. `npm install` at repo root
2. `copy apps\api\.env.example apps\api\.env` — set `ANTHROPIC_API_KEY`
3. `copy apps\mobile\.env.example apps\mobile\.env` — set `EXPO_PUBLIC_API_URL`
4. Docker Desktop on → `npm run db:up` → `npm run setup:db`
5. Terminal 1: `npm run dev:api` · Terminal 2: `npm run dev:mobile`

Default DB URL for local API:

```env
DATABASE_URL=postgresql://bistro:bistro@localhost:5432/intelligent_bistro?schema=public
```

## Project layout

```text
apps/
  api/      Express + TypeScript, Prisma, PostgreSQL, Anthropic
  mobile/   Expo Router (Menu, Cart, AI Order tabs)
docker-compose.yml
.env.docker.example  →  copy to .env.docker for Docker
```

## Code map

High-level flow: **mobile screens** → **Zustand stores** → **`src/api/client.ts`** → **Express routes** → **services** → **Postgres / Anthropic**.

### Backend (`apps/api`)

| File | Role |
| --- | --- |
| `src/index.ts` | Express entry: middleware, `/health`, route mounts, error handler |
| `src/routes/menu.ts` | `GET /api/menu`, `GET /api/menu/:category` |
| `src/routes/orders.ts` | `GET` / `POST /api/orders` |
| `src/routes/ai.ts` | `POST /api/ai/parse`, `POST /api/ai/chat` (Zod validation, cache headers) |
| `src/services/menuService.ts` | Menu reads from Postgres |
| `src/services/orderService.ts` | Create orders, list recent orders |
| `src/services/aiService.ts` | Anthropic calls, prompts, JSON cart actions |
| `src/services/aiCache.ts` | Server-side AI response cache (disk + memory) |
| `src/schemas/menu.ts` | Shared types: `MenuItem`, `CartAction` (`ADD` / `REMOVE` / `UPDATE_QTY`) |
| `src/db/prisma.ts` | Prisma client |
| `src/data/menu.json` | Seed catalog |
| `prisma/schema.prisma` | `Category`, `MenuItem`, `Order`, `OrderItem` |
| `prisma/seed.ts` | Loads `menu.json` into the database |

### Mobile (`apps/mobile`)

| File | Role |
| --- | --- |
| `app/(tabs)/index.tsx` | **Menu** tab: categories, tags, quantity controls |
| `app/(tabs)/cart.tsx` | **Cart** tab: checkout, tax estimate, recent orders |
| `app/(tabs)/chat.tsx` | **AI Order** tab: chat UI, applies AI cart actions |
| `app/(tabs)/_layout.tsx` | Bottom tabs and cart badge |
| `src/store/cartStore.ts` | Cart state and `applyActions` from AI |
| `src/store/chatStore.ts` | Chat messages and loading |
| `src/store/ordersStore.ts` | Order history from API |
| `src/api/client.ts` | HTTP client: menu, orders, AI chat |
| `src/api/aiClientCache.ts` | In-memory AI cache per session |
| `src/types/index.ts` | Shared TypeScript types |
| `src/utils/menu.ts` | Formatting, suggestions, popular items |
| `src/components/Screen.tsx` | Shared screen wrapper |
| `src/components/OrderStatusBadge.tsx` | Order status display |

### Typical flows

- **Browse & add:** Menu tab → `fetchMenu` → `cartStore.addItem`
- **Checkout:** Cart tab → `placeOrder` → Postgres → recent orders list
- **AI order:** Chat tab → `sendChatMessage` → `aiService` → `cartStore.applyActions`

The **chat** endpoint powers the AI Order tab. **`/api/ai/parse`** is available for one-shot parsing; the mobile client exposes it but the current UI uses chat only.

## Environment variables

### Docker (`.env.docker` at repo root)

| Variable | Description |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for AI |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-4-6` |
| `AI_CACHE_ENABLED` | `true` / `false` |
| `AI_CACHE_TTL_MS` | Cache TTL (default 1 hour) |
| `AI_REQUEST_TIMEOUT_MS` | Anthropic timeout |
| `AI_MAX_RETRIES` | Network retries |
| `CORS_ORIGIN` | Default `*` for dev |

### API (`apps/api/.env`) — local `dev:api` only

Same AI/cache/CORS vars as above, plus `PORT`, `DATABASE_URL` (localhost Postgres).

### Mobile (`apps/mobile/.env`)

| Variable | When |
| --- | --- |
| `EXPO_PUBLIC_API_URL=http://localhost:3001/api` | Emulator, simulator, or Expo web on the same machine as the API |
| `EXPO_PUBLIC_API_URL=http://<your-dev-machine-host>:3001/api` | Physical device — use your machine’s LAN hostname or address (see [Expo Go setup](#4-android--expo-go-docker-api--host-expo)); keep out of version control |

## Scripts

| Command | Description |
| --- | --- |
| `npm run docker:up` | Postgres + API in Docker (background) |
| `npm run docker:demo` | Above + web UI on :8080 |
| `npm run docker:down` | Stop Docker stack |
| `npm run docker:logs` | Follow API container logs |
| `npm run docker:ps` | Container status |
| `npm run dev:api` | API with nodemon (local) |
| `npm run dev:mobile` | Expo dev server (offline) + QR |
| `npm run db:up` | Postgres only (local dev) |
| `npm run setup:db` | Prisma generate, push, seed |
| `npm run db:seed` | Re-seed from `menu.json` |
| `npm run db:studio` | Prisma Studio |

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/menu` | Menu (`?category=` optional) |
| `POST` | `/api/orders` | Place order |
| `GET` | `/api/orders` | Recent orders |
| `POST` | `/api/ai/parse` | Single phrase → cart actions |
| `POST` | `/api/ai/chat` | Multi-turn AI waiter |

Cached responses may include `"cached": true` and header `X-AI-Cache: HIT`.

## AI caching

| Layer | Location |
| --- | --- |
| Server | `apps/api/.cache/` (Docker volume `bistro-ai-cache`) |
| Mobile | In-memory per session |

Disable: `AI_CACHE_ENABLED=false` in `apps/api/.env` or `.env.docker`.

## Quick test

```powershell
npm run docker:up
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/menu
```

In the app: load menu → add items → AI chat → place order → check **Recent orders**.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| No QR after `docker:up` | Expected — run `npm run dev:mobile` or use `docker:demo` for browser |
| `ANTHROPIC_API_KEY` warning / AI 500 in Docker | Key must be in **`.env.docker`**, then `npm run docker:down` && `npm run docker:up` |
| Phone can’t reach API | Set `EXPO_PUBLIC_API_URL` to your dev machine’s LAN host (not `localhost`), same Wi‑Fi, firewall port 3001 |
| Expo `fetch failed` on start | Project uses `expo start --offline`; use `npm run start:online --workspace=apps/mobile` if online checks needed |
| Empty / “Welcome to Expo” | Run `npm run dev:mobile` from **repo root** |
| Port 8081 in use | Press `y` for another port or stop other Metro |
| AI errors (local dev) | Valid key in `apps/api/.env`, model `claude-sonnet-4-6`, restart API |

## Demo recording (short)

**Phone:** `docker:up` → set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (local only) → `dev:mobile` → scan QR → record.

**Browser:** `docker:demo` → http://localhost:8080 → record window.

**Loop (~60s):** Menu → AI suggestion → Cart checkout → Recent orders.

Pre-flight: containers healthy, `/health` ok, menu loads, AI responds.

## Prerequisites

- Node.js 18+, Docker Desktop
- [Expo Go](https://expo.dev/go) (SDK 54) for phone testing
- [Anthropic API key](https://console.anthropic.com)

## License

Private / internship project — see repository owner for usage terms.
