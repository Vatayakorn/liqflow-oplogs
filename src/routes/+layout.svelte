<script lang="ts">
	import "../app.css";
	import Toast from "$lib/components/Toast.svelte";
	import ReloadPrompt from "$lib/components/ReloadPrompt.svelte";
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
		{
			href: "/analytics",
			label: "Analytics",
			icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
		},
		{
			href: "/customers",
			label: "Customers",
			icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
		},
		{
			href: "/referral-tracker",
			label: "Referral",
			icon: "M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z",
		},
	];

	$: currentPath = $page.url.pathname;
</script>

<div class="app-layout">
	<header class="header">
		<div class="header-content">
			<a href="/today" class="logo">
				<span class="logo-text">OpLogs</span>
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

			<a
				href="/session/new"
				class="mobile-add-btn"
				aria-label="Add new session"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 4.5v15m7.5-7.5h-15"
					/>
				</svg>
			</a>
		</div>
	</header>

	<main class="main">
		<slot />
	</main>

	<Toast />
	<ReloadPrompt />

	<nav class="bottom-nav">
		<a
			href="/today"
			class="bottom-nav-item"
			class:active={currentPath === "/today"}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
				/>
			</svg>
			<span>Today</span>
		</a>

		<a
			href="/history"
			class="bottom-nav-item"
			class:active={currentPath.startsWith("/history")}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
				/>
			</svg>
			<span>History</span>
		</a>

		<a
			href="/analytics"
			class="bottom-nav-item"
			class:active={currentPath.startsWith("/analytics")}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605"
				/>
			</svg>
			<span>Analytics</span>
		</a>

		<a
			href="/customers"
			class="bottom-nav-item"
			class:active={currentPath.startsWith("/customers")}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
				/>
			</svg>
			<span>Customers</span>
		</a>
	</nav>
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

	/* Mobile Add Button */
	.mobile-add-btn {
		display: none;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
		background: rgba(0, 122, 255, 0.1);
		border-radius: 50%;
		width: 2.25rem;
		height: 2.25rem;
		text-decoration: none;
		transition: all 0.25s;
	}

	.mobile-add-btn:active {
		background: rgba(0, 122, 255, 0.2);
		transform: scale(0.95);
	}

	.mobile-add-btn svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	@media (max-width: 640px) {
		.header-content {
			padding: 0.75rem 1rem;
		}

		.header .nav {
			display: none;
		}

		.mobile-add-btn {
			display: flex;
		}

		.logo-text {
			font-size: 1.25rem;
		}

		.nav-link {
			padding: 0.5rem 0.75rem;
			font-size: 0.875rem;
		}

		.main {
			padding: 1rem 1rem 6rem; /* Add padding for bottom nav */
		}
	}

	/* Bottom Navigation */
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-top: 0.5px solid var(--color-separator);
		display: none; /* Hidden by default (desktop) */
		justify-content: space-around;
		align-items: center;
		padding: 0.5rem 0;
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 1000;
	}

	@media (max-width: 640px) {
		.bottom-nav {
			display: flex;
		}
	}

	.bottom-nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: var(--color-text-tertiary);
		font-size: 0.6875rem;
		font-weight: 500;
		gap: 0.25rem;
		flex: 1;
		padding: 0.5rem 0;
		-webkit-tap-highlight-color: transparent;
	}

	.bottom-nav-item svg {
		width: 1.5rem;
		height: 1.5rem;
		transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.bottom-nav-item.active {
		color: var(--color-primary);
	}

	.bottom-nav-item.active svg {
		color: var(--color-primary);
	}
</style>
