<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    onMount(() => {
        goto("/today");
    });
</script>

<div class="redirect-page">
    <div class="loader">
        <div class="spinner"></div>
        <p>Redirecting to Today...</p>
    </div>
</div>

<style>
    .redirect-page {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: #94a3b8;
    }

    .spinner {
        width: 2rem;
        height: 2rem;
        border: 3px solid #334155;
        border-top-color: #0ea5e9;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    p {
        margin: 0;
        font-size: 0.875rem;
    }
</style>
