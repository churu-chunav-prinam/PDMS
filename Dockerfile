# Production image: builds frontend + backend, runs as non-root.
# Vite's native binding (@rolldown/binding-linux-x64-gnu) comes from frontend/package-lock.json via
# npm ci; node:24-slim is glibc x64 like the VPS. tsx is installed at the locked version because
# migrations and CLI scripts (backend/scripts) run through it.
FROM node:24-slim AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix backend ci && npm --prefix frontend ci \
    && node -e "require.resolve('@rolldown/binding-linux-x64-gnu', { paths: ['frontend/node_modules/rolldown'] })"
COPY backend backend
COPY frontend frontend
RUN npm --prefix frontend run build && npm --prefix backend run build

FROM node:24-slim AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN TSX_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/tsx'].version")" \
    && npm ci --omit=dev \
    && npm install --no-save "tsx@${TSX_VERSION}"

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=deps --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node backend/package.json backend/tsconfig.json ./
COPY --chown=node:node backend/src ./src
COPY --chown=node:node backend/scripts ./scripts
COPY --from=build --chown=node:node /app/frontend/dist /app/frontend/dist
COPY --chown=node:node docs /app/docs
USER node
ENV PORT=3200
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3200/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist/server.js"]
