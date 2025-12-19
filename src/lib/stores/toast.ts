/**
 * Toast Notification Store
 * Simple reactive store for displaying toast messages
 */

import { writable } from 'svelte/store';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    duration?: number;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);
    let nextId = 0;

    function show(message: string, type: Toast['type'] = 'info', duration = 3000) {
        const id = nextId++;

        update(toasts => [...toasts, { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                dismiss(id);
            }, duration);
        }

        return id;
    }

    function dismiss(id: number) {
        update(toasts => toasts.filter(t => t.id !== id));
    }

    function success(message: string, duration = 3000) {
        return show(message, 'success', duration);
    }

    function error(message: string, duration = 5000) {
        return show(message, 'error', duration);
    }

    function info(message: string, duration = 3000) {
        return show(message, 'info', duration);
    }

    return {
        subscribe,
        show,
        dismiss,
        success,
        error,
        info
    };
}

export const toast = createToastStore();
