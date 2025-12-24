<script lang="ts">
    import { onMount } from "svelte";
    import {
        listReferrers,
        createReferrer,
        updateReferrer,
        deleteReferrer,
        type ReferrerConfig,
    } from "$lib/api/spreadTrackingApi";

    let referrers: ReferrerConfig[] = [];
    let loading = true;
    let error: string | null = null;

    // Form state
    let showForm = false;
    let editingId: string | null = null;
    let formName = "";
    let formFee = 0.01;
    let formShare = 0.5;
    let saving = false;

    onMount(async () => {
        await loadReferrers();
    });

    async function loadReferrers() {
        loading = true;
        error = null;
        try {
            referrers = await listReferrers();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load referrers";
        } finally {
            loading = false;
        }
    }

    function openForm(referrer?: ReferrerConfig) {
        if (referrer) {
            editingId = referrer.id;
            formName = referrer.referrer_name;
            formFee = referrer.bitazza_fee;
            formShare = referrer.profit_share;
        } else {
            editingId = null;
            formName = "";
            formFee = 0.01;
            formShare = 0.5;
        }
        showForm = true;
    }

    function closeForm() {
        showForm = false;
        editingId = null;
        formName = "";
        formFee = 0.01;
        formShare = 0.5;
    }

    async function handleSubmit() {
        if (!formName.trim()) return;

        saving = true;
        try {
            if (editingId) {
                await updateReferrer(editingId, {
                    bitazza_fee: formFee,
                    profit_share: formShare,
                });
            } else {
                await createReferrer(formName.trim(), formFee, formShare);
            }
            await loadReferrers();
            closeForm();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to save referrer";
        } finally {
            saving = false;
        }
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`ลบผู้แนะนำ "${name}" ?`)) return;

        try {
            await deleteReferrer(id);
            await loadReferrers();
        } catch (e) {
            error =
                e instanceof Error ? e.message : "Failed to delete referrer";
        }
    }

    async function toggleActive(referrer: ReferrerConfig) {
        try {
            await updateReferrer(referrer.id, {
                is_active: !referrer.is_active,
            });
            await loadReferrers();
        } catch (e) {
            error =
                e instanceof Error ? e.message : "Failed to update referrer";
        }
    }
</script>

<div class="referrer-manager">
    <div class="header">
        <h3>📋 Referrer Configuration</h3>
        <button class="btn-primary" on:click={() => openForm()}>
            + เพิ่มผู้แนะนำ
        </button>
    </div>

    {#if error}
        <div class="error-banner">{error}</div>
    {/if}

    {#if loading}
        <div class="loading">กำลังโหลด...</div>
    {:else if referrers.length === 0}
        <div class="empty-state">
            <p>ยังไม่มีผู้แนะนำ</p>
            <button class="btn-secondary" on:click={() => openForm()}>
                เพิ่มผู้แนะนำคนแรก
            </button>
        </div>
    {:else}
        <table class="referrer-table">
            <thead>
                <tr>
                    <th>ชื่อ</th>
                    <th>Bitazza Fee</th>
                    <th>Profit Share</th>
                    <th>สถานะ</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each referrers as referrer}
                    <tr class:inactive={!referrer.is_active}>
                        <td class="name">{referrer.referrer_name}</td>
                        <td class="fee"
                            >{referrer.bitazza_fee.toFixed(2)} ฿/USDT</td
                        >
                        <td class="share"
                            >{(referrer.profit_share * 100).toFixed(0)}%</td
                        >
                        <td>
                            <button
                                class="status-toggle"
                                class:active={referrer.is_active}
                                on:click={() => toggleActive(referrer)}
                            >
                                {referrer.is_active
                                    ? "✅ Active"
                                    : "⏸️ Inactive"}
                            </button>
                        </td>
                        <td class="actions">
                            <button
                                class="btn-icon"
                                on:click={() => openForm(referrer)}
                                title="แก้ไข"
                            >
                                ✏️
                            </button>
                            <button
                                class="btn-icon danger"
                                on:click={() =>
                                    handleDelete(
                                        referrer.id,
                                        referrer.referrer_name,
                                    )}
                                title="ลบ"
                            >
                                🗑️
                            </button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    {#if showForm}
        <div
            class="modal-overlay"
            on:click={closeForm}
            on:keydown={(e) => e.key === "Escape" && closeForm()}
        >
            <div
                class="modal"
                on:click|stopPropagation
                role="dialog"
                aria-modal="true"
            >
                <h4>{editingId ? "แก้ไขผู้แนะนำ" : "เพิ่มผู้แนะนำใหม่"}</h4>
                <form on:submit|preventDefault={handleSubmit}>
                    <div class="form-group">
                        <label for="referrer-name">ชื่อผู้แนะนำ</label>
                        <input
                            id="referrer-name"
                            type="text"
                            bind:value={formName}
                            placeholder="เช่น Vadim, Alex"
                            disabled={!!editingId}
                            required
                        />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="bitazza-fee"
                                >Bitazza Fee (THB/USDT)</label
                            >
                            <input
                                id="bitazza-fee"
                                type="number"
                                step="0.001"
                                min="0"
                                bind:value={formFee}
                            />
                        </div>
                        <div class="form-group">
                            <label for="profit-share">Profit Share (%)</label>
                            <input
                                id="profit-share"
                                type="number"
                                step="0.05"
                                min="0"
                                max="1"
                                bind:value={formShare}
                            />
                            <span class="hint"
                                >{(formShare * 100).toFixed(0)}%</span
                            >
                        </div>
                    </div>
                    <div class="form-actions">
                        <button
                            type="button"
                            class="btn-secondary"
                            on:click={closeForm}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            class="btn-primary"
                            disabled={saving || !formName.trim()}
                        >
                            {saving
                                ? "กำลังบันทึก..."
                                : editingId
                                  ? "บันทึก"
                                  : "เพิ่ม"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>

<style>
    .referrer-manager {
        background: var(--color-bg);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        border: 1px solid var(--color-border-light);
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .header h3 {
        margin: 0;
        font-size: 1rem;
        font-family: var(--font-family-heading);
        color: var(--color-text);
    }

    .btn-primary {
        background: var(--color-primary);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        font-size: 0.875rem;
    }

    .btn-primary:hover {
        opacity: 0.9;
    }

    .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: var(--color-bg-tertiary);
        color: var(--color-text);
        border: 1px solid var(--color-border);
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
    }

    .error-banner {
        background: rgba(255, 59, 48, 0.1);
        color: var(--color-danger);
        padding: 0.75rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        border: 1px solid rgba(255, 59, 48, 0.2);
    }

    .loading,
    .empty-state {
        text-align: center;
        padding: 2rem;
        color: var(--color-text-tertiary);
    }

    .referrer-table {
        width: 100%;
        border-collapse: collapse;
    }

    .referrer-table th,
    .referrer-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border-light);
    }

    .referrer-table th {
        color: var(--color-text-tertiary);
        font-weight: 500;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    tr.inactive {
        opacity: 0.5;
    }

    .name {
        font-weight: 600;
        color: var(--color-text);
    }

    .fee {
        font-family: "SF Mono", monospace;
        color: var(--color-text-secondary);
    }

    .share {
        color: var(--color-primary);
        font-weight: 500;
    }

    .status-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.85rem;
    }

    .status-toggle:hover {
        background: var(--color-bg-tertiary);
    }

    .actions {
        display: flex;
        gap: 0.5rem;
    }

    .btn-icon {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        font-size: 1rem;
    }

    .btn-icon:hover {
        background: var(--color-bg-tertiary);
    }

    .btn-icon.danger:hover {
        background: rgba(255, 59, 48, 0.1);
    }

    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: var(--color-bg);
        border-radius: 16px;
        padding: 1.5rem;
        min-width: 400px;
        max-width: 90vw;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    }

    .modal h4 {
        margin: 0 0 1rem 0;
        font-family: var(--font-family-heading);
        color: var(--color-text);
    }

    .form-group {
        margin-bottom: 1rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.85rem;
        color: var(--color-text-tertiary);
    }

    .form-group input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 1rem;
    }

    .form-group input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    .form-group input:disabled {
        background: var(--color-bg-tertiary);
        opacity: 0.7;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .hint {
        font-size: 0.8rem;
        color: var(--color-text-tertiary);
        margin-left: 0.5rem;
    }

    .form-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
        margin-top: 1.5rem;
    }

    @media (max-width: 640px) {
        .modal {
            min-width: auto;
            margin: 1rem;
        }

        .form-row {
            grid-template-columns: 1fr;
        }
    }
</style>
