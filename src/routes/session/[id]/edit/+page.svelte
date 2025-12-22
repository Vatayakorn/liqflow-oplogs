<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import SessionForm from "$lib/components/SessionForm.svelte";
    import {
        getSession,
        updateSessionWithHistory,
        type OplogSession,
        type ChangeEntry,
    } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";

    // Field labels for display
    const FIELD_LABELS: Record<string, string> = {
        start_time: "Start Time",
        end_time: "End Time",
        broker: "Broker",
        trader: "Trader",
        head: "Head",
        recorder: "Recorder",
        fx_rate: "FX Rate",
        fx_notes: "FX Notes",
        btz_bid: "BTZ Bid",
        btz_ask: "BTZ Ask",
        btz_notes: "BTZ Notes",
        exchange1: "Exchange 1",
        exchange1_price: "Exchange 1 Price",
        exchange2: "Exchange 2",
        exchange2_price: "Exchange 2 Price",
        exchange_diff: "Exchange Diff",
        exchange_higher: "Higher Exchange",
        exchange_notes: "Exchange Notes",
        prefund_current: "Prefund Current",
        prefund_target: "Prefund Target",
        matching_notes: "Matching Notes",
        otc_notes: "OTC Notes",
        note: "Notes",
        shift: "Shift",
    };

    function formatChangesForToast(changes: ChangeEntry[]): string {
        if (changes.length === 0) return "No changes detected";

        const maxItems = 3;
        const displayChanges = changes.slice(0, maxItems);
        const lines = displayChanges.map((c) => {
            const label = FIELD_LABELS[c.field] || c.field;
            const oldStr = c.oldValue ?? "(empty)";
            const newStr = c.newValue ?? "(empty)";
            return `${label}: ${oldStr} → ${newStr}`;
        });

        if (changes.length > maxItems) {
            lines.push(`...and ${changes.length - maxItems} more`);
        }

        return lines.join("\n");
    }

    let session: OplogSession | null = null;
    let originalSession: OplogSession | null = null;
    let isLoading = true;

    $: sessionId = $page.params.id;

    onMount(async () => {
        try {
            if (!sessionId) {
                toast.error("Invalid session ID");
                goto("/history");
                return;
            }
            session = await getSession(sessionId);

            originalSession = session
                ? JSON.parse(JSON.stringify(session))
                : null;
            if (!session) {
                toast.error("Session not found");
                goto("/history");
            }
        } catch (error) {
            console.error("Error loading session:", error);
            toast.error("Failed to load session");
            goto("/history");
        } finally {
            isLoading = false;
        }
    });

    async function handleUpdate(event: CustomEvent<any>) {
        if (!session || !originalSession) return;

        const payload = event.detail;

        try {
            const { images, audio, ...updateData } = payload;

            const result = await updateSessionWithHistory(
                session.id,
                updateData,
                originalSession,
            );

            if (result.changes.length > 0) {
                const changeSummary = formatChangesForToast(result.changes);
                toast.success(`Session updated!\n${changeSummary}`);
            } else {
                toast.info("No changes detected");
            }

            goto(`/session/${session.id}`);
        } catch (error) {
            console.error("Update error:", error);
            toast.error("Failed to update session");
        }
    }

    function handleCancel() {
        if (session) {
            goto(`/session/${session.id}`);
        } else {
            goto("/history");
        }
    }
</script>

<svelte:head>
    <title>Edit Session - OpLogs</title>
</svelte:head>

<div class="edit-page">
    <header class="page-header">
        <div class="header-content">
            <button class="back-btn" on:click={handleCancel}>
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path d="M19 12H5m0 0l7-7m-7 7l7 7" />
                </svg>
                Back
            </button>
            <h1>Edit Operation Log</h1>
        </div>
    </header>

    {#if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading session data...</p>
        </div>
    {:else if session}
        <div class="form-wrapper">
            <SessionForm initialData={session} on:submit={handleUpdate} />

            <div class="form-actions">
                <button class="cancel-btn" on:click={handleCancel}>
                    Cancel Changes
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .edit-page {
        max-width: 800px;
        margin: 0 auto;
        padding-bottom: 5rem;
    }

    .page-header {
        margin-bottom: 2rem;
    }

    .header-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .back-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        background: var(--color-bg-secondary);
        border: none;
        border-radius: 8px;
        cursor: pointer;
    }

    .back-btn svg {
        width: 1rem;
        height: 1rem;
    }

    h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--color-text);
        letter-spacing: -0.02em;
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 5rem 0;
        color: var(--color-text-tertiary);
    }

    .spinner {
        width: 2.5rem;
        height: 2.5rem;
        border: 3px solid var(--color-separator);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .form-wrapper {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .form-actions {
        display: flex;
        justify-content: center;
        padding-top: 1rem;
    }

    .cancel-btn {
        padding: 0.75rem 1.5rem;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-danger);
        background: transparent;
        border: 1.5px solid var(--color-danger);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cancel-btn:hover {
        background: rgba(255, 59, 48, 0.05);
    }
</style>
