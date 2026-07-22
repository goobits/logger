import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		...(process.env.CI ? {} : { maxWorkers: 2 }),
		include: [ 'tests/**/*.test.ts' ],
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: [ 'text', 'html' ],
			include: [ 'src/**/*.ts' ],
			thresholds: {
				lines: 80,
				functions: 80,
				statements: 80,
				branches: 75
			}
		}
	}
})
