<script lang="ts">
    /**
     * Customer Behavior Funnel Component
     * แสดง visual funnel ของ behavior types
     */
    import {
        BEHAVIOR_CONFIG,
        type BehaviorStats,
        type BehaviorType,
    } from "$lib/api/customerAnalytics";

    export let stats: BehaviorStats;
    export let onSegmentClick: ((type: BehaviorType) => void) | undefined =
        undefined;

    // Order segments from most engaged to least
    const segmentOrder: BehaviorType[] = [
        "vip_repeat",
        "hot_lead",
        "negotiator",
        "window_shopper",
        "ghost",
        "new_prospect",
    ];

    $: segments = segmentOrder.map((type) => ({
        type,
        config: BEHAVIOR_CONFIG[type],
        count: stats[type],
        percentage: stats.total > 0 ? (stats[type] / stats.total) * 100 : 0,
    }));

    function handleClick(type: BehaviorType) {
        if (onSegmentClick) {
            onSegmentClick(type);
        }
    }
</script>

<div class="funnel-container">
    <h3 class="funnel-title">📊 Customer Behavior Funnel</h3>

    <div class="funnel">
        {#each segments as segment (segment.type)}
            <button
                class="funnel-segment"
                class:has-count={segment.count > 0}
                style="--segment-color: {segment.config.color};"
                on:click={() => handleClick(segment.type)}
                disabled={!onSegmentClick}
                type="button"
            >
                <span class="segment-emoji">{segment.config.emoji}</span>
                <div class="segment-info">
                    <span class="segment-label">{segment.config.label}</span>
                    <span class="segment-label-th"
                        >{segment.config.labelTh}</span
                    >
                </div>
                <div class="segment-stats">
                    <span class="segment-count">{segment.count}</span>
                    {#if segment.percentage > 0}
                        <span class="segment-percentage"
                            >{segment.percentage.toFixed(0)}%</span
                        >
                    {/if}
                </div>
            </button>
        {/each}
    </div>

    <div class="funnel-footer">
        <span class="total-label">Total Customers</span>
        <span class="total-value">{stats.total}</span>
    </div>
</div>

<style>
    .funnel-container {
        background: var(--color-bg, #ffffff);
        border-radius: 16px;
        padding: 20px;
        border: 1px solid var(--color-border-light, #f2f2f7);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
    }

    .funnel-title {
        margin: 0 0 16px;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
        font-family: var(
            --font-family-heading,
            "Outfit",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif
        );
    }

    .funnel {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .funnel-segment {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background: var(--color-bg-tertiary, #f2f2f7);
        border: 1px solid var(--color-border-light, #f2f2f7);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        font-family: inherit;
    }

    .funnel-segment.has-count {
        background: color-mix(in srgb, var(--segment-color) 8%, white);
        border-color: color-mix(in srgb, var(--segment-color) 20%, white);
    }

    .funnel-segment:not(:disabled):hover {
        transform: translateX(4px);
        border-color: var(--segment-color);
    }

    .funnel-segment:disabled {
        cursor: default;
    }

    .segment-emoji {
        font-size: 1.5rem;
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg, #ffffff);
        border-radius: 8px;
    }

    .segment-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .segment-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
    }

    .segment-label-th {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .segment-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
    }

    .segment-count {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--segment-color);
        min-width: 28px;
        text-align: right;
    }

    .segment-percentage {
        font-size: 0.7rem;
        color: var(--color-text-tertiary, #8e8e93);
        background: var(--color-bg, #ffffff);
        padding: 2px 6px;
        border-radius: 10px;
    }

    .funnel-footer {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid var(--color-border-light, #f2f2f7);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .total-label {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-text-secondary, #48484a);
    }

    .total-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-primary, #007aff);
    }
</style>
