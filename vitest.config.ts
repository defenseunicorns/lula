import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'hack/**/*.test.ts', 'cli/**/*.test.ts'],
		exclude: ['node_modules', 'dist', 'coverage'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/**/*.ts', 'cli/**/*.ts'],
			exclude: ['node_modules', 'dist', 'coverage']
		},

		hookTimeout: 10000
	}
});
