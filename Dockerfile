# syntax=docker/dockerfile:1

# Production image (Coolify, or any Docker host): one Node process on port 4321.
# Configuration is read at runtime, so the same image works on any domain with any keys;
# no secret is needed at build time.

FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm run build

# Unit tests against the full builder. Only built when targeted:
#   docker build --target test .
FROM builder AS test
RUN npm test

FROM builder AS pruned
RUN npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321
COPY --from=pruned --chown=node:node /app/package.json ./
COPY --from=pruned --chown=node:node /app/node_modules ./node_modules
COPY --from=pruned --chown=node:node /app/dist ./dist
COPY --from=pruned --chown=node:node /app/server.mjs ./
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4321/api/health || exit 1
# server.mjs drains in-flight requests on SIGTERM, so rolling deploys drop nothing.
CMD ["node", "server.mjs"]
