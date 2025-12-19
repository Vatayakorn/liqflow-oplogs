<script lang="ts">
    /**
     * Session Detail Page
     * Full view of a single session with images
     */
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import {
        getSession,
        deleteSession,
        type OplogSession,
    } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import { goto } from "$app/navigation";
    import { isSupabaseConfigured } from "$lib/supabaseClient";

    $: sessionId = $page.params.id;

    let session: OplogSession | null = null;
    let isLoading = true;
    let supabaseReady = false;

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
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            toast.error("Failed to load session");
        } finally {
            isLoading = false;
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
</script>

<svelte:head>
    <title>Session Details - OpLog</title>
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
                </div>
            </div>

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
</style>
