<script lang="ts">
    /**
     * Today Page
     * Main operation log entry page
     */
    import { onMount } from "svelte";
    import SessionList from "$lib/components/SessionList.svelte";
    import {
        listSessionsByDate,
        deleteSession,
        type OplogSession,
    } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import { goto } from "$app/navigation";
    import { isSupabaseConfigured } from "$lib/supabaseClient";

    // State
    let selectedDate = new Date().toISOString().split("T")[0];
    let sessions: OplogSession[] = [];
    let isLoading = true;
    let supabaseReady = false;
    let mounted = false;

    // Check Supabase configuration on mount
    onMount(() => {
        mounted = true;
        supabaseReady = isSupabaseConfigured();
        if (supabaseReady) {
            loadSessions();
        } else {
            isLoading = false;
        }
    });

    $: if (selectedDate && supabaseReady) {
        loadSessions();
    }

    async function loadSessions() {
        isLoading = true;
        try {
            sessions = await listSessionsByDate(selectedDate);
        } catch (error) {
            console.error("Failed to load sessions:", error);
            toast.error("Failed to load sessions");
        } finally {
            isLoading = false;
        }
    }

    async function handleDeleteSession(event: CustomEvent<string>) {
        const sessionId = event.detail;
        try {
            await deleteSession(sessionId);
            toast.success("Session deleted");
            await loadSessions();
        } catch (error) {
            console.error("Failed to delete session:", error);
            toast.error("Failed to delete session");
        }
    }

    function handleViewSession(event: CustomEvent<string>) {
        goto(`/session/${event.detail}`);
    }

    function handleEditSession(event: CustomEvent<string>) {
        goto(`/session/${event.detail}/edit`);
    }
</script>

<svelte:head>
    <title>Today - OpLogs</title>
</svelte:head>

<div class="today-page">
    <header class="page-header">
        <h1>Operation Logs</h1>
        <div class="header-actions">
            <button
                class="btn-new-session desktop-only"
                on:click={() => goto("/session/new")}
            >
                <span class="btn-icon">+</span>
                <span>New Session</span>
            </button>
            <div class="date-picker">
                <input
                    type="date"
                    bind:value={selectedDate}
                    max={new Date().toISOString().split("T")[0]}
                />
            </div>
        </div>
    </header>

    <!-- Mobile FAB -->
    <button
        class="fab mobile-only"
        on:click={() => goto("/session/new")}
        aria-label="New Session"
    >
        <span class="fab-icon">+</span>
    </button>

    {#if mounted && !supabaseReady}
        <div class="config-warning">
            <div class="warning-icon">⚠️</div>
            <div class="warning-content">
                <h3>Supabase Not Configured</h3>
                <p>To use this app, please set up your Supabase credentials:</p>
                <ol>
                    <li>Create a <code>.env</code> file in the project root</li>
                    <li>Add your Supabase URL and anon key:</li>
                </ol>
                <pre>PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key</pre>
                <p>
                    See <code>README.md</code> for detailed setup instructions.
                </p>
            </div>
        </div>
    {/if}

    <div class="content-grid">
        <section class="sessions-section">
            <div class="section-header">
                <h2>Sessions</h2>
                <span class="date-label"
                    >{new Date(selectedDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}</span
                >
            </div>

            {#if isLoading}
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading sessions...</p>
                </div>
            {:else}
                <SessionList
                    {sessions}
                    showDelete={true}
                    on:delete={handleDeleteSession}
                    on:view={handleViewSession}
                    on:edit={handleEditSession}
                />
            {/if}
        </section>
    </div>
</div>

<style>
    .today-page {
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

    .date-picker input {
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

    .date-picker input:hover {
        border-color: var(--color-border);
    }

    .date-picker input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }

    .content-grid {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        max-width: 900px;
        margin: 0 auto;
        width: 100%;
    }

    .form-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .form-section h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .form-controls {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .sessions-section {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        background: var(--color-bg);
        border-radius: 20px;
        padding: 1.5rem;
        border: 1px solid var(--color-border-light);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--color-border-light);
    }

    .section-header h2 {
        margin: 0;
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--color-text);
        letter-spacing: -0.02em;
    }

    .date-label {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
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

    .loading p {
        margin: 0;
        font-size: 0.9375rem;
    }

    @media (max-width: 640px) {
        .page-header h1 {
            font-size: 1.5rem;
        }

        .form-section h2,
        .section-header h2 {
            font-size: 1rem;
        }
    }

    /* Configuration Warning */
    .config-warning {
        display: flex;
        gap: 1rem;
        padding: 1.25rem;
        background: var(--color-bg);
        border: 1px solid #ff9500;
        border-radius: 12px;
    }

    .warning-icon {
        font-size: 1.5rem;
        line-height: 1;
    }

    .warning-content {
        flex: 1;
    }

    .warning-content h3 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
        font-weight: 600;
        color: #ff9500;
    }

    .warning-content p {
        margin: 0.5rem 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
    }

    .warning-content ol {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
    }

    .warning-content li {
        margin: 0.25rem 0;
    }

    .warning-content code {
        padding: 0.125rem 0.375rem;
        font-family: "SF Mono", Monaco, Menlo, monospace;
        font-size: 0.8125rem;
        color: var(--color-primary);
        background: rgba(0, 122, 255, 0.1);
        border-radius: 4px;
    }

    .warning-content pre {
        margin: 0.75rem 0;
        padding: 0.75rem 1rem;
        font-family: "SF Mono", Monaco, Menlo, monospace;
        font-size: 0.75rem;
        color: var(--color-success);
        background: var(--color-bg-secondary);
        border-radius: 8px;
        overflow-x: auto;
    }

    /* Header Actions */
    .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    /* New Session Button - Desktop */
    .btn-new-session {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(
            135deg,
            var(--color-primary) 0%,
            #0051a8 100%
        );
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
    }

    .btn-new-session:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
    }

    .btn-new-session:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
    }

    .btn-new-session .btn-icon {
        font-size: 1.25rem;
        font-weight: 300;
        line-height: 1;
    }

    /* Mobile FAB */
    .fab {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(
            135deg,
            var(--color-primary) 0%,
            #0051a8 100%
        );
        border: none;
        border-radius: 50%;
        cursor: pointer;
        box-shadow:
            0 4px 12px rgba(0, 122, 255, 0.4),
            0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        z-index: 1000;
    }

    .fab:hover {
        transform: scale(1.05);
        box-shadow:
            0 6px 20px rgba(0, 122, 255, 0.5),
            0 3px 6px rgba(0, 0, 0, 0.15);
    }

    .fab:active {
        transform: scale(0.98);
    }

    .fab-icon {
        font-size: 1.75rem;
        font-weight: 300;
        color: #fff;
        line-height: 1;
    }

    /* Responsive visibility */
    .desktop-only {
        display: flex;
    }

    .mobile-only {
        display: none;
    }

    @media (max-width: 640px) {
        .desktop-only {
            display: none;
        }

        .mobile-only {
            display: flex;
        }

        .page-header h1 {
            font-size: 1.5rem;
        }

        .form-section h2,
        .section-header h2 {
            font-size: 1rem;
        }
    }
</style>
