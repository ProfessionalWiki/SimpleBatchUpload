import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		environment: 'jsdom',
		include: [ 'tests/vitest/**/*.test.js' ],
		globals: true,
		passWithNoTests: true,
		restoreMocks: true,
		setupFiles: [ 'tests/vitest/setup.js' ],
		testTimeout: 10000,
		hookTimeout: 15000
	}
} );
