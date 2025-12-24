<script lang="ts">
    import { onMount } from "svelte";
    import {
        getPayoutSummary,
        listSpreadRecords,
        type PayoutSummary,
        type SpreadRecord,
    } from "$lib/api/spreadTrackingApi";

    export let dateFrom: string = "";
    export let dateTo: string = "";

    let summary: PayoutSummary[] = [];
    let recentRecords: SpreadRecord[] = [];
    let loading = true;
    let error: string | null = null;

    $: totalPayout = summary.reduce((sum, s) => sum + s.total_payout, 0);
    $: totalProfit = summary.reduce((sum, s) => sum + s.total_net_profit, 0);
    $: totalVolume = summary.reduce((sum, s) => sum + s.total_volume, 0);
    $: totalTx = summary.reduce((sum, s) => sum + s.total_transactions, 0);

    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        loading = true;
        error = null;
        try {
            const filters = {
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            };
            summary = await getPayoutSummary(filters);
            recentRecords = await listSpreadRecords({ ...filters, limit: 20 });
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load summary";
        } finally {
            loading = false;
        }
    }

    function exportCSV() {
        const headers = [
            "Referrer",
            "Transactions",
            "Volume (USDT)",
            "Net Profit (THB)",
            "Payout (THB)",
        ];
        const rows = summary.map((s) => [
            s.referrer_name,
            s.total_transactions,
            s.total_volume.toFixed(2),
            s.total_net_profit.toFixed(2),
            s.total_payout.toFixed(2),
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
            "\n",
        );

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payout-summary-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Reload when date filters change
    $: if (dateFrom || dateTo) {
        loadData();
    }
</script>

<div class="payout-summary">
    <div class="header">
        <h3>💵 Payout Summary</h3>
        <button
            class="btn-export"
            on:click={exportCSV}
            disabled={summary.length === 0}
        >
            📥 Export CSV
        </button>
    </div>

    {#if error}
        <div class="error-banner">{error}</div>
    {/if}

    <div class="filters">
        <div class="filter-group">
            <label for="date-from">From:</label>
            <input id="date-from" type="date" bind:value={dateFrom} />
        </div>
        <div class="filter-group">
            <label for="date-to">To:</label>
            <input id="date-to" type="date" bind:value={dateTo} />
        </div>
        <button class="btn-refresh" on:click={loadData}>🔄</button>
    </div>

    {#if loading}
        <div class="loading">กำลังโหลด...</div>
    {:else}
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-label">Total Transactions</span>
                <span class="stat-value">{totalTx.toLocaleString()}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Total Volume</span>
                <span class="stat-value"
                    >{totalVolume.toLocaleString()} USDT</span
                >
            </div>
            <div class="stat-card">
                <span class="stat-label">Total Net Profit</span>
                <span class="stat-value profit"
                    >{totalProfit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })} ฿</span
                >
            </div>
            <div class="stat-card highlight">
                <span class="stat-label">Total Payout</span>
                <span class="stat-value payout"
                    >{totalPayout.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })} ฿</span
                >
            </div>
        </div>

        {#if summary.length === 0}
            <div class="empty-state">ยังไม่มีข้อมูล spread records</div>
        {:else}
            <div class="summary-section">
                <h4>📋 By Referrer</h4>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Referrer</th>
                            <th>Transactions</th>
                            <th>Volume</th>
                            <th>Net Profit</th>
                            <th>Payout</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each summary as item}
                            <tr>
                                <td class="referrer">{item.referrer_name}</td>
                                <td>{item.total_transactions}</td>
                                <td
                                    >{item.total_volume.toLocaleString()} USDT</td
                                >
                                <td class="profit"
                                    >{item.total_net_profit.toLocaleString(
                                        undefined,
                                        { minimumFractionDigits: 2 },
                                    )} ฿</td
                                >
                                <td class="payout"
                                    >{item.total_payout.toLocaleString(
                                        undefined,
                                        { minimumFractionDigits: 2 },
                                    )} ฿</td
                                >
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <div class="records-section">
                <h4>📜 Recent Records (Last 20)</h4>
                <div class="records-list">
                    {#each recentRecords as record}
                        <div class="record-item">
                            <div class="record-header">
                                <span class="customer"
                                    >{record.customer_name}</span
                                >
                                <span
                                    class="action"
                                    class:buy={record.action === "BUY"}
                                    class:sell={record.action === "SELL"}
                                >
                                    {record.action}
                                </span>
                                <span class="amount"
                                    >{record.amount.toLocaleString()} USDT</span
                                >
                            </div>
                            <div class="record-details">
                                <span
                                    >Referrer: <strong
                                        >{record.referrer_name}</strong
                                    ></span
                                >
                                <span
                                    >Spread: {record.real_spread.toFixed(
                                        3,
                                    )}</span
                                >
                                <span class="payout"
                                    >Payout: {record.referrer_payout.toLocaleString(
                                        undefined,
                                        { minimumFractionDigits: 2 },
                                    )} ฿</span
                                >
                            </div>
                            <div class="record-date">
                                {new Date(record.created_at).toLocaleString(
                                    "th-TH",
                                )}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .payout-summary {
        background: var(--color-bg);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        border: 1px solid var(--color-border-light);
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .header h3 {
        margin: 0;
        font-size: 1rem;
        font-family: var(--font-family-heading);
        color: var(--color-text);
    }

    .btn-export {
        background: var(--color-primary);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 500;
    }

    .btn-export:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .filters {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }

    .filter-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .filter-group label {
        color: var(--color-text-tertiary);
        font-size: 0.85rem;
    }

    .filter-group input {
        padding: 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-bg);
        color: var(--color-text);
    }

    .filter-group input:focus {
        outline: none;
        border-color: var(--color-primary);
    }

    .btn-refresh {
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        padding: 0.5rem;
        border-radius: 6px;
        cursor: pointer;
    }

    .btn-refresh:hover {
        background: var(--color-border-light);
    }

    .error-banner {
        background: rgba(255, 59, 48, 0.1);
        color: var(--color-danger);
        padding: 0.75rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        border: 1px solid rgba(255, 59, 48, 0.2);
    }

    .loading,
    .empty-state {
        text-align: center;
        padding: 2rem;
        color: var(--color-text-tertiary);
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    @media (max-width: 768px) {
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    .stat-card {
        background: var(--color-bg-tertiary);
        border-radius: 12px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .stat-card.highlight {
        background: linear-gradient(
            135deg,
            rgba(52, 199, 89, 0.1),
            rgba(52, 199, 89, 0.15)
        );
        border: 1px solid rgba(52, 199, 89, 0.2);
    }

    .stat-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .stat-value {
        font-size: 1.25rem;
        font-weight: 600;
        font-family: "SF Mono", monospace;
        color: var(--color-text);
    }

    .stat-value.profit {
        color: var(--color-primary);
    }
    .stat-value.payout {
        color: var(--color-success);
    }

    .summary-section,
    .records-section {
        margin-top: 1.5rem;
    }

    .summary-section h4,
    .records-section h4 {
        margin: 0 0 1rem 0;
        font-size: 0.9rem;
        font-family: var(--font-family-heading);
        color: var(--color-text);
    }

    .summary-table {
        width: 100%;
        border-collapse: collapse;
    }

    .summary-table th,
    .summary-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border-light);
    }

    .summary-table th {
        color: var(--color-text-tertiary);
        font-weight: 500;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .referrer {
        font-weight: 600;
        color: var(--color-text);
    }
    .profit {
        color: var(--color-primary);
    }
    .payout {
        color: var(--color-success);
        font-weight: 600;
    }

    .records-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-height: 400px;
        overflow-y: auto;
    }

    .record-item {
        background: var(--color-bg-tertiary);
        border-radius: 10px;
        padding: 0.75rem;
    }

    .record-header {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .record-header .customer {
        font-weight: 600;
        flex: 1;
        color: var(--color-text);
    }

    .record-header .action {
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-weight: 500;
    }

    .action.buy {
        background: rgba(52, 199, 89, 0.15);
        color: var(--color-success);
    }
    .action.sell {
        background: rgba(255, 59, 48, 0.15);
        color: var(--color-danger);
    }

    .record-header .amount {
        font-family: "SF Mono", monospace;
        color: var(--color-text-secondary);
    }

    .record-details {
        display: flex;
        gap: 1rem;
        font-size: 0.8rem;
        color: var(--color-text-tertiary);
        flex-wrap: wrap;
    }

    .record-details .payout {
        color: var(--color-success);
        font-weight: 500;
    }

    .record-date {
        font-size: 0.7rem;
        color: var(--color-text-tertiary);
        margin-top: 0.5rem;
    }
</style>
