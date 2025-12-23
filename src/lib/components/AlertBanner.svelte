<script lang="ts">
    /**
     * Alert Banner Component
     * แสดงลูกค้าที่ต้อง follow up ด่วน
     */
    import { createEventDispatcher } from "svelte";
    import {
        BEHAVIOR_CONFIG,
        type CustomerListItem,
    } from "$lib/api/customerAnalytics";

    export let alerts: CustomerListItem[] = [];
    export let maxVisible: number = 3;

    const dispatch = createEventDispatcher<{
        customerClick: CustomerListItem;
        viewAll: void;
    }>();

    $: visibleAlerts = alerts.slice(0, maxVisible);
    $: hasMore = alerts.length > maxVisible;
    $: urgentCount = alerts.filter(
        (a) => a.followupPriority === "urgent",
    ).length;

    function handleCustomerClick(customer: CustomerListItem) {
        dispatch("customerClick", customer);
    }

    function handleViewAll() {
        dispatch("viewAll");
    }

    function formatTimeAgo(dateStr: string | undefined): string {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const now = new Date();
        const diffHours = Math.floor(
            (now.getTime() - date.getTime()) / (1000 * 60 * 60),
        );

        if (diffHours < 1) return "เมื่อกี้";
        if (diffHours < 24) return `${diffHours} ชม. ก่อน`;
        const diffDays = Math.floor(diffHours / 24);
        return `${Math.max(0, diffDays)} วันก่อน`;
    }
</script>

{#if alerts.length > 0}
    <div class="alert-banner" class:has-urgent={urgentCount > 0}>
        <header class="banner-header">
            <div class="header-icon">
                {#if urgentCount > 0}
                    🚨
                {:else}
                    📌
                {/if}
            </div>
            <div class="header-text">
                <h4 class="banner-title">
                    {#if urgentCount > 0}
                        {urgentCount} ลูกค้าต้อง Follow up ด่วน!
                    {:else}
                        {alerts.length} ลูกค้ารอ Follow up
                    {/if}
                </h4>
                <p class="banner-subtitle">กดเพื่อดูรายละเอียดและดำเนินการ</p>
            </div>
        </header>

        <div class="alert-list">
            {#each visibleAlerts as alert (alert.name)}
                <button
                    class="alert-item"
                    class:urgent={alert.followupPriority === "urgent"}
                    class:high={alert.followupPriority === "high"}
                    on:click={() => handleCustomerClick(alert)}
                    type="button"
                >
                    <span class="alert-emoji">
                        {BEHAVIOR_CONFIG[alert.behaviorType].emoji}
                    </span>
                    <span class="alert-name">{alert.displayName}</span>
                    <span class="alert-time"
                        >{formatTimeAgo(alert.lastContact)}</span
                    >
                    {#if alert.followupPriority === "urgent"}
                        <span class="priority-badge urgent">ด่วน</span>
                    {:else if alert.followupPriority === "high"}
                        <span class="priority-badge high">สำคัญ</span>
                    {/if}
                </button>
            {/each}
        </div>

        {#if hasMore}
            <button class="view-all-btn" on:click={handleViewAll} type="button">
                ดูทั้งหมด ({alerts.length}) →
            </button>
        {/if}
    </div>
{/if}

<style>
    .alert-banner {
        background: linear-gradient(
            135deg,
            rgba(255, 149, 0, 0.08),
            rgba(255, 149, 0, 0.03)
        );
        border: 1px solid rgba(255, 149, 0, 0.25);
        border-radius: 16px;
        padding: 16px;
        margin-bottom: 20px;
    }

    .alert-banner.has-urgent {
        background: linear-gradient(
            135deg,
            rgba(255, 59, 48, 0.1),
            rgba(255, 59, 48, 0.03)
        );
        border-color: rgba(255, 59, 48, 0.3);
    }

    .banner-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
    }

    .header-icon {
        font-size: 1.5rem;
        line-height: 1;
    }

    .header-text {
        flex: 1;
    }

    .banner-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
    }

    .banner-subtitle {
        margin: 4px 0 0;
        font-size: 0.8rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .alert-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .alert-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--color-bg, #ffffff);
        border: 1px solid var(--color-border-light, #f2f2f7);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
        text-align: left;
        width: 100%;
    }

    .alert-item:hover {
        background: var(--color-bg-tertiary, #f2f2f7);
        transform: translateX(4px);
    }

    .alert-item.urgent {
        border-color: rgba(255, 59, 48, 0.3);
    }

    .alert-item.high {
        border-color: rgba(255, 149, 0, 0.3);
    }

    .alert-emoji {
        font-size: 1.2rem;
        flex-shrink: 0;
    }

    .alert-name {
        flex: 1;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-text, #1d1d1f);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .alert-time {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
        flex-shrink: 0;
    }

    .priority-badge {
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
        text-transform: uppercase;
    }

    .priority-badge.urgent {
        background: rgba(255, 59, 48, 0.15);
        color: var(--color-danger, #ff3b30);
    }

    .priority-badge.high {
        background: rgba(255, 149, 0, 0.15);
        color: var(--color-warning, #ff9500);
    }

    .view-all-btn {
        width: 100%;
        margin-top: 12px;
        padding: 10px;
        background: transparent;
        border: 1px dashed var(--color-border, #e5e5ea);
        border-radius: 8px;
        color: var(--color-text-secondary, #48484a);
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .view-all-btn:hover {
        background: var(--color-bg-tertiary, #f2f2f7);
        border-color: var(--color-border, #e5e5ea);
    }
</style>
