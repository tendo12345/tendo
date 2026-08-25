# Basis MCP server

Exposes the current [Basis](../README.md)-generated design system to AI coding agents
(Claude Code, Cursor, and any other MCP client) over stdio — so an agent can pull real tokens,
palette, typography and component rules straight into its context instead of guessing at them
or having a human paste in an export.

Basis has no backend (see the root `CLAUDE.md`): a generated system is never stored as output,
only as the `GenerateInput` that deterministically reproduces it. This server follows the same
rule. It never invents or caches a system — every tool call re-runs the real engine
(`src/engine/designSystem.ts`) against the exact same dataset the app uses, so what an agent
gets here is never out of sync with what a human would see in the app.

## Tools

- **`get_design_system`** — the full current system as structured JSON: palette, typography,
  spacing/radius/shadow scales, component tokens, the semantic token layer
  (`color.action.primary`, `space.md`, …), and the reasoning behind every choice.
- **`export_tokens`** — converts the current system into one export format: `json`,
  `css-variables`, `tailwind-config`, or `style-dictionary`. Uses the exact same converters as
  the app's own Export pane (`src/lib/exportFormatters.ts`), so output here always matches
  what "Download" produces in the UI.
- **`list_components`** — the component rules/variants in the current system: resting tokens
  for Button/Card/Input/Modal, each property's binding to a semantic token, and the full
  interaction-state set (hover/focus/active/disabled/loading/success/error) for Button and
  Input.

All three tools accept optional `productType` / `industry` / `keywords` / `region` arguments
to generate a *different* system for that one call, without touching your project's
configured one.

## What "the current system" means

Resolved in this order:

1. **Tool call arguments**, if the agent passed `productType`.
2. **Environment variables** — `BASIS_PRODUCT_TYPE`, `BASIS_INDUSTRY`,
   `BASIS_KEYWORDS` (comma-separated), `BASIS_REGION`. Set these in the MCP client's `env`
   config (see below) to point the server at your project's system without a file.
3. **`basis.config.json`** at the repo root (or a path in `BASIS_CONFIG_PATH`), shaped exactly
   like the engine's `GenerateInput`:

   ```json
   {
     "productType": "b2b analytics dashboard",
     "industry": "finance",
     "keywords": ["data-dense", "professional"],
     "region": "Nigeria"
   }
   ```

4. A **built-in fallback** (`fintech mobile app`, keywords `trustworthy modern minimal` — the
   same query behind the landing page's sample system), so the server always returns a real
   generated system, never an error, even in a repo that hasn't configured anything yet.

Every tool response includes `source`, telling you which of the four this call actually used.

## Running it standalone (local testing)

From the repo root:

```bash
npm run mcp
```

This runs the TypeScript source directly via `tsx` — fastest loop for local testing, talks
JSON-RPC over stdio. Test it manually by piping a request, or use an MCP inspector:

```bash
npx @modelcontextprotocol/inspector npm run mcp
```

## Registering with Claude Code or Cursor

Both clients spawn the server as a child process and speak MCP over its stdio, so the config
shape is the same. Build the standalone bundle first — this compiles everything (the engine,
the dataset, the export converters) into one `dist/index.js` that runs with plain `node`, no
`tsx` or source checkout needed at runtime beyond `@modelcontextprotocol/sdk` and `zod`:

```bash
cd mcp-server
npm install
npm run build
```

Then register it, replacing the path with the absolute path to this repo on your machine.

**Claude Code** — either run:

```bash
claude mcp add basis-design-system -- node /absolute/path/to/design-system-generator/mcp-server/dist/index.js
```

or add it directly to `.mcp.json` (project scope) or your user-level MCP settings:

```json
{
  "mcpServers": {
    "basis-design-system": {
      "command": "node",
      "args": ["/absolute/path/to/design-system-generator/mcp-server/dist/index.js"]
    }
  }
}
```

**Cursor** — add the same shape to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json`
(global):

```json
{
  "mcpServers": {
    "basis-design-system": {
      "command": "node",
      "args": ["/absolute/path/to/design-system-generator/mcp-server/dist/index.js"]
    }
  }
}
```

To point either client at a specific system without editing `basis.config.json`, add an `env`
block to the same entry:

```json
{
  "mcpServers": {
    "basis-design-system": {
      "command": "node",
      "args": ["/absolute/path/to/design-system-generator/mcp-server/dist/index.js"],
      "env": {
        "BASIS_PRODUCT_TYPE": "b2b analytics dashboard",
        "BASIS_INDUSTRY": "finance",
        "BASIS_KEYWORDS": "data-dense,professional"
      }
    }
  }
}
```

After registering, restart the client (or reload its MCP connections) and the three tools
above become available to the agent.

## Rebuilding after an engine change

`dist/index.js` is a bundled snapshot — if you change anything under `src/engine` or
`src/lib/exportFormatters.ts`, re-run `npm run build` (from `mcp-server/`, or `npm run
mcp:build` from the repo root) so a client running the built server picks it up. `npm run mcp`
from the repo root always runs the live source, so it needs no rebuild step.
