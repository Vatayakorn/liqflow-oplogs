<script lang="ts">
    /**
     * Customer Detail Page
     * แสดงรายละเอียดและการวิเคราะห์พฤติกรรมลูกค้า
     */
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import {
        getCustomerProfile,
        markFollowupDone,
        BEHAVIOR_CONFIG,
        type CustomerProfile,
        type BehaviorType,
    } from "$lib/api/customerAnalytics";
    import {
        analyzeAndSaveCustomerBehavior,
        getAIProviderStatus,
    } from "$lib/api/ai";

    let profile: CustomerProfile | null = null;
    let loading = true;
    let analyzing = false;
    let error: string | null = null;
    let providerStatus = getAIProviderStatus();
    let selectedProvider: "auto" | "openai" | "gemini" = "auto";
    let visibleChatCount = 50;

    $: customerName = $page.params.name
        ? decodeURIComponent($page.params.name)
        : "";

    onMount(async () => {
        await loadProfile();
    });

    async function loadProfile() {
        loading = true;
        error = null;

        try {
            profile = await getCustomerProfile(customerName);
            if (!profile) {
                error = "ไม่พบข้อมูลลูกค้า";
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load profile";
        } finally {
            loading = false;
        }
    }

    async function analyzeCustomer() {
        if (!profile) return;

        analyzing = true;
        error = null;

        try {
            const analytics = await analyzeAndSaveCustomerBehavior(
                profile,
                selectedProvider,
            );
            profile = { ...profile, analytics };
        } catch (e) {
            error = e instanceof Error ? e.message : "AI analysis failed";
        } finally {
            analyzing = false;
        }
    }

    async function handleFollowupDone() {
        if (!profile) return;

        try {
            await markFollowupDone(profile.name);
            if (profile.analytics) {
                profile.analytics.needs_followup = false;
                profile = { ...profile };
            }
        } catch (e) {
            console.error("Failed to mark followup:", e);
        }
    }

    function formatVolume(v: number): string {
        if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
        return v.toLocaleString();
    }

    function formatDate(dateStr: string | undefined): string {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    function formatDateTime(dateStr: string | undefined): string {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleString("th-TH", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    $: behaviorConfig = profile?.analytics?.behavior_type
        ? BEHAVIOR_CONFIG[profile.analytics.behavior_type]
        : null;
</script>

<svelte:head>
    <title>{customerName} - Customer Analytics | LiqFlow</title>
</svelte:head>

<main class="customer-detail">
    <!-- Back Button -->
    <button class="back-btn" on:click={() => goto("/customers")} type="button">
        ← กลับหน้า Dashboard
    </button>

    {#if loading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
        </div>
    {:else if error && !profile}
        <div class="error-state">
            <span>⚠️</span>
            <p>{error}</p>
            <button on:click={() => goto("/customers")}
                >กลับหน้า Dashboard</button
            >
        </div>
    {:else if profile}
        <!-- Profile Header -->
        <header class="profile-header">
            <div class="profile-info">
                {#if behaviorConfig}
                    <span
                        class="behavior-badge large"
                        style="--badge-color: {behaviorConfig.color}"
                    >
                        {behaviorConfig.emoji}
                    </span>
                {:else}
                    <span class="behavior-badge large">🆕</span>
                {/if}

                <div class="profile-text">
                    <h1>{profile.displayName}</h1>
                    {#if behaviorConfig}
                        <span
                            class="behavior-label"
                            style="color: {behaviorConfig.color}"
                        >
                            {behaviorConfig.label} • {behaviorConfig.labelTh}
                        </span>
                    {:else}
                        <span class="behavior-label">ยังไม่ได้วิเคราะห์</span>
                    {/if}
                </div>
            </div>

            <div class="profile-actions">
                {#if profile.analytics?.needs_followup}
                    <button
                        class="btn-followup"
                        on:click={handleFollowupDone}
                        type="button"
                    >
                        ✓ เสร็จสิ้น Follow-up
                    </button>
                {/if}

                <!-- Provider Selector -->
                <div class="provider-selector">
                    <button
                        class="provider-btn"
                        class:active={selectedProvider === "auto"}
                        on:click={() => (selectedProvider = "auto")}
                        disabled={!providerStatus.openai &&
                            !providerStatus.gemini}
                        title="Auto"
                        type="button">⚡</button
                    >
                    <button
                        class="provider-btn openai"
                        class:active={selectedProvider === "openai"}
                        on:click={() => (selectedProvider = "openai")}
                        disabled={!providerStatus.openai}
                        title="GPT-4"
                        type="button">🟢</button
                    >
                    <button
                        class="provider-btn gemini"
                        class:active={selectedProvider === "gemini"}
                        on:click={() => (selectedProvider = "gemini")}
                        disabled={!providerStatus.gemini}
                        title="Gemini"
                        type="button">🔵</button
                    >
                </div>

                <button
                    class="btn-analyze"
                    on:click={analyzeCustomer}
                    disabled={analyzing ||
                        (!providerStatus.openai && !providerStatus.gemini)}
                    type="button"
                >
                    {#if analyzing}
                        🔄 กำลังวิเคราะห์...
                    {:else}
                        🤖 {profile.analytics
                            ? "วิเคราะห์ใหม่"
                            : "วิเคราะห์ด้วย AI"}
                    {/if}
                </button>
            </div>
        </header>

        {#if error}
            <div class="error-banner">⚠️ {error}</div>
        {/if}

        <!-- Stats Cards -->
        <section class="stats-grid">
            <div class="stat-card">
                <span class="stat-icon">💰</span>
                <div class="stat-content">
                    <span class="stat-value">
                        {formatVolume(
                            profile.analytics?.total_volume ||
                                profile.transactions.reduce(
                                    (s, t) => s + t.amount,
                                    0,
                                ),
                        )}
                    </span>
                    <span class="stat-label">Total Volume (USDT)</span>
                </div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">🔄</span>
                <div class="stat-content">
                    <span class="stat-value">{profile.transactions.length}</span
                    >
                    <span class="stat-label">ธุรกรรม</span>
                </div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">💬</span>
                <div class="stat-content">
                    <span class="stat-value">{profile.chatMessages.length}</span
                    >
                    <span class="stat-label">ข้อความ</span>
                </div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">📊</span>
                <div class="stat-content">
                    <span class="stat-value">
                        {profile.analytics?.engagement_score
                            ? Math.round(
                                  profile.analytics.engagement_score * 100,
                              ) + "%"
                            : "-"}
                    </span>
                    <span class="stat-label">Engagement</span>
                </div>
            </div>
        </section>

        <!-- Quote Analytics Section -->
        {#if profile.quoteMetrics}
            <section class="quote-analytics-section">
                <header class="section-header">
                    <h2>📊 Quote Analytics</h2>
                    <span class="section-subtitle"
                        >การวิเคราะห์ Quote → Confirmation</span
                    >
                </header>

                <div class="quote-stats-grid">
                    <div
                        class="quote-stat"
                        class:highlight={profile.quoteMetrics.quoteCount > 0}
                    >
                        <span class="quote-stat-icon">📝</span>
                        <div class="quote-stat-content">
                            <span class="quote-stat-value"
                                >{profile.quoteMetrics.quoteCount}</span
                            >
                            <span class="quote-stat-label">ขอ Quote</span>
                        </div>
                    </div>

                    <div
                        class="quote-stat success"
                        class:highlight={profile.quoteMetrics
                            .confirmationCount > 0}
                    >
                        <span class="quote-stat-icon">✅</span>
                        <div class="quote-stat-content">
                            <span class="quote-stat-value"
                                >{profile.quoteMetrics.confirmationCount}</span
                            >
                            <span class="quote-stat-label">CF (Confirm)</span>
                        </div>
                    </div>

                    <div
                        class="quote-stat"
                        class:warning={profile.quoteMetrics
                            .quoteToConfirmRatio < 0.5 &&
                            profile.quoteMetrics.quoteCount > 0}
                    >
                        <span class="quote-stat-icon">📈</span>
                        <div class="quote-stat-content">
                            <span class="quote-stat-value">
                                {profile.quoteMetrics.quoteCount > 0
                                    ? Math.round(
                                          profile.quoteMetrics
                                              .quoteToConfirmRatio * 100,
                                      ) + "%"
                                    : "-"}
                            </span>
                            <span class="quote-stat-label">อัตราปิดดีล</span>
                        </div>
                    </div>

                    <div class="quote-stat">
                        <span class="quote-stat-icon">⏱️</span>
                        <div class="quote-stat-content">
                            <span class="quote-stat-value">
                                {profile.quoteMetrics
                                    .avgTimeToDecisionMinutes != null
                                    ? Math.round(
                                          profile.quoteMetrics
                                              .avgTimeToDecisionMinutes,
                                      ) + " min"
                                    : "-"}
                            </span>
                            <span class="quote-stat-label">เวลาตัดสินใจ</span>
                        </div>
                    </div>
                </div>

                <!-- Recent Confirmations (Synced with Transaction History) -->
                {#if profile.transactions.length > 0}
                    <div class="recent-confirmations">
                        <h3>🔔 Recent Confirmations</h3>
                        <div class="confirmation-list">
                            {#each profile.transactions.slice(0, 5) as tx}
                                <div class="confirmation-item">
                                    <span
                                        class="cf-action"
                                        class:sell={tx.action === "SELL"}
                                        class:buy={tx.action === "BUY"}
                                    >
                                        {tx.action === "SELL"
                                            ? "▼ SELL"
                                            : "▲ BUY"}
                                    </span>
                                    <span class="cf-amount"
                                        >{tx.amount.toLocaleString()}
                                        {tx.currency || "USDT"}</span
                                    >
                                    <span class="cf-rate">@{tx.rate}</span>
                                    <span class="cf-time"
                                        >{formatDateTime(tx.date)}</span
                                    >
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Insight Alert -->
                {#if profile.quoteMetrics.quoteCount > 3 && profile.quoteMetrics.quoteToConfirmRatio < 0.3}
                    <div class="insight-alert warning">
                        <strong>⚠️ ลูกค้าถามบ่อยแต่ปิดดีลน้อย</strong>
                        <p>
                            ขอ quote {profile.quoteMetrics.quoteCount} ครั้ง แต่
                            CF เพียง {profile.quoteMetrics.confirmationCount} ครั้ง
                        </p>
                    </div>
                {:else if profile.quoteMetrics.quoteToConfirmRatio >= 0.7 && profile.quoteMetrics.quoteCount > 0}
                    <div class="insight-alert success">
                        <strong>🌟 ลูกค้าตัดสินใจเร็ว</strong>
                        <p>
                            อัตราปิดดีล {Math.round(
                                profile.quoteMetrics.quoteToConfirmRatio * 100,
                            )}% - ลูกค้าคุณภาพ
                        </p>
                    </div>
                {/if}
            </section>
        {/if}

        <!-- Main Content -->
        <div class="content-grid">
            <!-- AI Analysis Section -->
            <section class="card ai-section">
                <header class="card-header">
                    <h2>🤖 AI Analysis</h2>
                    {#if profile.analytics}
                        <span class="provider-tag">
                            {profile.analytics.provider} • {profile.analytics
                                .model}
                        </span>
                    {/if}
                </header>

                {#if profile.analytics}
                    <!-- Summary -->
                    <div class="ai-summary">
                        <p>{profile.analytics.ai_summary}</p>
                    </div>

                    <!-- Recommendations -->
                    {#if profile.analytics.recommendations.length > 0}
                        <div class="insight-section">
                            <h3>💡 คำแนะนำ</h3>
                            <ul class="insight-list">
                                {#each profile.analytics.recommendations as rec}
                                    <li>{rec}</li>
                                {/each}
                            </ul>
                        </div>
                    {/if}

                    <!-- Risk Flags -->
                    {#if profile.analytics.risk_flags.length > 0}
                        <div class="insight-section warning">
                            <h3>⚠️ ข้อควรระวัง</h3>
                            <ul class="insight-list">
                                {#each profile.analytics.risk_flags as flag}
                                    <li>{flag}</li>
                                {/each}
                            </ul>
                        </div>
                    {/if}

                    <!-- Key Topics -->
                    {#if profile.analytics.key_topics.length > 0}
                        <div class="topics-section">
                            <h3>🏷️ หัวข้อสนใจ</h3>
                            <div class="topics-list">
                                {#each profile.analytics.key_topics as topic}
                                    <span class="topic-tag">{topic}</span>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Metadata -->
                    <div class="analysis-meta">
                        วิเคราะห์เมื่อ: {formatDateTime(
                            profile.analytics.analyzed_at,
                        )}
                    </div>
                {:else}
                    <div class="empty-analysis">
                        <span class="empty-icon">🔮</span>
                        <p>ยังไม่ได้วิเคราะห์ลูกค้านี้</p>
                        <p class="hint">
                            กดปุ่ม "วิเคราะห์ด้วย AI" เพื่อเริ่มต้น
                        </p>
                    </div>
                {/if}
            </section>

            <!-- Transaction History -->
            <section class="card">
                <header class="card-header">
                    <h2>📋 ประวัติธุรกรรม</h2>
                    <span class="count"
                        >{profile.transactions.length} รายการ</span
                    >
                </header>

                {#if profile.transactions.length > 0}
                    <div class="transaction-list">
                        {#each profile.transactions as tx, index (index)}
                            <div class="transaction-item">
                                <div class="tx-main">
                                    <span
                                        class="tx-action"
                                        class:buy={tx.action === "BUY"}
                                        class:sell={tx.action === "SELL"}
                                    >
                                        {tx.action === "BUY"
                                            ? "▲ BUY"
                                            : "▼ SELL"}
                                    </span>
                                    <span class="tx-amount">
                                        {tx.amount.toLocaleString()}
                                        {tx.currency}
                                    </span>
                                    <span class="tx-rate">@{tx.rate}</span>
                                </div>
                                <div class="tx-meta">
                                    <span class="tx-date"
                                        >{formatDateTime(tx.date)}</span
                                    >
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="empty-message">ไม่มีประวัติธุรกรรม</p>
                {/if}
            </section>

            <!-- Chat History -->
            <section class="card chat-section">
                <header class="card-header">
                    <h2>💬 ประวัติการสนทนา</h2>
                    <span class="count"
                        >{profile.chatMessages.length} ข้อความ</span
                    >
                </header>

                {#if profile.chatMessages.length > 0}
                    <div class="chat-list">
                        {#each profile.chatMessages.slice(0, visibleChatCount) as msg (msg.id)}
                            <div
                                class="chat-message"
                                class:bot={msg.from_is_bot}
                            >
                                <div class="msg-header">
                                    <span class="msg-sender">
                                        {msg.from_is_bot
                                            ? "🤖 Bot"
                                            : `👤 ${msg.from_first_name || "User"}`}
                                    </span>
                                    <span class="msg-time"
                                        >{formatDateTime(msg.created_at)}</span
                                    >
                                </div>
                                <p class="msg-text">
                                    {msg.message_text || "[media]"}
                                </p>
                            </div>
                        {/each}

                        {#if profile.chatMessages.length > visibleChatCount}
                            <button
                                class="btn-more"
                                on:click={() => (visibleChatCount += 50)}
                                type="button"
                            >
                                แสดงเพิ่มอีก 50 ข้อความ (เหลืออีก {profile
                                    .chatMessages.length - visibleChatCount})
                            </button>
                        {/if}
                    </div>
                {:else}
                    <p class="empty-message">ไม่พบข้อความที่ตรงกับลูกค้านี้</p>
                    <p class="hint">
                        การ match ใช้ชื่อลูกค้าเทียบกับ from_first_name หรือ
                        from_username
                    </p>
                {/if}
            </section>
        </div>
    {/if}
</main>

<style>
    .customer-detail {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0;
        font-family: var(
            --font-family-sans,
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif
        );
    }

    .back-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: transparent;
        border: 1px solid var(--color-border, #e5e5ea);
        border-radius: 8px;
        color: var(--color-text-secondary, #48484a);
        font-size: 0.9rem;
        cursor: pointer;
        margin-bottom: 20px;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .back-btn:hover {
        background: var(--color-bg-tertiary, #f2f2f7);
        border-color: var(--color-border, #e5e5ea);
    }

    /* Profile Header */
    .profile-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 20px;
        margin-bottom: 24px;
        padding: 24px;
        background: var(--color-bg, #ffffff);
        border-radius: 16px;
        border: 1px solid var(--color-border-light, #f2f2f7);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
    }

    .profile-info {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .behavior-badge.large {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        background: color-mix(in srgb, var(--badge-color, #007aff) 15%, white);
    }

    .profile-text h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
        font-family: var(
            --font-family-heading,
            "Outfit",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif
        );
    }

    .behavior-label {
        font-size: 0.9rem;
        margin-top: 4px;
    }

    .profile-actions {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
    }

    .provider-selector {
        display: flex;
        gap: 4px;
        background: var(--color-bg-tertiary, #f2f2f7);
        padding: 4px;
        border-radius: 8px;
    }

    .provider-btn {
        padding: 6px 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        font-size: 1rem;
        cursor: pointer;
        opacity: 0.5;
        transition: all 0.2s ease;
    }

    .provider-btn:not(:disabled):hover {
        opacity: 0.8;
    }

    .provider-btn.active {
        background: var(--color-bg, #ffffff);
        opacity: 1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .provider-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .btn-analyze {
        padding: 10px 20px;
        background: var(--color-primary, #007aff);
        border: none;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .btn-analyze:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-analyze:not(:disabled):hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
    }

    .btn-followup {
        padding: 10px 20px;
        background: rgba(52, 199, 89, 0.1);
        border: 1px solid rgba(52, 199, 89, 0.3);
        border-radius: 10px;
        color: var(--color-success, #34c759);
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
    }

    .error-banner {
        padding: 12px 16px;
        background: rgba(255, 59, 48, 0.08);
        border: 1px solid rgba(255, 59, 48, 0.2);
        border-radius: 8px;
        color: var(--color-danger, #ff3b30);
        margin-bottom: 20px;
    }

    /* Stats Grid */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .stat-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--color-bg, #ffffff);
        border-radius: 12px;
        border: 1px solid var(--color-border-light, #f2f2f7);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
    }

    .stat-icon {
        font-size: 1.5rem;
    }

    .stat-content {
        display: flex;
        flex-direction: column;
    }

    .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
    }

    .stat-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    /* Content Grid */
    .content-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 20px;
    }

    .card {
        background: var(--color-bg, #ffffff);
        border-radius: 16px;
        padding: 20px;
        border: 1px solid var(--color-border-light, #f2f2f7);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .card-header h2 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--color-text, #1d1d1f);
        font-family: var(--font-family-heading);
    }

    .count {
        font-size: 0.85rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .provider-tag {
        font-size: 0.75rem;
        padding: 4px 8px;
        background: rgba(0, 122, 255, 0.1);
        border-radius: 4px;
        color: var(--color-primary, #007aff);
    }

    /* AI Section */
    .ai-section {
        grid-column: 1 / -1;
    }

    .ai-summary {
        padding: 16px;
        background: var(--color-bg-tertiary, #f2f2f7);
        border-radius: 12px;
        margin-bottom: 16px;
    }

    .ai-summary p {
        margin: 0;
        font-size: 1rem;
        line-height: 1.6;
        color: var(--color-text, #1d1d1f);
    }

    .insight-section {
        margin-bottom: 16px;
    }

    .insight-section h3 {
        margin: 0 0 8px;
        font-size: 0.9rem;
        color: var(--color-text-secondary, #48484a);
    }

    .insight-section.warning {
        padding: 12px;
        background: rgba(255, 149, 0, 0.08);
        border-radius: 8px;
    }

    .insight-list {
        margin: 0;
        padding-left: 20px;
    }

    .insight-list li {
        margin-bottom: 4px;
        color: var(--color-text, #1d1d1f);
    }

    .topics-section h3 {
        margin: 0 0 8px;
        font-size: 0.9rem;
        color: var(--color-text-secondary, #48484a);
    }

    .topics-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .topic-tag {
        padding: 4px 10px;
        background: rgba(0, 122, 255, 0.1);
        border-radius: 16px;
        font-size: 0.8rem;
        color: var(--color-primary, #007aff);
    }

    .analysis-meta {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--color-border-light, #f2f2f7);
        font-size: 0.8rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .empty-analysis {
        text-align: center;
        padding: 40px 20px;
    }

    .empty-icon {
        font-size: 3rem;
        opacity: 0.5;
    }

    .empty-analysis p {
        margin: 12px 0 0;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .hint {
        font-size: 0.85rem;
        color: var(--color-text-tertiary, #8e8e93);
        opacity: 0.7;
    }

    /* Transactions */
    .transaction-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 400px;
        overflow-y: auto;
    }

    .transaction-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: var(--color-bg-tertiary, #f2f2f7);
        border-radius: 8px;
    }

    .tx-main {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .tx-action {
        font-size: 0.8rem;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .tx-action.buy {
        background: rgba(52, 199, 89, 0.15);
        color: var(--color-success, #34c759);
    }

    .tx-action.sell {
        background: rgba(255, 59, 48, 0.15);
        color: var(--color-danger, #ff3b30);
    }

    .tx-amount {
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
    }

    .tx-rate {
        font-size: 0.85rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .tx-date {
        font-size: 0.8rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    /* Chat */
    .chat-section {
        grid-row: span 2;
    }

    .chat-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 500px;
        overflow-y: auto;
    }

    .chat-message {
        padding: 12px;
        background: var(--color-bg-tertiary, #f2f2f7);
        border-radius: 12px;
        border-left: 3px solid var(--color-primary, #007aff);
    }

    .chat-message.bot {
        border-left-color: var(--color-success, #34c759);
        background: rgba(52, 199, 89, 0.05);
    }

    .msg-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
    }

    .msg-sender {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--color-text-secondary, #48484a);
    }

    .msg-time {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .msg-text {
        margin: 0;
        font-size: 0.9rem;
        color: var(--color-text, #1d1d1f);
        word-break: break-word;
    }

    .btn-more {
        display: block;
        width: 100%;
        padding: 12px;
        background: transparent;
        border: 1px dashed var(--color-border, #e5e5ea);
        border-radius: 8px;
        color: var(--color-primary, #007aff);
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 12px;
        font-family: inherit;
    }

    .btn-more:hover {
        background: var(--color-bg-tertiary, #f2f2f7);
        border-color: var(--color-primary, #007aff);
    }

    .empty-message {
        text-align: center;
        padding: 20px;
        color: var(--color-text-tertiary, #8e8e93);
    }

    /* Loading & Error */
    .loading-state,
    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        text-align: center;
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid var(--color-border-light, #f2f2f7);
        border-top-color: var(--color-primary, #007aff);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .error-state span {
        font-size: 3rem;
    }

    .error-state button {
        margin-top: 16px;
        padding: 8px 16px;
        background: var(--color-bg, #ffffff);
        border: 1px solid var(--color-border, #e5e5ea);
        border-radius: 8px;
        color: var(--color-text, #1d1d1f);
        cursor: pointer;
        font-family: inherit;
    }

    /* Quote Analytics Section */
    .quote-analytics-section {
        background: var(--color-bg, #ffffff);
        border-radius: 16px;
        padding: 20px;
        border: 1px solid var(--color-border-light, #f2f2f7);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        margin-bottom: 24px;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .section-header h2 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--color-text, #1d1d1f);
        font-family: var(--font-family-heading);
    }

    .section-subtitle {
        font-size: 0.85rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .quote-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 16px;
    }

    .quote-stat {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px;
        background: var(--color-bg-tertiary, #f2f2f7);
        border-radius: 12px;
        border: 1px solid transparent;
        transition: all 0.2s ease;
    }

    .quote-stat.highlight {
        border-color: var(--color-primary, #007aff);
        background: rgba(0, 122, 255, 0.05);
    }

    .quote-stat.success {
        border-color: var(--color-success, #34c759);
        background: rgba(52, 199, 89, 0.05);
    }

    .quote-stat.warning {
        border-color: var(--color-warning, #ff9500);
        background: rgba(255, 149, 0, 0.05);
    }

    .quote-stat-icon {
        font-size: 1.5rem;
    }

    .quote-stat-content {
        display: flex;
        flex-direction: column;
    }

    .quote-stat-value {
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--color-text, #1d1d1f);
    }

    .quote-stat-label {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .recent-confirmations {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border-light, #f2f2f7);
    }

    .recent-confirmations h3 {
        margin: 0 0 12px;
        font-size: 0.95rem;
        color: var(--color-text-secondary, #48484a);
    }

    .confirmation-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .confirmation-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: var(--color-bg-tertiary, #f2f2f7);
        border-radius: 8px;
    }

    .cf-action {
        font-size: 0.8rem;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .cf-action.buy {
        background: rgba(52, 199, 89, 0.15);
        color: var(--color-success, #34c759);
    }

    .cf-action.sell {
        background: rgba(255, 59, 48, 0.15);
        color: var(--color-danger, #ff3b30);
    }

    .cf-amount {
        font-weight: 600;
        color: var(--color-text, #1d1d1f);
    }

    .cf-rate {
        font-size: 0.85rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .cf-time {
        margin-left: auto;
        font-size: 0.8rem;
        color: var(--color-text-tertiary, #8e8e93);
    }

    .insight-alert {
        margin-top: 16px;
        padding: 14px 16px;
        border-radius: 10px;
    }

    .insight-alert.warning {
        background: rgba(255, 149, 0, 0.1);
        border: 1px solid rgba(255, 149, 0, 0.3);
    }

    .insight-alert.warning strong {
        color: #ff9500;
    }

    .insight-alert.success {
        background: rgba(52, 199, 89, 0.1);
        border: 1px solid rgba(52, 199, 89, 0.3);
    }

    .insight-alert.success strong {
        color: var(--color-success, #34c759);
    }

    .insight-alert p {
        margin: 4px 0 0;
        font-size: 0.9rem;
        color: var(--color-text-secondary, #48484a);
    }

    @media (max-width: 768px) {
        .quote-stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>
