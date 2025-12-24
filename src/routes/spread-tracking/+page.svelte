<script lang="ts">
    import ReferrerManager from "$lib/components/ReferrerManager.svelte";
    import PayoutSummary from "$lib/components/PayoutSummary.svelte";

    let activeTab: "referrers" | "records" | "payout" = "payout";
</script>

<svelte:head>
    <title>Spread Tracking | Liqflow OPLogs</title>
</svelte:head>

<div class="spread-tracking-page">
    <header class="page-header">
        <h1>💰 Spread Tracking</h1>
        <p class="subtitle">Track real spreads and manage referrer payouts</p>
    </header>

    <nav class="tabs">
        <button
            class="tab"
            class:active={activeTab === "payout"}
            on:click={() => (activeTab = "payout")}
        >
            💵 Payout Summary
        </button>
        <button
            class="tab"
            class:active={activeTab === "referrers"}
            on:click={() => (activeTab = "referrers")}
        >
            📋 Referrer Config
        </button>
    </nav>

    <main class="content">
        {#if activeTab === "payout"}
            <PayoutSummary />
        {:else if activeTab === "referrers"}
            <ReferrerManager />
        {/if}
    </main>
</div>

<style>
    .spread-tracking-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
    }

    .page-header {
        margin-bottom: 1.5rem;
    }

    .page-header h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        font-family: var(--font-family-heading);
        color: var(--color-text);
    }

    .subtitle {
        color: var(--color-text-tertiary);
        margin: 0.5rem 0 0 0;
        font-size: 0.9rem;
    }

    .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid var(--color-border);
        padding-bottom: 0;
    }

    .tab {
        background: none;
        border: none;
        padding: 0.75rem 1.25rem;
        color: var(--color-text-tertiary);
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        border-radius: 8px 8px 0 0;
        transition: all 0.2s;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
    }

    .tab:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-secondary);
    }

    .tab.active {
        background: var(--color-bg);
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
    }

    .content {
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @media (max-width: 640px) {
        .spread-tracking-page {
            padding: 1rem;
        }

        .page-header h1 {
            font-size: 1.25rem;
        }

        .tab {
            padding: 0.5rem 0.75rem;
            font-size: 0.85rem;
        }
    }
</style>
