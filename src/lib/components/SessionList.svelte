<script lang="ts">
    /**
     * Session List Component
     * Displays sessions grouped by shift in a timeline view
     */
    import type { OplogSession } from "$lib/api/oplog";
    import { groupSessionsByShift } from "$lib/api/oplog";

    export let sessions: OplogSession[] = [];
    export let showDelete = false;

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
        A: { bg: "rgba(0, 122, 255, 0.08)", text: "#007AFF", dot: "#007AFF" },
        B: { bg: "rgba(52, 199, 89, 0.08)", text: "#34C759", dot: "#34C759" },
        C: { bg: "rgba(175, 82, 222, 0.08)", text: "#AF52DE", dot: "#AF52DE" },
    };

    function formatTimeRange(start: string, end: string | null): string {
        const startFormatted = start?.slice(0, 5) || "??:??";
        if (!end) return `${startFormatted} – …`;
        return `${startFormatted} – ${end.slice(0, 5)}`;
    }

    function handleDelete(id: string) {
        if (confirm("Delete this session?")) {
            dispatch("delete", id);
        }
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
                        >{groupedSessions[shift].length}</span
                    >
                </div>

                <div class="sessions">
                    {#each groupedSessions[shift] as session (session.id)}
                        <div class="session-card" id="session-{session.id}">
                            <div class="session-main">
                                <div class="session-time">
                                    {formatTimeRange(
                                        session.start_time,
                                        session.end_time,
                                    )}
                                </div>

                                <div class="session-team">
                                    <span class="team-item"
                                        >{session.broker}</span
                                    >
                                    <span class="team-sep">•</span>
                                    <span class="team-item"
                                        >{session.trader}</span
                                    >
                                    <span class="team-sep">•</span>
                                    <span class="team-item">{session.head}</span
                                    >
                                </div>

                                {#if session.pnl_snapshot !== null && session.pnl_snapshot !== undefined}
                                    <div
                                        class="session-pnl"
                                        class:positive={session.pnl_snapshot >=
                                            0}
                                        class:negative={session.pnl_snapshot <
                                            0}
                                    >
                                        {session.pnl_snapshot >= 0
                                            ? "+"
                                            : ""}{session.pnl_snapshot.toLocaleString()}
                                    </div>
                                {/if}

                                {#if session.note}
                                    <div class="session-note">
                                        {session.note}
                                    </div>
                                {/if}

                                {#if session.images && session.images.length > 0}
                                    <div class="session-images">
                                        {#each session.images.slice(0, 4) as image, i (image.id)}
                                            <a
                                                href={image.public_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="image-thumb"
                                            >
                                                <img
                                                    src={image.public_url}
                                                    alt=""
                                                    loading="lazy"
                                                />
                                                {#if i === 3 && session.images.length > 4}
                                                    <div class="image-more">
                                                        +{session.images
                                                            .length - 4}
                                                    </div>
                                                {/if}
                                            </a>
                                        {/each}
                                    </div>
                                {/if}
                            </div>

                            <div class="session-actions">
                                <button
                                    type="button"
                                    class="action-btn"
                                    on:click={() =>
                                        dispatch("view", session.id)}
                                >
                                    Details
                                </button>
                                <button
                                    type="button"
                                    class="action-btn"
                                    on:click={() =>
                                        dispatch("edit", session.id)}
                                >
                                    Edit
                                </button>
                                {#if showDelete}
                                    <button
                                        type="button"
                                        class="action-btn delete"
                                        on:click={() =>
                                            handleDelete(session.id)}
                                    >
                                        Delete
                                    </button>
                                {/if}
                            </div>
                        </div>
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
        gap: 0.75rem;
    }

    .shift-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 0.875rem;
        border-radius: 10px;
    }

    .shift-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .shift-label {
        font-family: var(--font-family-heading);
        font-size: 0.8125rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .session-count {
        margin-left: auto;
        font-family: var(--font-family-heading);
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
    }

    .sessions {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
    }

    .session-card {
        background: var(--color-bg-secondary);
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid var(--color-border-light);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        transition: all 0.2s ease;
    }

    .session-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    .session-main {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .session-time {
        font-family: var(--font-family-heading);
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--color-text);
        letter-spacing: -0.02em;
    }

    .session-team {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .team-item {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
    }

    .team-sep {
        color: var(--color-text-tertiary);
        font-size: 0.75rem;
    }

    .session-pnl {
        display: inline-flex;
        align-self: flex-start;
        font-size: 1rem;
        font-weight: 700;
        padding: 0.375rem 0.875rem;
        border-radius: 8px;
    }

    .session-pnl.positive {
        color: var(--color-success);
        background: rgba(52, 199, 89, 0.1);
    }

    .session-pnl.negative {
        color: var(--color-danger);
        background: rgba(255, 59, 48, 0.1);
    }

    .session-note {
        font-size: 0.9375rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .session-images {
        display: flex;
        gap: 0.375rem;
        margin-top: 0.25rem;
    }

    .image-thumb {
        position: relative;
        width: 72px;
        height: 72px;
        border-radius: 10px;
        overflow: hidden;
        background: var(--color-bg-secondary);
    }

    .image-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .image-more {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        font-weight: 600;
        color: white;
        background: rgba(0, 0, 0, 0.6);
    }

    .session-actions {
        display: flex;
        border-top: 0.5px solid var(--color-separator);
    }

    .action-btn {
        flex: 1;
        padding: 0.875rem;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-primary);
        background: transparent;
        border: none;
        cursor: pointer;
        transition: all 0.15s;
    }

    .action-btn:hover {
        background: var(--color-bg-secondary);
    }

    .action-btn:active {
        background: var(--color-bg-tertiary);
    }

    .action-btn.delete {
        color: var(--color-danger);
        border-left: 0.5px solid var(--color-separator);
    }
</style>
