// Test setup dosyası - VS Code extension test environment

// Mock console for tests
global.console = {
	...console,
	log: (): void => {},
	debug: (): void => {},
	info: (): void => {},
	warn: (): void => {},
	error: (): void => {}
}; 