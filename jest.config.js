module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.test.ts"],
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/**/*.d.ts",
		"!src/test/**/*"
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	moduleNameMapping: {
		"^vscode$": "<rootDir>/src/__mocks__/vscode.ts"
	},
	setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"]
};