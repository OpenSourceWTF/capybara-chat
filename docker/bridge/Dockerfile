FROM node:22-slim AS development

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y git curl python3 make g++ gosu && rm -rf /var/lib/apt/lists/*
# Install pnpm globally (more reliable than corepack shim with volume mounts)
RUN npm install -g pnpm@9

# Copy workspace config
COPY package.json pnpm-workspace.yaml tsconfig.base.json .npmrc ./

# Copy package manifests
COPY packages/types/package.json ./packages/types/
COPY packages/agent-sdk/package.json ./packages/agent-sdk/
COPY packages/cli-provider/package.json ./packages/cli-provider/
COPY packages/bridge/package.json ./packages/bridge/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY packages/types ./packages/types
COPY packages/agent-sdk ./packages/agent-sdk
COPY packages/cli-provider ./packages/cli-provider
COPY packages/bridge ./packages/bridge

# Build packages
# Build packages (explicit types build first to avoid TS7016 in hoisted mode)
# Build packages (explicit sequence to ensure dependencies are ready)
RUN pnpm --filter @capybara-chat/types build && \
  pnpm --filter @capybara-chat/agent-sdk build && \
  pnpm --filter @capybara-chat/cli-provider build && \
  pnpm --filter @capybara-chat/bridge build

# --- Builder Stage (Pruned) ---
FROM development as builder

# Deploy bridge to /prod/bridge (creates isolated production build)
RUN pnpm --filter @capybara-chat/bridge deploy --prod /prod/bridge

# Copy missing dist artifacts for all dependencies
# Copy missing dist artifacts for all dependencies (remove potential symlinks first)
RUN rm -rf /prod/bridge/node_modules/@capybara-chat/types/dist \
  && mkdir -p /prod/bridge/node_modules/@capybara-chat/types/dist \
  && cp -r /app/packages/types/dist/* /prod/bridge/node_modules/@capybara-chat/types/dist/

RUN rm -rf /prod/bridge/node_modules/@capybara-chat/agent-sdk/dist \
  && mkdir -p /prod/bridge/node_modules/@capybara-chat/agent-sdk/dist \
  && cp -r /app/packages/agent-sdk/dist/* /prod/bridge/node_modules/@capybara-chat/agent-sdk/dist/

RUN rm -rf /prod/bridge/node_modules/@capybara-chat/cli-provider/dist \
  && mkdir -p /prod/bridge/node_modules/@capybara-chat/cli-provider/dist \
  && cp -r /app/packages/cli-provider/dist/* /prod/bridge/node_modules/@capybara-chat/cli-provider/dist/

RUN rm -rf /prod/bridge/dist \
  && mkdir -p /prod/bridge/dist \
  && cp -r /app/packages/bridge/dist/* /prod/bridge/dist/

# --- Production Stage ---
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies: docker.io (for sibling containers), git (for repos), curl
RUN apt-get update && apt-get install -y docker.io git curl procps && rm -rf /var/lib/apt/lists/*

# Install global Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN groupadd -g 1500 capybara && \
  useradd -u 1500 -g capybara -m -s /bin/bash capybara

# Set up working directory permissions
RUN chown -R capybara:capybara /app

# Copy entrypoint script
COPY docker/bridge/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Switch to root to allow entrypoint to chown
USER root

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/bridge.js"]
