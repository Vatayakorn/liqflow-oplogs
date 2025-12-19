<script lang="ts">
    /**
     * History Page
     * Browse past operation logs by date
     */
    import { onMount } from "svelte";
    import { listDays } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import { isSupabaseConfigured } from "$lib/supabaseClient";

    interface DayWithCount {
        id: string;
        log_date: string;
        created_at: string;
        session_count: number;
    }

    let days: DayWithCount[] = [];
    let isLoading = true;
    let selectedMonth = new Date().toISOString().slice(0, 7);
    let supabaseReady = false;

    onMount(() => {
        supabaseReady = isSupabaseConfigured();
        if (supabaseReady) {
            loadDays();
        } else {
            isLoading = false;
        }
    });

    async function loadDays() {
        isLoading = true;
        try {
            days = await listDays();
        } catch (error) {
            console.error("Failed to load days:", error);
            toast.error("Failed to load history");
        } finally {
            isLoading = false;
        }
    }

    $: filteredDays = days.filter((day) =>
        day.log_date.startsWith(selectedMonth),
    );
</script>

<svelte:head>
    <title>History - OpLog</title>
</svelte:head>

<div class="history-page">
    <header class="page-header">
        <h1>History</h1>
        <div class="month-picker">
            <input
                type="month"
                bind:value={selectedMonth}
                max={new Date().toISOString().slice(0, 7)}
            />
        </div>
    </header>

    {#if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    {:else if filteredDays.length === 0}
        <div class="empty-state">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
            >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18M9 21V9" />
            </svg>
            <p>No logs found</p>
            <span>Select a different month or start logging today</span>
        </div>
    {:else}
        <div class="days-list">
            {#each filteredDays as day (day.id)}
                <a href="/history/{day.log_date}" class="day-card">
                    <div class="day-info">
                        <span class="day-number"
                            >{new Date(day.log_date).getDate()}</span
                        >
                        <div class="day-details">
                            <span class="weekday"
                                >{new Date(day.log_date).toLocaleDateString(
                                    "en-US",
                                    { weekday: "long" },
                                )}</span
                            >
                            <span class="month-year"
                                >{new Date(day.log_date).toLocaleDateString(
                                    "en-US",
                                    { month: "short", year: "numeric" },
                                )}</span
                            >
                        </div>
                    </div>
                    <div class="day-meta">
                        <span class="session-count">{day.session_count}</span>
                        <span class="session-label"
                            >session{day.session_count !== 1 ? "s" : ""}</span
                        >
                    </div>
                    <svg
                        class="chevron"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </a>
            {/each}
        </div>
    {/if}

    <div class="summary-section">
        <h2>Summary</h2>
        <div class="stats-row">
            <div class="stat-item">
                <span class="stat-value">{days.length}</span>
                <span class="stat-label">Days</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
                <span class="stat-value"
                    >{days.reduce((sum, d) => sum + d.session_count, 0)}</span
                >
                <span class="stat-label">Sessions</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
                <span class="stat-value">
                    {days.length > 0
                        ? (
                              days.reduce(
                                  (sum, d) => sum + d.session_count,
                                  0,
                              ) / days.length
                          ).toFixed(1)
                        : "0"}
                </span>
                <span class="stat-label">Avg/Day</span>
            </div>
        </div>
    </div>
</div>

<style>
    .history-page {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .page-header h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--color-text);
        letter-spacing: -0.02em;
    }

    .month-picker input {
        padding: 0.625rem 1rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-text);
        background: var(--color-bg);
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .month-picker input:hover {
        border-color: var(--color-border);
    }

    .month-picker input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
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

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 3rem 1.5rem;
        text-align: center;
        color: var(--color-text-tertiary);
        background: var(--color-bg);
        border-radius: 12px;
    }

    .empty-state svg {
        width: 3rem;
        height: 3rem;
        color: var(--color-border);
    }

    .empty-state p {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-secondary);
    }

    .empty-state span {
        font-size: 0.875rem;
    }

    .days-list {
        display: flex;
        flex-direction: column;
        background: var(--color-bg);
        border-radius: 12px;
        overflow: hidden;
    }

    .day-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        text-decoration: none;
        transition: background 0.15s;
    }

    .day-card:not(:last-child) {
        border-bottom: 0.5px solid var(--color-separator);
    }

    .day-card:hover {
        background: var(--color-bg-secondary);
    }

    .day-card:active {
        background: var(--color-bg-tertiary);
    }

    .day-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
    }

    .day-number {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-text);
        background: var(--color-bg-secondary);
        border-radius: 10px;
    }

    .day-details {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .weekday {
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-text);
    }

    .month-year {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
    }

    .day-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.125rem;
    }

    .session-count {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-primary);
    }

    .session-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .chevron {
        width: 1.25rem;
        height: 1.25rem;
        color: var(--color-text-tertiary);
    }

    .summary-section {
        margin-top: 0.5rem;
    }

    .summary-section h2 {
        margin: 0 0 0.75rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .stats-row {
        display: flex;
        align-items: center;
        background: var(--color-bg);
        border-radius: 12px;
        padding: 1rem;
    }

    .stat-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
    }

    .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
    }

    .stat-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
    }

    .stat-divider {
        width: 1px;
        height: 32px;
        background: var(--color-separator);
    }

    @media (max-width: 640px) {
        .page-header h1 {
            font-size: 1.5rem;
        }

        .day-number {
            width: 40px;
            height: 40px;
            font-size: 1.125rem;
        }
    }
</style>
