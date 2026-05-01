<script lang="ts">
	import GearCard from '$lib/components/GearCard.svelte';
	import { fmtDistance, fmtDuration, fmtElevation } from '$lib/shared/units';
	import type { GearWithTotals } from './+page.server';
	import type { DeletedBikeTotals } from '$lib/server/repos/gear';

	let { data } = $props<{
		data: {
			bikes: GearWithTotals[];
			shoes: GearWithTotals[];
			deletedBikes: DeletedBikeTotals[];
			includeRetired: boolean;
		};
	}>();
</script>

<div class="head">
	<h1>Gear</h1>
	<a class="pill" href={data.includeRetired ? '/gear' : '/gear?retired=1'}>
		{data.includeRetired ? 'hide retired' : 'show retired'}
	</a>
</div>

{#if data.bikes.length === 0 && data.shoes.length === 0}
	<div class="card empty">
		<p class="muted">No gear yet. Connect Strava or load fixtures from <a href="/settings">Settings</a>.</p>
	</div>
{:else}
	{#if data.bikes.length > 0}
		<h2>Bikes</h2>
		<div class="grid">
			{#each data.bikes as bike (bike.id)}
				<GearCard gear={bike} />
			{/each}
		</div>
	{/if}

	{#if data.shoes.length > 0}
		<h2>Shoes</h2>
		<div class="grid">
			{#each data.shoes as shoe (shoe.id)}
				<GearCard gear={shoe} />
			{/each}
		</div>
	{/if}

	{#if data.deletedBikes.length > 0}
		<h2>Retired · no longer on Strava</h2>
		<p class="muted small">
			These bikes were deleted from your Strava profile, so name/brand/model can no longer be
			fetched. Stats are recovered from the original activity payloads.
		</p>
		<div class="grid">
			{#each data.deletedBikes as d (d.raw_gear_id)}
				<div class="card ghost-card">
					<div class="head">
						<div class="title">
							<span class="name mono">{d.raw_gear_id}</span>
							<span class="pill ret">deleted</span>
						</div>
					</div>
					<div class="big">{fmtDistance(d.distance_m, 'imperial')}</div>
					<div class="row">
						<span class="muted">{d.count} rides</span>
						<span>·</span>
						<span class="muted">{fmtDuration(d.moving_time_s)}</span>
						<span>·</span>
						<span class="muted">{fmtElevation(d.elev_m, 'imperial')}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 24px 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--fg-soft);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
	}
	.empty {
		text-align: center;
		padding: 48px;
	}
	.ghost-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		opacity: 0.7;
	}
	.ghost-card .head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ghost-card .title {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.ghost-card .name {
		font-size: 15px;
		font-weight: 600;
	}
	.ghost-card .mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 13px;
	}
	.ghost-card .pill.ret {
		background: var(--surface);
		color: var(--fg-muted);
	}
	.ghost-card .big {
		font-size: 24px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.ghost-card .row {
		display: flex;
		gap: 6px;
		font-size: 12px;
		color: var(--fg-soft);
	}
	.muted {
		color: var(--fg-muted);
	}
	.small {
		font-size: 12px;
	}
</style>
