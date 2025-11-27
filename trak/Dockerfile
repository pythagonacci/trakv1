# syntax=docker/dockerfile:1

# Base image with Node.js (matches .nvmrc)
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Build the Next.js app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
COPY start.sh ./start.sh

RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["./start.sh"]
