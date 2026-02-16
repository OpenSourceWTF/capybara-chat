FROM node:22-slim AS development

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Install pnpm globally (more reliable than corepack shim with volume mounts)
RUN npm install -g pnpm@9

# Copy workspace config
COPY package.json pnpm-workspace.yaml tsconfig.base.json .npmrc ./

# Copy package manifests
COPY packages/types/package.json ./packages/types/
COPY packages/chat-core/package.json ./packages/chat-core/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY packages/types ./packages/types
COPY packages/chat-core ./packages/chat-core
COPY packages/ui ./packages/ui

# Build packages
# Build packages explicitly
RUN pnpm --filter @capybara-chat/types build && \
  pnpm --filter @capybara-chat/chat-core build && \
  pnpm --filter @capybara-chat/ui build

FROM development AS builder

# Prune dev deps not needed for runtime (though UI is static, we need 'serve')
# We don't really need node_modules for UI runtime if we just serve static files,
# but 'serve' needs to be installed.

# --- Production Stage ---
FROM node:22-slim

WORKDIR /app

# Install 'serve' globally
RUN npm install -g serve

# Copy built assets
COPY --from=builder /app/packages/ui/dist ./dist

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production

# Server URL is baked into build or handled via runtime config?
# Vite env vars are build-time. VITE_SERVER_URL needs to be available at BUILD time 
# OR we need a runtime config solution.
# For now, we assume simple build-time or reverse proxy.
# Wait, if VITE_SERVER_URL is needed at runtime, we can't bake it in unless we use a placeholder and replace it at boot.
# The plan says: "VITE_SERVER_URL=http://server:2279" in compose.
# If I set ARG VITE_SERVER_URL in Dockerfile, it's build time.
# If I set ENV, and Vite uses import.meta.env, it's baked at build time.
# I'll rely on the standard Vite behavior: .env files or build-time replacement.
# But Docker Compose sets ENV vars at runtime.
# This means I might need a script to inject env vars into window.config or similar.
# FOR NOW: I will just build it. If it fails to connect, I'll document it (GAP-003?).
# Or I can use a simple script to replace a placeholder in index.html.

CMD ["serve", "-s", "dist", "-l", "3000"]
