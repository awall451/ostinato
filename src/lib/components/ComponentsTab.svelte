<script lang="ts">
	import { enhance } from '$app/forms';
	import ComponentFields from './ComponentFields.svelte';
	import { componentKind, epochToDateInput, wearStatus } from '$lib/shared/components';
	import { fmtDistance, metersToMiles, type UnitSystem } from '$lib/shared/units';
	import type { ComponentRow } from '$lib/server/repos/components';

	let { installed, history, spares, error = null } = $props<{
		installed: ComponentRow[];
		history: ComponentRow[];
		spares: ComponentRow[];
		error?: string | null;
	}>();

	const units: UnitSystem = 'imperial';
	// Local calendar date (not UTC) so evening swaps default to today.
	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

	type Panel = { id: number | 'add'; mode: 'add' | 'swap' | 'remove' | 'edit' } | null;
	let panel = $state<Panel>(null);
	let confirmDelete = $state<number | null>(null);

	function toggle(id: number | 'add', mode: NonNullable<Panel>['mode']) {
		panel = panel && panel.id === id && panel.mode === mode ? null : { id, mode };
		confirmDelete = null;
	}
	function isOpen(id: number, mode: NonNullable<Panel>['mode']): boolean {
		return panel !== null && panel.id === id && panel.mode === mode;
	}

	// Close panels after a successful mutation; load() re-runs and refreshes the lists.
	const done = () =>
		async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			await update();
			if (result.type === 'success') {
				panel = null;
				confirmDelete = null;
			}
		};

	const dueCount = $derived(
		installed.filter((c: ComponentRow) => {
			const level = wearStatus(c.distance_m, c.wear_limit_m).level;
			return level === 'warn' || level === 'due';
		}).length
	);

	function title(c: ComponentRow): string {
		return [c.brand, c.model].filter(Boolean).join(' ') || '—';
	}
	function money(cents: number | null): string | null {
		return cents != null ? `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}` : null;
	}
	function costPerMile(c: ComponentRow): string | null {
		const mi = metersToMiles(c.distance_m);
		if (c.purchase_price_cents == null || mi < 1) return null;
		return `$${(c.purchase_price_cents / 100 / mi).toFixed(3)}/mi`;
	}
</script>

{#if error}
	<div class="card err">{error}</div>
{/if}

<div class="card">
	<div class="bar-head">
		<h2>
			Installed ({installed.length}){#if dueCount > 0}<span class="pill due-pill">{dueCount} due soon</span>{/if}
		</h2>
		<button onclick={() => toggle('add', 'add')}>{panel?.id === 'add' ? 'Cancel' : '+ Add part'}</button>
	</div>

	{#if panel?.id === 'add'}
		<form method="POST" action="?/add" use:enhance={done} class="panel add-panel">
			<ComponentFields />
			<div class="row-actions">
				<label class="inline">Installed <input name="installed_at" type="date" value={today} required /></label>
				<button type="submit" class="primary">Add</button>
			</div>
		</form>
		{#if spares.length > 0}
			<form method="POST" action="?/installSpare" use:enhance={done} class="panel add-panel">
				<div class="row-actions">
					<label class="inline grow">
						Or install a spare
						<select name="id" required>
							{#each spares as s (s.id)}
								<option value={s.id}>
									{componentKind(s.kind).label} · {title(s)} ({fmtDistance(s.distance_m, units)})
								</option>
							{/each}
						</select>
					</label>
					<label class="inline">On <input name="installed_at" type="date" value={today} required /></label>
					<button type="submit">Install</button>
				</div>
			</form>
		{/if}
	{/if}

	{#if installed.length === 0 && panel?.id !== 'add'}
		<p class="muted">
			No parts tracked yet. Add your chain, tires, cassette… backdate the install and past rides count
			toward it automatically.
		</p>
	{/if}

	<div class="parts">
		{#each installed as c (c.id)}
			{@const w = wearStatus(c.distance_m, c.wear_limit_m)}
			<div class="part">
				<div class="part-top">
					<div>
						<div class="kind">{componentKind(c.kind).label}</div>
						<div class="name">{title(c)}</div>
					</div>
					<div class="dist">{fmtDistance(c.distance_m, units)}</div>
				</div>
				{#if w.pct !== null}
					<div class="wear" title="{Math.round(w.pct * 100)}% of limit">
						<div class="wear-fill {w.level}" style="width: {Math.min(100, w.pct * 100)}%"></div>
					</div>
					<div class="sub muted">
						{Math.round(w.pct * 100)}% of {fmtDistance(c.wear_limit_m ?? 0, units)}
						{#if w.level === 'due'}<span class="lvl due">replace</span>{:else if w.level === 'warn'}<span
								class="lvl warn">soon</span
							>{/if}
					</div>
				{/if}
				<div class="sub muted">
					since {c.installed_at ? epochToDateInput(c.installed_at) : '—'}
					{#if money(c.purchase_price_cents)}· {money(c.purchase_price_cents)}{/if}
					{#if costPerMile(c)}· {costPerMile(c)}{/if}
					{#if c.count_trainer === 0}· no trainer{/if}
				</div>
				{#if c.notes}<div class="sub muted">{c.notes}</div>{/if}
				<div class="btns">
					<button onclick={() => toggle(c.id, 'swap')}>Swap</button>
					<button onclick={() => toggle(c.id, 'remove')}>Remove</button>
					<button onclick={() => toggle(c.id, 'edit')}>Edit</button>
				</div>

				{#if isOpen(c.id, 'swap')}
					<form method="POST" action="?/swap" use:enhance={done} class="panel">
						<p class="muted small">Old part is retired with its final mileage; new part starts at 0.</p>
						<input type="hidden" name="id" value={c.id} />
						<ComponentFields kind={c.kind} />
						<div class="row-actions">
							<label class="inline">Swapped on <input name="at" type="date" value={today} required /></label>
							<button type="submit" class="primary">Swap</button>
						</div>
					</form>
				{:else if isOpen(c.id, 'remove')}
					<form method="POST" action="?/remove" use:enhance={done} class="panel">
						<input type="hidden" name="id" value={c.id} />
						<div class="row-actions">
							<label class="inline">Removed on <input name="at" type="date" value={today} required /></label>
							<label class="inline"><input type="checkbox" name="keep_spare" /> Keep as spare</label>
							<button type="submit" class="primary">Remove</button>
						</div>
					</form>
				{:else if isOpen(c.id, 'edit')}
					{@render editForm(c)}
				{/if}
			</div>
		{/each}
	</div>
</div>

{#if history.length > 0}
	<div class="card">
		<h2>Past parts ({history.length})</h2>
		<div class="parts">
			{#each history as c (c.id)}
				<div class="part past">
					<div class="part-top">
						<div>
							<div class="kind">
								{componentKind(c.kind).label}
								{#if c.retired === 0}<span class="pill">spare</span>{/if}
							</div>
							<div class="name">{title(c)}</div>
						</div>
						<div class="dist">{fmtDistance(c.distance_m, units)}</div>
					</div>
					<div class="sub muted">
						{c.installed_at ? epochToDateInput(c.installed_at) : '—'} → {c.removed_at
							? epochToDateInput(c.removed_at)
							: '—'}
						{#if costPerMile(c)}· {costPerMile(c)}{/if}
					</div>
					<div class="btns">
						<button onclick={() => toggle(c.id, 'edit')}>Edit</button>
					</div>
					{#if isOpen(c.id, 'edit')}
						{@render editForm(c)}
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

{#snippet editForm(c: ComponentRow)}
	<form method="POST" action="?/update" use:enhance={done} class="panel">
		<input type="hidden" name="id" value={c.id} />
		<ComponentFields initial={c} />
		<div class="row-actions">
			<button type="submit" class="primary">Save</button>
			<span class="grow"></span>
			{#if confirmDelete === c.id}
				<button type="submit" formaction="?/delete" class="danger">Really delete</button>
				<button type="button" onclick={() => (confirmDelete = null)}>Keep</button>
			{:else}
				<button type="button" onclick={() => (confirmDelete = c.id)}>Delete…</button>
			{/if}
		</div>
	</form>
{/snippet}

<style>
	h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--fg-soft);
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.card {
		margin-bottom: 16px;
	}
	.card > h2 {
		margin-bottom: 12px;
	}
	.err {
		border-color: var(--danger);
		color: var(--danger);
	}
	.bar-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.parts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 10px;
	}
	.part {
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
	}
	.part.past {
		opacity: 0.85;
	}
	.part-top {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		align-items: flex-start;
	}
	.kind {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--fg-muted);
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.name {
		font-weight: 600;
	}
	.dist {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.wear {
		height: 6px;
		border-radius: 3px;
		background: var(--surface);
		overflow: hidden;
		margin: 10px 0 4px;
	}
	.wear-fill {
		height: 100%;
		border-radius: 3px;
	}
	.wear-fill.ok {
		background: var(--success);
	}
	.wear-fill.warn {
		background: var(--warning);
	}
	.wear-fill.due {
		background: var(--danger);
	}
	.lvl {
		font-weight: 600;
		margin-left: 4px;
	}
	.lvl.warn {
		color: var(--warning);
	}
	.lvl.due {
		color: var(--danger);
	}
	.due-pill {
		color: var(--warning);
		border-color: var(--warning);
	}
	.sub {
		font-size: 12px;
		margin-top: 2px;
	}
	.small {
		font-size: 12px;
		margin: 0 0 8px;
	}
	.btns {
		display: flex;
		gap: 6px;
		margin-top: 10px;
	}
	.btns button {
		padding: 4px 10px;
		font-size: 12px;
	}
	.add-panel {
		margin-bottom: 14px;
	}
	.panel {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px dashed var(--border);
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: end;
		margin-top: 10px;
	}
	.inline {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		color: var(--fg-muted);
	}
	.inline:has(input[type='checkbox']) {
		flex-direction: row;
		align-items: center;
		padding-bottom: 8px;
	}
	.grow {
		flex: 1;
	}
	.inline input,
	.inline select {
		font: inherit;
		font-size: 14px;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 7px 9px;
		max-width: 100%;
	}
	.primary {
		background: var(--accent);
		color: var(--bg);
		border-color: var(--accent);
		font-weight: 600;
	}
	.danger {
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
