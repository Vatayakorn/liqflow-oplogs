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

    $: sessionId = $page.params.id;

    let session: OplogSession | null = null;
    let isLoading = true;
    let supabaseReady = false;

    // Chart Data
    let marketData: Record<string, MarketDataPoint[]> = {};
    let chartLoading = false;
    let availableSources: string[] = [];

    const sourceColors: Record<string, string> = {
        bitkub: "#27AE60", // Green
        binance_th: "#F3BA2F", // Yellow/Gold
        maxbit: "#E53935", // Red
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
    });

    async function loadSession() {
        isLoading = true;
        try {
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
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            toast.error("Failed to load session");
        } finally {
            isLoading = false;
        }
    }

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

            // Get shift time range based on session.shift
            const shiftTimes: Record<string, { start: string; end: string }> = {
                A: { start: "06:00", end: "15:00" },
                B: { start: "14:00", end: "23:00" },
                C: { start: "22:00", end: "07:00" }, // Cross-midnight
            };

            const shift = session.shift || "B"; // Default to B if not set
            const shiftConfig = shiftTimes[shift] || shiftTimes["B"];

            // Calculate range start and end
            const rangeStart = combineDateTime(dateStr, shiftConfig.start);
            let rangeEnd = combineDateTime(dateStr, shiftConfig.end);

            // Handle cross-midnight shift (e.g., Shift C: 22:00-07:00)
            if (shiftConfig.end < shiftConfig.start) {
                rangeEnd = addHours(rangeEnd, 24); // Add a day
            }

            const allData = await getMarketDataRange(
                rangeStart.toISOString(),
                rangeEnd.toISOString(),
            );
            console.log(
                `Chart Data Fetched for Shift ${shift}:`,
                allData.length,
                "points",
            );
            if (allData.length > 0) {
                console.log("Sample:", allData[0]);
            }

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

            {#if session.fx_rate}
                <div class="detail-card">
                    <h3>FX Section</h3>
                    <div class="detail-grid">
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
                                <span class="value">{session.fx_notes}</span>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if session.btz_bid || session.btz_ask}
                <div class="detail-card">
                    <h3>Broker (BTZ/Maxbit)</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="label">BID</span>
                            <span class="value">{session.btz_bid || "-"}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">ASK</span>
                            <span class="value">{session.btz_ask || "-"}</span>
                        </div>
                        {#if session.btz_notes}
                            <div class="detail-item">
                                <span class="label">Notes</span>
                                <span class="value">{session.btz_notes}</span>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if session.exchange1 || session.exchange2}
                <div class="detail-card">
                    <h3>Exchange Comparison</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="label"
                                >{formatExchangeName(session.exchange1)}</span
                            >
                            <span class="value"
                                >{session.exchange1_price || "-"}</span
                            >
                        </div>
                        <div class="detail-item">
                            <span class="label"
                                >{formatExchangeName(session.exchange2)}</span
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
                    {#if session.exchange_notes}
                        <div class="notes-box">
                            <span class="label">Exchange Notes:</span>
                            <p>{session.exchange_notes}</p>
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

                    <div class="detail-grid" style="margin-top: 1rem;">
                        <div class="detail-item">
                            <span class="label">Prefund Status</span>
                            <span class="value">
                                {session.prefund_current?.toLocaleString() || 0}
                                / {session.prefund_target?.toLocaleString() ||
                                    0}
                            </span>
                        </div>
                    </div>

                    {#if session.matching_notes}
                        <div class="notes-box">
                            <span class="label">Matching Notes:</span>
                            <p>{session.matching_notes}</p>
                        </div>
                    {/if}
                    {#if session.otc_notes}
                        <div class="notes-box">
                            <span class="label">OTC Notes:</span>
                            <p>{session.otc_notes}</p>
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
</style>
