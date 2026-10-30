import { sql, eq, and, isNull, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { components, component_installs, gear, type Component } from '../db/schema';
import * as schema from '../db/schema';

type DB = BetterSQLite3Database<typeof schema>;

export type ComponentFields = {
	kind: string;
	brand?: string | null;
	model?: string | null;
	notes?: string | null;
	purchase_price_cents?: number | null;
	purchased_at?: number | null;
	starting_distance_m?: number;
	wear_limit_m?: number | null;
	count_trainer?: number;
};

export type ComponentRow = Component & {
	distance_m: number;
	install_id: number | null;
	installed_at: number | null;
	removed_at: number | null;
};

/** User-facing validation failure (mapped to a 400 by form actions). */
export class ComponentError extends Error {}

/**
 * Lifetime distance per component: `starting_distance_m` + rides inside every
 * install interval, on any bike. Intervals are half-open on start_date_local.
 * `count_trainer = 0` skips trainer rides and VirtualRide (tires don't wear
 * on a trainer; chains do).
 */
export function componentDistances(db: DB, ids?: number[]): Map<number, number> {
	if (ids && ids.length === 0) return new Map();
	const filter = ids
		? sql`WHERE c.id IN (${sql.join(
				ids.map((i) => sql`${i}`),
				sql`, `
			)})`
		: sql``;
	const rows = db.all<{ id: number; distance_m: number }>(sql`
		SELECT c.id AS id,
			c.starting_distance_m + coalesce((
				SELECT sum(a.distance_m)
				FROM component_installs i
				JOIN activities a
					ON a.gear_id = i.gear_id
					AND a.start_date_local >= i.installed_at
					AND (i.removed_at IS NULL OR a.start_date_local < i.removed_at)
				WHERE i.component_id = c.id
					AND (c.count_trainer = 1 OR (a.trainer = 0 AND a.sport_type <> 'VirtualRide'))
			), 0) AS distance_m
		FROM components c
		${filter}
	`);
	return new Map(rows.map((r) => [r.id, r.distance_m]));
}

function withDistances(
	db: DB,
	rows: { component: Component; install_id: number | null; installed_at: number | null; removed_at: number | null }[]
): ComponentRow[] {
	const d = componentDistances(
		db,
		rows.map((r) => r.component.id)
	);
	return rows.map((r) => ({
		...r.component,
		distance_m: d.get(r.component.id) ?? r.component.starting_distance_m,
		install_id: r.install_id,
		installed_at: r.installed_at,
		removed_at: r.removed_at
	}));
}

/**
 * Installed parts (open interval) and past parts (closed intervals) for one
 * bike. A part installed here more than once shows its latest interval; a
 * part currently on this bike never appears in history.
 */
export function listComponentsForGear(
	db: DB,
	gearId: string
): { installed: ComponentRow[]; history: ComponentRow[] } {
	const rows = db
		.select({
			component: components,
			install_id: component_installs.id,
			installed_at: component_installs.installed_at,
			removed_at: component_installs.removed_at
		})
		.from(component_installs)
		.innerJoin(components, eq(components.id, component_installs.component_id))
		.where(eq(component_installs.gear_id, gearId))
		.orderBy(desc(component_installs.installed_at), desc(component_installs.id))
		.all();
	const all = withDistances(db, rows);
	const installed = all.filter((r) => r.removed_at === null);
	const onBike = new Set(installed.map((r) => r.id));
	const seen = new Set<number>();
	const history = all
		.filter((r) => r.removed_at !== null && !onBike.has(r.id))
		.sort((a, b) => b.removed_at! - a.removed_at!)
		.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
	return { installed, history };
}

/** Not retired and not currently installed anywhere. */
export function listSpares(db: DB, athleteId: number): ComponentRow[] {
	const rows = db
		.select({ component: components })
		.from(components)
		.where(
			and(
				eq(components.athlete_id, athleteId),
				eq(components.retired, 0),
				sql`NOT EXISTS (SELECT 1 FROM ${component_installs}
					WHERE ${component_installs.component_id} = ${components.id}
					AND ${component_installs.removed_at} IS NULL)`
			)
		)
		.orderBy(components.kind, components.id)
		.all();
	return withDistances(
		db,
		rows.map((r) => ({ component: r.component, install_id: null, installed_at: null, removed_at: null }))
	);
}

function openInstall(db: DB, componentId: number) {
	return (
		db
			.select()
			.from(component_installs)
			.where(and(eq(component_installs.component_id, componentId), isNull(component_installs.removed_at)))
			.all()[0] ?? null
	);
}

export function addComponent(db: DB, gearId: string, installedAt: number, fields: ComponentFields): number {
	return db.transaction((tx) => {
		const bike = tx.select({ athlete_id: gear.athlete_id }).from(gear).where(eq(gear.id, gearId)).all()[0];
		if (!bike) throw new ComponentError(`unknown gear ${gearId}`);
		const now = Math.floor(Date.now() / 1000);
		const [row] = tx
			.insert(components)
			.values({ ...fields, athlete_id: bike.athlete_id, created_at: now, updated_at: now })
			.returning({ id: components.id })
			.all();
		tx.insert(component_installs)
			.values({ component_id: row.id, gear_id: gearId, installed_at: installedAt })
			.run();
		return row.id;
	});
}

export function installComponent(db: DB, componentId: number, gearId: string, installedAt: number): void {
	const overlap = db
		.select({ id: component_installs.id })
		.from(component_installs)
		.where(
			and(
				eq(component_installs.component_id, componentId),
				sql`(${component_installs.removed_at} IS NULL OR ${component_installs.removed_at} > ${installedAt})`
			)
		)
		.all();
	if (overlap.length > 0) throw new ComponentError('part is already installed (or was on a bike after that date)');
	db.insert(component_installs)
		.values({ component_id: componentId, gear_id: gearId, installed_at: installedAt })
		.run();
	db.update(components)
		.set({ retired: 0, updated_at: Math.floor(Date.now() / 1000) })
		.where(eq(components.id, componentId))
		.run();
}

/** Close the open install at `at`; optionally mark the part retired. */
export function removeComponent(db: DB, componentId: number, at: number, opts: { retire: boolean }): void {
	const inst = openInstall(db, componentId);
	if (!inst) throw new ComponentError('part is not installed');
	if (at < inst.installed_at) throw new ComponentError('removal date is before install date');
	db.update(component_installs).set({ removed_at: at }).where(eq(component_installs.id, inst.id)).run();
	if (opts.retire) {
		db.update(components)
			.set({ retired: 1, updated_at: Math.floor(Date.now() / 1000) })
			.where(eq(components.id, componentId))
			.run();
	}
}

/** Remove + retire `oldId` and install a new part on the same bike on the same date. */
export function swapComponent(db: DB, oldId: number, at: number, fields: ComponentFields): number {
	return db.transaction((tx) => {
		const inst = openInstall(tx as unknown as DB, oldId);
		if (!inst) throw new ComponentError('part is not installed');
		removeComponent(tx as unknown as DB, oldId, at, { retire: true });
		return addComponent(tx as unknown as DB, inst.gear_id, at, fields);
	});
}

export function updateComponent(db: DB, id: number, fields: Partial<ComponentFields>): void {
	db.update(components)
		.set({ ...fields, updated_at: Math.floor(Date.now() / 1000) })
		.where(eq(components.id, id))
		.run();
}

export function deleteComponent(db: DB, id: number): void {
	db.delete(components).where(eq(components.id, id)).run();
}
