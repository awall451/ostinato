<script lang="ts">
	import { fmtDistance, fmtDuration, fmtElevation, fmtSpeed, type UnitSystem } from '$lib/shared/units';
	import type { GearTotals } from '$lib/server/repos/gear';
	import type { Gear } from '$lib/server/db/schema';

	let { gear, units = 'imperial' } = $props<{
		gear: Gear & { totals: GearTotals | null };
		units?: UnitSystem;
	}>();

	const FRAME_LABELS: Record<number, string> = {
		1: 'MTB',
		2: 'Cross',
		3: 'Road',
		4: 'TT',
		5: 'Gravel'
	};

	const frameLabel = $derived.by(() => {
		if (gear.kind !== 'bike' || gear.frame_type == null) return null;
		return FRAME_LABELS[gear.frame_type] ?? null;
	});

	const t = $derived(gear.totals);
</script>

<a class="card gear-card" href={`/gear/${gear.id}`} class:retired={gear.retired}>
	<div class="head">
		<div class="title">
			<span class="name">{gear.name}</span>
			{#if frameLabel}<span class="pill">{frameLabel}</span>{/if}
			{#if gear.primary_flag}<span class="pill primary">primary</span>{/if}
			{#if gear.retired}<span class="pill ret">retired</span>{/if}
		</div>
		{#if gear.brand || gear.model}
			<div class="muted small">{[gear.brand, gear.model].filter(Boolean).join(' · ')}</div>
		{/if}
	</div>

	{#if t}
		<div class="big">{fmtDistance(t.distance_m, units)}</div>
		<div class="row">
			<span class="muted">{t.count} {gear.kind === 'shoe' ? 'runs' : 'rides'}</span>
			<span>·</span>
			<span class="muted">{fmtDuration(t.moving_time_s)}</span>
			<span>·</span>
			<span class="muted">{fmtElevation(t.elev_m, units)}</span>
		</div>
		<div class="metrics">
			<div class="metric">
				<div class="m-label">Avg speed</div>
				<div class="m-val">{t.avg_speed != null ? fmtSpeed(t.avg_speed, units) : '—'}</div>
			</div>
			<div class="metric">
				<div class="m-label">Avg power</div>
				<div class="m-val">{t.avg_watts != null ? `${Math.round(t.avg_watts)} W` : '—'}</div>
			</div>
			<div class="metric">
				<div class="m-label">Avg cadence</div>
				<div class="m-val">{t.avg_cadence != null ? `${Math.round(t.avg_cadence)}` : '—'}</div>
			</div>
			<div class="metric">
				<div class="m-label">Avg HR</div>
				<div class="m-val">{t.avg_heartrate != null ? `${Math.round(t.avg_heartrate)} bpm` : '—'}</div>
			</div>
		</div>
	{:else}
		<div class="muted">No activities recorded.</div>
	{/if}
</a>

<style>
	.gear-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.12s, transform 0.12s;
	}
	.gear-card:hover {
		border-color: var(--accent);
		text-decoration: none;
	}
	.gear-card.retired {
		opacity: 0.6;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.name {
		font-size: 15px;
		font-weight: 600;
	}
	.pill.primary {
		background: var(--accent);
		color: var(--bg);
		border-color: transparent;
	}
	.pill.ret {
		background: var(--surface);
		color: var(--fg-muted);
	}
	.big {
		font-size: 24px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.row {
		display: flex;
		gap: 6px;
		font-size: 12px;
		color: var(--fg-soft);
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		margin-top: 6px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.metric {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.m-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
	}
	.m-val {
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.small {
		font-size: 12px;
	}
</style>
