<script lang="ts">
    import type { ArbitrageOpportunity } from "$lib/api/arbitrageApi";
    import {
        formatProfit,
        formatPercent,
        isGoodOpportunity,
        PROFIT_THRESHOLD_PERCENT,
    } from "$lib/api/arbitrageApi";

    export let opportunity: ArbitrageOpportunity;
    export let compact: boolean = false;

    $: isGood = isGoodOpportunity(opportunity, PROFIT_THRESHOLD_PERCENT);
    $: profitClass = opportunity.isPositive ? "positive" : "negative";
</script>

<div
    class="opportunity-card"
    class:compact
    class:positive={opportunity.isPositive}
    class:negative={!opportunity.isPositive}
>
    <div class="card-header">
        <span class="coin">{opportunity.coin}</span>
        <span class="case-badge case-{opportunity.case}"
            >Case {opportunity.case}</span
        >
    </div>

    <div class="route">
        <span class="source buy">{opportunity.buyFrom}</span>
        <span class="arrow">→</span>
        <span class="source sell">{opportunity.sellTo}</span>
    </div>

    {#if !compact}
        <div class="prices">
            <div class="price-row">
                <span class="label">Best Ask:</span>
                <span class="value"
                    >{opportunity.buyPrice.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                    })}</span
                >
                <span class="unit"
                    >{opportunity.case === 2 ? "THB" : "USDT"}</span
                >
            </div>
            <div class="price-row">
                <span class="label">Best Bid:</span>
                <span class="value"
                    >{opportunity.sellPrice.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                    })}</span
                >
                <span class="unit"
                    >{opportunity.case === 1
                        ? "THB"
                        : opportunity.case === 2
                          ? "USDT"
                          : "THB"}</span
                >
            </div>
            {#if opportunity.case !== 3}
                <div class="price-row">
                    <span class="label">FX:</span>
                    <span class="value">{opportunity.fxRate.toFixed(4)}</span>
                    <span class="unit">THB/USDT</span>
                </div>
            {/if}
        </div>
    {/if}

    <div class="profit-section {profitClass}">
        <div class="profit-amount">
            {formatProfit(opportunity.profit, opportunity.profitUnit)}
        </div>
        <div class="profit-percent">
            {formatPercent(opportunity.profitPercent)}
        </div>
    </div>

    <div class="footer">
        <span class="data-age" class:stale={opportunity.dataAge > 10}>
            {opportunity.dataAge}s ago
        </span>
        {#if isGood}
            <span class="signal good">✅ Good</span>
        {:else}
            <span class="signal neutral">⚠️</span>
        {/if}
    </div>
</div>

<style>
    .opportunity-card {
        background: var(--color-bg-secondary, #f8f9fa);
        border-radius: 12px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border: 1px solid var(--color-separator, #e5e5ea);
        transition: all 0.2s ease;
    }

    .opportunity-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .opportunity-card.positive {
        border-left: 4px solid #34c759;
    }

    .opportunity-card.negative {
        border-left: 4px solid #ff3b30;
    }

    .opportunity-card.compact {
        padding: 0.75rem;
        gap: 0.5rem;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .coin {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-text, #1c1c1e);
    }

    .compact .coin {
        font-size: 1rem;
    }

    .case-badge {
        padding: 0.25rem 0.625rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .case-badge.case-1 {
        background: #007aff20;
        color: #007aff;
    }

    .case-badge.case-2 {
        background: #5856d620;
        color: #5856d6;
    }

    .case-badge.case-3 {
        background: #ff950020;
        color: #ff9500;
    }

    .route {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9375rem;
    }

    .source {
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        font-weight: 500;
    }

    .source.buy {
        background: #34c75920;
        color: #34c759;
    }

    .source.sell {
        background: #ff3b3020;
        color: #ff3b30;
    }

    .arrow {
        color: var(--color-text-tertiary, #8e8e93);
        font-weight: 600;
    }

    .prices {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        font-size: 0.875rem;
    }

    .price-row {
        display: flex;
        gap: 0.5rem;
    }

    .price-row .label {
        color: var(--color-text-tertiary, #8e8e93);
        min-width: 3rem;
    }

    .price-row .value {
        font-family: "SF Mono", "Menlo", monospace;
        font-weight: 500;
    }

    .price-row .unit {
        color: var(--color-text-tertiary, #8e8e93);
        font-size: 0.8125rem;
    }

    .profit-section {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 0.75rem;
        border-radius: 8px;
        margin-top: auto;
    }

    .profit-section.positive {
        background: #34c75915;
    }

    .profit-section.negative {
        background: #ff3b3015;
    }

    .profit-amount {
        font-size: 1.125rem;
        font-weight: 700;
        font-family: "SF Mono", "Menlo", monospace;
    }

    .profit-section.positive .profit-amount {
        color: #34c759;
    }

    .profit-section.negative .profit-amount {
        color: #ff3b30;
    }

    .profit-percent {
        font-size: 1rem;
        font-weight: 600;
    }

    .profit-section.positive .profit-percent {
        color: #34c759;
    }

    .profit-section.negative .profit-percent {
        color: #ff3b30;
    }

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8125rem;
    }

    .data-age {
        color: var(--color-text-tertiary, #8e8e93);
    }

    .data-age.stale {
        color: #ff9500;
    }

    .signal {
        font-weight: 500;
    }

    .signal.good {
        color: #34c759;
    }

    .signal.neutral {
        color: #8e8e93;
    }
</style>
