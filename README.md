# PersonaHub

A persona library for sales and marketing teams with AI-powered interview simulation. Store detailed customer profiles, enrich them with context from real calls and meetings, then run training interviews with any persona — right in the browser.

---

## Features

- **Persona dossiers** — rich customer profiles: pain points, objections, catchphrases, career, social environment
- **AI interviews** — simulate sales conversations with a persona powered by Anthropic Claude
- **Context & opinions** — attach notes from real calls; the AI factors them into every interview
- **Interview summaries** — auto-generated markdown recap after each session
- **JSON import** — import personas from a structured JSON file via the built-in import page
- **Chrome extension** — add context and opinions directly from the browser during a live call
- **MCP server** — Claude Desktop integration to query and manage personas through chat

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| AI | Anthropic Claude (claude-sonnet) |
| Monorepo | pnpm workspaces |

---

## Repository structure

```
artifacts/
  persona-hub/        # React frontend
  api-server/         # Express API server
  chrome-extension/   # Chrome extension
  mcp-server/         # MCP server for Claude Desktop
lib/
  db/                 # Drizzle schema and migrations
  api-spec/           # OpenAPI specification
```

---

## Environment variables

### API server (`artifacts/api-server`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (`postgresql://user:pass@host/db`) |
| `PH_SECRET` | ✅ | Secret passphrase for authorized operations (import, delete personas) |
| `SESSION_SECRET` | ✅ | Secret used to sign sessions |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | ✅ | Anthropic API key (Claude) |
| `PORT` | — | Server port (defaults to `8080`) |

### Chrome extension

Configure manually in the extension settings:

- **API Base URL** — your API server address (e.g. `https://your-app.replit.app/api`)
- **Secret** — the value of `PH_SECRET`

### MCP server (`artifacts/mcp-server`)

| Variable | Required | Description |
|---|---|---|
| `PH_API_BASE` | ✅ | API base URL (e.g. `https://your-app.replit.app/api`) |
| `PH_SECRET` | ✅ | Secret passphrase (same value as on the server) |

---

## What's included

### Sample personas
Two demo personas are bundled out of the box so you can explore the app without importing anything:

- **Marina** — retail banking client, credit card segment
- **Artyom** — aviation industry, AI-transformation director

They live as static JSON fixtures and are always available regardless of database state.

### Chrome extension
The `artifacts/chrome-extension/` folder contains a ready-to-load unpacked extension. No build step required — load it directly in Chrome developer mode.

---

## Quick start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up the database

```bash
pnpm --filter @workspace/db run migrate
```

### 3. Run in development mode

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Frontend
pnpm --filter @workspace/persona-hub run dev
```

---

## Chrome extension

The extension lets you add context notes and personal opinions about a persona directly from the browser — for example, while browsing LinkedIn or during a live call.

**Installation:**
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `artifacts/chrome-extension` folder
4. Enter your API URL and secret passphrase in the extension settings

---

## MCP server (Claude Desktop)

The MCP server lets you work with personas through Claude Desktop — fetch dossiers, import new personas, and add context straight from the chat interface.

Add the following to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "persona-hub": {
      "command": "node",
      "args": ["/path/to/artifacts/mcp-server/index.js"],
      "env": {
        "PH_API_BASE": "https://your-deployment.replit.app/api",
        "PH_SECRET": "your-secret-phrase"
      }
    }
  }
}
```

---

## Authorization

Protected operations (importing, deleting personas, adding notes via the extension) require a Bearer token:

```
Authorization: Bearer <PH_SECRET>
```

The token is entered directly in the UI when needed, or pre-configured in the extension and MCP server settings.
