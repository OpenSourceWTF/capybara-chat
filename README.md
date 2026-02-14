# Capybara Chat

Standalone AI chat application with multi-backend CLI support. Derived from the [Capybara](https://github.com/OpenSourceWTF/capybara) project.

## Architecture

Three containers:
- **Server** (port 2279): Express + Socket.IO + SQLite — session/message persistence, socket routing
- **Bridge** (port 2280): GenericCLIProvider — spawns and manages CLI agent processes  
- **UI** (port 3000): React + Vite chat frontend

## Quick Start

```bash
# Clone and install
pnpm install

# Run with Docker
docker compose -f docker/compose.yaml -f docker/compose.dev.yaml up --build

# Or run locally
pnpm build && pnpm dev:local
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | API key for Claude CLI |
| `DATABASE_PATH` | No | SQLite database path (default: `./data/capybara-chat.db`) |
| `SERVER_URL` | No | Server URL for bridge (default: `http://localhost:2279`) |
| `BRIDGE_API_KEY` | No | API key for bridge↔server auth |

## Packages

| Package | Description |
|---------|-------------|
| `@capybara-chat/types` | Shared TypeScript types |
| `@capybara-chat/agent-sdk` | Agent provider interfaces |
| `@capybara-chat/cli-provider` | GenericCLIProvider for multi-backend CLI |
| `@capybara-chat/server` | Express + Socket.IO server |
| `@capybara-chat/bridge` | Agent bridge (CLI orchestrator) |
| `@capybara-chat/chat-core` | React hooks for chat UI |
| `@capybara-chat/ui` | Chat frontend (React + Vite) |

## License

MIT
