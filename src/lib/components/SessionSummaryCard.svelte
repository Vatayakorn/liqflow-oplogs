<script lang="ts">
    /**
     * Session Summary Card Component
     * Displays key metrics for a session at a glance
     */
    import type { OplogSession } from "$lib/api/oplog";
    import {
        calculateSessionStats,
        formatVolume,
        getPrefundStatusColor,
        type SessionStats,
    } from "$lib/utils/sessionStats";
    import { SHIFTS } from "$lib/config/tradingConfig";
    import { createEventDispatcher } from "svelte";

    export let session: OplogSession;
    export let compact: boolean = false;
    export let showActions: boolean = true;

    const dispatch = createEventDispatcher<{
        view: string;
        edit: string;
        delete: string;
    }>();

    $: stats = calculateSessionStats(session);
    $: shiftInfo = SHIFTS.find((s) => s.value === session.shift);
    $: prefundColor = getPrefundStatusColor(stats.prefund.status);

    function getShiftBadgeClass(shift: string): string {
        switch (shift) {
            case "A":
                return "shift-morning";
            case "B":
                return "shift-afternoon";
            case "C":
                return "shift-night";
            default:
                return "";
        }
    }

    function truncateNote(note: string, maxLength: number = 60): string {
        if (!note || note.length <= maxLength) return note || "";
        return note.substring(0, maxLength) + "...";
    }
</script>

<article class="summary-card" class:compact>
    <!-- Header: Shift + Time -->
    <header class="card-header">
        <div class="shift-badge {getShiftBadgeClass(session.shift)}">
            {shiftInfo?.label || `Shift ${session.shift}`}
        </div>
        <div class="time-info">
            <span class="time"
                >{session.start_time} - {session.end_time || "..."}</span
            >
            <span class="duration">{stats.duration.formatted}</span>
        </div>
    </header>

    <!-- Main Metrics Grid -->
    <div class="metrics-grid">
        <!-- OTC Volume -->
        <div class="metric-card">
            <div class="metric-icon">💰</div>
            <div class="metric-content">
                <span class="metric-label">OTC Volume</span>
                <span class="metric-value"
                    >{formatVolume(stats.otc.totalVolume)} USDT</span
                >
                <span class="metric-sub">
                    {stats.otc.count} txns
                    {#if stats.otc.buyCount > 0 || stats.otc.sellCount > 0}
                        <span class="buy-sell">
                            <span class="buy">▲{stats.otc.buyCount}</span>
                            <span class="sell">▼{stats.otc.sellCount}</span>
                        </span>
                    {/if}
                </span>
            </div>
        </div>

        <!-- Spread -->
        <div class="metric-card">
            <div class="metric-icon">📊</div>
            <div class="metric-content">
                <span class="metric-label">Spread</span>
                <span class="metric-value">{stats.spread.formatted}</span>
                {#if stats.spread.higher}
                    <span
                        class="metric-sub higher-badge"
                        class:bitkub={stats.spread.higher === "Bitkub"}
                        class:binance={stats.spread.higher === "BinanceTH"}
                    >
                        {stats.spread.higher} ↑
                    </span>
                {:else}
                    <span class="metric-sub">-</span>
                {/if}
            </div>
        </div>

        <!-- Prefund Status -->
        <div class="metric-card">
            <div class="metric-icon"></div>
            <div class="metric-content">
                <span class="metric-label">Prefund</span>
                <span class="metric-value" style="color: {prefundColor}"
                    >{stats.prefund.percent}%</span
                >
                <div class="prefund-bar">
                    <div
                        class="prefund-fill"
                        style="width: {Math.min(
                            stats.prefund.percent,
                            100,
                        )}%; background: {prefundColor}"
                    ></div>
                </div>
                <span class="metric-sub"
                    >{formatVolume(stats.prefund.current)} / {formatVolume(
                        stats.prefund.target,
                    )}</span
                >
            </div>
        </div>

        <!-- Arbitrage Opportunity -->
        <div
            class="metric-card"
            class:has-opportunity={stats.arbitrage.hasOpportunity}
        >
            <div class="metric-icon">⚡</div>
            <div class="metric-content">
                <span class="metric-label">Arbitrage</span>
                {#if stats.arbitrage.hasOpportunity}
                    <span class="metric-value arb-positive">
                        +{stats.arbitrage.bestDiffSatang} สต.
                    </span>
                    <span class="metric-sub arb-best">
                        {stats.arbitrage.bestExchange}
                        {#if stats.arbitrage.bestDirection === "toBroker"}
                            → Broker ✓
                        {:else}
                            → Exchange ✓
                        {/if}
                    </span>
                {:else}
                    <span class="metric-value arb-none">-</span>
                    <span class="metric-sub">No opportunity</span>
                {/if}
                {#if stats.arbitrage.bitkubDiff !== null || stats.arbitrage.binanceDiff !== null || stats.arbitrage.bitkubReverseDiff !== null || stats.arbitrage.binanceReverseDiff !== null}
                    <div class="arb-details">
                        <!-- Direction 1: Broker → Exchange (ซื้อจาก Broker ขายที่ Exchange) -->
                        {#if stats.arbitrage.bitkubDiff !== null}
                            <span
                                class="arb-item"
                                class:positive={stats.arbitrage.bitkubDiff > 0}
                                title="Bitkub Bid - Broker Ask (ซื้อจาก Broker ขายที่ BK)"
                            >
                                Br→BK: {stats.arbitrage.bitkubDiff > 0
                                    ? "+"
                                    : ""}{Math.round(
                                    stats.arbitrage.bitkubDiff * 100,
                                )}
                            </span>
                        {/if}
                        {#if stats.arbitrage.binanceDiff !== null}
                            <span
                                class="arb-item"
                                class:positive={stats.arbitrage.binanceDiff > 0}
                                title="BinanceTH Bid - Broker Ask (ซื้อจาก Broker ขายที่ BN)"
                            >
                                Br→BN: {stats.arbitrage.binanceDiff > 0
                                    ? "+"
                                    : ""}{Math.round(
                                    stats.arbitrage.binanceDiff * 100,
                                )}
                            </span>
                        {/if}
                        <!-- Direction 2: Exchange → Broker (ซื้อจาก Exchange ขายให้ Broker) -->
                        {#if stats.arbitrage.bitkubReverseDiff !== null}
                            <span
                                class="arb-item"
                                class:positive={stats.arbitrage
                                    .bitkubReverseDiff > 0}
                                title="Broker Bid - Bitkub Ask (ซื้อจาก BK ขายให้ Broker)"
                            >
                                BK→Br: {stats.arbitrage.bitkubReverseDiff > 0
                                    ? "+"
                                    : ""}{Math.round(
                                    stats.arbitrage.bitkubReverseDiff * 100,
                                )}
                            </span>
                        {/if}
                        {#if stats.arbitrage.binanceReverseDiff !== null}
                            <span
                                class="arb-item"
                                class:positive={stats.arbitrage
                                    .binanceReverseDiff > 0}
                                title="Broker Bid - BinanceTH Ask (ซื้อจาก BN ขายให้ Broker)"
                            >
                                BN→Br: {stats.arbitrage.binanceReverseDiff > 0
                                    ? "+"
                                    : ""}{Math.round(
                                    stats.arbitrage.binanceReverseDiff * 100,
                                )}
                            </span>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- Secondary Info -->
    {#if !compact}
        <div class="secondary-info">
            <!-- FX + Attachments Row -->
            <div class="info-row">
                {#if session.fx_rate}
                    <span class="info-item">💹 FX: {session.fx_rate}</span>
                {/if}
                {#if stats.attachments.imageCount > 0}
                    <span class="info-item"
                        >📸 {stats.attachments.imageCount}</span
                    >
                {/if}
                {#if stats.attachments.audioCount > 0}
                    <span class="info-item"
                        >🎤 {stats.attachments.audioCount}</span
                    >
                {/if}
            </div>

            <!-- Exchange Volume Row -->
            {#if stats.exchangeVolume.bitkub !== null || stats.exchangeVolume.binanceTH !== null}
                <div class="exchange-volume-row">
                    <span class="ev-label">📈 Exchange Vol:</span>
                    {#if stats.exchangeVolume.bitkub !== null}
                        <span class="ev-item bitkub">
                            Bitkub {formatVolume(stats.exchangeVolume.bitkub)} THB
                        </span>
                    {/if}
                    {#if stats.exchangeVolume.binanceTH !== null}
                        <span class="ev-item binance">
                            BinanceTH {formatVolume(
                                stats.exchangeVolume.binanceTH,
                            )} THB
                        </span>
                    {/if}
                </div>
            {/if}

            <!-- Note Preview -->
            {#if session.note}
                <p class="note-preview">📝 {truncateNote(session.note)}</p>
            {/if}

            <!-- Team Info -->
            <div class="team-row">
                <span>👤 <strong>Broker:</strong> {session.broker}</span>
                <span>👤 <strong>Trader:</strong> {session.trader}</span>
                <span>👤 <strong>Head:</strong> {session.head}</span>
            </div>
        </div>
    {/if}

    <!-- Actions -->
    {#if showActions}
        <footer class="card-actions">
            <button
                class="btn-action btn-view"
                on:click={() => dispatch("view", session.id)}
            >
                View Details
            </button>
            <button
                class="btn-action btn-edit"
                on:click={() => dispatch("edit", session.id)}
            >
                Edit
            </button>
            <button
                class="btn-action btn-delete"
                on:click={() => dispatch("delete", session.id)}
            >
                Delete
            </button>
        </footer>
    {/if}
</article>

<style>
    .summary-card {
        background: var(--color-bg);
        border: 1px solid var(--color-border-light);
        border-radius: 16px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        transition:
            box-shadow 0.2s,
            transform 0.2s;
    }

    .summary-card:hover {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .summary-card.compact {
        padding: 1rem;
        gap: 0.75rem;
    }

    /* Header */
    .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    .shift-badge {
        padding: 0.375rem 0.75rem;
        border-radius: 8px;
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .shift-morning {
        background: rgba(255, 149, 0, 0.15);
        color: #ff9500;
    }

    .shift-afternoon {
        background: rgba(0, 122, 255, 0.15);
        color: #007aff;
    }

    .shift-night {
        background: rgba(88, 86, 214, 0.15);
        color: #5856d6;
    }

    .time-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .time {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .duration {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
        background: var(--color-bg-secondary);
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
    }

    /* Metrics Grid */
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
    }

    @media (max-width: 900px) {
        .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 640px) {
        .metrics-grid {
            grid-template-columns: 1fr;
        }
    }

    .metric-card {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.875rem;
        background: var(--color-bg-secondary);
        border-radius: 12px;
    }

    .metric-icon {
        font-size: 1.5rem;
        line-height: 1;
    }

    .metric-content {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        flex: 1;
        min-width: 0;
    }

    .metric-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .metric-value {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--color-text);
    }

    .metric-sub {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
    }

    .buy-sell {
        display: inline-flex;
        gap: 0.5rem;
        margin-left: 0.25rem;
    }

    .buy {
        color: #34c759;
    }

    .sell {
        color: #ff3b30;
    }

    .higher-badge {
        display: inline-block;
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        font-weight: 600;
    }

    .higher-badge.bitkub {
        background: rgba(0, 208, 132, 0.15);
        color: #00d084;
    }

    .higher-badge.binance {
        background: rgba(243, 186, 47, 0.15);
        color: #f3ba2f;
    }

    /* Prefund Bar */
    .prefund-bar {
        width: 100%;
        height: 6px;
        background: var(--color-bg-tertiary);
        border-radius: 3px;
        overflow: hidden;
        margin: 0.25rem 0;
    }

    .prefund-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    /* Secondary Info */
    .secondary-info {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-separator);
    }

    .info-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .info-item {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
    }

    .note-preview {
        margin: 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        line-height: 1.4;
        font-style: italic;
    }

    .team-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
    }

    .team-row strong {
        font-weight: 500;
        color: var(--color-text-secondary);
    }

    /* Actions */
    .card-actions {
        display: flex;
        gap: 0.5rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-separator);
    }

    .btn-action {
        flex: 1;
        padding: 0.625rem 0.75rem;
        font-size: 0.875rem;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .btn-view {
        background: var(--color-primary);
        color: white;
    }

    .btn-view:hover {
        background: #0066cc;
    }

    .btn-edit {
        background: var(--color-bg-secondary);
        color: var(--color-text);
    }

    .btn-edit:hover {
        background: var(--color-bg-tertiary);
    }

    .btn-delete {
        background: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
    }

    .btn-delete:hover {
        background: rgba(255, 59, 48, 0.2);
    }

    @media (max-width: 640px) {
        .card-actions {
            flex-direction: column;
        }
    }

    /* Arbitrage Styles */
    .metric-card.has-opportunity {
        background: linear-gradient(
            135deg,
            rgba(52, 199, 89, 0.1),
            rgba(52, 199, 89, 0.05)
        );
        border: 1px solid rgba(52, 199, 89, 0.2);
    }

    .arb-positive {
        color: #34c759 !important;
    }

    .arb-none {
        color: var(--color-text-tertiary) !important;
    }

    .arb-best {
        color: #34c759;
        font-weight: 600;
    }

    .arb-details {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.25rem;
        margin-top: 0.25rem;
        font-size: 0.625rem;
    }

    .arb-item {
        color: var(--color-text-tertiary);
        padding: 0.0625rem 0.1875rem;
        background: var(--color-bg-tertiary);
        border-radius: 3px;
        white-space: nowrap;
    }

    .arb-item.positive {
        color: #34c759;
        background: rgba(52, 199, 89, 0.1);
    }

    /* Exchange Volume Styles */
    .exchange-volume-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        background: var(--color-bg-secondary);
        border-radius: 8px;
        font-size: 0.8125rem;
    }

    .ev-label {
        font-weight: 500;
        color: var(--color-text-secondary);
    }

    .ev-item {
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        font-weight: 600;
    }

    .ev-item.bitkub {
        background: rgba(0, 208, 132, 0.15);
        color: #00d084;
    }

    .ev-item.binance {
        background: rgba(243, 186, 47, 0.15);
        color: #f3ba2f;
    }
</style>
