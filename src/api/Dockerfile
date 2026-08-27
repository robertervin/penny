# Build from repo root: docker build -f src/api/Dockerfile -t penny-api:local .
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json ./
COPY src/core/package.json ./src/core/
COPY src/api/package.json ./src/api/

RUN npm install

COPY src/core ./src/core
COPY src/api ./src/api

RUN npm run build -w @penny/core && npm run build -w @penny/api
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/core/package.json ./src/core/
COPY --from=build /app/src/core/dist ./src/core/dist
COPY --from=build /app/src/core/migrations ./src/core/migrations
COPY --from=build /app/src/api/package.json ./src/api/
COPY --from=build /app/src/api/dist ./src/api/dist

WORKDIR /app/src/api
USER node
CMD ["node", "dist/index.js"]
