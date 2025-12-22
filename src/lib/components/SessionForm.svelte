<script lang="ts">
    /**
     * Session Form Component (Redesigned)
     * Structured form for trading operation logs
     */
    import { createEventDispatcher, tick, onMount, onDestroy } from "svelte";
    import {
        marketFeed,
        bitkubLive,
        binanceTHLive,
        maxbitLive,
        fxLive,
        isConnected,
        lastUpdate,
    } from "$lib/stores/marketFeed";
    import CollapsibleSection from "./CollapsibleSection.svelte";
    import OtcTransactionInput from "./OtcTransactionInput.svelte";
    import PrefundTracker from "./PrefundTracker.svelte";
    import AudioRecorder from "./AudioRecorder.svelte";
    import ImageUpload from "./ImageUpload.svelte";
    import { addMinutes } from "$lib/config/timePresets";
    import {
        EXCHANGES,
        PREFUND_DEFAULTS,
        TEAM_MEMBERS,
        SHIFTS,
        type OtcTransaction,
    } from "$lib/config/tradingConfig";
    import {
        fetchMaxbitPrice,
        fetchBitkubOrderBook,
        fetchBinanceTHOrderBook,
        fetchFxRate,
        fetchAllMarketData, // Added
        calculatePriceDiff,
        type OrderBook,
    } from "$lib/api/marketData";
    import { fetchTodayOtcTransactions } from "$lib/api/otcApi";
    import { toast } from "$lib/stores/toast";

    export let disabled = false;

    const dispatch = createEventDispatcher();

    // === Time Slot ===
    let shift = ""; // A, B, C
    let startTime = "";
    let endTime = "";

    function handleShiftChange() {
        if (!shift) return;
        const selectedShift = SHIFTS.find((s) => s.value === shift);
        if (selectedShift) {
            startTime = selectedShift.start;
            endTime = selectedShift.end;
        }
    }

    // === Team ===
    let broker = "";
    let trader = "";
    let head = "";
    let recorder = ""; // ผู้จดบันทึก

    // === FX ===
    let fxRate = "";
    let fxNotes = "";
    let isFetchingFx = false;

    // === Broker (Maxbit) ===
    let btzBid = "";
    let btzAsk = "";
    let btzNotes = "";
    let isFetchingBroker = false;

    // === Exchange ===
    let exchange1 = "Bitkub";
    let exchange1Bid = "";
    let exchange1Ask = "";
    let exchange2 = "BinanceTH";
    let exchange2Bid = "";
    let exchange2Ask = "";
    let exchangeDiff = "";
    let exchangeHigher = "";
    let exchangeNotes = "";
    let isFetchingExchange = false;

    // Full order book data (5 levels)
    let bitkubBook: OrderBook | null = null;
    let binanceBook: OrderBook | null = null;

    // === OTC ===
    let otcTransactions: OtcTransaction[] = [];
    let fetchedOtcTransactions: OtcTransaction[] = []; // Transactions from API
    let filterType = "ALL"; // 'ALL', 'otc', 'commission'
    let searchQuery = "";

    // Scope Filter: Filter by Time Slot
    $: timeFilteredOtcTransactions = fetchedOtcTransactions.filter((tx) => {
        if (!startTime || !endTime || !tx.timestamp) return true;

        const txDate = new Date(tx.timestamp);
        const txMinutes = txDate.getHours() * 60 + txDate.getMinutes();

        const [startH, startM] = startTime.split(":").map(Number);
        const startMinutes = startH * 60 + startM;

        const [endH, endM] = endTime.split(":").map(Number);
        const endMinutes = endH * 60 + endM;

        if (startMinutes <= endMinutes) {
            return txMinutes >= startMinutes && txMinutes <= endMinutes;
        } else {
            // Cross-midnight (e.g., 22:00 - 07:00)
            return txMinutes >= startMinutes || txMinutes <= endMinutes;
        }
    });

    // View Filter: Search and Type
    $: filteredOtcTransactions = timeFilteredOtcTransactions.filter((tx) => {
        const typeMatch =
            filterType === "ALL" ||
            (filterType === "otc" && tx.txnType === "otc") ||
            (filterType === "commission" && tx.txnType === "commission");

        const searchMatch =
            tx.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tx.id.toLowerCase().includes(searchQuery.toLowerCase());

        return typeMatch && searchMatch;
    });

    let prefundCurrent = 0;
    let prefundTarget = PREFUND_DEFAULTS.target;
    let matchingNotes = "";
    let otcNotes = "";
    let isFetchingOtc = false;

    // === General ===
    // === General ===
    let generalNotes = "";
    let images: File[] = [];
    let audioFiles: { file: File; notes: string }[] = []; // Audio recordings with notes
    let orderBookContainer: HTMLElement;
    let isCapturing = false;

    // Fetch Timestamps
    let fxFetchTime = "";
    let brokerFetchTime = "";
    let exchangeFetchTime = "";

    onMount(() => {
        marketFeed.connect();
    });

    onDestroy(() => {
        marketFeed.disconnect();
    });

    // Reactive: Update UI when live data arrives
    $: if ($fxLive) {
        fxRate = $fxLive.rate.toFixed(3);
        fxFetchTime = getCurrentTimeStr();
    }

    $: if ($maxbitLive) {
        btzBid = $maxbitLive.bid.toFixed(3);
        btzAsk = $maxbitLive.ask.toFixed(3);
        brokerFetchTime = getCurrentTimeStr();
    }

    $: if ($bitkubLive) {
        bitkubBook = $bitkubLive;
        exchange1Bid = $bitkubLive.bestBid.toFixed(2);
        exchange1Ask = $bitkubLive.bestAsk.toFixed(2);
        updateExchangeDiff();
        exchangeFetchTime = getCurrentTimeStr();
    }

    $: if ($binanceTHLive) {
        binanceBook = $binanceTHLive;
        exchange2Bid = $binanceTHLive.bestBid.toFixed(2);
        exchange2Ask = $binanceTHLive.bestAsk.toFixed(2);
        updateExchangeDiff();
        exchangeFetchTime = getCurrentTimeStr();
    }

    function updateExchangeDiff() {
        if (bitkubBook && binanceBook) {
            const diff = calculatePriceDiff(
                bitkubBook.bestBid,
                binanceBook.bestBid,
                "Bitkub",
                "BinanceTH",
            );
            exchangeDiff = diff.diff;
            exchangeHigher = diff.higher || "";
        }
    }

    function getCurrentTimeStr() {
        return new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    async function snapshotExchangeUI() {
        if (!orderBookContainer) {
            toast.error("Order book not visible");
            return;
        }

        isCapturing = true;
        await tick(); // Wait for timestamp to show up in DOM

        try {
            // @ts-ignore
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(orderBookContainer, {
                backgroundColor: "#ffffff",
                scale: 2,
                logging: false,
                useCORS: true,
            });

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File(
                        [blob],
                        `exchange_snap_${Date.now()}.png`,
                        { type: "image/png" },
                    );
                    images = [...images, file];
                    toast.success("Snapshot captured and added to photos!");
                }
                isCapturing = false;
            }, "image/png");
        } catch (error) {
            console.error("Capture failed:", error);
            toast.error("Capture failed. Is order book loaded?");
            isCapturing = false;
        }
    }

    let isSubmitting = false;

    // Auto-fill end time (Only if shift is NOT selected, manual override)
    $: if (startTime && !endTime && !shift) {
        endTime = addMinutes(startTime, 30);
    }

    // Auto-fetch FX rate
    async function fetchFxRateData() {
        isFetchingFx = true;
        try {
            const data = await fetchFxRate();
            fxRate = data.rate.toFixed(3);
            fxFetchTime = getCurrentTimeStr();
        } catch (error) {
            console.error("Failed to fetch FX rate:", error);
        } finally {
            isFetchingFx = false;
        }
    }

    // Auto-fetch broker prices
    async function fetchBrokerPrices() {
        isFetchingBroker = true;
        try {
            const data = await fetchMaxbitPrice();
            btzBid = data.bid.toFixed(3);
            btzAsk = data.ask.toFixed(3);
            brokerFetchTime = getCurrentTimeStr();
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

            // Store full order books
            bitkubBook = bitkub;
            binanceBook = binanceTH;

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
            exchangeFetchTime = getCurrentTimeStr();
        } catch (error) {
            console.error("Failed to fetch exchange prices:", error);
        } finally {
            isFetchingExchange = false;
        }
    }

    function handleAudioChange(
        event: CustomEvent<{ file: File; notes: string }[]>,
    ) {
        audioFiles = event.detail;
    }

    async function handleTranscribe(event: CustomEvent<File>) {
        const audioFile = event.detail;
        if (!audioFile) return;

        try {
            const formData = new FormData();
            formData.append("file", audioFile);

            const timestamp = new Date().toLocaleTimeString();
            generalNotes +=
                (generalNotes ? "\n\n" : "") + `[Transcribing ${timestamp}...]`;

            const response = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Transcription failed");
            }

            const data = await response.json();
            const transcription = data.text;

            // Replace the "Transcribing..." placeholder or append real text
            generalNotes = generalNotes.replace(
                `[Transcribing ${timestamp}...]`,
                `[Transcribed at ${timestamp}]:\n${transcription}`,
            );
        } catch (error) {
            console.error("Transcription error:", error);
            alert(
                `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            const timestamp = new Date().toLocaleTimeString();
            generalNotes = generalNotes.replace(
                `[Transcribing ${timestamp}...]`,
                `[Transcription Failed at ${timestamp}]`,
            );
        }
    }

    function handleOtcChange(event: CustomEvent<OtcTransaction[]>) {
        otcTransactions = event.detail;
    }

    function handleImageChange(event: CustomEvent<File[]>) {
        images = event.detail;
    }

    // Fetch OTC transactions from API (midnight to now)
    async function fetchOtcTransactions() {
        isFetchingOtc = true;
        try {
            const transactions = await fetchTodayOtcTransactions();
            fetchedOtcTransactions = transactions;
            console.log("Fetched transactions:", transactions);
            if (transactions.length === 0) {
                alert(
                    "ไม่พบข้อมูลวันนี้ (0 รายการ) - กรุณาตรวจสอบ API Configuration ใน Console (F12)",
                );
            }
        } catch (error) {
            console.error("Failed to fetch OTC transactions:", error);
            alert(
                `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : error}`,
            );
        } finally {
            isFetchingOtc = false;
        }
    }

    // Format currency for display
    function formatCurrency(amount: number): string {
        if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
        return amount.toLocaleString();
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

    async function handleSubmit() {
        if (!startTime || !broker || !trader || !head) return;

        isSubmitting = true;

        try {
            // Fetch latest market context for the record
            const context = await fetchAllMarketData();
            const marketContext = {
                ...context,
                fxFetchTime,
                brokerFetchTime,
                exchangeFetchTime,
                snapTime: getCurrentTimeStr(),
            };

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
                otc_transactions: [
                    ...otcTransactions,
                    ...timeFilteredOtcTransactions,
                ],
                prefund_current: prefundCurrent,
                prefund_target: prefundTarget,
                matching_notes: matchingNotes,
                otc_notes: otcNotes,
                // General
                // General
                // General
                note: generalNotes,
                images,
                audio: audioFiles,
                // Context
                shift, // Pass shift explicitly
                market_context: marketContext,
            });
        } catch (error) {
            console.error("Error submitting form:", error);
            // Submit anyway without context if it fails?
            // Or show error. Since this is an enhancement, we probably shouldn't block saving if fetch fails explicitly,
            // but fetchAllMarketData already catches errors and returns partial nulls, so it should be fine.
        } finally {
            isSubmitting = false;
        }
    }

    export function reset() {
        shift = "";
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
        generalNotes = "";
        images = [];
        audioFiles = [];
        fxFetchTime = "";
        brokerFetchTime = "";
        exchangeFetchTime = "";
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
            <div class="field" style="max-width: 120px;">
                <label for="shift">Shift</label>
                <select
                    id="shift"
                    bind:value={shift}
                    on:change={handleShiftChange}
                    disabled={disabled || isSubmitting}
                >
                    <option value="">Manual</option>
                    {#each SHIFTS as s}
                        <option value={s.value}>{s.label}</option>
                    {/each}
                </select>
            </div>
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
        <div class="section-action">
            {#if $isConnected}
                <span class="live-badge">🟢 Live</span>
            {/if}
            {#if fxFetchTime}
                <span class="fetch-time">Drawn at: {fxFetchTime}</span>
            {/if}
            <button
                type="button"
                class="fetch-btn"
                on:click={fetchFxRateData}
                disabled={disabled || isSubmitting || isFetchingFx}
            >
                {#if isFetchingFx}
                    ⏳ Loading...
                {:else}
                    🔄 Fetch Rate
                {/if}
            </button>
        </div>
        <div class="field">
            <label>USD/THB Spot Rate</label>
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
    <CollapsibleSection title="Broker (Maxbit)" icon="🏦">
        <div class="section-action">
            {#if $isConnected}
                <span class="live-badge">🟢 Live</span>
            {/if}
            {#if brokerFetchTime}
                <span class="fetch-time">Drawn at: {brokerFetchTime}</span>
            {/if}
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
            <div class="action-group">
                {#if $isConnected}
                    <span class="live-badge">🟢 Live</span>
                {/if}
                {#if exchangeFetchTime}
                    <span class="fetch-time">Drawn at: {exchangeFetchTime}</span
                    >
                {/if}
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

                {#if bitkubBook || binanceBook}
                    <button
                        type="button"
                        class="snap-btn"
                        on:click={snapshotExchangeUI}
                        disabled={disabled || isCapturing}
                    >
                        {#if isCapturing}
                            ⏳ Snapping...
                        {:else}
                            📸 Snap UI
                        {/if}
                    </button>
                {/if}
            </div>
        </div>

        <!-- Order Book Tables -->
        {#if bitkubBook || binanceBook}
            <div class="order-book-container" bind:this={orderBookContainer}>
                {#if isCapturing}
                    <div class="snapshot-header">
                        <span class="app-name">Liqflow Order Book Snapshot</span
                        >
                        <span class="app-time"
                            >{new Date().toLocaleString("th-TH")}</span
                        >
                    </div>
                {/if}
                <!-- Bitkub Order Book -->
                <div class="order-book">
                    <div class="order-book-header bitkub">Bitkub</div>
                    <div class="order-book-columns">
                        <div class="order-book-column bids">
                            <div class="column-header">BID</div>
                            {#if bitkubBook}
                                {#each bitkubBook.bids.slice(0, 5) as bid, i}
                                    <div
                                        class="order-row bid"
                                        style="opacity: {1 - i * 0.15}"
                                    >
                                        <span class="price"
                                            >{bid.price.toFixed(2)}</span
                                        >
                                        <span class="amount"
                                            >{bid.amount.toLocaleString()}</span
                                        >
                                    </div>
                                {/each}
                            {/if}
                        </div>
                        <div class="order-book-column asks">
                            <div class="column-header">ASK</div>
                            {#if bitkubBook}
                                {#each bitkubBook.asks.slice(0, 5) as ask, i}
                                    <div
                                        class="order-row ask"
                                        style="opacity: {1 - i * 0.15}"
                                    >
                                        <span class="price"
                                            >{ask.price.toFixed(2)}</span
                                        >
                                        <span class="amount"
                                            >{ask.amount.toLocaleString()}</span
                                        >
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- BinanceTH Order Book -->
                <div class="order-book">
                    <div class="order-book-header binance">BinanceTH</div>
                    <div class="order-book-columns">
                        <div class="order-book-column bids">
                            <div class="column-header">BID</div>
                            {#if binanceBook}
                                {#each binanceBook.bids.slice(0, 5) as bid, i}
                                    <div
                                        class="order-row bid"
                                        style="opacity: {1 - i * 0.15}"
                                    >
                                        <span class="price"
                                            >{bid.price.toFixed(2)}</span
                                        >
                                        <span class="amount"
                                            >{bid.amount.toLocaleString()}</span
                                        >
                                    </div>
                                {/each}
                            {/if}
                        </div>
                        <div class="order-book-column asks">
                            <div class="column-header">ASK</div>
                            {#if binanceBook}
                                {#each binanceBook.asks.slice(0, 5) as ask, i}
                                    <div
                                        class="order-row ask"
                                        style="opacity: {1 - i * 0.15}"
                                    >
                                        <span class="price"
                                            >{ask.price.toFixed(2)}</span
                                        >
                                        <span class="amount"
                                            >{ask.amount.toLocaleString()}</span
                                        >
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        {/if}

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
        <div class="section-action">
            <button
                type="button"
                class="fetch-btn"
                on:click={fetchOtcTransactions}
                disabled={disabled || isSubmitting || isFetchingOtc}
            >
                {#if isFetchingOtc}
                    ⏳ Loading...
                {:else}
                    🔄 ดึงข้อมูลวันนี้
                {/if}
            </button>
        </div>

        <!-- Fetched OTC Orders (Compact View) -->
        {#if fetchedOtcTransactions.length > 0}
            <div class="fetched-orders">
                <div class="fetched-orders-header">
                    <span
                        >📋 วันนี้ ({timeFilteredOtcTransactions.length} รายการ)</span
                    >
                </div>

                <div class="fetched-controls">
                    <div class="filter-group">
                        <button
                            type="button"
                            class="filter-btn"
                            class:active={filterType === "ALL"}
                            on:click={() => (filterType = "ALL")}>All</button
                        >
                        <button
                            type="button"
                            class="filter-btn"
                            class:active={filterType === "otc"}
                            on:click={() => (filterType = "otc")}>OTC</button
                        >
                        <button
                            type="button"
                            class="filter-btn"
                            class:active={filterType === "commission"}
                            on:click={() => (filterType = "commission")}
                            >COMS</button
                        >
                    </div>

                    <div class="search-box">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <circle cx="11" cy="11" r="8" /><path
                                d="m21 21-4.35-4.35"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search names..."
                            bind:value={searchQuery}
                            disabled={disabled || isSubmitting}
                        />
                    </div>
                </div>

                <div class="fetched-orders-list">
                    {#each filteredOtcTransactions as tx (tx.id)}
                        <div
                            class="order-card"
                            class:buy={tx.action === "BUY"}
                            class:sell={tx.action === "SELL"}
                        >
                            <div class="order-row">
                                <span class="order-customer"
                                    >{tx.customerName}</span
                                >
                                <span class="order-time"
                                    >{formatDate(tx.timestamp)}</span
                                >
                                <span
                                    class="order-action"
                                    class:buy={tx.action === "BUY"}
                                    class:sell={tx.action === "SELL"}
                                >
                                    {tx.action}
                                </span>
                            </div>
                            <div class="order-row">
                                <span class="order-amount"
                                    >{formatCurrency(tx.amount)}
                                    {tx.currency}</span
                                >
                                <span class="order-total"
                                    >฿{formatCurrency(tx.total || 0)}</span
                                >
                                <span
                                    class="order-status"
                                    class:done={tx.status === "Done"}
                                    class:pending={tx.status === "Pending"}
                                >
                                    {tx.status || "-"}
                                </span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

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
            <label>OTC Notes</label>
            <textarea
                bind:value={otcNotes}
                placeholder="OTC observations..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>
    </CollapsibleSection>

    <!-- Audio Evidence -->
    <div class="form-card">
        <div class="card-header">
            <span class="card-icon">🎙️</span>
            <span class="card-title">Audio Evidence</span>
            {#if audioFiles.length > 0}
                <span class="photo-count">{audioFiles.length}</span>
            {/if}
        </div>
        <AudioRecorder
            on:change={handleAudioChange}
            on:transcribe={handleTranscribe}
            disabled={disabled || isSubmitting}
        />
    </div>

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
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .fetch-time {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-tertiary);
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 8px;
        border-radius: 4px;
    }

    .action-group {
        display: flex;
        gap: 0.5rem;
    }

    .snapshot-header {
        grid-column: span 2;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        background: #f8f9fa;
        border-bottom: 2px solid var(--color-primary);
        border-radius: 6px 6px 0 0;
        margin-bottom: 8px;
    }

    .snapshot-header .app-name {
        font-weight: 700;
        color: var(--color-primary);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .snapshot-header .app-time {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        font-family: var(--font-family-mono);
    }

    .snap-btn {
        padding: 0.5rem 1rem;
        background: #f0f0f5;
        border: 1px solid #d1d1d6;
        border-radius: 8px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #3a3a3c;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .snap-btn:hover:not(:disabled) {
        background: #e5e5ea;
        border-color: #c7c7cc;
    }

    .snap-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
        color: #00c767;
        background: rgba(0, 199, 103, 0.15);
    }

    .higher-badge.binance {
        color: #f0b90b;
        background: rgba(240, 185, 11, 0.15);
    }

    /* Order Book Styles */
    .order-book-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    @media (max-width: 480px) {
        .order-book-container {
            grid-template-columns: 1fr;
        }
    }

    .order-book {
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        overflow: hidden;
    }

    .order-book-header {
        padding: 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .order-book-header.bitkub {
        background: linear-gradient(135deg, #00c767, #009d51);
        color: white;
    }

    .order-book-header.binance {
        background: linear-gradient(135deg, #b45309, #f0b90b);
        color: #1a1a1a;
    }

    .order-book-columns {
        display: flex;
    }

    .order-book-column {
        flex: 1;
        padding: 0.375rem;
    }

    .order-book-column.bids {
        background: rgba(52, 199, 89, 0.05);
    }

    .order-book-column.asks {
        background: rgba(255, 59, 48, 0.05);
    }

    .column-header {
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-tertiary);
        padding-bottom: 0.25rem;
        text-align: center;
    }

    .order-row {
        display: flex;
        justify-content: space-between;
        padding: 0.25rem 0.375rem;
        font-size: 0.75rem;
        font-family: var(--font-family-mono, "SF Mono", monospace);
        border-radius: 4px;
    }

    .order-row.bid {
        background: rgba(52, 199, 89, 0.1);
    }

    .order-row.ask {
        background: rgba(255, 59, 48, 0.1);
    }

    .order-row .price {
        font-weight: 600;
    }

    .order-row.bid .price {
        color: #34c759;
    }

    .order-row.ask .price {
        color: #ff3b30;
    }

    .order-row .amount {
        color: var(--color-text-tertiary);
        font-size: 0.6875rem;
    }

    /* Fetched OTC Orders Compact Styles */
    .fetched-orders {
        margin-bottom: 0.75rem;
    }

    .fetched-orders-header {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        margin-bottom: 0.5rem;
    }

    .fetched-orders-list {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        max-height: 200px;
        overflow-y: auto;
    }

    .order-card {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        padding: 0.5rem 0.625rem;
        background: var(--color-bg-secondary);
        border-radius: 8px;
        border-left: 3px solid var(--color-border);
        font-size: 0.75rem;
    }

    .order-card.buy {
        border-left-color: #34c759;
    }

    .order-card.sell {
        border-left-color: #ff3b30;
    }

    .order-card .order-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0;
        background: transparent;
    }

    .order-customer {
        flex: 1;
        font-weight: 600;
        color: var(--color-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .order-action {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        text-transform: uppercase;
    }

    .order-action.buy {
        color: #34c759;
        background: rgba(52, 199, 89, 0.15);
    }

    .order-action.sell {
        color: #ff3b30;
        background: rgba(255, 59, 48, 0.15);
    }

    .order-amount {
        color: var(--color-text);
        font-family: var(--font-family-mono, monospace);
    }

    .order-time {
        font-size: 10px;
        color: var(--color-text-tertiary);
        white-space: nowrap;
    }

    .order-total {
        color: var(--color-text-secondary);
        font-family: var(--font-family-mono, monospace);
    }

    .order-status {
        font-size: 0.625rem;
        font-weight: 600;
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        margin-left: auto;
    }

    .order-status.done {
        color: #34c759;
        background: rgba(52, 199, 89, 0.15);
    }

    .order-status.pending {
        color: #ff9500;
        background: rgba(255, 149, 0, 0.15);
    }

    /* Filter & Search Controls */
    .fetched-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
    }

    .filter-group {
        display: flex;
        background: var(--color-bg-tertiary);
        padding: 2px;
        border-radius: 8px;
        gap: 2px;
    }

    .filter-btn {
        padding: 0.375rem 0.75rem;
        font-size: 0.6875rem;
        font-weight: 600;
        border: none;
        background: transparent;
        color: var(--color-text-secondary);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .filter-btn.active {
        background: var(--color-bg);
        color: var(--color-primary);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .search-box {
        position: relative;
        flex: 1;
        min-width: 140px;
    }

    .search-box svg {
        position: absolute;
        left: 0.625rem;
        top: 50%;
        transform: translateY(-50%);
        width: 0.875rem;
        height: 0.875rem;
        color: var(--color-text-tertiary);
    }

    .search-box input {
        width: 100%;
        padding: 0.4375rem 0.75rem 0.4375rem 2rem;
        font-size: 0.8125rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text);
        transition: all 0.2s;
    }

    .search-box input:focus {
        outline: none;
        border-color: var(--color-primary);
        background: var(--color-bg);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    .transcribe-btn {
        margin-left: auto;
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-primary);
        background: rgba(0, 122, 255, 0.1);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .transcribe-btn:hover:not(:disabled) {
        background: rgba(0, 122, 255, 0.2);
    }

    .transcribe-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: rgba(0, 0, 0, 0.05);
        color: var(--color-text-tertiary);
    }

    .live-badge {
        font-size: 0.625rem;
        font-weight: 700;
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        animation: pulse-live 2s infinite;
    }

    @keyframes pulse-live {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.6;
        }
        100% {
            opacity: 1;
        }
    }
</style>
