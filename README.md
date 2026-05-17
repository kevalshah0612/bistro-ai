# The Intelligent Bistro

The Intelligent Bistro is a full-stack restaurant ordering app with an upscale dark-mode mobile experience, a PostgreSQL database, and an AI waiter that turns natural-language requests into structured cart updates.

## Folder Structure

```text
apps/
  api/      Express + TypeScript REST API, Prisma, PostgreSQL, and Anthropic integration
  mobile/   Expo React Native app with menu, cart, and AI chat tabs
docker-compose.yml   Local PostgreSQL database
```

## Setup

1. Clone the repo.
2. Run `npm install` at the root.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. In `apps/api/.env`, replace only `ANTHROPIC_API_KEY` with your real key.
5. Copy `apps/mobile/.env.example` to `apps/mobile/.env`.
6. Start Docker Desktop.
7. Run `npm run db:up`.
8. Run `npm run setup:db`.
9. Run `npm run dev:api` in one terminal.
10. Run `npm run dev:mobile` in another terminal.

The default database configuration is already set for local development:

```env
DATABASE_URL=postgresql://bistro:bistro@localhost:5432/intelligent_bistro?schema=public
```

You only need to change it if you use a hosted PostgreSQL database such as Neon, Supabase, Railway, or Render.

## How To Test

Start the database and seed it:

```powershell
npm run db:up
npm run setup:db
```

Start the API:

```powershell
npm run dev:api
```

Check the API health endpoint:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health
```

Check menu data coming from PostgreSQL:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/menu
```

Start the mobile app:

```powershell
npm run dev:mobile
```

In Expo, open the app and test:

1. Menu tab: confirm menu items load from the API.
2. Cart tab: add items, change quantities, and press `Place Order`.
3. AI Order tab: type `Add a burger and two waters`.
4. Prisma Studio: run `npm run db:studio` and confirm orders appear in the database.

On a real device, set `apps/mobile/.env` to your computer's local network IP:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3001/api
```

## Environment Variables

| Location | Variable | Description |
| --- | --- | --- |
| `apps/api/.env` | `PORT` | API port, defaults to `3001` |
| `apps/api/.env` | `ANTHROPIC_API_KEY` | Anthropic API key used by the AI waiter |
| `apps/api/.env` | `CORS_ORIGIN` | Allowed CORS origin, use `*` in development |
| `apps/api/.env` | `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` | API base URL, for example `http://localhost:3001/api` |

## Database

The app uses PostgreSQL with Prisma.

Important files:

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Runs local PostgreSQL with database `intelligent_bistro` |
| `apps/api/prisma/schema.prisma` | Defines `Category`, `MenuItem`, `Order`, and `OrderItem` tables |
| `apps/api/prisma/seed.ts` | Loads the starter bistro menu into PostgreSQL |
| `apps/api/src/db/prisma.ts` | Creates the shared Prisma client |
| `apps/api/src/services/menuService.ts` | Reads menu items from PostgreSQL |
| `apps/api/src/services/orderService.ts` | Saves checkout orders and order items |

The old `apps/api/src/data/menu.json` file is now seed data only. Runtime menu reads come from PostgreSQL.

## Code Overview

Backend:

| File | Logic |
| --- | --- |
| `apps/api/src/index.ts` | Express setup, middleware, health check, and API route mounting |
| `apps/api/src/routes/menu.ts` | `GET /api/menu` and category filtering from the database |
| `apps/api/src/routes/orders.ts` | `POST /api/orders` saves placed cart orders |
| `apps/api/src/routes/ai.ts` | Validates AI requests and passes database menu data to Claude |
| `apps/api/src/services/aiService.ts` | Calls Anthropic and extracts structured cart actions |

Mobile:

| File | Logic |
| --- | --- |
| `apps/mobile/app/(tabs)/index.tsx` | Menu UI, category filters, add/remove item controls |
| `apps/mobile/app/(tabs)/cart.tsx` | Cart UI, quantity controls, checkout saved to PostgreSQL |
| `apps/mobile/app/(tabs)/chat.tsx` | AI waiter chat UI and cart updates from AI actions |
| `apps/mobile/src/store/cartStore.ts` | Zustand cart state and cart action application |
| `apps/mobile/src/store/chatStore.ts` | Zustand chat history/loading state |
| `apps/mobile/src/api/client.ts` | Axios calls to menu, AI, and order endpoints |

## Expo Go

The mobile app uses Expo SDK 54, so install the current Expo Go app from the app store. If Expo asks to use a different Metro port, type `y` and scan the QR code it prints.
