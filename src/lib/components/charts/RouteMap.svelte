<script lang="ts">
	import { onMount } from 'svelte';
	import { decodePolyline, bounds } from '$lib/shared/polyline';

	let {
		polyline,
		startLatLng = null,
		endLatLng = null,
		height = 360
	} = $props<{
		polyline: string | null;
		startLatLng?: [number, number] | null;
		endLatLng?: [number, number] | null;
		height?: number;
	}>();

	let container: HTMLDivElement | undefined = $state();

	onMount(async () => {
		if (!container || !polyline) return;
		const coords = decodePolyline(polyline);
		if (coords.length === 0) return;

		// Dynamic import — leaflet touches `window` at module init.
		const L = (await import('leaflet')).default;
		await import('leaflet/dist/leaflet.css');

		const map = L.map(container, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);

		L.polyline(coords, { color: '#5b9bd5', weight: 4, opacity: 0.9 }).addTo(map);

		if (startLatLng) {
			L.circleMarker(startLatLng, { radius: 6, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 })
				.bindTooltip('Start')
				.addTo(map);
		}
		if (endLatLng) {
			L.circleMarker(endLatLng, { radius: 6, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 })
				.bindTooltip('End')
				.addTo(map);
		}

		const bb = bounds(coords);
		if (bb) map.fitBounds(bb, { padding: [16, 16] });
	});
</script>

<div bind:this={container} class="map" style="height:{height}px" aria-label="Route map"></div>

<style>
	.map {
		width: 100%;
		border-radius: 6px;
		overflow: hidden;
		background: var(--surface);
	}
	/* Force tile container under our radius */
	.map :global(.leaflet-container) {
		background: var(--surface);
		font-family: inherit;
	}
</style>
