<script lang="ts">
    /**
     * Session Form Component
     * Main form for creating/editing operation log sessions
     */
    import { createEventDispatcher } from "svelte";
    import DictationButton from "./DictationButton.svelte";
    import ImageUpload from "./ImageUpload.svelte";
    import { addMinutes } from "$lib/config/timePresets";

    export let shift: "A" | "B" | "C" = "A";
    export let presetKey: string | null = null;
    export let startTime = "";
    export let disabled = false;

    const dispatch = createEventDispatcher<{
        submit: {
            shift: "A" | "B" | "C";
            preset_key: string | null;
            start_time: string;
            end_time: string;
            broker: string;
            trader: string;
            head: string;
            market_mode: string;
            inventory_status: string;
            risk_flag: string;
            execution_issue: string;
            pnl_snapshot: number | null;
            action_taken: string;
            note: string;
            images: File[];
        };
    }>();

    // Form state
    let endTime = "";
    let broker = "";
    let trader = "";
    let head = "";
    let marketMode = "";
    let inventoryStatus = "";
    let riskFlag = "";
    let executionIssue = "";
    let pnlSnapshot: string = "";
    let actionTaken = "";
    let note = "";
    let images: File[] = [];
    let isSubmitting = false;

    // Auto-fill end time when start time changes
    $: if (startTime && !endTime) {
        endTime = addMinutes(startTime, 30);
    }

    function handleDictation(event: CustomEvent<string>) {
        note += (note ? " " : "") + event.detail;
    }

    function handleImageChange(event: CustomEvent<File[]>) {
        images = event.detail;
    }

    async function handleSubmit() {
        if (!startTime || !broker || !trader || !head) {
            return;
        }

        isSubmitting = true;

        dispatch("submit", {
            shift,
            preset_key: presetKey,
            start_time: startTime,
            end_time: endTime || "",
            broker,
            trader,
            head,
            market_mode: marketMode,
            inventory_status: inventoryStatus,
            risk_flag: riskFlag,
            execution_issue: executionIssue,
            pnl_snapshot: pnlSnapshot ? parseFloat(pnlSnapshot) : null,
            action_taken: actionTaken,
            note,
            images,
        });

        // Reset will be handled by parent after successful save
        isSubmitting = false;
    }

    export function reset() {
        endTime = "";
        broker = "";
        trader = "";
        head = "";
        marketMode = "";
        inventoryStatus = "";
        riskFlag = "";
        executionIssue = "";
        pnlSnapshot = "";
        actionTaken = "";
        note = "";
        images = [];
    }
</script>

<form class="session-form" on:submit|preventDefault={handleSubmit}>
    <div class="form-section">
        <h3 class="section-title">Time</h3>
        <div class="row">
            <div class="field">
                <label for="start-time">Start *</label>
                <input
                    id="start-time"
                    type="time"
                    bind:value={startTime}
                    required
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label for="end-time">End</label>
                <input
                    id="end-time"
                    type="time"
                    bind:value={endTime}
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
    </div>

    <div class="form-section">
        <h3 class="section-title">Team</h3>
        <div class="row three-cols">
            <div class="field">
                <label for="broker">Broker *</label>
                <input
                    id="broker"
                    type="text"
                    bind:value={broker}
                    placeholder="Name"
                    required
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label for="trader">Trader *</label>
                <input
                    id="trader"
                    type="text"
                    bind:value={trader}
                    placeholder="Name"
                    required
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label for="head">Head *</label>
                <input
                    id="head"
                    type="text"
                    bind:value={head}
                    placeholder="Name"
                    required
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
    </div>

    <div class="form-section">
        <h3 class="section-title">Status</h3>
        <div class="row">
            <div class="field">
                <label for="market-mode">Market Mode</label>
                <input
                    id="market-mode"
                    type="text"
                    bind:value={marketMode}
                    placeholder="Normal, Volatile..."
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label for="inventory-status">Inventory</label>
                <input
                    id="inventory-status"
                    type="text"
                    bind:value={inventoryStatus}
                    placeholder="High, Low..."
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label for="risk-flag">Risk Flag</label>
                <input
                    id="risk-flag"
                    type="text"
                    bind:value={riskFlag}
                    placeholder="None, Warning..."
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label for="execution-issue">Execution Issue</label>
                <input
                    id="execution-issue"
                    type="text"
                    bind:value={executionIssue}
                    placeholder="Any issues?"
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
    </div>

    <div class="form-section">
        <h3 class="section-title">Performance</h3>
        <div class="row">
            <div class="field">
                <label for="pnl-snapshot">P&L Snapshot</label>
                <input
                    id="pnl-snapshot"
                    type="number"
                    step="0.01"
                    bind:value={pnlSnapshot}
                    placeholder="0.00"
                    disabled={disabled || isSubmitting}
                />
            </div>
            <div class="field">
                <label for="action-taken">Action Taken</label>
                <input
                    id="action-taken"
                    type="text"
                    bind:value={actionTaken}
                    placeholder="Action..."
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
    </div>

    <div class="form-section">
        <h3 class="section-title">Note</h3>
        <div class="note-container">
            <textarea
                id="note"
                bind:value={note}
                placeholder="Add notes..."
                rows="3"
                disabled={disabled || isSubmitting}
            ></textarea>
            <div class="dictation-wrapper">
                <DictationButton
                    on:result={handleDictation}
                    disabled={disabled || isSubmitting}
                />
            </div>
        </div>
    </div>

    <div class="form-section">
        <h3 class="section-title">Photos</h3>
        <ImageUpload
            bind:files={images}
            on:change={handleImageChange}
            disabled={disabled || isSubmitting}
        />
    </div>

    <div class="form-actions">
        <button
            type="submit"
            class="submit-btn"
            disabled={disabled ||
                isSubmitting ||
                !startTime ||
                !broker ||
                !trader ||
                !head}
        >
            {#if isSubmitting}
                <span class="spinner"></span>
                Saving...
            {:else}
                Save Session
            {/if}
        </button>
    </div>
</form>

<style>
    .session-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .form-section {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
    }

    .section-title {
        font-family: var(--font-family-heading);
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 0;
    }

    .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .row.three-cols {
        grid-template-columns: repeat(3, 1fr);
    }

    @media (max-width: 640px) {
        .row {
            grid-template-columns: 1fr;
        }

        .row.three-cols {
            grid-template-columns: 1fr;
        }
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .field label {
        font-family: var(--font-family-heading);
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-secondary);
    }

    .field input,
    textarea {
        padding: 0.75rem 1rem;
        font-family: var(--font-family-sans);
        font-size: 1rem;
        font-weight: 500;
        color: var(--color-text);
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .field input:hover:not(:disabled),
    textarea:hover:not(:disabled) {
        border-color: var(--color-border);
    }

    .field input:focus,
    textarea:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }

    .field input:disabled,
    textarea:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .field input::placeholder,
    textarea::placeholder {
        color: var(--color-text-tertiary);
    }

    .note-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    textarea {
        resize: vertical;
        min-height: 80px;
        font-family: inherit;
    }

    .dictation-wrapper {
        display: flex;
        justify-content: flex-end;
    }

    .form-actions {
        padding-top: 0.5rem;
    }

    .submit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.875rem 1.5rem;
        font-size: 1rem;
        font-weight: 600;
        color: white;
        background: var(--color-primary);
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .submit-btn:hover:not(:disabled) {
        background: #0066dd;
    }

    .submit-btn:active:not(:disabled) {
        transform: scale(0.98);
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .spinner {
        width: 1.125rem;
        height: 1.125rem;
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
</style>
