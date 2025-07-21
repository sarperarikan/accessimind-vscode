const mockFn = () => Promise.resolve();

export const window = {
	showErrorMessage: mockFn,
	showInformationMessage: mockFn,
	showWarningMessage: mockFn,
	activeTextEditor: undefined,
	withProgress: (options: any, task: any) => task({ report: mockFn })
};

export const workspace = {
	getConfiguration: () => ({
		get: () => ""
	})
};

export const commands = {
	registerCommand: mockFn
};

export const ExtensionContext = {
	subscriptions: []
};

export const Position = class Position {
	constructor(public line: number, public character: number) {}
};

export const Range = class Range {
	constructor(public start: any, public end: any) {}
};

export const Uri = {
	file: (path: string) => ({ fsPath: path }),
	parse: (uri: string) => ({ fsPath: uri })
};

export const ProgressLocation = {
	Notification: 15
};

export const WebviewViewProvider = {};
export const Webview = {};
export const WebviewView = {}; 