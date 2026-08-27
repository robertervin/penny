# penny-mcp

MCP server exposing Penny Explore tools over the HTTP API. Use with Cursor, Claude Desktop, or ChatGPT.

## Setup

```bash
# From repo root — API must be running
npm run api:dev

# Set household context (from Link UI bootstrap or session)
export PENNY_API_URL=http://localhost:3001
export PENNY_HOUSEHOLD_ID=<your-household-id>
export PENNY_PERSON_ID=<your-person-id>
```

## Cursor config

Add to MCP settings:

```json
{
  "mcpServers": {
    "penny": {
      "command": "npm",
      "args": ["run", "dev", "-w", "penny-mcp"],
      "cwd": "/path/to/penny",
      "env": {
        "PENNY_API_URL": "http://localhost:3001",
        "PENNY_HOUSEHOLD_ID": "...",
        "PENNY_PERSON_ID": "..."
      }
    }
  }
}
```

## Tools

- `get_household_status`, `get_situation`, `get_situation_breakdown`
- `list_memory_rules`, `create_memory_rule`, `undo_correction`, `trigger_interpret`
