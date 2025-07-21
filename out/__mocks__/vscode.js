"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewView = exports.Webview = exports.WebviewViewProvider = exports.ProgressLocation = exports.Uri = exports.Range = exports.Position = exports.ExtensionContext = exports.commands = exports.workspace = exports.window = void 0;
const mockFn = () => Promise.resolve();
exports.window = {
    showErrorMessage: mockFn,
    showInformationMessage: mockFn,
    showWarningMessage: mockFn,
    activeTextEditor: undefined,
    withProgress: (options, task) => task({ report: mockFn })
};
exports.workspace = {
    getConfiguration: () => ({
        get: () => ""
    })
};
exports.commands = {
    registerCommand: mockFn
};
exports.ExtensionContext = {
    subscriptions: []
};
const Position = class Position {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
};
exports.Position = Position;
const Range = class Range {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
};
exports.Range = Range;
exports.Uri = {
    file: (path) => ({ fsPath: path }),
    parse: (uri) => ({ fsPath: uri })
};
exports.ProgressLocation = {
    Notification: 15
};
exports.WebviewViewProvider = {};
exports.Webview = {};
exports.WebviewView = {};
//# sourceMappingURL=vscode.js.map