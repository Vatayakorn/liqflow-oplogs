// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };

declare module 'virtual:pwa-register/svelte' {
	// @ts-expect-error ignore-error
	import type { Writable } from 'svelte/store';
	// @ts-expect-error ignore-error
	import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

	export function useRegisterSW(options?: RegisterSWOptions): {
		needRefresh: Writable<boolean>;
		offlineReady: Writable<boolean>;
		updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
	};
}
