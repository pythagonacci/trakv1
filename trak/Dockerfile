# syntax=docker/dockerfile:1

# Base image with Node.js (matches .nvmrc)
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies
FROM base AS deps
ARG APP_DIR=trak
WORKDIR /app
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json ${APP_DIR}/.npmrc ./
RUN npm ci

# Build the Next.js app
FROM base AS builder
ARG APP_DIR=trak
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY ${APP_DIR}/ .
RUN npm run build

# Runtime image
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# Copy the standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/start.sh ./start.sh

RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["./start.sh"]
