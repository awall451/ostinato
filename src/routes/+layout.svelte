<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children, data } = $props<{ children: any; data: { connected: boolean; lastSyncedAt: number | null } }>();

	const navItems = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/gear', label: 'Gear' },
		{ href: '/settings', label: 'Settings' }
	];

	const lastSyncedRel = $derived.by(() => {
		if (!data?.lastSyncedAt) return null;
		const secs = Math.floor(Date.now() / 1000) - data.lastSyncedAt;
		if (secs < 60) return `${secs}s ago`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
		if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
		return `${Math.floor(secs / 86400)}d ago`;
	});
</script>

<header>
	<div class="brand">
		<span class="logo">~</span>
		<span class="name">ostinato</span>
	</div>
	<nav>
		{#each navItems as item}
			<a href={item.href} class:active={page.url.pathname === item.href}>{item.label}</a>
		{/each}
	</nav>
	<div class="status">
		{#if data?.connected}
			<span class="pill" title="Last sync">{lastSyncedRel ?? 'never synced'}</span>
		{:else}
			<a href="/settings" class="pill">not connected</a>
		{/if}
	</div>
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 12px 24px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-soft);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
	}
	.logo {
		font-family: monospace;
		color: var(--accent);
		font-size: 18px;
	}
	nav {
		display: flex;
		gap: 4px;
		flex: 1;
	}
	nav a {
		padding: 6px 12px;
		border-radius: 6px;
		color: var(--fg-soft);
	}
	nav a:hover {
		background: var(--surface);
		text-decoration: none;
	}
	nav a.active {
		background: var(--surface);
		color: var(--fg);
	}
	main {
		padding: 24px;
		max-width: 1400px;
		margin: 0 auto;
	}
</style>
