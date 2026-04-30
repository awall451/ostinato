<script lang="ts">
	import { pc } from './palette';

	type BucketRow = {
		key: string;
		label: string;
		perSeries: Map<string, number>;
	};

	let {
		buckets,
		series,
		formatValue = (v: number) => v.toFixed(0),
		yAxisLabel = '',
		barWidth = 28,
		barStep = 34,
		height = 220,
		labelEvery = 2
	} = $props<{
		buckets: BucketRow[];
		series: string[];
		formatValue?: (v: number) => string;
		yAxisLabel?: string;
		barWidth?: number;
		barStep?: number;
		height?: number;
		labelEvery?: number;
	}>();

	const PAD_L = 44;
	const PAD_R = 12;
	const PAD_T = 12;
	const PAD_B = 32;

	const layout = $derived.by(() => {
		const sidx = Object.fromEntries(series.map((s: string, i: number) => [s, i]));
		const rows = buckets.map((b: BucketRow) => {
			let total = 0;
			for (const s of series) total += b.perSeries.get(s) ?? 0;
			return { ...b, total };
		});
		const maxV = Math.max(...rows.map((r: { total: number }) => r.total), 1);
		const bars = rows.map((b: { key: string; label: string; perSeries: Map<string, number>; total: number }, di: number) => {
			const x = PAD_L + di * barStep;
			let cumulative = 0;
			const segs = series
				.filter((s: string) => (b.perSeries.get(s) ?? 0) > 0)
				.map((s: string) => {
					const v = b.perSeries.get(s) ?? 0;
					const segH = Math.max((height * v) / maxV, 1);
					const y = PAD_T + height * (1 - (cumulative + v) / maxV);
					cumulative += v;
					return { name: s, value: v, y, h: segH, color: pc(sidx[s]) };
				});
			return { ...b, x, segs };
		});
		const svgW = PAD_L + Math.max(buckets.length, 1) * barStep + PAD_R;
		const svgH = PAD_T + height + PAD_B;
		return { bars, maxV, sidx, svgW, svgH };
	});
</script>

<svg viewBox="0 0 {layout.svgW} {layout.svgH}" style="width:100%;display:block">
	{#each [0, 0.5, 1] as frac}
		{@const gy = PAD_T + height * (1 - frac)}
		<line x1={PAD_L} y1={gy} x2={layout.svgW - PAD_R} y2={gy} class="grid" />
		<text x={PAD_L - 6} y={gy + 4} text-anchor="end" class="axis">
			{formatValue(layout.maxV * frac)}{yAxisLabel}
		</text>
	{/each}
	{#each layout.bars as bar, di}
		{#if bar.segs.length === 0}
			<rect x={bar.x} y={PAD_T + height - 2} width={barWidth} height={2} fill="var(--surface)" rx="1" />
		{:else}
			{#each bar.segs as seg}
				<rect
					x={bar.x}
					y={seg.y}
					width={barWidth}
					height={seg.h}
					fill={seg.color}
					rx="1"
				>
					<title>{bar.label} · {seg.name}: {formatValue(seg.value)}</title>
				</rect>
			{/each}
		{/if}
		{#if di % labelEvery === 0 || di === layout.bars.length - 1}
			<text x={bar.x + barWidth / 2} y={PAD_T + height + 18} text-anchor="middle" class="axis">
				{bar.label}
			</text>
		{/if}
	{/each}
</svg>

{#if series.length > 0}
	<div class="legend">
		{#each series as s, i}
			<span class="item"><span class="dot" style="background:{pc(i)}"></span>{s}</span>
		{/each}
	</div>
{/if}

<style>
	.grid {
		stroke: var(--border);
		stroke-width: 0.5;
	}
	.axis {
		font-size: 10px;
		fill: var(--fg-muted);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 12px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--fg-soft);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
</style>
