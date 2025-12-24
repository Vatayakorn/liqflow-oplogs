import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
	plugins: [
		basicSsl(),
		sveltekit(),
		VitePWA({
			registerType: 'prompt', // or 'autoUpdate' - sticking to plan which suggests ReloadPrompt
			manifest: {
				name: 'LiqflowOPLogs',
				short_name: 'LF-OPLogs',
				description: 'Operations Log for Liqflow',
				theme_color: '#000000',
				background_color: '#000000',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			devOptions: {
				enabled: false,
				suppressWarnings: true,
				type: 'module',
				navigateFallback: '/'
			}
		})
	]
});
