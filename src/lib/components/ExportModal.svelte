<script lang="ts">
    /**
     * Export Modal Component
     * Date range picker for exporting operation logs
     */
    import { createEventDispatcher } from "svelte";
    import {
        getSessionsByDateRange,
        calculateExportStats,
        generateExportContent,
        downloadAsTextFile,
        type ExportDateRange,
        type ExportStats,
        type DayWithSessions,
    } from "$lib/api/exportApi";
    import { toast } from "$lib/stores/toast";

    const dispatch = createEventDispatcher();

    export let show = false;

    // Date range state
    let startDate = "";
    let endDate = "";
    let isLoading = false;
    let isExporting = false;
    let preview: { days: DayWithSessions[]; stats: ExportStats } | null = null;

    // Initialize with last 7 days
    $: if (show && !startDate) {
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);

        endDate = today.toISOString().split("T")[0];
        startDate = weekAgo.toISOString().split("T")[0];
    }

    // Auto-fetch preview when dates change
    $: if (startDate && endDate && show) {
        fetchPreview();
    }

    async function fetchPreview() {
        if (!startDate || !endDate) return;
        if (startDate > endDate) return;

        isLoading = true;
        try {
            const days = await getSessionsByDateRange(startDate, endDate);
            const stats = calculateExportStats(days);
            preview = { days, stats };
        } catch (error) {
            console.error("Failed to fetch preview:", error);
            preview = null;
        } finally {
            isLoading = false;
        }
    }

    async function handleExport() {
        if (!preview || preview.days.length === 0) {
            toast.error("No data to export");
            return;
        }

        isExporting = true;
        try {
            const dateRange: ExportDateRange = { startDate, endDate };
            const content = generateExportContent(preview.days, dateRange);
            const filename = `OpLogs_${startDate}_to_${endDate}.txt`;

            downloadAsTextFile(content, filename);
            toast.success("Export successful!");
            close();
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Export failed");
        } finally {
            isExporting = false;
        }
    }

    function close() {
        show = false;
        preview = null;
        dispatch("close");
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            close();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            close();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
    <div
        class="modal-backdrop"
        on:click={handleBackdropClick}
        role="dialog"
        aria-modal="true"
    >
        <div class="modal-content">
            <header class="modal-header">
                <h2>Export Operation Logs</h2>
                <button class="close-btn" on:click={close}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            <div class="modal-body">
                <div class="date-range-section">
                    <div class="date-input-group">
                        <label for="start-date">Start Date</label>
                        <input
                            id="start-date"
                            type="date"
                            bind:value={startDate}
                            max={endDate ||
                                new Date().toISOString().split("T")[0]}
                        />
                    </div>
                    <span class="date-separator">to</span>
                    <div class="date-input-group">
                        <label for="end-date">End Date</label>
                        <input
                            id="end-date"
                            type="date"
                            bind:value={endDate}
                            min={startDate}
                            max={new Date().toISOString().split("T")[0]}
                        />
                    </div>
                </div>

                <div class="quick-select">
                    <button
                        class="quick-btn"
                        on:click={() => {
                            const today = new Date();
                            const weekAgo = new Date();
                            weekAgo.setDate(today.getDate() - 7);
                            endDate = today.toISOString().split("T")[0];
                            startDate = weekAgo.toISOString().split("T")[0];
                        }}
                    >
                        Last 7 Days
                    </button>
                    <button
                        class="quick-btn"
                        on:click={() => {
                            const today = new Date();
                            const monthAgo = new Date();
                            monthAgo.setMonth(today.getMonth() - 1);
                            endDate = today.toISOString().split("T")[0];
                            startDate = monthAgo.toISOString().split("T")[0];
                        }}
                    >
                        Last 30 Days
                    </button>
                    <button
                        class="quick-btn"
                        on:click={() => {
                            const today = new Date();
                            const firstOfMonth = new Date(
                                today.getFullYear(),
                                today.getMonth(),
                                1,
                            );
                            endDate = today.toISOString().split("T")[0];
                            startDate = firstOfMonth
                                .toISOString()
                                .split("T")[0];
                        }}
                    >
                        This Month
                    </button>
                </div>

                <div class="preview-section">
                    {#if isLoading}
                        <div class="preview-loading">
                            <div class="spinner"></div>
                            <span>Loading preview...</span>
                        </div>
                    {:else if preview}
                        <div class="preview-stats">
                            <div class="stat-card">
                                <span class="stat-value"
                                    >{preview.stats.totalDays}</span
                                >
                                <span class="stat-label">Days</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-value"
                                    >{preview.stats.totalSessions}</span
                                >
                                <span class="stat-label">Sessions</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-value"
                                    >{preview.stats.totalOtcTransactions}</span
                                >
                                <span class="stat-label">OTC Transactions</span>
                            </div>
                        </div>
                        <div class="shift-breakdown">
                            <span class="shift-item shift-a"
                                >A: {preview.stats.sessionsByShift.A}</span
                            >
                            <span class="shift-item shift-b"
                                >B: {preview.stats.sessionsByShift.B}</span
                            >
                            <span class="shift-item shift-c"
                                >C: {preview.stats.sessionsByShift.C}</span
                            >
                        </div>
                        {#if preview.stats.avgFxRate}
                            <div class="avg-fx">
                                Avg FX Rate: <strong
                                    >{preview.stats.avgFxRate}</strong
                                > THB
                            </div>
                        {/if}
                    {:else if startDate && endDate}
                        <div class="preview-empty">
                            <p>No sessions found in this date range</p>
                        </div>
                    {/if}
                </div>
            </div>

            <footer class="modal-footer">
                <button
                    class="cancel-btn"
                    on:click={close}
                    disabled={isExporting}
                >
                    Cancel
                </button>
                <button
                    class="export-btn"
                    on:click={handleExport}
                    disabled={isExporting ||
                        isLoading ||
                        !preview ||
                        preview.stats.totalSessions === 0}
                >
                    {#if isExporting}
                        <div class="spinner-small"></div>
                        <span>Exporting...</span>
                    {:else}
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                            />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Export as TXT</span>
                    {/if}
                </button>
            </footer>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .modal-content {
        background: var(--color-bg);
        border-radius: 16px;
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--color-separator);
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .close-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-secondary);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all 0.15s;
    }

    .close-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text);
    }

    .close-btn svg {
        width: 18px;
        height: 18px;
    }

    .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
    }

    .date-range-section {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
    }

    .date-input-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .date-input-group label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-secondary);
    }

    .date-input-group input {
        padding: 0.625rem 0.875rem;
        font-size: 0.9375rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        color: var(--color-text);
        width: 100%;
    }

    .date-input-group input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }

    .date-separator {
        padding-bottom: 0.625rem;
        color: var(--color-text-tertiary);
        font-size: 0.875rem;
    }

    .quick-select {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    .quick-btn {
        flex: 1;
        padding: 0.5rem;
        font-size: 0.8125rem;
        font-weight: 500;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.15s;
    }

    .quick-btn:hover {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
    }

    .preview-section {
        margin-top: 1.5rem;
        padding: 1rem;
        background: var(--color-bg-secondary);
        border-radius: 12px;
        min-height: 120px;
    }

    .preview-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.625rem;
        padding: 2rem;
        color: var(--color-text-tertiary);
    }

    .preview-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        color: var(--color-text-tertiary);
    }

    .preview-stats {
        display: flex;
        gap: 0.75rem;
    }

    .stat-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        padding: 0.75rem;
        background: var(--color-bg);
        border-radius: 10px;
    }

    .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-primary);
    }

    .stat-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        text-align: center;
    }

    .shift-breakdown {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 0.75rem;
        font-size: 0.8125rem;
        font-weight: 500;
    }

    .shift-item {
        padding: 0.25rem 0.75rem;
        border-radius: 6px;
    }

    .shift-a {
        background: rgba(0, 122, 255, 0.15);
        color: #007aff;
    }

    .shift-b {
        background: rgba(52, 199, 89, 0.15);
        color: #34c759;
    }

    .shift-c {
        background: rgba(175, 82, 222, 0.15);
        color: #af52de;
    }

    .avg-fx {
        margin-top: 0.75rem;
        text-align: center;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
    }

    .avg-fx strong {
        color: var(--color-text);
    }

    .modal-footer {
        display: flex;
        gap: 0.75rem;
        padding: 1rem 1.5rem 1.5rem;
        border-top: 1px solid var(--color-separator);
    }

    .cancel-btn {
        flex: 1;
        padding: 0.75rem 1rem;
        font-size: 0.9375rem;
        font-weight: 500;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        color: var(--color-text);
        cursor: pointer;
        transition: all 0.15s;
    }

    .cancel-btn:hover:not(:disabled) {
        background: var(--color-bg-tertiary);
    }

    .cancel-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .export-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        font-size: 0.9375rem;
        font-weight: 600;
        background: var(--color-primary);
        border: none;
        border-radius: 10px;
        color: white;
        cursor: pointer;
        transition: all 0.15s;
    }

    .export-btn:hover:not(:disabled) {
        background: var(--color-primary-hover, #0066d6);
    }

    .export-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .export-btn svg {
        width: 18px;
        height: 18px;
    }

    .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid var(--color-border-light);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .spinner-small {
        width: 16px;
        height: 16px;
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

    @media (max-width: 500px) {
        .date-range-section {
            flex-direction: column;
            align-items: stretch;
        }

        .date-separator {
            display: none;
        }

        .quick-select {
            flex-wrap: wrap;
        }

        .quick-btn {
            flex: none;
            width: calc(50% - 0.25rem);
        }

        .quick-btn:last-child {
            width: 100%;
        }
    }
</style>
