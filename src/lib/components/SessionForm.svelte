<script lang="ts">
    /**
     * Session Form Component (Redesigned)
     * Structured form for trading operation logs
     */
    import { createEventDispatcher } from "svelte";
    import CollapsibleSection from "./CollapsibleSection.svelte";
    import OtcTransactionInput from "./OtcTransactionInput.svelte";
    import PrefundTracker from "./PrefundTracker.svelte";
    import DictationButton from "./DictationButton.svelte";
    import ImageUpload from "./ImageUpload.svelte";
    import { addMinutes } from "$lib/config/timePresets";
    import {
        EXCHANGES,
        TRADING_STATUS,
        PREFUND_DEFAULTS,
        TEAM_MEMBERS,
        type OtcTransaction,
        type TradingStatus,
    } from "$lib/config/tradingConfig";
    import {
        fetchMaxbitPrice,
        fetchBitkubOrderBook,
        fetchBinanceTHOrderBook,
        calculatePriceDiff,
    } from "$lib/api/marketData";

    export let disabled = false;

    const dispatch = createEventDispatcher();

    // === Time Slot ===
    let startTime = "";
    let endTime = "";

    // === Team ===
    let broker = "";
    let trader = "";
    let head = "";
    let recorder = ""; // ผู้จดบันทึก

    // === FX ===
    let fxRate = "";
    let fxNotes = "";

    // === Broker (BTZ) ===
    let btzBid = "";
    let btzAsk = "";
    let btzStatus: TradingStatus = "can_trade";
    let btzNotes = "";
    let isFetchingBroker = false;

    // === Exchange ===
    let exchange1 = "BTH";
    let exchange1Bid = "";
    let exchange1Ask = "";
    let exchange2 = "BinanceTH";
    let exchange2Bid = "";
    let exchange2Ask = "";
    let exchangeDiff = "";
    let exchangeHigher = "";
    let exchangeNotes = "";
    let isFetchingExchange = false;

    // === OTC ===
    let otcTransactions: OtcTransaction[] = [];
    let prefundCurrent = 0;
    let prefundTarget = PREFUND_DEFAULTS.target;
    let matchingNotes = "";
    let otcNotes = "";

    // === General ===
    let generalNotes = "";
    let images: File[] = [];

    let isSubmitting = false;

    // Auto-fill end time
    $: if (startTime && !endTime) {
        endTime = addMinutes(startTime, 30);
    }

    // Auto-fetch broker prices
    async function fetchBrokerPrices() {
        isFetchingBroker = true;
        try {
            const data = await fetchMaxbitPrice();
            btzBid = data.bid.toFixed(3);
            btzAsk = data.ask.toFixed(3);
        } catch (error) {
            console.error("Failed to fetch broker prices:", error);
        } finally {
            isFetchingBroker = false;
        }
    }

    // Auto-fetch exchange order books
    async function fetchExchangePrices() {
        isFetchingExchange = true;
        try {
            const [bitkub, binanceTH] = await Promise.all([
                fetchBitkubOrderBook(),
                fetchBinanceTHOrderBook(),
            ]);

            if (bitkub) {
                exchange1Bid = bitkub.bestBid.toFixed(2);
                exchange1Ask = bitkub.bestAsk.toFixed(2);
            }
            if (binanceTH) {
                exchange2Bid = binanceTH.bestBid.toFixed(2);
                exchange2Ask = binanceTH.bestAsk.toFixed(2);
            }

            // Calculate difference
            if (bitkub && binanceTH) {
                const diff = calculatePriceDiff(
                    bitkub.bestBid,
                    binanceTH.bestBid,
                    "Bitkub",
                    "BinanceTH",
                );
                exchangeDiff = diff.diff;
                exchangeHigher = diff.higher || "";
            }
        } catch (error) {
            console.error("Failed to fetch exchange prices:", error);
        } finally {
            isFetchingExchange = false;
        }
    }

    function handleDictation(event: CustomEvent<string>) {
        generalNotes += (generalNotes ? " " : "") + event.detail;
    }

    function handleOtcChange(event: CustomEvent<OtcTransaction[]>) {
        otcTransactions = event.detail;
    }

    function handleImageChange(event: CustomEvent<File[]>) {
        images = event.detail;
    }

    async function handleSubmit() {
        if (!startTime || !broker || !trader || !head) return;

        isSubmitting = true;

        dispatch("submit", {
            // Time
            start_time: startTime,
            end_time: endTime,
            // Team
            broker,
            trader,
            head,
            recorder,
            // FX
            fx_rate: fxRate,
            fx_notes: fxNotes,
            // Broker
            btz_bid: btzBid ? parseFloat(btzBid) : null,
            btz_ask: btzAsk ? parseFloat(btzAsk) : null,
            btz_status: btzStatus,
            btz_notes: btzNotes,
            // Exchange
            exchange1,
            exchange1_price:
                exchange1Bid && exchange1Ask
                    ? `${exchange1Bid}/${exchange1Ask}`
                    : "",
            exchange2,
            exchange2_price:
                exchange2Bid && exchange2Ask
                    ? `${exchange2Bid}/${exchange2Ask}`
                    : "",
            exchange_diff: exchangeDiff,
            exchange_higher: exchangeHigher,
            exchange_notes: exchangeNotes,
            // OTC
            otc_transactions: otcTransactions,
            prefund_current: prefundCurrent,
            prefund_target: prefundTarget,
            matching_notes: matchingNotes,
            otc_notes: otcNotes,
            // General
            note: generalNotes,
            images,
        });

        isSubmitting = false;
    }

    export function reset() {
        startTime = "";
        endTime = "";
        broker = "";
        trader = "";
        head = "";
        recorder = "";
        fxRate = "";
        fxNotes = "";
        btzBid = "";
        btzAsk = "";
        btzStatus = "can_trade";
        btzNotes = "";
        exchange1Bid = "";
        exchange1Ask = "";
        exchange2Bid = "";
        exchange2Ask = "";
        exchangeDiff = "";
        exchangeHigher = "";
        exchangeNotes = "";
        otcTransactions = [];
        prefundCurrent = 0;
        matchingNotes = "";
        otcNotes = "";
        generalNotes = "";
        images = [];
    }
</script>

<form class="session-form" on:submit|preventDefault={handleSubmit}>
    <!-- Time Slot -->
    <div class="form-card">
        <div class="card-header">
            <span class="card-icon">⏰</span>
            <span class="card-title">Time Slot</span>
        </div>
        <div class="time-row">
            <div class="field">
                <label for="start-time">Start *</label>
                <input
                    id="start-time"
                    type="time"
                    bind:value={startTime}
                    required
                    disabled={disabled || isSubmitting}
                />
            </div>
            <span class="time-separator">–</span>
            <div class="field">
                <label for="end-time">End</label>
                <input
                    id="end-time"
                    type="time"
                    bind:value={endTime}
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
    </div>

    <!-- Team -->
    <div class="form-card">
        <div class="card-header">
            <span class="card-icon">👥</span>
            <span class="card-title">Team</span>
        </div>
        <div class="team-grid">
            <div class="field">
                <label for="broker">Broker *</label>
                <select
                    id="broker"
                    bind:value={broker}
                    required
                    disabled={disabled || isSubmitting}
                >
                    <option value="">-- Select --</option>
                    {#each TEAM_MEMBERS as member}
                        <option value={member.value}>{member.label}</option>
                    {/each}
                </select>
            </div>
            <div class="field">
                <label for="trader">Trader *</label>
                <select
                    id="trader"
                    bind:value={trader}
                    required
                    disabled={disabled || isSubmitting}
                >
                    <option value="">-- Select --</option>
                    {#each TEAM_MEMBERS as member}
                        <option value={member.value}>{member.label}</option>
                    {/each}
                </select>
            </div>
            <div class="field">
                <label for="head">Head *</label>
                <select
                    id="head"
                    bind:value={head}
                    required
                    disabled={disabled || isSubmitting}
                >
                    <option value="">-- Select --</option>
                    {#each TEAM_MEMBERS as member}
                        <option value={member.value}>{member.label}</option>
                    {/each}
                </select>
            </div>
            <div class="field">
                <label for="recorder">ผู้จดบันทึก</label>
                <select
                    id="recorder"
                    bind:value={recorder}
                    disabled={disabled || isSubmitting}
                >
                    <option value="">-- Select --</option>
                    {#each TEAM_MEMBERS as member}
                        <option value={member.value}>{member.label}</option>
                    {/each}
                </select>
            </div>
        </div>
    </div>

    <!-- FX Section -->
    <CollapsibleSection title="FX (Spot Rate)" icon="📊">
        <div class="field">
            <label>Spot Rate</label>
            <input
                type="text"
                bind:value={fxRate}
                placeholder="31.510"
                disabled={disabled || isSubmitting}
            />
        </div>
        <div class="field">
            <label>Notes</label>
            <textarea
                bind:value={fxNotes}
                placeholder="FX trend, observations..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>
    </CollapsibleSection>

    <!-- Broker Section -->
    <CollapsibleSection title="Broker (BTZ)" icon="🏦">
        <div class="section-action">
            <button
                type="button"
                class="fetch-btn"
                on:click={fetchBrokerPrices}
                disabled={disabled || isSubmitting || isFetchingBroker}
            >
                {#if isFetchingBroker}
                    ⏳ Loading...
                {:else}
                    🔄 Fetch Prices
                {/if}
            </button>
        </div>
        <div class="bid-ask-row">
            <div class="field">
                <label>BID</label>
                <input
                    type="number"
                    step="0.001"
                    bind:value={btzBid}
                    placeholder="31.471"
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label>ASK</label>
                <input
                    type="number"
                    step="0.001"
                    bind:value={btzAsk}
                    placeholder="31.523"
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
        <div class="status-toggle">
            {#each TRADING_STATUS as status}
                <button
                    type="button"
                    class="status-btn"
                    class:active={btzStatus === status.value}
                    on:click={() => (btzStatus = status.value)}
                    disabled={disabled || isSubmitting}
                >
                    <span class="status-icon">{status.icon}</span>
                    <span class="status-label">{status.label}</span>
                </button>
            {/each}
        </div>
        <div class="field">
            <label>Notes</label>
            <textarea
                bind:value={btzNotes}
                placeholder="Broker conditions..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>
    </CollapsibleSection>

    <!-- Exchange Section -->
    <CollapsibleSection title="Exchange (Order Book)" icon="📈">
        <div class="section-action">
            <button
                type="button"
                class="fetch-btn"
                on:click={fetchExchangePrices}
                disabled={disabled || isSubmitting || isFetchingExchange}
            >
                {#if isFetchingExchange}
                    ⏳ Loading...
                {:else}
                    🔄 Fetch Order Book
                {/if}
            </button>
        </div>
        <div class="exchange-comparison">
            <div class="exchange-block">
                <div class="exchange-label">Bitkub</div>
                <div class="price-inputs">
                    <input
                        type="number"
                        step="0.01"
                        bind:value={exchange1Bid}
                        placeholder="Bid"
                        disabled={disabled || isSubmitting}
                    />
                    <span>/</span>
                    <input
                        type="number"
                        step="0.01"
                        bind:value={exchange1Ask}
                        placeholder="Ask"
                        disabled={disabled || isSubmitting}
                    />
                </div>
            </div>
            <div class="vs-label">vs</div>
            <div class="exchange-block">
                <div class="exchange-label">BinanceTH</div>
                <div class="price-inputs">
                    <input
                        type="number"
                        step="0.01"
                        bind:value={exchange2Bid}
                        placeholder="Bid"
                        disabled={disabled || isSubmitting}
                    />
                    <span>/</span>
                    <input
                        type="number"
                        step="0.01"
                        bind:value={exchange2Ask}
                        placeholder="Ask"
                        disabled={disabled || isSubmitting}
                    />
                </div>
            </div>
        </div>
        <div class="diff-row">
            <div class="field" style="flex: 1;">
                <label>Difference</label>
                <input
                    type="text"
                    bind:value={exchangeDiff}
                    placeholder="0.01"
                    disabled={disabled || isSubmitting}
                />
            </div>
            {#if exchangeHigher}
                <div
                    class="higher-badge"
                    class:bitkub={exchangeHigher === "Bitkub"}
                    class:binance={exchangeHigher === "BinanceTH"}
                >
                    ▲ {exchangeHigher}
                </div>
            {/if}
        </div>
        <div class="field">
            <label>Notes</label>
            <textarea
                bind:value={exchangeNotes}
                placeholder="Order book observations..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>
    </CollapsibleSection>

    <!-- OTC Section -->
    <CollapsibleSection
        title="OTC Transactions"
        icon="💰"
        badge={otcTransactions.length || null}
    >
        <OtcTransactionInput
            bind:transactions={otcTransactions}
            on:change={handleOtcChange}
            disabled={disabled || isSubmitting}
        />

        <div class="prefund-section">
            <div class="prefund-inputs">
                <div class="field">
                    <label>Current Prefund</label>
                    <input
                        type="number"
                        bind:value={prefundCurrent}
                        placeholder="520000"
                        disabled={disabled || isSubmitting}
                    />
                </div>
                <div class="field">
                    <label>Target</label>
                    <input
                        type="number"
                        bind:value={prefundTarget}
                        placeholder="760000"
                        disabled={disabled || isSubmitting}
                    />
                </div>
            </div>
            <PrefundTracker current={prefundCurrent} target={prefundTarget} />
        </div>

        <div class="field">
            <label>Matching Status</label>
            <textarea
                bind:value={matchingNotes}
                placeholder="Best BID/ASK matching..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>
        <div class="field">
            <label>OTC Notes</label>
            <textarea
                bind:value={otcNotes}
                placeholder="OTC observations..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>
    </CollapsibleSection>

    <!-- General Notes -->
    <div class="form-card">
        <div class="card-header">
            <span class="card-icon">📝</span>
            <span class="card-title">Notes</span>
        </div>
        <div class="note-section">
            <textarea
                bind:value={generalNotes}
                placeholder="General observations, summary..."
                rows="4"
                disabled={disabled || isSubmitting}
            ></textarea>
            <div class="dictation-row">
                <DictationButton
                    on:result={handleDictation}
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
    </div>

    <!-- Photos -->
    <div class="form-card">
        <div class="card-header">
            <span class="card-icon">🖼️</span>
            <span class="card-title">Photos</span>
            {#if images.length > 0}
                <span class="photo-count">{images.length}</span>
            {/if}
        </div>
        <ImageUpload
            bind:files={images}
            on:change={handleImageChange}
            disabled={disabled || isSubmitting}
        />
    </div>

    <!-- Submit -->
    <button
        type="submit"
        class="submit-btn"
        disabled={disabled ||
            isSubmitting ||
            !startTime ||
            !broker ||
            !trader ||
            !head}
    >
        {#if isSubmitting}
            <span class="spinner"></span>
            Saving...
        {:else}
            💾 Save Session
        {/if}
    </button>
</form>

<style>
    .session-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .form-card {
        background: var(--color-bg);
        border-radius: 16px;
        padding: 1.25rem;
        border: 1px solid var(--color-border-light);
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .card-icon {
        font-size: 1.125rem;
    }

    .card-title {
        font-family: var(--font-family-heading);
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .photo-count {
        margin-left: auto;
        padding: 0.125rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-primary);
        background: rgba(0, 122, 255, 0.1);
        border-radius: 100px;
    }

    .time-row {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
    }

    .time-row .field {
        flex: 1;
    }

    .time-separator {
        font-size: 1.25rem;
        color: var(--color-text-tertiary);
        padding-bottom: 0.75rem;
    }

    .team-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    @media (max-width: 480px) {
        .team-grid {
            grid-template-columns: 1fr;
        }
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .field label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .field input,
    .field textarea,
    .field select {
        padding: 0.75rem;
        font-family: var(--font-family-sans);
        font-size: 0.9375rem;
        color: var(--color-text);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        transition: all 0.15s;
    }

    .field input:focus,
    .field textarea:focus,
    .field select:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    .field textarea {
        resize: vertical;
        min-height: 60px;
    }

    .price-range-row,
    .bid-ask-row {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
    }

    .price-range-row .field,
    .bid-ask-row .field {
        flex: 1;
    }

    .range-separator {
        font-size: 1.25rem;
        color: var(--color-text-tertiary);
        padding-bottom: 0.75rem;
    }

    .status-toggle {
        display: flex;
        gap: 0.5rem;
    }

    .status-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.625rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .status-btn:hover {
        border-color: var(--color-border);
    }

    .status-btn.active {
        color: var(--color-text);
        background: var(--color-bg);
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.15);
    }

    .status-icon {
        font-size: 0.875rem;
    }

    .exchange-comparison {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .exchange-block {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .exchange-block select {
        padding: 0.5rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
    }

    .price-inputs {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .price-inputs input {
        flex: 1;
        padding: 0.5rem;
        font-size: 0.875rem;
        min-width: 0;
    }

    .price-inputs span {
        color: var(--color-text-tertiary);
    }

    .vs-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
    }

    @media (max-width: 480px) {
        .exchange-comparison {
            flex-direction: column;
        }

        .vs-label {
            display: none;
        }
    }

    .prefund-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .prefund-inputs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .note-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .dictation-row {
        display: flex;
        justify-content: flex-end;
    }

    .submit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1rem;
        font-family: var(--font-family-heading);
        font-size: 1rem;
        font-weight: 600;
        color: white;
        background: linear-gradient(135deg, #007aff, #5856d6);
        border: none;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
    }

    .submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(0, 122, 255, 0.3);
    }

    .submit-btn:active:not(:disabled) {
        transform: translateY(0);
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Fetch buttons */
    .section-action {
        margin-bottom: 0.75rem;
    }

    .fetch-btn {
        width: 100%;
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-primary);
        background: rgba(0, 122, 255, 0.08);
        border: 1px dashed var(--color-primary);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .fetch-btn:hover:not(:disabled) {
        background: rgba(0, 122, 255, 0.12);
    }

    .fetch-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* Exchange labels */
    .exchange-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text);
        padding: 0.375rem;
        background: var(--color-bg-tertiary);
        border-radius: 6px;
        text-align: center;
    }

    /* Diff row */
    .diff-row {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
    }

    .higher-badge {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 8px;
        white-space: nowrap;
    }

    .higher-badge.bitkub {
        color: #ff9500;
        background: rgba(255, 149, 0, 0.15);
    }

    .higher-badge.binance {
        color: #f0b90b;
        background: rgba(240, 185, 11, 0.15);
    }
</style>
