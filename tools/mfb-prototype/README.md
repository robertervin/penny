# Messages for Business local prototype

MfB-shaped UI for chatting with Penny. **Live mode** routes messages through the SMS gateway to your real household data.

## Prerequisites

1. Postgres + Penny API running (`npm run api:dev`, `npm run processor:dev`)
2. SMS gateway (`npm run sms:dev` on port 3002)
3. `src/.env` with `PENNY_DEV_HOUSEHOLD_ID` and `PENNY_DEV_PERSON_ID` (from Link UI bootstrap)
4. Optional: `OPENAI_API_KEY` for natural-language explore (keywords work without it)

Or use the all-in-one stack from repo root:

```bash
./scripts/dev/link-stack-start.sh
```

## Run

```bash
cd tools/mfb-prototype
npm install
npm run dev
```

Open **http://localhost:5173** — default mode is **Live finances**.

Vite proxies `/sms` → `http://localhost:3002/dev/sms`.

## Modes

| Mode | Description |
|---|---|
| **Live finances** | Free-text + shortcuts → SMS gateway → Penny API |
| **Scripted audit** | Original offline audit walkthrough |

## Try it

- `WHY income` — breakdown fast-path
- `What is my operating runway?` — explore (needs OpenAI)
- `RULES`, `UNDO`, `HELP` — memory commands
