import * as vscode from "vscode";

import {
	getAiConfig,
	getAiModelsConfig,
	getNormalizedSelectedModel,
	updateNormalizedSelectedModel,
} from "./utils/configurationUtils";
import { AIProviderManager } from "./utils/aiProvider";
import { AccessiMindJsonManager } from "./utils/accessiMindJsonManager";
import { LocalizationManager } from "./utils/localizationManager";
import { logger } from "./utils/logger";
import { WizardManager } from "./wizardManager";

interface JsonManagerRef {
	get(): AccessiMindJsonManager | undefined;
	set(value: AccessiMindJsonManager): void;
}

export async function loadSavedSettings(
	aiProviderManager: AIProviderManager,
	localization: LocalizationManager
): Promise<void> {
	try {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = getAiConfig(config);
		const aiModelConfig = getAiModelsConfig(config);
		const selectedModel = getNormalizedSelectedModel(config, "");

		if (aiConfig.provider) {
			await aiProviderManager.setProvider(aiConfig.provider);
			logger.info(`Saved AI provider loaded: ${aiConfig.provider}`);
		}

		if (selectedModel) {
			await aiProviderManager.setModel(selectedModel);
			logger.info(`Saved AI model loaded: ${selectedModel}`);
		}

		if (aiConfig.apiKey) {
			logger.info("Saved API key loaded");
		}

		const savedLanguage = config.get("language") as string;
		if (savedLanguage && savedLanguage !== "auto" && (savedLanguage === "en" || savedLanguage === "tr")) {
			localization.setLanguage(savedLanguage as "en" | "tr");
			logger.info(`Saved language loaded: ${savedLanguage}`);
		}

		const wcagLevel = config.get("wcagLevel");
		if (wcagLevel) {
			logger.info(`Saved WCAG level loaded: ${wcagLevel}`);
		}

		const wizardCompleted = config.get("wizardCompleted", false);
		if (wizardCompleted) {
			logger.info("AccessiMind fully configured from saved settings");
			if (selectedModel && (aiConfig.selectedModel !== selectedModel || aiModelConfig.selectedModel !== selectedModel)) {
				await updateNormalizedSelectedModel(config, selectedModel);
				logger.info("Model setting normalized across ai and aiModels config");
			}
		} else {
			logger.info("AccessiMind configuration incomplete - wizard needed");
		}
	} catch (error) {
		logger.error("Error loading saved settings:", error);
	}
}

export async function loadSettingsFromJson(jsonManager: AccessiMindJsonManager | undefined): Promise<void> {
	try {
		if (!jsonManager) {
			logger.warn("JSON Manager is not initialized yet");
			return;
		}

		const settings = await jsonManager.getSettings();
		if (settings.wizard.completed) {
			await jsonManager.applyToVSCodeConfiguration();
			logger.info("JSON settings applied to VS Code");
		} else {
			logger.info("Wizard is not completed yet, JSON settings were not applied");
		}
	} catch (error) {
		logger.error("JSON settings load error:", error);
		vscode.window.showWarningMessage(
			"AccessiMind settings file could not be read. New settings will be created."
		);
	}
}

export function setupSettingsChangeListener(
	context: vscode.ExtensionContext,
	jsonManager: AccessiMindJsonManager | undefined
): void {
	const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
		if (event.affectsConfiguration("wcagEnhancer") && jsonManager) {
			try {
				jsonManager.scheduleSyncFromVSCodeConfiguration(500);
			} catch (error) {
				logger.error("Failed to sync VS Code settings to JSON:", error);
			}
		}
	});

	context.subscriptions.push(configChangeListener);
}

export function registerJsonManagerCommands(
	context: vscode.ExtensionContext,
	jsonManagerRef: JsonManagerRef,
	wizardManager: WizardManager
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand("wcagEnhancer.applyJsonSettings", async () => {
			try {
				const jsonManager = jsonManagerRef.get();
				if (!jsonManager) {
					vscode.window.showErrorMessage("JSON Manager not found");
					return;
				}

				await jsonManager.applyToVSCodeConfiguration();
				vscode.window.showInformationMessage("JSON settings have been applied to VS Code.");
			} catch (error) {
				logger.error("JSON apply error:", error);
				vscode.window.showErrorMessage(`JSON settings could not be applied: ${error}`);
			}
		}),

		vscode.commands.registerCommand("wcagEnhancer.syncToJson", async () => {
			try {
				const jsonManager = jsonManagerRef.get();
				if (!jsonManager) {
					vscode.window.showErrorMessage("JSON Manager not found");
					return;
				}

				await jsonManager.syncFromVSCodeConfiguration();
				vscode.window.showInformationMessage("VS Code settings have been synchronized to the JSON file.");
			} catch (error) {
				logger.error("JSON sync error:", error);
				vscode.window.showErrorMessage(`Synchronization failed: ${error}`);
			}
		}),

		vscode.commands.registerCommand("wcagEnhancer.showJsonPath", async () => {
			const jsonManager = jsonManagerRef.get();
			if (!jsonManager) {
				vscode.window.showErrorMessage("JSON Manager not found");
				return;
			}

			const jsonPath = jsonManager.getJsonFilePath();
			const action = await vscode.window.showInformationMessage(
				`AccessiMind JSON file path:\n${jsonPath}`,
				"Open File",
				"Open Folder",
				"Copy Path"
			);

			switch (action) {
				case "Open File":
					await vscode.window.showTextDocument(vscode.Uri.file(jsonPath));
					break;
				case "Open Folder":
					await vscode.env.openExternal(vscode.Uri.file(require("path").dirname(jsonPath)));
					break;
				case "Copy Path":
					await vscode.env.clipboard.writeText(jsonPath);
					vscode.window.showInformationMessage("File path copied to clipboard.");
					break;
			}
		}),

		vscode.commands.registerCommand("wcagEnhancer.showJsonStatus", async () => {
			try {
				const jsonManager = jsonManagerRef.get();
				if (!jsonManager) {
					vscode.window.showErrorMessage("JSON Manager not found");
					return;
				}

				const settings = await jsonManager.getSettings();
				const jsonPath = jsonManager.getJsonFilePath();

				const message = `AccessiMind JSON Status:

File Path: ${jsonPath}
Version: ${settings.version}
Created: ${new Date(settings.createdAt).toLocaleString("tr-TR")}
Last Modified: ${new Date(settings.lastModified).toLocaleString("tr-TR")}

Wizard: ${settings.wizard.completed ? "Completed" : "In Progress"}
${settings.wizard.completedAt ? `Completed At: ${new Date(settings.wizard.completedAt).toLocaleString("tr-TR")}` : ""}

AI Provider: ${settings.settings.ai?.provider || "Not configured"}
Model: ${settings.settings.ai?.selectedModel || "Not configured"}
API Key: ${settings.settings.ai?.apiKeyConfigured ? "Configured" : "Missing"}
Language: ${settings.settings.language || "auto"}
WCAG Level: ${settings.settings.wcagLevel || "AA"}

Statistics: ${settings.statistics.enabled ? "Enabled" : "Disabled"}
Total Analyses: ${settings.statistics.totalAnalyses}
Total Improvements: ${settings.statistics.totalImprovements}`;

				vscode.window.showInformationMessage(message);
			} catch (error) {
				logger.error("JSON status error:", error);
				vscode.window.showErrorMessage(`JSON status could not be loaded: ${error}`);
			}
		}),

		vscode.commands.registerCommand("wcagEnhancer.resetJsonFile", async () => {
			const action = await vscode.window.showWarningMessage(
				"Are you sure you want to reset the AccessiMind JSON file? This will remove wizard and settings history.",
				{ modal: true },
				"Reset JSON File"
			);

			if (action !== "Reset JSON File") {
				return;
			}

			try {
				const jsonManager = jsonManagerRef.get();
				if (!jsonManager) {
					vscode.window.showErrorMessage("JSON Manager not found");
					return;
				}

				jsonManager.dispose();
				const newJsonManager = AccessiMindJsonManager.getInstance(context);
				await newJsonManager.initialize();
				jsonManagerRef.set(newJsonManager);
				wizardManager.setJsonManager(newJsonManager);

				vscode.window.showInformationMessage("AccessiMind JSON file has been reset.");
			} catch (error) {
				logger.error("JSON reset error:", error);
				vscode.window.showErrorMessage(`JSON file could not be reset: ${error}`);
			}
		}),

		vscode.commands.registerCommand("wcagEnhancer.validateJsonHealth", async () => {
			try {
				const jsonManager = jsonManagerRef.get();
				if (!jsonManager) {
					vscode.window.showErrorMessage("JSON Manager not found");
					return;
				}

				const health = await jsonManager.validateJsonHealth();
				if (health.isHealthy) {
					vscode.window.showInformationMessage("AccessiMind JSON file is healthy.");
					return;
				}

				const action = await vscode.window.showWarningMessage(
					`Issues found in JSON file:\n${health.issues.join("\n")}`,
					"Repair File",
					"Show Details"
				);

				if (action === "Repair File") {
					await vscode.commands.executeCommand("wcagEnhancer.repairJsonFile");
				}
			} catch (error) {
				logger.error("JSON health validation error:", error);
				vscode.window.showErrorMessage(`Health validation failed: ${error}`);
			}
		}),

		vscode.commands.registerCommand("wcagEnhancer.repairJsonFile", async () => {
			try {
				const jsonManager = jsonManagerRef.get();
				if (!jsonManager) {
					vscode.window.showErrorMessage("JSON Manager not found");
					return;
				}

				const action = await vscode.window.showWarningMessage(
					"Repairing the JSON file will back up the current file and create a fresh default file. Continue?",
					{ modal: true },
					"Repair File"
				);

				if (action === "Repair File") {
					await jsonManager.repairJsonFile();
				}
			} catch (error) {
				logger.error("JSON repair error:", error);
				vscode.window.showErrorMessage(`File could not be repaired: ${error}`);
			}
		})
	);
}
