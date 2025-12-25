<script lang="ts">
    /**
     * Collapsible Section Component
     * Expandable/collapsible container for form sections
     */
    export let title: string;
    export let icon: string = "";
    export let logoUrl: string = "";
    export let logoStyle: string = "";
    export let expanded = true;
    export let badge: string | number | null = null;

    function toggle() {
        expanded = !expanded;
    }
</script>

<div class="collapsible-section" class:expanded>
    <button type="button" class="section-header" on:click={toggle}>
        <div class="section-title">
            {#if logoUrl}
                <img
                    src={logoUrl}
                    alt=""
                    class="section-logo"
                    style={logoStyle}
                />
            {/if}
            {#if icon}
                <span class="icon">{icon}</span>
            {/if}
            <span class="title">{title}</span>
            {#if badge !== null}
                <span class="badge">{badge}</span>
            {/if}
        </div>
        <svg
            class="chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
        >
            <path d="M6 9l6 6 6-6" />
        </svg>
    </button>

    {#if expanded}
        <div class="section-content">
            <slot />
        </div>
    {/if}
</div>

<style>
    .collapsible-section {
        background: var(--color-bg);
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid var(--color-border-light);
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 1rem 1.25rem;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: background 0.15s;
    }

    .section-header:hover {
        background: var(--color-bg-secondary);
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .icon {
        font-size: 1.125rem;
    }

    .section-logo {
        width: 20px;
        height: 20px;
        object-fit: contain;
        border-radius: 4px;
    }

    .title {
        font-family: var(--font-family-heading);
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .badge {
        padding: 0.125rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-primary);
        background: rgba(0, 122, 255, 0.1);
        border-radius: 100px;
    }

    .chevron {
        width: 1.25rem;
        height: 1.25rem;
        color: var(--color-text-tertiary);
        transition: transform 0.2s;
    }

    .expanded .chevron {
        transform: rotate(180deg);
    }

    .section-content {
        padding: 0 1.25rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
    }
</style>
