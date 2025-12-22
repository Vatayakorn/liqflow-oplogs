<script lang="ts">
    /**
     * Session List Component
     * Displays sessions grouped by shift with Summary Cards
     */
    import type { OplogSession } from "$lib/api/oplog";
    import { groupSessionsByShift } from "$lib/api/oplog";
    import SessionSummaryCard from "./SessionSummaryCard.svelte";

    export let sessions: OplogSession[] = [];
    export let showDelete = false;
    export let viewMode: "summary" | "compact" = "summary";

    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher<{
        delete: string;
        view: string;
        edit: string;
    }>();

    $: groupedSessions = groupSessionsByShift(sessions);
    $: shiftOrder = ["A", "B", "C"].filter(
        (s) => groupedSessions[s]?.length > 0,
    );

    const shiftColors: Record<
        string,
        { bg: string; text: string; dot: string }
    > = {
        A: { bg: "rgba(255, 149, 0, 0.1)", text: "#FF9500", dot: "#FF9500" },
        B: { bg: "rgba(0, 122, 255, 0.1)", text: "#007AFF", dot: "#007AFF" },
        C: { bg: "rgba(88, 86, 214, 0.1)", text: "#5856D6", dot: "#5856D6" },
    };

    function handleDelete(event: CustomEvent<string>) {
        const id = event.detail;
        if (confirm("Delete this session?")) {
            dispatch("delete", id);
        }
    }

    function handleView(event: CustomEvent<string>) {
        dispatch("view", event.detail);
    }

    function handleEdit(event: CustomEvent<string>) {
        dispatch("edit", event.detail);
    }
</script>

<div class="session-list">
    {#if sessions.length === 0}
        <div class="empty-state">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
            >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M12 8v8M8 12h8" />
            </svg>
            <p>No sessions yet</p>
            <span>Add your first session above</span>
        </div>
    {:else}
        {#each shiftOrder as shift}
            <div class="shift-group">
                <div
                    class="shift-header"
                    style="background: {shiftColors[shift].bg}"
                >
                    <div
                        class="shift-dot"
                        style="background: {shiftColors[shift].dot}"
                    ></div>
                    <span
                        class="shift-label"
                        style="color: {shiftColors[shift].text}"
                        >Shift {shift}</span
                    >
                    <span class="session-count"
                        >{groupedSessions[shift].length} sessions</span
                    >
                </div>

                <div class="sessions">
                    {#each groupedSessions[shift] as session (session.id)}
                        <SessionSummaryCard
                            {session}
                            compact={viewMode === "compact"}
                            showActions={true}
                            on:view={handleView}
                            on:edit={handleEdit}
                            on:delete={handleDelete}
                        />
                    {/each}
                </div>
            </div>
        {/each}
    {/if}
</div>

<style>
    .session-list {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
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

    .shift-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .shift-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: 12px;
    }

    .shift-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .shift-label {
        font-family: var(--font-family-heading);
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .session-count {
        margin-left: auto;
        font-family: var(--font-family-heading);
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-tertiary);
    }

    .sessions {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
</style>
