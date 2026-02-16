import * as vscode from "vscode";
import { AITestUtils } from "./aiTestUtils";
import { logger } from "./logger";
import { LocalizationManager } from "./localizationManager";

export class SettingsManager {
	private static instance: SettingsManager;
	private configChangeListener: vscode.Disposable | undefined;
	private aiTestUtils: AITestUtils;

	private constructor() {
		this.aiTestUtils = AITestUtils.getInstance();
		this.setupConfigChangeListener();
	}

	public static getInstance(): SettingsManager {
		if (!SettingsManager.instance) {
			SettingsManager.instance = new SettingsManager();
		}
		return SettingsManager.instance;
	}

	private setupConfigChangeListener(): void {
		this.configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration("wcagEnhancer.ai")) {
				this.onAISettingsChanged();
			}
		});
	}

	private async onAISettingsChanged(): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any;
		const localization = LocalizationManager.getInstance();

		if (aiConfig?.provider === "gemini") {
			const apiKey = aiConfig?.apiKey;
			if (apiKey && apiKey.trim() !== "") {
				vscode.window.showInformationMessage(
					localization.getString("settings.updated")
				);

				// Auto test if enabled
				if (aiConfig?.autoTestOnChange) {
					await this.aiTestUtils.testAIProvider();
				}
			} else {
				vscode.window.showWarningMessage(
					localization.getString("settings.warn.gemini.key.missing")
				);
			}
		} else if (aiConfig?.provider === "vscode-copilot") {
			vscode.window.showInformationMessage(
				localization.getString("settings.info.copilot.selected")
			);

			// Auto test if enabled
			if (aiConfig?.autoTestOnChange) {
				await this.aiTestUtils.testAIProvider();
			}
		}
	}

	public async updateAIProvider(provider: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		aiConfig.provider = provider;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
	}

	public async updateApiKey(apiKey: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		aiConfig.apiKey = apiKey;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
	}

	public async updateSelectedModel(model: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");

		// Model ayarını hem ai config'e hem de aiModels config'e kaydet (tutarlılık için)
		const aiConfig = config.get("ai") as any || {};
		aiConfig.selectedModel = model;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

		const aiModelConfig = config.get("aiModels") as any || {};
		aiModelConfig.selectedModel = model;
		await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);
	}

	public async updateAISetting(key: string, value: any): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		aiConfig[key] = value;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
	}

	public async validateSettings(): Promise<{ isValid: boolean; message: string }> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any;
		const localization = LocalizationManager.getInstance();

		if (!aiConfig) {
			return {
				isValid: false,
				message: localization.getString("settings.error.config.missing")
			};
		}

		const provider = aiConfig.provider;
		if (!provider) {
			return {
				isValid: false,
				message: localization.getString("settings.error.provider.missing")
			};
		}

		if (provider === "gemini") {
			const apiKey = aiConfig.apiKey;
			if (!apiKey || apiKey.trim() === "") {
				return {
					isValid: false,
					message: localization.getString("settings.error.apikey.missing")
				};
			}

			if (!apiKey.startsWith("AIza")) {
				return {
					isValid: false,
					message: localization.getString("error.api.key.format")
				};
			}
		}

		return {
			isValid: true,
			message: localization.getString("settings.valid")
		};
	}

	public async testAIConnection(): Promise<void> {
		try {
			const result = await this.aiTestUtils.testAIProvider();
			await this.aiTestUtils.showTestResult(result);
		} catch (error) {
			logger.error("AI connection test error:", error);
			const localization = LocalizationManager.getInstance();

			vscode.window.showErrorMessage(
				localization.getString("settings.test.failed")
			);
		}
	}

	public getAIConfig(): any {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		return config.get("ai") as any || {};
	}

	public getCurrentProvider(): string {
		const aiConfig = this.getAIConfig();
		return aiConfig.provider || "gemini";
	}

	public getApiKey(): string {
		const aiConfig = this.getAIConfig();
		return aiConfig.apiKey || "";
	}

	public getSelectedModel(): string {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		const aiModelConfig = config.get("aiModels") as any || {};

		// Önce aiModels'dan, sonra ai config'den model almaya çalış
		return aiModelConfig.selectedModel || aiConfig.selectedModel || "gemini-2.5-flash";
	}

	public dispose(): void {
		if (this.configChangeListener) {
			this.configChangeListener.dispose();
		}
	}
} 