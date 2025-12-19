<script lang="ts">
    /**
     * Audio Recorder Component
     * Records audio, manages clips, and emits files for upload
     */
    import { createEventDispatcher, onDestroy } from "svelte";

    export let disabled = false;

    const dispatch = createEventDispatcher<{
        change: File[];
        transcribe: File;
    }>();

    let mediaRecorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let isRecording = false;
    let recordingTime = 0;
    let timerInterval: any;

    // Stored recordings
    interface AudioPreview {
        id: string; // url
        file: File;
        durationFormatted: string;
    }
    let recordings: AudioPreview[] = [];

    async function startRecording() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                mediaRecorder = new MediaRecorder(stream);
                chunks = [];

                mediaRecorder.ondataavailable = (e) => {
                    chunks.push(e.data);
                };

                mediaRecorder.onstop = (e) => {
                    const blob = new Blob(chunks, { type: "audio/webm" }); // or audio/mp4 if supported
                    const timestamp = new Date().getTime();
                    const filename = `recording_${timestamp}.webm`;
                    const file = new File([blob], filename, {
                        type: "audio/webm",
                    });

                    const url = URL.createObjectURL(blob);

                    recordings = [
                        ...recordings,
                        {
                            id: url,
                            file: file,
                            durationFormatted: formatTime(recordingTime),
                        },
                    ];

                    dispatch(
                        "change",
                        recordings.map((r) => r.file),
                    );
                    chunks = [];
                    stream.getTracks().forEach((track) => track.stop());
                };

                mediaRecorder.start();
                isRecording = true;
                recordingTime = 0;
                timerInterval = setInterval(() => {
                    recordingTime++;
                }, 1000);
            } catch (err) {
                console.error(
                    "The following getUserMedia error occurred: " + err,
                );
                alert("Could not access microphone.");
            }
        } else {
            alert("getUserMedia not supported on your browser!");
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            clearInterval(timerInterval);
        }
    }

    function deleteRecording(index: number) {
        URL.revokeObjectURL(recordings[index].id);
        recordings = recordings.filter((_, i) => i !== index);
        dispatch(
            "change",
            recordings.map((r) => r.file),
        );
    }

    function triggerTranscribe(file: File) {
        dispatch("transcribe", file);
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0");
        const secs = (seconds % 60).toString().padStart(2, "0");
        return `${mins}:${secs}`;
    }

    onDestroy(() => {
        clearInterval(timerInterval);
        recordings.forEach((r) => URL.revokeObjectURL(r.id));
    });
</script>

<div class="audio-recorder">
    <div class="controls">
        {#if !isRecording}
            <button
                type="button"
                class="record-btn"
                on:click={startRecording}
                {disabled}
            >
                <div class="mic-icon">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                        />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                </div>
                <span>Record Voice</span>
            </button>
        {:else}
            <button type="button" class="stop-btn" on:click={stopRecording}>
                <div class="stop-icon"></div>
                <span class="timer">{formatTime(recordingTime)}</span>
            </button>
        {/if}
    </div>

    {#if recordings.length > 0}
        <div class="recordings-list">
            {#each recordings as rec, i (rec.id)}
                <div class="recording-item">
                    <div class="rec-info">
                        <span class="rec-icon">🔊</span>
                        <span class="rec-duration">{rec.durationFormatted}</span
                        >
                    </div>
                    <audio src={rec.id} controls class="audio-player"></audio>
                    <button
                        type="button"
                        class="transcribe-btn-small"
                        on:click={() => triggerTranscribe(rec.file)}
                        {disabled}
                        title="Transcribe this clip"
                    >
                        ✨
                    </button>
                    <button
                        type="button"
                        class="delete-btn"
                        on:click={() => deleteRecording(i)}
                        {disabled}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .audio-recorder {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .controls {
        display: flex;
        justify-content: center;
    }

    .record-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 20px;
        color: var(--color-text);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .record-btn:hover:not(:disabled) {
        background: var(--color-border-light);
    }

    .record-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .mic-icon svg {
        width: 1.25rem;
        height: 1.25rem;
    }

    .stop-btn {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1.5rem;
        background: #ff3b30;
        border: none;
        border-radius: 20px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        animation: pulse 1.5s infinite;
    }

    .stop-icon {
        width: 1rem;
        height: 1rem;
        background: white;
        border-radius: 2px;
    }

    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(255, 59, 48, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
        }
    }

    .recordings-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .recording-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem;
        background: var(--color-bg-secondary);
        border-radius: 8px;
    }

    .rec-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 3rem;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
    }

    .audio-player {
        flex: 1;
        height: 2rem;
    }

    .delete-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        background: transparent;
        border: none;
        color: var(--color-text-tertiary);
        cursor: pointer;
        border-radius: 50%;
    }

    .delete-btn:hover {
        background: rgba(0, 0, 0, 0.05);
        color: var(--color-danger);
    }

    .delete-btn svg {
        width: 1.25rem;
        height: 1.25rem;
    }

    .transcribe-btn-small {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        background: rgba(0, 122, 255, 0.1);
        border: none;
        border-radius: 50%;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s;
    }

    .transcribe-btn-small:hover:not(:disabled) {
        background: rgba(0, 122, 255, 0.2);
        transform: scale(1.1);
    }

    .transcribe-btn-small:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
