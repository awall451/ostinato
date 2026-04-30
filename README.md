# ostinato

Personal cycling and running data visualization, powered by the Strava API.

> An *ostinato* is a musical motif that repeats. Same routes, different bikes, over and over.

## What it does (v1)

- **Sport-over-time**: how your time splits across mtb / emtb / gravel / road / run / etc, by week / month / year.
- **Per-gear**: lifetime miles, hours, elevation, avg speed/power/cadence/HR for each bike and pair of shoes.
- **Drill-down**: click a bike, see every ride on it.

## Quick start

```bash
cp .env.example .env
# Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET from https://www.strava.com/settings/api
# Set callback to: http://localhost:5173/auth/callback

# Local dev (fastest):
npm install
npm run db:migrate
npm run dev

# Or Docker (single container, auto-migrates on boot):
docker compose up --build -d
```

Open `http://localhost:5173`, then in **Settings** either:
- Click **Connect Strava** for real data, or
- Click **Load fixtures** for synthetic offline data (requires `NODE_ENV=development` in `.env`).

### Container details

The Docker image is multi-stage: a `node:22-bookworm-slim` builder with the toolchain for `better-sqlite3`'s native build, and a `gcr.io/distroless/nodejs22-debian12:nonroot` runtime. Migrations run automatically on boot via `scripts/entrypoint.mjs`. Data persists in a named volume (`ostinato_data`); to inspect it from the host, use `docker compose cp` or a one-shot `alpine` container.

## Stack

SvelteKit (Svelte 5 runes) · TypeScript · SQLite via Drizzle + better-sqlite3 · pure inline SVG charts · Docker Compose.

## Roadmap

See `CLAUDE.md` for full v2/v3 plans (heatmaps, HR dashboards, power curves, Garmin ingest).
