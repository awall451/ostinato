# CLAUDE.md — ostinato

Guidance for Claude Code working in this repository.

## Project purpose

ostinato is a personal cycling/running data visualization app for **Dillon** — a multi-discipline cyclist (mtb, emtb, gravel, road) who also runs. Strava's native dashboards do not answer the questions he actually has. ostinato does.

The app is **multi-source by design**: Strava is the v1 source; Garmin Connect is on the roadmap. v1 is local-only single-user, but the schema is Postgres-portable so a future public/multi-user step is not a rewrite.

## Current state (built 2026-04-30)

**v1 scaffold complete and verified end-to-end against fixtures.** Path A (real Strava) requires user creds.

What ships:
- SvelteKit (Svelte 5 runes) + TypeScript + Drizzle/better-sqlite3.
- Schema in `src/lib/server/db/schema.ts` (athletes, gear, activities, sync_state). Postgres-portable: epoch-second integers, INTEGER booleans, no SQLite-isms.
- Strava client in `src/lib/server/strava/client.ts`. Eager token refresh (60s safety margin), rate-limit accounting, 401-retry-then-fail, 429 with `retryAfter`.
- OAuth routes: `/auth/connect`, `/auth/callback`, `/auth/disconnect`. CSRF state cookie.
- Sync flows in `src/lib/server/strava/sync.ts`: `bootstrapSummaries` (full backfill, paged 200/req), `syncIncremental` (cursor on `last_after_epoch`), `enrichDetail(N)` (rate-limit-aware bail), `syncGearAndAthlete` (single `/athlete` call).
- Dashboard `/`: Donut + StackedBar + LineArea, range/metric/bucket toggles.
- Gear `/gear`: bike + shoe cards with SQL aggregation; `/gear/[id]` drill-down with sortable table + month sparkline + Heatmap stub.
- Settings `/settings`: connect/disconnect, sync now, backfill, enrich next 25, rate-limit pill, fixture loader.
- Fixtures: `scripts/seed-fixtures.ts` + `POST /api/seed` (DEV only). 150 synthetic activities, 3 bikes + 1 shoe, 18-month spread, deterministic via mulberry32 seed=42.
- Tests: 11 vitest specs (UPSERT idempotency including detail-preservation, gear aggregation NULL semantics, listGear retired/kind filtering). All pass.
- Smoke checks pass: `npm run check` (0 err / 0 warn), `npm run build` (clean).

## Roadmap

### v2 immediate next-steps
- **Full containerization** (see [Containerization gaps](#containerization-gaps) below). Currently host-bootstrapped.
- **Personal heatmap** of activity polylines, filterable by gear/sport. Polyline decoding via `@mapbox/polyline` + Leaflet/MapLibre + OSM tiles. `Heatmap.svelte` already stubbed.

### v2 (next)
- HR / calorie / suffer-score dashboards.
- Per-bike **power curve**, **cadence distribution**, **speed histogram**.
- Year-over-year comparison view.

### v3 (later)
- **Garmin Connect ingest** via a third-party library (no official public API). Unify against the same `activities` table.
- Public hosting: HTTPS reverse proxy, Strava-compliant multi-user auth, signup flow.
- **Strava webhook subscriptions** for push-sync (requires public HTTPS endpoint).
- Route clustering ("favorite loops") and segment effort tracking.

## Dev workflow

```bash
cp .env.example .env
# fill STRAVA_CLIENT_ID + STRAVA_CLIENT_SECRET (https://www.strava.com/settings/api)
# Authorization Callback Domain in Strava app: localhost (bare, no scheme/port/path)

# Local hacking (fast HMR — currently the recommended path):
npm install
npm run db:migrate
npm run dev               # http://localhost:5173

# Docker (partial — see Containerization gaps below):
npm run db:migrate        # MUST run on host first; container does not migrate on boot
docker compose up --build -d
```

Once running:
1. Visit `http://localhost:5173/settings`.
2. Click **Connect Strava** (or use **Load fixtures** for offline dev with synthetic data).
3. Click **Backfill all summaries** for the initial pull.
4. Optionally **Enrich next 25** to fill in power/cadence/HR averages.
5. Day-to-day: **Sync now** for incremental updates.

## Containerization gaps

**Status: partially containerized.** Image builds and serves the SvelteKit production bundle, but the dev loop and DB bootstrapping still rely on the host. To finish:

1. **Auto-migrate on container boot.** Add an entrypoint script that runs `node scripts/migrate.js` (or compiled equivalent) before `node build`. Today, migrations run via `npm run db:migrate` on the host — first boot of a fresh `data/` volume will crash.
2. **`.env` loading in compose.** `docker-compose.yml` uses `${STRAVA_CLIENT_ID}` substitution which only resolves if `.env` sits next to the compose file. Add explicit `env_file: .env` to remove the implicit dependency, and document it.
3. **Healthcheck.** Add a `HEALTHCHECK` in the Dockerfile (`curl -f http://localhost:5173/ || exit 1`) and a `healthcheck:` block in compose.
4. **Dev container with HMR.** Today `docker compose up` builds a production bundle — no live reload. Add a `docker-compose.dev.yml` override (or `target: dev` in Dockerfile) that mounts `./src` and runs `npm run dev`.
5. **Run as non-root.** Add a `node` user in the Dockerfile and `USER node` for the runtime stage. Adjust `data/` volume ownership accordingly. `secrets.json` chmod 0600 still works.
6. **Pin Node version + multi-arch.** Currently `node:20-alpine`; consider switching to `node:20-bookworm-slim` (avoids `apk add python3 make g++` step needed for `better-sqlite3` native build) or pre-build a base image with toolchain baked in to speed up CI.
7. **Document fixture loading inside container.** `docker compose exec app node scripts/seed-fixtures.js` — once the entrypoint runs migrations, this becomes the canonical "load demo data" command.
8. **Volume init.** `data/` is created by the host via `mkdirSync` in `db/index.ts` and `secrets.ts`. In a fresh container, the bind-mount is rootless-owned by the host but writes happen as container user — verify mode bits when (5) lands.

Optional later:
- Compose stack with a reverse proxy (Caddy/Traefik) for HTTPS + a public hostname (paves the v3 public-hosting path).
- Postgres service + a `DATABASE_URL` toggle in `db/index.ts` for the v3 multi-user step.

## Conventions

### Charts
- **Pure inline SVG** in `src/lib/components/charts/`. No chart library.
- Reactive aggregations via `$derived.by`.
- Theme via CSS vars on `:root` in `src/app.css`.
- Palette indexed via `pc(i)` in `charts/palette.ts`.
- Use `fill-opacity` for intensity (e.g. heatmap-style matrices), not hardcoded color stops.
- Pattern source: `/home/dillon/lab/timelog-vibed/frontend/src/routes/charts/+page.svelte`.

### Storage units
- Distances in **meters**, times in **seconds**, speeds in **m/s** (Strava native).
- Convert at the **view boundary**, never at the storage boundary. Helpers in `src/lib/shared/units.ts`.

### Schema rules (Postgres-portable)
- Booleans stored as `INTEGER` (0/1).
- Timestamps stored as `INTEGER` epoch seconds (UTC).
- No SQLite-isms (no `WITHOUT ROWID`, no virtual tables, no `STRICT` quirks).
- One Drizzle schema in `src/lib/server/db/schema.ts`. Migrate via `drizzle-kit generate` + `npm run db:migrate`.

### Server-only secrets
- Never `import` `src/lib/server/strava/secrets.ts` (or anything in `src/lib/server/`) from a `.svelte` file. SvelteKit will refuse, but be explicit.
- Token persistence is `data/secrets.json` (file mode 0600), not the DB. Keeps schema portable, makes "disconnect" a single `unlink`.

### Env vars
- **Inside SvelteKit (route handlers, `+server.ts`, server-only `.ts` modules imported via SvelteKit):** read via `import { env } from '$env/dynamic/private'`. Vite does NOT populate `process.env` from `.env` for non-`VITE_` vars in dev — `$env/dynamic/private` is the only source that works in both dev and prod (`adapter-node`).
- **Inside CLI scripts (`scripts/migrate.ts`, `scripts/seed-fixtures.ts`) run via tsx:** read via `process.env`. SvelteKit runtime is not loaded in these. Defaults exist in `db/index.ts` and `secrets.ts` so scripts work without `.env` loaded.
- **Inside modules used by both** (e.g. `db/index.ts`, `secrets.ts`): stick with `process.env` + a sensible default. Inside SvelteKit dev, `process.env` will be empty → falls back to `./data/...` defaults, which is what we want.

## Strava API gotchas (load-bearing)
- **Refresh eagerly.** Access token TTL is 6 h. The `StravaClient` checks `expires_at - now < 60s` before every call and refreshes inside the same request path.
- **`sport_type` not `type`.** The legacy `type` field collapses MTB/Gravel/Road into "Ride". Always group by `sport_type`.
- **Use `/athlete` for gear.** Returns full bike+shoe lists with names and `frame_type`. Avoids per-id `/gear/{id}` rate spend.
- **Detail endpoint is the rate hog.** `GET /api/v3/activities/{id}` is one call per activity. Never auto-bulk-fetch — gate behind manual button or trickled cron.
- **Rate limits**: 100 / 15 min and 1000 / day, app-wide (not per-user). Read `X-RateLimit-Usage` and `X-RateLimit-Limit` headers; persist to `sync_state`. Sync loops gate themselves on `used < limit - 5`.
- **Localhost OAuth redirect** is allowed by Strava without HTTPS. No tunneling needed for dev.
- **Webhook subscriptions** require a public HTTPS endpoint. Out of scope until v3.

## Strava OAuth app setup (one-time)
- Register at https://www.strava.com/settings/api.
- **Authorization Callback Domain**: `localhost` — bare domain, no scheme/port/path. Strava treats this as a wildcard for any path on the host. Our redirect `http://localhost:5173/auth/callback` matches.
- Website URL: `http://localhost:5173`.
- Copy Client ID + Client Secret into `.env`.

## Pattern source projects
- Charts and theme: `/home/dillon/lab/timelog-vibed/frontend/src/routes/charts/+page.svelte`.
- Docker compose layout: `/home/dillon/lab/timelog-vibed/docker-compose.yml`.
