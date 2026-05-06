<script lang="ts">
	import RouteMap from '$lib/components/charts/RouteMap.svelte';
	import { friendlyLabel, effectiveSportType } from '$lib/shared/sport-types';
	import {
		fmtDistance,
		fmtDuration,
		fmtElevation,
		fmtSpeed,
		type UnitSystem
	} from '$lib/shared/units';
	import type { Activity, Gear } from '$lib/server/db/schema';

	let { data } = $props<{ data: { activity: Activity; gear: Gear | null } }>();

	const units: UnitSystem = 'imperial';

	const a = $derived(data.activity);
	const g = $derived(data.gear);

	const gearMap = $derived.by(() => {
		const m = new Map<string, { frame_type: number | null }>();
		if (g) m.set(g.id, { frame_type: g.frame_type });
		return m;
	});

	const sport = $derived(friendlyLabel(effectiveSportType(a, gearMap)));

	function fmtDateTime(epochSec: number): string {
		const d = new Date(epochSec * 1000);
		return d.toISOString().slice(0, 16).replace('T', ' ');
	}

	function fmtRound(n: number | null | undefined, suffix = ''): string {
		return n != null ? `${Math.round(n)}${suffix}` : '—';
	}

	const backHref = $derived(g ? `/gear/${g.id}` : '/');
	const backLabel = $derived(g ? `← ${g.name}` : '← Dashboard');
	const stravaUrl = $derived(`https://www.strava.com/activities/${a.id}`);
</script>

<svelte:head>
	<title>{a.name} — ostinato</title>
</svelte:head>

<a href={backHref} class="back">{backLabel}</a>

<div class="head">
	<h1>{a.name}</h1>
	<div class="meta muted">
		<span>{fmtDateTime(a.start_date_local)}</span>
		<span>·</span>
		<span class="pill">{sport}</span>
		{#if g}
			<span>·</span>
			<a href="/gear/{g.id}">{g.name}</a>
		{/if}
		<span>·</span>
		<a href={stravaUrl} target="_blank" rel="noopener noreferrer">View on Strava ↗</a>
	</div>
</div>

<div class="totals">
	<div class="card t">
		<div class="t-label">Distance</div>
		<div class="t-val">{fmtDistance(a.distance_m, units)}</div>
	</div>
	<div class="card t">
		<div class="t-label">Moving time</div>
		<div class="t-val">{fmtDuration(a.moving_time_s)}</div>
	</div>
	<div class="card t">
		<div class="t-label">Elapsed</div>
		<div class="t-val">{fmtDuration(a.elapsed_time_s)}</div>
	</div>
	<div class="card t">
		<div class="t-label">Elevation gain</div>
		<div class="t-val">{fmtElevation(a.total_elevation_gain_m, units)}</div>
	</div>
	{#if a.elev_high_m != null}
		<div class="card t">
			<div class="t-label">Elev high</div>
			<div class="t-val">{fmtElevation(a.elev_high_m, units)}</div>
		</div>
	{/if}
	{#if a.elev_low_m != null}
		<div class="card t">
			<div class="t-label">Elev low</div>
			<div class="t-val">{fmtElevation(a.elev_low_m, units)}</div>
		</div>
	{/if}
	<div class="card t">
		<div class="t-label">Avg speed</div>
		<div class="t-val">{a.average_speed != null ? fmtSpeed(a.average_speed, units) : '—'}</div>
	</div>
	<div class="card t">
		<div class="t-label">Max speed</div>
		<div class="t-val">{a.max_speed != null ? fmtSpeed(a.max_speed, units) : '—'}</div>
	</div>
	<div class="card t">
		<div class="t-label">Avg HR</div>
		<div class="t-val">{fmtRound(a.average_heartrate, ' bpm')}</div>
	</div>
	<div class="card t">
		<div class="t-label">Max HR</div>
		<div class="t-val">{fmtRound(a.max_heartrate, ' bpm')}</div>
	</div>
	<div class="card t">
		<div class="t-label">Avg power</div>
		<div class="t-val">{fmtRound(a.average_watts, ' W')}</div>
	</div>
	<div class="card t">
		<div class="t-label">Wtd avg power</div>
		<div class="t-val">{fmtRound(a.weighted_average_watts, ' W')}</div>
	</div>
	<div class="card t">
		<div class="t-label">Max power</div>
		<div class="t-val">{fmtRound(a.max_watts, ' W')}</div>
	</div>
	<div class="card t">
		<div class="t-label">Kilojoules</div>
		<div class="t-val">{fmtRound(a.kilojoules)}</div>
	</div>
	<div class="card t">
		<div class="t-label">Avg cadence</div>
		<div class="t-val">{fmtRound(a.average_cadence)}</div>
	</div>
	<div class="card t">
		<div class="t-label">Calories</div>
		<div class="t-val">{fmtRound(a.calories)}</div>
	</div>
	<div class="card t">
		<div class="t-label">Suffer</div>
		<div class="t-val">{a.suffer_score ?? '—'}</div>
	</div>
</div>

{#if a.summary_polyline}
	<div class="card">
		<h2>Route</h2>
		<RouteMap
			polyline={a.summary_polyline}
			startLatLng={a.start_lat != null && a.start_lng != null ? [a.start_lat, a.start_lng] : null}
			endLatLng={a.end_lat != null && a.end_lng != null ? [a.end_lat, a.end_lng] : null}
		/>
	</div>
{/if}

{#if !a.detail_fetched_at}
	<div class="card hint muted">
		Detail not yet enriched. Click <a href="/settings">Enrich next 25</a> on Settings to pull
		calories, description, splits, and segment efforts for recent rides. Per-activity enrich + streams coming in follow-ups.
	</div>
{/if}

<style>
	.back {
		display: inline-block;
		margin-bottom: 12px;
		color: var(--fg-muted);
		font-size: 13px;
	}
	.head {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0 0 4px;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--fg-soft);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		font-size: 13px;
	}
	.meta a {
		color: var(--accent);
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 8px;
		margin-bottom: 16px;
	}
	.t {
		padding: 12px;
	}
	.t-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--fg-muted);
		margin-bottom: 4px;
	}
	.t-val {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.card {
		margin-bottom: 16px;
	}
	.hint {
		font-size: 13px;
	}
</style>
