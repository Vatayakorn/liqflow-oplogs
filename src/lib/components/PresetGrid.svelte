<script lang="ts">
    /**
     * Preset Grid Component
     * Displays time preset buttons for quick time selection
     */
    import { createEventDispatcher } from "svelte";
    import {
        fixedPresets,
        generateEvery30mPresets,
        formatTime,
        type Preset,
        type PresetMode,
    } from "$lib/config/timePresets";

    export let mode: PresetMode = "fixed";
    export let selectedKey: string | null = null;
    export let disabled = false;

    const dispatch = createEventDispatcher<{
        select: { key: string; time: string };
        modeChange: PresetMode;
    }>();

    $: presets = mode === "fixed" ? fixedPresets : generateEvery30mPresets();

    function handleSelect(preset: Preset) {
        if (disabled) return;
        selectedKey = preset.key;
        dispatch("select", {
            key: preset.key,
            time: formatTime(preset.h, preset.m),
        });
    }

    function toggleMode() {
        mode = mode === "fixed" ? "every30m" : "fixed";
        selectedKey = null;
        dispatch("modeChange", mode);
    }
</script>

<div class="preset-grid-wrapper">
    <div class="header">
        <span class="label">Time Presets</span>
        <button
            type="button"
            class="mode-toggle"
            on:click={toggleMode}
            {disabled}
        >
            {#if mode === "fixed"}
                <span>Fixed</span>
                <span class="toggle-arrow">→</span>
                <span class="toggle-hint">Every 30m</span>
            {:else}
                <span>Every 30m</span>
                <span class="toggle-arrow">→</span>
                <span class="toggle-hint">Fixed</span>
            {/if}
        </button>
    </div>

    <div class="preset-grid" class:every30m={mode === "every30m"}>
        {#each presets as preset (preset.key)}
            <button
                type="button"
                class="preset-chip"
                class:selected={selectedKey === preset.key}
                on:click={() => handleSelect(preset)}
                {disabled}
            >
                {formatTime(preset.h, preset.m)}
            </button>
        {/each}
    </div>
</div>

<style>
    .preset-grid-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .mode-toggle {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-primary);
        background: rgba(0, 122, 255, 0.1);
        border: none;
        border-radius: 100px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mode-toggle:hover:not(:disabled) {
        background: rgba(0, 122, 255, 0.15);
    }

    .mode-toggle:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .toggle-arrow {
        color: var(--color-text-tertiary);
    }

    .toggle-hint {
        color: var(--color-text-tertiary);
    }

    .preset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
        gap: 0.5rem;
        max-height: 180px;
        overflow-y: auto;
        padding: 2px;
    }

    .preset-grid.every30m {
        max-height: 280px;
    }

    .preset-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0.5rem 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-text);
        background: var(--color-bg);
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .preset-chip:hover:not(:disabled) {
        background: var(--color-bg-secondary);
        border-color: var(--color-border);
    }

    .preset-chip:active:not(:disabled) {
        transform: scale(0.97);
    }

    .preset-chip.selected {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
    }

    .preset-chip:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Scrollbar styling */
    .preset-grid::-webkit-scrollbar {
        width: 4px;
    }

    .preset-grid::-webkit-scrollbar-track {
        background: transparent;
    }

    .preset-grid::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border-radius: 2px;
    }
</style>
