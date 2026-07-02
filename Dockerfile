# --- Build stage ---------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Prisma needs OpenSSL to generate its query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage -------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# node_modules from the builder already contains the generated Prisma client,
# the query engine, and the Prisma CLI (used for `migrate deploy` on startup).
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Apply pending migrations, then boot. Safe to run repeatedly.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
