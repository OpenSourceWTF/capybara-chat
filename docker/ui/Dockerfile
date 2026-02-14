FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app

# 1. Copy dependency manifests FIRST (Docker layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/chat-core/package.json ./packages/chat-core/
COPY packages/ui/package.json ./packages/ui/

# 2. Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 3. Copy source code
COPY packages/types/ ./packages/types/
COPY packages/chat-core/ ./packages/chat-core/
COPY packages/ui/ ./packages/ui/

# 4. Build
RUN pnpm --filter @capybara-chat/types build && \
  pnpm --filter @capybara-chat/chat-core build && \
  pnpm --filter @capybara-chat/ui build

# ─── Production stage ────────────────────────────────────────────────────────
FROM node:22-slim AS runner
RUN npm install -g serve
WORKDIR /app

COPY --from=builder /app/packages/ui/dist/ ./dist/

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
