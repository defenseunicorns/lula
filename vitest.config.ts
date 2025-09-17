import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts', 'hack/**/*.test.ts', 'cli/**/*.test.ts'],
		exclude: ['node_modules', 'dist', 'coverage'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/**/*.ts', 'cli/**/*.ts'],
			exclude: [
				'node_modules',
				'dist',
				'coverage',
				'integration/test-files/**',
				'src/lib/components/ui/index.ts',
				'src/lib/components/version-control/index.ts',
				'src/lib/components/setup/index.ts',
				'src/lib/components/setup/index.ts',
				'src/lib/components/controls/tabs/index.ts',
				'src/lib/components/controls/renderers/index.ts',
				'src/lib/components/controls/index.ts',
				'src/lib/components/control-sets/index.ts',
				'src/lib/types.ts',
				'src/lib/index.ts',
				'cli/server/types.ts',
				'src/app.d.ts',
				'src/lib/form-types.ts'
			]
		},

		hookTimeout: 10000
	}
});
