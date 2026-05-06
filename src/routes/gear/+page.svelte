<script lang="ts">
	import BikeRow from '$lib/components/BikeRow.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import { colorByGearId } from '$lib/components/charts/gear-color';
	import { sortBikes, type SortMetric } from '$lib/shared/gear-sort';
	import { fmtDistance, fmtDuration, fmtElevation, metersToMiles } from '$lib/shared/units';
	import type { GearWithTotals } from './+page.server';
	import type { DeletedBikeTotals } from '$lib/server/repos/gear';

	let { data } = $props<{
		data: {
			allBikes: GearWithTotals[];
			shoes: GearWithTotals[];
			deletedBikes: DeletedBikeTotals[];
			includeRetired: boolean;
		};
	}>();

	let metric = $state<SortMetric>('distance');

	const colorMap = $derived.by(() => {
		const ids = data.allBikes.map((b: GearWithTotals) => b.id).slice().sort();
		return colorByGearId(ids);
	});

	const visibleBikes = $derived(
		data.includeRetired
			? data.allBikes
			: data.allBikes.filter((b: GearWithTotals) => !b.retired)
	);

	const sortedBikes = $derived(sortBikes<GearWithTotals>(visibleBikes, metric));
	const sortedShoes = $derived(sortBikes<GearWithTotals>(data.shoes, metric));

	const donutData = $derived(
		sortedBikes
			.filter(
				(b: GearWithTotals) =>
					b.totals && (metric === 'count' ? b.totals.count > 0 : b.totals.distance_m > 0)
			)
			.map((b: GearWithTotals) => ({
				name: b.name,
				value: metric === 'count' ? b.totals!.count : metersToMiles(b.totals!.distance_m),
				color: colorMap[b.id]
			}))
	);

	function headlineFor(b: GearWithTotals): { value: string; label: string } {
		if (!b.totals) return { value: '—', label: '' };
		if (metric === 'count') {
			return { value: String(b.totals.count), label: b.kind === 'shoe' ? 'runs' : 'rides' };
		}
		return { value: Math.round(metersToMiles(b.totals.distance_m)).toLocaleString(), label: 'mi' };
	}

	function fmtTotal(v: number): string {
		if (metric === 'count') return Math.round(v).toLocaleString();
		return `${Math.round(v).toLocaleString()} mi`;
	}

	function fmtSlice(v: number): string {
		return fmtTotal(v);
	}
</script>

<div class="head">
	<h1>Gear</h1>
	<div class="controls">
		<div class="seg" role="tablist" aria-label="Sort metric">
			<button
				role="tab"
				aria-selected={metric === 'distance'}
				class:active={metric === 'distance'}
				onclick={() => (metric = 'distance')}>distance</button
			>
			<button
				role="tab"
				aria-selected={metric === 'count'}
				class:active={metric === 'count'}
				onclick={() => (metric = 'count')}>rides</button
			>
		</div>
		<a class="pill toggle" href={data.includeRetired ? '/gear' : '/gear?retired=1'}>
			{data.includeRetired ? 'hide retired' : 'show retired'}
		</a>
	</div>
</div>

{#if data.allBikes.length === 0 && data.shoes.length === 0}
	<div class="card empty">
		<p class="muted">
			No gear yet. Connect Strava or load fixtures from <a href="/settings">Settings</a>.
		</p>
	</div>
{:else}
	<div class="gear-grid">
		<aside class="donut-col">
			{#if donutData.length > 0}
				<div class="card donut-card">
					<h2>By {metric === 'count' ? 'rides' : 'distance'}</h2>
					<Donut
						data={donutData}
						size={260}
						formatValue={fmtSlice}
						formatTotal={fmtTotal}
						totalLabel={metric === 'count' ? 'rides' : 'miles'}
					/>
				</div>
			{:else}
				<div class="card donut-card empty">
					<p class="muted">No bike data yet.</p>
				</div>
			{/if}
		</aside>
		<section class="rows-col">
			{#if sortedBikes.length > 0}
				<h2>Bikes</h2>
				<div class="rows">
					{#each sortedBikes as bike (bike.id)}
						{@const h = headlineFor(bike)}
						<BikeRow
							gear={bike}
							color={colorMap[bike.id]}
							headline={h.value}
							headlineLabel={h.label}
						/>
					{/each}
				</div>
			{/if}

			{#if sortedShoes.length > 0}
				<h2>Shoes</h2>
				<div class="rows">
					{#each sortedShoes as shoe (shoe.id)}
						{@const h = headlineFor(shoe)}
						<BikeRow gear={shoe} headline={h.value} headlineLabel={h.label} />
					{/each}
				</div>
			{/if}

			{#if data.deletedBikes.length > 0}
				<h2>Retired · no longer on Strava</h2>
				<p class="muted small">
					These bikes were deleted from your Strava profile, so name/brand/model can no longer be
					fetched. Stats are recovered from the original activity payloads.
				</p>
				<div class="rows">
					{#each data.deletedBikes as d (d.raw_gear_id)}
						<div class="card ghost-row">
							<div class="ghost-head">
								<span class="name mono">{d.raw_gear_id}</span>
								<span class="pill ret">deleted</span>
							</div>
							<div class="ghost-stats">
								<span class="big">{fmtDistance(d.distance_m, 'imperial')}</span>
								<span class="muted small">
									{d.count} rides · {fmtDuration(d.moving_time_s)} · {fmtElevation(
										d.elev_m,
										'imperial'
									)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		gap: 12px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 24px 0 12px;
		font-size: 12px;
		font-weight: 600;
		color: var(--fg-soft);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	h2:first-child {
		margin-top: 0;
	}
	.controls {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.seg {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 999px;
		overflow: hidden;
		background: var(--bg-soft);
	}
	.seg button {
		background: transparent;
		border: none;
		border-radius: 0;
		padding: 4px 12px;
		font-size: 12px;
		color: var(--fg-soft);
	}
	.seg button.active {
		background: var(--accent);
		color: var(--bg);
	}
	.seg button:hover:not(.active) {
		background: var(--bg-elev);
	}
	.toggle {
		cursor: pointer;
	}
	.gear-grid {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 16px;
		align-items: start;
	}
	.donut-col {
		position: sticky;
		top: 16px;
	}
	.donut-card h2 {
		margin: 0 0 12px;
	}
	.rows-col {
		min-width: 0;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.empty {
		text-align: center;
		padding: 48px;
	}
	.donut-card.empty {
		padding: 32px;
	}
	.ghost-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px;
		opacity: 0.7;
	}
	.ghost-head {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.ghost-stats {
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}
	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 13px;
	}
	.name {
		font-weight: 600;
	}
	.pill.ret {
		background: var(--surface);
		color: var(--fg-muted);
	}
	.big {
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.muted {
		color: var(--fg-muted);
	}
	.small {
		font-size: 12px;
	}
	@media (max-width: 768px) {
		.gear-grid {
			grid-template-columns: 1fr;
		}
		.donut-col {
			position: static;
		}
	}
</style>
