import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { optimizeImports } from 'carbon-preprocess-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess(), optimizeImports()],
	kit: {
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		alias: {
			$components: './src/lib/components',
			$features: './src/lib/features',
			$stores: './src/stores',
		},
	},
};

export default config;
