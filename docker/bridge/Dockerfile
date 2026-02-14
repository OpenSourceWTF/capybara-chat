FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# Install docker CLI for DIND support, git for Claude CLI
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update && apt-get install -y docker.io git curl jq
# Allow git to work with repos owned by different users
RUN git config --system --add safe.directory '*'

FROM base AS builder
WORKDIR /app

# 1. Copy dependency manifests FIRST (Docker layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/agent-sdk/package.json ./packages/agent-sdk/
COPY packages/cli-provider/package.json ./packages/cli-provider/
COPY packages/bridge/package.json ./packages/bridge/

# 2. Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 3. Copy source code
COPY packages/types/ ./packages/types/
COPY packages/agent-sdk/ ./packages/agent-sdk/
COPY packages/cli-provider/ ./packages/cli-provider/
COPY packages/bridge/ ./packages/bridge/

# 4. Build in dependency order
RUN pnpm --filter @capybara-chat/types build && \
  pnpm --filter @capybara-chat/agent-sdk build && \
  pnpm --filter @capybara-chat/cli-provider build && \
  pnpm --filter @capybara-chat/bridge build

# ─── Production stage ────────────────────────────────────────────────────────
FROM base AS runner

# Create non-root user (Claude CLI requires non-root)
RUN groupadd -g 1500 capybara && \
  useradd -u 1500 -g capybara -m -s /bin/bash capybara

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/agent-sdk/package.json ./packages/agent-sdk/
COPY --from=builder /app/packages/cli-provider/package.json ./packages/cli-provider/
COPY --from=builder /app/packages/bridge/package.json ./packages/bridge/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/types/dist/ ./packages/types/dist/
COPY --from=builder /app/packages/agent-sdk/dist/ ./packages/agent-sdk/dist/
COPY --from=builder /app/packages/cli-provider/dist/ ./packages/cli-provider/dist/
COPY --from=builder /app/packages/bridge/dist/ ./packages/bridge/dist/

RUN chown -R capybara:capybara /app
USER capybara

ENV NODE_ENV=production
EXPOSE 2280

CMD ["node", "packages/bridge/dist/bridge.js"]
