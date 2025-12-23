<script lang="ts">
    import type { ChatMessage } from "$lib/api/chatlog";

    export let messages: ChatMessage[] = [];
    export let loading: boolean = false;

    // Search functionality
    let searchQuery = "";

    // Filter messages by search query
    $: filteredMessages = searchQuery.trim()
        ? messages.filter((msg) => {
              const query = searchQuery.toLowerCase();
              const text = msg.message_text?.toLowerCase() || "";
              const sender = msg.from_first_name?.toLowerCase() || "";
              const username = msg.from_username?.toLowerCase() || "";
              return (
                  text.includes(query) ||
                  sender.includes(query) ||
                  username.includes(query)
              );
          })
        : messages;

    // Show limited messages initially, expand on click
    let expanded = false;
    const INITIAL_LIMIT = 5;

    $: visibleMessages = expanded
        ? filteredMessages
        : filteredMessages.slice(0, INITIAL_LIMIT);
    $: hasMore = filteredMessages.length > INITIAL_LIMIT;
    $: hiddenCount = filteredMessages.length - INITIAL_LIMIT;

    function formatTime(dateStr: string): string {
        // Bot stores Thai local time as UTC timestamps
        // So we extract the UTC hours/minutes directly without timezone conversion
        const date = new Date(dateStr);
        const hours = date.getUTCHours().toString().padStart(2, "0");
        const minutes = date.getUTCMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    }

    function getSenderName(msg: ChatMessage): string {
        if (msg.from_first_name) return msg.from_first_name;
        if (msg.from_username) return `@${msg.from_username}`;
        return "Unknown";
    }
</script>

<div class="chatlog-container">
    {#if loading}
        <div class="loading-state">
            <div class="skeleton-bubble left"></div>
            <div class="skeleton-bubble right"></div>
            <div class="skeleton-bubble left"></div>
        </div>
    {:else if messages.length === 0}
        <div class="empty-state">
            <span class="empty-icon">💬</span>
            <p>No chat messages during this session</p>
        </div>
    {:else}
        <!-- Search Input -->
        <div class="search-container">
            <svg
                class="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
                type="text"
                class="search-input"
                placeholder="Search messages..."
                bind:value={searchQuery}
            />
            {#if searchQuery}
                <button
                    class="clear-search"
                    on:click={() => (searchQuery = "")}
                >
                    ✕
                </button>
            {/if}
        </div>

        {#if filteredMessages.length === 0}
            <div class="empty-state small">
                <p>No messages match "{searchQuery}"</p>
            </div>
        {:else}
            <div class="messages-list">
                {#each visibleMessages as msg (msg.id)}
                    <div
                        class="message-wrapper"
                        class:outgoing={msg.direction === "out"}
                        class:incoming={msg.direction !== "out"}
                        class:bot={msg.from_is_bot}
                    >
                        <div class="sender-name">
                            {getSenderName(msg)}
                            {#if msg.from_is_bot}
                                <span class="bot-badge">🤖</span>
                            {/if}
                        </div>
                        <div class="message-bubble">
                            {#if msg.message_text}
                                <p class="message-text">{msg.message_text}</p>
                            {:else if msg.content_type}
                                <p class="message-media">
                                    [{msg.content_type}]
                                </p>
                            {:else}
                                <p class="message-empty">[empty message]</p>
                            {/if}
                        </div>
                        <span class="message-time"
                            >{formatTime(msg.created_at)}</span
                        >
                    </div>
                {/each}
            </div>
        {/if}

        {#if hasMore && filteredMessages.length > 0}
            <button class="expand-btn" on:click={() => (expanded = !expanded)}>
                {#if expanded}
                    ▲ Show less
                {:else}
                    ▼ Show more ({hiddenCount} messages)
                {/if}
            </button>
        {/if}
    {/if}
</div>

<style>
    .chatlog-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    /* Search Input */
    .search-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: 10px;
        padding: 0.5rem 0.75rem;
        margin-bottom: 0.5rem;
    }

    .search-icon {
        width: 1rem;
        height: 1rem;
        color: var(--color-text-tertiary);
        flex-shrink: 0;
    }

    .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 0.875rem;
        color: var(--color-text);
        outline: none;
    }

    .search-input::placeholder {
        color: var(--color-text-tertiary);
    }

    .clear-search {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        padding: 0;
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        background: var(--color-border-light);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.15s;
    }

    .clear-search:hover {
        background: var(--color-text-tertiary);
        color: var(--color-bg);
    }

    .empty-state.small {
        padding: 1rem;
    }

    .empty-state.small p {
        font-size: 0.8125rem;
    }

    /* Loading State */
    .loading-state {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem 0;
    }

    .skeleton-bubble {
        height: 3rem;
        border-radius: 16px;
        background: linear-gradient(
            90deg,
            var(--color-bg-secondary) 25%,
            var(--color-border-light) 50%,
            var(--color-bg-secondary) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
    }

    .skeleton-bubble.left {
        width: 60%;
        align-self: flex-start;
    }

    .skeleton-bubble.right {
        width: 50%;
        align-self: flex-end;
    }

    @keyframes shimmer {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }

    /* Empty State */
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2rem;
        color: var(--color-text-tertiary);
    }

    .empty-icon {
        font-size: 2rem;
        opacity: 0.5;
    }

    .empty-state p {
        margin: 0;
        font-size: 0.875rem;
    }

    /* Messages List */
    .messages-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-height: 400px;
        overflow-y: auto;
        padding-right: 0.5rem;
    }

    .message-wrapper {
        display: flex;
        flex-direction: column;
        max-width: 80%;
    }

    .message-wrapper.incoming {
        align-self: flex-start;
        align-items: flex-start;
    }

    .message-wrapper.outgoing {
        align-self: flex-end;
        align-items: flex-end;
    }

    .sender-name {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--color-text-tertiary);
        margin-bottom: 0.25rem;
        padding: 0 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .bot-badge {
        font-size: 0.75rem;
    }

    .message-bubble {
        padding: 0.625rem 0.875rem;
        border-radius: 16px;
        max-width: 100%;
        word-break: break-word;
    }

    .incoming .message-bubble {
        background: var(--color-bg-secondary);
        border-bottom-left-radius: 4px;
        color: var(--color-text);
    }

    .outgoing .message-bubble {
        background: var(--color-primary);
        border-bottom-right-radius: 4px;
        color: white;
    }

    .bot .message-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }

    .message-text {
        margin: 0;
        font-size: 0.9375rem;
        line-height: 1.4;
        white-space: pre-wrap;
    }

    .message-media,
    .message-empty {
        margin: 0;
        font-size: 0.8125rem;
        font-style: italic;
        opacity: 0.8;
    }

    .message-time {
        font-size: 0.625rem;
        color: var(--color-text-tertiary);
        margin-top: 0.125rem;
        padding: 0 0.5rem;
    }

    /* Expand Button */
    .expand-btn {
        align-self: center;
        padding: 0.5rem 1rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-primary);
        background: transparent;
        border: 1px solid var(--color-border-light);
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.15s;
        margin-top: 0.5rem;
    }

    .expand-btn:hover {
        background: rgba(0, 122, 255, 0.1);
        border-color: var(--color-primary);
    }
</style>
