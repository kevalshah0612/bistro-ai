# Build from repo root: docker build -f apps/mobile/Dockerfile .
# Serves the Expo web export for browser demos and screen recordings.
FROM node:20-alpine AS builder

WORKDIR /app

ARG EXPO_PUBLIC_API_URL=http://localhost:3001/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV CI=1

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/mobile/app.json ./apps/mobile/
COPY apps/mobile/app ./apps/mobile/app
COPY apps/mobile/babel.config.js ./apps/mobile/
COPY apps/mobile/metro.config.js ./apps/mobile/
COPY apps/mobile/tsconfig.json ./apps/mobile/
COPY apps/mobile/tailwind.config.js ./apps/mobile/
COPY apps/mobile/nativewind-env.d.ts ./apps/mobile/
COPY apps/mobile/src ./apps/mobile/src

RUN npm install --workspace=apps/mobile
WORKDIR /app/apps/mobile
RUN npx expo export --platform web --output-dir dist

FROM nginx:alpine AS runner

COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

EXPOSE 80
