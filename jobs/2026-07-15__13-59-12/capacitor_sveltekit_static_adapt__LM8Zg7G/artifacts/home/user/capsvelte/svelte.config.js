import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Emit the static bundle into a directory named `dist` at the project root.
			pages: 'dist',
			// Serve client-side routes that are not prerendered (e.g. /status) via an
			// SPA fallback page. We use `200.html` instead of `index.html` so it does
			// not collide with the prerendered home page.
			fallback: '200.html',
			// Keep prerendering enabled so the home page (/) is emitted as index.html.
			precompress: false,
			strict: true
		})
	}
};

export default config;