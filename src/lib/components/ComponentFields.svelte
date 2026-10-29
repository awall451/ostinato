<script lang="ts">
	import { COMPONENT_KINDS, componentKind, epochToDateInput } from '$lib/shared/components';
	import { metersToMiles } from '$lib/shared/units';
	import { untrack } from 'svelte';
	import type { Component } from '$lib/server/db/schema';

	// Shared inputs for add / swap / edit. Field names match parseComponentFields.
	// Props only seed the inputs (the form is remounted per open), hence untrack.
	let props = $props<{
		initial?: Component | null;
		kind?: string;
	}>();

	const start: Component | null = untrack(() => props.initial ?? null);
	const initialKind: string = untrack(() => props.kind ?? 'chain');
	let kind = $state<string>(start?.kind ?? initialKind);
	let wearMi = $state<string>(
		start
			? start.wear_limit_m
				? String(Math.round(metersToMiles(start.wear_limit_m)))
				: ''
			: String(componentKind(initialKind).defaultWearMi ?? '')
	);
	let countTrainer = $state<boolean>(
		start ? start.count_trainer === 1 : componentKind(initialKind).defaultCountTrainer
	);

	// New parts: changing kind re-applies that kind's defaults. Edits keep saved values.
	function onKind() {
		if (start) return;
		const k = componentKind(kind);
		wearMi = String(k.defaultWearMi ?? '');
		countTrainer = k.defaultCountTrainer;
	}
</script>

<div class="grid">
	<label>
		<span>Type</span>
		<select name="kind" bind:value={kind} onchange={onKind}>
			{#each COMPONENT_KINDS as k (k.value)}
				<option value={k.value}>{k.label}</option>
			{/each}
		</select>
	</label>
	<label>
		<span>Brand</span>
		<input name="brand" value={start?.brand ?? ''} placeholder="Shimano" />
	</label>
	<label>
		<span>Model</span>
		<input name="model" value={start?.model ?? ''} placeholder="CN-M8100" />
	</label>
	<label>
		<span>Replace at (mi)</span>
		<input name="wear_limit_mi" type="number" min="0" step="1" bind:value={wearMi} placeholder="none" />
	</label>
	<label>
		<span>Price ($)</span>
		<input
			name="price"
			inputmode="decimal"
			value={start?.purchase_price_cents != null ? (start.purchase_price_cents / 100).toFixed(2) : ''}
		/>
	</label>
	<label>
		<span>Purchased</span>
		<input name="purchased_at" type="date" value={start?.purchased_at ? epochToDateInput(start.purchased_at) : ''} />
	</label>
	<label>
		<span>Miles already on it</span>
		<input
			name="starting_mi"
			type="number"
			min="0"
			step="any"
			value={start?.starting_distance_m ? Math.round(metersToMiles(start.starting_distance_m)) : ''}
			placeholder="0"
		/>
	</label>
	<label class="check">
		<input name="count_trainer" type="checkbox" bind:checked={countTrainer} />
		<span>Count trainer / Zwift miles</span>
	</label>
	<label class="wide">
		<span>Notes</span>
		<input name="notes" value={start?.notes ?? ''} />
	</label>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 10px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		color: var(--fg-muted);
	}
	label.check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
		align-self: end;
		padding-bottom: 8px;
	}
	label.wide {
		grid-column: 1 / -1;
	}
	input,
	select {
		font: inherit;
		font-size: 14px;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 7px 9px;
		min-width: 0;
	}
	input[type='checkbox'] {
		width: 16px;
		height: 16px;
	}
</style>
