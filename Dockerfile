# syntax=docker/dockerfile:1

# Plain Node image for self-hosting (Coolify, any Docker host).
# Vercel deployments don't use this file.

FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ENV DEPLOY_TARGET=node
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
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4321/api/health || exit 1
CMD ["node", "dist/server/entry.mjs"]
