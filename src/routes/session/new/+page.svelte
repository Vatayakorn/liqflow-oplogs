<script lang="ts">
    import SessionForm from "$lib/components/SessionForm.svelte";
    import { createSession, uploadImages, uploadAudio } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import { goto } from "$app/navigation";

    let isSaving = false;
    let sessionFormRef: SessionForm;

    // Date for the session (default: today)
    let logDate = new Date().toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    async function handleFormSubmit(event: CustomEvent) {
        const formData = event.detail;
        isSaving = true;

        try {
            const { images, audio, ...sessionData } = formData;
            const session = await createSession({
                log_date: logDate, // Use selected date
                ...sessionData,
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

    <!-- Date Selector -->
    <div class="date-selector">
        <label for="logDate">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="icon"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
            </svg>
            Recording Date:
        </label>
        <input type="date" id="logDate" bind:value={logDate} max={today} />
        {#if logDate !== today}
            <span class="backdate-badge">📅 Backdating</span>
        {/if}
    </div>

    <main class="content">
        <SessionForm
            bind:this={sessionFormRef}
            disabled={isSaving}
            {logDate}
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

    .date-selector {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: #fff;
        border-bottom: 0.5px solid var(--color-separator);
    }

    .date-selector label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-text-secondary, #666);
    }

    .date-selector .icon {
        width: 1rem;
        height: 1rem;
    }

    .date-selector input[type="date"] {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-separator, #ddd);
        border-radius: 8px;
        font-size: 0.95rem;
        background: #fff;
        color: var(--color-text);
    }

    .backdate-badge {
        padding: 0.25rem 0.5rem;
        background: #fff3cd;
        color: #856404;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 500;
    }
</style>
