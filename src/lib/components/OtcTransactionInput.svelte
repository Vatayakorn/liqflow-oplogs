<script lang="ts">
    /**
     * OTC Transaction Input Component
     * Add/remove OTC customer transactions
     */
    import { createEventDispatcher } from "svelte";
    import {
        OTC_SOURCES,
        OTC_ACTIONS,
        type OtcTransaction,
    } from "$lib/config/tradingConfig";

    export let transactions: OtcTransaction[] = [];
    export let disabled = false;

    const dispatch = createEventDispatcher<{ change: OtcTransaction[] }>();

    // New transaction form state
    let source = "BTZ";
    let customerName = "";
    let action: "BUY" | "SELL" = "BUY";
    let amount = "";
    let currency: "USDT" | "USDC" | "THB" = "USDT";
    let rate = "";
    let showForm = false;

    function addTransaction() {
        if (!customerName || !amount || !rate) return;

        const newTx: OtcTransaction = {
            id: crypto.randomUUID(),
            source: source as OtcTransaction["source"],
            customerName,
            action,
            amount: parseFloat(amount),
            currency,
            rate: parseFloat(rate),
            timestamp: new Date().toISOString(),
        };

        // Add new transaction to the top of the list
        transactions = [newTx, ...transactions];
        dispatch("change", transactions);
        resetForm();
    }

    function removeTransaction(id: string) {
        transactions = transactions.filter((t) => t.id !== id);
        dispatch("change", transactions);
    }

    function resetForm() {
        customerName = "";
        amount = "";
        rate = "";
        showForm = false;
    }

    function formatAmount(amt: number): string {
        if (amt >= 1000000) return `${(amt / 1000000).toFixed(1)}M`;
        if (amt >= 1000) return `${(amt / 1000).toFixed(0)}K`;
        return amt.toLocaleString();
    }

    function formatDate(dateStr?: string): string {
        if (!dateStr) return "";
        const date = new Date(dateStr);

        const month = date.toLocaleString("en-US", { month: "long" });
        const day = date.getDate();
        const year = date.getFullYear();
        const time = date.toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        // Add suffix to day (st, nd, rd, th)
        const suffix = (day: number) => {
            if (day > 3 && day < 21) return "th";
            switch (day % 10) {
                case 1:
                    return "st";
                case 2:
                    return "nd";
                case 3:
                    return "rd";
                default:
                    return "th";
            }
        };

        return `${month} ${day}${suffix(day)}, ${year} ${time}`;
    }
</script>

<div class="otc-input" id="otc-transaction-container">
    {#if transactions.length > 0}
        <div class="transaction-list">
            {#each transactions as tx (tx.id)}
                <div
                    class="transaction-item"
                    class:buy={tx.action === "BUY"}
                    class:sell={tx.action === "SELL"}
                    id="tx-{tx.id}"
                >
                    <div class="tx-main">
                        <div class="tx-top-row">
                            <span class="tx-source">{tx.source}</span>
                            <span class="tx-timestamp"
                                >{formatDate(tx.timestamp)}</span
                            >
                        </div>
                        <div class="tx-content-row">
                            <span class="tx-customer">{tx.customerName}</span>
                            <span
                                class="tx-action"
                                class:buy={tx.action === "BUY"}
                                class:sell={tx.action === "SELL"}
                            >
                                {tx.action}
                            </span>
                            <span class="tx-amount"
                                >{formatAmount(tx.amount)} {tx.currency}</span
                            >
                            <span class="tx-rate">@{tx.rate}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="remove-btn"
                        on:click={() => removeTransaction(tx.id)}
                        {disabled}
                        aria-label="Remove transaction"
                        title="Remove transaction"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    {#if showForm}
        <div class="add-form">
            <div class="form-row">
                <select bind:value={source} {disabled}>
                    {#each OTC_SOURCES as src}
                        <option value={src.value}>{src.label}</option>
                    {/each}
                </select>
                <input
                    type="text"
                    placeholder="Customer Name"
                    bind:value={customerName}
                    {disabled}
                />
            </div>

            <div class="form-row">
                <div class="action-toggle">
                    {#each OTC_ACTIONS as act}
                        <button
                            type="button"
                            class="action-btn"
                            class:active={action === act.value}
                            class:buy={act.value === "BUY"}
                            class:sell={act.value === "SELL"}
                            on:click={() => (action = act.value)}
                            {disabled}
                        >
                            {act.label}
                        </button>
                    {/each}
                </div>
            </div>

            <div class="form-row">
                <input
                    type="number"
                    placeholder="Amount"
                    bind:value={amount}
                    {disabled}
                />
                <select bind:value={currency} {disabled}>
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                    <option value="THB">THB</option>
                </select>
                <input
                    type="number"
                    step="0.001"
                    placeholder="Rate"
                    bind:value={rate}
                    {disabled}
                />
            </div>

            <div class="form-actions">
                <button
                    type="button"
                    class="cancel-btn"
                    on:click={resetForm}
                    {disabled}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="confirm-btn"
                    on:click={addTransaction}
                    disabled={disabled || !customerName || !amount || !rate}
                >
                    Add Transaction
                </button>
            </div>
        </div>
    {:else}
        <button
            type="button"
            class="add-trigger"
            on:click={() => (showForm = true)}
            {disabled}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Add OTC Transaction</span>
        </button>
    {/if}
</div>

<style>
    .otc-input {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .transaction-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .transaction-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: var(--color-bg-secondary);
        border-radius: 10px;
        border-left: 3px solid var(--color-border);
    }

    .transaction-item.buy {
        border-left-color: var(--color-success);
    }

    .transaction-item.sell {
        border-left-color: var(--color-danger);
    }

    .tx-main {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
    }

    .tx-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        margin-bottom: 0.125rem;
    }

    .tx-content-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .tx-timestamp {
        font-size: 11px;
        color: var(--color-text-tertiary);
        font-weight: 500;
        letter-spacing: -0.01em;
    }

    .tx-source {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        background: var(--color-bg-tertiary);
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
    }

    .tx-customer {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
    }

    .tx-action {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        text-transform: uppercase;
    }

    .tx-action.buy {
        color: var(--color-success);
        background: rgba(52, 199, 89, 0.15);
    }

    .tx-action.sell {
        color: var(--color-danger);
        background: rgba(255, 59, 48, 0.15);
    }

    .tx-amount {
        font-family: var(--font-family-heading);
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .tx-rate {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
    }

    .remove-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--color-text-tertiary);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .remove-btn:hover {
        color: var(--color-danger);
        background: rgba(255, 59, 48, 0.1);
    }

    .remove-btn svg {
        width: 14px;
        height: 14px;
    }

    .add-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        background: var(--color-bg-secondary);
        border-radius: 12px;
    }

    .form-row {
        display: flex;
        gap: 0.5rem;
    }

    .form-row select,
    .form-row input {
        flex: 1;
        padding: 0.625rem 0.75rem;
        font-family: var(--font-family-sans);
        font-size: 0.875rem;
        color: var(--color-text);
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 8px;
    }

    .action-toggle {
        display: flex;
        gap: 0.5rem;
        width: 100%;
    }

    .action-btn {
        flex: 1;
        padding: 0.625rem;
        font-size: 0.875rem;
        font-weight: 600;
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .action-btn.buy.active {
        color: white;
        background: var(--color-success);
        border-color: var(--color-success);
    }

    .action-btn.sell.active {
        color: white;
        background: var(--color-danger);
        border-color: var(--color-danger);
    }

    .form-actions {
        display: flex;
        gap: 0.5rem;
        padding-top: 0.5rem;
    }

    .cancel-btn,
    .confirm-btn {
        flex: 1;
        padding: 0.75rem;
        font-size: 0.875rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .cancel-btn {
        color: var(--color-text-secondary);
        background: var(--color-bg);
        border: 1px solid var(--color-border);
    }

    .confirm-btn {
        color: white;
        background: var(--color-primary);
        border: none;
    }

    .confirm-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .add-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-primary);
        background: rgba(0, 122, 255, 0.08);
        border: 1px dashed var(--color-primary);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .add-trigger:hover {
        background: rgba(0, 122, 255, 0.12);
    }

    .add-trigger svg {
        width: 1rem;
        height: 1rem;
    }
</style>
