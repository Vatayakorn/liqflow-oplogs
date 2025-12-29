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
        BROKER_METADATA,
        type OtcTransaction,
    } from "$lib/config/tradingConfig";
    import type {
        BrokerPriceEntry,
        FxPriceEntry,
        MaxbitPriceEntry,
        ExchangePriceEntry,
    } from "$lib/api/oplog";
    import { getLatestSessionData } from "$lib/api/oplog";
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
    import { fetchLatestMarketPrices } from "$lib/api/autoSave";

    export let disabled = false;
    export let initialData: any = null;

    const dispatch = createEventDispatcher();

    $: isEditing = !!initialData;

    // Price mode: 'live' = auto-update from WebSocket, 'manual' = user controls fetch
    // In edit mode, always manual (no live updates)
    let priceMode: "live" | "manual" = "live";
    $: effectivePriceMode = isEditing ? "manual" : priceMode;

    // === Auto-Save Price Feature ===
    // Automatically saves prices from market_data at configurable intervals
    let autoSaveEnabled = true; // Default ON
    let autoSaveInterval = 1; // minutes (default: 1 minute)
    let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
    let autoSaveCount = 0; // Track number of auto-saved entries
    const AUTO_SAVE_INTERVALS = [1, 2, 5, 10, 15, 30]; // Available interval options

    // Initialize only if initialData changes or on start
    onMount(() => {
        if (initialData) {
            populateForm(initialData);
        }
    });

    function populateForm(data: any) {
        shift = data.shift || "";
        startTime = data.start_time || "";
        endTime = data.end_time || "";
        broker = data.broker || "";
        trader = data.trader || "";
        head = data.head || "";
        recorder = data.recorder || "";
        fxRate = data.fx_rate?.toString() || "";
        fxNotes = data.fx_notes || "";
        btzBid = data.btz_bid?.toString() || "";
        btzAsk = data.btz_ask?.toString() || "";
        bitazzaUsdcBid = data.btz_usdc_bid?.toString() || "";
        bitazzaUsdcAsk = data.btz_usdc_ask?.toString() || "";
        btzNotes = data.btz_notes || "";

        exchange1 = data.exchange1 || "Bitkub";
        if (data.exchange1_price) {
            const [bid, ask] = data.exchange1_price.split("/");
            exchange1Bid = bid || "";
            exchange1Ask = ask || "";
        }

        exchange2 = data.exchange2 || "BinanceTH";
        if (data.exchange2_price) {
            const [bid, ask] = data.exchange2_price.split("/");
            exchange2Bid = bid || "";
            exchange2Ask = ask || "";
        }

        exchangeDiff = data.exchange_diff || "";
        exchangeHigher = data.exchange_higher || "";
        exchangeNotes = data.exchange_notes || "";

        otcTransactions = data.otc_transactions || [];
        prefundCurrent = data.prefund_current || 0;
        prefundTarget = data.prefund_target || PREFUND_DEFAULTS.target; // Fallback to default
        prefundNotes = data.prefund_notes || "";
        matchingNotes = data.matching_notes || "";
        otcNotes = data.otc_notes || "";
        generalNotes = data.note || "";

        // Load saved order book snapshots from market_context if available
        if (data.market_context?.bitkub) {
            bitkubBook = data.market_context.bitkub;
        }
        if (data.market_context?.binanceTH) {
            binanceBook = data.market_context.binanceTH;
        }

        // Load saved fetch times
        if (data.market_context?.fxFetchTime) {
            fxFetchTime = data.market_context.fxFetchTime;
        }
        if (data.market_context?.brokerFetchTime) {
            brokerFetchTime = data.market_context.brokerFetchTime;
        }
        if (data.market_context?.exchangeFetchTime) {
            exchangeFetchTime = data.market_context.exchangeFetchTime;
        }

        // We don't populate images and audioFiles as they are New files to upload
        // In edit mode, parent should handle existing ones

        // Load broker prices
        if (data.broker_prices && Array.isArray(data.broker_prices)) {
            brokerPrices = data.broker_prices;
        }
        // Load FX prices
        if (data.fx_prices && Array.isArray(data.fx_prices)) {
            fxPrices = data.fx_prices;
        }
        // Load Maxbit prices
        if (data.maxbit_prices && Array.isArray(data.maxbit_prices)) {
            maxbitPrices = data.maxbit_prices;
        }
        // Load Bitazza prices
        if (data.bitazza_prices && Array.isArray(data.bitazza_prices)) {
            bitazzaPrices = data.bitazza_prices;
        }
        // Load Zcom prices
        if (data.zcom_prices && Array.isArray(data.zcom_prices)) {
            zcomPrices = data.zcom_prices;
        }
        // Load Xspring prices
        if (data.xspring_prices && Array.isArray(data.xspring_prices)) {
            xspringPrices = data.xspring_prices;
        }
        // Load Exchange prices
        if (data.exchange_prices && Array.isArray(data.exchange_prices)) {
            exchangePrices = data.exchange_prices;
        }
    }

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
    let recorder = ""; // Recorder

    // === FX ===
    let fxRate = "";
    let fxNotes = "";
    let isFetchingFx = false;
    // FX Price History
    let fxPrices: FxPriceEntry[] = [];
    let fxSaveNote = "";

    // === Broker (Maxbit) ===
    let btzBid = "";
    let btzAsk = "";
    let btzNotes = "";
    let isFetchingBroker = false;
    // Maxbit Price History
    let maxbitPrices: MaxbitPriceEntry[] = [];
    let maxbitSaveNote = "";

    // === Broker (Bitazza) - Manual ===
    let bitazzaBid = "";
    let bitazzaAsk = "";
    let bitazzaUsdcBid = "";
    let bitazzaUsdcAsk = "";
    let bitazzaNotes = "";
    let bitazzaPrices: MaxbitPriceEntry[] = [];
    let bitazzaSaveNote = "";
    let bitazzaParserText = "";

    // === Broker (Zcom) - Manual ===
    let zcomBid = "";
    let zcomAsk = "";
    let zcomNotes = "";
    let zcomPrices: MaxbitPriceEntry[] = [];
    let zcomSaveNote = "";

    // === Broker (Xspring) - Manual ===
    let xspringBid = "";
    let xspringAsk = "";
    let xspringNotes = "";
    let xspringPrices: MaxbitPriceEntry[] = [];
    let xspringSaveNote = "";

    // Reference prices from previous session
    let lastZcomBid = "";
    let lastZcomAsk = "";
    let lastXspringBid = "";
    let lastXspringAsk = "";
    let lastBitazzaBid = "";
    let lastBitazzaAsk = "";
    let lastBitazzaUsdcBid = "";
    let lastBitazzaUsdcAsk = "";
    let lastFxRate = "";

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
    // Exchange Price History
    let exchangePrices: ExchangePriceEntry[] = [];

    // Full order book data (5 levels)
    let bitkubBook: OrderBook | null = null;
    let binanceBook: OrderBook | null = null;

    // === OTC ===
    let otcTransactions: OtcTransaction[] = [];
    let fetchedOtcTransactions: OtcTransaction[] = []; // Transactions from API
    let filterType = "ALL"; // 'ALL', 'otc', 'commission'
    let searchQuery = "";

    // === Broker Prices (Manual Entry) ===
    const BROKER_OPTIONS = ["Xspring", "Zcom", "Bitazza"] as const;
    let brokerPrices: BrokerPriceEntry[] = [];
    let showBrokerPriceForm = false;
    let newBrokerEntry = {
        broker: "Xspring" as "Xspring" | "Zcom" | "Bitazza",
        bid: "",
        ask: "",
        note: "",
    };

    function addBrokerPrice() {
        if (!newBrokerEntry.bid || !newBrokerEntry.ask) {
            toast.error("Please enter BID and ASK");
            return;
        }
        const entry: BrokerPriceEntry = {
            id: crypto.randomUUID(),
            broker: newBrokerEntry.broker,
            bid: newBrokerEntry.bid,
            ask: newBrokerEntry.ask,
            note: newBrokerEntry.note || undefined,
            timestamp: new Date().toISOString(),
        };
        brokerPrices = [...brokerPrices, entry];
        // Reset form
        newBrokerEntry = { broker: "Xspring", bid: "", ask: "", note: "" };
        showBrokerPriceForm = false;
        toast.success("Broker Price Saved");
    }

    function removeBrokerPrice(id: string) {
        brokerPrices = brokerPrices.filter((p) => p.id !== id);
    }

    // Save current FX rate with note
    function saveFxPrice() {
        if (!fxRate) {
            toast.error("No FX rate to save - Please Fetch first");
            return;
        }
        const entry: FxPriceEntry = {
            id: crypto.randomUUID(),
            rate: fxRate,
            note: fxNotes || undefined,
            timestamp: new Date().toISOString(),
        };
        fxPrices = [...fxPrices, entry];
        toast.success("FX Rate Saved");
    }

    function removeFxPrice(id: string) {
        fxPrices = fxPrices.filter((p) => p.id !== id);
    }

    function toggleEditFxTimestamp(id: string) {
        fxPrices = fxPrices.map((p) =>
            p.id === id
                ? { ...p, isEditingTimestamp: !p.isEditingTimestamp }
                : p,
        );
    }

    function handleFxTimestampChange(id: string, newTimestamp: string) {
        fxPrices = fxPrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      timestamp: new Date(newTimestamp).toISOString(),
                      isEditingTimestamp: false,
                  }
                : p,
        );
    }

    function toggleEditFxNote(id: string) {
        fxPrices = fxPrices.map((p) =>
            p.id === id ? { ...p, isEditingNote: !p.isEditingNote } : p,
        );
    }

    function handleFxNoteChange(id: string, newNote: string) {
        fxPrices = fxPrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      note: newNote || undefined,
                      isEditingNote: false,
                  }
                : p,
        );
    }

    // Save current Maxbit BID/ASK with note
    function saveMaxbitPrice() {
        if (!btzBid || !btzAsk) {
            toast.error("No Maxbit price to save - Please Fetch first");
            return;
        }
        const entry: MaxbitPriceEntry = {
            id: crypto.randomUUID(),
            bid: btzBid,
            ask: btzAsk,
            note: btzNotes || undefined,
            timestamp: new Date().toISOString(),
        };
        maxbitPrices = [...maxbitPrices, entry];
        toast.success("Maxbit Price Saved");
    }

    function removeMaxbitPrice(id: string) {
        maxbitPrices = maxbitPrices.filter((p) => p.id !== id);
    }

    function toggleEditMaxbitTimestamp(id: string) {
        maxbitPrices = maxbitPrices.map((p) =>
            p.id === id
                ? { ...p, isEditingTimestamp: !p.isEditingTimestamp }
                : p,
        );
    }

    function handleMaxbitTimestampChange(id: string, newTimestamp: string) {
        maxbitPrices = maxbitPrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      timestamp: new Date(newTimestamp).toISOString(),
                      isEditingTimestamp: false,
                  }
                : p,
        );
    }

    function toggleEditMaxbitNote(id: string) {
        maxbitPrices = maxbitPrices.map((p) =>
            p.id === id ? { ...p, isEditingNote: !p.isEditingNote } : p,
        );
    }

    function handleMaxbitNoteChange(id: string, newNote: string) {
        maxbitPrices = maxbitPrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      note: newNote || undefined,
                      isEditingNote: false,
                  }
                : p,
        );
    }

    // Save Bitazza price
    function saveBitazzaPrice() {
        if (!bitazzaBid && !bitazzaAsk && !bitazzaUsdcBid && !bitazzaUsdcAsk) {
            toast.error("Please enter BID and ASK for USDT or USDC");
            return;
        }

        const timestamp = new Date().toISOString();
        let entriesSaved = 0;

        if (bitazzaBid || bitazzaAsk) {
            const entry: MaxbitPriceEntry = {
                id: crypto.randomUUID(),
                bid: bitazzaBid,
                ask: bitazzaAsk,
                note:
                    (bitazzaNotes ? `[USDT] ${bitazzaNotes}` : "USDT") ||
                    undefined,
                timestamp,
            };
            bitazzaPrices = [...bitazzaPrices, entry];
            entriesSaved++;
        }

        if (bitazzaUsdcBid || bitazzaUsdcAsk) {
            const entry: MaxbitPriceEntry = {
                id: crypto.randomUUID(),
                bid: bitazzaUsdcBid,
                ask: bitazzaUsdcAsk,
                note:
                    (bitazzaNotes ? `[USDC] ${bitazzaNotes}` : "USDC") ||
                    undefined,
                timestamp,
            };
            bitazzaPrices = [...bitazzaPrices, entry];
            entriesSaved++;
        }

        if (entriesSaved > 0) {
            toast.success(`Bitazza Price${entriesSaved > 1 ? "s" : ""} Saved`);
        }
    }

    function parseBitazzaRates() {
        if (!bitazzaParserText) {
            toast.error("Please paste Bitazza text first");
            return;
        }

        const usdtBidMatch = bitazzaParserText.match(
            /USDT>THB \(Bid\) คือ ([\d.]+)/,
        );
        const usdtAskMatch = bitazzaParserText.match(
            /THB>USDT \(Ask\) คือ ([\d.]+)/,
        );
        const usdcBidMatch = bitazzaParserText.match(
            /USDC>THB \(Bid\) คือ ([\d.]+)/,
        );
        const usdcAskMatch = bitazzaParserText.match(
            /THB>USDC \(Ask\) คือ ([\d.]+)/,
        );

        let found = false;
        if (usdtBidMatch) {
            bitazzaBid = usdtBidMatch[1];
            found = true;
        }
        if (usdtAskMatch) {
            bitazzaAsk = usdtAskMatch[1];
            found = true;
        }
        if (usdcBidMatch) {
            bitazzaUsdcBid = usdcBidMatch[1];
            found = true;
        }
        if (usdcAskMatch) {
            bitazzaUsdcAsk = usdcAskMatch[1];
            found = true;
        }

        if (found) {
            toast.success("Prices parsed successfully!");
            bitazzaParserText = "";
        } else {
            toast.error("Could not find any prices. Please check the format.");
        }
    }

    function removeBitazzaPrice(id: string) {
        bitazzaPrices = bitazzaPrices.filter((p) => p.id !== id);
    }

    function toggleEditBitazzaTimestamp(id: string) {
        bitazzaPrices = bitazzaPrices.map((p) =>
            p.id === id
                ? { ...p, isEditingTimestamp: !p.isEditingTimestamp }
                : p,
        );
    }

    function handleBitazzaTimestampChange(id: string, newTimestamp: string) {
        bitazzaPrices = bitazzaPrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      timestamp: new Date(newTimestamp).toISOString(),
                      isEditingTimestamp: false,
                  }
                : p,
        );
    }

    // Save Zcom price
    function saveZcomPrice() {
        if (!zcomBid || !zcomAsk) {
            toast.error("Please enter BID and ASK");
            return;
        }
        const entry: MaxbitPriceEntry = {
            id: crypto.randomUUID(),
            bid: zcomBid,
            ask: zcomAsk,
            note: zcomNotes || undefined,
            timestamp: new Date().toISOString(),
        };
        zcomPrices = [...zcomPrices, entry];
        toast.success("Zcom Price Saved");
    }

    function removeZcomPrice(id: string) {
        zcomPrices = zcomPrices.filter((p) => p.id !== id);
    }

    function toggleEditZcomTimestamp(id: string) {
        zcomPrices = zcomPrices.map((p) =>
            p.id === id
                ? { ...p, isEditingTimestamp: !p.isEditingTimestamp }
                : p,
        );
    }

    function handleZcomTimestampChange(id: string, newTimestamp: string) {
        zcomPrices = zcomPrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      timestamp: new Date(newTimestamp).toISOString(),
                      isEditingTimestamp: false,
                  }
                : p,
        );
    }

    // Save Xspring price
    function saveXspringPrice() {
        if (!xspringBid || !xspringAsk) {
            toast.error("Please enter BID and ASK");
            return;
        }
        const entry: MaxbitPriceEntry = {
            id: crypto.randomUUID(),
            bid: xspringBid,
            ask: xspringAsk,
            note: xspringNotes || undefined,
            timestamp: new Date().toISOString(),
        };
        xspringPrices = [...xspringPrices, entry];
        toast.success("Xspring Price Saved");
    }

    function removeXspringPrice(id: string) {
        xspringPrices = xspringPrices.filter((p) => p.id !== id);
    }

    function toggleEditXspringTimestamp(id: string) {
        xspringPrices = xspringPrices.map((p) =>
            p.id === id
                ? { ...p, isEditingTimestamp: !p.isEditingTimestamp }
                : p,
        );
    }

    function handleXspringTimestampChange(id: string, newTimestamp: string) {
        xspringPrices = xspringPrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      timestamp: new Date(newTimestamp).toISOString(),
                      isEditingTimestamp: false,
                  }
                : p,
        );
    }

    // Save current Exchange Order Book data
    function saveExchangePrice() {
        if (!exchange1Bid && !exchange1Ask && !exchange2Bid && !exchange2Ask) {
            toast.error("No Exchange data to save - Please Fetch first");
            return;
        }
        const entry: ExchangePriceEntry = {
            id: crypto.randomUUID(),
            exchange1: exchange1,
            exchange1Bid: exchange1Bid,
            exchange1Ask: exchange1Ask,
            exchange2: exchange2,
            exchange2Bid: exchange2Bid,
            exchange2Ask: exchange2Ask,
            diff: exchangeDiff,
            higher: exchangeHigher,
            note: exchangeNotes || undefined,
            timestamp: new Date().toISOString(),
        };
        exchangePrices = [...exchangePrices, entry];
        toast.success("Exchange data Saved");
    }

    function removeExchangePrice(id: string) {
        exchangePrices = exchangePrices.filter((p) => p.id !== id);
    }

    function toggleEditExchangeTimestamp(id: string) {
        exchangePrices = exchangePrices.map((p) =>
            p.id === id
                ? { ...p, isEditingTimestamp: !p.isEditingTimestamp }
                : p,
        );
    }

    function handleExchangeTimestampChange(id: string, newTimestamp: string) {
        exchangePrices = exchangePrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      timestamp: new Date(newTimestamp).toISOString(),
                      isEditingTimestamp: false,
                  }
                : p,
        );
    }

    function toggleEditExchangeNote(id: string) {
        exchangePrices = exchangePrices.map((p) =>
            p.id === id ? { ...p, isEditingNote: !p.isEditingNote } : p,
        );
    }

    function handleExchangeNoteChange(id: string, newNote: string) {
        exchangePrices = exchangePrices.map((p) =>
            p.id === id
                ? {
                      ...p,
                      note: newNote || undefined,
                      isEditingNote: false,
                  }
                : p,
        );
    }

    function formatBrokerTimestamp(isoStr: string): string {
        const date = new Date(isoStr);
        return date.toLocaleString("th-TH", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

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
    let prefundNotes = "";
    let matchingNotes = "";
    let otcNotes = "";
    let isFetchingOtc = false;

    // === General ===
    // === General ===
    let generalNotes = "";
    let images: File[] = [];
    let audioFiles: { file: File; notes: string }[] = []; // Audio recordings with notes
    let orderBookContainer: HTMLElement;
    let fxContainer: HTMLElement | undefined;
    let brokerContainer: HTMLElement | undefined;
    let isCapturing = false;
    let isCapturingFx = false;
    let isCapturingBroker = false;

    // Fetch Timestamps
    let fxFetchTime = "";
    let brokerFetchTime = "";
    let exchangeFetchTime = "";

    onMount(() => {
        // Only connect to live feed when NOT editing
        if (!initialData) {
            marketFeed.connect();

            // Fetch last saved values for new sessions
            getLatestSessionData().then((lastSession) => {
                if (lastSession) {
                    // Team members
                    if (lastSession.broker) broker = lastSession.broker;
                    if (lastSession.trader) trader = lastSession.trader;
                    if (lastSession.head) head = lastSession.head;
                    if (lastSession.recorder) recorder = lastSession.recorder;

                    // Prefund values
                    if (
                        lastSession.prefund_current !== undefined &&
                        lastSession.prefund_current !== null
                    ) {
                        prefundCurrent = lastSession.prefund_current;
                    }
                    if (
                        lastSession.prefund_target !== undefined &&
                        lastSession.prefund_target !== null
                    ) {
                        prefundTarget = lastSession.prefund_target;
                    }

                    // Price references for manual inputs
                    if (
                        lastSession.zcom_prices &&
                        lastSession.zcom_prices.length > 0
                    ) {
                        const last =
                            lastSession.zcom_prices[
                                lastSession.zcom_prices.length - 1
                            ];
                        lastZcomBid = last.bid;
                        lastZcomAsk = last.ask;
                    }
                    if (
                        lastSession.xspring_prices &&
                        lastSession.xspring_prices.length > 0
                    ) {
                        const last =
                            lastSession.xspring_prices[
                                lastSession.xspring_prices.length - 1
                            ];
                        lastXspringBid = last.bid;
                        lastXspringAsk = last.ask;
                    }
                    if (
                        lastSession.bitazza_prices &&
                        lastSession.bitazza_prices.length > 0
                    ) {
                        // Filter for USDT (default or [USDT])
                        const usdts = lastSession.bitazza_prices.filter(
                            (p) => !p.note || !p.note.includes("USDC"),
                        );
                        // Filter for USDC ([USDC])
                        const usdcs = lastSession.bitazza_prices.filter(
                            (p) => p.note && p.note.includes("USDC"),
                        );

                        if (usdts.length > 0) {
                            const last = usdts[usdts.length - 1];
                            lastBitazzaBid = last.bid;
                            lastBitazzaAsk = last.ask;
                        }
                        if (usdcs.length > 0) {
                            const last = usdcs[usdcs.length - 1];
                            lastBitazzaUsdcBid = last.bid;
                            lastBitazzaUsdcAsk = last.ask;
                        }
                    }

                    if (
                        lastSession.fx_prices &&
                        lastSession.fx_prices.length > 0
                    ) {
                        const last =
                            lastSession.fx_prices[
                                lastSession.fx_prices.length - 1
                            ];
                        lastFxRate = last.rate;
                    }
                }
            });
        }
    });

    // === Auto-Save Functions ===
    function startAutoSave() {
        if (autoSaveTimer) clearInterval(autoSaveTimer);
        // Initial save immediately, then every interval
        autoSavePrices();
        autoSaveTimer = setInterval(
            () => {
                autoSavePrices();
            },
            autoSaveInterval * 60 * 1000,
        );
    }

    async function autoSavePrices() {
        try {
            const prices = await fetchLatestMarketPrices();
            const timestamp = new Date().toISOString();

            // Auto-save FX if available
            if (prices.fx) {
                const entry: FxPriceEntry = {
                    id: crypto.randomUUID(),
                    rate: prices.fx.rate.toFixed(3),
                    note: "[Auto]",
                    timestamp,
                };
                fxPrices = [...fxPrices, entry];
                fxRate = prices.fx.rate.toFixed(3);
                fxFetchTime = getCurrentTimeStr();
            }

            // Auto-save Maxbit if available
            if (prices.maxbit) {
                const entry: MaxbitPriceEntry = {
                    id: crypto.randomUUID(),
                    bid: prices.maxbit.bid.toFixed(3),
                    ask: prices.maxbit.ask.toFixed(3),
                    note: "[Auto]",
                    timestamp,
                };
                maxbitPrices = [...maxbitPrices, entry];
                btzBid = prices.maxbit.bid.toFixed(3);
                btzAsk = prices.maxbit.ask.toFixed(3);
                brokerFetchTime = getCurrentTimeStr();
            }

            // Auto-save Exchange (Bitkub + BinanceTH) if available
            if (prices.bitkub || prices.binanceTH) {
                const newExchange1Bid =
                    prices.bitkub?.bid.toFixed(2) || exchange1Bid;
                const newExchange1Ask =
                    prices.bitkub?.ask.toFixed(2) || exchange1Ask;
                const newExchange2Bid =
                    prices.binanceTH?.bid.toFixed(2) || exchange2Bid;
                const newExchange2Ask =
                    prices.binanceTH?.ask.toFixed(2) || exchange2Ask;

                // Calculate diff
                const bid1 = parseFloat(newExchange1Bid);
                const bid2 = parseFloat(newExchange2Bid);
                let diff = "";
                let higher = "";
                if (bid1 && bid2) {
                    const diffValue = Math.abs(bid1 - bid2).toFixed(2);
                    diff = diffValue;
                    higher = bid1 > bid2 ? exchange1 : exchange2;
                }

                const entry: ExchangePriceEntry = {
                    id: crypto.randomUUID(),
                    exchange1,
                    exchange1Bid: newExchange1Bid,
                    exchange1Ask: newExchange1Ask,
                    exchange2,
                    exchange2Bid: newExchange2Bid,
                    exchange2Ask: newExchange2Ask,
                    diff,
                    higher,
                    note: "[Auto]",
                    timestamp,
                };
                exchangePrices = [...exchangePrices, entry];
                exchange1Bid = newExchange1Bid;
                exchange1Ask = newExchange1Ask;
                exchange2Bid = newExchange2Bid;
                exchange2Ask = newExchange2Ask;
                exchangeDiff = diff;
                exchangeHigher = higher;
                exchangeFetchTime = getCurrentTimeStr();
            }

            autoSaveCount++;
        } catch (error) {
            console.error("[AutoSave] Error fetching prices:", error);
        }
    }

    function stopAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
        }
    }

    // Reactive: Start/stop or restart auto-save (Merged to prevent double-init at start)
    $: if (autoSaveEnabled && !isEditing) {
        // Track autoSaveInterval so it restarts if changed
        autoSaveInterval;
        startAutoSave();
    } else {
        stopAutoSave();
    }

    onDestroy(() => {
        // Only disconnect if we connected
        if (!initialData) {
            marketFeed.disconnect();
        }
        // Always clean up auto-save timer
        stopAutoSave();
    });

    // Reactive: Update UI when live data arrives (only when NOT editing AND in live mode)
    $: if ($fxLive && effectivePriceMode === "live") {
        fxRate = $fxLive.rate.toFixed(3);
        fxFetchTime = getCurrentTimeStr();
    }

    $: if ($maxbitLive && effectivePriceMode === "live") {
        btzBid = $maxbitLive.bid.toFixed(3);
        btzAsk = $maxbitLive.ask.toFixed(3);
        brokerFetchTime = getCurrentTimeStr();
    }

    $: if ($bitkubLive && effectivePriceMode === "live") {
        bitkubBook = $bitkubLive;
        exchange1Bid = $bitkubLive.bestBid.toFixed(2);
        exchange1Ask = $bitkubLive.bestAsk.toFixed(2);
        updateExchangeDiff();
        exchangeFetchTime = getCurrentTimeStr();
    }

    $: if ($binanceTHLive && effectivePriceMode === "live") {
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
                windowWidth: 1200,
                onclone: (clonedDoc: Document) => {
                    // iOS Safari PWA fix: Force font rendering
                    const container = clonedDoc.querySelector(
                        ".order-book-container",
                    ) as HTMLElement;
                    if (container) {
                        container.style.fontFamily =
                            "-apple-system, BlinkMacSystemFont, sans-serif";
                        container.style.webkitTextSizeAdjust = "100%";
                    }
                    // Force all numeric values to be visible
                    const prices = clonedDoc.querySelectorAll(
                        ".price, .amount",
                    ) as NodeListOf<HTMLElement>;
                    prices.forEach((el) => {
                        el.style.whiteSpace = "nowrap";
                        el.style.minWidth = "max-content";
                    });
                },
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

    async function snapshotFxUI() {
        if (!fxContainer) {
            toast.error("FX section not visible");
            return;
        }

        isCapturingFx = true;
        await tick();

        try {
            // @ts-ignore
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(fxContainer, {
                backgroundColor: "#ffffff",
                scale: 2,
                logging: false,
                useCORS: true,
                windowWidth: 1200,
                onclone: (clonedDoc: Document) => {
                    // iOS Safari PWA fix: Force font rendering
                    const container = clonedDoc.querySelector(
                        ".fx-snapshot-container",
                    ) as HTMLElement;
                    if (container) {
                        container.style.fontFamily =
                            "-apple-system, BlinkMacSystemFont, sans-serif";
                        container.style.webkitTextSizeAdjust = "100%";
                    }
                },
            });

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `fx_snap_${Date.now()}.png`, {
                        type: "image/png",
                    });
                    images = [...images, file];
                    toast.success("FX snapshot added!");
                }
                isCapturingFx = false;
            }, "image/png");
        } catch (error) {
            console.error("FX capture failed:", error);
            toast.error("FX capture failed");
            isCapturingFx = false;
        }
    }

    async function snapshotBrokerUI() {
        if (!brokerContainer) {
            toast.error("Broker section not visible");
            return;
        }

        isCapturingBroker = true;
        await tick();

        try {
            // @ts-ignore
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(brokerContainer, {
                backgroundColor: "#ffffff",
                scale: 2,
                logging: false,
                useCORS: true,
                windowWidth: 1200,
                onclone: (clonedDoc: Document) => {
                    // iOS Safari PWA fix: Force font rendering
                    const container = clonedDoc.querySelector(
                        ".broker-snapshot-container",
                    ) as HTMLElement;
                    if (container) {
                        container.style.fontFamily =
                            "-apple-system, BlinkMacSystemFont, sans-serif";
                        container.style.webkitTextSizeAdjust = "100%";
                    }
                },
            });

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File(
                        [blob],
                        `broker_snap_${Date.now()}.png`,
                        { type: "image/png" },
                    );
                    images = [...images, file];
                    toast.success("Broker snapshot added!");
                }
                isCapturingBroker = false;
            }, "image/png");
        } catch (error) {
            console.error("Broker capture failed:", error);
            toast.error("Broker capture failed");
            isCapturingBroker = false;
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
                    "No data today (0 items) - Please check API Configuration in Console (F12)",
                );
            }
        } catch (error) {
            console.error("Failed to fetch OTC transactions:", error);
            alert(
                `An error occurred: ${error instanceof Error ? error.message : error}`,
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
                btz_usdc_bid: bitazzaUsdcBid
                    ? parseFloat(bitazzaUsdcBid)
                    : null,
                btz_usdc_ask: bitazzaUsdcAsk
                    ? parseFloat(bitazzaUsdcAsk)
                    : null,
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
                prefund_notes: prefundNotes,
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
                // Broker Prices (Manual - legacy)
                broker_prices: brokerPrices,
                // FX Price History
                fx_prices: fxPrices,
                // Maxbit Price History
                maxbit_prices: maxbitPrices,
                // Bitazza Price History
                bitazza_prices: bitazzaPrices,
                // Zcom Price History
                zcom_prices: zcomPrices,
                // Xspring Price History
                xspring_prices: xspringPrices,
                // Exchange Price History
                exchange_prices: exchangePrices,
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
        brokerPrices = [];
        fxPrices = [];
        maxbitPrices = [];
        fxSaveNote = "";
        maxbitSaveNote = "";
        // Bitazza, Zcom, Xspring
        bitazzaBid = "";
        bitazzaAsk = "";
        bitazzaUsdcBid = "";
        bitazzaUsdcAsk = "";
        bitazzaNotes = "";
        bitazzaPrices = [];
        bitazzaSaveNote = "";
        bitazzaParserText = "";
        zcomBid = "";
        zcomAsk = "";
        zcomNotes = "";
        zcomPrices = [];
        zcomSaveNote = "";
        xspringBid = "";
        xspringAsk = "";
        xspringNotes = "";
        xspringPrices = [];
        xspringSaveNote = "";
        exchangePrices = [];
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
                <label for="recorder">Recorder</label>
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

    <!-- Data Mode Selection (Global) -->
    <div class="mode-card" class:is-editing={isEditing}>
        {#if isEditing}
            <div class="edit-banner">
                <span class="banner-icon">📜</span>
                <div class="banner-content">
                    <strong>Historical Mode Active</strong>
                    <p>
                        Viewing saved data from this session. Live updates are
                        disabled.
                    </p>
                </div>
            </div>
        {:else}
            <div class="mode-selector">
                <div class="mode-info">
                    <span class="mode-label">Price Data Mode</span>
                    <p class="mode-desc">
                        Choose how market prices are updated
                    </p>
                </div>
                <div class="price-mode-toggle">
                    <button
                        type="button"
                        class="mode-btn"
                        class:active={priceMode === "manual"}
                        on:click={() => (priceMode = "manual")}
                    >
                        Manual
                    </button>
                    <button
                        type="button"
                        class="mode-btn live"
                        class:active={priceMode === "live"}
                        on:click={() => (priceMode = "live")}
                    >
                        <span class="status-dot"></span>
                        🟢 Live
                    </button>
                </div>
            </div>

            <!-- Auto-Save Controls -->
            <div class="auto-save-controls">
                <label class="auto-save-toggle">
                    <input type="checkbox" bind:checked={autoSaveEnabled} />
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">Auto-Save Prices</span>
                </label>

                {#if autoSaveEnabled}
                    <div class="interval-selector">
                        <label>Every</label>
                        <select bind:value={autoSaveInterval}>
                            {#each AUTO_SAVE_INTERVALS as interval}
                                <option value={interval}>{interval} min</option>
                            {/each}
                        </select>
                        {#if autoSaveCount > 0}
                            <span class="auto-save-count"
                                >({autoSaveCount} saved)</span
                            >
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- FX Section -->
    <CollapsibleSection
        title="FX (Spot Rate)"
        logoUrl={BROKER_METADATA.Google.logo}
        logoStyle="width: 40px; height: auto;"
        badge={fxPrices.length || null}
    >
        <div class="section-action">
            {#if fxFetchTime}
                <span class="fetch-time">Drawn at: {fxFetchTime}</span>
            {/if}
            {#if effectivePriceMode === "manual"}
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
            {/if}
        </div>
        <div class="field">
            <label>USD/THB Spot Rate</label>
            <input
                type="text"
                bind:value={fxRate}
                placeholder={lastFxRate || "31.510"}
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

        <!-- Save FX Price Section -->
        {#if fxRate}
            <div class="save-price-section">
                <button
                    type="button"
                    class="save-price-btn"
                    on:click={saveFxPrice}
                    disabled={disabled || isSubmitting}
                >
                    💾 Save Price
                </button>
            </div>
        {/if}

        <!-- FX Price History -->
        {#if fxPrices.length > 0}
            <div
                class="price-history-list"
                class:scrollable={fxPrices.length > 5}
                class:compact={fxPrices.length > 5}
                class:ultra-compact={fxPrices.length > 10}
                class:micro-compact={fxPrices.length > 20}
            >
                <div class="history-header">
                    📋 Price History ({fxPrices.length})
                </div>
                {#each fxPrices as entry (entry.id)}
                    <div class="price-history-card">
                        <div class="history-card-header">
                            <span class="history-value">{entry.rate}</span>
                            <button
                                type="button"
                                class="delete-btn"
                                on:click={() => removeFxPrice(entry.id)}
                                disabled={disabled || isSubmitting}
                            >
                                ✕
                            </button>
                        </div>
                        <div class="history-timestamp">
                            {#if entry.isEditingTimestamp}
                                <input
                                    type="datetime-local"
                                    value={new Date(entry.timestamp)
                                        .toISOString()
                                        .slice(0, 16)}
                                    on:change={(e) =>
                                        handleFxTimestampChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditFxTimestamp(entry.id)}
                                    class="timestamp-edit-input"
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditFxTimestamp(entry.id)}
                                    style="cursor: pointer; display: inline-block;"
                                >
                                    📅 {formatBrokerTimestamp(entry.timestamp)}
                                </span>
                            {/if}
                        </div>
                        <div class="history-note">
                            {#if entry.isEditingNote}
                                <input
                                    type="text"
                                    value={entry.note || ""}
                                    on:change={(e) =>
                                        handleFxNoteChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() => toggleEditFxNote(entry.id)}
                                    on:keydown={(e) => {
                                        if (e.key === "Enter") {
                                            handleFxNoteChange(
                                                entry.id,
                                                e.currentTarget.value,
                                            );
                                        }
                                    }}
                                    class="note-edit-input"
                                    placeholder="Add note..."
                                />
                            {:else}
                                <span
                                    on:click={() => toggleEditFxNote(entry.id)}
                                    style="cursor: pointer;"
                                    title="Click to edit note"
                                >
                                    📝 {entry.note || "(add note)"}
                                </span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </CollapsibleSection>

    <!-- Broker (Bitazza) - Manual Entry -->
    <CollapsibleSection
        title="Broker (Bitazza)"
        logoUrl={BROKER_METADATA.Bitazza.logo}
        badge={bitazzaPrices.length || null}
    >
        <!-- Bitazza Hacky Bot Parser -->
        <div
            class="parser-section"
            style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border: 1px dashed #dee2e6;"
        >
            <label
                style="display: block; font-size: 0.75rem; font-weight: 600; color: #6c757d; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.025em;"
            >
                🤖 (Copy from Bitazza)
            </label>
            <div style="display: flex; gap: 0.5rem;">
                <textarea
                    bind:value={bitazzaParserText}
                    placeholder="Paste Bitazza price text here..."
                    rows="3"
                    style="flex: 1; font-family: monospace; font-size: 0.8rem; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px;"
                    disabled={disabled || isSubmitting}
                ></textarea>
                <button
                    type="button"
                    class="gen-btn"
                    style="padding: 0 1rem; background: #28a745; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;"
                    on:click={parseBitazzaRates}
                    disabled={disabled || isSubmitting}
                >
                    Gen
                </button>
            </div>
        </div>

        <div
            style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1rem;"
        >
            <!-- USDT Section -->
            <div
                style="padding: 1rem; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);"
            >
                <div
                    style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;"
                >
                    <div
                        style="width: 8px; height: 8px; border-radius: 50%; background: #26a17b;"
                    ></div>
                    <label
                        style="font-size: 0.8rem; font-weight: 700; color: #212529; text-transform: uppercase; letter-spacing: 0.05em;"
                        >USDT Price</label
                    >
                </div>
                <div
                    class="bid-ask-row"
                    style="margin-bottom: 0; justify-content: flex-start; gap: 1rem;"
                >
                    <div
                        class="field"
                        style="flex: 0 1 120px; min-width: 100px;"
                    >
                        <label style="font-size: 0.65rem; color: #6c757d;"
                            >BID</label
                        >
                        <input
                            type="number"
                            step="0.001"
                            bind:value={bitazzaBid}
                            placeholder={lastBitazzaBid || "33.95"}
                            disabled={disabled || isSubmitting}
                            style="border-color: #dee2e6; width: 100%;"
                        />
                    </div>
                    <div
                        class="field"
                        style="flex: 0 1 120px; min-width: 100px;"
                    >
                        <label style="font-size: 0.65rem; color: #6c757d;"
                            >ASK</label
                        >
                        <input
                            type="number"
                            step="0.001"
                            bind:value={bitazzaAsk}
                            placeholder={lastBitazzaAsk || "34.05"}
                            disabled={disabled || isSubmitting}
                            style="border-color: #dee2e6; width: 100%;"
                        />
                    </div>
                </div>
            </div>

            <!-- USDC Section -->
            <div
                style="padding: 1rem; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);"
            >
                <div
                    style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;"
                >
                    <div
                        style="width: 8px; height: 8px; border-radius: 50%; background: #2775ca;"
                    ></div>
                    <label
                        style="font-size: 0.8rem; font-weight: 700; color: #212529; text-transform: uppercase; letter-spacing: 0.05em;"
                        >USDC Price</label
                    >
                </div>
                <div
                    class="bid-ask-row"
                    style="margin-bottom: 0; justify-content: flex-start; gap: 1rem;"
                >
                    <div
                        class="field"
                        style="flex: 0 1 120px; min-width: 100px;"
                    >
                        <label style="font-size: 0.65rem; color: #6c757d;"
                            >BID</label
                        >
                        <input
                            type="number"
                            step="0.001"
                            bind:value={bitazzaUsdcBid}
                            placeholder={lastBitazzaUsdcBid || "33.95"}
                            disabled={disabled || isSubmitting}
                            style="border-color: #dee2e6; width: 100%;"
                        />
                    </div>
                    <div
                        class="field"
                        style="flex: 0 1 120px; min-width: 100px;"
                    >
                        <label style="font-size: 0.65rem; color: #6c757d;"
                            >ASK</label
                        >
                        <input
                            type="number"
                            step="0.001"
                            bind:value={bitazzaUsdcAsk}
                            placeholder={lastBitazzaUsdcAsk || "34.05"}
                            disabled={disabled || isSubmitting}
                            style="border-color: #dee2e6; width: 100%;"
                        />
                    </div>
                </div>
            </div>
        </div>

        <div class="field">
            <label>Notes</label>
            <textarea
                bind:value={bitazzaNotes}
                placeholder="Bitazza conditions..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>

        <!-- Save Bitazza Price Section -->
        <div class="save-price-section">
            <button
                type="button"
                class="save-price-btn"
                on:click={saveBitazzaPrice}
                disabled={disabled ||
                    isSubmitting ||
                    (!bitazzaBid &&
                        !bitazzaAsk &&
                        !bitazzaUsdcBid &&
                        !bitazzaUsdcAsk)}
            >
                💾 Save Prices
            </button>
        </div>

        <!-- Bitazza Price History -->
        {#if bitazzaPrices.length > 0}
            <div class="price-history-list">
                <div class="history-header">
                    📋 Price History ({bitazzaPrices.length})
                </div>
                {#each bitazzaPrices as entry (entry.id)}
                    <div class="price-history-card">
                        <div class="history-card-header">
                            <span class="history-values">
                                <span class="bid-value">BID: {entry.bid}</span>
                                <span class="ask-value">ASK: {entry.ask}</span>
                            </span>
                            <button
                                type="button"
                                class="delete-btn"
                                on:click={() => removeBitazzaPrice(entry.id)}
                                disabled={disabled || isSubmitting}
                            >
                                ✕
                            </button>
                        </div>
                        <div class="history-timestamp">
                            {#if entry.isEditingTimestamp}
                                <input
                                    type="datetime-local"
                                    value={new Date(entry.timestamp)
                                        .toISOString()
                                        .slice(0, 16)}
                                    on:change={(e) =>
                                        handleBitazzaTimestampChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditBitazzaTimestamp(entry.id)}
                                    class="timestamp-edit-input"
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditBitazzaTimestamp(entry.id)}
                                    style="cursor: pointer; display: inline-block;"
                                >
                                    📅 {formatBrokerTimestamp(entry.timestamp)}
                                </span>
                            {/if}
                        </div>
                        {#if entry.note}
                            <div class="history-note">📝 {entry.note}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </CollapsibleSection>

    <CollapsibleSection
        title="Broker (Zcom)"
        logoUrl={BROKER_METADATA.Zcom.logo}
        logoStyle="transform: scale(1.5); transform-origin: center;"
        badge={zcomPrices.length || null}
    >
        <div class="bid-ask-row">
            <div class="field">
                <label>BID</label>
                <input
                    type="number"
                    step="0.001"
                    bind:value={zcomBid}
                    placeholder={lastZcomBid || "33.95"}
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label>ASK</label>
                <input
                    type="number"
                    step="0.001"
                    bind:value={zcomAsk}
                    placeholder={lastZcomAsk || "34.05"}
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>

        <div class="field">
            <label>Notes</label>
            <textarea
                bind:value={zcomNotes}
                placeholder="Zcom conditions..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>

        <!-- Save Zcom Price Section -->
        <div class="save-price-section">
            <button
                type="button"
                class="save-price-btn"
                on:click={saveZcomPrice}
                disabled={disabled || isSubmitting || (!zcomBid && !zcomAsk)}
            >
                💾 Save Price
            </button>
        </div>

        <!-- Zcom Price History -->
        {#if zcomPrices.length > 0}
            <div class="price-history-list">
                <div class="history-header">
                    📋 Price History ({zcomPrices.length})
                </div>
                {#each zcomPrices as entry (entry.id)}
                    <div class="price-history-card">
                        <div class="history-card-header">
                            <span class="history-values">
                                <span class="bid-value">BID: {entry.bid}</span>
                                <span class="ask-value">ASK: {entry.ask}</span>
                            </span>
                            <button
                                type="button"
                                class="delete-btn"
                                on:click={() => removeZcomPrice(entry.id)}
                                disabled={disabled || isSubmitting}
                            >
                                ✕
                            </button>
                        </div>
                        <div class="history-timestamp">
                            {#if entry.isEditingTimestamp}
                                <input
                                    type="datetime-local"
                                    value={new Date(entry.timestamp)
                                        .toISOString()
                                        .slice(0, 16)}
                                    on:change={(e) =>
                                        handleZcomTimestampChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditZcomTimestamp(entry.id)}
                                    class="timestamp-edit-input"
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditZcomTimestamp(entry.id)}
                                    style="cursor: pointer; display: inline-block;"
                                >
                                    📅 {formatBrokerTimestamp(entry.timestamp)}
                                </span>
                            {/if}
                        </div>
                        {#if entry.note}
                            <div class="history-note">📝 {entry.note}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </CollapsibleSection>

    <CollapsibleSection
        title="Broker (Xspring)"
        logoUrl={BROKER_METADATA.Xspring.logo}
        logoStyle="transform: scale(1.4); transform-origin: center;"
        badge={xspringPrices.length || null}
    >
        <div class="bid-ask-row">
            <div class="field">
                <label>BID</label>
                <input
                    type="number"
                    step="0.001"
                    bind:value={xspringBid}
                    placeholder={lastXspringBid || "33.95"}
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label>ASK</label>
                <input
                    type="number"
                    step="0.001"
                    bind:value={xspringAsk}
                    placeholder={lastXspringAsk || "34.05"}
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>

        <div class="field">
            <label>Notes</label>
            <textarea
                bind:value={xspringNotes}
                placeholder="Xspring conditions..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>

        <!-- Save Xspring Price Section -->
        <div class="save-price-section">
            <button
                type="button"
                class="save-price-btn"
                on:click={saveXspringPrice}
                disabled={disabled ||
                    isSubmitting ||
                    (!xspringBid && !xspringAsk)}
            >
                💾 Save Price
            </button>
        </div>

        <!-- Xspring Price History -->
        {#if xspringPrices.length > 0}
            <div class="price-history-list">
                <div class="history-header">
                    📋 Price History ({xspringPrices.length})
                </div>
                {#each xspringPrices as entry (entry.id)}
                    <div class="price-history-card">
                        <div class="history-card-header">
                            <span class="history-values">
                                <span class="bid-value">BID: {entry.bid}</span>
                                <span class="ask-value">ASK: {entry.ask}</span>
                            </span>
                            <button
                                type="button"
                                class="delete-btn"
                                on:click={() => removeXspringPrice(entry.id)}
                                disabled={disabled || isSubmitting}
                            >
                                ✕
                            </button>
                        </div>
                        <div class="history-timestamp">
                            {#if entry.isEditingTimestamp}
                                <input
                                    type="datetime-local"
                                    value={new Date(entry.timestamp)
                                        .toISOString()
                                        .slice(0, 16)}
                                    on:change={(e) =>
                                        handleXspringTimestampChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditXspringTimestamp(entry.id)}
                                    class="timestamp-edit-input"
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditXspringTimestamp(entry.id)}
                                    style="cursor: pointer; display: inline-block;"
                                >
                                    📅 {formatBrokerTimestamp(entry.timestamp)}
                                </span>
                            {/if}
                        </div>
                        {#if entry.note}
                            <div class="history-note">📝 {entry.note}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </CollapsibleSection>

    <CollapsibleSection
        title="Broker (Maxbit)"
        logoUrl={BROKER_METADATA.Maxbit.logo}
        badge={maxbitPrices.length || null}
    >
        <div class="section-action">
            {#if brokerFetchTime}
                <span class="fetch-time">Drawn at: {brokerFetchTime}</span>
            {/if}
            {#if effectivePriceMode === "manual"}
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
            {/if}
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

        <!-- Save Maxbit Price Section -->
        {#if btzBid || btzAsk}
            <div class="save-price-section">
                <button
                    type="button"
                    class="save-price-btn"
                    on:click={saveMaxbitPrice}
                    disabled={disabled || isSubmitting}
                >
                    💾 Save Price
                </button>
            </div>
        {/if}

        <!-- Maxbit Price History -->
        {#if maxbitPrices.length > 0}
            <div
                class="price-history-list"
                class:scrollable={maxbitPrices.length > 5}
                class:compact={maxbitPrices.length > 5}
                class:ultra-compact={maxbitPrices.length > 10}
                class:micro-compact={maxbitPrices.length > 20}
            >
                <div class="history-header">
                    📋 Price History ({maxbitPrices.length})
                </div>
                {#each maxbitPrices as entry (entry.id)}
                    <div class="price-history-card">
                        <div class="history-card-header">
                            <span class="history-values">
                                <span class="bid-value">BID: {entry.bid}</span>
                                <span class="ask-value">ASK: {entry.ask}</span>
                            </span>
                            <button
                                type="button"
                                class="delete-btn"
                                on:click={() => removeMaxbitPrice(entry.id)}
                                disabled={disabled || isSubmitting}
                            >
                                ✕
                            </button>
                        </div>
                        <div class="history-timestamp">
                            {#if entry.isEditingTimestamp}
                                <input
                                    type="datetime-local"
                                    value={new Date(entry.timestamp)
                                        .toISOString()
                                        .slice(0, 16)}
                                    on:change={(e) =>
                                        handleMaxbitTimestampChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditMaxbitTimestamp(entry.id)}
                                    class="timestamp-edit-input"
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditMaxbitTimestamp(entry.id)}
                                    style="cursor: pointer; display: inline-block;"
                                >
                                    📅 {formatBrokerTimestamp(entry.timestamp)}
                                </span>
                            {/if}
                        </div>
                        <div class="history-note">
                            {#if entry.isEditingNote}
                                <input
                                    type="text"
                                    value={entry.note || ""}
                                    on:change={(e) =>
                                        handleMaxbitNoteChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditMaxbitNote(entry.id)}
                                    on:keydown={(e) => {
                                        if (e.key === "Enter") {
                                            handleMaxbitNoteChange(
                                                entry.id,
                                                e.currentTarget.value,
                                            );
                                        }
                                    }}
                                    class="note-edit-input"
                                    placeholder="Add note..."
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditMaxbitNote(entry.id)}
                                    style="cursor: pointer;"
                                    title="Click to edit note"
                                >
                                    📝 {entry.note || "(add note)"}
                                </span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </CollapsibleSection>

    <!-- Exchange Section -->
    <CollapsibleSection
        title="Exchange (Order Book)"
        icon="📈"
        badge={exchangePrices.length || null}
    >
        <div class="section-action">
            <div class="action-group">
                {#if exchangeFetchTime}
                    <span class="fetch-time">Drawn at: {exchangeFetchTime}</span
                    >
                {/if}

                {#if effectivePriceMode === "manual"}
                    <button
                        type="button"
                        class="fetch-btn"
                        on:click={fetchExchangePrices}
                        disabled={disabled ||
                            isSubmitting ||
                            isFetchingExchange}
                    >
                        {#if isFetchingExchange}
                            ⏳ Loading...
                        {:else}
                            🔄 Fetch Order Book
                        {/if}
                    </button>
                {/if}

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
                    <div class="order-book-header bitkub">
                        <img
                            src={BROKER_METADATA.Bitkub.logo}
                            alt=""
                            class="header-logo"
                        />
                        Bitkub
                        {#if isEditing}
                            <span class="hist-label">(Saved Snapshot)</span>
                        {/if}
                    </div>
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
                    <div class="order-book-header binance">
                        <img
                            src={BROKER_METADATA.BinanceTH.logo}
                            alt=""
                            class="header-logo"
                        />
                        BinanceTH
                        {#if isEditing}
                            <span class="hist-label">(Saved Snapshot)</span>
                        {/if}
                    </div>
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
        {:else if isEditing}
            <div class="no-snapshot-msg">
                <span class="warn-icon">📋</span>
                <p>No Order Book Snapshot for this session</p>
                <small
                    >Previous sessions might not have saved order book depth</small
                >
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

        <!-- Save Exchange Price Section -->
        <div class="save-price-section">
            <button
                type="button"
                class="save-price-btn"
                on:click={saveExchangePrice}
                disabled={disabled ||
                    isSubmitting ||
                    (!exchange1Bid &&
                        !exchange1Ask &&
                        !exchange2Bid &&
                        !exchange2Ask)}
            >
                💾 Save Price
            </button>
        </div>

        <!-- Exchange Price History -->
        {#if exchangePrices.length > 0}
            <div
                class="price-history-list"
                class:scrollable={exchangePrices.length > 5}
                class:compact={exchangePrices.length > 5}
                class:ultra-compact={exchangePrices.length > 10}
                class:micro-compact={exchangePrices.length > 20}
            >
                <div class="history-header">
                    📋 Price History ({exchangePrices.length})
                </div>
                {#each exchangePrices as entry (entry.id)}
                    <div class="price-history-card exchange-price-card">
                        <div class="history-card-header">
                            <span class="exchange-info"
                                >{entry.exchange1} vs {entry.exchange2}</span
                            >
                            <button
                                type="button"
                                class="delete-btn"
                                on:click={() => removeExchangePrice(entry.id)}
                                disabled={disabled || isSubmitting}
                            >
                                ✕
                            </button>
                        </div>
                        <div class="exchange-price-details">
                            <div class="exchange-row">
                                <span class="exchange-name"
                                    >{entry.exchange1}:</span
                                >
                                <span class="bid-value"
                                    >BID {entry.exchange1Bid}</span
                                >
                                <span class="ask-value"
                                    >ASK {entry.exchange1Ask}</span
                                >
                            </div>
                            <div class="exchange-row">
                                <span class="exchange-name"
                                    >{entry.exchange2}:</span
                                >
                                <span class="bid-value"
                                    >BID {entry.exchange2Bid}</span
                                >
                                <span class="ask-value"
                                    >ASK {entry.exchange2Ask}</span
                                >
                            </div>
                            {#if entry.diff}
                                <div class="exchange-diff">
                                    Diff: {entry.diff} | Higher: {entry.higher}
                                </div>
                            {/if}
                        </div>
                        <div class="history-timestamp">
                            {#if entry.isEditingTimestamp}
                                <input
                                    type="datetime-local"
                                    value={new Date(entry.timestamp)
                                        .toISOString()
                                        .slice(0, 16)}
                                    on:change={(e) =>
                                        handleExchangeTimestampChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditExchangeTimestamp(entry.id)}
                                    class="timestamp-edit-input"
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditExchangeTimestamp(entry.id)}
                                    style="cursor: pointer; display: inline-block;"
                                >
                                    📅 {formatBrokerTimestamp(entry.timestamp)}
                                </span>
                            {/if}
                        </div>
                        <div class="history-note">
                            {#if entry.isEditingNote}
                                <input
                                    type="text"
                                    value={entry.note || ""}
                                    on:change={(e) =>
                                        handleExchangeNoteChange(
                                            entry.id,
                                            e.currentTarget.value,
                                        )}
                                    on:blur={() =>
                                        toggleEditExchangeNote(entry.id)}
                                    on:keydown={(e) => {
                                        if (e.key === "Enter") {
                                            handleExchangeNoteChange(
                                                entry.id,
                                                e.currentTarget.value,
                                            );
                                        }
                                    }}
                                    class="note-edit-input"
                                    placeholder="Add note..."
                                />
                            {:else}
                                <span
                                    on:click={() =>
                                        toggleEditExchangeNote(entry.id)}
                                    style="cursor: pointer;"
                                    title="Click to edit note"
                                >
                                    📝 {entry.note || "(add note)"}
                                </span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
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
                    🔄 Fetch Today's Data
                {/if}
            </button>
        </div>

        <!-- Fetched OTC Orders (Compact View) -->
        {#if fetchedOtcTransactions.length > 0}
            <div class="fetched-orders">
                <div class="fetched-orders-header">
                    <span
                        >📋 Today ({timeFilteredOtcTransactions.length} items)</span
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
                                <span class="order-rate"
                                    >@{tx.rate?.toFixed(2) || "-"}</span
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

        <div class="field">
            <label>OTC Notes</label>
            <textarea
                bind:value={otcNotes}
                placeholder="OTC observations..."
                rows="2"
                disabled={disabled || isSubmitting}
            ></textarea>
        </div>

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
            <label>Prefund Status Notes</label>
            <textarea
                bind:value={prefundNotes}
                placeholder="Prefund status observations..."
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
            ⏳ {isEditing ? "Updating..." : "Saving..."}
        {:else}
            {isEditing ? "Update Session" : "Create Session"}
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

    /* Mode Card & Toggles */
    .mode-card {
        background: var(--color-bg);
        border-radius: 16px;
        padding: 1rem 1.25rem;
        border: 1px solid var(--color-border-light);
        margin-bottom: 0.5rem;
    }

    .mode-card.is-editing {
        background: rgba(255, 149, 0, 0.05);
        border-color: rgba(255, 149, 0, 0.2);
    }

    .edit-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .banner-icon {
        font-size: 1.5rem;
    }

    .banner-content strong {
        display: block;
        font-size: 0.875rem;
        color: #af5200;
    }

    .banner-content p {
        margin: 0;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
    }

    .mode-selector {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .mode-info .mode-label {
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--color-text);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .mode-info .mode-desc {
        margin: 0;
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .hist-label {
        font-size: 0.625rem;
        font-weight: 500;
        opacity: 0.8;
        margin-left: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .status-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        background: #34c759;
        border-radius: 50%;
        margin-right: 4px;
        box-shadow: 0 0 0 2px rgba(52, 199, 89, 0.2);
    }

    .mode-btn.live.active .status-dot {
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.4);
        }
        70% {
            box-shadow: 0 0 0 6px rgba(52, 199, 89, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
        }
    }

    /* Auto-Save Controls */
    .auto-save-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border-color);
    }

    .auto-save-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        user-select: none;
    }

    .auto-save-toggle input[type="checkbox"] {
        width: 36px;
        height: 20px;
        appearance: none;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        position: relative;
        cursor: pointer;
        transition: background 0.2s;
    }

    .auto-save-toggle input[type="checkbox"]:checked {
        background: #34c759;
    }

    .auto-save-toggle input[type="checkbox"]::before {
        content: "";
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
    }

    .auto-save-toggle input[type="checkbox"]:checked::before {
        transform: translateX(16px);
    }

    .toggle-label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text);
    }

    .toggle-slider {
        display: none;
    }

    .interval-selector {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
    }

    .interval-selector select {
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid var(--border-color);
        color: var(--color-text);
        font-size: 0.75rem;
        cursor: pointer;
    }

    .auto-save-count {
        font-size: 0.6875rem;
        color: #34c759;
        font-weight: 500;
    }

    .no-snapshot-msg {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem;
        background: rgba(255, 149, 0, 0.05);
        border: 1px dashed rgba(255, 149, 0, 0.3);
        border-radius: 12px;
        text-align: center;
    }

    .no-snapshot-msg .warn-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }

    .no-snapshot-msg p {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: #af5200;
    }

    .no-snapshot-msg small {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
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

    .fx-snapshot-container,
    .broker-snapshot-container {
        padding: 0;
        transition: all 0.2s;
    }

    .fx-snapshot-container:has(.snapshot-header),
    .broker-snapshot-container:has(.snapshot-header) {
        padding: 1.5rem;
        background: #ffffff;
        border-radius: 12px;
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
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    .order-book-header .header-logo {
        width: 16px;
        height: 16px;
        object-fit: contain;
        border-radius: 3px;
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
        white-space: nowrap;
        min-width: max-content;
        -webkit-text-size-adjust: 100%;
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
        white-space: nowrap;
        min-width: max-content;
        -webkit-text-size-adjust: 100%;
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

    .order-rate {
        color: var(--color-primary);
        font-family: var(--font-family-mono, monospace);
        font-weight: 600;
        font-size: 0.6875rem;
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

    /* Price Mode Toggle */
    .price-mode-toggle {
        display: flex;
        background: var(--color-bg-secondary);
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--color-border-light);
    }

    .mode-btn {
        padding: 0.25rem 0.5rem;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        background: transparent;
        border: none;
        cursor: pointer;
        transition: all 0.15s;
    }

    .mode-btn:hover {
        color: var(--color-text-secondary);
        background: rgba(0, 0, 0, 0.03);
    }

    .mode-btn.active {
        color: var(--color-text);
        background: var(--color-bg);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .mode-btn.live.active {
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
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

    /* Broker Prices Styles */
    .broker-price-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        background: rgba(0, 122, 255, 0.03);
        border: 1px solid rgba(0, 122, 255, 0.15);
        border-radius: 12px;
    }

    .broker-price-inputs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .broker-price-time {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: rgba(52, 199, 89, 0.1);
        border-radius: 8px;
        font-size: 0.8125rem;
    }

    .broker-price-time .time-label {
        font-size: 1rem;
    }

    .broker-price-time .time-value {
        flex: 1;
        color: var(--color-text);
        font-weight: 500;
    }

    .broker-price-time .time-auto {
        color: #34c759;
        font-weight: 600;
        font-size: 0.75rem;
    }

    .broker-form-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }

    .broker-form-actions .cancel-btn {
        padding: 0.5rem 1rem;
        background: #f0f0f5;
        border: 1px solid #d1d1d6;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 500;
        color: #3a3a3c;
        cursor: pointer;
        transition: all 0.15s;
    }

    .broker-form-actions .cancel-btn:hover {
        background: #e5e5ea;
    }

    .broker-form-actions .save-btn {
        padding: 0.5rem 1rem;
        background: linear-gradient(135deg, #007aff, #5856d6);
        border: none;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        color: white;
        cursor: pointer;
        transition: all 0.15s;
    }

    .broker-form-actions .save-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
    }

    .broker-form-actions .save-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .broker-price-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.75rem;
    }

    .broker-price-card {
        padding: 0.75rem;
        background: var(--color-bg);
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        transition: all 0.15s;
    }

    .broker-price-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .broker-price-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.375rem;
    }

    .broker-price-header .broker-name {
        font-weight: 700;
        font-size: 0.9375rem;
        color: var(--color-text);
    }

    .broker-price-header .delete-btn {
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 59, 48, 0.1);
        border: none;
        border-radius: 50%;
        color: #ff3b30;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
    }

    .broker-price-header .delete-btn:hover:not(:disabled) {
        background: rgba(255, 59, 48, 0.2);
    }

    .broker-price-header .delete-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .broker-price-values {
        display: flex;
        gap: 1rem;
        margin-bottom: 0.25rem;
    }

    .broker-price-values .bid-value,
    .broker-price-values .ask-value {
        font-size: 0.875rem;
        font-weight: 500;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
    }

    .broker-price-values .bid-value {
        color: #34c759;
        background: rgba(52, 199, 89, 0.1);
    }

    .broker-price-values .ask-value {
        color: #ff3b30;
        background: rgba(255, 59, 48, 0.1);
    }

    .broker-price-timestamp {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .broker-price-note {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        margin-top: 0.25rem;
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 4px;
    }

    /* Save Price Section */
    .save-price-section {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px dashed var(--color-border-light);
    }

    .save-price-row {
        display: flex;
        gap: 0.5rem;
        align-items: stretch;
    }

    .save-note-input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        font-size: 0.875rem;
    }

    .save-price-btn {
        padding: 0.5rem 1rem;
        background: linear-gradient(135deg, #34c759, #30b050);
        border: none;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        color: white;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s;
    }

    .save-price-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(52, 199, 89, 0.25);
    }

    .save-price-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Price History List */
    .price-history-list {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-border-light);
    }

    .history-header {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        margin-bottom: 0.5rem;
    }

    .price-history-card {
        padding: 0.5rem 0.75rem;
        background: var(--color-bg);
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        margin-bottom: 0.375rem;
        transition: all 0.2s ease;
    }

    /* Scrollable container for many items */
    .price-history-list.scrollable {
        max-height: 280px;
        overflow-y: auto;
        padding-right: 0.25rem;
    }

    /* Compact mode for >5 entries */
    .price-history-list.compact .price-history-card {
        padding: 0.25rem 0.4rem;
        margin-bottom: 0.15rem;
    }

    .price-history-list.compact .history-value {
        font-size: 0.75rem;
    }

    .price-history-list.compact .history-timestamp,
    .price-history-list.compact .history-note {
        font-size: 0.5625rem;
    }

    /* Ultra-compact mode for >10 entries */
    .price-history-list.ultra-compact .price-history-card {
        padding: 0.15rem 0.3rem;
        margin-bottom: 0.1rem;
        border-radius: 3px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
    }

    .price-history-list.ultra-compact .history-value {
        font-size: 0.625rem;
    }

    .price-history-list.ultra-compact .history-timestamp {
        display: inline;
        font-size: 0.5rem;
        opacity: 0.7;
    }

    .price-history-list.ultra-compact .history-card-header {
        flex-wrap: nowrap;
        gap: 0.2rem;
    }

    .price-history-list.ultra-compact .history-note {
        font-size: 0.5rem;
        margin-top: 0;
        padding: 0;
        background: none;
    }

    .price-history-list.ultra-compact .delete-btn {
        padding: 0.1rem 0.2rem;
        font-size: 0.5rem;
    }

    /* Micro-compact mode for >20 entries - single line per entry */
    .price-history-list.micro-compact .price-history-card {
        padding: 0.1rem 0.25rem;
        margin-bottom: 0.05rem;
        border-radius: 2px;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        border: none;
        background: rgba(255, 255, 255, 0.03);
    }

    .price-history-list.micro-compact .history-value {
        font-size: 0.5625rem;
        font-weight: 600;
    }

    .price-history-list.micro-compact .history-values {
        gap: 0.25rem;
        font-size: 0.5rem;
    }

    .price-history-list.micro-compact .history-timestamp {
        font-size: 0.4375rem;
        opacity: 0.6;
    }

    .price-history-list.micro-compact .history-note {
        display: inline;
        font-size: 0.4375rem;
        margin-left: 0.25rem;
        opacity: 0.7;
    }

    .price-history-list.micro-compact .history-note span {
        font-size: 0.4375rem;
    }

    .price-history-list.micro-compact .history-note input {
        font-size: 0.4375rem;
        padding: 1px 3px;
        min-width: 80px;
    }

    .price-history-list.micro-compact .delete-btn {
        padding: 0 0.15rem;
        font-size: 0.4375rem;
        opacity: 0.5;
    }

    .price-history-list.micro-compact .history-card-header {
        width: 100%;
    }

    .history-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .history-value {
        font-weight: 700;
        font-size: 1rem;
        color: var(--color-text);
    }

    .history-values {
        display: flex;
        gap: 0.5rem;
    }

    .history-timestamp {
        font-size: 0.6875rem;
        color: var(--color-text-tertiary);
        margin-top: 0.125rem;
    }

    .history-note {
        font-size: 0.6875rem;
        color: var(--color-text-secondary);
        margin-top: 0.25rem;
        padding: 0.125rem 0.375rem;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 4px;
    }

    .timestamp-edit-input {
        font-size: 0.75rem;
        padding: 2px 4px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: white;
        width: 100%;
        margin-top: 4px;
    }

    .note-edit-input {
        font-size: 0.6875rem;
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: white;
        color: var(--color-text);
        width: 100%;
        min-width: 120px;
    }

    .history-note span {
        cursor: pointer;
        opacity: 0.8;
    }

    .history-note span:hover {
        opacity: 1;
        text-decoration: underline;
    }
</style>
