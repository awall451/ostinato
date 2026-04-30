import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sync_state, type SyncState } from '../db/schema';
import * as schema from '../db/schema';

type DB = BetterSQLite3Database<typeof schema>;

export function getSyncState(db: DB): SyncState | null {
	const r = db.select().from(sync_state).where(eq(sync_state.id, 1)).all();
	return r[0] ?? null;
}

function ensure(db: DB): void {
	const existing = getSyncState(db);
	if (!existing) {
		db.insert(sync_state).values({ id: 1 }).run();
	}
}

export function setLastSyncedAt(db: DB, now: number, lastAfterEpoch?: number | null): void {
	ensure(db);
	const patch: Partial<SyncState> = { last_synced_at: now };
	if (lastAfterEpoch !== undefined) patch.last_after_epoch = lastAfterEpoch;
	db.update(sync_state).set(patch).where(eq(sync_state.id, 1)).run();
}

export function setFullBackfillAt(db: DB, now: number): void {
	ensure(db);
	db.update(sync_state)
		.set({ last_full_backfill_at: now, last_synced_at: now })
		.where(eq(sync_state.id, 1))
		.run();
}

export function recordRateLimit(
	db: DB,
	usage: { used15: number; limit15: number; usedDay: number; limitDay: number },
	observedAt: number
): void {
	ensure(db);
	db.update(sync_state)
		.set({
			rate_limit_15min_used: usage.used15,
			rate_limit_15min_limit: usage.limit15,
			rate_limit_daily_used: usage.usedDay,
			rate_limit_daily_limit: usage.limitDay,
			rate_limit_observed_at: observedAt
		})
		.where(eq(sync_state.id, 1))
		.run();
}

export function recordError(db: DB, msg: string, at: number): void {
	ensure(db);
	db.update(sync_state)
		.set({ last_error: msg, last_error_at: at })
		.where(eq(sync_state.id, 1))
		.run();
}

export function clearError(db: DB): void {
	ensure(db);
	db.update(sync_state)
		.set({ last_error: null, last_error_at: null })
		.where(eq(sync_state.id, 1))
		.run();
}
