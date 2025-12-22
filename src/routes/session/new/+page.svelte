<script lang="ts">
    import SessionForm from "$lib/components/SessionForm.svelte";
    import { createSession, uploadImages, uploadAudio } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import { goto } from "$app/navigation";

    let isSaving = false;
    let sessionFormRef: SessionForm;

    async function handleFormSubmit(event: CustomEvent) {
        const formData = event.detail;
        isSaving = true;

        const logDate = new Date().toISOString().split("T")[0];

        try {
            const session = await createSession({
                log_date: logDate, // Default to today
                shift: formData.shift || "A",
                start_time: formData.start_time,
                end_time: formData.end_time || undefined,
                broker: formData.broker,
                trader: formData.trader,
                head: formData.head,
                recorder: formData.recorder,
                fx_rate: formData.fx_rate
                    ? parseFloat(formData.fx_rate)
                    : undefined,
                fx_notes: formData.fx_notes,
                btz_bid: formData.btz_bid,
                btz_ask: formData.btz_ask,
                btz_notes: formData.btz_notes,
                exchange1: formData.exchange1,
                exchange1_price: formData.exchange1_price,
                exchange2: formData.exchange2,
                exchange2_price: formData.exchange2_price,
                exchange_diff: formData.exchange_diff,
                exchange_higher: formData.exchange_higher,
                exchange_notes: formData.exchange_notes,
                otc_transactions: formData.otc_transactions,
                prefund_current: formData.prefund_current,
                prefund_target: formData.prefund_target,
                matching_notes: formData.matching_notes,
                otc_notes: formData.otc_notes,
                note: formData.note,
                market_context: formData.market_context,
            });

            if (formData.images && formData.images.length > 0) {
                await uploadImages(
                    logDate,
                    formData.shift || "A",
                    session.id,
                    formData.images,
                );
            }

            if (formData.audio && formData.audio.length > 0) {
                await uploadAudio(
                    logDate,
                    formData.shift || "A",
                    session.id,
                    formData.audio,
                );
            }

            toast.success("Session created successfully!");
            goto("/today");
        } catch (error) {
            console.error("Failed to save session:", error);
            toast.error("Failed to save session");
        } finally {
            isSaving = false;
        }
    }
</script>

<svelte:head>
    <title>New Session - OpLogs</title>
</svelte:head>

<div class="new-session-page">
    <header class="page-header">
        <button class="back-btn" on:click={() => goto("/today")}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-6"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
            </svg>
            Back
        </button>
        <h1>New Session</h1>
        <div class="spacer"></div>
        <!-- Balance the header -->
    </header>

    <main class="content">
        <SessionForm
            bind:this={sessionFormRef}
            disabled={isSaving}
            on:submit={handleFormSubmit}
        />
    </main>
</div>

<style>
    .new-session-page {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--color-bg);
        padding-bottom: 80px; /* Space for bottom nav */
    }

    .page-header {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-bottom: 0.5px solid var(--color-separator);
    }

    .page-header h1 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .back-btn {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        border: none;
        background: none;
        color: var(--color-primary);
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        padding: 0;
    }

    .back-btn svg {
        width: 1.25rem;
        height: 1.25rem;
    }

    .spacer {
        width: 3rem; /* Approximate width of back button for centering */
    }

    .content {
        padding: 1rem;
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
    }
</style>
