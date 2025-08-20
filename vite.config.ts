import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		watch: {
			// Only watch for changes in src directory and config files
			ignored: [
				'**/node_modules/**',
				'**/dist/**',
				'**/build/**',
				'**/coverage/**',
				'**/.git/**',
				'**/examples/**',
				'**/*.log',
				'**/.env*',
				'**/README.md',
				'**/CHANGELOG.md',
				'**/LICENSE'
			]
		},
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				secure: false
			}
		}
	}
});
