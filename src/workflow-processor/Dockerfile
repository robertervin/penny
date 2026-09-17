# Build from repo root: docker build -f src/workflow-processor/Dockerfile -t penny-workflow-processor:local .
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json ./
COPY src/core/package.json ./src/core/
COPY src/workflow-processor/package.json ./src/workflow-processor/

RUN npm install

COPY src/core ./src/core
COPY src/workflow-processor ./src/workflow-processor

RUN npm run build -w @penny/core && npm run build -w @penny/workflow-processor
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/core/package.json ./src/core/
COPY --from=build /app/src/core/dist ./src/core/dist
COPY --from=build /app/src/core/migrations ./src/core/migrations
COPY --from=build /app/src/workflow-processor/package.json ./src/workflow-processor/
COPY --from=build /app/src/workflow-processor/dist ./src/workflow-processor/dist

WORKDIR /app/src/workflow-processor
USER node
CMD ["node", "dist/index.js"]
