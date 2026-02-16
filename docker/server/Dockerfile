FROM node:22-slim AS development

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ git curl && rm -rf /var/lib/apt/lists/*

# Install pnpm globally (more reliable than corepack shim with volume mounts)
RUN npm install -g pnpm@9

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml tsconfig.base.json .npmrc ./

# Copy package manifests first for better caching
COPY packages/types/package.json ./packages/types/
COPY packages/server/package.json ./packages/server/

# Install dependencies (frozen lockfile not strict because we are selectively copying)
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY packages/types ./packages/types
COPY packages/server ./packages/server

# Build packages
RUN find packages/types/src -name "*.js" -o -name "*.d.ts" -type f -delete && \
  pnpm -r build

# --- Builder Stage (Pruned) ---
FROM development as builder

# Deploy server to /prod/server (creates isolated production build)
RUN pnpm --filter @capybara-chat/server deploy --prod /prod/server

# Copy missing dist artifacts (because they are ignored by pack/deploy)
# Ensure destination directories exist
RUN rm -rf /prod/server/node_modules/@capybara-chat/types/dist \
  && mkdir -p /prod/server/node_modules/@capybara-chat/types/dist \
  && cp -r /app/packages/types/dist/* /prod/server/node_modules/@capybara-chat/types/dist/
RUN rm -rf /prod/server/dist \
  && mkdir -p /prod/server/dist \
  && cp -r /app/packages/server/dist/* /prod/server/dist/ \
  && cp /app/packages/server/src/db/schema.sql /prod/server/dist/db/schema.sql

# --- Production Stage ---
FROM node:22-slim

WORKDIR /app

# improve sqlite3 compatibility
RUN apt-get update && apt-get install -y python3 && rm -rf /var/lib/apt/lists/*

# Copy deployed server
COPY --from=builder /prod/server .
# Also copy node_modules inside packages if they exist (hoisting usually prevents this but safe to check)
# In pnpm workspaces, deps are usually hoisted.

EXPOSE 2279

ENV NODE_ENV=production
# Default database path (can be overridden)
ENV DATABASE_PATH=/data/capybara-chat.db

CMD ["node", "dist/index.js"]
