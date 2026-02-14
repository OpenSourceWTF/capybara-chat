FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
# Install build tools for native modules (better-sqlite3)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update && apt-get install -y python3 make g++
WORKDIR /app

# 1. Copy dependency manifests FIRST (Docker layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/server/package.json ./packages/server/

# 2. Install dependencies (cached until package.json changes)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 3. Copy source code
COPY packages/types/ ./packages/types/
COPY packages/server/ ./packages/server/

# 4. Build
RUN pnpm --filter @capybara-chat/types build && \
  pnpm --filter @capybara-chat/server build

# ─── Production stage ────────────────────────────────────────────────────────
FROM base AS runner
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update && apt-get install -y git curl python3 make g++
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/server/package.json ./packages/server/

# Install production dependencies only (with native rebuild)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/types/dist/ ./packages/types/dist/
COPY --from=builder /app/packages/server/dist/ ./packages/server/dist/

# Create data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/capybara-chat.db
EXPOSE 2279

CMD ["node", "packages/server/dist/server.js"]
