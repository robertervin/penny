# Penny SMS gateway

Explore and execute Penny over SMS. Uses `@penny/agent` for conversational turns and keyword fast-paths for commands.

## Dev

```bash
# Terminal 1 — API + processor
npm run api:dev
npm run processor:dev

# Terminal 2 — SMS gateway
npm run sms:dev
```

Send a dev message:

```bash
curl -s -X POST http://localhost:3002/dev/sms \
  -H 'content-type: application/json' \
  -d '{"body":"WHY income"}' | jq
```

With `OPENAI_API_KEY` set, free-text explore works:

```bash
curl -s -X POST http://localhost:3002/dev/sms \
  -H 'content-type: application/json' \
  -d '{"body":"What is my operating runway?"}' | jq
```

## Flow

1. **Explore** — agent + tools (read Situation, breakdown, rules)
2. **Propose** — agent calls `propose_memory_rules` → YES/NO confirm
3. **Execute** — `UNDO`, `RULES`, `WHY income` keyword fast-paths

Set `PENNY_DEV_HOUSEHOLD_ID` + `PENNY_DEV_PERSON_ID` to bind your phone to your linked household.

## Twilio

`POST /webhook/twilio` accepts standard Twilio form params (`From`, `Body`).
