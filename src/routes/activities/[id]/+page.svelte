<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import RouteMap from '$lib/components/charts/RouteMap.svelte';
	import StreamChart from '$lib/components/charts/StreamChart.svelte';
	import { friendlyLabel, effectiveSportType } from '$lib/shared/sport-types';
	import {
		fmtDistance,
		fmtDuration,
		fmtElevation,
		fmtSpeed,
		metersToMiles,
		metersToKm,
		metersToFeet,
		mpsToMph,
		mpsToKmh,
		type UnitSystem
	} from '$lib/shared/units';
	import type { Activity, Gear } from '$lib/server/db/schema';
	import type { SplitRow, SegmentEffortRow } from '$lib/shared/activity-detail';

	let { data } = $props<{
		data: {
			activity: Activity;
			gear: Gear | null;
			measurement: UnitSystem;
			description: string | null;
			splits: SplitRow[];
			segments: SegmentEffortRow[];
			streams: Record<string, number[] | [number, number][] | boolean[]>;
			hasStreams: boolean;
		};
	}>();

	const units: UnitSystem = $derived(data.measurement);

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

	function fmtPace(secondsPerUnit: number, unit: 'mi' | 'km'): string {
		if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) return '—';
		const m = Math.floor(secondsPerUnit / 60);
		const s = Math.round(secondsPerUnit % 60);
		return `${m}:${s.toString().padStart(2, '0')} /${unit}`;
	}

	const backHref = $derived(g ? `/gear/${g.id}` : '/');
	const backLabel = $derived(g ? `← ${g.name}` : '← Dashboard');
	const stravaUrl = $derived(`https://www.strava.com/activities/${a.id}`);
	const paceUnit = $derived(units === 'imperial' ? 'mi' : 'km');

	let busy = $state<string | null>(null);
	let error = $state<string>('');

	async function callPost(path: string, label: string) {
		busy = label;
		error = '';
		try {
			const r = await fetch(path, { method: 'POST' });
			if (!r.ok) {
				error = `${label} failed: ${r.status} ${await r.text()}`;
				return;
			}
			await invalidateAll();
		} catch (e) {
			error = `${label} threw: ${(e as Error).message}`;
		} finally {
			busy = null;
		}
	}

	const distanceSeries = $derived.by(() => {
		const d = data.streams.distance;
		if (!Array.isArray(d) || d.length === 0) return [] as number[];
		return (d as number[]).map((m) => (units === 'imperial' ? metersToMiles(m) : metersToKm(m)));
	});

	function asNumberSeries(key: string): number[] {
		const s = data.streams[key];
		return Array.isArray(s) && typeof s[0] === 'number' ? (s as number[]) : [];
	}

	const heartrate = $derived(asNumberSeries('heartrate'));
	const watts = $derived(asNumberSeries('watts'));
	const cadence = $derived(asNumberSeries('cadence'));
	const altitudeRaw = $derived(asNumberSeries('altitude'));
	const speedRaw = $derived(asNumberSeries('velocity_smooth'));

	const altitude = $derived.by(() =>
		altitudeRaw.map((m) => (units === 'imperial' ? metersToFeet(m) : m))
	);
	const speed = $derived.by(() =>
		speedRaw.map((mps) => (units === 'imperial' ? mpsToMph(mps) : mpsToKmh(mps)))
	);

	const xLabel = $derived(units === 'imperial' ? ' mi' : ' km');
	const elevUnit = $derived(units === 'imperial' ? ' ft' : ' m');
	const speedUnit = $derived(units === 'imperial' ? ' mph' : ' km/h');
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

{#if data.description}
	<div class="card desc">
		<h2>Description</h2>
		<p>{data.description}</p>
	</div>
{/if}

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

<div class="card actions">
	<button
		onclick={() => callPost(`/api/activities/${a.id}/enrich`, 'enrich')}
		disabled={a.detail_fetched_at != null || busy !== null}
	>
		{a.detail_fetched_at != null
			? 'Detail enriched ✓'
			: busy === 'enrich'
				? 'Enriching…'
				: 'Enrich detail'}
	</button>
	<button
		onclick={() => callPost(`/api/activities/${a.id}/streams`, 'streams')}
		disabled={data.hasStreams || busy !== null}
	>
		{data.hasStreams
			? 'Streams pulled ✓'
			: busy === 'streams'
				? 'Pulling streams…'
				: 'Pull streams'}
	</button>
	<span class="muted small">
		Each button consumes 1 Strava API call.
	</span>
	{#if error}
		<div class="banner err">{error}</div>
	{/if}
</div>

{#if data.hasStreams && distanceSeries.length > 0}
	<div class="card streams">
		<h2>Time series</h2>
		{#if heartrate.length > 0}
			<StreamChart
				xs={distanceSeries}
				ys={heartrate}
				title="Heart rate"
				yLabel=" bpm"
				xLabel={xLabel}
				color="#ef4444"
			/>
		{/if}
		{#if watts.length > 0}
			<StreamChart
				xs={distanceSeries}
				ys={watts}
				title="Power"
				yLabel=" W"
				xLabel={xLabel}
				color="#f59e0b"
			/>
		{/if}
		{#if cadence.length > 0}
			<StreamChart
				xs={distanceSeries}
				ys={cadence}
				title="Cadence"
				yLabel=" rpm"
				xLabel={xLabel}
				color="#a78bfa"
			/>
		{/if}
		{#if speed.length > 0}
			<StreamChart
				xs={distanceSeries}
				ys={speed}
				title="Speed"
				yLabel={speedUnit}
				xLabel={xLabel}
				formatY={(v) => v.toFixed(1)}
				color="#22c55e"
			/>
		{/if}
		{#if altitude.length > 0}
			<StreamChart
				xs={distanceSeries}
				ys={altitude}
				title="Elevation"
				yLabel={elevUnit}
				xLabel={xLabel}
				color="#5b9bd5"
			/>
		{/if}
	</div>
{/if}

{#if data.splits.length > 0}
	<div class="card">
		<h2>Splits ({paceUnit})</h2>
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Distance</th>
						<th>Time</th>
						<th>Pace</th>
						<th>Elev Δ</th>
						<th>Avg HR</th>
					</tr>
				</thead>
				<tbody>
					{#each data.splits as s (s.index)}
						<tr>
							<td class="num">{s.index}</td>
							<td class="num">{fmtDistance(s.distance_m, units)}</td>
							<td class="num">{fmtDuration(s.moving_time_s)}</td>
							<td class="num">{fmtPace(s.pace_seconds_per_unit, paceUnit)}</td>
							<td class="num">{fmtElevation(s.elevation_difference_m, units)}</td>
							<td class="num">{fmtRound(s.average_heartrate, ' bpm')}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

{#if data.segments.length > 0}
	<div class="card">
		<h2>Segment efforts ({data.segments.length})</h2>
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th>Segment</th>
						<th>Distance</th>
						<th>Time</th>
						<th>Avg W</th>
						<th>Avg HR</th>
						<th>KOM</th>
						<th>PR</th>
					</tr>
				</thead>
				<tbody>
					{#each data.segments as s (s.segment_id)}
						<tr>
							<td>
								<a href="https://www.strava.com/segments/{s.segment_id}" target="_blank" rel="noopener noreferrer">
									{s.segment_name}
								</a>
							</td>
							<td class="num">{fmtDistance(s.distance_m, units)}</td>
							<td class="num">{fmtDuration(s.moving_time_s)}</td>
							<td class="num">{fmtRound(s.average_watts, ' W')}</td>
							<td class="num">{fmtRound(s.average_heartrate, ' bpm')}</td>
							<td class="num">{s.kom_rank != null ? `#${s.kom_rank}` : '—'}</td>
							<td class="num">{s.pr_rank != null ? `#${s.pr_rank}` : '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
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
	.desc p {
		margin: 0;
		white-space: pre-wrap;
		font-size: 14px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}
	.small {
		font-size: 12px;
	}
	.table-scroll {
		overflow-x: auto;
	}
	.num {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.banner.err {
		flex-basis: 100%;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 13px;
		background: color-mix(in srgb, var(--danger) 15%, var(--bg));
		border: 1px solid var(--danger);
		color: var(--danger);
	}
</style>
