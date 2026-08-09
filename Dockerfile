# syntax=docker/dockerfile:1

# ---- builder -------------------------------------------------------------------------------
# Debian slim rather than alpine: sharp downloads a ready glibc binary, and the C++ compiled
# here links against the same libc as the runtime stage.
FROM node:22-slim AS builder

# better-sqlite3 v13 publishes no prebuilt binaries and has no install script, so npm sees its
# binding.gyp and runs node-gyp itself. That needs Python and a compiler. They live in this
# stage only — the runtime image receives the compiled .node file, not the toolchain.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# node:22 ships npm 10, which reads a lockfile written by npm 11 strictly enough to refuse it
# ("Missing: typescript@5.9.3 from lock file"). Pinning the package manager keeps the local
# machine, CI and this image on the same resolver instead of finding out at build time.
RUN npm install -g npm@11.6.2

# Copy manifests first so the dependency layer is reused whenever only source files change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install scripts stay enabled on purpose: that is the step where better-sqlite3 and sharp
# fetch their prebuilt binaries. HUSKY=0 keeps the prepare script from installing git hooks,
# which have no business in an image.
ENV HUSKY=0
RUN npm ci

COPY . .

RUN npm run build --workspace @brewlog/api \
  && npm run build --workspace @brewlog/web

# Drop dev dependencies before they can be copied into the runtime image.
RUN npm prune --omit=dev

# ---- runtime -------------------------------------------------------------------------------
FROM node:22-slim AS runtime

# dumb-init reaps zombies and forwards signals, so SIGTERM actually reaches Node.
#
# npm is removed in the same layer: the container runs `node dist/index.js` and never needs a
# package manager. Its bundled dependencies (tar, sigstore, brace-expansion) were the entire
# "Node.js (node-pkg)" section of the image scan — vulnerabilities in tooling that does not
# run here at all.
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=/data/brewlog.db \
    UPLOAD_DIR=/data/uploads \
    STATIC_DIR=/app/public

WORKDIR /app

# `node` is an unprivileged user that ships with the image; nothing here runs as root.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/web/dist ./public

# The mount point must exist and belong to the runtime user before the volume is bound.
RUN mkdir -p /data/uploads && chown -R node:node /data

USER node

EXPOSE 3000

# Readiness rather than liveness: this answers only once migrations have been applied.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
