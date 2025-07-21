import * as vscode from "vscode";
import { AITestUtils } from "./aiTestUtils";
import { logger } from "./logger";

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
		const language = config.get<string>("language", "auto");
		
		// Get current language for messages
		const currentLanguage = this.getCurrentLanguage(language);
		
		if (aiConfig?.provider === "gemini") {
			const apiKey = aiConfig?.apiKey;
			if (apiKey && apiKey.trim() !== "") {
				vscode.window.showInformationMessage(
					this.getLocalizedMessage("AI settings updated", currentLanguage)
				);
				
				// Auto test if enabled
				if (aiConfig?.autoTestOnChange) {
					await this.aiTestUtils.testAIProvider();
				}
			} else {
				vscode.window.showWarningMessage(
					this.getLocalizedMessage("Gemini API key is missing", currentLanguage)
				);
			}
		} else if (aiConfig?.provider === "vscode-copilot") {
			vscode.window.showInformationMessage(
				this.getLocalizedMessage("Copilot provider selected", currentLanguage)
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
		const language = config.get<string>("language", "auto");
		const currentLanguage = this.getCurrentLanguage(language);

		if (!aiConfig) {
			return { 
				isValid: false, 
				message: this.getLocalizedMessage("AI configuration is missing", currentLanguage) 
			};
		}

		const provider = aiConfig.provider;
		if (!provider) {
			return { 
				isValid: false, 
				message: this.getLocalizedMessage("AI provider not selected", currentLanguage) 
			};
		}

		if (provider === "gemini") {
			const apiKey = aiConfig.apiKey;
			if (!apiKey || apiKey.trim() === "") {
				return { 
					isValid: false, 
					message: this.getLocalizedMessage("Gemini API key is required", currentLanguage) 
				};
			}

			if (!apiKey.startsWith("AIza")) {
				return { 
					isValid: false, 
					message: this.getLocalizedMessage("Invalid Gemini API key format", currentLanguage) 
				};
			}
		}

		return { 
			isValid: true, 
			message: this.getLocalizedMessage("Settings are valid", currentLanguage) 
		};
	}

	public async testAIConnection(): Promise<void> {
		try {
			const result = await this.aiTestUtils.testAIProvider();
			await this.aiTestUtils.showTestResult(result);
		} catch (error) {
			logger.error("AI connection test error:", error);
			const language = vscode.workspace.getConfiguration("wcagEnhancer").get<string>("language", "auto");
			const currentLanguage = this.getCurrentLanguage(language);
			
			vscode.window.showErrorMessage(
				this.getLocalizedMessage("AI test failed", currentLanguage)
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

	/**
	 * Get current language for messages
	 */
	private getCurrentLanguage(languageSetting: string): string {
		if (languageSetting === "auto") {
			return "en";
		}
		return languageSetting;
	}

	/**
	 * Get localized message
	 */
	private getLocalizedMessage(key: string, language: string): string {
		const messages: Record<string, Record<string, string>> = {
			"AI settings updated": {
				en: "AI settings updated successfully",
				tr: "AI ayarları başarıyla güncellendi"
			},
			"Gemini API key is missing": {
				en: "Gemini API key is missing or empty",
				tr: "Gemini API anahtarı eksik veya boş"
			},
			"Copilot provider selected": {
				en: "GitHub Copilot provider selected",
				tr: "GitHub Copilot sağlayıcısı seçildi"
			},
			"AI configuration is missing": {
				en: "AI configuration is missing",
				tr: "AI yapılandırması eksik"
			},
			"AI provider not selected": {
				en: "AI provider not selected",
				tr: "AI sağlayıcısı seçilmemiş"
			},
			"Gemini API key is required": {
				en: "Gemini API key is required for this provider",
				tr: "Bu sağlayıcı için Gemini API anahtarı gerekli"
			},
			"Invalid Gemini API key format": {
				en: "Invalid Gemini API key format. Key should start with \"AIza\"",
				tr: "Geçersiz Gemini API anahtarı formatı. Anahtar \"AIza\" ile başlamalı"
			},
			"Settings are valid": {
				en: "Settings are valid",
				tr: "Ayarlar geçerli"
			},
			"AI test failed": {
				en: "AI connection test failed",
				tr: "AI bağlantı testi başarısız"
			}
		};

		return messages[key]?.[language] || messages[key]?.["en"] || key;
	}

	public dispose(): void {
		if (this.configChangeListener) {
			this.configChangeListener.dispose();
		}
	}
} 