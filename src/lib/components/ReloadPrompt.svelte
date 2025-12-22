<script lang="ts">
    import { useRegisterSW } from "virtual:pwa-register/svelte";

    const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
        onRegistered(swr: ServiceWorkerRegistration | undefined) {
            console.log("SW registered: ", swr);
        },
        onRegisterError(error: any) {
            console.log("SW registration error", error);
        },
    });

    function close() {
        offlineReady.set(false);
        needRefresh.set(false);
    }
</script>

{#if $offlineReady || $needRefresh}
    <div class="pwa-toast" role="alert">
        <div class="message">
            {#if $offlineReady}
                <span>App ready to work offline</span>
            {:else}
                <span
                    >New content available, click on reload button to update.</span
                >
            {/if}
        </div>
        {#if $needRefresh}
            <button onclick={() => updateServiceWorker(true)}> Reload </button>
        {/if}
        <button onclick={close}> Close </button>
    </div>
{/if}

<style>
    .pwa-toast {
        position: fixed;
        right: 0;
        bottom: 0;
        margin: 16px;
        padding: 12px;
        border: 1px solid #8885;
        border-radius: 4px;
        z-index: 10000; /* High z-index to overlay everything */
        text-align: left;
        box-shadow: 3px 4px 5px 0 #8885;
        background-color: #333;
        color: white;
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 8px;
        align-items: center;
    }
    .message {
        margin-right: 8px;
    }
    button {
        border: 1px solid #8885;
        outline: none;
        margin-right: 5px;
        border-radius: 2px;
        padding: 3px 10px;
        background-color: transparent;
        color: white;
        cursor: pointer;
    }
    button:hover {
        background-color: #444;
    }
</style>
