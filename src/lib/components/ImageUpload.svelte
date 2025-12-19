<script lang="ts">
    /**
     * Image Upload Component
     * Multi-file image upload with previews
     */
    import { createEventDispatcher } from "svelte";

    export let files: File[] = [];
    export let disabled = false;
    export let maxFiles = 10;

    const dispatch = createEventDispatcher<{ change: File[] }>();

    let fileInput: HTMLInputElement;
    let previews: { file: File; url: string }[] = [];

    $: {
        // Update previews when files change
        previews = files.map((file) => ({
            file,
            url: URL.createObjectURL(file),
        }));
    }

    function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files) return;

        const newFiles = Array.from(input.files);
        const combined = [...files, ...newFiles].slice(0, maxFiles);
        files = combined;
        dispatch("change", files);

        // Reset input to allow selecting same files again
        input.value = "";
    }

    function removeFile(index: number) {
        // Revoke URL to prevent memory leak
        URL.revokeObjectURL(previews[index].url);
        files = files.filter((_, i) => i !== index);
        dispatch("change", files);
    }

    function openFilePicker() {
        fileInput?.click();
    }
</script>

<div class="image-upload">
    <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        multiple
        on:change={handleFileSelect}
        {disabled}
        class="hidden-input"
    />

    <div class="upload-area" class:has-files={files.length > 0}>
        {#if previews.length > 0}
            <div class="preview-grid">
                {#each previews as preview, index (preview.url)}
                    <div class="preview-item">
                        <img src={preview.url} alt="Preview {index + 1}" />
                        <button
                            type="button"
                            class="remove-btn"
                            on:click={() => removeFile(index)}
                            {disabled}
                            aria-label="Remove image"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                {/each}

                {#if files.length < maxFiles}
                    <button
                        type="button"
                        class="add-more-btn"
                        on:click={openFilePicker}
                        {disabled}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                {/if}
            </div>
        {:else}
            <button
                type="button"
                class="upload-btn"
                on:click={openFilePicker}
                {disabled}
            >
                <svg
                    class="upload-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                >
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle
                        cx="8.5"
                        cy="8.5"
                        r="1.5"
                        fill="currentColor"
                        stroke="none"
                    />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
                <span class="upload-text">Add Photos</span>
                <span class="upload-hint">Max {maxFiles} images</span>
            </button>
        {/if}
    </div>

    {#if files.length > 0}
        <div class="file-count">
            {files.length} of {maxFiles}
        </div>
    {/if}
</div>

<style>
    .image-upload {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .hidden-input {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
    }

    .upload-area {
        border: 1.5px dashed var(--color-border);
        border-radius: 12px;
        background: var(--color-bg);
        transition: all 0.2s;
    }

    .upload-area:hover {
        border-color: var(--color-primary);
    }

    .upload-area.has-files {
        border-style: solid;
        border-color: var(--color-border-light);
        padding: 0.75rem;
    }

    .upload-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 2rem;
        color: var(--color-text-tertiary);
        background: transparent;
        border: none;
        cursor: pointer;
        transition: color 0.2s;
    }

    .upload-btn:hover:not(:disabled) {
        color: var(--color-primary);
    }

    .upload-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .upload-icon {
        width: 2.5rem;
        height: 2.5rem;
    }

    .upload-text {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-secondary);
    }

    .upload-hint {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
    }

    .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
        gap: 0.5rem;
    }

    .preview-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        background: var(--color-bg-secondary);
    }

    .preview-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .remove-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 22px;
        height: 22px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.6);
        border: none;
        border-radius: 50%;
        color: white;
        cursor: pointer;
        transition: all 0.15s;
    }

    .remove-btn:hover {
        background: var(--color-danger);
    }

    .remove-btn svg {
        width: 12px;
        height: 12px;
    }

    .add-more-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 1;
        color: var(--color-text-tertiary);
        background: var(--color-bg-secondary);
        border: 1.5px dashed var(--color-border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .add-more-btn:hover:not(:disabled) {
        border-color: var(--color-primary);
        color: var(--color-primary);
    }

    .add-more-btn svg {
        width: 1.5rem;
        height: 1.5rem;
    }

    .file-count {
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        text-align: right;
    }
</style>
