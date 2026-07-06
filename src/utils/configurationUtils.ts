import * as vscode from "vscode";

export interface AccessiMindAiConfig {
	provider?: string;
	apiKey?: string;
	selectedModel?: string;
	autoTestOnChange?: boolean;
	[key: string]: unknown;
}

export interface AccessiMindAiModelsConfig {
	selectedModel?: string;
	availableModels?: string[];
	modelPreferences?: Record<string, unknown>;
	[key: string]: unknown;
}

export function getAiConfig(
	config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer")
): AccessiMindAiConfig {
	const aiConfig = config.get("ai");
	return aiConfig && typeof aiConfig === "object" ? { ...(aiConfig as AccessiMindAiConfig) } : {};
}

export function getAiModelsConfig(
	config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer")
): AccessiMindAiModelsConfig {
	const aiModelsConfig = config.get("aiModels");
	return aiModelsConfig && typeof aiModelsConfig === "object"
		? { ...(aiModelsConfig as AccessiMindAiModelsConfig) }
		: {};
}

export function getNormalizedProvider(
	config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer")
): string {
	return getAiConfig(config).provider || "gemini";
}

export function getNormalizedSelectedModel(
	config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer"),
	fallback = "gemini-2.5-flash"
): string {
	const aiConfig = getAiConfig(config);
	const aiModelsConfig = getAiModelsConfig(config);
	return aiModelsConfig.selectedModel || aiConfig.selectedModel || fallback;
}

export async function updateNormalizedSelectedModel(
	config: vscode.WorkspaceConfiguration,
	modelId: string,
	target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
): Promise<void> {
	const aiConfig = getAiConfig(config);
	const aiModelsConfig = getAiModelsConfig(config);

	aiConfig.selectedModel = modelId;
	aiModelsConfig.selectedModel = modelId;

	await Promise.all([
		config.update("ai", aiConfig, target),
		config.update("aiModels", aiModelsConfig, target),
	]);
}

export function normalizeAiSettingsSnapshot(
	config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer")
): { ai: AccessiMindAiConfig; aiModels: AccessiMindAiModelsConfig; selectedModel: string } {
	const ai = getAiConfig(config);
	const aiModels = getAiModelsConfig(config);
	const selectedModel = getNormalizedSelectedModel(config);

	if (selectedModel) {
		ai.selectedModel = selectedModel;
		aiModels.selectedModel = selectedModel;
	}

	return { ai, aiModels, selectedModel };
}
