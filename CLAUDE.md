# CLAUDE.md — ostinato

Guidance for Claude Code working in this repository.

## Project purpose

ostinato is a personal cycling/running data visualization app for **Dillon** — a multi-discipline cyclist (mtb, emtb, gravel, road) who also runs. Strava's native dashboards do not answer the questions he actually has. ostinato does.

The app is **multi-source by design**: Strava is the v1 source; Garmin Connect is on the roadmap. v1 is local-only single-user, but the schema is Postgres-portable so a future public/multi-user step is not a rewrite.

## Current state (last updated 2026-04-30)

**v1 scaffold complete and verified end-to-end against fixtures.** Path A (real Strava) requires user creds.

What ships:
- SvelteKit (Svelte 5 runes) + TypeScript + Drizzle/better-sqlite3.
- Schema in `src/lib/server/db/schema.ts` (athletes, gear, activities, sync_state). Postgres-portable: epoch-second integers, INTEGER booleans, no SQLite-isms.
- Strava client in `src/lib/server/strava/client.ts`. Eager token refresh (60s safety margin), rate-limit accounting, 401-retry-then-fail, 429 with `retryAfter`.
- OAuth routes: `/auth/connect`, `/auth/callback`, `/auth/disconnect`. CSRF state cookie.
- Sync flows in `src/lib/server/strava/sync.ts`: `bootstrapSummaries` (full backfill, paged 200/req), `syncIncremental` (cursor on `last_after_epoch`), `enrichDetail(N)` (rate-limit-aware bail), `syncGearAndAthlete` (single `/athlete` call).
- Dashboard `/`: Donut + StackedBar + LineArea, range/metric/bucket toggles. StackedBar uses fixed 800×300 viewBox; bar geometry computed from `computeBarLayout(n, innerWidth)` so aspect ratio stays constant across all range/bucket combinations.
- Gear `/gear`: bike + shoe cards with SQL aggregation; `/gear/[id]` drill-down with sortable table + month sparkline + Heatmap stub.
- Settings `/settings`: connect/disconnect, sync now, backfill, enrich next 25, rate-limit pill, fixture loader.
- Fixtures: `scripts/seed-fixtures.ts` + `POST /api/seed` (DEV only). 150 synthetic activities, 3 bikes + 1 shoe, 18-month spread, deterministic via mulberry32 seed=42.
- **Container**: single-image, distroless runtime, auto-migrates on boot. `docker compose up --build` is the canonical run command. See [Container layout](#container-layout).
- **CI**: GitHub Actions in `.github/workflows/ci.yml`. Three jobs — `node` (test+build, every PR), `docker-build` + `docker-smoke` (paths-gated, weekly cron backstop). Node version pinned in `.nvmrc`.
- Tests: 26 vitest specs. Server: UPSERT idempotency, gear aggregation NULL semantics, listGear retired/kind filtering. Pure helpers: `bucketGrid` (dense range coverage), `computeBarLayout` (bar-overflow invariant). All pass.
- Smoke checks pass: `npm run check` (0 err / 0 warn), `npm run build` (clean).

## Roadmap

### v2 immediate next-steps
- **Personal heatmap** of activity polylines, filterable by gear/sport. Polyline decoding via `@mapbox/polyline` + Leaflet/MapLibre + OSM tiles. `Heatmap.svelte` already stubbed.
- **Component testing infra**: add `@testing-library/svelte` + jsdom so Svelte components (StackedBar, Donut, LineArea, Heatmap) get rendered in tests, not just the pure helpers underneath them. Scheduled follow-up agent will open this PR.
- **Branch protection on `main`**: require the `node` CI job to pass before merge. Turns the gate from advisory to enforced.

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

# Local hacking (fast HMR):
npm install
npm run db:migrate
npm run dev               # http://localhost:5173

# Docker (single-container, distroless runtime):
docker compose up --build -d
# Migrations run automatically on container boot via scripts/entrypoint.mjs.
# Healthcheck polls / on 5173.
# Data persists in the named volume `ostinato_data`.
```

Once running:
1. Visit `http://localhost:5173/settings`.
2. Click **Connect Strava** (or use **Load fixtures** for offline dev with synthetic data).
3. Click **Backfill all summaries** for the initial pull.
4. Optionally **Enrich next 25** to fill in power/cadence/HR averages.
5. Day-to-day: **Sync now** for incremental updates.

## Container layout

**Single container, distroless runtime.** `docker compose up --build` is the canonical run command. Layers:

- **Builder stage**: `node:22-bookworm-slim` with `python3 make g++` for `better-sqlite3` native build. Runs `npm ci`, `npm run build`, then `npm prune --omit=dev`.
- **Runtime stage**: `gcr.io/distroless/nodejs22-debian12:nonroot`. No shell, no package manager. Runs as uid 65532. Copies `build/`, `node_modules/`, `scripts/entrypoint.mjs`, and the migrations folder. Pre-creates `/data` with nonroot ownership so the named volume inherits it on first mount.
- **Entrypoint**: `scripts/entrypoint.mjs` opens `OSTINATO_DB_PATH`, runs Drizzle migrations idempotently, closes the handle, then dynamic-imports `build/index.js` to start the SvelteKit adapter-node server.
- **Healthcheck**: node-based `fetch('http://localhost:5173/')`. Must be node-based — distroless has no curl/wget.
- **Storage**: named docker volume `ostinato_data` mounted at `/data`. Both `ostinato.db` and `secrets.json` live there. To browse DB on host: `docker run --rm -v ostinato_ostinato_data:/data alpine ls /data` or copy out via `docker compose cp`.

### Loading fixtures
Settings → "Load fixtures" button (calls `/api/seed`, gated on `NODE_ENV=development`). The container ships with `NODE_ENV=production` baked into the Dockerfile; override via `.env` when you want fixtures.

### Future container work
- Compose stack with a reverse proxy (Caddy/Traefik) for HTTPS + public hostname — paves v3 public-hosting path.
- Dev-mode override (`docker-compose.dev.yml` with `target: dev` and `npm run dev`) for HMR inside the container.
- Postgres service + `DATABASE_URL` toggle in `db/index.ts` for v3 multi-user step.

## TDD workflow

Every behavioral change ships as `issue → branch → red commit → green commit → CI green → PR merge`. Plumbing-only PRs (CI config, docs) skip the red step.

1. **Open a GitHub issue** describing the change and its acceptance criteria. One issue per deliverable. The issue is the unit-of-work, the PR is the artifact.
2. **Branch off `main`**: `kind/short-name` (e.g. `fix/chart-zoom`, `container/distroless`, `ci/bootstrap`).
3. **Red commit**: write the failing test(s) first. For pure helpers that don't yet exist, ship a stub implementation that compiles cleanly so `npm run check` passes — only `npm test` should fail. CI on the PR shows the red state publicly.
4. **Green commit**: replace the stub with the real implementation. Push. CI flips green.
5. **Merge**: squash-merge with `gh pr merge <num> --squash --delete-branch`. Linked issue auto-closes via `Closes #N` in the PR body.

The `node` CI job (`npm ci && npm run check && npm test && npm run build`) is the gate. The `docker-build` and `docker-smoke` jobs are paths-gated (only run on container PRs) plus a Monday cron backstop.

### Pure-helper extraction
When a Svelte component has a non-trivial bug rooted in math (geometry, aggregation, bucketing), prefer extracting the pure function over reaching for component-level testing infra. Two examples:

- `src/lib/shared/bucket-grid.ts` — dense range coverage, given start/end/bucket. Test in `bucket-grid.test.ts`.
- `src/lib/components/charts/bar-layout.ts` — bar geometry given bucket count and inner viewBox width. Test in `bar-layout.test.ts`.

Both are imported by `StackedBar.svelte` / `+page.svelte` but tested without a DOM. The component file becomes a thin renderer over deterministic helpers. Property-style assertions (e.g. `barStep * n <= innerWidth` for all `n`) catch regressions a single hardcoded input/output would miss.

Component-level rendering tests (via `@testing-library/svelte` + jsdom) are not yet wired up — that's a planned v2 follow-up.

## Conventions

### Charts
- **Pure inline SVG** in `src/lib/components/charts/`. No chart library.
- Reactive aggregations via `$derived.by`.
- Theme via CSS vars on `:root` in `src/app.css`.
- Palette indexed via `pc(i)` in `charts/palette.ts`.
- Use `fill-opacity` for intensity (e.g. heatmap-style matrices), not hardcoded color stops.
- **Fixed viewBox, scaled internals.** Charts use a constant viewBox (e.g. StackedBar = 800×300) so CSS `width:100%;height:auto` preserves a constant aspect ratio across all data shapes. Bar/segment geometry scales to bucket count via pure helpers, never via SVG width drift. The opposite (`svgW = f(bucketCount)`) caused the chart 'zoom' bug fixed in PR #6.
- **Dense bucket grids.** When a chart's x-axis is time-bucketed, build the row set from a dense grid covering the full selected range (`bucketGrid(start, end, bucket)`), not from the set of buckets that contain data. Empty buckets render as a 2px stub. Keeps the x-axis honest and the bar widths consistent.
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
- **Inside the docker entrypoint (`scripts/entrypoint.mjs`, plain ESM, no tsx):** also reads via `process.env`. Compose loads `.env` via `env_file:`, then the Dockerfile's `ENV` defaults fill in anything missing. The entrypoint runs migrations then dynamic-imports `build/index.js` to start the server.
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
