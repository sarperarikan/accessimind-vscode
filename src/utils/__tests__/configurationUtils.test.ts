import * as vscode from "vscode";

import {
	getNormalizedSelectedModel,
	updateNormalizedSelectedModel,
} from "../configurationUtils";

describe("configurationUtils", () => {
	beforeEach(() => {
		const mockVscode = vscode as unknown as {
			__resetConfiguration?: () => void;
			__setConfigurationValue?: (key: string, value: unknown) => void;
		};
		mockVscode.__resetConfiguration?.();
	});

	it("prefers aiModels.selectedModel over ai.selectedModel", () => {
		const mockVscode = vscode as unknown as {
			__setConfigurationValue?: (key: string, value: unknown) => void;
		};
		mockVscode.__setConfigurationValue?.("ai", { selectedModel: "legacy-model" });
		mockVscode.__setConfigurationValue?.("aiModels", { selectedModel: "normalized-model" });

		expect(getNormalizedSelectedModel()).toBe("normalized-model");
	});

	it("falls back to ai.selectedModel when aiModels is empty", () => {
		const mockVscode = vscode as unknown as {
			__setConfigurationValue?: (key: string, value: unknown) => void;
		};
		mockVscode.__setConfigurationValue?.("ai", { selectedModel: "legacy-model" });

		expect(getNormalizedSelectedModel()).toBe("legacy-model");
	});

	it("updates both ai and aiModels when setting a model", async () => {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		await updateNormalizedSelectedModel(config, "gpt-5.2");

		const aiConfig = config.get("ai") as { selectedModel?: string };
		const aiModelsConfig = config.get("aiModels") as { selectedModel?: string };

		expect(aiConfig.selectedModel).toBe("gpt-5.2");
		expect(aiModelsConfig.selectedModel).toBe("gpt-5.2");
	});
});
