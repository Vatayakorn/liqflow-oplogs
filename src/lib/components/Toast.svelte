<script lang="ts">
    /**
     * Toast Component
     * Displays toast notifications
     */
    import { toast, type Toast } from "$lib/stores/toast";
    import { fly, fade } from "svelte/transition";
    import { flip } from "svelte/animate";

    let toasts: Toast[] = [];

    toast.subscribe((value) => {
        toasts = value;
    });
</script>

<div class="toast-container">
    {#each toasts as t (t.id)}
        <div
            class="toast {t.type}"
            in:fly={{ y: -30, duration: 250 }}
            out:fade={{ duration: 150 }}
            animate:flip={{ duration: 250 }}
        >
            <span class="message">{t.message}</span>
            <button
                class="close"
                on:click={() => toast.dismiss(t.id)}
                aria-label="Dismiss"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        left: 1rem;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        pointer-events: none;
    }

    @media (min-width: 640px) {
        .toast-container {
            left: auto;
            width: 340px;
        }
    }

    .toast {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        background: var(--color-bg);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
        pointer-events: auto;
    }

    .toast.success {
        border-left: 3px solid var(--color-success);
    }

    .toast.error {
        border-left: 3px solid var(--color-danger);
    }

    .toast.info {
        border-left: 3px solid var(--color-primary);
    }

    .message {
        flex: 1;
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-text);
    }

    .close {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-tertiary);
        background: transparent;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .close:hover {
        color: var(--color-text);
        background: var(--color-bg-secondary);
    }

    .close svg {
        width: 0.875rem;
        height: 0.875rem;
    }
</style>
