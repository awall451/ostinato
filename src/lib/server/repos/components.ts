import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type Component } from '../db/schema';
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

/** Lifetime distance per component: offset + rides inside every install interval, any bike. */
export function componentDistances(_db: DB, _ids?: number[]): Map<number, number> {
	return new Map();
}

/** Installed parts (open interval) and past parts (closed intervals) for one bike. */
export function listComponentsForGear(
	_db: DB,
	_gearId: string
): { installed: ComponentRow[]; history: ComponentRow[] } {
	return { installed: [], history: [] };
}

/** Not retired and not currently installed anywhere. */
export function listSpares(_db: DB, _athleteId: number): ComponentRow[] {
	return [];
}

export function addComponent(
	_db: DB,
	_gearId: string,
	_installedAt: number,
	_fields: ComponentFields
): number {
	return 0;
}

export function installComponent(
	_db: DB,
	_componentId: number,
	_gearId: string,
	_installedAt: number
): void {}

/** Close the open install at `at`; optionally mark the part retired. */
export function removeComponent(
	_db: DB,
	_componentId: number,
	_at: number,
	_opts: { retire: boolean }
): void {}

/** Remove + retire `oldId` and install a new part on the same bike on the same date. */
export function swapComponent(
	_db: DB,
	_oldId: number,
	_at: number,
	_fields: ComponentFields
): number {
	return 0;
}

export function updateComponent(_db: DB, _id: number, _fields: Partial<ComponentFields>): void {}

export function deleteComponent(_db: DB, _id: number): void {}
