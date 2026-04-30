<script lang="ts">
	import { pc } from './palette';
	import { computeBarLayout } from './bar-layout';

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
		labelEvery = 2
	} = $props<{
		buckets: BucketRow[];
		series: string[];
		formatValue?: (v: number) => string;
		yAxisLabel?: string;
		labelEvery?: number;
	}>();

	const VIEW_W = 800;
	const VIEW_H = 300;
	const PAD_L = 44;
	const PAD_R = 12;
	const PAD_T = 12;
	const PAD_B = 32;
	const INNER_W = VIEW_W - PAD_L - PAD_R;
	const PLOT_H = VIEW_H - PAD_T - PAD_B;

	const layout = $derived.by(() => {
		const { barStep, barWidth } = computeBarLayout(buckets.length, INNER_W);
		const sidx = Object.fromEntries(series.map((s: string, i: number) => [s, i]));
		const rows = buckets.map((b: BucketRow) => {
			let total = 0;
			for (const s of series) total += b.perSeries.get(s) ?? 0;
			return { ...b, total };
		});
		const maxV = Math.max(...rows.map((r: { total: number }) => r.total), 1);
		const bars = rows.map(
			(
				b: { key: string; label: string; perSeries: Map<string, number>; total: number },
				di: number
			) => {
				const x = PAD_L + di * barStep + (barStep - barWidth) / 2;
				let cumulative = 0;
				const segs = series
					.filter((s: string) => (b.perSeries.get(s) ?? 0) > 0)
					.map((s: string) => {
						const v = b.perSeries.get(s) ?? 0;
						const segH = Math.max((PLOT_H * v) / maxV, 1);
						const y = PAD_T + PLOT_H * (1 - (cumulative + v) / maxV);
						cumulative += v;
						return { name: s, value: v, y, h: segH, color: pc(sidx[s]) };
					});
				return { ...b, x, segs };
			}
		);
		return { bars, maxV, sidx, barStep, barWidth };
	});
</script>

<svg viewBox="0 0 {VIEW_W} {VIEW_H}" style="width:100%;height:auto;display:block">
	{#each [0, 0.5, 1] as frac}
		{@const gy = PAD_T + PLOT_H * (1 - frac)}
		<line x1={PAD_L} y1={gy} x2={VIEW_W - PAD_R} y2={gy} class="grid" />
		<text x={PAD_L - 6} y={gy + 4} text-anchor="end" class="axis">
			{formatValue(layout.maxV * frac)}{yAxisLabel}
		</text>
	{/each}
	{#each layout.bars as bar, di}
		{#if bar.segs.length === 0}
			<rect x={bar.x} y={PAD_T + PLOT_H - 2} width={layout.barWidth} height={2} fill="var(--surface)" rx="1" />
		{:else}
			{#each bar.segs as seg}
				<rect
					x={bar.x}
					y={seg.y}
					width={layout.barWidth}
					height={seg.h}
					fill={seg.color}
					rx="1"
				>
					<title>{bar.label} · {seg.name}: {formatValue(seg.value)}</title>
				</rect>
			{/each}
		{/if}
		{#if di % labelEvery === 0 || di === layout.bars.length - 1}
			<text x={bar.x + layout.barWidth / 2} y={PAD_T + PLOT_H + 18} text-anchor="middle" class="axis">
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
