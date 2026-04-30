<script lang="ts">
	import { pc } from './palette';

	type Slice = { name: string; value: number; color?: string };

	let {
		data,
		selected = null,
		formatValue = (v: number) => v.toFixed(1),
		formatTotal,
		totalLabel = 'total',
		size = 200,
		onSelect = (_name: string | null) => {}
	} = $props<{
		data: Slice[];
		selected?: string | null;
		formatValue?: (v: number) => string;
		formatTotal?: (v: number) => string;
		totalLabel?: string;
		size?: number;
		onSelect?: (name: string | null) => void;
	}>();

	const segs = $derived.by(() => {
		const total = data.reduce((s: number, d: Slice) => s + d.value, 0);
		if (total === 0) return { segs: [] as Array<{ path: string; color: string; name: string; value: number; pct: number }>, total: 0 };
		const cx = 100,
			cy = 100,
			r = 72,
			ri = 48;
		const nonZero = data.filter((d: Slice) => d.value > 0);
		if (nonZero.length === 1) {
			const d = nonZero[0];
			const i = data.indexOf(d);
			const path = [
				`M ${cx - r} ${cy}`,
				`A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
				`A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
				`M ${cx - ri} ${cy}`,
				`A ${ri} ${ri} 0 1 0 ${cx + ri} ${cy}`,
				`A ${ri} ${ri} 0 1 0 ${cx - ri} ${cy}`,
				'Z'
			].join(' ');
			return {
				segs: [{ path, color: d.color ?? pc(i), name: d.name, value: d.value, pct: 100 }],
				total
			};
		}
		let angle = -Math.PI / 2;
		const list = data.map((d: Slice, i: number) => {
			const frac = d.value / total;
			const sweep = frac * 2 * Math.PI;
			const a1 = angle,
				a2 = angle + sweep;
			const large = sweep > Math.PI ? 1 : 0;
			const path = [
				`M ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`,
				`A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}`,
				`L ${cx + ri * Math.cos(a2)} ${cy + ri * Math.sin(a2)}`,
				`A ${ri} ${ri} 0 ${large} 0 ${cx + ri * Math.cos(a1)} ${cy + ri * Math.sin(a1)}`,
				'Z'
			].join(' ');
			angle = a2;
			return { path, color: d.color ?? pc(i), name: d.name, value: d.value, pct: Math.round(frac * 100) };
		});
		return { segs: list, total };
	});

	function toggle(name: string) {
		onSelect(selected === name ? null : name);
	}
</script>

<div class="wrap">
	{#if segs.segs.length === 0}
		<p class="empty">No data</p>
	{:else}
		<svg viewBox="0 0 200 200" width={size} height={size} class="donut" role="img" aria-label="Distribution">
			{#each segs.segs as seg}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<path
					d={seg.path}
					fill={seg.color}
					class="seg"
					class:dim={selected && selected !== seg.name}
					class:active={selected === seg.name}
					onclick={() => toggle(seg.name)}
				/>
			{/each}
			<text x="100" y="98" text-anchor="middle" class="big">
				{formatTotal ? formatTotal(segs.total) : formatValue(segs.total)}
			</text>
			<text x="100" y="116" text-anchor="middle" class="small">{totalLabel}</text>
		</svg>
		<ul class="legend">
			{#each segs.segs as seg}
				<li class="row" class:active={selected === seg.name}>
					<button class="row-btn" onclick={() => toggle(seg.name)}>
						<span class="dot" style="background:{seg.color}"></span>
						<span class="name">{seg.name}</span>
						<span class="val">{formatValue(seg.value)}</span>
						<span class="pct">{seg.pct}%</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.wrap {
		display: flex;
		align-items: flex-start;
		gap: 24px;
		flex-wrap: wrap;
	}
	.donut {
		flex-shrink: 0;
	}
	.seg {
		cursor: pointer;
		transition:
			opacity 0.15s,
			stroke-width 0.15s;
		opacity: 0.92;
		stroke: var(--bg-soft);
		stroke-width: 0;
	}
	.seg:hover {
		opacity: 1;
	}
	.seg.dim {
		opacity: 0.25;
	}
	.seg.active {
		opacity: 1;
		stroke: var(--fg);
		stroke-width: 2;
	}
	.big {
		font-size: 26px;
		font-weight: 700;
		fill: var(--fg);
	}
	.small {
		font-size: 11px;
		fill: var(--fg-muted);
	}
	.legend {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 4px 0 0;
		margin: 0;
		flex: 1;
		min-width: 200px;
	}
	.row {
		border-radius: 5px;
	}
	.row.active {
		outline: 1px solid var(--accent);
	}
	.row-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px;
		width: 100%;
		background: transparent;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		color: inherit;
		text-align: left;
		transition: background 0.12s;
	}
	.row-btn:hover {
		background: var(--surface);
	}
	.row.active .row-btn {
		background: var(--surface);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.name {
		flex: 1;
		font-size: 13px;
		color: var(--fg-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.val {
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--fg);
	}
	.pct {
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--fg-muted);
		width: 36px;
		text-align: right;
	}
	.empty {
		color: var(--fg-muted);
		font-size: 13px;
	}
</style>
