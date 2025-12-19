<script lang="ts">
    /**
     * Today Page
     * Main operation log entry page
     */
    import { onMount } from "svelte";
    import ShiftSelector from "$lib/components/ShiftSelector.svelte";
    import PresetGrid from "$lib/components/PresetGrid.svelte";
    import SessionForm from "$lib/components/SessionForm.svelte";
    import SessionList from "$lib/components/SessionList.svelte";
    import {
        listSessionsByDate,
        createSession,
        uploadImages,
        deleteSession,
        type OplogSession,
    } from "$lib/api/oplog";
    import { toast } from "$lib/stores/toast";
    import type { PresetMode } from "$lib/config/timePresets";
    import { goto } from "$app/navigation";
    import { isSupabaseConfigured } from "$lib/supabaseClient";

    // State
    let selectedDate = new Date().toISOString().split("T")[0];
    let shift: "A" | "B" | "C" = "A";
    let presetMode: PresetMode = "fixed";
    let selectedPresetKey: string | null = null;
    let startTime = "";
    let sessions: OplogSession[] = [];
    let isLoading = true;
    let isSaving = false;
    let sessionFormRef: SessionForm;
    let supabaseReady = false;

    // Check Supabase configuration on mount
    onMount(() => {
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

    function handlePresetSelect(
        event: CustomEvent<{ key: string; time: string }>,
    ) {
        selectedPresetKey = event.detail.key;
        startTime = event.detail.time;
    }

    function handlePresetModeChange(event: CustomEvent<PresetMode>) {
        presetMode = event.detail;
        selectedPresetKey = null;
        startTime = "";
    }

    async function handleFormSubmit(event: CustomEvent) {
        const formData = event.detail;
        isSaving = true;

        try {
            // Create session
            const session = await createSession({
                log_date: selectedDate,
                shift: formData.shift,
                preset_key: formData.preset_key,
                start_time: formData.start_time,
                end_time: formData.end_time || undefined,
                broker: formData.broker,
                trader: formData.trader,
                head: formData.head,
                market_mode: formData.market_mode || undefined,
                inventory_status: formData.inventory_status || undefined,
                risk_flag: formData.risk_flag || undefined,
                execution_issue: formData.execution_issue || undefined,
                pnl_snapshot: formData.pnl_snapshot,
                action_taken: formData.action_taken || undefined,
                note: formData.note,
            });

            // Upload images if any
            if (formData.images && formData.images.length > 0) {
                await uploadImages(
                    selectedDate,
                    formData.shift,
                    session.id,
                    formData.images,
                );
            }

            toast.success("Session saved successfully!");

            // Reset form
            sessionFormRef?.reset();
            selectedPresetKey = null;
            startTime = "";

            // Reload sessions
            await loadSessions();

            // Scroll to new session
            setTimeout(() => {
                const element = document.getElementById(
                    `session-${session.id}`,
                );
                element?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }, 100);
        } catch (error) {
            console.error("Failed to save session:", error);
            toast.error("Failed to save session");
        } finally {
            isSaving = false;
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
</script>

<svelte:head>
    <title>Today - OpLog</title>
</svelte:head>

<div class="today-page">
    <header class="page-header">
        <h1>Operation Log</h1>
        <div class="date-picker">
            <input
                type="date"
                bind:value={selectedDate}
                max={new Date().toISOString().split("T")[0]}
            />
        </div>
    </header>

    {#if !supabaseReady}
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
        <section class="form-section card">
            <h2>New Session</h2>

            <div class="form-controls">
                <ShiftSelector bind:value={shift} disabled={isSaving} />

                <PresetGrid
                    mode={presetMode}
                    selectedKey={selectedPresetKey}
                    disabled={isSaving}
                    on:select={handlePresetSelect}
                    on:modeChange={handlePresetModeChange}
                />
            </div>

            <SessionForm
                bind:this={sessionFormRef}
                {shift}
                presetKey={selectedPresetKey}
                {startTime}
                disabled={isSaving}
                on:submit={handleFormSubmit}
            />
        </section>

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
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }

    @media (min-width: 1024px) {
        .content-grid {
            grid-template-columns: 1fr 1fr;
            align-items: start;
        }
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
        gap: 1rem;
    }

    .section-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
    }

    .section-header h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text);
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
</style>
