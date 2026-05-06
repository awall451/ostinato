<script lang="ts">
	import { downsampleSeries } from '$lib/shared/series';

	let {
		xs,
		ys,
		title,
		yLabel = '',
		xLabel = '',
		formatY = (v: number) => v.toFixed(0),
		formatX = (v: number) => v.toFixed(1),
		color = 'var(--accent)',
		height = 140,
		maxPoints = 600
	} = $props<{
		xs: number[];
		ys: number[];
		title: string;
		yLabel?: string;
		xLabel?: string;
		formatY?: (v: number) => string;
		formatX?: (v: number) => string;
		color?: string;
		height?: number;
		maxPoints?: number;
	}>();

	const PAD_L = 48;
	const PAD_R = 14;
	const PAD_T = 12;
	const PAD_B = 24;
	const INNER_W = 720;

	const layout = $derived.by(() => {
		const pts = downsampleSeries(xs, ys, maxPoints);
		if (pts.length === 0) {
			return { d: '', polyline: '', minY: 0, maxY: 0, minX: 0, maxX: 0, hasData: false };
		}
		let minY = pts[0].y;
		let maxY = pts[0].y;
		const minX = pts[0].x;
		const maxX = pts[pts.length - 1].x;
		for (const p of pts) {
			if (p.y < minY) minY = p.y;
			if (p.y > maxY) maxY = p.y;
		}
		// Pad y range so flat-line series stay visible.
		if (minY === maxY) {
			minY -= 1;
			maxY += 1;
		}
		const xRange = maxX - minX || 1;
		const yRange = maxY - minY || 1;
		const project = (p: { x: number; y: number }) => ({
			px: PAD_L + ((p.x - minX) / xRange) * INNER_W,
			py: PAD_T + height * (1 - (p.y - minY) / yRange)
		});
		const xy = pts.map(project);
		const d =
			`M ${xy[0].px} ${PAD_T + height} ` +
			xy.map(({ px, py }) => `L ${px} ${py}`).join(' ') +
			` L ${xy[xy.length - 1].px} ${PAD_T + height} Z`;
		const polyline = xy.map(({ px, py }) => `${px},${py}`).join(' ');
		return { d, polyline, minY, maxY, minX, maxX, hasData: true };
	});

	const svgW = PAD_L + INNER_W + PAD_R;
	const svgH = $derived(PAD_T + height + PAD_B);
</script>

<div class="chart">
	<div class="header">
		<span class="title">{title}</span>
		{#if layout.hasData}
			<span class="muted small">
				{formatY(layout.minY)} – {formatY(layout.maxY)}{yLabel}
			</span>
		{/if}
	</div>
	<svg viewBox="0 0 {svgW} {svgH}" style="width:100%;display:block">
		{#each [0, 0.5, 1] as frac}
			{@const ly = PAD_T + height * (1 - frac)}
			{@const yVal = layout.minY + (layout.maxY - layout.minY) * frac}
			<line x1={PAD_L} y1={ly} x2={PAD_L + INNER_W} y2={ly} class="grid" />
			{#if layout.hasData}
				<text x={PAD_L - 6} y={ly + 4} text-anchor="end" class="axis">
					{formatY(yVal)}{yLabel}
				</text>
			{/if}
		{/each}
		{#if layout.hasData}
			<path d={layout.d} fill={color} opacity="0.10" />
			<polyline
				points={layout.polyline}
				fill="none"
				stroke={color}
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<text x={PAD_L} y={svgH - 6} class="axis">{formatX(layout.minX)}{xLabel}</text>
			<text x={PAD_L + INNER_W} y={svgH - 6} text-anchor="end" class="axis">
				{formatX(layout.maxX)}{xLabel}
			</text>
		{/if}
	</svg>
</div>

<style>
	.chart {
		margin-bottom: 4px;
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 4px;
	}
	.title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--fg-soft);
	}
	.small {
		font-size: 11px;
	}
	.grid {
		stroke: var(--border);
		stroke-width: 0.5;
	}
	.axis {
		font-size: 10px;
		fill: var(--fg-muted);
	}
</style>
