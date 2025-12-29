<script lang="ts">
    import { page } from "$app/stores";
    import { onMount, tick } from "svelte";
    import {
        getSession,
        deleteSession,
        type OplogSession,
    } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import { goto } from "$app/navigation";
    import { isSupabaseConfigured } from "$lib/supabaseClient";
    import MarketChart from "$lib/components/MarketChart.svelte";
    import { getMarketDataRange, type MarketDataPoint } from "$lib/api/market";
    import { combineDateTime, addHours } from "$lib/utils/date";
    import PrefundTracker from "$lib/components/PrefundTracker.svelte";
    import ChatLog from "$lib/components/ChatLog.svelte";
    import {
        getChatMessagesForTimeRange,
        type ChatMessage,
    } from "$lib/api/chatlog";
    import AISummary from "$lib/components/AISummary.svelte";
    import { BROKER_METADATA, EXCHANGES } from "$lib/config/tradingConfig";

    $: sessionId = $page.params.id;

    let session: OplogSession | null = null;
    let isLoading = true;
    let isExporting = false;
    let supabaseReady = false;
    let showExportMenu = false;

    // Chart Data
    let marketData: Record<string, MarketDataPoint[]> = {};
    let chartLoading = false;
    let availableSources: string[] = [];

    // Chat Log State
    let chatMessages: ChatMessage[] = [];
    let chatLoading = false;

    $: bitkubBook = session?.market_context?.bitkub;
    $: binanceBook = session?.market_context?.binanceTH;

    const sourceColors: Record<string, string> = {
        bitkub: "#27AE60", // Green
        binance_th: "#F3BA2F", // Yellow/Gold
        maxbit: "#0ea5e9", // Sky Blue (ฟ้าคราม)
        fx: "#2962FF", // Blue
    };

    const sourceNames: Record<string, string> = {
        bitkub: "Bitkub (THB)",
        binance_th: "Binance TH (THB)",
        maxbit: "Maxbit (THB)",
        fx: "USD/THB FX",
    };

    onMount(() => {
        supabaseReady = isSupabaseConfigured();
        if (supabaseReady) {
            loadSession();
        } else {
            isLoading = false;
        }

        // Close export menu when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(".export-dropdown")) {
                showExportMenu = false;
            }
        };

        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    });

    async function loadSession() {
        isLoading = true;
        try {
            if (!sessionId) return;
            session = await getSession(sessionId);
            if (!session) {
                toast.error("Session not found");
                goto("/today");
                return;
            }

            // After session loads, fetch market data
            if (session.day_id && session.start_time) {
                // We need the date from the day record.
                // Currently getSession joins day table? No, it has day_id.
                // But getSession returns OplogSession which has log_date if we modified the query or if we fetch day separately.
                // Wait, the interface OplogSession in `src/lib/api/oplog.ts` doesn't explicitly have `log_date` joined. Only `day_id`.
                // Checking `getSession` implementation:
                /* 
                 export async function getSession(session_id: string): Promise<OplogSession | null> {
                    const { data, error } = await supabase
                        .from('oplog_sessions')
                        .select(`
                      *,
                      images:oplog_session_images(*),
                      audio:oplog_session_audio(*),
                      day:oplog_days(*)
                    `)
                    ...
                */
                // Wait, I need to verify if `day` is joined. The current `getSession` I saw earlier:
                /*
                export async function getSession(session_id: string): Promise<OplogSession | null> {
                    const { data, error } = await supabase
                        .from('oplog_sessions')
                        .select(`
                      *,
                      images:oplog_session_images(*),
                      audio:oplog_session_audio(*)
                    `)
                */
                // It does NOT join `day`. I need to fetch the day or update `getSession` to join it.
                // The `listSessionsByDate` gets day first then sessions.
                // `getSession` only gets session.
                // Use `day_id` to get the date?
                // Or I can just fetch it here.

                await fetchChartData(session);
                await fetchChatLog(session);
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            toast.error("Failed to load session");
        } finally {
            isLoading = false;
        }
    }

    // Session time range for chart initial zoom (in Unix seconds)
    let sessionTimeRange: { from: number; to: number } | null = null;

    async function fetchChartData(session: any) {
        if (!session.day_id) return;

        chartLoading = true;
        try {
            const { data: dayData } = await import("$lib/supabaseClient").then(
                (m) =>
                    m.supabase
                        .from("oplog_days")
                        .select("log_date")
                        .eq("id", session.day_id)
                        .single(),
            );

            if (!dayData) return;

            const dateStr = dayData.log_date;

            // Get shift time range for fetching ALL context data
            const shiftTimes: Record<string, { start: string; end: string }> = {
                A: { start: "06:00", end: "15:00" },
                B: { start: "14:00", end: "23:00" },
                C: { start: "22:00", end: "07:00" },
            };
            const shift = session.shift || "B";
            const shiftConfig = shiftTimes[shift] || shiftTimes["B"];

            // Calculate fetch range (full shift for context)
            const fetchStart = combineDateTime(dateStr, shiftConfig.start);
            let fetchEnd = combineDateTime(dateStr, shiftConfig.end);
            if (shiftConfig.end < shiftConfig.start) {
                fetchEnd = addHours(fetchEnd, 24);
            }

            // Always extend fetchEnd to current time for better coverage
            // This ensures we always get the latest market data available
            const now = new Date();

            console.log(
                `[Chart Debug] Shift ${shift}: ${shiftConfig.start}-${shiftConfig.end}`,
            );
            console.log(
                `[Chart Debug] Fetch range before extension: ${fetchStart.toISOString()} to ${fetchEnd.toISOString()}`,
            );
            console.log(`[Chart Debug] Current time: ${now.toISOString()}`);

            // If we're past the shift start time, extend to current time
            if (now > fetchStart) {
                if (now > fetchEnd) {
                    // Past scheduled end - check if it's a recent session (within 48 hours)
                    const hoursSinceEnd =
                        (now.getTime() - fetchEnd.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceEnd < 48) {
                        fetchEnd = now;
                        console.log(
                            `[Chart Debug] Extended fetchEnd to now (session ended ${hoursSinceEnd.toFixed(1)}h ago)`,
                        );
                    }
                } else {
                    // Still within the shift - extend to current time
                    fetchEnd = now;
                    console.log(
                        `[Chart Debug] Extended fetchEnd to now (currently in shift)`,
                    );
                }
            }

            console.log(
                `[Chart Debug] Final fetch range: ${fetchStart.toISOString()} to ${fetchEnd.toISOString()}`,
            );

            // Calculate session visible range (for default zoom)
            const sessionStart = session.start_time || shiftConfig.start;
            const sessionEnd = session.end_time || shiftConfig.end;
            const visibleStart = combineDateTime(dateStr, sessionStart);
            let visibleEnd = combineDateTime(dateStr, sessionEnd);
            if (sessionEnd < sessionStart) {
                visibleEnd = addHours(visibleEnd, 24);
            }

            // Extend visible range to current time if session is ongoing
            // This ensures the chart shows the latest data by default
            if (now > visibleStart && now < visibleEnd) {
                visibleEnd = now;
                console.log(
                    `[Chart Debug] Extended visibleEnd to current time for ongoing session`,
                );
            } else if (now > visibleEnd) {
                // Session ended, but extend visible range to show latest data
                const hoursSinceEnd =
                    (now.getTime() - visibleEnd.getTime()) / (1000 * 60 * 60);
                if (hoursSinceEnd < 48) {
                    visibleEnd = now;
                    console.log(
                        `[Chart Debug] Extended visibleEnd to current time for recent session`,
                    );
                }
            }

            // Store session time range for chart zoom (Unix seconds)
            sessionTimeRange = {
                from: Math.floor(visibleStart.getTime() / 1000),
                to: Math.floor(visibleEnd.getTime() / 1000),
            };

            // Fetch full shift data for context
            const allData = await getMarketDataRange(
                fetchStart.toISOString(),
                fetchEnd.toISOString(),
            );
            console.log(
                `Chart Data Fetched for Shift ${shift} (${shiftConfig.start}-${shiftConfig.end}):`,
                allData.length,
                "points",
            );
            console.log(`Default view: ${sessionStart} - ${sessionEnd}`);

            // Group by source
            const grouped: Record<string, MarketDataPoint[]> = {};
            allData.forEach((d) => {
                if (!grouped[d.source]) grouped[d.source] = [];
                grouped[d.source].push(d);
            });

            marketData = grouped;
            availableSources = Object.keys(grouped);
        } catch (e) {
            console.error("Error fetching chart data", e);
        } finally {
            chartLoading = false;
        }
    }

    async function fetchChatLog(session: any) {
        if (!session.day_id) return;

        chatLoading = true;
        try {
            // Fetch the day record to get the log_date
            const { data: dayData } = await import("$lib/supabaseClient").then(
                (m) =>
                    m.supabase
                        .from("oplog_days")
                        .select("log_date")
                        .eq("id", session.day_id)
                        .single(),
            );

            if (!dayData) return;

            const dateStr = dayData.log_date;

            // Calculate datetime range using session start/end times
            const sessionStart = session.start_time || "00:00";
            const sessionEnd = session.end_time || "23:59";

            // IMPORTANT: Bot stores Thai local time AS IF it were UTC
            // So we need to query using Thai time values directly as UTC strings
            // (bypassing local timezone conversion)
            const startTime =
                sessionStart.length === 5 ? `${sessionStart}:00` : sessionStart;
            const endTime =
                sessionEnd.length === 5 ? `${sessionEnd}:00` : sessionEnd;

            let startStr = `${dateStr}T${startTime}.000Z`;
            let endStr = `${dateStr}T${endTime}.000Z`;

            // Handle overnight shifts
            if (sessionEnd < sessionStart) {
                // End time is next day - add 1 day
                const nextDay = new Date(dateStr);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDateStr = nextDay.toISOString().split("T")[0];
                endStr = `${nextDateStr}T${endTime}.000Z`;
            }

            console.log(
                `[ChatLog] Fetching messages from ${startStr} to ${endStr}`,
            );

            chatMessages = await getChatMessagesForTimeRange(startStr, endStr);
            console.log(`[ChatLog] Found ${chatMessages.length} messages`);
        } catch (e) {
            console.error("Error fetching chat log", e);
        } finally {
            chatLoading = false;
        }
    }

    async function handleDelete() {
        if (!session) return;
        if (!confirm("Delete this session?")) return;

        try {
            await deleteSession(session.id);
            toast.success("Session deleted");
            goto("/today");
        } catch (error) {
            console.error("Failed to delete session:", error);
            toast.error("Failed to delete session");
        }
    }

    function formatTime(time: string | null): string {
        if (!time) return "–";
        return time.slice(0, 5);
    }

    const shiftColors: Record<string, string> = {
        A: "#007AFF",
        B: "#34C759",
        C: "#AF52DE",
    };

    const exchangeDisplayNames: Record<string, string> = {
        Bitkub: "Bitkub",
        BTH: "Bitkub",
        BinanceTH: "Binance TH",
    };

    function formatExchangeName(name: string | null): string {
        if (!name) return "Exchange";
        return exchangeDisplayNames[name] || name;
    }

    async function exportToPDF() {
        if (!session) return;

        const element = document.querySelector(
            ".session-content",
        ) as HTMLElement;
        if (!element) return;

        isExporting = true;
        showExportMenu = false;
        document.body.classList.add("exporting-pdf");

        try {
            toast.info("Preparing PDF...");
            // @ts-ignore
            const html2pdf = (await import("html2pdf.js")).default;

            const opt = {
                margin: [10, 10, 10, 10] as [number, number, number, number],
                filename: `Shift_${session.shift}_${new Date().toISOString().split("T")[0]}.pdf`,
                image: { type: "jpeg" as const, quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    windowWidth: 1200,
                },
                jsPDF: {
                    unit: "mm",
                    format: "a4",
                    orientation: "portrait" as const,
                },
            };

            await html2pdf().set(opt).from(element).save();
            toast.success("PDF exported successfully");
        } catch (error) {
            console.error("PDF Export failed:", error);
            toast.error("Failed to export PDF");
        } finally {
            isExporting = false;
            document.body.classList.remove("exporting-pdf");
        }
    }

    // Field labels for display
    const FIELD_LABELS: Record<string, string> = {
        start_time: "Start Time",
        end_time: "End Time",
        broker: "Broker",
        trader: "Trader",
        head: "Head",
        recorder: "Recorder",
        fx_rate: "FX Rate",
        fx_notes: "FX Notes",
        btz_bid: "BTZ Bid",
        btz_ask: "BTZ Ask",
        btz_usdc_bid: "BTZ USDC Bid",
        btz_usdc_ask: "BTZ USDC Ask",
        btz_notes: "BTZ Notes",
        exchange1: "Exchange 1",
        exchange1_price: "Exchange 1 Price",
        exchange2: "Exchange 2",
        exchange2_price: "Exchange 2 Price",
        exchange_diff: "Exchange Diff",
        exchange_higher: "Higher Exchange",
        exchange_notes: "Exchange Notes",
        prefund_current: "Prefund Current",
        prefund_target: "Prefund Target",
        prefund_notes: "Prefund Status Notes",
        matching_notes: "Matching Notes",
        otc_notes: "OTC Notes",
        note: "Notes",
        shift: "Shift",
        broker_prices: "Manual Broker Prices",
        fx_prices: "FX Price History",
        maxbit_prices: "Maxbit Price History",
        bitazza_prices: "Bitazza Price History",
        zcom_prices: "Zcom Price History",
        xspring_prices: "Xspring Price History",
        exchange_prices: "Exchange Price History",
    };

    function formatHistoryValue(field: string, value: any): string {
        if (value === null || value === undefined || value === "")
            return "(empty)";

        // Handle arrays (e.g., price histories)
        if (Array.isArray(value)) {
            return `${value.length} items`;
        }

        // Handle objects
        if (typeof value === "object") {
            return JSON.stringify(value);
        }

        return value.toString();
    }

    function exportToTXT() {
        if (!session) return;

        isExporting = true;
        showExportMenu = false;

        try {
            toast.info("Preparing TXT export...");

            // Build comprehensive text content
            let content = "";

            // Header
            content +=
                "═══════════════════════════════════════════════════════════\n";
            content += `           OPERATION LOG - SHIFT ${session.shift}\n`;
            content +=
                "═══════════════════════════════════════════════════════════\n\n";

            // Time Range
            content += `Time Range: ${formatTime(session.start_time)} – ${formatTime(session.end_time)}\n`;
            content += `Created: ${new Date(session.created_at).toLocaleString()}\n`;
            content += "\n";

            // Team Section
            content +=
                "───────────────────────────────────────────────────────────\n";
            content += "TEAM\n";
            content +=
                "───────────────────────────────────────────────────────────\n";
            content += `Broker:   ${session.broker}\n`;
            content += `Trader:   ${session.trader}\n`;
            content += `Head:     ${session.head}\n`;
            if (session.recorder) {
                content += `Recorder: ${session.recorder}\n`;
            }
            content += "\n";

            // FX Section
            if (
                session.fx_rate ||
                (session.fx_prices && session.fx_prices.length > 0)
            ) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "FX SECTION\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                if (session.fx_rate) {
                    content += `Spot Rate: ${session.fx_rate} THB\n`;
                    if (session.market_context?.fxFetchTime) {
                        content += `Fetched:   ${session.market_context.fxFetchTime}\n`;
                    }
                }
                if (session.fx_notes) {
                    content += `Notes:     ${session.fx_notes}\n`;
                }

                // FX History
                if (session.fx_prices && session.fx_prices.length > 0) {
                    content += "\nPrice History:\n";
                    session.fx_prices.forEach((entry) => {
                        const time = new Date(entry.timestamp).toLocaleString(
                            "th-TH",
                        );
                        content += `  • ${entry.rate} THB [${time}]\n`;
                        if (entry.note) content += `    📝 ${entry.note}\n`;
                    });
                }
                content += "\n";
            }

            // Broker (Bitazza)
            if (session.bitazza_prices && session.bitazza_prices.length > 0) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "BROKER (BITAZZA)\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                session.bitazza_prices.forEach((entry) => {
                    const time = new Date(entry.timestamp).toLocaleString(
                        "th-TH",
                    );
                    content += `  • BID: ${entry.bid.padStart(8)}  ASK: ${entry.ask.padStart(8)} [${time}]\n`;
                    if (entry.note) content += `    📝 ${entry.note}\n`;
                });
                content += "\n";
            }

            // Broker (Zcom)
            if (session.zcom_prices && session.zcom_prices.length > 0) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "BROKER (ZCOM)\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                session.zcom_prices.forEach((entry) => {
                    const time = new Date(entry.timestamp).toLocaleString(
                        "th-TH",
                    );
                    content += `  • BID: ${entry.bid.padStart(8)}  ASK: ${entry.ask.padStart(8)} [${time}]\n`;
                    if (entry.note) content += `    📝 ${entry.note}\n`;
                });
                content += "\n";
            }

            // Broker (Xspring)
            if (session.xspring_prices && session.xspring_prices.length > 0) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "BROKER (XSPRING)\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                session.xspring_prices.forEach((entry) => {
                    const time = new Date(entry.timestamp).toLocaleString(
                        "th-TH",
                    );
                    content += `  • BID: ${entry.bid.padStart(8)}  ASK: ${entry.ask.padStart(8)} [${time}]\n`;
                    if (entry.note) content += `    📝 ${entry.note}\n`;
                });
                content += "\n";
            }

            // Broker (Maxbit)
            if (
                session.btz_bid ||
                session.btz_ask ||
                (session.maxbit_prices && session.maxbit_prices.length > 0)
            ) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "BROKER (MAXBIT)\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                if (session.btz_bid || session.btz_ask) {
                    content += `USDT BID: ${session.btz_bid || "-"}\n`;
                    content += `USDT ASK: ${session.btz_ask || "-"}\n`;
                    if (session.btz_usdc_bid || session.btz_usdc_ask) {
                        content += `USDC BID: ${session.btz_usdc_bid || "-"}\n`;
                        content += `USDC ASK: ${session.btz_usdc_ask || "-"}\n`;
                    }
                    if (session.market_context?.brokerFetchTime) {
                        content += `Fetched:  ${session.market_context.brokerFetchTime}\n`;
                    }
                    if (session.btz_notes) {
                        content += `Notes:    ${session.btz_notes}\n`;
                    }
                }

                // Maxbit History
                if (session.maxbit_prices && session.maxbit_prices.length > 0) {
                    content += "\nPrice History:\n";
                    session.maxbit_prices.forEach((entry) => {
                        const time = new Date(entry.timestamp).toLocaleString(
                            "th-TH",
                        );
                        content += `  • BID: ${entry.bid.padStart(8)}  ASK: ${entry.ask.padStart(8)} [${time}]\n`;
                        if (entry.note) content += `    📝 ${entry.note}\n`;
                    });
                }
                content += "\n";
            }

            // Exchange Comparison
            if (
                session.exchange1 ||
                session.exchange2 ||
                (session.exchange_prices && session.exchange_prices.length > 0)
            ) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "EXCHANGE COMPARISON\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                if (session.exchange1 || session.exchange2) {
                    content += `${formatExchangeName(session.exchange1)}: ${session.exchange1_price || "-"}\n`;
                    content += `${formatExchangeName(session.exchange2)}: ${session.exchange2_price || "-"}\n`;
                    content += `Difference: ${session.exchange_diff || "0.00"} (${formatExchangeName(session.exchange_higher)} higher)\n`;
                    if (session.market_context?.exchangeFetchTime) {
                        content += `Fetched: ${session.market_context.exchangeFetchTime}\n`;
                    }
                }

                // Exchange History
                if (
                    session.exchange_prices &&
                    session.exchange_prices.length > 0
                ) {
                    content += "\nPrice History:\n";
                    session.exchange_prices.forEach((entry) => {
                        const time = new Date(entry.timestamp).toLocaleString(
                            "th-TH",
                        );
                        content += `  • ${entry.exchange1} (${entry.exchange1Bid}/${entry.exchange1Ask}) vs ${entry.exchange2} (${entry.exchange2Bid}/${entry.exchange2Ask}) [${time}]\n`;
                        if (entry.diff)
                            content += `    Diff: ${entry.diff} (${entry.higher} higher)\n`;
                        if (entry.note) content += `    📝 ${entry.note}\n`;
                    });
                }

                // Order Book Snapshots
                if (bitkubBook || binanceBook) {
                    content += "\nOrder Book Snapshots (Top 5):\n\n";

                    if (bitkubBook) {
                        content += "  BITKUB:\n";
                        content +=
                            "  ┌────────────────────────────┬────────────────────────────┐\n";
                        content +=
                            "  │     BID (Price/Amt)        │     ASK (Price/Amt)        │\n";
                        content +=
                            "  ├────────────────────────────┼────────────────────────────┤\n";
                        for (let i = 0; i < 5; i++) {
                            const bid = bitkubBook.bids[i];
                            const ask = bitkubBook.asks[i];
                            const bidStr = bid
                                ? `${bid.price.toFixed(2).padStart(11)} / ${bid.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).padStart(12)}`
                                : "-".padStart(26);
                            const askStr = ask
                                ? `${ask.price.toFixed(2).padStart(11)} / ${ask.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).padStart(12)}`
                                : "-".padStart(26);
                            content += `  │ ${bidStr} │ ${askStr} │\n`;
                        }
                        content +=
                            "  └────────────────────────────┴────────────────────────────┘\n\n";
                    }

                    if (binanceBook) {
                        content += "  BINANCETH:\n";
                        content +=
                            "  ┌────────────────────────────┬────────────────────────────┐\n";
                        content +=
                            "  │     BID (Price/Amt)        │     ASK (Price/Amt)        │\n";
                        content +=
                            "  ├────────────────────────────┼────────────────────────────┤\n";
                        for (let i = 0; i < 5; i++) {
                            const bid = binanceBook.bids[i];
                            const ask = binanceBook.asks[i];
                            const bidStr = bid
                                ? `${bid.price.toFixed(2).padStart(11)} / ${bid.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).padStart(12)}`
                                : "-".padStart(26);
                            const askStr = ask
                                ? `${ask.price.toFixed(2).padStart(11)} / ${ask.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).padStart(12)}`
                                : "-".padStart(26);
                            content += `  │ ${bidStr} │ ${askStr} │\n`;
                        }
                        content +=
                            "  └────────────────────────────┴────────────────────────────┘\n\n";
                    }
                }

                if (session.exchange_notes) {
                    content += `Exchange Notes: ${session.exchange_notes}\n`;
                }
                content += "\n";
            }

            // Broker Prices (Manual Entry)
            if (session.broker_prices && session.broker_prices.length > 0) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "BROKER PRICES (USDT/THB) - Manual Entry\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                session.broker_prices.forEach((entry: any) => {
                    const time = new Date(entry.timestamp).toLocaleString(
                        "th-TH",
                    );
                    content += `${entry.broker.padEnd(10)} BID: ${entry.bid.padStart(8)}  ASK: ${entry.ask.padStart(8)}  [${time}]\n`;
                    if (entry.note) {
                        content += `           📝 ${entry.note}\n`;
                    }
                });
                content += "\n";
            }

            // OTC Operations
            if (
                (session.otc_transactions &&
                    session.otc_transactions.length > 0) ||
                session.prefund_current
            ) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "OTC OPERATIONS\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";

                if (
                    session.otc_transactions &&
                    session.otc_transactions.length > 0
                ) {
                    content += "\nTransactions:\n";
                    content +=
                        "┌──────────────────────────┬────────┬────────────────────┬────────────────────┬──────────┐\n";
                    content +=
                        "│ Customer                 │ Action │ Amount             │ Total (THB)        │ Status   │\n";
                    content +=
                        "├──────────────────────────┼────────┼────────────────────┼────────────────────┼──────────┤\n";
                    session.otc_transactions.forEach((tx: any) => {
                        const customer = tx.customerName
                            .substring(0, 24)
                            .padEnd(24);
                        const action = tx.action.padEnd(6);
                        const amount =
                            `${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${tx.currency}`.padEnd(
                                18,
                            );
                        const total =
                            `฿${(tx.total || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.padEnd(
                                18,
                            );
                        const status = (tx.status || "-").padEnd(8);
                        content += `│ ${customer} │ ${action} │ ${amount} │ ${total} │ ${status} │\n`;
                    });
                    content +=
                        "└──────────────────────────┴────────┴────────────────────┴────────────────────┴──────────┘\n\n";
                }

                // Prefund Status
                if (
                    session.prefund_current !== null ||
                    session.prefund_target !== null
                ) {
                    const current = session.prefund_current || 0;
                    const target = session.prefund_target || 760000;
                    const percentage =
                        target > 0
                            ? ((current / target) * 100).toFixed(1)
                            : "0.0";
                    content += "Prefund Status:\n";
                    content += `  Current: ${current.toLocaleString()} USDT\n`;
                    content += `  Target:  ${target.toLocaleString()} USDT\n`;
                    content += `  Progress: ${percentage}%\n\n`;
                }

                if (session.matching_notes) {
                    content += `Matching Notes: ${session.matching_notes}\n`;
                }
                if (session.otc_notes) {
                    content += `OTC Notes: ${session.otc_notes}\n`;
                }
                content += "\n";
            }

            // Status Section
            if (
                session.market_mode ||
                session.inventory_status ||
                session.risk_flag ||
                session.execution_issue
            ) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "STATUS\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                if (session.market_mode) {
                    content += `Market Mode:      ${session.market_mode}\n`;
                }
                if (session.inventory_status) {
                    content += `Inventory:        ${session.inventory_status}\n`;
                }
                if (session.risk_flag) {
                    content += `Risk Flag:        ${session.risk_flag}\n`;
                }
                if (session.execution_issue) {
                    content += `Execution Issue:  ${session.execution_issue}\n`;
                }
                content += "\n";
            }

            // Performance Section
            if (session.pnl_snapshot !== null || session.action_taken) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "PERFORMANCE\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                if (session.pnl_snapshot !== null) {
                    const pnlStr =
                        session.pnl_snapshot >= 0
                            ? `+${session.pnl_snapshot.toLocaleString()}`
                            : session.pnl_snapshot.toLocaleString();
                    content += `P&L Snapshot: ${pnlStr}\n`;
                }
                if (session.action_taken) {
                    content += `Action Taken: ${session.action_taken}\n`;
                }
                content += "\n";
            }

            // General Notes
            if (session.note) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "NOTES\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += `${session.note}\n\n`;
            }

            // Media Attachments
            if (
                (session.images && session.images.length > 0) ||
                (session.audio && session.audio.length > 0)
            ) {
                content +=
                    "───────────────────────────────────────────────────────────\n";
                content += "MEDIA ATTACHMENTS\n";
                content +=
                    "───────────────────────────────────────────────────────────\n";

                if (session.images && session.images.length > 0) {
                    content += `\nPhotos (${session.images.length}):\n`;
                    session.images.forEach((img: any, idx: number) => {
                        content += `  ${idx + 1}. ${img.public_url}\n`;
                    });
                    content += "\n";
                }

                if (session.audio && session.audio.length > 0) {
                    content += `Audio Files (${session.audio.length}):\n`;
                    session.audio.forEach((aud: any, idx: number) => {
                        const time = new Date(
                            aud.created_at,
                        ).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                        content += `  ${idx + 1}. [${time}] ${aud.public_url}\n`;
                        if (aud.notes) {
                            content += `     Note: ${aud.notes}\n`;
                        }
                        if (aud.transcript) {
                            content += `     Transcript: ${aud.transcript}\n`;
                        }
                    });
                    content += "\n";
                }
            }

            // Footer
            content +=
                "═══════════════════════════════════════════════════════════\n";
            content += "End of Operation Log\n";
            content +=
                "═══════════════════════════════════════════════════════════\n";

            // Create and download file
            const blob = new Blob([content], {
                type: "text/plain;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Shift_${session.shift}_${new Date().toISOString().split("T")[0]}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success("TXT exported successfully");
        } catch (error) {
            console.error("TXT Export failed:", error);
            toast.error("Failed to export TXT");
        } finally {
            isExporting = false;
        }
    }
</script>

<svelte:head>
    <title>Session Details - OpLogs</title>
</svelte:head>

<div class="session-detail-page">
    <header class="page-header">
        <button class="back-btn" on:click={() => history.back()}>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
            >
                <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
        </button>

        <a href="/session/{sessionId}/edit" class="edit-btn">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path
                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                />
                <path
                    d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                />
            </svg>
            <span>Edit</span>
        </a>

        <div class="export-dropdown">
            <button
                class="export-btn"
                on:click={() => (showExportMenu = !showExportMenu)}
                disabled={isExporting}
            >
                {#if isExporting}
                    <div class="spinner-tiny"></div>
                    <span>Exporting...</span>
                {:else}
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Export</span>
                    <svg
                        class="chevron"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                {/if}
            </button>

            {#if showExportMenu && !isExporting}
                <div class="export-menu">
                    <button class="export-menu-item" on:click={exportToPDF}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                            />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        <span>Export as PDF</span>
                    </button>
                    <button class="export-menu-item" on:click={exportToTXT}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                            />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                            <line x1="10" y1="16" x2="14" y2="16" />
                        </svg>
                        <span>Export as TXT</span>
                    </button>
                </div>
            {/if}
        </div>
    </header>

    {#if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    {:else if session}
        <div class="session-content">
            <div class="session-header">
                <div
                    class="shift-badge"
                    style="background: {shiftColors[session.shift]}"
                >
                    Shift {session.shift}
                </div>
                <div class="time-range">
                    {formatTime(session.start_time)} – {formatTime(
                        session.end_time,
                    )}
                </div>
            </div>

            <!-- Market Charts -->
            {#if chartLoading}
                <div class="loading-charts">
                    <div class="spinner-small"></div>
                    <span>Loading market data...</span>
                </div>
            {:else if availableSources.length > 0}
                <div class="charts-section">
                    <h3>Market Context (Shift {session.shift})</h3>
                    <div class="charts-grid">
                        {#each availableSources as source}
                            <MarketChart
                                data={marketData[source]}
                                title={sourceNames[source] || source}
                                color={sourceColors[source] || "#2962FF"}
                                height={250}
                                visibleRange={sessionTimeRange}
                            />
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="no-data-message">
                    <p>
                        No market data found for Shift {session.shift}.
                    </p>
                </div>
            {/if}

            <div class="detail-card">
                <h3>Team</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">Broker</span>
                        <span class="value">{session.broker}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Trader</span>
                        <span class="value">{session.trader}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Head</span>
                        <span class="value">{session.head}</span>
                    </div>
                    {#if session.recorder}
                        <div class="detail-item">
                            <span class="label">Recorder</span>
                            <span class="value">{session.recorder}</span>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Broker Prices (Manual) -->
            {#if session.broker_prices && session.broker_prices.length > 0}
                <div class="detail-card">
                    <div class="card-header-with-logo">
                        <span
                            class="header-logo"
                            style="font-size: 1.5rem; display: flex; align-items: center; justify-content: center;"
                            >⚖️</span
                        >
                        <h3>Broker Prices (Manual)</h3>
                    </div>
                    <div class="broker-prices-list">
                        {#each session.broker_prices as entry}
                            <div class="broker-price-entry">
                                <div class="broker-entry-header">
                                    <span class="broker-entry-name"
                                        >{entry.broker}</span
                                    >
                                    <span class="broker-entry-time"
                                        >{new Date(
                                            entry.timestamp,
                                        ).toLocaleString("th-TH")}</span
                                    >
                                </div>
                                <div class="broker-entry-values">
                                    <span class="bid-badge"
                                        >BID {entry.bid}</span
                                    >
                                    <span class="ask-badge"
                                        >ASK {entry.ask}</span
                                    >
                                </div>
                                {#if entry.note}
                                    <div class="broker-entry-note">
                                        📝 {entry.note}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- FX Section -->
            {#if session.fx_rate || (session.fx_prices && session.fx_prices.length > 0)}
                <div class="detail-card">
                    <div class="card-header-with-logo">
                        <img
                            src={BROKER_METADATA.Google.logo}
                            alt="Google"
                            class="header-logo"
                        />
                        <h3>FX Section</h3>
                        {#if session.market_context?.fxFetchTime}
                            <span class="header-time"
                                >Fetched: {session.market_context
                                    .fxFetchTime}</span
                            >
                        {/if}
                    </div>

                    {#if session.fx_rate}
                        <div class="detail-grid" style="margin-bottom: 1rem;">
                            <div class="detail-item">
                                <span class="label">Spot Rate</span>
                                <span class="value">{session.fx_rate} THB</span>
                            </div>
                            {#if session.fx_notes}
                                <div
                                    class="detail-item"
                                    style="grid-column: span 2"
                                >
                                    <span class="label">FX Notes</span>
                                    <span class="value">{session.fx_notes}</span
                                    >
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if session.fx_prices && session.fx_prices.length > 0}
                        <div class="history-section-embedded">
                            <h4>
                                📋 Price History ({session.fx_prices.length})
                            </h4>
                            <div class="price-history-list">
                                {#each session.fx_prices as entry}
                                    <div class="price-history-entry">
                                        <div class="entry-header">
                                            <span class="entry-value"
                                                >{entry.rate} THB</span
                                            >
                                            <span class="entry-time"
                                                >{new Date(
                                                    entry.timestamp,
                                                ).toLocaleString("th-TH")}</span
                                            >
                                        </div>
                                        {#if entry.note}
                                            <div class="entry-note">
                                                📝 {entry.note}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Broker (Bitazza) -->
            {#if session.bitazza_prices && session.bitazza_prices.length > 0}
                <div class="detail-card">
                    <div class="card-header-with-logo">
                        <img
                            src={BROKER_METADATA.Bitazza.logo}
                            alt="Bitazza"
                            class="header-logo"
                        />
                        <h3>Broker (Bitazza)</h3>
                    </div>

                    <div class="history-section-embedded">
                        <h4>
                            📋 Price History ({session.bitazza_prices.length})
                        </h4>
                        <div class="price-history-list">
                            {#each session.bitazza_prices as entry}
                                <div class="price-history-entry">
                                    <div class="entry-header">
                                        <span class="entry-values">
                                            <span class="bid-badge"
                                                >BID: {entry.bid}</span
                                            >
                                            <span class="ask-badge"
                                                >ASK: {entry.ask}</span
                                            >
                                        </span>
                                        <span class="entry-time"
                                            >{new Date(
                                                entry.timestamp,
                                            ).toLocaleString("th-TH")}</span
                                        >
                                    </div>
                                    {#if entry.note}
                                        <div class="entry-note">
                                            📝 {entry.note}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Broker (Zcom) -->
            {#if session.zcom_prices && session.zcom_prices.length > 0}
                <div class="detail-card">
                    <div class="card-header-with-logo">
                        <img
                            src={BROKER_METADATA.Zcom.logo}
                            alt="Zcom"
                            class="header-logo"
                            style="transform: scale(1.5);"
                        />
                        <h3>Broker (Zcom)</h3>
                    </div>

                    <div class="history-section-embedded">
                        <h4>📋 Price History ({session.zcom_prices.length})</h4>
                        <div class="price-history-list">
                            {#each session.zcom_prices as entry}
                                <div class="price-history-entry">
                                    <div class="entry-header">
                                        <span class="entry-values">
                                            <span class="bid-badge"
                                                >BID: {entry.bid}</span
                                            >
                                            <span class="ask-badge"
                                                >ASK: {entry.ask}</span
                                            >
                                        </span>
                                        <span class="entry-time"
                                            >{new Date(
                                                entry.timestamp,
                                            ).toLocaleString("th-TH")}</span
                                        >
                                    </div>
                                    {#if entry.note}
                                        <div class="entry-note">
                                            📝 {entry.note}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Broker (Xspring) -->
            {#if session.xspring_prices && session.xspring_prices.length > 0}
                <div class="detail-card">
                    <div class="card-header-with-logo">
                        <img
                            src={BROKER_METADATA.Xspring.logo}
                            alt="Xspring"
                            class="header-logo"
                            style="transform: scale(1.4);"
                        />
                        <h3>Broker (Xspring)</h3>
                    </div>

                    <div class="history-section-embedded">
                        <h4>
                            📋 Price History ({session.xspring_prices.length})
                        </h4>
                        <div class="price-history-list">
                            {#each session.xspring_prices as entry}
                                <div class="price-history-entry">
                                    <div class="entry-header">
                                        <span class="entry-values">
                                            <span class="bid-badge"
                                                >BID: {entry.bid}</span
                                            >
                                            <span class="ask-badge"
                                                >ASK: {entry.ask}</span
                                            >
                                        </span>
                                        <span class="entry-time"
                                            >{new Date(
                                                entry.timestamp,
                                            ).toLocaleString("th-TH")}</span
                                        >
                                    </div>
                                    {#if entry.note}
                                        <div class="entry-note">
                                            📝 {entry.note}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Broker (Maxbit) -->
            {#if session.btz_bid || session.btz_ask || (session.maxbit_prices && session.maxbit_prices.length > 0)}
                <div class="detail-card">
                    <div class="card-header-with-logo">
                        <img
                            src={BROKER_METADATA.Maxbit.logo}
                            alt="Maxbit"
                            class="header-logo"
                        />
                        <h3>Broker (Maxbit)</h3>
                        {#if session.market_context?.brokerFetchTime}
                            <span class="header-time"
                                >Fetched: {session.market_context
                                    .brokerFetchTime}</span
                            >
                        {/if}
                    </div>

                    <div class="detail-grid" style="margin-bottom: 1rem;">
                        <div class="detail-item">
                            <span class="label">USDT BID</span>
                            <span class="value">{session.btz_bid || "-"}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">USDT ASK</span>
                            <span class="value">{session.btz_ask || "-"}</span>
                        </div>
                        {#if session.btz_usdc_bid || session.btz_usdc_ask}
                            <div class="detail-item">
                                <span class="label">USDC BID</span>
                                <span class="value"
                                    >{session.btz_usdc_bid || "-"}</span
                                >
                            </div>
                            <div class="detail-item">
                                <span class="label">USDC ASK</span>
                                <span class="value"
                                    >{session.btz_usdc_ask || "-"}</span
                                >
                            </div>
                        {/if}
                        {#if session.btz_notes}
                            <div
                                class="detail-item"
                                style="grid-column: span 2"
                            >
                                <span class="label">Notes</span>
                                <span class="value">{session.btz_notes}</span>
                            </div>
                        {/if}
                    </div>

                    {#if session.maxbit_prices && session.maxbit_prices.length > 0}
                        <div class="history-section-embedded">
                            <h4>
                                📋 Price History ({session.maxbit_prices
                                    .length})
                            </h4>
                            <div class="price-history-list">
                                {#each session.maxbit_prices as entry}
                                    <div class="price-history-entry">
                                        <div class="entry-header">
                                            <span class="entry-values">
                                                <span class="bid-badge"
                                                    >BID: {entry.bid}</span
                                                >
                                                <span class="ask-badge"
                                                    >ASK: {entry.ask}</span
                                                >
                                            </span>
                                            <span class="entry-time"
                                                >{new Date(
                                                    entry.timestamp,
                                                ).toLocaleString("th-TH")}</span
                                            >
                                        </div>
                                        {#if entry.note}
                                            <div class="entry-note">
                                                📝 {entry.note}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Exchange Comparison -->
            {#if session.exchange1 || session.exchange2 || (session.exchange_prices && session.exchange_prices.length > 0)}
                <div class="detail-card">
                    <div class="card-header-with-logo">
                        <div class="header-logos">
                            {#if session.exchange1 && BROKER_METADATA[session.exchange1]}
                                <img
                                    src={BROKER_METADATA[session.exchange1]
                                        .logo}
                                    alt={session.exchange1}
                                    class="header-logo-small"
                                />
                            {/if}
                            {#if session.exchange2 && BROKER_METADATA[session.exchange2]}
                                <img
                                    src={BROKER_METADATA[session.exchange2]
                                        .logo}
                                    alt={session.exchange2}
                                    class="header-logo-small"
                                />
                            {/if}
                        </div>
                        <h3>Exchange Comparison</h3>
                        {#if session.market_context?.exchangeFetchTime}
                            <span class="header-time"
                                >Fetched: {session.market_context
                                    .exchangeFetchTime}</span
                            >
                        {/if}
                    </div>

                    {#if session.exchange1 || session.exchange2}
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="label"
                                    >{formatExchangeName(
                                        session.exchange1,
                                    )}</span
                                >
                                <span class="value"
                                    >{session.exchange1_price || "-"}</span
                                >
                            </div>
                            <div class="detail-item">
                                <span class="label"
                                    >{formatExchangeName(
                                        session.exchange2,
                                    )}</span
                                >
                                <span class="value"
                                    >{session.exchange2_price || "-"}</span
                                >
                            </div>
                            <div class="detail-item">
                                <span class="label">Difference</span>
                                <span class="value"
                                    >{session.exchange_diff || "0.00"} ({formatExchangeName(
                                        session.exchange_higher,
                                    )})</span
                                >
                            </div>
                        </div>

                        <!-- Historical Order Book Depth -->
                        {#if bitkubBook || binanceBook}
                            <div
                                class="depth-preview-container"
                                style="margin-top: 1rem;"
                            >
                                <div class="depth-preview-header">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                    </svg>
                                    <span>Snapshot Depth (Top 5)</span>
                                </div>
                                <div class="order-book-container">
                                    {#if bitkubBook}
                                        <div class="order-book">
                                            <div
                                                class="order-book-header bitkub"
                                            >
                                                Bitkub
                                            </div>
                                            <div class="order-book-columns">
                                                <div
                                                    class="order-book-column bids"
                                                >
                                                    <div class="column-header">
                                                        BID
                                                    </div>
                                                    {#each bitkubBook.bids.slice(0, 5) as bid, i}
                                                        <div
                                                            class="order-row bid"
                                                            style="opacity: {1 -
                                                                i * 0.15}"
                                                        >
                                                            <span class="price"
                                                                >{bid.price.toFixed(
                                                                    2,
                                                                )}</span
                                                            >
                                                            <span class="amount"
                                                                >{bid.amount.toLocaleString()}</span
                                                            >
                                                        </div>
                                                    {/each}
                                                </div>
                                                <div
                                                    class="order-book-column asks"
                                                >
                                                    <div class="column-header">
                                                        ASK
                                                    </div>
                                                    {#each bitkubBook.asks.slice(0, 5) as ask, i}
                                                        <div
                                                            class="order-row ask"
                                                            style="opacity: {1 -
                                                                i * 0.15}"
                                                        >
                                                            <span class="price"
                                                                >{ask.price.toFixed(
                                                                    2,
                                                                )}</span
                                                            >
                                                            <span class="amount"
                                                                >{ask.amount.toLocaleString()}</span
                                                            >
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        </div>
                                    {/if}

                                    {#if binanceBook}
                                        <div class="order-book">
                                            <div
                                                class="order-book-header binance"
                                            >
                                                BinanceTH
                                            </div>
                                            <div class="order-book-columns">
                                                <div
                                                    class="order-book-column bids"
                                                >
                                                    <div class="column-header">
                                                        BID
                                                    </div>
                                                    {#each binanceBook.bids.slice(0, 5) as bid, i}
                                                        <div
                                                            class="order-row bid"
                                                            style="opacity: {1 -
                                                                i * 0.15}"
                                                        >
                                                            <span class="price"
                                                                >{bid.price.toFixed(
                                                                    2,
                                                                )}</span
                                                            >
                                                            <span class="amount"
                                                                >{bid.amount.toLocaleString()}</span
                                                            >
                                                        </div>
                                                    {/each}
                                                </div>
                                                <div
                                                    class="order-book-column asks"
                                                >
                                                    <div class="column-header">
                                                        ASK
                                                    </div>
                                                    {#each binanceBook.asks.slice(0, 5) as ask, i}
                                                        <div
                                                            class="order-row ask"
                                                            style="opacity: {1 -
                                                                i * 0.15}"
                                                        >
                                                            <span class="price"
                                                                >{ask.price.toFixed(
                                                                    2,
                                                                )}</span
                                                            >
                                                            <span class="amount"
                                                                >{ask.amount.toLocaleString()}</span
                                                            >
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}

                        {#if session.exchange_notes}
                            <div class="notes-box" style="margin-top: 1rem;">
                                <span class="label">Exchange Notes:</span>
                                <p>{session.exchange_notes}</p>
                            </div>
                        {/if}
                    {/if}

                    {#if session.exchange_prices && session.exchange_prices.length > 0}
                        <div
                            class="history-section-embedded"
                            style="margin-top: 1.5rem;"
                        >
                            <h4>
                                📋 Price History ({session.exchange_prices
                                    .length})
                            </h4>
                            <div class="price-history-list">
                                {#each session.exchange_prices as entry}
                                    <div
                                        class="price-history-entry exchange-entry"
                                    >
                                        <div class="entry-header">
                                            <span class="exchange-comparison"
                                                >{entry.exchange1} vs {entry.exchange2}</span
                                            >
                                            <span class="entry-time"
                                                >{new Date(
                                                    entry.timestamp,
                                                ).toLocaleString("th-TH")}</span
                                            >
                                        </div>
                                        <div class="exchange-details">
                                            <div class="exchange-row">
                                                <span class="exchange-name"
                                                    >{entry.exchange1}:</span
                                                >
                                                <span class="bid-badge"
                                                    >BID {entry.exchange1Bid}</span
                                                >
                                                <span class="ask-badge"
                                                    >ASK {entry.exchange1Ask}</span
                                                >
                                            </div>
                                            <div class="exchange-row">
                                                <span class="exchange-name"
                                                    >{entry.exchange2}:</span
                                                >
                                                <span class="bid-badge"
                                                    >BID {entry.exchange2Bid}</span
                                                >
                                                <span class="ask-badge"
                                                    >ASK {entry.exchange2Ask}</span
                                                >
                                            </div>
                                            {#if entry.diff}
                                                <div class="exchange-diff">
                                                    Diff: {entry.diff} | Higher:
                                                    {entry.higher}
                                                </div>
                                            {/if}
                                        </div>
                                        {#if entry.note}
                                            <div class="entry-note">
                                                📝 {entry.note}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

            {#if (session.otc_transactions && session.otc_transactions.length > 0) || session.prefund_current}
                <div class="detail-card">
                    <h3>OTC Operations</h3>
                    {#if session.otc_transactions && session.otc_transactions.length > 0}
                        <div class="otc-table-container">
                            <table class="otc-table">
                                <thead>
                                    <tr>
                                        <th>Customer</th>
                                        <th>Action</th>
                                        <th>Amount</th>
                                        <th>Price</th>
                                        <th>Total (THB)</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each session.otc_transactions as tx}
                                        <tr>
                                            <td>{tx.customerName}</td>
                                            <td class={tx.action.toLowerCase()}
                                                >{tx.action}</td
                                            >
                                            <td
                                                >{tx.amount.toLocaleString()}
                                                {tx.currency}</td
                                            >
                                            <td class="price"
                                                >{tx.rate?.toFixed(2) ||
                                                    "-"}</td
                                            >
                                            <td
                                                >฿{tx.total?.toLocaleString() ||
                                                    "-"}</td
                                            >
                                            <td>{tx.status}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}

                    {#if session.otc_notes}
                        <div class="notes-box">
                            <span class="label">OTC Notes:</span>
                            <p>{session.otc_notes}</p>
                        </div>
                    {/if}

                    <div class="prefund-section" style="margin-top: 1.5rem;">
                        <PrefundTracker
                            current={session.prefund_current || 0}
                            target={session.prefund_target || 760000}
                        />
                    </div>

                    {#if session.prefund_notes}
                        <div class="notes-box">
                            <span class="label">Prefund Status Notes:</span>
                            <p>{session.prefund_notes}</p>
                        </div>
                    {/if}
                    {#if session.matching_notes}
                        <div class="notes-box">
                            <span class="label">Matching Notes:</span>
                            <p>{session.matching_notes}</p>
                        </div>
                    {/if}
                </div>
            {/if}

            {#if session.market_mode || session.inventory_status || session.risk_flag || session.execution_issue}
                <div class="detail-card">
                    <h3>Status</h3>
                    <div class="detail-grid two-cols">
                        {#if session.market_mode}
                            <div class="detail-item">
                                <span class="label">Market Mode</span>
                                <span class="value">{session.market_mode}</span>
                            </div>
                        {/if}
                        {#if session.inventory_status}
                            <div class="detail-item">
                                <span class="label">Inventory</span>
                                <span class="value"
                                    >{session.inventory_status}</span
                                >
                            </div>
                        {/if}
                        {#if session.risk_flag}
                            <div class="detail-item">
                                <span class="label">Risk Flag</span>
                                <span class="value warning"
                                    >{session.risk_flag}</span
                                >
                            </div>
                        {/if}
                        {#if session.execution_issue}
                            <div class="detail-item">
                                <span class="label">Execution Issue</span>
                                <span class="value"
                                    >{session.execution_issue}</span
                                >
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if session.pnl_snapshot !== null || session.action_taken}
                <div class="detail-card">
                    <h3>Performance</h3>
                    <div class="detail-grid two-cols">
                        {#if session.pnl_snapshot !== null}
                            <div class="detail-item">
                                <span class="label">P&L Snapshot</span>
                                <span
                                    class="value pnl"
                                    class:positive={session.pnl_snapshot >= 0}
                                    class:negative={session.pnl_snapshot < 0}
                                >
                                    {session.pnl_snapshot >= 0
                                        ? "+"
                                        : ""}{session.pnl_snapshot.toLocaleString()}
                                </span>
                            </div>
                        {/if}
                        {#if session.action_taken}
                            <div class="detail-item">
                                <span class="label">Action Taken</span>
                                <span class="value">{session.action_taken}</span
                                >
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if session.note}
                <div class="detail-card">
                    <h3>Note</h3>
                    <p class="note-text">{session.note}</p>
                </div>
            {/if}

            {#if session.images && session.images.length > 0}
                <div class="detail-card">
                    <h3>Photos ({session.images.length})</h3>
                    <div class="images-grid">
                        {#each session.images as image (image.id)}
                            <a
                                href={image.public_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="image-item"
                            >
                                <img
                                    src={image.public_url}
                                    alt=""
                                    loading="lazy"
                                />
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if session.audio && session.audio.length > 0}
                <div class="detail-card">
                    <h3>Audio Evidence ({session.audio.length})</h3>
                    <div class="audio-list">
                        {#each session.audio as aud (aud.id)}
                            <div class="audio-item">
                                <div class="audio-info">
                                    <span class="audio-icon">🎙️</span>
                                    <span class="audio-date"
                                        >{new Date(
                                            aud.created_at,
                                        ).toLocaleTimeString("th-TH", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}</span
                                    >
                                </div>
                                {#if aud.notes}
                                    <div class="audio-notes-display">
                                        <strong>Note:</strong>
                                        {aud.notes}
                                    </div>
                                {/if}
                                <audio
                                    src={aud.public_url}
                                    controls
                                    class="detail-audio-player"
                                ></audio>
                                {#if aud.transcript}
                                    <div class="transcript-box">
                                        <strong>AI Transcript:</strong>
                                        <p>{aud.transcript}</p>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- AI Summary Section -->
            <div class="detail-card ai-summary-section">
                <AISummary {session} {chatMessages} />
            </div>

            <!-- Chat Log Section -->
            <div class="detail-card">
                <h3>
                    💬 Chat Log {chatMessages.length > 0
                        ? `(${chatMessages.length})`
                        : ""}
                </h3>
                <ChatLog messages={chatMessages} loading={chatLoading} />
            </div>

            {#if session.edit_history && session.edit_history.length > 0}
                <div class="detail-card edit-history-card">
                    <h3>📝 Edit History ({session.edit_history.length})</h3>
                    <div class="edit-history-list">
                        {#each session.edit_history as entry, idx}
                            <div class="history-entry">
                                <span class="history-time">
                                    {new Date(entry.timestamp).toLocaleString(
                                        "th-TH",
                                    )}
                                </span>
                                <ul class="changes-list">
                                    {#each entry.changes as change}
                                        <li>
                                            <strong
                                                >{FIELD_LABELS[change.field] ||
                                                    change.field}</strong
                                            >:
                                            <span class="old-value"
                                                >{formatHistoryValue(
                                                    change.field,
                                                    change.oldValue,
                                                )}</span
                                            >
                                            →
                                            <span class="new-value"
                                                >{formatHistoryValue(
                                                    change.field,
                                                    change.newValue,
                                                )}</span
                                            >
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="session-footer">
                <span class="created-at">
                    {new Date(session.created_at).toLocaleString()}
                </span>
                <button class="delete-btn" on:click={handleDelete}>
                    Delete Session
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .session-detail-page {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .back-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.5rem 0.75rem 0.5rem 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-primary);
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s;
    }

    .back-btn:hover {
        background: rgba(0, 122, 255, 0.1);
    }

    .back-btn svg {
        width: 1.25rem;
        height: 1.25rem;
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 3rem;
        color: var(--color-text-tertiary);
    }

    .spinner {
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid var(--color-border-light);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .session-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .session-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
    }

    .shift-badge {
        padding: 0.375rem 0.875rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: white;
        border-radius: 100px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .time-range {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
        letter-spacing: -0.02em;
    }

    .detail-card {
        background: var(--color-bg);
        border-radius: 12px;
        padding: 1rem;
    }

    .detail-card h3 {
        margin: 0 0 0.75rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .card-header-with-time {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.75rem;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .card-header-with-time h3 {
        margin-bottom: 0;
    }

    .header-time {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-tertiary);
        background: var(--color-bg-secondary);
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid var(--color-border-light);
    }

    .detail-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
    }

    .detail-grid.two-cols {
        grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 640px) {
        .detail-grid {
            grid-template-columns: 1fr;
        }

        .detail-grid.two-cols {
            grid-template-columns: 1fr;
        }
    }

    .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .detail-item .label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .detail-item .value {
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-text);
    }

    .detail-item .value.warning {
        color: var(--color-warning);
    }

    .detail-item .value.pnl.positive {
        color: var(--color-success);
    }

    .detail-item .value.pnl.negative {
        color: var(--color-danger);
    }

    .note-text {
        margin: 0;
        font-size: 0.9375rem;
        line-height: 1.6;
        color: var(--color-text-secondary);
        white-space: pre-wrap;
    }

    .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 0.5rem;
    }

    .image-item {
        aspect-ratio: 4/3;
        border-radius: 8px;
        overflow: hidden;
        background: var(--color-bg-secondary);
    }

    .image-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.15s;
    }

    .image-item:hover img {
        transform: scale(1.02);
    }

    .session-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 1rem;
    }

    .created-at {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
    }

    .delete-btn {
        padding: 0.625rem 1rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-danger);
        background: transparent;
        border: 1px solid var(--color-danger);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .delete-btn:hover {
        background: rgba(255, 59, 48, 0.1);
    }

    @media (max-width: 640px) {
        .time-range {
            font-size: 1.25rem;
        }

        .session-footer {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
        }

        .created-at {
            text-align: center;
        }

        .delete-btn {
            width: 100%;
        }
    }

    /* New Detail Styles */
    .notes-box {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-separator);
    }

    .notes-box .label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        display: block;
        margin-bottom: 0.25rem;
    }

    .notes-box p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
    }

    .otc-table-container {
        overflow-x: auto;
        margin: 0.5rem -1rem;
        padding: 0 1rem;
    }

    .otc-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8125rem;
    }

    .otc-table th {
        text-align: left;
        padding: 0.5rem;
        color: var(--color-text-tertiary);
        border-bottom: 2px solid var(--color-separator);
    }

    .otc-table td {
        padding: 0.5rem;
        border-bottom: 1px solid var(--color-separator);
    }

    .otc-table td.buy {
        color: var(--color-success);
        font-weight: 600;
    }
    .otc-table td.sell {
        color: var(--color-danger);
        font-weight: 600;
    }

    /* Chart Styles */
    .charts-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .charts-section h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .charts-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    @media (min-width: 1024px) {
        .charts-grid {
            grid-template-columns: 1fr 1fr;
        }
    }

    .loading-charts {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        color: var(--color-text-tertiary);
        font-size: 0.875rem;
        background: var(--color-bg);
        border-radius: 12px;
    }

    .spinner-small {
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--color-border-light);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .no-data-message {
        padding: 2rem;
        text-align: center;
        background: var(--color-bg);
        border-radius: 12px;
        color: var(--color-text-tertiary);
        font-size: 0.9375rem;
        border: 1px dashed var(--color-border-light);
    }

    .export-btn {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.875rem;
        font-size: 0.8125rem;
        font-weight: 600;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 100px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .export-btn:hover {
        background: #0066d6;
    }

    .export-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .export-btn svg {
        width: 1rem;
        height: 1rem;
    }

    .export-btn svg.chevron {
        width: 0.875rem;
        height: 0.875rem;
        margin-left: -0.125rem;
    }

    .export-dropdown {
        position: relative;
    }

    .export-menu {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        min-width: 180px;
        background: var(--color-bg);
        border: 1px solid var(--color-border-light);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        overflow: hidden;
        z-index: 100;
        animation: slideDown 0.15s ease-out;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .export-menu-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--color-border-light);
        cursor: pointer;
        transition: all 0.15s;
        text-align: left;
    }

    .export-menu-item:last-child {
        border-bottom: none;
    }

    .export-menu-item:hover {
        background: var(--color-bg-secondary);
        color: var(--color-primary);
    }

    .export-menu-item svg {
        width: 1.125rem;
        height: 1.125rem;
        flex-shrink: 0;
    }

    .spinner-tiny {
        width: 0.875rem;
        height: 0.875rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    /* PDF Export Styles */
    :global(body.exporting-pdf) .page-header,
    :global(body.exporting-pdf) .delete-btn,
    :global(body.exporting-pdf) .export-btn {
        display: none !important;
    }

    :global(body.exporting-pdf) .session-content {
        background: white !important;
    }

    :global(body.exporting-pdf) .detail-card,
    :global(body.exporting-pdf) .chart-wrapper,
    :global(body.exporting-pdf) .charts-section,
    :global(body.exporting-pdf) .depth-preview-container {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }

    /* Order Book Styles */
    .depth-preview-container {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-border-light);
    }

    .depth-preview-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .depth-preview-header svg {
        width: 0.875rem;
        height: 0.875rem;
    }

    .order-book-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    @media (max-width: 640px) {
        .order-book-container {
            grid-template-columns: 1fr;
        }
    }

    .order-book {
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        overflow: hidden;
        background: var(--color-bg);
    }

    .order-book-header {
        padding: 0.5rem;
        font-size: 0.6875rem;
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
        background: rgba(52, 199, 89, 0.02);
        border-right: 1px solid var(--color-border-light);
    }

    .order-book-column.asks {
        background: rgba(255, 59, 48, 0.02);
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
    }

    .order-row.bid .price {
        color: #00c767;
        font-weight: 500;
    }
    .order-row.ask .price {
        color: #ff3b30;
        font-weight: 500;
    }
    .order-row .amount {
        color: var(--color-text-secondary);
        opacity: 0.8;
    }

    /* Audio Styles */
    .audio-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .audio-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background: var(--color-bg-secondary);
        border-radius: 10px;
        border: 1px solid var(--color-border-light);
    }

    .audio-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .audio-icon {
        font-size: 1.125rem;
    }

    .audio-date {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
    }

    .detail-audio-player {
        width: 100%;
        height: 32px;
    }

    .audio-notes-display {
        font-size: 0.8125rem;
        color: var(--color-text);
        background: rgba(0, 122, 255, 0.05);
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        border-left: 3px solid var(--color-primary);
    }

    .audio-notes-display strong {
        color: var(--color-primary);
        font-size: 0.75rem;
        text-transform: uppercase;
        margin-right: 4px;
    }

    .transcript-box {
        margin-top: 0.25rem;
        padding: 0.75rem;
        background: var(--color-bg);
        border-radius: 8px;
        border-left: 3px solid var(--color-success);
    }

    .transcript-box strong {
        display: block;
        font-size: 0.6875rem;
        text-transform: uppercase;
        color: var(--color-success);
        margin-bottom: 4px;
    }

    .transcript-box p {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.5;
        color: var(--color-text-secondary);
    }

    :global(body.exporting-pdf) .charts-grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 1.5rem !important;
    }

    :global(body.exporting-pdf) .chart-wrapper {
        width: 100% !important;
        max-width: 100% !important;
    }

    :global(body.exporting-pdf) .session-footer {
        page-break-before: auto !important;
    }

    .edit-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        font-family: var(--font-family-sans);
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-primary);
        text-decoration: none;
        background: rgba(0, 122, 255, 0.08);
        border-radius: 100px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        margin-left: auto;
        margin-right: 0.5rem;
    }

    .edit-btn:hover {
        background: rgba(0, 122, 255, 0.15);
        transform: translateY(-1px);
    }

    .edit-btn svg {
        width: 1rem;
        height: 1rem;
    }

    /* Edit History Styles */
    .edit-history-card {
        border-left: 3px solid var(--color-warning);
    }

    .edit-history-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .history-entry {
        padding: 0.75rem;
        background: var(--color-bg);
        border-radius: 8px;
        border: 1px solid var(--color-border-light);
    }

    .history-time {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        margin-bottom: 0.5rem;
    }

    .changes-list {
        margin: 0;
        padding-left: 1.25rem;
        font-size: 0.8125rem;
    }

    .changes-list li {
        margin-bottom: 0.25rem;
        line-height: 1.5;
    }

    .changes-list strong {
        color: var(--color-text);
    }

    .old-value {
        color: #ff6b6b;
        text-decoration: line-through;
        opacity: 0.8;
    }

    .new-value {
        color: #4ecdc4;
        font-weight: 600;
    }

    /* AI Summary Section - remove default padding since component has its own */
    .ai-summary-section {
        padding: 0;
        overflow: hidden;
    }

    /* Broker Prices Styles */
    .broker-prices-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .broker-price-entry {
        padding: 0.75rem;
        background: var(--color-bg-secondary);
        border-radius: 8px;
        border: 1px solid var(--color-border-light);
    }

    .broker-entry-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .broker-entry-name {
        font-weight: 700;
        font-size: 0.9375rem;
        color: var(--color-text);
    }

    .broker-entry-time {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .broker-entry-values {
        display: flex;
        gap: 0.75rem;
    }

    .bid-badge,
    .ask-badge {
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
    }

    .bid-badge {
        color: #34c759;
        background: rgba(52, 199, 89, 0.1);
    }

    .ask-badge {
        color: #ff3b30;
        background: rgba(255, 59, 48, 0.1);
    }

    .broker-entry-note {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        margin-top: 0.25rem;
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 4px;
    }

    /* Premium Logo Headers */
    .card-header-with-logo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--color-border-light);
    }

    .header-logo {
        width: 32px;
        height: 32px;
        object-fit: contain;
        border-radius: 6px;
    }

    .header-logos {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .header-logo-small {
        width: 24px;
        height: 24px;
        object-fit: contain;
        border-radius: 4px;
    }

    .card-header-with-logo h3 {
        margin: 0;
        font-size: 1.125rem;
        background: none;
        padding: 0;
    }

    .card-header-with-logo .header-time {
        margin-left: auto;
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        font-weight: 500;
        background: rgba(0, 0, 0, 0.04);
        padding: 0.25rem 0.625rem;
        border-radius: 100px;
    }

    /* Embedded History Sections */
    .history-section-embedded {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px dashed var(--color-border-light);
    }

    .history-section-embedded h4 {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.025em;
        margin: 0 0 0.75rem 0;
        font-weight: 700;
    }

    /* Revised Price History Styles */
    .price-history-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 250px;
        overflow-y: auto;
        padding-right: 4px;
    }

    /* Custom scrollbar for price history */
    .price-history-list::-webkit-scrollbar {
        width: 4px;
    }
    .price-history-list::-webkit-scrollbar-track {
        background: transparent;
    }
    .price-history-list::-webkit-scrollbar-thumb {
        background: var(--color-border-light);
        border-radius: 10px;
    }

    .price-history-entry {
        padding: 0.625rem 0.75rem;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.04);
        transition: all 0.2s ease;
    }

    .price-history-entry:hover {
        background: rgba(0, 0, 0, 0.03);
        border-color: rgba(0, 0, 0, 0.08);
    }

    .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .entry-value {
        font-weight: 700;
        font-size: 0.9375rem;
        color: var(--color-text);
    }

    .entry-values {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .entry-time {
        font-size: 0.6875rem;
        color: var(--color-text-tertiary);
        font-family: var(--font-family-mono);
    }

    .entry-note {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        margin-top: 0.375rem;
        padding: 0.25rem 0.5rem;
        background: white;
        border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .exchange-entry .entry-header {
        margin-bottom: 0.5rem;
    }

    .exchange-comparison {
        font-weight: 700;
        font-size: 0.8125rem;
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.05);
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
    }

    .exchange-details {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        margin-bottom: 0.25rem;
    }

    .exchange-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
    }

    .exchange-name {
        font-weight: 600;
        min-width: 65px;
        color: var(--color-text-secondary);
    }

    .exchange-diff {
        font-size: 0.6875rem;
        color: var(--color-text-tertiary);
        margin-top: 0.25rem;
        padding: 0.125rem 0.5rem;
        background: rgba(0, 0, 0, 0.03);
        display: inline-block;
        border-radius: 4px;
    }
</style>
