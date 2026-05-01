<script lang="ts">
	import Donut from '$lib/components/charts/Donut.svelte';
	import StackedBar from '$lib/components/charts/StackedBar.svelte';
	import LineArea from '$lib/components/charts/LineArea.svelte';
	import { friendlyLabel, effectiveSportType } from '$lib/shared/sport-types';
	import { fmtDistance, fmtDuration, metersToMiles, secondsToHours, type UnitSystem } from '$lib/shared/units';
	import { bucketKey, type Bucket } from '$lib/shared/time';
	import { bucketGrid } from '$lib/shared/bucket-grid';
	import type { Activity, Gear } from '$lib/server/db/schema';

	let { data } = $props<{
		data: {
			activities: Activity[];
			gear: Gear[];
			rangeDays: number;
			startEpoch: number;
			endEpoch: number;
			connected: boolean;
		};
	}>();

	const units: UnitSystem = 'imperial';

	const RANGE_OPTIONS = [
		{ days: 30, label: '30d' },
		{ days: 90, label: '90d' },
		{ days: 180, label: '6mo' },
		{ days: 365, label: '1yr' },
		{ days: 730, label: '2yr' },
		{ days: 3650, label: 'all' }
	];

	const rangeDays = $derived(data.rangeDays);
	let metric = $state<'count' | 'distance' | 'time'>('distance');
	let bucket = $state<Bucket>('month');
	let selectedSport = $state<string | null>(null);

	const gearById = $derived(new Map<string, Gear>(data.gear.map((g: Gear) => [g.id, g])));

	const filtered = $derived.by(() =>
		selectedSport
			? data.activities.filter((a: Activity) => effectiveSportType(a, gearById) === selectedSport)
			: data.activities
	);

	const sportTotals = $derived.by(() => {
		const m = new Map<string, { count: number; distance_m: number; moving_time_s: number }>();
		for (const a of data.activities) {
			const sport = effectiveSportType(a, gearById);
			const cur = m.get(sport) ?? { count: 0, distance_m: 0, moving_time_s: 0 };
			cur.count += 1;
			cur.distance_m += a.distance_m;
			cur.moving_time_s += a.moving_time_s;
			m.set(sport, cur);
		}
		const list = [...m.entries()].map(([sport, t]) => ({
			name: friendlyLabel(sport),
			rawSport: sport,
			value:
				metric === 'count'
					? t.count
					: metric === 'distance'
						? metersToMiles(t.distance_m)
						: secondsToHours(t.moving_time_s)
		}));
		list.sort((a, b) => b.value - a.value);
		return list;
	});

	const bucketed = $derived.by(() => {
		const sportSet = new Set<string>();
		const filled = new Map<string, Map<string, number>>();
		for (const a of data.activities) {
			const sport = effectiveSportType(a, gearById);
			sportSet.add(sport);
			const k = bucketKey(a.start_date, bucket);
			let row = filled.get(k);
			if (!row) {
				row = new Map();
				filled.set(k, row);
			}
			const v =
				metric === 'count'
					? 1
					: metric === 'distance'
						? metersToMiles(a.distance_m)
						: secondsToHours(a.moving_time_s);
			row.set(sport, (row.get(sport) ?? 0) + v);
		}
		const series = [...sportSet].sort();
		const friendly = series.map(friendlyLabel);
		const grid = bucketGrid(data.startEpoch, data.endEpoch, bucket);
		const buckets = grid.map((key) => {
			const perRaw = filled.get(key);
			const perSeries = new Map<string, number>();
			if (perRaw) for (const [s, v] of perRaw) perSeries.set(friendlyLabel(s), v);
			return { key, label: shortBucketLabel(key, bucket), perSeries };
		});
		return { buckets, series: friendly };
	});

	function shortBucketLabel(key: string, b: Bucket): string {
		if (b === 'week') return key.replace(/^\d{4}-/, '');
		if (b === 'month') return key.slice(2); // 26-04
		return key;
	}

	const weeklyDistance = $derived.by(() => {
		const m = new Map<string, number>();
		for (const a of data.activities) {
			const k = bucketKey(a.start_date, 'week');
			m.set(k, (m.get(k) ?? 0) + metersToMiles(a.distance_m));
		}
		return [...m.entries()]
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.slice(-26) // last ~6 months of weeks
			.map(([key, value]) => ({ label: key.replace(/^\d{4}-/, ''), value }));
	});

	const grandTotal = $derived.by(() => {
		const t = { count: 0, distance_m: 0, moving_time_s: 0, elev_m: 0 };
		for (const a of data.activities) {
			t.count += 1;
			t.distance_m += a.distance_m;
			t.moving_time_s += a.moving_time_s;
			t.elev_m += a.total_elevation_gain_m;
		}
		return t;
	});

	function setRange(days: number) {
		const u = new URL(window.location.href);
		u.searchParams.set('days', String(days));
		window.location.href = u.toString();
	}

	function metricFormat(v: number): string {
		if (metric === 'count') return v.toFixed(0);
		if (metric === 'distance') return v.toFixed(1);
		return v.toFixed(1);
	}
	function metricLabel(): string {
		if (metric === 'count') return 'rides';
		if (metric === 'distance') return 'mi';
		return 'h';
	}
</script>

<div class="head">
	<h1>Dashboard</h1>
	<div class="controls">
		<div class="seg">
			{#each RANGE_OPTIONS as opt}
				<button class:active={rangeDays === opt.days} onclick={() => setRange(opt.days)}>
					{opt.label}
				</button>
			{/each}
		</div>
		<div class="seg">
			{#each ['count', 'distance', 'time'] as m}
				<button class:active={metric === m} onclick={() => (metric = m as typeof metric)}>
					{m}
				</button>
			{/each}
		</div>
		<div class="seg">
			{#each ['week', 'month', 'year'] as b}
				<button class:active={bucket === b} onclick={() => (bucket = b as Bucket)}>
					{b}
				</button>
			{/each}
		</div>
	</div>
</div>

{#if data.activities.length === 0}
	<div class="card empty">
		<h2>No data yet</h2>
		<p class="muted">
			Head to <a href="/settings">Settings</a>
			{#if data.connected}
				and run <strong>Backfill all summaries</strong>.
			{:else}
				and either <strong>Connect Strava</strong> or click <strong>Load fixtures</strong> for synthetic offline data.
			{/if}
		</p>
	</div>
{:else}
	<div class="kpis">
		<div class="card kpi">
			<div class="k-label">Activities</div>
			<div class="k-value">{grandTotal.count}</div>
		</div>
		<div class="card kpi">
			<div class="k-label">Distance</div>
			<div class="k-value">{fmtDistance(grandTotal.distance_m, units)}</div>
		</div>
		<div class="card kpi">
			<div class="k-label">Moving time</div>
			<div class="k-value">{fmtDuration(grandTotal.moving_time_s)}</div>
		</div>
		<div class="card kpi">
			<div class="k-label">Elevation</div>
			<div class="k-value">{Math.round(grandTotal.elev_m * 3.28084).toLocaleString()} ft</div>
		</div>
	</div>

	<div class="row two">
		<div class="card">
			<div class="card-head">
				<h2>By sport · {metric}</h2>
				{#if selectedSport}
					<button class="link" onclick={() => (selectedSport = null)}>clear filter</button>
				{/if}
			</div>
			<Donut
				data={sportTotals}
				selected={selectedSport ? friendlyLabel(selectedSport) : null}
				formatValue={(v) => `${metricFormat(v)} ${metricLabel()}`}
				totalLabel="across {sportTotals.length} sports"
				onSelect={(name) => {
					if (name === null) selectedSport = null;
					else {
						const found = sportTotals.find((s) => s.name === name);
						selectedSport = found?.rawSport ?? null;
					}
				}}
			/>
		</div>

		<div class="card">
			<h2>Sport over time · {metric} · per {bucket}</h2>
			<StackedBar
				buckets={bucketed.buckets}
				series={bucketed.series}
				formatValue={(v) => metricFormat(v)}
				yAxisLabel=" {metricLabel()}"
				labelEvery={bucketed.buckets.length > 14 ? 3 : bucketed.buckets.length > 7 ? 2 : 1}
			/>
		</div>
	</div>

	<div class="card">
		<h2>Weekly distance · last 26 weeks</h2>
		<LineArea
			points={weeklyDistance}
			formatValue={(v) => v.toFixed(1)}
			yAxisLabel=" mi"
			labelEvery={4}
		/>
	</div>

	{#if filtered.length !== data.activities.length}
		<p class="muted small">Showing {filtered.length} of {data.activities.length} activities for {friendlyLabel(selectedSport!)}.</p>
	{/if}
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		flex-wrap: wrap;
		gap: 12px;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--fg-soft);
	}
	.controls {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.seg {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.seg button {
		border: none;
		border-radius: 0;
		padding: 4px 10px;
		font-size: 12px;
		background: transparent;
	}
	.seg button:hover {
		background: var(--surface);
	}
	.seg button.active {
		background: var(--accent);
		color: var(--bg);
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
		margin-bottom: 16px;
	}
	.kpi .k-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--fg-muted);
		margin-bottom: 4px;
	}
	.kpi .k-value {
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.row.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-bottom: 16px;
	}
	.card {
		margin-bottom: 16px;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.empty {
		text-align: center;
		padding: 48px;
	}
	.link {
		background: none;
		border: none;
		color: var(--accent);
		font-size: 12px;
		padding: 0;
		cursor: pointer;
	}
	.link:hover {
		text-decoration: underline;
	}
	.small {
		font-size: 12px;
	}
	@media (max-width: 900px) {
		.row.two {
			grid-template-columns: 1fr;
		}
	}
</style>
