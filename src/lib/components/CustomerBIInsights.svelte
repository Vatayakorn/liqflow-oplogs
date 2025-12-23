<script lang="ts">
    /**
     * Customer BI Insights Component
     * วิเคราะห์ข้อมูลเชิงลึกทางธุรกิจจากรายชื่อลูกค้า
     */
    import { createEventDispatcher } from "svelte";
    import {
        BEHAVIOR_CONFIG,
        type CustomerListItem,
    } from "$lib/api/customerAnalytics";

    export let customers: CustomerListItem[] = [];

    const dispatch = createEventDispatcher<{
        customerClick: CustomerListItem;
    }>();

    // 1. Top 5 Whales by Volume
    $: topWhales = [...customers]
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, 5)
        .filter((c) => c.totalVolume > 0);

    // 2. Rising Stars (Most Active by count but not high volume yet)
    $: activeTraders = [...customers]
        .sort((a, b) => b.transactionCount - a.transactionCount)
        .slice(0, 5)
        .filter((c) => c.transactionCount > 0);

    // 3. Concentration Analysis
    $: totalVol = customers.reduce((sum, c) => sum + c.totalVolume, 0);
    $: whalesVol = topWhales.reduce((sum, c) => sum + c.totalVolume, 0);
    $: whaleConcentration = totalVol > 0 ? (whalesVol / totalVol) * 100 : 0;

    // 4. Ghost Whales (Top historical volume but no recent activity - placeholder for better logic)
    // For now: Top volume customers who are classified as 'ghost'
    $: ghostWhales = customers
        .filter((c) => c.behaviorType === "ghost")
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, 3);

    function formatVolume(v: number): string {
        if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
        return v.toLocaleString();
    }

    function handleCustomerClick(customer: CustomerListItem) {
        dispatch("customerClick", customer);
    }
</script>

<section class="bi-insights">
    <header class="bi-header">
        <div class="bi-title">
            <span class="bi-icon">📈</span>
            <div class="bi-text">
                <h2>Business Intelligence</h2>
                <p>เจาะลึกพฤติกรรมลูกค้าและโอกาสทางธุรกิจ</p>
            </div>
        </div>
        <div
            class="concentration-badge"
            class:warning={whaleConcentration > 80}
        >
            <span class="label">Top 5 Concentration</span>
            <span class="value">{whaleConcentration.toFixed(1)}%</span>
        </div>
    </header>

    <div class="bi-grid">
        <!-- Whales Leaderboard -->
        <div class="bi-card">
            <h3>🐳 Whales (Top Volume)</h3>
            <div class="bi-list">
                {#each topWhales as whale, i}
                    <button
                        class="bi-item"
                        on:click={() => handleCustomerClick(whale)}
                    >
                        <span class="rank">{i + 1}</span>
                        <span class="emoji"
                            >{BEHAVIOR_CONFIG[whale.behaviorType].emoji}</span
                        >
                        <span class="name">{whale.displayName}</span>
                        <span class="value"
                            >{formatVolume(whale.totalVolume)}</span
                        >
                    </button>
                {/each}
                {#if topWhales.length === 0}
                    <p class="empty">ไม่มีข้อมูลธุรกรรมในช่วงนี้</p>
                {/if}
            </div>
        </div>

        <!-- Most Active -->
        <div class="bi-card">
            <h3>⚡ Frequent Traders</h3>
            <div class="bi-list">
                {#each activeTraders as trader, i}
                    <button
                        class="bi-item"
                        on:click={() => handleCustomerClick(trader)}
                    >
                        <span class="rank">{i + 1}</span>
                        <span class="emoji"
                            >{BEHAVIOR_CONFIG[trader.behaviorType].emoji}</span
                        >
                        <span class="name">{trader.displayName}</span>
                        <span class="value">{trader.transactionCount} TX</span>
                    </button>
                {/each}
                {#if activeTraders.length === 0}
                    <p class="empty">ไม่มีธุรกรรมในช่วงนี้</p>
                {/if}
            </div>
        </div>

        <!-- At Risk / Ghost Whales -->
        <div class="bi-card alert">
            <h3>⚠️ At Risk (In-active Whales)</h3>
            <div class="bi-list">
                {#each ghostWhales as ghost}
                    <button
                        class="bi-item ghost"
                        on:click={() => handleCustomerClick(ghost)}
                    >
                        <span class="emoji">😶</span>
                        <div class="name-box">
                            <span class="name">{ghost.displayName}</span>
                            <span class="sub">หายไปนานกว่า 14 วัน</span>
                        </div>
                        <span class="value"
                            >{formatVolume(ghost.totalVolume)}</span
                        >
                    </button>
                {/each}
                {#if ghostWhales.length === 0}
                    <p class="empty">ยังไม่มีลูกค้ากลุ่มเสี่ยง</p>
                {/if}
            </div>
        </div>
    </div>
</section>

<style>
    .bi-insights {
        background: var(--color-bg, #ffffff);
        border-radius: 20px;
        padding: 24px;
        margin-bottom: 24px;
        border: 1px solid var(--color-border-light, #f2f2f7);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }

    .bi-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .bi-title {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .bi-icon {
        font-size: 2rem;
    }

    .bi-text h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
    }

    .bi-text p {
        margin: 2px 0 0;
        font-size: 0.85rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .concentration-badge {
        background: rgba(0, 122, 255, 0.05);
        padding: 6px 12px;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .concentration-badge.warning {
        background: rgba(255, 149, 0, 0.1);
        border: 1px solid rgba(255, 149, 0, 0.2);
    }

    .concentration-badge .label {
        font-size: 0.65rem;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .concentration-badge .value {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-primary, #007aff);
    }

    .concentration-badge.warning .value {
        color: var(--color-warning, #ff9500);
    }

    .bi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
    }

    .bi-card {
        background: var(--color-bg-tertiary, #f2f2f7);
        border-radius: 16px;
        padding: 16px;
    }

    .bi-card.alert {
        background: rgba(255, 59, 48, 0.03);
        border: 1px dashed rgba(255, 59, 48, 0.2);
    }

    .bi-card h3 {
        margin: 0 0 12px;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--color-text-secondary, #48484a);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .bi-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .bi-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--color-bg, #ffffff);
        border: 1px solid transparent;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
        width: 100%;
        text-align: left;
    }

    .bi-item:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border-color: var(--color-primary, #007aff);
    }

    .rank {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-text-tertiary, #8e8e93);
        width: 16px;
    }

    .emoji {
        font-size: 1.2rem;
    }

    .name {
        flex: 1;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-text, #1d1d1f);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .name-box {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }

    .name-box .sub {
        font-size: 0.7rem;
        color: var(--color-danger, #ff3b30);
    }

    .value {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
    }

    .bi-item.ghost .value {
        color: var(--color-text-tertiary, #8e8e93);
    }

    .empty {
        font-size: 0.85rem;
        color: var(--color-text-tertiary, #8e8e93);
        text-align: center;
        padding: 20px;
    }

    @media (max-width: 768px) {
        .bi-insights {
            padding: 16px;
        }
        .bi-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
