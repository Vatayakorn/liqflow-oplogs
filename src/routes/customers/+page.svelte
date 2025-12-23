<script lang="ts">
    /**
     * Customer Behavior Analytics Dashboard
     * แสดงข้อมูลวิเคราะห์พฤติกรรมลูกค้าทั้งหมด
     */
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import CustomerCard from "$lib/components/CustomerCard.svelte";
    import CustomerBehaviorFunnel from "$lib/components/CustomerBehaviorFunnel.svelte";
    import CustomerBIInsights from "$lib/components/CustomerBIInsights.svelte";
    import {
        getAllCustomers,
        getFollowupAlerts,
        getAnalyticsSummary,
        getBehaviorStats,
        BEHAVIOR_CONFIG,
        type CustomerListItem,
        type BehaviorType,
        type BehaviorStats,
    } from "$lib/api/customerAnalytics";
    import { getAIProviderStatus } from "$lib/api/ai";

    // State
    let customers: CustomerListItem[] = [];
    let alerts: CustomerListItem[] = [];
    let loading = true;
    let error: string | null = null;

    // Filters
    let searchQuery = "";
    let selectedBehavior: BehaviorType | "all" = "all";
    let dateRange: "1d" | "3d" | "7d" | "30d" | "all" = "30d";

    // Summary stats
    let summary = {
        totalCustomers: 0,
        activeCustomers: 0,
        totalVolume: 0,
        avgEngagement: 0,
        needsFollowup: 0,
        behaviorStats: {
            hot_lead: 0,
            negotiator: 0,
            window_shopper: 0,
            ghost: 0,
            vip_repeat: 0,
            new_prospect: 0,
            total: 0,
        } as BehaviorStats,
    };

    let providerStatus = getAIProviderStatus();

    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        loading = true;
        error = null;

        try {
            // Calculate date range
            let dateFrom: string | undefined;
            const now = new Date();

            if (dateRange === "1d") {
                const from = new Date(now);
                from.setDate(from.getDate() - 1);
                dateFrom = from.toISOString().split("T")[0];
            } else if (dateRange === "3d") {
                const from = new Date(now);
                from.setDate(from.getDate() - 3);
                dateFrom = from.toISOString().split("T")[0];
            } else if (dateRange === "7d") {
                const from = new Date(now);
                from.setDate(from.getDate() - 7);
                dateFrom = from.toISOString().split("T")[0];
            } else if (dateRange === "30d") {
                const from = new Date(now);
                from.setDate(from.getDate() - 30);
                dateFrom = from.toISOString().split("T")[0];
            }

            // Fetch data in parallel
            const [customersData, alertsData, summaryData] = await Promise.all([
                getAllCustomers(dateFrom),
                getFollowupAlerts(),
                getAnalyticsSummary(),
            ]);

            customers = customersData;
            alerts = alertsData;

            // Recalculate summary from the ACTUAL filtered data to ensure perfect match
            const stats = getBehaviorStats(customers);
            const totalVol = customers.reduce(
                (sum, c) => sum + (c.totalVolume || 0),
                0,
            );
            const avgEng = customers.length
                ? customers.reduce(
                      (sum, c) => sum + (c.engagementScore || 0),
                      0,
                  ) / customers.length
                : 0;
            const needsFu = customers.filter((c) => c.needsFollowup).length;

            summary = {
                totalCustomers: customers.length,
                activeCustomers: customers.filter((c) => c.transactionCount > 0)
                    .length,
                totalVolume: totalVol,
                avgEngagement: avgEng,
                needsFollowup: needsFu,
                behaviorStats: stats,
            };
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load data";
            console.error("Load error:", e);
        } finally {
            loading = false;
        }
    }

    // Filtered customers
    $: filteredCustomers = customers.filter((c) => {
        // Search filter
        const matchesSearch =
            !searchQuery ||
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.displayName.toLowerCase().includes(searchQuery.toLowerCase());

        // Behavior filter
        const matchesBehavior =
            selectedBehavior === "all" || c.behaviorType === selectedBehavior;

        return matchesSearch && matchesBehavior;
    });

    function handleCustomerClick(event: CustomEvent<CustomerListItem>) {
        const customer = event.detail;
        goto(`/customers/${encodeURIComponent(customer.name)}`);
    }

    function handleAlertClick(event: CustomEvent<CustomerListItem>) {
        const customer = event.detail;
        goto(`/customers/${encodeURIComponent(customer.name)}`);
    }

    function handleFunnelClick(type: BehaviorType) {
        selectedBehavior = type;
    }

    function formatVolume(v: number): string {
        if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
        return v.toLocaleString();
    }
</script>

<svelte:head>
    <title>Customer Analytics | LiqFlow</title>
</svelte:head>

<main class="dashboard">
    <header class="page-header">
        <div class="header-content">
            <h1>👥 Customer Behavior Analytics</h1>
            <p class="subtitle">วิเคราะห์พฤติกรรมลูกค้าด้วย AI</p>
        </div>

        <div class="header-actions">
            <select
                bind:value={dateRange}
                on:change={() => loadData()}
                class="date-select"
            >
                <option value="1d">วันนี้</option>
                <option value="3d">3 วันล่าสุด</option>
                <option value="7d">7 วันล่าสุด</option>
                <option value="30d">30 วันล่าสุด</option>
                <option value="all">ทั้งหมด</option>
            </select>
        </div>
    </header>

    {#if loading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>กำลังโหลดข้อมูลลูกค้า...</p>
        </div>
    {:else if error}
        <div class="error-state">
            <span>⚠️</span>
            <p>{error}</p>
            <button on:click={() => loadData()}>ลองใหม่</button>
        </div>
    {:else}
        <!-- BI Insights Dashboard -->
        <CustomerBIInsights
            {customers}
            on:customerClick={handleCustomerClick}
        />

        <!-- Stats Overview -->
        <section class="stats-section">
            <div class="stat-card primary">
                <span class="stat-icon">👥</span>
                <div class="stat-info">
                    <span class="stat-value">{summary.totalCustomers}</span>
                    <span class="stat-label">ลูกค้าทั้งหมด</span>
                </div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">💰</span>
                <div class="stat-info">
                    <span class="stat-value"
                        >{formatVolume(summary.totalVolume)}</span
                    >
                    <span class="stat-label">Total Volume</span>
                </div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">🎯</span>
                <div class="stat-info">
                    <span class="stat-value"
                        >{Math.round(summary.avgEngagement * 100)}%</span
                    >
                    <span class="stat-label">Avg Engagement</span>
                </div>
            </div>
            <div class="stat-card warning">
                <span class="stat-icon">📌</span>
                <div class="stat-info">
                    <span class="stat-value">{summary.needsFollowup}</span>
                    <span class="stat-label">Need Follow-up</span>
                </div>
            </div>
        </section>

        <!-- Main Content Grid -->
        <div class="content-grid">
            <!-- Funnel -->
            <aside class="funnel-section">
                <CustomerBehaviorFunnel
                    stats={summary.behaviorStats}
                    onSegmentClick={handleFunnelClick}
                />
            </aside>

            <!-- Customer List -->
            <section class="customer-list-section">
                <header class="list-header">
                    <h2>
                        {#if selectedBehavior !== "all"}
                            {BEHAVIOR_CONFIG[selectedBehavior].emoji}
                            {BEHAVIOR_CONFIG[selectedBehavior].labelTh}
                        {:else}
                            รายชื่อลูกค้า
                        {/if}
                        <span class="count">({filteredCustomers.length})</span>
                    </h2>

                    <div class="list-filters">
                        <input
                            type="search"
                            placeholder="🔍 ค้นหาลูกค้า..."
                            bind:value={searchQuery}
                            class="search-input"
                        />

                        {#if selectedBehavior !== "all"}
                            <button
                                class="clear-filter"
                                on:click={() => (selectedBehavior = "all")}
                            >
                                ✕ ล้าง filter
                            </button>
                        {/if}
                    </div>
                </header>

                {#if filteredCustomers.length === 0}
                    <div class="empty-state">
                        <span class="empty-icon">🔍</span>
                        <p>ไม่พบลูกค้าที่ตรงกับเงื่อนไข</p>
                        {#if searchQuery || selectedBehavior !== "all"}
                            <button
                                on:click={() => {
                                    searchQuery = "";
                                    selectedBehavior = "all";
                                }}
                            >
                                ล้าง filter ทั้งหมด
                            </button>
                        {/if}
                    </div>
                {:else}
                    <div class="customer-grid">
                        {#each filteredCustomers as customer (customer.name)}
                            <CustomerCard
                                {customer}
                                on:click={handleCustomerClick}
                            />
                        {/each}
                    </div>
                {/if}
            </section>
        </div>

        <!-- AI Status -->
        <footer class="ai-status">
            <span
                class="status-dot"
                class:active={providerStatus.openai || providerStatus.gemini}
            ></span>
            AI: {providerStatus.openai ? "GPT-4 ✓" : ""}
            {providerStatus.gemini ? "Gemini ✓" : ""}
            {!providerStatus.openai && !providerStatus.gemini
                ? "ไม่พร้อมใช้งาน"
                : ""}
        </footer>
    {/if}
</main>

<style>
    .dashboard {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0;
        min-height: 100vh;
        font-family: var(
            --font-family-sans,
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif
        );
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
    }

    .header-content h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
        font-family: var(
            --font-family-heading,
            "Outfit",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif
        );
    }

    .subtitle {
        margin: 4px 0 0;
        color: var(--color-text-tertiary, #8e8e93);
        font-size: 0.9rem;
    }

    .header-actions {
        display: flex;
        gap: 12px;
    }

    .date-select {
        padding: 8px 16px;
        background: var(--color-bg, #ffffff);
        border: 1px solid var(--color-border, #e5e5ea);
        border-radius: 8px;
        color: var(--color-text, #1d1d1f);
        font-size: 0.9rem;
        cursor: pointer;
    }

    /* Stats Section */
    .stats-section {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .stat-card {
        background: var(--color-bg, #ffffff);
        border-radius: 16px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1px solid var(--color-border-light, #f2f2f7);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
    }

    .stat-card.primary {
        border-color: rgba(0, 122, 255, 0.2);
        background: linear-gradient(
            135deg,
            rgba(0, 122, 255, 0.08),
            rgba(0, 122, 255, 0.02)
        );
    }

    .stat-card.warning {
        border-color: rgba(255, 149, 0, 0.2);
    }

    .stat-icon {
        font-size: 1.5rem;
    }

    .stat-info {
        display: flex;
        flex-direction: column;
    }

    .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
    }

    .stat-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    /* Content Grid */
    .content-grid {
        display: grid;
        grid-template-columns: 350px 1fr;
        gap: 24px;
    }

    @media (max-width: 900px) {
        .content-grid {
            grid-template-columns: 1fr;
        }
    }

    .funnel-section {
        position: sticky;
        top: 80px;
        align-self: start;
    }

    @media (max-width: 900px) {
        .funnel-section {
            position: static;
        }
    }

    /* Customer List */
    .customer-list-section {
        min-width: 0;
    }

    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 12px;
    }

    .list-header h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
        font-family: var(
            --font-family-heading,
            "Outfit",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif
        );
    }

    .list-header .count {
        color: var(--color-text-tertiary, #8e8e93);
        font-weight: 400;
    }

    .list-filters {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .search-input {
        padding: 8px 12px;
        background: var(--color-bg, #ffffff);
        border: 1px solid var(--color-border, #e5e5ea);
        border-radius: 8px;
        color: var(--color-text, #1d1d1f);
        font-size: 0.9rem;
        min-width: 200px;
    }

    .search-input:focus {
        outline: none;
        border-color: var(--color-primary, #007aff);
    }

    .clear-filter {
        padding: 6px 12px;
        background: rgba(255, 59, 48, 0.08);
        border: 1px solid rgba(255, 59, 48, 0.2);
        border-radius: 6px;
        color: var(--color-danger, #ff3b30);
        font-size: 0.8rem;
        cursor: pointer;
    }

    .customer-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
    }

    /* Loading & Error States */
    .loading-state,
    .error-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid var(--color-border-light, #f2f2f7);
        border-top-color: var(--color-primary, #007aff);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .loading-state p,
    .error-state p,
    .empty-state p {
        margin-top: 16px;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .empty-icon {
        font-size: 3rem;
        opacity: 0.5;
    }

    .error-state span {
        font-size: 3rem;
    }

    .error-state button,
    .empty-state button {
        margin-top: 16px;
        padding: 8px 16px;
        background: var(--color-bg, #ffffff);
        border: 1px solid var(--color-border, #e5e5ea);
        border-radius: 8px;
        color: var(--color-text, #1d1d1f);
        cursor: pointer;
    }

    /* AI Status Footer */
    .ai-status {
        margin-top: 40px;
        padding: 12px;
        text-align: center;
        font-size: 0.8rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-text-tertiary, #8e8e93);
        margin-right: 6px;
    }

    .status-dot.active {
        background: var(--color-success, #34c759);
    }
</style>
