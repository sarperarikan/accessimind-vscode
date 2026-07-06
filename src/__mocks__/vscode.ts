type ConfigStore = Record<string, unknown>;

const configuration: ConfigStore = {
	language: "en",
	wcagLevel: "AA",
	analysisDisabilityFocus: [],
	autoApply: false,
	includeComments: true,
	enableStatistics: true,
	ai: {},
	aiModels: {},
};

const createThenable = <T>(value: T): Thenable<T> =>
	Promise.resolve(value) as Thenable<T>;

export class Disposable {
	constructor(private readonly fn: () => void = () => {}) {}

	dispose(): void {
		this.fn();
	}
}

export class EventEmitter<T> {
	public event = jest.fn();
	public fire = jest.fn();
	public dispose = jest.fn();
}

export const window = {
	showErrorMessage: jest.fn(() => Promise.resolve(undefined)),
	showInformationMessage: jest.fn(() => Promise.resolve(undefined)),
	showWarningMessage: jest.fn(() => Promise.resolve(undefined)),
	createOutputChannel: jest.fn(() => ({
		appendLine: jest.fn(),
		clear: jest.fn(),
		show: jest.fn(),
		dispose: jest.fn(),
	})),
	showQuickPick: jest.fn(() => Promise.resolve(undefined)),
	showInputBox: jest.fn(() => Promise.resolve(undefined)),
	showSaveDialog: jest.fn(() => Promise.resolve(undefined)),
	showOpenDialog: jest.fn(() => Promise.resolve(undefined)),
	activeTextEditor: undefined,
	withProgress: jest.fn((_options: unknown, task: (progress: { report: jest.Mock }) => Promise<unknown>) =>
		task({ report: jest.fn() })
	),
	onDidChangeActiveTextEditor: jest.fn(() => new Disposable()),
	registerTreeDataProvider: jest.fn(() => new Disposable()),
	registerWebviewViewProvider: jest.fn(() => new Disposable()),
};

export const workspace = {
	getConfiguration: jest.fn(() => ({
		get: jest.fn((key: string, defaultValue?: unknown) =>
			key in configuration ? configuration[key] : defaultValue
		),
		update: jest.fn((key: string, value: unknown) => {
			configuration[key] = value;
			return Promise.resolve();
		}),
	})),
	onDidChangeConfiguration: jest.fn(() => new Disposable()),
	createFileSystemWatcher: jest.fn(() => ({
		onDidChange: jest.fn(),
		onDidDelete: jest.fn(),
		dispose: jest.fn(),
	})),
	workspaceFolders: [{ uri: { fsPath: "C:\\workspace", toString: () => "file:///C:/workspace" } }],
	fs: {
		writeFile: jest.fn(() => Promise.resolve()),
		readFile: jest.fn(() => Promise.resolve(Buffer.from("{}"))),
	},
};

export const commands = {
	registerCommand: jest.fn(() => new Disposable()),
	executeCommand: jest.fn(() => Promise.resolve(undefined)),
};

export const env = {
	openExternal: jest.fn(() => Promise.resolve(true)),
	clipboard: {
		writeText: jest.fn(() => Promise.resolve()),
	},
};

export const extensions = {
	getExtension: jest.fn(() => undefined),
};

export const lm = {
	onDidChangeChatModels: jest.fn(() => new Disposable()),
	selectChatModels: jest.fn(() => Promise.resolve([])),
};

export class CancellationTokenSource {
	public token = {};
	dispose(): void {}
}

export class ThemeIcon {
	constructor(public readonly id: string) {}
}

export class TreeItem {
	public tooltip?: string;
	public description?: string;
	public iconPath?: unknown;
	public contextValue?: string;
	public command?: unknown;
	public collapsibleState?: number;

	constructor(public readonly label: string, collapsibleState?: number) {
		this.collapsibleState = collapsibleState;
	}
}

export const TreeItemCollapsibleState = {
	None: 0,
	Collapsed: 1,
	Expanded: 2,
};

export const ConfigurationTarget = {
	Global: 1,
	Workspace: 2,
};

export const ProgressLocation = {
	Notification: 15,
};

export class Position {
	constructor(public line: number, public character: number) {}
}

export class Range {
	constructor(public start: Position, public end: Position) {}
}

export class RelativePattern {
	constructor(public base: string, public pattern: string) {}
}

export const Uri = {
	file: (path: string) => ({ fsPath: path, path }),
	parse: (uri: string) => ({ fsPath: uri, path: uri }),
	joinPath: (...parts: Array<{ path?: string } | string>) => ({
		path: parts.map((part) => (typeof part === "string" ? part : part.path || "")).join("/"),
	}),
};

export const version = "1.93.0";

export const WebviewViewProvider = {};
export const Webview = {};
export const WebviewView = {};

export const __resetConfiguration = (): void => {
	configuration.language = "en";
	configuration.wcagLevel = "AA";
	configuration.analysisDisabilityFocus = [];
	configuration.autoApply = false;
	configuration.includeComments = true;
	configuration.enableStatistics = true;
	configuration.ai = {};
	configuration.aiModels = {};
};

export const __setConfigurationValue = (key: string, value: unknown): void => {
	configuration[key] = value;
};

export default {
	window,
	workspace,
	commands,
	env,
	extensions,
	lm,
	CancellationTokenSource,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	ConfigurationTarget,
	ProgressLocation,
	Position,
	Range,
	RelativePattern,
	Uri,
	version,
	EventEmitter,
	Disposable,
};
