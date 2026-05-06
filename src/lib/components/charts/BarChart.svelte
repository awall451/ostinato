<script lang="ts">
	import { computeBarLayout } from './bar-layout';

	let {
		data,
		color = 'var(--accent)',
		formatValue = (v: number) => v.toFixed(0),
		yAxisLabel = '',
		labelEvery = 1,
		height = 200
	} = $props<{
		data: { label: string; value: number }[];
		color?: string;
		formatValue?: (v: number) => string;
		yAxisLabel?: string;
		labelEvery?: number;
		height?: number;
	}>();

	const VIEW_W = 800;
	const VIEW_H = $derived(height);
	const PAD_L = 44;
	const PAD_R = 12;
	const PAD_T = 12;
	const PAD_B = 28;
	const INNER_W = VIEW_W - PAD_L - PAD_R;
	const PLOT_H = $derived(VIEW_H - PAD_T - PAD_B);

	const layout = $derived.by(() => {
		const { barStep, barWidth } = computeBarLayout(data.length, INNER_W);
		const maxV = Math.max(...data.map((d: { value: number }) => d.value), 1);
		const bars = data.map((d: { label: string; value: number }, i: number) => {
			const x = PAD_L + i * barStep + (barStep - barWidth) / 2;
			const h = d.value > 0 ? Math.max((PLOT_H * d.value) / maxV, 2) : 0;
			const y = PAD_T + PLOT_H - h;
			return { ...d, x, y, h };
		});
		const ticks = [0, 0.5, 1].map((f) => ({
			y: PAD_T + PLOT_H * (1 - f),
			v: maxV * f
		}));
		return { bars, barStep, barWidth, ticks, maxV };
	});
</script>

<svg
	viewBox="0 0 {VIEW_W} {VIEW_H}"
	preserveAspectRatio="none"
	class="chart"
	role="img"
	aria-label="Bar chart"
>
	{#each layout.ticks as t}
		<line
			x1={PAD_L}
			x2={VIEW_W - PAD_R}
			y1={t.y}
			y2={t.y}
			class="grid"
			stroke="currentColor"
			stroke-opacity="0.12"
			stroke-width="1"
		/>
		<text x={PAD_L - 6} y={t.y + 3} text-anchor="end" class="tick"
			>{formatValue(t.v)}{yAxisLabel}</text
		>
	{/each}
	{#each layout.bars as b, i}
		<rect x={b.x} y={b.y} width={layout.barWidth} height={b.h} fill={color} class="bar">
			<title>{b.label}: {formatValue(b.value)}{yAxisLabel}</title>
		</rect>
		{#if i % labelEvery === 0}
			<text
				x={b.x + layout.barWidth / 2}
				y={VIEW_H - 8}
				text-anchor="middle"
				class="xlabel">{b.label}</text
			>
		{/if}
	{/each}
</svg>

<style>
	.chart {
		width: 100%;
		height: auto;
		display: block;
	}
	.tick,
	.xlabel {
		font-size: 11px;
		fill: var(--fg-muted);
		font-variant-numeric: tabular-nums;
	}
	.bar {
		opacity: 0.92;
		transition: opacity 0.12s;
	}
	.bar:hover {
		opacity: 1;
	}
</style>
