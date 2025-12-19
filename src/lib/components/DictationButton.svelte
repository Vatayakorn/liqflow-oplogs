<script lang="ts">
    /**
     * Dictation Button Component
     * Uses Web Speech API for voice-to-text input
     */
    import { createEventDispatcher, onMount } from "svelte";

    export let disabled = false;

    const dispatch = createEventDispatcher<{
        result: string;
        error: string;
    }>();

    let isListening = false;
    let isSupported = false;
    let recognition: SpeechRecognition | null = null;

    onMount(() => {
        // Check for Web Speech API support
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            isSupported = true;
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "th-TH"; // Thai language, change as needed

            recognition.onresult = (event) => {
                let transcript = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                dispatch("result", transcript);
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                dispatch("error", event.error);
                isListening = false;
            };

            recognition.onend = () => {
                isListening = false;
            };
        }
    });

    function toggleListening() {
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
        isListening = !isListening;
    }
</script>

<button
    type="button"
    class="dictation-btn"
    class:listening={isListening}
    class:unsupported={!isSupported}
    on:click={toggleListening}
    disabled={disabled || !isSupported}
    title={!isSupported
        ? "Speech recognition not supported"
        : isListening
          ? "Stop recording"
          : "Start voice input"}
>
    {#if !isSupported}
        <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
        >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        </svg>
    {:else if isListening}
        <svg class="icon pulse" viewBox="0 0 24 24" fill="currentColor">
            <rect x="9" y="5" width="6" height="14" rx="3" />
        </svg>
    {:else}
        <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
        >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    {/if}
    <span class="label">
        {#if !isSupported}
            Not Supported
        {:else if isListening}
            Recording...
        {:else}
            Voice
        {/if}
    </span>
</button>

<style>
    .dictation-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.875rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        background: var(--color-bg);
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .dictation-btn:hover:not(:disabled) {
        background: var(--color-bg-secondary);
        border-color: var(--color-border);
    }

    .dictation-btn:active:not(:disabled) {
        transform: scale(0.97);
    }

    .dictation-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .dictation-btn.listening {
        background: var(--color-danger);
        border-color: var(--color-danger);
        color: white;
    }

    .dictation-btn.unsupported {
        color: var(--color-text-tertiary);
    }

    .icon {
        width: 1.125rem;
        height: 1.125rem;
        flex-shrink: 0;
    }

    .icon.pulse {
        animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }

    .label {
        white-space: nowrap;
    }
</style>
