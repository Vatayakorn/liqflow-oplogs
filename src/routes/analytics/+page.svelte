<script lang="ts">
    import { onMount } from "svelte";
    import AnalyticsChart from "$lib/components/AnalyticsChart.svelte";
    import {
        getSpreadTrend,
        getPrefundHistory,
        getMarketComparison,
        type SpreadDataPoint,
        type PrefundDataPoint,
        type MarketComparisonPoint,
    } from "$lib/api/analytics";
    import { toast } from "$lib/stores/toast";

    let spreadData: SpreadDataPoint[] = [];
    let prefundData: PrefundDataPoint[] = [];
    let marketData: MarketComparisonPoint[] = [];
    let isLoading = true;

    let spreadHours = 24;
    let marketHours = 24;
    let prefundHours = 168;

    onMount(async () => {
        await Promise.all([
            loadSpreadData(),
            loadPrefundData(),
            loadMarketData(),
        ]);
        isLoading = false;
    });

    async function loadSpreadData() {
        try {
            spreadData = await getSpreadTrend(spreadHours);
        } catch (e) {
            toast.error("Failed to load spread data");
        }
    }

    async function loadPrefundData() {
        try {
            prefundData = await getPrefundHistory(prefundHours);
        } catch (e) {
            toast.error("Failed to load prefund data");
        }
    }

    async function loadMarketData() {
        try {
            marketData = await getMarketComparison(marketHours);
        } catch (e) {
            toast.error("Failed to load market context data");
        }
    }

    $: if (spreadHours) {
        loadSpreadData();
    }

    $: if (marketHours) {
        loadMarketData();
    }

    $: if (prefundHours) {
        loadPrefundData();
    }
</script>

<svelte:head>
    <title>Analytics - OpLogs</title>
</svelte:head>

<div class="analytics-page">
    <header class="page-header">
        <h1>Statistical Insights</h1>
        <p class="subtitle">Data-driven performance monitoring</p>
    </header>

    {#if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <p>Analyzing market data...</p>
        </div>
    {:else}
        <div class="analytics-grid">
            <!-- Market Price Comparison Section -->
            <section class="analytics-section">
                <div class="section-header">
                    <div class="title-group">
                        <span class="icon">🔍</span>
                        <h3>Market Price Comparison (ALL)</h3>
                    </div>
                    <div class="controls">
                        <select bind:value={marketHours}>
                            <option value={1}>1 Hour</option>
                            <option value={3}>3 Hours</option>
                            <option value={6}>6 Hours</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>24 Hours</option>
                            <option value={168}>7 Days</option>
                        </select>
                    </div>
                </div>

                <div class="chart-container">
                    <AnalyticsChart
                        title="Market Context Evolution"
                        height={400}
                        seriesData={[
                            {
                                label: "Bitkub",
                                color: "#00d084",
                                data: marketData
                                    .filter((d) => d.source === "bitkub")
                                    .map((d) => ({
                                        time: d.time,
                                        value: d.price,
                                    })),
                            },
                            {
                                label: "Binance TH",
                                color: "#f3ba2f",
                                data: marketData
                                    .filter((d) => d.source === "binance_th")
                                    .map((d) => ({
                                        time: d.time,
                                        value: d.price,
                                    })),
                            },
                            {
                                label: "Maxbit",
                                color: "#0ea5e9",
                                data: marketData
                                    .filter((d) => d.source === "maxbit")
                                    .map((d) => ({
                                        time: d.time,
                                        value: d.price,
                                    })),
                            },
                            {
                                label: "FX (Spot)",
                                color: "#94a3b8",
                                data: marketData
                                    .filter((d) => d.source === "fx")
                                    .map((d) => ({
                                        time: d.time,
                                        value: d.price,
                                    })),
                            },
                        ]}
                    />
                </div>
                <div class="insight-box">
                    <p>
                        🔍 <strong>Market Context:</strong> เปรียบเทียบราคาจากทุกแหล่งข้อมูลเพื่อให้เห็นความแตกต่างของราคาในแต่ละตลาด
                    </p>
                </div>
            </section>

            <!-- Spread Trend Section -->
            <section class="analytics-section">
                <div class="section-header">
                    <div class="title-group">
                        <span class="icon">📈</span>
                        <h3>Spread Trend (Bitkub vs BinanceTH)</h3>
                    </div>
                    <div class="controls">
                        <select bind:value={spreadHours}>
                            <option value={1}>1 Hour</option>
                            <option value={6}>6 Hours</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>24 Hours</option>
                            <option value={168}>7 Days</option>
                        </select>
                    </div>
                </div>

                <div class="chart-container">
                    <AnalyticsChart
                        title="Price Spread Evolution"
                        height={350}
                        seriesData={[
                            {
                                label: "Absolute Spread (THB)",
                                color: "#10b981",
                                data: spreadData.map((d) => ({
                                    time: d.time,
                                    value: d.abs_spread,
                                })),
                            },
                            {
                                label: "Raw Spread",
                                color: "#6366f1",
                                data: spreadData.map((d) => ({
                                    time: d.time,
                                    value: d.spread,
                                })),
                            },
                        ]}
                    />
                </div>
                <div class="insight-box">
                    <p>
                        💡 <strong>Insight:</strong> ช่วงเวลาที่ Spread กว้างที่สุดคือจังหวะที่เกิด
                        Arbitrage Opportunity บ่อยที่สุด
                    </p>
                </div>
            </section>

            <!-- Prefund History Section -->
            <section class="analytics-section">
                <div class="section-header">
                    <div class="title-group">
                        <span class="icon">💰</span>
                        <h3>Prefund Status History</h3>
                    </div>
                    <div class="controls">
                        <select bind:value={prefundHours}>
                            <option value={1}>1 Hour</option>
                            <option value={3}>3 Hours</option>
                            <option value={6}>6 Hours</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>24 Hours</option>
                            <option value={168}>7 Days</option>
                        </select>
                    </div>
                </div>

                <div class="chart-container">
                    <AnalyticsChart
                        title="Liquidity & Capital Utilization"
                        height={350}
                        seriesData={[
                            {
                                label: "Current Prefund",
                                color: "#f59e0b",
                                data: prefundData.map((d) => ({
                                    time: d.time,
                                    value: d.current,
                                })),
                            },
                            {
                                label: "Target Prefund",
                                color: "#94a3b8",
                                data: prefundData.map((d) => ({
                                    time: d.time,
                                    value: d.target,
                                })),
                            },
                        ]}
                    />
                </div>
                <div class="insight-box">
                    <p>
                        📊 <strong>Note:</strong> กราฟแสดงระดับเงินทุนสำรองเทียบกับเป้าหมายรายวัน
                        ช่วยตรวจสอบสภาพคล่อง
                    </p>
                </div>
            </section>
        </div>
    {/if}
</div>

<style>
    .analytics-page {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .page-header h1 {
        margin: 0;
        font-size: 2rem;
        font-weight: 800;
        color: var(--color-text);
        letter-spacing: -0.03em;
    }

    .subtitle {
        margin: 0.25rem 0 0;
        color: var(--color-text-tertiary);
        font-size: 1.125rem;
    }

    .analytics-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
    }

    @media (min-width: 1200px) {
        .analytics-grid {
            grid-template-columns: 1fr;
        }
    }

    .analytics-section {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--color-separator);
    }

    .title-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .icon {
        font-size: 1.5rem;
    }

    h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-text);
    }

    .controls select {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: 1px solid var(--color-separator);
        background: white;
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        outline: none;
    }

    .insight-box {
        background: rgba(0, 122, 255, 0.05);
        border-left: 4px solid var(--color-primary);
        padding: 1rem;
        border-radius: 4px 12px 12px 4px;
        font-size: 0.9375rem;
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 5rem;
        color: var(--color-text-tertiary);
    }

    .spinner {
        width: 2.5rem;
        height: 2.5rem;
        border: 3px solid var(--color-separator);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
