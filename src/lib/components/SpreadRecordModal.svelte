<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import {
        listReferrers,
        createSpreadRecord,
        calculateSpread,
        type ReferrerConfig,
        type CreateSpreadRecordPayload,
    } from "$lib/api/spreadTrackingApi";

    export let show = false;
    export let sessionId: string | null = null;
    export let transaction: {
        id: string;
        customerName: string;
        action: "BUY" | "SELL";
        amount: number;
        rate: number;
    } | null = null;
    export let exchangePrices: {
        bid: number;
        ask: number;
    } | null = null;

    const dispatch = createEventDispatcher<{ close: void; saved: void }>();

    let referrers: ReferrerConfig[] = [];
    let loading = true;
    let saving = false;
    let error: string | null = null;

    // Form state
    let selectedReferrer = "";
    let opSpread = "";
    let exchangeBid = 0;
    let exchangeAsk = 0;
    let customerRate = 0;
    let amount = 0;

    // Preview calculation
    $: preview =
        selectedReferrer && amount > 0 && exchangeBid > 0 && customerRate > 0
            ? calculatePreview()
            : null;

    onMount(async () => {
        await loadReferrers();
        // Pre-fill from transaction
        if (transaction) {
            customerRate = transaction.rate;
            amount = transaction.amount;
        }
        if (exchangePrices) {
            exchangeBid = exchangePrices.bid;
            exchangeAsk = exchangePrices.ask;
        }
    });

    async function loadReferrers() {
        loading = true;
        try {
            referrers = await listReferrers();
            referrers = referrers.filter((r) => r.is_active);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load referrers";
        } finally {
            loading = false;
        }
    }

    function calculatePreview() {
        const referrer = referrers.find(
            (r) => r.referrer_name === selectedReferrer,
        );
        if (!referrer || !transaction) return null;

        return calculateSpread({
            action: transaction.action,
            exchangeBid,
            exchangeAsk,
            customerRate,
            amount,
            bitazzaFee: referrer.bitazza_fee,
            profitShare: referrer.profit_share,
        });
    }

    async function handleSubmit() {
        if (!transaction || !selectedReferrer || !opSpread.trim()) return;

        saving = true;
        error = null;

        try {
            const payload: CreateSpreadRecordPayload = {
                session_id: sessionId || undefined,
                transaction_id: transaction.id,
                referrer_name: selectedReferrer,
                customer_name: transaction.customerName,
                action: transaction.action,
                amount,
                op_spread: opSpread.trim(),
                exchange_bid: exchangeBid,
                exchange_ask: exchangeAsk,
                customer_rate: customerRate,
            };

            await createSpreadRecord(payload);
            dispatch("saved");
            close();
        } catch (e) {
            error =
                e instanceof Error ? e.message : "Failed to save spread record";
        } finally {
            saving = false;
        }
    }

    function close() {
        dispatch("close");
    }
</script>

{#if show && transaction}
    <div
        class="modal-overlay"
        on:click={close}
        on:keydown={(e) => e.key === "Escape" && close()}
    >
        <div
            class="modal"
            on:click|stopPropagation
            role="dialog"
            aria-modal="true"
        >
            <div class="modal-header">
                <h3>💰 บันทึก Spread Record</h3>
                <button class="btn-close" on:click={close}>✕</button>
            </div>

            {#if error}
                <div class="error-banner">{error}</div>
            {/if}

            <div class="transaction-info">
                <div class="info-row">
                    <span class="label">Customer:</span>
                    <span class="value">{transaction.customerName}</span>
                </div>
                <div class="info-row">
                    <span class="label">Action:</span>
                    <span
                        class="value action"
                        class:buy={transaction.action === "BUY"}
                        class:sell={transaction.action === "SELL"}
                    >
                        {transaction.action}
                    </span>
                </div>
                <div class="info-row">
                    <span class="label">Amount:</span>
                    <span class="value"
                        >{transaction.amount.toLocaleString()} USDT</span
                    >
                </div>
            </div>

            <form on:submit|preventDefault={handleSubmit}>
                <div class="form-group">
                    <label for="referrer">ผู้แนะนำ</label>
                    {#if loading}
                        <select disabled><option>กำลังโหลด...</option></select>
                    {:else}
                        <select
                            id="referrer"
                            bind:value={selectedReferrer}
                            required
                        >
                            <option value="">-- เลือกผู้แนะนำ --</option>
                            {#each referrers as ref}
                                <option value={ref.referrer_name}>
                                    {ref.referrer_name} (Fee: {ref.bitazza_fee.toFixed(
                                        2,
                                    )})
                                </option>
                            {/each}
                        </select>
                    {/if}
                </div>

                <div class="form-group">
                    <label for="op-spread">Operation Spread (BID/ASK)</label>
                    <input
                        id="op-spread"
                        type="text"
                        bind:value={opSpread}
                        placeholder="เช่น 0.03/0.04"
                        required
                    />
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="exchange-bid"
                            >Exchange BID (Binance TH)</label
                        >
                        <input
                            id="exchange-bid"
                            type="number"
                            step="0.01"
                            bind:value={exchangeBid}
                            required
                        />
                    </div>
                    <div class="form-group">
                        <label for="exchange-ask">Exchange ASK</label>
                        <input
                            id="exchange-ask"
                            type="number"
                            step="0.01"
                            bind:value={exchangeAsk}
                            required
                        />
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="customer-rate">Customer Rate</label>
                        <input
                            id="customer-rate"
                            type="number"
                            step="0.01"
                            bind:value={customerRate}
                            required
                        />
                    </div>
                    <div class="form-group">
                        <label for="amount">Amount (USDT)</label>
                        <input
                            id="amount"
                            type="number"
                            step="1"
                            bind:value={amount}
                            required
                        />
                    </div>
                </div>

                {#if preview}
                    <div class="preview-box">
                        <h4>📊 Preview Calculation</h4>
                        <div class="preview-grid">
                            <div class="preview-item">
                                <span class="label">Real Spread</span>
                                <span class="value"
                                    >{preview.realSpread.toFixed(3)} ฿/USDT</span
                                >
                            </div>
                            <div class="preview-item">
                                <span class="label">Net Spread</span>
                                <span class="value"
                                    >{preview.netSpreadPerUnit.toFixed(3)} ฿/USDT</span
                                >
                            </div>
                            <div class="preview-item">
                                <span class="label">Net Profit</span>
                                <span class="value profit"
                                    >{preview.netProfit.toLocaleString(
                                        undefined,
                                        { minimumFractionDigits: 2 },
                                    )} ฿</span
                                >
                            </div>
                            <div class="preview-item highlight">
                                <span class="label">Referrer Payout</span>
                                <span class="value payout"
                                    >{preview.referrerPayout.toLocaleString(
                                        undefined,
                                        { minimumFractionDigits: 2 },
                                    )} ฿</span
                                >
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="form-actions">
                    <button
                        type="button"
                        class="btn-secondary"
                        on:click={close}
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        class="btn-primary"
                        disabled={saving ||
                            !selectedReferrer ||
                            !opSpread.trim()}
                    >
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: var(--color-bg);
        border-radius: 16px;
        padding: 1.5rem;
        width: 500px;
        max-width: 95vw;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .modal-header h3 {
        margin: 0;
        font-family: var(--font-family-heading);
        color: var(--color-text);
    }

    .btn-close {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        color: var(--color-text-tertiary);
        padding: 0.25rem;
    }

    .btn-close:hover {
        color: var(--color-text);
    }

    .error-banner {
        background: rgba(255, 59, 48, 0.1);
        color: var(--color-danger);
        padding: 0.75rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        border: 1px solid rgba(255, 59, 48, 0.2);
    }

    .transaction-info {
        background: var(--color-bg-tertiary);
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 1rem;
    }

    .info-row {
        display: flex;
        justify-content: space-between;
        padding: 0.25rem 0;
    }

    .info-row .label {
        color: var(--color-text-tertiary);
    }

    .info-row .value {
        font-weight: 500;
        color: var(--color-text);
    }

    .action.buy {
        color: var(--color-success);
    }
    .action.sell {
        color: var(--color-danger);
    }

    .form-group {
        margin-bottom: 1rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.85rem;
        color: var(--color-text-tertiary);
    }

    .form-group input,
    .form-group select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 1rem;
    }

    .form-group input:focus,
    .form-group select:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .preview-box {
        background: linear-gradient(
            135deg,
            rgba(0, 122, 255, 0.05),
            rgba(52, 199, 89, 0.05)
        );
        border: 1px solid rgba(0, 122, 255, 0.2);
        border-radius: 12px;
        padding: 1rem;
        margin: 1rem 0;
    }

    .preview-box h4 {
        margin: 0 0 0.75rem 0;
        font-size: 0.9rem;
        font-family: var(--font-family-heading);
        color: var(--color-text);
    }

    .preview-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .preview-item {
        display: flex;
        flex-direction: column;
    }

    .preview-item .label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .preview-item .value {
        font-weight: 600;
        font-family: "SF Mono", monospace;
        color: var(--color-text);
    }

    .preview-item.highlight {
        background: rgba(52, 199, 89, 0.1);
        padding: 0.5rem;
        border-radius: 8px;
    }

    .value.profit {
        color: var(--color-primary);
    }
    .value.payout {
        color: var(--color-success);
        font-size: 1.1rem;
    }

    .form-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
        margin-top: 1.5rem;
    }

    .btn-primary {
        background: var(--color-primary);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
    }

    .btn-primary:hover {
        opacity: 0.9;
    }
    .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: var(--color-bg-tertiary);
        color: var(--color-text);
        border: 1px solid var(--color-border);
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
    }

    @media (max-width: 640px) {
        .form-row {
            grid-template-columns: 1fr;
        }
    }
</style>
