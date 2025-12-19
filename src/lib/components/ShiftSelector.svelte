<script lang="ts">
  /**
   * Shift Selector Component
   * Dropdown for selecting shift A, B, or C
   */
  import { createEventDispatcher } from "svelte";

  export let value: "A" | "B" | "C" = "A";
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: "A" | "B" | "C" }>();

  const shifts = [
    { value: "A", label: "Shift A", color: "#007AFF" },
    { value: "B", label: "Shift B", color: "#34C759" },
    { value: "C", label: "Shift C", color: "#AF52DE" },
  ] as const;

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    value = target.value as "A" | "B" | "C";
    dispatch("change", value);
  }

  $: currentShift = shifts.find((s) => s.value === value);
</script>

<div class="shift-selector">
  <label for="shift-select" class="label">Shift</label>
  <div class="select-wrapper">
    <select
      id="shift-select"
      bind:value
      on:change={handleChange}
      {disabled}
      class="select"
    >
      {#each shifts as shift}
        <option value={shift.value}>{shift.label}</option>
      {/each}
    </select>
    <div
      class="indicator"
      style="background-color: {currentShift?.color}"
    ></div>
  </div>
</div>

<style>
  .shift-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .label {
    font-family: var(--font-family-heading);
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .select-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .select {
    flex: 1;
    padding: 0.75rem 1rem;
    font-family: var(--font-family-sans);
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    appearance: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .select:hover:not(:disabled) {
    border-color: var(--color-border);
  }

  .select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  }

  .select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
