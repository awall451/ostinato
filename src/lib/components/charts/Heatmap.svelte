<script lang="ts">
	/**
	 * v2 placeholder.
	 *
	 * v2 plan: Leaflet or MapLibre with OSM tiles, render
	 * `summary_polyline` for each activity (decoded via @mapbox/polyline)
	 * as a Polyline overlay. Filterable by gear_id and sport_type.
	 */
	let { caption = 'Heatmap — coming in v2' } = $props<{ caption?: string }>();
</script>

<div class="stub">
	<svg viewBox="0 0 200 120" width="200" height="120" aria-hidden="true">
		<rect x="0" y="0" width="200" height="120" fill="var(--surface)" rx="6" />
		<path d="M 20 90 Q 60 30 100 70 T 180 50" stroke="var(--accent)" stroke-width="3" fill="none" stroke-linecap="round" />
		<path d="M 30 70 Q 70 100 110 50 T 170 80" stroke="var(--accent-2)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6" />
		<circle cx="20" cy="90" r="4" fill="var(--accent)" />
		<circle cx="180" cy="50" r="4" fill="var(--accent)" />
	</svg>
	<p class="muted">{caption}</p>
</div>

<style>
	.stub {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px;
	}
	.muted {
		color: var(--fg-muted);
		font-size: 12px;
		margin: 0;
	}
</style>
