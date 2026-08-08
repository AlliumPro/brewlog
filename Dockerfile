# syntax=docker/dockerfile:1

# ---- builder -------------------------------------------------------------------------------
# Alpine in both stages on purpose: better-sqlite3, sharp and argon2 resolve musl prebuilds at
# install time, so the binaries compiled here are the ones that run in the final image.
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first so the dependency layer is reused whenever only source files change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# `npm ci` installs exactly what the lockfile says; the prepare script would try to install
# husky, which has no business in an image.
RUN npm ci --ignore-scripts

COPY . .

# Native modules skipped their install scripts above, so build them explicitly.
RUN npm rebuild better-sqlite3 sharp

RUN npm run build --workspace @brewlog/api \
  && npm run build --workspace @brewlog/web

# Drop dev dependencies from node_modules before they can be copied into the runtime image.
RUN npm prune --omit=dev

# ---- runtime -------------------------------------------------------------------------------
FROM node:22-alpine AS runtime

# dumb-init reaps zombies and forwards signals, so SIGTERM actually reaches Node.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=/data/brewlog.db \
    UPLOAD_DIR=/data/uploads \
    STATIC_DIR=/app/public

WORKDIR /app

# `node` is an unprivileged user that ships with the image; nothing here runs as root.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/web/dist ./public

# The volume mount point must exist and belong to the runtime user before the volume is bound.
RUN mkdir -p /data/uploads && chown -R node:node /data

USER node

EXPOSE 3000

# Readiness rather than liveness: this answers only once migrations have been applied.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
