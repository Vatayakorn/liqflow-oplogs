<script lang="ts">
    /**
     * Prefund Tracker Component
     * Visual progress bar for prefund status
     */
    import { PREFUND_DEFAULTS } from "$lib/config/tradingConfig";

    export let current: number = 0;
    export let target: number = PREFUND_DEFAULTS.target;
    export let currency: string = PREFUND_DEFAULTS.currency;

    $: percentage = Math.min((current / target) * 100, 100);
    $: diff = current - target;
    $: status = diff >= 0 ? "surplus" : "deficit";
    $: absDisplay = Math.abs(diff).toLocaleString();
</script>

<div class="prefund-tracker">
    <div class="tracker-header">
        <span class="label">Prefund Status</span>
        <span class="amounts">
            <span class="current">{current.toLocaleString()}</span>
            <span class="separator">/</span>
            <span class="target">{target.toLocaleString()}</span>
            <span class="currency">{currency}</span>
        </span>
    </div>

    <div class="progress-bar">
        <div
            class="progress-fill"
            class:surplus={status === "surplus"}
            class:deficit={status === "deficit"}
            style="width: {percentage}%"
        ></div>
    </div>

    <div
        class="status-row"
        class:surplus={status === "surplus"}
        class:deficit={status === "deficit"}
    >
        {#if status === "surplus"}
            <span class="status-icon">✅</span>
            <span class="status-text">Surplus: +{absDisplay} {currency}</span>
        {:else}
            <span class="status-icon">⚠️</span>
            <span class="status-text">Deficit: -{absDisplay} {currency}</span>
        {/if}
    </div>
</div>

<style>
    .prefund-tracker {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        background: var(--color-bg-secondary);
        border-radius: 12px;
    }

    .tracker-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-secondary);
    }

    .amounts {
        font-family: var(--font-family-heading);
        font-size: 0.9375rem;
        color: var(--color-text);
    }

    .current {
        font-weight: 700;
    }

    .separator {
        margin: 0 0.25rem;
        color: var(--color-text-tertiary);
    }

    .target {
        color: var(--color-text-tertiary);
    }

    .currency {
        margin-left: 0.25rem;
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .progress-bar {
        height: 8px;
        background: var(--color-border-light);
        border-radius: 100px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        border-radius: 100px;
        transition: width 0.3s ease;
    }

    .progress-fill.surplus {
        background: linear-gradient(90deg, #34c759, #30d158);
    }

    .progress-fill.deficit {
        background: linear-gradient(90deg, #ff9500, #ff3b30);
    }

    .status-row {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.8125rem;
        font-weight: 500;
    }

    .status-row.surplus {
        color: var(--color-success);
    }

    .status-row.deficit {
        color: var(--color-warning);
    }

    .status-icon {
        font-size: 0.875rem;
    }
</style>
