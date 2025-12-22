<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    onMount(() => {
        goto("/history");
    });
</script>

<div class="redirecting">
    <p>Redirecting to History...</p>
</div>

<style>
    .redirecting {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 50vh;
        color: var(--color-text-tertiary);
    }
</style>
