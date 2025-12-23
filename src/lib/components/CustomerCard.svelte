<script lang="ts">
    /**
     * Customer Card Component
     * แสดงข้อมูลสรุปลูกค้าพร้อม behavior badge และ action
     */
    import { createEventDispatcher } from "svelte";
    import {
        BEHAVIOR_CONFIG,
        type CustomerListItem,
        type BehaviorType,
    } from "$lib/api/customerAnalytics";

    export let customer: CustomerListItem;
    export let compact: boolean = false;

    const dispatch = createEventDispatcher<{
        click: CustomerListItem;
        action: { customer: CustomerListItem; action: string };
    }>();

    $: config = BEHAVIOR_CONFIG[customer.behaviorType];

    function formatVolume(v: number): string {
        if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
        return v.toLocaleString();
    }

    function formatDate(dateStr: string | undefined): string {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return "วันนี้";
        if (diffDays === 1) return "เมื่อวาน";
        if (diffDays < 7) return `${diffDays} วันก่อน`;
        return date.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
        });
    }

    function handleClick() {
        dispatch("click", customer);
    }

    function handleKeyPress(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            handleClick();
        }
    }
</script>

<button
    class="customer-card"
    class:compact
    class:needs-followup={customer.needsFollowup}
    class:priority-urgent={customer.followupPriority === "urgent"}
    class:priority-high={customer.followupPriority === "high"}
    on:click={handleClick}
    type="button"
>
    <!-- Header -->
    <div class="card-header">
        <div class="customer-info">
            <span class="behavior-badge" style="--badge-color: {config.color}">
                {config.emoji}
            </span>
            <div class="name-section">
                <h3 class="customer-name">{customer.displayName}</h3>
                <span class="behavior-label">{config.labelTh}</span>
            </div>
        </div>

        <div class="engagement-score" title="Engagement Score">
            <div
                class="score-ring"
                style="--score: {customer.engagementScore * 100}%"
            >
                <span class="score-value"
                    >{Math.round(customer.engagementScore * 100)}</span
                >
            </div>
        </div>
    </div>

    {#if !compact}
        <!-- Stats -->
        <div class="stats-row">
            <div class="stat">
                <span class="stat-value"
                    >{formatVolume(customer.totalVolume)}</span
                >
                <span class="stat-label">USDT</span>
            </div>
            <div class="stat">
                <span class="stat-value">{customer.transactionCount}</span>
                <span class="stat-label">ธุรกรรม</span>
            </div>
            <div class="stat">
                <span class="stat-value"
                    >{formatDate(customer.lastContact)}</span
                >
                <span class="stat-label">ล่าสุด</span>
            </div>
        </div>

        <!-- Action -->
        <div class="action-row">
            <span class="action-hint">💡 {config.action}</span>
        </div>
    {/if}

    {#if customer.needsFollowup}
        <div class="followup-badge">
            {#if customer.followupPriority === "urgent"}
                🚨 Follow up ด่วน!
            {:else if customer.followupPriority === "high"}
                ⚠️ ต้อง Follow up
            {:else}
                📌 รอ Follow up
            {/if}
        </div>
    {/if}
</button>

<style>
    .customer-card {
        background: var(--color-bg, #ffffff);
        border-radius: 16px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid var(--color-border-light, #f2f2f7);
        position: relative;
        overflow: hidden;
        width: 100%;
        text-align: left;
        font-family: inherit;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
    }

    .customer-card:hover {
        transform: translateY(-2px);
        border-color: var(--color-primary, #007aff);
        box-shadow: 0 8px 25px rgba(0, 122, 255, 0.1);
    }

    .customer-card.compact {
        padding: 12px;
    }

    .customer-card.needs-followup {
        border-color: var(--color-warning, #ff9500);
    }

    .customer-card.priority-urgent {
        border-color: var(--color-danger, #ff3b30);
        animation: pulse-urgent 2s infinite;
    }

    .customer-card.priority-high {
        border-color: var(--color-warning, #ff9500);
    }

    @keyframes pulse-urgent {
        0%,
        100% {
            box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.3);
        }
        50% {
            box-shadow: 0 0 0 8px rgba(255, 59, 48, 0);
        }
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
    }

    .customer-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }

    .behavior-badge {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        background: color-mix(in srgb, var(--badge-color) 15%, white);
        flex-shrink: 0;
    }

    .name-section {
        min-width: 0;
    }

    .customer-name {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .behavior-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .engagement-score {
        flex-shrink: 0;
    }

    .score-ring {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: conic-gradient(
            var(--color-primary, #007aff) var(--score),
            var(--color-border-light, #f2f2f7) var(--score)
        );
        position: relative;
    }

    .score-ring::before {
        content: "";
        position: absolute;
        inset: 4px;
        background: var(--color-bg, #ffffff);
        border-radius: 50%;
    }

    .score-value {
        position: relative;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
    }

    .stats-row {
        display: flex;
        gap: 16px;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--color-border-light, #f2f2f7);
    }

    .stat {
        flex: 1;
        text-align: center;
    }

    .stat-value {
        display: block;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
    }

    .stat-label {
        font-size: 0.7rem;
        color: var(--color-text-tertiary, #8e8e93);
        text-transform: uppercase;
    }

    .action-row {
        margin-top: 12px;
        padding: 8px 12px;
        background: var(--color-bg-tertiary, #f2f2f7);
        border-radius: 8px;
    }

    .action-hint {
        font-size: 0.8rem;
        color: var(--color-text-secondary, #48484a);
    }

    .followup-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 0.7rem;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(255, 149, 0, 0.15);
        color: var(--color-warning, #ff9500);
    }

    .priority-urgent .followup-badge {
        background: rgba(255, 59, 48, 0.15);
        color: var(--color-danger, #ff3b30);
    }
</style>
