<script lang="ts">
	type Point = { label: string; value: number };

	let {
		points,
		goal = null,
		formatValue = (v: number) => v.toFixed(1),
		yAxisLabel = '',
		height = 160,
		width = 720,
		labelEvery = 4
	} = $props<{
		points: Point[];
		goal?: number | null;
		formatValue?: (v: number) => string;
		yAxisLabel?: string;
		height?: number;
		width?: number;
		labelEvery?: number;
	}>();

	const PAD_L = 44;
	const PAD_R = 14;
	const PAD_T = 12;
	const PAD_B = 30;

	const layout = $derived.by(() => {
		const n = points.length;
		const max = Math.max(...points.map((p: Point) => p.value), goal ?? 0, 1);
		const xStep = n > 1 ? width / (n - 1) : 0;
		const pts = points.map((p: Point, i: number) => ({
			...p,
			x: PAD_L + i * xStep,
			y: PAD_T + height * (1 - p.value / max)
		}));
		const goalY = goal != null ? PAD_T + height * (1 - goal / max) : null;
		const polyline = pts.map((p: Point & { x: number; y: number }) => `${p.x},${p.y}`).join(' ');
		const areaD =
			pts.length > 0
				? `M ${pts[0].x} ${PAD_T + height} ${pts.map((p: Point & { x: number; y: number }) => `L ${p.x} ${p.y}`).join(' ')} L ${pts[pts.length - 1].x} ${PAD_T + height} Z`
				: '';
		const labels = pts.filter((_: unknown, i: number) => i % labelEvery === 0 || i === n - 1);
		return { pts, polyline, areaD, goalY, max, labels, svgW: PAD_L + width + PAD_R, svgH: PAD_T + height + PAD_B };
	});
</script>

<svg viewBox="0 0 {layout.svgW} {layout.svgH}" style="width:100%;display:block">
	{#each [0, 0.5, 1] as frac}
		{@const ly = PAD_T + height * (1 - frac)}
		<line x1={PAD_L} y1={ly} x2={PAD_L + width} y2={ly} class="grid" />
		<text x={PAD_L - 6} y={ly + 4} text-anchor="end" class="axis">
			{formatValue(layout.max * frac)}{yAxisLabel}
		</text>
	{/each}
	{#if layout.goalY != null}
		<line
			x1={PAD_L}
			y1={layout.goalY}
			x2={PAD_L + width}
			y2={layout.goalY}
			stroke="var(--warning)"
			stroke-width="1.5"
			stroke-dasharray="5 3"
			opacity="0.7"
		/>
	{/if}
	{#if layout.pts.length > 0}
		<path d={layout.areaD} fill="var(--accent)" opacity="0.10" />
		<polyline
			points={layout.polyline}
			fill="none"
			stroke="var(--accent)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		{#each layout.pts as pt}
			<g>
				<circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
				<circle cx={pt.x} cy={pt.y} r="3" fill="var(--accent)" class="dot" />
				<title>{pt.label} — {formatValue(pt.value)}</title>
			</g>
		{/each}
	{/if}
	{#each layout.labels as lbl}
		<text x={lbl.x} y={PAD_T + height + 18} text-anchor="middle" class="axis">{lbl.label}</text>
	{/each}
</svg>

<style>
	.grid {
		stroke: var(--border);
		stroke-width: 0.5;
	}
	.axis {
		font-size: 10px;
		fill: var(--fg-muted);
	}
	.dot {
		opacity: 0.4;
		transition: opacity 0.1s;
	}
	g:hover .dot {
		opacity: 1;
	}
</style>
