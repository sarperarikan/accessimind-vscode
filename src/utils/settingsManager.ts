import * as vscode from "vscode";
import { AITestUtils } from "./aiTestUtils";
import {
	getAiConfig,
	getNormalizedSelectedModel,
	updateNormalizedSelectedModel,
} from "./configurationUtils";
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
		this.configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("wcagEnhancer.ai")) {
				void this.onAISettingsChanged();
			}

			if (event.affectsConfiguration("wcagEnhancer.language")) {
				LocalizationManager.getInstance().detectLanguage();
			}
		});
	}

	private async onAISettingsChanged(): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = getAiConfig(config);
		const localization = LocalizationManager.getInstance();

		if (aiConfig.provider === "gemini") {
			const apiKey = aiConfig.apiKey;
			if (typeof apiKey === "string" && apiKey.trim() !== "") {
				vscode.window.showInformationMessage(localization.getString("settings.updated"));

				if (aiConfig.autoTestOnChange) {
					await this.aiTestUtils.testAIProvider();
				}
			} else {
				vscode.window.showWarningMessage(
					localization.getString("settings.warn.gemini.key.missing")
				);
			}
		} else if (aiConfig.provider === "vscode-copilot") {
			vscode.window.showInformationMessage(
				localization.getString("settings.info.copilot.selected")
			);

			if (aiConfig.autoTestOnChange) {
				await this.aiTestUtils.testAIProvider();
			}
		}
	}

	public async updateAIProvider(provider: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = getAiConfig(config);
		aiConfig.provider = provider;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
	}

	public async updateApiKey(apiKey: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = getAiConfig(config);
		aiConfig.apiKey = apiKey;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
	}

	public async updateSelectedModel(model: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		await updateNormalizedSelectedModel(config, model);
	}

	public async updateAISetting(key: string, value: unknown): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = getAiConfig(config);
		aiConfig[key] = value;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
	}

	public async validateSettings(): Promise<{ isValid: boolean; message: string }> {
		const aiConfig = this.getAIConfig();
		const localization = LocalizationManager.getInstance();

		if (!aiConfig || Object.keys(aiConfig).length === 0) {
			return {
				isValid: false,
				message: localization.getString("settings.error.config.missing"),
			};
		}

		const provider = aiConfig.provider;
		if (!provider) {
			return {
				isValid: false,
				message: localization.getString("settings.error.provider.missing"),
			};
		}

		if (provider === "gemini") {
			const apiKey = aiConfig.apiKey;
			if (typeof apiKey !== "string" || apiKey.trim() === "") {
				return {
					isValid: false,
					message: localization.getString("settings.error.apikey.missing"),
				};
			}

			if (!apiKey.startsWith("AIza")) {
				return {
					isValid: false,
					message: localization.getString("error.api.key.format"),
				};
			}
		}

		return {
			isValid: true,
			message: localization.getString("settings.valid"),
		};
	}

	public async testAIConnection(): Promise<void> {
		try {
			const result = await this.aiTestUtils.testAIProvider();
			await this.aiTestUtils.showTestResult(result);
		} catch (error) {
			logger.error("AI connection test error:", error);
			const localization = LocalizationManager.getInstance();
			vscode.window.showErrorMessage(localization.getString("settings.test.failed"));
		}
	}

	public getAIConfig(): ReturnType<typeof getAiConfig> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		return getAiConfig(config);
	}

	public getCurrentProvider(): string {
		const aiConfig = this.getAIConfig();
		return aiConfig.provider || "gemini";
	}

	public getApiKey(): string {
		const aiConfig = this.getAIConfig();
		return typeof aiConfig.apiKey === "string" ? aiConfig.apiKey : "";
	}

	public getSelectedModel(): string {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		return getNormalizedSelectedModel(config);
	}

	public dispose(): void {
		this.configChangeListener?.dispose();
	}
}
