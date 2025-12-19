<script lang="ts">
	import "../app.css";
	import Toast from "$lib/components/Toast.svelte";
	import { page } from "$app/stores";

	const navItems = [
		{
			href: "/today",
			label: "Today",
			icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
		},
		{
			href: "/history",
			label: "History",
			icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
		},
	];

	$: currentPath = $page.url.pathname;
</script>

<div class="app-layout">
	<header class="header">
		<div class="header-content">
			<a href="/today" class="logo">
				<span class="logo-text">OpLog</span>
			</a>

			<nav class="nav">
				{#each navItems as item}
					<a
						href={item.href}
						class="nav-link"
						class:active={currentPath.startsWith(item.href)}
					>
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main class="main">
		<slot />
	</main>

	<Toast />
</div>

<style>
	.app-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.header {
		position: sticky;
		top: 0;
		z-index: 100;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 0.5px solid var(--color-separator);
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.875rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
	}

	.logo-text {
		font-family: var(--font-family-heading);
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.025em;
	}

	.nav {
		display: flex;
		gap: 0.5rem;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1.125rem;
		font-family: var(--font-family-sans);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-decoration: none;
		border-radius: 100px;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.nav-link:hover {
		color: var(--color-text);
		background: var(--color-bg-tertiary);
	}

	.nav-link.active {
		color: white;
		background: var(--color-text);
	}

	.main {
		flex: 1;
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}

	@media (max-width: 640px) {
		.header-content {
			padding: 0.75rem 1rem;
		}

		.logo-text {
			font-size: 1.25rem;
		}

		.nav-link {
			padding: 0.5rem 0.75rem;
			font-size: 0.875rem;
		}

		.main {
			padding: 1rem 1rem 2rem;
		}
	}
</style>
