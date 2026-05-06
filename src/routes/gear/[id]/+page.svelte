<script lang="ts">
	import LineArea from '$lib/components/charts/LineArea.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import Heatmap from '$lib/components/charts/Heatmap.svelte';
	import { friendlyLabel } from '$lib/shared/sport-types';
	import {
		fmtDistance,
		fmtDuration,
		fmtElevation,
		fmtSpeed,
		metersToMiles,
		type UnitSystem
	} from '$lib/shared/units';
	import { monthKey } from '$lib/shared/time';
	import {
		cumulativeDistance,
		dayOfWeekBuckets,
		rideLengthHistogram,
		sportMixSlices,
		type ActivityForStats,
		type GearForSport
	} from '$lib/shared/gear-stats';
	import type { Activity, Gear } from '$lib/server/db/schema';
	import type { GearTotals } from '$lib/server/repos/gear';

	let { data } = $props<{
		data: { gear: Gear; totals: GearTotals | null; activities: Activity[] };
	}>();

	const units: UnitSystem = 'imperial';

	type SortKey =
		| 'date'
		| 'name'
		| 'distance'
		| 'time'
		| 'elev'
		| 'speed'
		| 'watts'
		| 'cadence'
		| 'hr'
		| 'suffer';

	let sortKey = $state<SortKey>('date');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function sortBy(k: SortKey) {
		if (sortKey === k) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = k;
			sortDir = k === 'name' ? 'asc' : 'desc';
		}
	}

	const sorted = $derived.by(() => {
		const list = [...data.activities];
		const dir = sortDir === 'asc' ? 1 : -1;
		const key = (a: Activity): number | string => {
			switch (sortKey) {
				case 'date':
					return a.start_date;
				case 'name':
					return a.name.toLowerCase();
				case 'distance':
					return a.distance_m;
				case 'time':
					return a.moving_time_s;
				case 'elev':
					return a.total_elevation_gain_m;
				case 'speed':
					return a.average_speed ?? -1;
				case 'watts':
					return a.average_watts ?? -1;
				case 'cadence':
					return a.average_cadence ?? -1;
				case 'hr':
					return a.average_heartrate ?? -1;
				case 'suffer':
					return a.suffer_score ?? -1;
			}
		};
		list.sort((a, b) => {
			const av = key(a),
				bv = key(b);
			if (av < bv) return -1 * dir;
			if (av > bv) return 1 * dir;
			return 0;
		});
		return list;
	});

	const monthSparkline = $derived.by(() => {
		const m = new Map<string, number>();
		for (const a of data.activities) {
			const k = monthKey(a.start_date);
			m.set(k, (m.get(k) ?? 0) + metersToMiles(a.distance_m));
		}
		return [...m.entries()]
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([key, value]) => ({ label: key.slice(2), value }));
	});

	const gearById = $derived(
		new Map<string, GearForSport>([[data.gear.id, { frame_type: data.gear.frame_type }]])
	);

	const statsActivities = $derived(
		data.activities.map(
			(a: Activity): ActivityForStats => ({
				start_date: a.start_date,
				start_date_local: a.start_date_local,
				distance_m: a.distance_m,
				sport_type: a.sport_type,
				gear_id: a.gear_id
			})
		)
	);

	const cumulative = $derived.by(() =>
		cumulativeDistance(statsActivities, units).map((p) => ({
			...p,
			label: p.label.slice(2)
		}))
	);

	const weekday = $derived.by(() =>
		dayOfWeekBuckets(statsActivities).map((b) => ({ label: b.day, value: b.rides }))
	);

	const histogram = $derived.by(() =>
		rideLengthHistogram(statsActivities, undefined, units).map((b) => ({
			label: b.label,
			value: b.count
		}))
	);

	const sportMix = $derived(sportMixSlices(statsActivities, gearById));

	function fmtDate(epochSec: number): string {
		return new Date(epochSec * 1000).toISOString().slice(0, 10);
	}
</script>

<a href="/gear" class="back">← All gear</a>

<div class="head">
	<h1>{data.gear.name}</h1>
	<div class="meta muted">
		{[data.gear.brand, data.gear.model].filter(Boolean).join(' · ') || data.gear.kind}
	</div>
</div>

{#if data.totals}
	<div class="totals">
		<div class="card t">
			<div class="t-label">Distance</div>
			<div class="t-val">{fmtDistance(data.totals.distance_m, units)}</div>
		</div>
		<div class="card t">
			<div class="t-label">Activities</div>
			<div class="t-val">{data.totals.count}</div>
		</div>
		<div class="card t">
			<div class="t-label">Time</div>
			<div class="t-val">{fmtDuration(data.totals.moving_time_s)}</div>
		</div>
		<div class="card t">
			<div class="t-label">Elevation</div>
			<div class="t-val">{fmtElevation(data.totals.elev_m, units)}</div>
		</div>
		<div class="card t">
			<div class="t-label">Avg speed</div>
			<div class="t-val">{data.totals.avg_speed != null ? fmtSpeed(data.totals.avg_speed, units) : '—'}</div>
		</div>
		<div class="card t">
			<div class="t-label">Avg power</div>
			<div class="t-val">{data.totals.avg_watts != null ? `${Math.round(data.totals.avg_watts)} W` : '—'}</div>
		</div>
		<div class="card t">
			<div class="t-label">Avg cadence</div>
			<div class="t-val">{data.totals.avg_cadence != null ? `${Math.round(data.totals.avg_cadence)}` : '—'}</div>
		</div>
		<div class="card t">
			<div class="t-label">Avg HR</div>
			<div class="t-val">{data.totals.avg_heartrate != null ? `${Math.round(data.totals.avg_heartrate)} bpm` : '—'}</div>
		</div>
	</div>
{/if}

{#if monthSparkline.length > 0}
	<div class="card">
		<h2>Monthly distance</h2>
		<LineArea points={monthSparkline} formatValue={(v) => v.toFixed(0)} yAxisLabel=" mi" labelEvery={3} height={80} />
	</div>
{/if}

{#if data.activities.length > 0 && data.gear.kind === 'bike'}
	<div class="chart-grid">
		<div class="card">
			<h2>Cumulative distance</h2>
			<LineArea points={cumulative} formatValue={(v) => v.toFixed(0)} yAxisLabel=" mi" labelEvery={3} height={140} />
		</div>
		<div class="card">
			<h2>Sport mix</h2>
			{#if sportMix.length === 1}
				<p class="muted small">All rides logged as <strong>{sportMix[0].name}</strong> ({sportMix[0].value}).</p>
			{:else}
				<Donut data={sportMix} size={180} formatValue={(v) => `${Math.round(v)}`} totalLabel="rides" />
			{/if}
		</div>
		<div class="card">
			<h2>Day of week</h2>
			<BarChart data={weekday} height={180} formatValue={(v) => v.toFixed(0)} yAxisLabel="" />
		</div>
		<div class="card">
			<h2>Ride length</h2>
			<BarChart data={histogram} height={180} formatValue={(v) => v.toFixed(0)} yAxisLabel="" color="var(--accent-2)" />
		</div>
	</div>
{/if}

<div class="card">
	<h2>Where I ride this {data.gear.kind === 'shoe' ? 'shoe' : 'bike'}</h2>
	<Heatmap caption="Heatmap coming in v2 — polylines + filterable map." />
</div>

<div class="card">
	<h2>Activities ({data.activities.length})</h2>
	{#if data.activities.length === 0}
		<p class="muted">No activities recorded on this gear.</p>
	{:else}
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th><button onclick={() => sortBy('date')}>Date</button></th>
						<th><button onclick={() => sortBy('name')}>Name</button></th>
						<th>Sport</th>
						<th><button onclick={() => sortBy('distance')}>Distance</button></th>
						<th><button onclick={() => sortBy('time')}>Time</button></th>
						<th><button onclick={() => sortBy('elev')}>Elev</button></th>
						<th><button onclick={() => sortBy('speed')}>Avg speed</button></th>
						<th><button onclick={() => sortBy('watts')}>Avg W</button></th>
						<th><button onclick={() => sortBy('cadence')}>Avg cad</button></th>
						<th><button onclick={() => sortBy('hr')}>Avg HR</button></th>
						<th><button onclick={() => sortBy('suffer')}>Suffer</button></th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as a (a.id)}
						<tr>
							<td class="muted">{fmtDate(a.start_date)}</td>
							<td><a href="/activities/{a.id}" class="row-link">{a.name}</a></td>
							<td><span class="pill">{friendlyLabel(a.sport_type)}</span></td>
							<td class="num">{fmtDistance(a.distance_m, units)}</td>
							<td class="num">{fmtDuration(a.moving_time_s)}</td>
							<td class="num">{fmtElevation(a.total_elevation_gain_m, units)}</td>
							<td class="num">{a.average_speed != null ? fmtSpeed(a.average_speed, units) : '—'}</td>
							<td class="num">{a.average_watts != null ? Math.round(a.average_watts) : '—'}</td>
							<td class="num">{a.average_cadence != null ? Math.round(a.average_cadence) : '—'}</td>
							<td class="num">{a.average_heartrate != null ? Math.round(a.average_heartrate) : '—'}</td>
							<td class="num">{a.suffer_score ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

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
	.chart-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		margin-bottom: 16px;
	}
	.chart-grid .card {
		margin-bottom: 0;
	}
	.small {
		font-size: 12px;
	}
	@media (max-width: 768px) {
		.chart-grid {
			grid-template-columns: 1fr;
		}
	}
	.table-scroll {
		overflow-x: auto;
	}
	thead button {
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		padding: 0;
		cursor: pointer;
		text-transform: inherit;
		letter-spacing: inherit;
	}
	thead button:hover {
		color: var(--accent);
	}
	.num {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.row-link {
		color: inherit;
		text-decoration: none;
	}
	.row-link:hover {
		color: var(--accent);
		text-decoration: underline;
	}
</style>
