# Penny API

HTTP API for Plaid Link, household status, Situation, and Memory rules.

Shared database models and business logic live in [`@penny/core`](../core).

## Layout

```
src/
  app.ts                 # Hono app factory, mounts route modules
  server.ts              # bootstrap (migrations, listen)
  composition/           # dependency wiring
  routes/                # thin HTTP adapters
  schemas/               # request validation (Zod)
  mappers/               # core/DB types → API DTOs
  services/              # application/use-case layer
  middleware/            # error → HTTP mapping
```

## Develop

From repo root:

```bash
npm install
npm run typecheck -w @penny/api
npm run test -w @penny/api
```

## Run locally

Copy `src/.env.example` to `src/.env`, then from repo root:

```bash
npm run migrate
npm run api:dev
```

Default port: `3001` (`API_PORT` in `src/.env`).

## Deploy API image

```bash
docker build -f src/api/Dockerfile -t penny-api:local .
```

## Env

See `src/core/src/config/env.ts` and `src/.env.example`.
