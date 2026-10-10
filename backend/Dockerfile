FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY shared shared
COPY backend backend
RUN npm run build -w shared && npm run build -w backend && npm prune --omit=dev
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4000 STORAGE_PATH=/app/backend/storage
WORKDIR /app/backend
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/shared /app/shared
COPY --from=build --chown=node:node /app/backend /app/backend
RUN mkdir -p storage && chown node:node storage
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
