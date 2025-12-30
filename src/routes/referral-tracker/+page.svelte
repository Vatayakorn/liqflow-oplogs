<script lang="ts">
    import { onMount } from "svelte";
    import {
        fetchAllCustomersFromAPI,
        fetchCustomerTransactions,
    } from "$lib/api/customerApi";
    import {
        getReferralCustomers,
        addReferralCustomer,
        removeReferralCustomer,
    } from "$lib/api/referralApi";
    import { getBinanceTHPriceAt } from "$lib/api/marketData";
    import type { OtcTransactionSummary } from "$lib/api/customerAnalytics";

    // Types
    interface ReferralTransaction extends OtcTransactionSummary {
        marketPrice?: number;
        gap?: number;
        profit?: number;
        loadingPrice?: boolean;
        customerDisplayName?: string;
    }

    // State
    let customers: any[] = [];
    let referralCustomerNames: Set<string> = new Set();
    let transactions: ReferralTransaction[] = [];
    let loading = true;
    let loadingTransactions = false;
    let searchQuery = "";
    let dateFrom = "";
    let dateTo = new Date().toISOString().split("T")[0];
    let isHalfMode = false;
    let isAuthorized = false;
    let passwordInput = "";
    let errorMessage = "";

    function checkPassword() {
        // You can change this password as needed
        if (passwordInput === "LiqflowExecutive") {
            isAuthorized = true;
            errorMessage = "";
            localStorage.setItem("referral_authorized", "true");
        } else {
            errorMessage = "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่";
        }
    }

    // Initialization
    onMount(async () => {
        const auth = localStorage.getItem("referral_authorized");
        if (auth === "true") {
            isAuthorized = true;
        }

        // Set default date range to today
        const today = new Date();
        dateFrom = today.toISOString().split("T")[0];

        await loadInitialData();
    });

    async function loadInitialData() {
        loading = true;
        try {
            const [allCustomers, referralNames] = await Promise.all([
                fetchAllCustomersFromAPI(),
                getReferralCustomers(),
            ]);

            customers = allCustomers.sort((a, b) =>
                a.name.localeCompare(b.name),
            );
            referralCustomerNames = new Set(referralNames);

            if (referralCustomerNames.size > 0) {
                await loadTransactions();
            }
        } catch (error) {
            console.error("Failed to load initial data:", error);
        } finally {
            loading = false;
        }
    }

    async function loadTransactions() {
        if (referralCustomerNames.size === 0) {
            transactions = [];
            return;
        }

        loadingTransactions = true;
        try {
            const allTxPromises = Array.from(referralCustomerNames).map(
                (name) => fetchCustomerTransactions(name, dateFrom, dateTo),
            );

            const groupedTxs = await Promise.all(allTxPromises);
            let flatTxs: ReferralTransaction[] = groupedTxs
                .flat()
                .map((tx) => ({
                    ...tx,
                    loadingPrice: true,
                }));

            // Sort by date descending
            flatTxs.sort(
                (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
            );
            transactions = flatTxs;

            // Fetch market prices in background
            fetchMarketPrices();
        } catch (error) {
            console.error("Failed to load transactions:", error);
        } finally {
            loadingTransactions = false;
        }
    }

    async function fetchMarketPrices() {
        // We can fetch them in batches or sequential
        for (let i = 0; i < transactions.length; i++) {
            const tx = transactions[i];
            if (!tx.loadingPrice || tx.marketPrice !== undefined) continue;

            try {
                const book = await getBinanceTHPriceAt(tx.date);
                if (book) {
                    // SELL (Customer sells to us) -> Match with ASK
                    // BUY (Customer buys from us) -> Match with BID
                    const marketPrice =
                        tx.action === "SELL" ? book.bestAsk : book.bestBid;

                    if (marketPrice > 0) {
                        tx.marketPrice = marketPrice;
                        // Gap = MarketPrice - OurPrice (if SELL) or OurPrice - MarketPrice (if BUY)
                        // Actually the user said: amount * (MarketPrice - OurPrice) if SELL?
                        // Let's use the logic derived:
                        // Profit = amount * (marketPrice - rate) if SELL
                        // Profit = amount * (rate - marketPrice) if BUY

                        if (tx.action === "SELL") {
                            // Desk Selling to Customer at 'rate', Buying back from market at 'marketPrice'
                            tx.gap = tx.rate - marketPrice;
                        } else {
                            // Desk Buying from Customer at 'rate', Selling to market at 'marketPrice'
                            tx.gap = marketPrice - tx.rate;
                        }

                        tx.profit = tx.amount * tx.gap;
                    }
                }
            } catch (error) {
                console.error(`Failed to fetch price for tx ${tx.id}:`, error);
            } finally {
                tx.loadingPrice = false;
                transactions = [...transactions]; // Trigger reactivity
            }

            // Subtle delay to avoid rate limiting
            if (i % 3 === 0) await new Promise((r) => setTimeout(r, 100));
        }
    }

    async function toggleReferral(customerName: string) {
        if (referralCustomerNames.has(customerName)) {
            const ok = await removeReferralCustomer(customerName);
            if (ok) {
                referralCustomerNames.delete(customerName);
                referralCustomerNames = new Set(referralCustomerNames);
                loadTransactions();
            }
        } else {
            const ok = await addReferralCustomer(customerName);
            if (ok) {
                referralCustomerNames.add(customerName);
                referralCustomerNames = new Set(referralCustomerNames);
                loadTransactions();
            }
        }
    }

    $: filteredCustomers = customers.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    function formatNumber(n: number | undefined, decimals = 2) {
        if (n === undefined) return "-";
        return n.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    }

    function formatDate(dateStr: string) {
        const d = new Date(dateStr);
        return d.toLocaleString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    function exportToCSV() {
        if (transactions.length === 0) return;

        // Header row
        const headers = [
            "วัน-เวลา",
            "ลูกค้า",
            "Side",
            "Amount",
            "Currency",
            "Price",
            "BinanceTH",
            "Gap (stang)",
            isHalfMode ? "Profit (50%)" : "Profit (THB)",
        ];

        // Format rows
        const rows = transactions.map((tx) => [
            tx.date,
            tx.customerName || "Unknown",
            tx.action,
            tx.amount,
            tx.currency,
            tx.rate,
            tx.marketPrice || "",
            tx.gap !== undefined ? (tx.gap * 100).toFixed(2) : "",
            tx.profit !== undefined
                ? (tx.profit * (isHalfMode ? 0.5 : 1)).toFixed(2)
                : "",
        ]);

        // Combine into CSV string
        const csvContent =
            "\uFEFF" + // UTF-8 BOM for Excel
            [headers, ...rows]
                .map((row) => row.map((cell) => `"${cell}"`).join(","))
                .join("\n");

        // Create download link
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute(
            "download",
            `referral_export_${dateFrom}_to_${dateTo}${isHalfMode ? "_half" : ""}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
</script>

{#if isAuthorized}
    <div class="container animate-fadeIn">
        <header class="page-header">
            <div class="header-content">
                <h1>💰 Referral Tracker</h1>
                <p class="subtitle">วิเคราะห์ส่วนต่างกำไรจากรายการ Referral</p>
            </div>

            <div class="header-actions">
                <div class="date-range">
                    <input
                        type="date"
                        bind:value={dateFrom}
                        on:change={loadTransactions}
                    />
                    <span>ถึง</span>
                    <input
                        type="date"
                        bind:value={dateTo}
                        on:change={loadTransactions}
                    />
                </div>
                <button
                    class="refresh-btn"
                    on:click={loadTransactions}
                    disabled={loadingTransactions}
                >
                    {loadingTransactions ? "⏳ กำลังโหลด..." : "🔄 รีเฟรช"}
                </button>
                <button
                    class="export-btn"
                    on:click={exportToCSV}
                    disabled={transactions.length === 0}
                >
                    📥 Export CSV
                </button>
            </div>
        </header>

        <div class="dashboard-grid">
            <!-- Customer Selection Sidebar -->
            <aside class="sidebar card">
                <h2>👥 จัดการรายการ Referral</h2>

                <!-- Selected Section -->
                <div class="selected-section">
                    <h3>⭐ ลูกค้าที่เลือกไว้ ({referralCustomerNames.size})</h3>
                    <div class="selected-list">
                        {#if referralCustomerNames.size === 0}
                            <div class="empty-hint">ยังไม่ได้เลือกลูกค้า</div>
                        {:else}
                            {#each Array.from(referralCustomerNames) as name}
                                <div class="selected-tag">
                                    <span>{name}</span>
                                    <button
                                        class="remove-tag"
                                        on:click={() => toggleReferral(name)}
                                        title="ลบออก"
                                    >
                                        ✕
                                    </button>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>

                <div class="search-box">
                    <input
                        type="text"
                        placeholder="ค้นหาลูกค้าเพิ่ม..."
                        bind:value={searchQuery}
                    />
                </div>

                <div class="customer-list-container">
                    <h3>🔍 ค้นหารายชื่อทั้งหมด</h3>
                    <div class="customer-list">
                        {#if loading}
                            <div class="loading-inline">
                                กำลังโหลดข้อมูลลูกค้า...
                            </div>
                        {:else}
                            {#each filteredCustomers as customer}
                                <div
                                    class="customer-item"
                                    class:active={referralCustomerNames.has(
                                        customer.name,
                                    )}
                                >
                                    <div class="customer-info">
                                        <span class="name">{customer.name}</span
                                        >
                                    </div>
                                    <button
                                        class="toggle-btn"
                                        class:is-referral={referralCustomerNames.has(
                                            customer.name,
                                        )}
                                        on:click={() =>
                                            toggleReferral(customer.name)}
                                    >
                                        {referralCustomerNames.has(
                                            customer.name,
                                        )
                                            ? "✕ ลบออก"
                                            : "+ เพิ่ม"}
                                    </button>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            </aside>

            <!-- Transactions Table -->
            <main class="main-content card">
                <div class="table-header">
                    <h2>📊 รายการความต่างราคา (Arbitrage Gap)</h2>
                    <div class="summary-stats">
                        <button
                            class="half-btn"
                            class:active={isHalfMode}
                            on:click={() => (isHalfMode = !isHalfMode)}
                            title="หารกำไรครึ่งหนึ่ง"
                        >
                            {isHalfMode ? "✅ คนละครึ่ง (50%)" : "🤝 คนละครึ่ง"}
                        </button>

                        <div class="stat">
                            <span class="label"
                                >{isHalfMode
                                    ? "Profit (50%):"
                                    : "Total Profit:"}</span
                            >
                            <span class="value success"
                                >฿{formatNumber(
                                    transactions.reduce(
                                        (sum, tx) => sum + (tx.profit || 0),
                                        0,
                                    ) * (isHalfMode ? 0.5 : 1),
                                    2,
                                )}</span
                            >
                        </div>
                    </div>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>วัน-เวลา</th>
                                <th>ลูกค้า</th>
                                <th>Side</th>
                                <th>Amount</th>
                                <th>Price</th>
                                <th>BinanceTH</th>
                                <th>Gap (สตางค์)</th>
                                <th>กำไร {isHalfMode ? "(50%)" : "(บาท)"}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#if loadingTransactions}
                                <tr>
                                    <td colspan="8" class="loading-row"
                                        >กำลังโหลดรายการธุรกรรม...</td
                                    >
                                </tr>
                            {:else if transactions.length === 0}
                                <tr>
                                    <td colspan="8" class="empty-row"
                                        >ไม่มีรายการธุรกรรมในช่วงเวลานี้</td
                                    >
                                </tr>
                            {:else}
                                {#each transactions as tx}
                                    <tr>
                                        <td class="time"
                                            >{formatDate(tx.date)}</td
                                        >
                                        <td class="customer"
                                            >{tx.customerName || "Unknown"}</td
                                        >
                                        <td
                                            class="side"
                                            class:sell={tx.action === "SELL"}
                                            class:buy={tx.action === "BUY"}
                                        >
                                            {tx.action}
                                        </td>
                                        <td class="amount"
                                            >{formatNumber(tx.amount, 0)}
                                            {tx.currency}</td
                                        >
                                        <td class="price"
                                            >@{formatNumber(tx.rate, 2)}</td
                                        >
                                        <td class="market-price">
                                            {#if tx.loadingPrice}
                                                <span class="loading-text"
                                                    >กำลังโหลด...</span
                                                >
                                            {:else if tx.marketPrice}
                                                {formatNumber(
                                                    tx.marketPrice,
                                                    2,
                                                )}
                                            {:else}
                                                <span class="error-text"
                                                    >ไม่มีเลย</span
                                                >
                                            {/if}
                                        </td>
                                        <td
                                            class="gap"
                                            class:positive={(tx.gap || 0) > 0}
                                            class:negative={(tx.gap || 0) < 0}
                                        >
                                            {#if tx.gap !== undefined}
                                                {formatNumber(tx.gap * 100, 2)}
                                            {:else}
                                                -
                                            {/if}
                                        </td>
                                        <td
                                            class="profit"
                                            class:positive={(tx.profit || 0) >
                                                0}
                                            class:negative={(tx.profit || 0) <
                                                0}
                                        >
                                            ฿{formatNumber(
                                                (tx.profit || 0) *
                                                    (isHalfMode ? 0.5 : 1),
                                                2,
                                            )}
                                        </td>
                                    </tr>
                                {/each}
                            {/if}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    </div>
{:else}
    <div class="auth-container animate-fadeIn">
        <div class="auth-card">
            <div class="auth-icon">🔒</div>
            <h1>ต้องการรหัสผ่าน</h1>
            <p>กรุณาใส่รหัสผ่านเพื่อเข้าใช้งานหน้านี้</p>

            <form on:submit|preventDefault={checkPassword}>
                <input
                    type="password"
                    bind:value={passwordInput}
                    placeholder="ใส่รหัสผ่านที่นี่..."
                    autocomplete="off"
                />
                {#if errorMessage}
                    <div class="error-msg">{errorMessage}</div>
                {/if}
                <button type="submit">ยืนยันรหัสผ่าน</button>
            </form>
        </div>
    </div>
{/if}

<style>
    .container {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    .header-content h1 {
        font-size: 2.25rem;
        margin-bottom: 0.5rem;
        color: #000000;
    }

    .subtitle {
        color: var(--color-text-tertiary);
        font-size: 1.1rem;
    }

    .header-actions {
        display: flex;
        gap: 1rem;
        align-items: center;
    }

    .date-range {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: var(--color-bg);
        padding: 0.5rem 1rem;
        border-radius: 12px;
        border: 1px solid var(--color-border);
    }

    .date-range input {
        border: none;
        background: transparent;
        font-family: inherit;
        color: var(--color-text);
        outline: none;
    }

    .refresh-btn {
        background: var(--color-primary);
        color: white;
        border: none;
        padding: 0.6rem 1.25rem;
        border-radius: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .refresh-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
    .export-btn {
        background: #34c759;
        color: white;
        border: none;
        padding: 0.6rem 1.25rem;
        border-radius: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }
    .export-btn:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
        background: #2ea44f;
    }
    .export-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: var(--color-bg-tertiary);
        color: var(--color-text-tertiary);
    }

    .dashboard-grid {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 2rem;
        align-items: start;
    }

    .sidebar {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-height: calc(100vh - 200px);
    }

    .sidebar h2 {
        font-size: 1.2rem;
        margin: 0;
        color: var(--color-primary);
        border-bottom: 2px solid var(--color-bg-tertiary);
        padding-bottom: 0.75rem;
    }

    .selected-section {
        background: var(--color-bg);
        border-radius: 12px;
        padding: 1rem;
        border: 1px dashed var(--color-border);
    }

    .selected-section h3 {
        font-size: 0.9rem;
        margin: 0 0 0.75rem 0;
        color: var(--color-text-secondary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .selected-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .selected-tag {
        background: var(--color-primary);
        color: white;
        padding: 0.3rem 0.6rem 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: scaleIn 0.2s ease-out;
    }

    .remove-tag {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .remove-tag:hover {
        background: rgba(255, 255, 255, 0.4);
    }

    .empty-hint {
        color: var(--color-text-tertiary);
        font-size: 0.85rem;
        font-style: italic;
    }

    .customer-list-container h3 {
        font-size: 0.9rem;
        margin: 1.5rem 0 0.75rem 0;
        color: var(--color-text-secondary);
    }

    .search-box input {
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 12px;
        border: 1px solid var(--color-border);
        outline: none;
        background: var(--color-bg-secondary);
        transition: all 0.2s;
    }

    .search-box input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    @keyframes scaleIn {
        from {
            transform: scale(0.9);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }

    .customer-list {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .customer-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        border-radius: 10px;
        background: var(--color-bg-tertiary);
        transition: all 0.2s;
    }

    .customer-item.active {
        background: rgba(0, 122, 255, 0.05);
        border: 1px solid rgba(0, 122, 255, 0.1);
    }

    .name {
        font-weight: 500;
        font-size: 0.95rem;
    }

    .toggle-btn {
        padding: 0.4rem 0.8rem;
        border-radius: 8px;
        font-size: 0.85rem;
        border: 1px solid var(--color-border);
        background: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .toggle-btn.is-referral {
        background: var(--color-success);
        color: white;
        border-color: var(--color-success);
    }

    /* Main Table Area */
    .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    .summary-stats {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .half-btn {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        padding: 0.6rem 1.25rem;
        border-radius: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .half-btn:hover {
        background: var(--color-bg-tertiary);
        border-color: var(--color-primary);
        color: var(--color-primary);
    }

    .half-btn.active {
        background: rgba(255, 149, 0, 0.1);
        border-color: #ff9500;
        color: #ff9500;
        box-shadow: 0 0 0 3px rgba(255, 149, 0, 0.1);
    }

    .summary-stats .stat {
        background: var(--color-bg-tertiary);
        padding: 0.75rem 1.5rem;
        border-radius: 14px;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .stat .label {
        color: var(--color-text-secondary);
        font-weight: 500;
    }

    .stat .value {
        font-size: 1.25rem;
        font-weight: 700;
    }

    .value.success {
        color: var(--color-success);
    }

    /* Auth Styles */
    .auth-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f4f7f9;
        z-index: 1000;
    }

    .auth-card {
        background: white;
        padding: 3rem;
        border-radius: 24px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
        text-align: center;
        width: 100%;
        max-width: 400px;
        border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .auth-icon {
        font-size: 3rem;
        margin-bottom: 1.5rem;
    }

    .auth-card h1 {
        font-size: 1.75rem;
        margin-bottom: 0.75rem;
        color: #1a1a1a;
    }

    .auth-card p {
        color: #666;
        margin-bottom: 2rem;
    }

    .auth-card form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .auth-card input {
        padding: 1rem;
        border-radius: 12px;
        border: 1px solid #ddd;
        font-size: 1rem;
        text-align: center;
        outline: none;
        transition: border-color 0.2s;
    }

    .auth-card input:focus {
        border-color: var(--color-primary, #007aff);
    }

    .auth-card button {
        padding: 1rem;
        border-radius: 12px;
        border: none;
        background: var(--color-primary, #007aff);
        color: white;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .auth-card button:hover {
        opacity: 0.9;
    }

    .error-msg {
        color: #ff3b30;
        font-size: 0.9rem;
        margin-top: -0.5rem;
    }

    .table-container {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
    }

    th {
        text-align: left;
        padding: 1rem;
        color: var(--color-text-tertiary);
        font-weight: 600;
        font-size: 0.85rem;
        text-transform: uppercase;
        border-bottom: 1px solid var(--color-border);
    }

    td {
        padding: 1.25rem 1rem;
        border-bottom: 1px solid var(--color-border-light);
        font-size: 0.95rem;
    }

    .time {
        color: var(--color-text-secondary);
        font-size: 0.85rem;
    }
    .customer {
        font-weight: 600;
    }
    .side {
        font-weight: 700;
    }
    .side.sell {
        color: var(--color-danger);
    }
    .side.buy {
        color: var(--color-success);
    }
    .amount {
        font-family: monospace;
        font-weight: 600;
    }
    .price {
        color: var(--color-text-secondary);
    }
    .market-price {
        font-weight: 500;
    }

    .gap,
    .profit {
        font-weight: 700;
        text-align: right;
    }

    .positive {
        color: var(--color-success);
    }
    .negative {
        color: var(--color-danger);
    }

    .loading-row,
    .empty-row {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-tertiary);
    }

    .loading-text {
        font-style: italic;
        opacity: 0.6;
        font-size: 0.8rem;
    }
</style>
