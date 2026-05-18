# Build from repo root: docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/src ./apps/api/src

# Use install (not ci) so workspace-only install works with the monorepo lockfile
RUN npm install --workspace=apps/api
RUN npm run db:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner

WORKDIR /app/apps/api

RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/src ./src
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/docker-entrypoint.sh /entrypoint.sh

RUN npm install -g prisma@6.19.3 ts-node@10.9.2 typescript@5.7.2

RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
