import * as vscode from "vscode";
import { AccessiMindJsonManager } from "./accessiMindJsonManager";
import {
	normalizeAiSettingsSnapshot,
	updateNormalizedSelectedModel,
} from "./configurationUtils";
import { logger } from "./logger";
import { LocalizationManager } from "./localizationManager";

export class PersistentSettingsManager {
	private static instance: PersistentSettingsManager;
	private context: vscode.ExtensionContext;
	private configChangeListener: vscode.Disposable | undefined;
	private settingsCache: Map<string, unknown> = new Map();
	private isInitialized = false;
	private jsonManager: AccessiMindJsonManager | undefined;
	private persistDebounceTimer: NodeJS.Timeout | undefined;

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.jsonManager = AccessiMindJsonManager.getInstance(context);
	}

	public static getInstance(context?: vscode.ExtensionContext): PersistentSettingsManager {
		if (!PersistentSettingsManager.instance && context) {
			PersistentSettingsManager.instance = new PersistentSettingsManager(context);
		}
		return PersistentSettingsManager.instance;
	}

	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			await this.loadPersistedSettings();
			this.setupConfigurationListener();
			await this.syncWithWorkspaceConfiguration();
			this.isInitialized = true;
			logger.info("PersistentSettingsManager initialized");
		} catch (error) {
			logger.error("PersistentSettingsManager initialization error:", error);
		}
	}

	private setupConfigurationListener(): void {
		this.configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
			if (!event.affectsConfiguration("wcagEnhancer")) {
				return;
			}

			if (this.persistDebounceTimer) {
				clearTimeout(this.persistDebounceTimer);
			}

			this.persistDebounceTimer = setTimeout(() => {
				void this.persistCurrentConfiguration();
				this.jsonManager?.scheduleSyncFromVSCodeConfiguration();
				logger.info("Configuration change scheduled for persistence");
			}, 250);
		});
	}

	public async persistCurrentConfiguration(): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const { ai, aiModels } = normalizeAiSettingsSnapshot(config);
			const settingsToSave = {
				ai,
				aiModels,
				language: config.get("language", "en"),
				wcagLevel: config.get("wcagLevel", "AA"),
				strictMode: config.get("strictMode", false),
				customRulesPath: config.get("customRulesPath", ""),
				contextAwareAnalysis: config.get("contextAwareAnalysis", true),
				analysisDisabilityFocus: config.get("analysisDisabilityFocus", []),
				autoApply: config.get("autoApply", false),
				includeComments: config.get("includeComments", true),
				enableStatistics: config.get("enableStatistics", true),
				customPrompt: config.get("customPrompt", ""),
				responseDetail: config.get("responseDetail", "summary"),
				interfacePreferences: config.get("interfacePreferences", {}),
				browserIntegration: config.get("browserIntegration", {}),
				jira: config.get("jira", {}),
				wizardCompleted: config.get("wizardCompleted", false),
				shortcuts: {
					analyzeOpenCode: config.get("shortcuts.analyzeOpenCode", "ctrl+alt+w"),
					analyzeSelectedCode: config.get("shortcuts.analyzeSelectedCode", "ctrl+alt+shift+w"),
					showInterface: config.get("shortcuts.showInterface", "ctrl+alt+u"),
				},
			};

			await this.context.globalState.update("wcagEnhancer.persistedSettings", settingsToSave);
			await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", settingsToSave);
			this.settingsCache.set("persistedSettings", settingsToSave);
			logger.info("Settings persisted successfully");
		} catch (error) {
			logger.error("Settings persistence error:", error);
		}
	}

	private async loadPersistedSettings(): Promise<void> {
		try {
			const globalSettings = this.context.globalState.get("wcagEnhancer.persistedSettings") as Record<string, unknown> | undefined;
			const workspaceSettings = this.context.workspaceState.get("wcagEnhancer.workspaceSettings") as Record<string, unknown> | undefined;

			if (globalSettings || workspaceSettings) {
				this.settingsCache.set("persistedSettings", {
					...(globalSettings || {}),
					...(workspaceSettings || {}),
				});
				logger.info("Persisted settings loaded");
			}
		} catch (error) {
			logger.error("Persisted settings load error:", error);
		}
	}

	public async restoreSettings(): Promise<void> {
		try {
			const persistedSettings =
				(this.settingsCache.get("persistedSettings") as Record<string, any> | undefined) ||
				(this.context.globalState.get("wcagEnhancer.persistedSettings") as Record<string, any> | undefined);

			if (!persistedSettings) {
				logger.info("No persisted settings to restore");
				return;
			}

			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const restorePromises: Array<Thenable<void> | Promise<void>> = [
				this.updateConfigSafely(config, "ai", persistedSettings.ai),
				this.updateConfigSafely(config, "language", persistedSettings.language),
				this.updateConfigSafely(config, "wcagLevel", persistedSettings.wcagLevel),
				this.updateConfigSafely(config, "strictMode", persistedSettings.strictMode),
				this.updateConfigSafely(config, "customRulesPath", persistedSettings.customRulesPath),
				this.updateConfigSafely(config, "contextAwareAnalysis", persistedSettings.contextAwareAnalysis),
				this.updateConfigSafely(config, "analysisDisabilityFocus", persistedSettings.analysisDisabilityFocus),
				this.updateConfigSafely(config, "autoApply", persistedSettings.autoApply),
				this.updateConfigSafely(config, "includeComments", persistedSettings.includeComments),
				this.updateConfigSafely(config, "enableStatistics", persistedSettings.enableStatistics),
				this.updateConfigSafely(config, "customPrompt", persistedSettings.customPrompt),
				this.updateConfigSafely(config, "responseDetail", persistedSettings.responseDetail),
				this.updateConfigSafely(config, "interfacePreferences", persistedSettings.interfacePreferences),
				this.updateConfigSafely(config, "browserIntegration", persistedSettings.browserIntegration),
				this.updateConfigSafely(config, "jira", persistedSettings.jira),
				this.updateConfigSafely(config, "wizardCompleted", persistedSettings.wizardCompleted),
			];

			const selectedModel =
				persistedSettings.aiModels?.selectedModel || persistedSettings.ai?.selectedModel;
			if (selectedModel) {
				restorePromises.push(updateNormalizedSelectedModel(config, selectedModel));
			} else {
				restorePromises.push(this.updateConfigSafely(config, "aiModels", persistedSettings.aiModels));
			}

			if (persistedSettings.shortcuts) {
				restorePromises.push(
					this.updateConfigSafely(
						config,
						"shortcuts.analyzeOpenCode",
						persistedSettings.shortcuts.analyzeOpenCode
					),
					this.updateConfigSafely(
						config,
						"shortcuts.analyzeSelectedCode",
						persistedSettings.shortcuts.analyzeSelectedCode
					),
					this.updateConfigSafely(
						config,
						"shortcuts.showInterface",
						persistedSettings.shortcuts.showInterface
					)
				);
			}

			await Promise.all(restorePromises);

			const localization = LocalizationManager.getInstance();
			vscode.window.showInformationMessage(localization.getString("persistent.settings.restored"));
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error("Settings restore error:", error);
			const localization = LocalizationManager.getInstance();
			vscode.window.showErrorMessage(
				localization.getStringWithParams("persistent.settings.error.restore", { error: errorMessage })
			);
		}
	}

	private async updateConfigSafely(
		config: vscode.WorkspaceConfiguration,
		key: string,
		value: unknown
	): Promise<void> {
		if (value === undefined || value === null) {
			return;
		}

		try {
			await config.update(key, value, vscode.ConfigurationTarget.Global);
		} catch (error) {
			logger.error(`Failed to update configuration key ${key}:`, error);
		}
	}

	private async syncWithWorkspaceConfiguration(): Promise<void> {
		try {
			const persistedSettings = this.settingsCache.get("persistedSettings") as Record<string, any> | undefined;
			if (!persistedSettings) {
				return;
			}

			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const { ai, aiModels } = normalizeAiSettingsSnapshot(config);
			const hasAiConfig = Object.keys(ai).length > 0;
			const hasModelConfig = Object.keys(aiModels).length > 0;

			if (!hasAiConfig && persistedSettings.ai && Object.keys(persistedSettings.ai).length > 0) {
				await config.update("ai", persistedSettings.ai, vscode.ConfigurationTarget.Global);
			}

			if (!hasModelConfig && persistedSettings.aiModels && Object.keys(persistedSettings.aiModels).length > 0) {
				const selectedModel =
					persistedSettings.aiModels.selectedModel || persistedSettings.ai?.selectedModel;
				if (selectedModel) {
					await updateNormalizedSelectedModel(config, selectedModel);
				}
			}

			if (!config.get("wizardCompleted", false) && persistedSettings.wizardCompleted) {
				await config.update("wizardCompleted", persistedSettings.wizardCompleted, vscode.ConfigurationTarget.Global);
			}

			if (config.get("language", "en") === "en" && persistedSettings.language && persistedSettings.language !== "en") {
				await config.update("language", persistedSettings.language, vscode.ConfigurationTarget.Global);
			}

			if (config.get("wcagLevel", "AA") === "AA" && persistedSettings.wcagLevel && persistedSettings.wcagLevel !== "AA") {
				await config.update("wcagLevel", persistedSettings.wcagLevel, vscode.ConfigurationTarget.Global);
			}
		} catch (error) {
			logger.error("Workspace configuration sync error:", error);
		}
	}

	public async persistSetting(key: string, value: unknown): Promise<void> {
		try {
			const currentSettings =
				(this.settingsCache.get("persistedSettings") as Record<string, unknown> | undefined) || {};
			currentSettings[key] = value;

			await this.context.globalState.update("wcagEnhancer.persistedSettings", currentSettings);
			await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", currentSettings);
			this.settingsCache.set("persistedSettings", currentSettings);
		} catch (error) {
			logger.error(`Persistent setting save error for ${key}:`, error);
		}
	}

	public getPersistedSetting(key: string, defaultValue?: unknown): unknown {
		const settings =
			(this.settingsCache.get("persistedSettings") as Record<string, unknown> | undefined) ||
			(this.context.globalState.get("wcagEnhancer.persistedSettings") as Record<string, unknown> | undefined) ||
			{};
		return settings[key] !== undefined ? settings[key] : defaultValue;
	}

	public async clearPersistedSettings(): Promise<void> {
		try {
			await this.context.globalState.update("wcagEnhancer.persistedSettings", undefined);
			await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", undefined);
			this.settingsCache.clear();

			const localization = LocalizationManager.getInstance();
			vscode.window.showInformationMessage(localization.getString("persistent.settings.cleared"));
		} catch (error) {
			logger.error("Persistent settings clear error:", error);
		}
	}

	public async exportPersistedSettings(): Promise<void> {
		try {
			const settings =
				(this.settingsCache.get("persistedSettings") as Record<string, unknown> | undefined) ||
				(this.context.globalState.get("wcagEnhancer.persistedSettings") as Record<string, unknown> | undefined);
			const localization = LocalizationManager.getInstance();

			if (!settings) {
				vscode.window.showWarningMessage(localization.getString("persistent.settings.no.data"));
				return;
			}

			const jsonContent = JSON.stringify(settings, null, 2);
			const timestamp = new Date().toISOString().split("T")[0];
			const uri = await vscode.window.showSaveDialog({
				filters: { "JSON Files": ["json"] },
				defaultUri: vscode.Uri.file(`accessimind-settings-${timestamp}.json`),
			});

			if (uri) {
				await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, "utf8"));
				vscode.window.showInformationMessage(localization.getString("persistent.settings.exported"));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error("Settings export error:", error);
			const localization = LocalizationManager.getInstance();
			vscode.window.showErrorMessage(
				localization.getStringWithParams("persistent.settings.error.export", { error: errorMessage })
			);
		}
	}

	public async importPersistedSettings(): Promise<void> {
		try {
			const uri = await vscode.window.showOpenDialog({
				filters: { "JSON Files": ["json"] },
				canSelectMany: false,
				openLabel: "Import AccessiMind Settings",
			});

			if (!uri?.[0]) {
				return;
			}

			const fileContent = await vscode.workspace.fs.readFile(uri[0]);
			const settings = JSON.parse(fileContent.toString());

			await this.context.globalState.update("wcagEnhancer.persistedSettings", settings);
			await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", settings);
			this.settingsCache.set("persistedSettings", settings);

			await this.restoreSettings();

			const localization = LocalizationManager.getInstance();
			vscode.window.showInformationMessage(localization.getString("persistent.settings.imported"));
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error("Settings import error:", error);
			const localization = LocalizationManager.getInstance();
			vscode.window.showErrorMessage(
				localization.getStringWithParams("persistent.settings.error.import", { error: errorMessage })
			);
		}
	}

	public getSettingsStatus(): {
		hasPersistedSettings: boolean;
		globalSettingsCount: number;
		workspaceSettingsCount: number;
		cacheSize: number;
	} {
		const globalSettings =
			(this.context.globalState.get("wcagEnhancer.persistedSettings") as Record<string, unknown> | undefined) || {};
		const workspaceSettings =
			(this.context.workspaceState.get("wcagEnhancer.workspaceSettings") as Record<string, unknown> | undefined) || {};
		const cachedSettings =
			(this.settingsCache.get("persistedSettings") as Record<string, unknown> | undefined) || {};

		return {
			hasPersistedSettings:
				Object.keys(globalSettings).length > 0 || Object.keys(workspaceSettings).length > 0,
			globalSettingsCount: Object.keys(globalSettings).length,
			workspaceSettingsCount: Object.keys(workspaceSettings).length,
			cacheSize: Object.keys(cachedSettings).length,
		};
	}

	public dispose(): void {
		this.configChangeListener?.dispose();
		if (this.persistDebounceTimer) {
			clearTimeout(this.persistDebounceTimer);
		}
		this.settingsCache.clear();
	}
}
