<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { SyncState } from '$lib/server/db/schema';

	let { data } = $props<{
		data: {
			connected: boolean;
			sync: SyncState | null;
			totalActivities: number;
			needsDetail: number;
		};
	}>();

	let busy = $state<string | null>(null);
	let result = $state<string>('');
	let error = $state<string>('');

	async function callPost(path: string, label: string) {
		busy = label;
		result = '';
		error = '';
		try {
			const r = await fetch(path, { method: 'POST' });
			const text = await r.text();
			if (!r.ok) {
				error = `${label} failed: ${r.status} ${text}`;
				return;
			}
			const body = text ? JSON.parse(text) : {};
			result = `${label} ok: ${JSON.stringify(body)}`;
			await invalidateAll();
		} catch (e) {
			error = `${label} threw: ${(e as Error).message}`;
		} finally {
			busy = null;
		}
	}

	function fmtRel(epoch: number | null | undefined): string {
		if (!epoch) return 'never';
		const secs = Math.floor(Date.now() / 1000) - epoch;
		if (secs < 60) return `${secs}s ago`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
		if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
		return `${Math.floor(secs / 86400)}d ago`;
	}

	async function loadFixtures() {
		await callPost('/api/seed', 'Load fixtures');
	}

	async function disconnect() {
		await fetch('/auth/disconnect', { method: 'POST' });
		await invalidateAll();
	}
</script>

<h1>Settings</h1>

<div class="card">
	<h2>Strava connection</h2>
	{#if data.connected}
		<p>
			<span class="ok">●</span> Connected.
			<span class="muted">Last sync: {fmtRel(data.sync?.last_synced_at)} · last full backfill: {fmtRel(data.sync?.last_full_backfill_at)}.</span>
		</p>
		<button onclick={disconnect}>Disconnect Strava</button>
	{:else}
		<p>
			<span class="bad">●</span> Not connected.
			<span class="muted">Connect to start syncing your activities.</span>
		</p>
		<a class="btn" href="/auth/connect">Connect Strava</a>
	{/if}
</div>

<div class="card">
	<h2>Sync</h2>
	<div class="actions">
		<button disabled={!data.connected || busy !== null} onclick={() => callPost('/api/sync', 'Sync now')}>
			{busy === 'Sync now' ? 'Syncing…' : 'Sync now'}
		</button>
		<button disabled={!data.connected || busy !== null} onclick={() => callPost('/api/sync/full', 'Backfill all')}>
			{busy === 'Backfill all' ? 'Running…' : 'Backfill all summaries'}
		</button>
		<button
			disabled={!data.connected || busy !== null || data.needsDetail === 0}
			onclick={() => callPost('/api/sync/detail?limit=25', 'Enrich 25')}
		>
			{busy === 'Enrich 25' ? 'Enriching…' : `Enrich next 25 with detail`}
		</button>
	</div>
	<p class="muted small">
		{data.totalActivities} activities · {data.needsDetail} need detail enrichment.
	</p>

	{#if data.sync}
		<div class="rate">
			<span class="rate-label">15-min:</span>
			<span class="rate-val">
				{data.sync.rate_limit_15min_used ?? '—'} / {data.sync.rate_limit_15min_limit ?? '100'}
			</span>
			<span class="rate-sep">·</span>
			<span class="rate-label">Daily:</span>
			<span class="rate-val">
				{data.sync.rate_limit_daily_used ?? '—'} / {data.sync.rate_limit_daily_limit ?? '1000'}
			</span>
		</div>
		{#if data.sync.last_error}
			<p class="error-line">Last error: {data.sync.last_error} <span class="muted">({fmtRel(data.sync.last_error_at)})</span></p>
		{/if}
	{/if}
</div>

<div class="card">
	<h2>Development</h2>
	<button onclick={loadFixtures} disabled={busy !== null}>
		{busy === 'Load fixtures' ? 'Loading…' : 'Load fixtures'}
	</button>
	<p class="muted small">Wipes the DB and inserts ~150 synthetic activities.</p>
</div>

{#if result}
	<div class="banner success">{result}</div>
{/if}
{#if error}
	<div class="banner err">{error}</div>
{/if}

<style>
	h1 {
		margin: 0 0 16px;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
	}
	.card {
		margin-bottom: 16px;
	}
	.btn {
		display: inline-block;
		padding: 6px 12px;
		border-radius: 6px;
		background: var(--accent);
		color: var(--bg);
		font-weight: 600;
		text-decoration: none;
	}
	.btn:hover {
		filter: brightness(1.1);
		text-decoration: none;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
	.ok {
		color: var(--success);
	}
	.bad {
		color: var(--danger);
	}
	.small {
		font-size: 12px;
		margin: 4px 0 0;
	}
	.rate {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--surface);
		border-radius: 6px;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		margin-top: 8px;
		width: fit-content;
	}
	.rate-label {
		color: var(--fg-muted);
	}
	.rate-sep {
		color: var(--fg-muted);
	}
	.error-line {
		color: var(--danger);
		font-size: 12px;
		margin: 8px 0 0;
	}
	.banner {
		padding: 10px 14px;
		border-radius: 6px;
		font-size: 13px;
		margin-top: 8px;
	}
	.banner.success {
		background: color-mix(in srgb, var(--success) 15%, var(--bg));
		border: 1px solid var(--success);
	}
	.banner.err {
		background: color-mix(in srgb, var(--danger) 15%, var(--bg));
		border: 1px solid var(--danger);
		color: var(--danger);
	}
</style>
