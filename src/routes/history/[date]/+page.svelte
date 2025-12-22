<script lang="ts">
    /**
     * History Date Page
     * View sessions for a specific date
     */
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import SessionList from "$lib/components/SessionList.svelte";
    import {
        listSessionsByDate,
        deleteSession,
        type OplogSession,
    } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import { isSupabaseConfigured } from "$lib/supabaseClient";

    $: dateParam = $page.params.date;

    let sessions: OplogSession[] = [];
    let isLoading = true;
    let supabaseReady = false;

    onMount(() => {
        supabaseReady = isSupabaseConfigured();
        if (supabaseReady) {
            loadSessions();
        } else {
            isLoading = false;
        }
    });

    $: if (dateParam && supabaseReady) {
        loadSessions();
    }

    async function loadSessions() {
        isLoading = true;
        try {
            sessions = await listSessionsByDate(dateParam);
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

    function formatDateDisplay(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        });
    }
</script>

<svelte:head>
    <title>{formatDateDisplay(dateParam)} - OpLog</title>
</svelte:head>

<div class="history-date-page">
    <header class="page-header">
        <a href="/history" class="back-link">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
            >
                <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
        </a>
    </header>

    <div class="date-title">
        <h1>{formatDateDisplay(dateParam)}</h1>
        <span class="year">{new Date(dateParam).getFullYear()}</span>
    </div>

    {#if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading...</p>
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
</div>

<style>
    .history-date-page {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .page-header {
        display: flex;
        align-items: center;
    }

    .back-link {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.5rem 0.75rem 0.5rem 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-primary);
        text-decoration: none;
        border-radius: 8px;
        transition: background 0.15s;
    }

    .back-link:hover {
        background: rgba(0, 122, 255, 0.1);
    }

    .back-link svg {
        width: 1.25rem;
        height: 1.25rem;
    }

    .date-title {
        display: flex;
        align-items: baseline;
        gap: 0.625rem;
    }

    .date-title h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
        letter-spacing: -0.02em;
    }

    .year {
        font-size: 1rem;
        font-weight: 500;
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

    @media (max-width: 640px) {
        .date-title h1 {
            font-size: 1.25rem;
        }
    }
</style>
