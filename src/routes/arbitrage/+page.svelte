<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import ArbitrageOpportunityCard from "$lib/components/ArbitrageOpportunityCard.svelte";
    import {
        fetchAllArbitrageOpportunities,
        getBestOpportunities,
        updateDataAge,
        formatProfit,
        formatPercent,
        POLLING_INTERVAL_MS,
        PROFIT_THRESHOLD_PERCENT,
        type ArbitrageOpportunity,
        type FxData,
    } from "$lib/api/arbitrageApi";

    // State
    let opportunities: ArbitrageOpportunity[] = [];
    let fx: FxData | null = null;
    let loading = true;
    let error: string | null = null;
    let lastUpdate: Date | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let dataAgeInterval: ReturnType<typeof setInterval> | null = null;

    // Filters
    // empty set = ALL coins. If populated, only show those.
    let selectedCoins: Set<string> = new Set();
    let selectedCases: Set<1 | 2 | 3> = new Set([1, 2, 3]);
    let minProfitPercent = 0;
    let showOnlyPositive = false;
    let searchTerm = "";

    // Capital Simulation
    let simulationCapital = 10000; // Default 10,000 THB
    let capitalUnit: "THB" | "USDT" = "THB";

    // Calculate simulated profit
    function calculateSimulatedProfit(opp: ArbitrageOpportunity): {
        profit: number;
        unit: string;
    } {
        const capital =
            capitalUnit === "THB"
                ? simulationCapital
                : simulationCapital * (fx?.mid || 34);
        // For Case 1 and 3: Buy price is in THB
        // For Case 2: Buy price is in THB (LocalAsk_THB)
        let coinsCanBuy: number;
        let simulatedProfit: number;
        let unit: string;

        if (opp.case === 1) {
            // Buy Global (USDT) → Sell Local (THB)
            // Capital in THB → convert to USDT → buy coins
            const capitalUSDT = capital / opp.fxRate;
            coinsCanBuy = capitalUSDT / opp.buyPrice;
            simulatedProfit = opp.profit * coinsCanBuy;
            unit = "THB";
        } else if (opp.case === 2) {
            // Buy Local (THB) → Sell Global (USDT)
            coinsCanBuy = capital / opp.buyPrice;
            simulatedProfit = opp.profit * coinsCanBuy;
            unit = "USDT";
        } else {
            // Case 3: Buy Local → Sell Local (both THB)
            coinsCanBuy = capital / opp.buyPrice;
            simulatedProfit = opp.profit * coinsCanBuy;
            unit = "THB";
        }

        return { profit: simulatedProfit, unit };
    }

    function formatSimulatedProfit(profit: number, unit: string): string {
        const sign = profit >= 0 ? "+" : "";
        if (unit === "USDT") {
            return `${sign}${profit.toFixed(2)} USDT`;
        }
        return `${sign}${profit.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
    }

    // Best opportunities
    $: bestOpps = getBestOpportunities(opportunities);

    $: filteredOpportunities = opportunities.filter((opp) => {
        // Filter by Coin (Set)
        if (selectedCoins.size > 0 && !selectedCoins.has(opp.coin))
            return false;

        // Filter by Search Term
        if (
            searchTerm &&
            !opp.coin.toLowerCase().includes(searchTerm.toLowerCase())
        )
            return false;

        // Filter by Case
        if (!selectedCases.has(opp.case)) return false;

        // Filter by Profit
        if (opp.profitPercent < minProfitPercent) return false;

        // Filter by Positive
        if (showOnlyPositive && !opp.isPositive) return false;

        return true;
    });

    async function fetchData() {
        try {
            // Fetch ALL (no filter passed to API, filtering is done client-side for "All" view)
            const result = await fetchAllArbitrageOpportunities();
            opportunities = result.opportunities;
            fx = result.fx;
            lastUpdate = new Date();
            error = null;
        } catch (e) {
            console.error("Failed to fetch arbitrage data:", e);
            error = "Failed to fetch data. Retrying...";
        } finally {
            loading = false;
        }
    }

    function startPolling() {
        fetchData();
        pollingInterval = setInterval(fetchData, POLLING_INTERVAL_MS);
        dataAgeInterval = setInterval(() => {
            opportunities = updateDataAge(opportunities);
        }, 1000);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        if (dataAgeInterval) {
            clearInterval(dataAgeInterval);
            dataAgeInterval = null;
        }
    }

    function toggleCoin(coin: string) {
        if (selectedCoins.has(coin)) {
            selectedCoins.delete(coin);
            selectedCoins = selectedCoins;
        } else {
            selectedCoins.add(coin);
            selectedCoins = selectedCoins;
        }
    }

    function toggleCase(caseNum: 1 | 2 | 3) {
        if (selectedCases.has(caseNum)) {
            selectedCases.delete(caseNum);
        } else {
            selectedCases.add(caseNum);
        }
        selectedCases = selectedCases;
    }

    function selectAllCoins() {
        selectedCoins = new Set(); // Empty means ALL
        searchTerm = ""; // Clear search
    }

    function isCoinSelected(coin: string) {
        return selectedCoins.has(coin);
    }

    // Sorting State
    type SortKey =
        | "dataAge"
        | "coin"
        | "case"
        | "buyFrom"
        | "sellTo"
        | "buyPrice"
        | "sellPrice"
        | "fxRate"
        | "profit"
        | "profitPercent"
        | "simProfit";
    let sortKey: SortKey = "profitPercent";
    let sortDirection: "asc" | "desc" = "desc";

    // Reactive Sorted List
    $: sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortKey === "simProfit") {
            valA = calculateSimulatedProfit(a).profit;
            valB = calculateSimulatedProfit(b).profit;
        } else {
            valA = (a as any)[sortKey];
            valB = (b as any)[sortKey];
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
    });

    // Sort Handler
    function handleSort(key: SortKey) {
        if (sortKey === key) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortKey = key;
            sortDirection = "desc";
            if (key === "coin" || key === "buyFrom" || key === "sellTo") {
                sortDirection = "asc";
            }
        }
    }

    function clearFilters() {
        selectAllCoins();
        selectedCases = new Set([1, 2, 3]);
        minProfitPercent = 0;
        showOnlyPositive = false;
    }

    onMount(() => {
        startPolling();
    });

    onDestroy(() => {
        stopPolling();
    });

    function formatTime(date: Date | null): string {
        if (!date) return "--:--:--";
        return date.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }
</script>

<svelte:head>
    <title>Arbitrage Dashboard | OpLogs</title>
</svelte:head>

<div class="container">
    <header class="page-header">
        <h1>📊 Arbitrage Dashboard</h1>
        <p class="subtitle">Near real-time arbitrage opportunity scanner</p>
    </header>

    <!-- KPI Section -->
    <section class="kpi-section">
        <div class="kpi-card fx-card">
            <div class="kpi-label">FX Rate (BinanceTH mid)</div>
            <div class="kpi-value">
                {#if fx}
                    {fx.mid.toFixed(4)} <span class="kpi-unit">THB/USDT</span>
                {:else}
                    <span class="loading-dots">...</span>
                {/if}
            </div>
            <div class="kpi-meta">
                Last update: {formatTime(lastUpdate)}
            </div>
        </div>

        <div class="kpi-card" class:positive={bestOpps.case1?.isPositive}>
            <div class="kpi-label">Best Case 1</div>
            <div class="kpi-sublabel">Best Ask Global → Best Bid Local</div>
            {#if bestOpps.case1}
                <div class="kpi-value">
                    {formatProfit(bestOpps.case1.profit, "THB")}
                </div>
                <div class="kpi-percent">
                    {formatPercent(bestOpps.case1.profitPercent)}
                </div>
                <div class="kpi-meta">
                    {bestOpps.case1.coin} via {bestOpps.case1.buyFrom}
                </div>
            {:else}
                <div class="kpi-value">--</div>
            {/if}
        </div>

        <div class="kpi-card" class:positive={bestOpps.case2?.isPositive}>
            <div class="kpi-label">Best Case 2</div>
            <div class="kpi-sublabel">Best Ask Local → Best Bid Global</div>
            {#if bestOpps.case2}
                <div class="kpi-value">
                    {formatProfit(bestOpps.case2.profit, "USDT")}
                </div>
                <div class="kpi-percent">
                    {formatPercent(bestOpps.case2.profitPercent)}
                </div>
                <div class="kpi-meta">
                    {bestOpps.case2.coin} via {bestOpps.case2.sellTo}
                </div>
            {:else}
                <div class="kpi-value">--</div>
            {/if}
        </div>

        <div class="kpi-card" class:positive={bestOpps.case3?.isPositive}>
            <div class="kpi-label">Best Case 3</div>
            <div class="kpi-sublabel">Local Pingpong</div>
            {#if bestOpps.case3}
                <div class="kpi-value">
                    {formatProfit(bestOpps.case3.profit, "THB")}
                </div>
                <div class="kpi-percent">
                    {formatPercent(bestOpps.case3.profitPercent)}
                </div>
                <div class="kpi-meta">
                    {bestOpps.case3.coin}: {bestOpps.case3.buyFrom} → {bestOpps
                        .case3.sellTo}
                </div>
            {:else}
                <div class="kpi-value">--</div>
            {/if}
        </div>
    </section>

    <!-- Filters Section -->
    <section class="filters-section">
        <!-- Coin Filters -->
        <div class="filter-group coin-filters">
            <div class="filter-header">
                <label class="filter-label">Coins</label>
                <div class="filter-actions">
                    <button class="chip-action" on:click={clearFilters}
                        >Reset All</button
                    >
                </div>
            </div>

            <div class="search-row">
                <input
                    type="text"
                    placeholder="🔍 Search coin..."
                    class="search-input"
                    bind:value={searchTerm}
                />
            </div>

            <div class="filter-chips">
                <button
                    class="chip-action"
                    class:active={selectedCoins.size === 0}
                    on:click={selectAllCoins}
                >
                    ALL
                </button>
            </div>
        </div>

        <div class="filter-group">
            <label class="filter-label">Case Type</label>
            <div class="filter-chips">
                <button
                    class="chip case-1"
                    class:active={selectedCases.has(1)}
                    on:click={() => toggleCase(1)}
                >
                    Case 1
                </button>
                <button
                    class="chip case-2"
                    class:active={selectedCases.has(2)}
                    on:click={() => toggleCase(2)}
                >
                    Case 2
                </button>
                <button
                    class="chip case-3"
                    class:active={selectedCases.has(3)}
                    on:click={() => toggleCase(3)}
                >
                    Case 3
                </button>
            </div>
        </div>

        <div class="filter-group">
            <label class="filter-label">Min Profit %</label>
            <input
                type="number"
                class="filter-input"
                bind:value={minProfitPercent}
                step="0.1"
                min="-100"
            />
        </div>

        <div class="filter-group">
            <label class="filter-toggle">
                <input type="checkbox" bind:checked={showOnlyPositive} />
                Show positive only
            </label>
        </div>

        <div class="filter-group simulation-group">
            <label class="filter-label">💰 Simulate Capital</label>
            <div class="simulation-input-row">
                <input
                    type="number"
                    class="filter-input simulation-input"
                    bind:value={simulationCapital}
                    step="1000"
                    min="0"
                />
                <select class="filter-select" bind:value={capitalUnit}>
                    <option value="THB">THB</option>
                    <option value="USDT">USDT</option>
                </select>
            </div>
        </div>
    </section>

    <!-- Error State -->
    {#if error}
        <div class="error-banner">
            ⚠️ {error}
        </div>
    {/if}

    <!-- Loading State -->
    {#if loading && !opportunities.length}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading arbitrage opportunities...</p>
        </div>
    {:else}
        <!-- Opportunity Table -->
        <section class="table-section">
            <div class="table-header">
                <h2>Opportunities ({filteredOpportunities.length})</h2>
                <span
                    class="refresh-indicator"
                    class:active={!!pollingInterval}
                >
                    🔄 Auto-refresh: {POLLING_INTERVAL_MS / 1000}s
                </span>
            </div>

            {#if filteredOpportunities.length === 0}
                <div class="empty-state">
                    <p>No opportunities match your filters</p>
                </div>
            {:else}
                <div class="table-container">
                    <table class="opportunity-table">
                        <thead>
                            <tr>
                                <th
                                    on:click={() => handleSort("dataAge")}
                                    class="sortable"
                                >
                                    Age {sortKey === "dataAge"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("coin")}
                                    class="sortable"
                                >
                                    Coin {sortKey === "coin"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("case")}
                                    class="sortable"
                                >
                                    Case {sortKey === "case"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("buyFrom")}
                                    class="sortable"
                                >
                                    Buy From {sortKey === "buyFrom"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("sellTo")}
                                    class="sortable"
                                >
                                    Sell To {sortKey === "sellTo"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("buyPrice")}
                                    class="numeric sortable"
                                >
                                    Best Ask {sortKey === "buyPrice"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("sellPrice")}
                                    class="numeric sortable"
                                >
                                    Best Bid {sortKey === "sellPrice"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("fxRate")}
                                    class="numeric sortable"
                                >
                                    FX {sortKey === "fxRate"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("profit")}
                                    class="numeric sortable"
                                >
                                    Profit/Unit {sortKey === "profit"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("profitPercent")}
                                    class="numeric sortable"
                                >
                                    % {sortKey === "profitPercent"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th
                                    on:click={() => handleSort("simProfit")}
                                    class="numeric sim-profit sortable"
                                >
                                    Sim. Profit {sortKey === "simProfit"
                                        ? sortDirection === "asc"
                                            ? "↑"
                                            : "↓"
                                        : ""}
                                </th>
                                <th>Signal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each sortedOpportunities as opp (opp.id)}
                                <tr
                                    class:positive={opp.isPositive}
                                    class:negative={!opp.isPositive}
                                >
                                    <td
                                        class="data-age"
                                        class:stale={opp.dataAge > 10}
                                    >
                                        {opp.dataAge}s
                                    </td>
                                    <td class="coin">{opp.coin}</td>
                                    <td>
                                        <span
                                            class="case-badge case-{opp.case}"
                                        >
                                            {opp.case}
                                        </span>
                                    </td>
                                    <td class="source buy">{opp.buyFrom}</td>
                                    <td class="source sell">{opp.sellTo}</td>
                                    <td class="numeric price">
                                        {opp.buyPrice.toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6,
                                        })}
                                    </td>
                                    <td class="numeric price">
                                        {opp.sellPrice.toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6,
                                        })}
                                    </td>
                                    <td class="numeric fx">
                                        {opp.case === 3
                                            ? "-"
                                            : opp.fxRate.toFixed(4)}
                                    </td>
                                    <td
                                        class="numeric profit"
                                        class:positive={opp.isPositive}
                                        class:negative={!opp.isPositive}
                                    >
                                        {formatProfit(
                                            opp.profit,
                                            opp.profitUnit,
                                        )}
                                    </td>
                                    <td
                                        class="numeric percent"
                                        class:positive={opp.isPositive}
                                        class:negative={!opp.isPositive}
                                    >
                                        {formatPercent(opp.profitPercent)}
                                    </td>
                                    <td
                                        class="numeric sim-profit-value"
                                        class:positive={calculateSimulatedProfit(
                                            opp,
                                        ).profit > 0}
                                        class:negative={calculateSimulatedProfit(
                                            opp,
                                        ).profit < 0}
                                    >
                                        {formatSimulatedProfit(
                                            calculateSimulatedProfit(opp)
                                                .profit,
                                            calculateSimulatedProfit(opp).unit,
                                        )}
                                    </td>
                                    <td class="signal">
                                        {#if opp.profitPercent >= PROFIT_THRESHOLD_PERCENT}
                                            <span class="signal-good">✅</span>
                                        {:else if opp.isPositive}
                                            <span class="signal-ok">🟡</span>
                                        {:else}
                                            <span class="signal-bad">🔴</span>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </section>

        <!-- Cards View (Mobile) -->
        <section class="cards-section">
            {#each filteredOpportunities.slice(0, 20) as opp (opp.id)}
                <ArbitrageOpportunityCard opportunity={opp} />
            {/each}
        </section>
    {/if}
</div>

<style>
    .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 1rem;
    }

    .page-header {
        margin-bottom: 1.5rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
    }

    .subtitle {
        color: var(--color-text-secondary, #636366);
        font-size: 0.9375rem;
    }

    /* KPI Section */
    .kpi-section {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .kpi-card {
        background: var(--color-bg-secondary, #f8f9fa);
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid var(--color-separator, #e5e5ea);
    }

    .kpi-card.positive {
        border-left: 4px solid #34c759;
    }

    .kpi-card.fx-card {
        border-left: 4px solid #007aff;
    }

    .kpi-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-secondary, #636366);
        margin-bottom: 0.125rem;
    }

    .kpi-sublabel {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
        margin-bottom: 0.5rem;
    }

    .kpi-value {
        font-size: 1.375rem;
        font-weight: 700;
        font-family: "SF Mono", "Menlo", monospace;
        color: var(--color-text, #1c1c1e);
    }

    .kpi-unit {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .kpi-percent {
        font-size: 1rem;
        font-weight: 600;
        color: #34c759;
    }

    .kpi-meta {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
        margin-top: 0.375rem;
    }

    /* Filters Section */
    .filters-section {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1rem;
        background: var(--color-bg-secondary, #f8f9fa);
        border-radius: 12px;
        margin-bottom: 1.5rem;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .coin-filters {
        flex: 1;
        min-width: 300px;
    }

    .filter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .search-row {
        margin-bottom: 0.5rem;
    }

    .search-input {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--color-separator, #e5e5ea);
        font-size: 0.875rem;
    }

    .filter-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-secondary, #636366);
    }

    .filter-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
    }

    .chip {
        padding: 0.375rem 0.75rem;
        border-radius: 100px;
        font-size: 0.8125rem;
        font-weight: 500;
        border: 1px solid var(--color-separator, #e5e5ea);
        background: white;
        color: var(--color-text-secondary, #636366);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .chip:hover {
        border-color: var(--color-primary, #007aff);
    }

    .chip.active {
        background: var(--color-primary, #007aff);
        color: white;
        border-color: var(--color-primary, #007aff);
    }

    .chip.case-1.active {
        background: #007aff;
        border-color: #007aff;
    }

    .chip.case-2.active {
        background: #5856d6;
        border-color: #5856d6;
    }

    .chip.case-3.active {
        background: #ff9500;
        border-color: #ff9500;
    }

    .chip-action {
        padding: 0.375rem 0.625rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 500;
        border: none;
        background: transparent;
        color: var(--color-primary, #007aff);
        cursor: pointer;
    }

    .chip-action:hover {
        text-decoration: underline;
    }

    .chip-action.active {
        background: #e5e5ea;
        color: black;
        text-decoration: none;
    }

    .filter-input {
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--color-separator, #e5e5ea);
        font-size: 0.875rem;
        width: 80px;
    }

    .filter-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--color-text-secondary, #636366);
        cursor: pointer;
    }

    /* Error Banner */
    .error-banner {
        padding: 1rem;
        background: #ff3b3015;
        border: 1px solid #ff3b30;
        border-radius: 8px;
        color: #ff3b30;
        margin-bottom: 1rem;
    }

    /* Loading State */
    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem;
        color: var(--color-text-secondary, #636366);
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--color-separator, #e5e5ea);
        border-top-color: var(--color-primary, #007aff);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .loading-dots {
        animation: blink 1s infinite;
    }

    @keyframes blink {
        50% {
            opacity: 0.3;
        }
    }

    /* Table Section */
    .table-section {
        display: block;
    }

    .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .table-header h2 {
        font-size: 1.125rem;
        font-weight: 600;
    }

    .refresh-indicator {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .refresh-indicator.active {
        color: #34c759;
    }

    .table-container {
        overflow-x: auto;
        border-radius: 12px;
        border: 1px solid var(--color-separator, #e5e5ea);
    }

    .opportunity-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
    }

    .opportunity-table th {
        padding: 0.75rem 1rem;
        text-align: left;
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--color-text-secondary, #636366);
        background: var(--color-bg-secondary, #f8f9fa);
        border-bottom: 1px solid var(--color-separator, #e5e5ea);
    }

    .opportunity-table th.sortable {
        cursor: pointer;
        user-select: none;
    }

    .opportunity-table th.sortable:hover {
        background: var(--color-bg-tertiary, #f0f0f5);
        color: var(--color-primary, #007aff);
    }

    .opportunity-table th.numeric {
        text-align: right;
    }

    .opportunity-table td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--color-separator, #e5e5ea);
        vertical-align: middle;
    }

    .opportunity-table tr:last-child td {
        border-bottom: none;
    }

    .opportunity-table tr:hover {
        background: var(--color-bg-tertiary, #f0f0f5);
    }

    .opportunity-table tr.positive {
        background: #34c75908;
    }

    .opportunity-table tr.negative {
        background: #ff3b3008;
    }

    .data-age {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .data-age.stale {
        color: #ff9500;
    }

    .coin {
        font-weight: 700;
    }

    .case-badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
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

    .source.buy {
        color: #34c759;
    }

    .source.sell {
        color: #ff3b30;
    }

    .numeric {
        text-align: right;
        font-family: "SF Mono", "Menlo", monospace;
    }

    .price {
        font-size: 0.8125rem;
    }

    .fx {
        color: var(--color-text-tertiary, #8e8e93);
    }

    .profit.positive,
    .percent.positive {
        color: #34c759;
        font-weight: 600;
    }

    .profit.negative,
    .percent.negative {
        color: #ff3b30;
        font-weight: 600;
    }

    .signal-good {
        font-size: 1rem;
    }

    .signal-ok {
        font-size: 1rem;
    }

    .signal-bad {
        font-size: 0.875rem;
    }

    .empty-state {
        padding: 3rem;
        text-align: center;
        color: var(--color-text-secondary, #636366);
    }

    /* Simulation Styles */
    .simulation-group {
        border-left: 2px solid #ff9500;
        padding-left: 1rem;
    }

    .simulation-input-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .simulation-input {
        width: 120px;
        font-family: "SF Mono", "Menlo", monospace;
    }

    .filter-select {
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--color-separator, #e5e5ea);
        font-size: 0.875rem;
        background: white;
        cursor: pointer;
    }

    .sim-profit {
        background: #ff950010;
    }

    .sim-profit-value {
        font-weight: 700;
        font-size: 0.875rem;
    }

    .sim-profit-value.positive {
        color: #34c759;
    }

    .sim-profit-value.negative {
        color: #ff3b30;
    }

    /* Cards Section (Mobile) */
    .cards-section {
        display: none;
        gap: 1rem;
    }

    @media (max-width: 768px) {
        .table-section {
            display: none;
        }

        .cards-section {
            display: grid;
            grid-template-columns: 1fr;
        }

        .kpi-section {
            grid-template-columns: 1fr 1fr;
        }

        .filters-section {
            flex-direction: column;
        }
    }

    @media (max-width: 480px) {
        .kpi-section {
            grid-template-columns: 1fr;
        }
    }
</style>
