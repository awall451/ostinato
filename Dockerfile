# syntax=docker/dockerfile:1.7

# ----- Builder: full toolchain for better-sqlite3 native build -----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev
# Pre-create /data so the runtime stage can copy it with nonroot ownership.
# The named volume in compose inherits this ownership on first mount.
RUN mkdir -p /stage-data

# ----- Runtime: distroless (no shell, no package manager) -----
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app/build ./build
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/scripts/entrypoint.mjs ./scripts/entrypoint.mjs
COPY --from=builder --chown=nonroot:nonroot /app/src/lib/server/db/migrations ./src/lib/server/db/migrations
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=builder --chown=nonroot:nonroot /stage-data /data

ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0
ENV OSTINATO_DB_PATH=/data/ostinato.db
ENV OSTINATO_SECRETS_PATH=/data/secrets.json

EXPOSE 5173

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:5173/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["/nodejs/bin/node", "scripts/entrypoint.mjs"]
