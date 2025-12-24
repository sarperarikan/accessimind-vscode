"use strict";
// Test setup dosyası - VS Code extension test environment
// Mock console for tests
global.console = {
    ...console,
    log: () => { },
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { }
};
//# sourceMappingURL=setup.js.map