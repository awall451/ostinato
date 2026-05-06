<script lang="ts">
	import { fmtDistance, fmtDuration, fmtElevation, fmtSpeed, type UnitSystem } from '$lib/shared/units';
	import type { GearTotals } from '$lib/server/repos/gear';
	import type { Gear } from '$lib/server/db/schema';

	let {
		gear,
		color = null,
		headline,
		headlineLabel,
		units = 'imperial'
	} = $props<{
		gear: Gear & { totals: GearTotals | null };
		color?: string | null;
		headline: string;
		headlineLabel: string;
		units?: UnitSystem;
	}>();

	let expanded = $state(false);

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

<div class="bike-row card" class:expanded class:retired={gear.retired}>
	<button class="head" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
		<span class="left">
			{#if color}<span class="dot" style="background:{color}"></span>{/if}
			<span class="name">{gear.name}</span>
			{#if frameLabel}<span class="pill">{frameLabel}</span>{/if}
			{#if gear.primary_flag}<span class="pill primary">primary</span>{/if}
			{#if gear.retired}<span class="pill ret">retired</span>{/if}
		</span>
		<span class="middle muted">
			{#if gear.brand || gear.model}
				{[gear.brand, gear.model].filter(Boolean).join(' · ')}
			{/if}
		</span>
		<span class="headline">
			<span class="hv">{headline}</span>
			<span class="hl muted">{headlineLabel}</span>
		</span>
		<svg class="chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
			<path d="M5 3l6 5-6 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>
	<div class="panel">
		<div class="panel-inner">
			{#if t}
				<div class="stat-row">
					<span class="muted">{t.count} {gear.kind === 'shoe' ? 'runs' : 'rides'}</span>
					<span class="sep">·</span>
					<span class="muted">{fmtDistance(t.distance_m, units)}</span>
					<span class="sep">·</span>
					<span class="muted">{fmtDuration(t.moving_time_s)}</span>
					<span class="sep">·</span>
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
						<div class="m-val">{t.avg_cadence != null ? Math.round(t.avg_cadence) : '—'}</div>
					</div>
					<div class="metric">
						<div class="m-label">Avg HR</div>
						<div class="m-val">{t.avg_heartrate != null ? `${Math.round(t.avg_heartrate)} bpm` : '—'}</div>
					</div>
				</div>
			{:else}
				<p class="muted">No activities recorded.</p>
			{/if}
			<a class="details-link" href="/gear/{gear.id}">View details →</a>
		</div>
	</div>
</div>

<style>
	.bike-row {
		padding: 0;
		overflow: hidden;
	}
	.head {
		width: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, auto) auto auto;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: transparent;
		border: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		font: inherit;
	}
	.head:hover {
		background: var(--bg-elev);
	}
	.left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex-wrap: wrap;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex: none;
	}
	.name {
		font-size: 15px;
		font-weight: 600;
	}
	.middle {
		font-size: 12px;
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.headline {
		display: flex;
		align-items: baseline;
		gap: 4px;
		font-variant-numeric: tabular-nums;
	}
	.hv {
		font-size: 18px;
		font-weight: 700;
	}
	.hl {
		font-size: 12px;
	}
	.chev {
		transition: transform 180ms ease;
		color: var(--fg-muted);
	}
	.expanded .chev {
		transform: rotate(90deg);
	}
	.panel {
		max-height: 0;
		opacity: 0;
		overflow: hidden;
		transition:
			max-height 220ms ease,
			opacity 180ms ease;
	}
	.expanded .panel {
		max-height: 320px;
		opacity: 1;
	}
	.panel-inner {
		padding: 12px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-top: 1px solid var(--border);
	}
	.stat-row {
		display: flex;
		gap: 6px;
		font-size: 12px;
		flex-wrap: wrap;
	}
	.sep {
		color: var(--fg-muted);
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}
	.m-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
	}
	.m-val {
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.details-link {
		font-size: 13px;
		align-self: flex-start;
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
	.retired {
		opacity: 0.7;
	}
	@media (prefers-reduced-motion: reduce) {
		.chev,
		.panel {
			transition: none;
		}
	}
	@media (max-width: 600px) {
		.middle {
			display: none;
		}
		.head {
			grid-template-columns: minmax(0, 1fr) auto auto;
		}
		.metrics {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
