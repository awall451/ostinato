<script lang="ts">
	import GearCard from '$lib/components/GearCard.svelte';
	import type { GearWithTotals } from './+page.server';

	let { data } = $props<{ data: { bikes: GearWithTotals[]; shoes: GearWithTotals[]; includeRetired: boolean } }>();
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
</style>
