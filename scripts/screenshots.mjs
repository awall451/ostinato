#!/usr/bin/env node
// scripts/screenshots.mjs
//
// Two subcommands:
//   node scripts/screenshots.mjs candidates
//     → query DB, print activities in WV / Summerville GA boxes for the
//       /activities/[id] map screenshot. Pick one and pass its id to `snap`.
//
//   node scripts/screenshots.mjs snap --activity <id> [--gear <id>] [--hide-desc]
//     → drive Playwright, snap 6 PNGs into docs/screenshots/.
//
// DB access:
//   - If OSTINATO_DB_PATH is set, query that path directly.
//   - Else, `docker compose cp app:/data/ostinato.db <tempfile>`, query, delete.

import Database from 'better-sqlite3';
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = join(ROOT, 'docs', 'screenshots');
const BASE_URL = process.env.OSTINATO_URL ?? 'http://localhost:5173';

// ---------- DB helpers ----------

function openDb() {
	const envPath = process.env.OSTINATO_DB_PATH;
	if (envPath) {
		if (!existsSync(envPath)) throw new Error(`OSTINATO_DB_PATH not found: ${envPath}`);
		return { db: new Database(envPath, { readonly: true }), cleanup: () => {} };
	}
	const tmp = mkdtempSync(join(tmpdir(), 'ostinato-snap-'));
	const dbPath = join(tmp, 'ostinato.db');
	try {
		execSync(`docker compose cp app:/data/ostinato.db ${dbPath}`, { stdio: 'pipe' });
	} catch (e) {
		rmSync(tmp, { recursive: true, force: true });
		throw new Error(
			`docker compose cp failed. Is the container running? (docker compose up -d)\n${e.message}`
		);
	}
	return {
		db: new Database(dbPath, { readonly: true }),
		cleanup: () => rmSync(tmp, { recursive: true, force: true })
	};
}

// ---------- candidates ----------

function fmtDate(epochSec) {
	return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

function metersToMiles(m) {
	return m / 1609.344;
}

function trunc(s, n) {
	if (!s) return '';
	const oneline = s.replace(/\s+/g, ' ').trim();
	return oneline.length > n ? oneline.slice(0, n - 1) + '…' : oneline;
}

function listCandidates() {
	const { db, cleanup } = openDb();
	try {
		const rows = db
			.prepare(
				`
			SELECT a.id, a.name, a.sport_type, a.distance_m, a.start_date_local,
			       a.start_lat, a.start_lng,
			       g.name AS gear_name,
			       json_extract(a.raw_detail_json, '$.description') AS description
			FROM activities a
			LEFT JOIN gear g ON g.id = a.gear_id
			WHERE a.start_lat IS NOT NULL AND a.start_lng IS NOT NULL
			  AND a.summary_polyline IS NOT NULL
			  AND (
			    (a.start_lat BETWEEN 38.0 AND 39.5 AND a.start_lng BETWEEN -81.5 AND -79.5)
			    OR
			    (a.start_lat BETWEEN 34.38 AND 34.58 AND a.start_lng BETWEEN -85.45 AND -85.25)
			  )
			ORDER BY a.distance_m DESC
			LIMIT 12
		`
			)
			.all();

		if (rows.length === 0) {
			console.log('No candidates found in WV (38-39.5,-81.5..-79.5) or Summerville GA (~34.48,-85.35).');
			console.log('Loosen the boxes in scripts/screenshots.mjs or pick another safe region.');
			return;
		}

		console.log(`Found ${rows.length} candidates:\n`);
		console.log('| id | date | sport | gear | mi | start (lat,lng) | name | description |');
		console.log('|---|---|---|---|---|---|---|---|');
		for (const r of rows) {
			const region =
				r.start_lat >= 38 ? 'WV' : 'Summerville GA';
			console.log(
				`| \`${r.id}\` | ${fmtDate(r.start_date_local)} | ${r.sport_type} | ${r.gear_name ?? '—'} | ${metersToMiles(
					r.distance_m
				).toFixed(1)} | ${r.start_lat.toFixed(3)},${r.start_lng.toFixed(3)} (${region}) | ${trunc(r.name, 40)} | ${trunc(r.description, 60)} |`
			);
		}

		// Also print the most-used bike for /gear/[id]
		const bike = db
			.prepare(
				`
			SELECT g.id, g.name, COUNT(*) AS rides
			FROM activities a
			JOIN gear g ON g.id = a.gear_id
			WHERE g.kind = 'bike' AND g.retired = 0
			GROUP BY g.id
			ORDER BY rides DESC
			LIMIT 1
		`
			)
			.get();
		if (bike) {
			console.log(
				`\nMost-used active bike (for /gear/[id] screenshot): \`${bike.id}\` — ${bike.name} (${bike.rides} rides)`
			);
		}

		console.log(
			'\nNext: node scripts/screenshots.mjs snap --activity <id>' +
				(bike ? ` --gear ${bike.id}` : '')
		);
	} finally {
		db.close();
		cleanup();
	}
}

// ---------- snap ----------

async function snap(args) {
	const activityId = args.activity;
	const gearId = args.gear;
	const hideDesc = !!args['hide-desc'];

	if (!activityId) {
		throw new Error('Missing --activity <id>. Run `node scripts/screenshots.mjs candidates` first.');
	}

	mkdirSync(OUT_DIR, { recursive: true });

	let resolvedGear = gearId;
	if (!resolvedGear) {
		const { db, cleanup } = openDb();
		try {
			const bike = db
				.prepare(
					`SELECT g.id FROM activities a JOIN gear g ON g.id = a.gear_id
					 WHERE g.kind = 'bike' AND g.retired = 0
					 GROUP BY g.id ORDER BY COUNT(*) DESC LIMIT 1`
				)
				.get();
			if (!bike) throw new Error('No active bike found in DB; pass --gear <id>.');
			resolvedGear = bike.id;
			console.log(`Auto-picked gear ${resolvedGear} for /gear/[id] screenshot.`);
		} finally {
			db.close();
			cleanup();
		}
	}

	const { chromium } = await import('playwright');
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
		colorScheme: 'dark'
	});
	const page = await context.newPage();

	const only = args.only;
	const allShots = [
		{ url: '/', file: 'dashboard.png', wait: 'svg', settle: 800 },
		{ url: '/gear', file: 'gear.png', wait: 'svg', settle: 800 },
		{ url: '/gear?retired=1', file: 'gear-retired.png', wait: 'svg', settle: 800 },
		{
			url: `/gear/${resolvedGear}`,
			file: 'gear-detail.png',
			wait: 'svg',
			settle: 800,
			// 179-row activity table makes fullPage huge; bump viewport then clip
			viewport: { width: 1440, height: 1800 },
			clip: { x: 0, y: 0, width: 1440, height: 1800 }
		},
		{
			url: `/activities/${activityId}`,
			file: 'activity.png',
			wait: '.leaflet-tile-loaded',
			settle: 2500,
			// stats grid + map + stream charts; 53-segment table + splits would stretch
			// the page to ~11k px tall
			viewport: { width: 1440, height: 3400 },
			clip: { x: 0, y: 0, width: 1440, height: 3400 }
		},
		{ url: '/settings', file: 'settings.png', wait: 'button', settle: 600 }
	];
	const shots = only ? allShots.filter((s) => s.file === only || s.file.startsWith(only)) : allShots;

	for (const s of shots) {
		const url = BASE_URL + s.url;
		console.log(`→ ${url}`);
		if (s.viewport) {
			await page.setViewportSize(s.viewport);
		} else {
			await page.setViewportSize({ width: 1440, height: 900 });
		}
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
		try {
			await page.waitForSelector(s.wait, { timeout: 15000 });
		} catch {
			console.warn(`  (selector ${s.wait} not found, snapping anyway)`);
		}
		if (hideDesc && s.url.startsWith('/activities/')) {
			await page.addStyleTag({ content: '.desc { display: none !important; }' });
		}
		await page.waitForTimeout(s.settle ?? 600);
		const path = join(OUT_DIR, s.file);
		const opts = { path };
		if (s.clip) {
			// clip uses CSS px; deviceScaleFactor still applies to output pixels
			opts.clip = s.clip;
		} else {
			opts.fullPage = true;
		}
		await page.screenshot(opts);
		console.log(`  ✓ ${path}`);
	}

	await browser.close();
	console.log(`\nDone. ${shots.length} PNGs in ${OUT_DIR}`);
}

// ---------- arg parser ----------

function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const key = a.slice(2);
			const next = argv[i + 1];
			if (!next || next.startsWith('--')) {
				out[key] = true;
			} else {
				out[key] = next;
				i++;
			}
		}
	}
	return out;
}

// ---------- main ----------

const sub = process.argv[2];
const args = parseArgs(process.argv.slice(3));

try {
	if (sub === 'candidates') {
		listCandidates();
	} else if (sub === 'snap') {
		await snap(args);
	} else {
		console.error('Usage:');
		console.error('  node scripts/screenshots.mjs candidates');
		console.error('  node scripts/screenshots.mjs snap --activity <id> [--gear <id>] [--hide-desc]');
		process.exit(1);
	}
} catch (e) {
	console.error('Error:', e.message);
	process.exit(1);
}
