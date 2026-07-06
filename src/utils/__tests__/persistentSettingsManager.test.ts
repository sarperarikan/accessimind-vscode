import * as vscode from "vscode";
import { PersistentSettingsManager } from "../persistentSettingsManager";

type Store = Record<string, unknown>;

function createStateBucket(store: Store) {
	return {
		get: (key: string) => store[key],
		update: (key: string, value: unknown) => {
			if (value === undefined) {
				delete store[key];
			} else {
				store[key] = value;
			}

			return Promise.resolve();
		},
	};
}

describe("PersistentSettingsManager", () => {
	beforeEach(() => {
		const mockVscode = vscode as unknown as {
			__resetConfiguration?: () => void;
		};
		mockVscode.__resetConfiguration?.();
		(PersistentSettingsManager as any).instance = undefined;
		jest.clearAllMocks();
	});

	it("restores analysis settings that are used by the modern settings panel", async () => {
		const globalStateStore: Store = {
			"wcagEnhancer.persistedSettings": {
				language: "tr",
				wcagLevel: "AAA",
				strictMode: true,
				customRulesPath: "C:\\rules\\team-rules.md",
				contextAwareAnalysis: false,
				analysisDisabilityFocus: ["screenReader", "motor"],
				autoApply: true,
			},
		};

		const context = {
			globalState: createStateBucket(globalStateStore),
			workspaceState: createStateBucket({}),
			extension: { packageJSON: { version: "1.1.4" } },
			extensionPath: "C:\\extension",
		} as any;

		const manager = PersistentSettingsManager.getInstance(context);
		await manager.initialize();
		await manager.restoreSettings();

		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		expect(config.get("language")).toBe("tr");
		expect(config.get("wcagLevel")).toBe("AAA");
		expect(config.get("strictMode")).toBe(true);
		expect(config.get("customRulesPath")).toBe("C:\\rules\\team-rules.md");
		expect(config.get("contextAwareAnalysis")).toBe(false);
		expect(config.get("analysisDisabilityFocus")).toEqual(["screenReader", "motor"]);
		expect(config.get("autoApply")).toBe(true);
	});
});
