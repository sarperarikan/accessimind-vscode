import * as vscode from "vscode";
import { AIProviderManager, GeminiProvider } from "./utils/aiProvider";
import { PersistentSettingsManager } from "./utils/persistentSettingsManager";
import { AccessiMindJsonManager } from "./utils/accessiMindJsonManager";
import { logger } from "./utils/logger";
import { LocalizationManager } from "./utils/localizationManager";

export class WizardManager {
	private static instance: WizardManager;
	private aiProviderManager: AIProviderManager;
	private persistentSettingsManager: PersistentSettingsManager | null = null;
	private jsonManager: AccessiMindJsonManager | null = null;

	private constructor() {
		this.aiProviderManager = AIProviderManager.getInstance();
	}

	public static getInstance(): WizardManager {
		if (!WizardManager.instance) {
			WizardManager.instance = new WizardManager();
		}
		return WizardManager.instance;
	}

	/**
	 * Set the persistent settings manager instance
	 */
	public setPersistentSettingsManager(manager: PersistentSettingsManager): void {
		this.persistentSettingsManager = manager;
	}

	/**
	 * Set the JSON manager instance
	 */
	public setJsonManager(manager: AccessiMindJsonManager): void {
		this.jsonManager = manager;
	}

	public async showWizard(): Promise<void> {
		const { LocalizationManager } = await import("./utils/localizationManager");
		const localization = LocalizationManager.getInstance();
		const isEnglish = localization.getCurrentLanguage() === "en";

		// Step 1: Select AI Provider
		const providerItems: vscode.QuickPickItem[] = [
			{
				label: "$(rocket) " + localization.getString("provider.gemini.name"),
				description: localization.getString("wizard.provider.gemini.description"),
				detail: localization.getString("wizard.provider.gemini.detail"),
				picked: false
			},
			{
				label: "$(hubot) " + localization.getString("provider.vscode-copilot.name"),
				description: localization.getString("wizard.provider.copilot.description"),
				detail: localization.getString("wizard.provider.copilot.detail"),
				picked: false
			},
			{
				label: "$(server) Ollama (Local)",
				description: localization.getString("wizard.provider.ollama.description"),
				detail: localization.getString("wizard.provider.ollama.detail"),
				picked: false
			}
		];

		const selectedProvider = await vscode.window.showQuickPick(providerItems, {
			title: localization.getStringWithParams("wizard.setup.step.title", { step: 1, title: localization.getString("wizard.provider.title") }),
			placeHolder: localization.getString("wizard.provider.placeholder"),
			ignoreFocusOut: false
		});

		if (!selectedProvider) {
			return; // User cancelled
		}

		// Map selection to provider id
		let providerId: string;
		if (selectedProvider.label.includes("Gemini")) {
			providerId = "gemini";
		} else if (selectedProvider.label.includes("Copilot")) {
			providerId = "vscode-copilot";
		} else {
			providerId = "ollama";
		}

		await this.setupProvider(providerId);

		// Step 1.5: API Key for Gemini or URL for Ollama
		if (providerId === "gemini") {
			const apiKey = await vscode.window.showInputBox({
				title: localization.getString("wizard.apikey.title"),
				prompt: localization.getString("wizard.apikey.prompt"),
				placeHolder: localization.getString("wizard.apikey.placeholder"),
				password: true,
				ignoreFocusOut: false,
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return localization.getString("wizard.apikey.required");
					}
					return null;
				}
			});

			if (!apiKey) {
				return; // User cancelled
			}

			const apiKeySuccess = await this.setupApiKey(apiKey);
			if (!apiKeySuccess) {
				vscode.window.showErrorMessage(localization.getString("wizard.apiKey.invalid"));
				return;
			}
		} else if (providerId === "ollama") {
			const ollamaUrl = await vscode.window.showInputBox({
				title: localization.getStringWithParams("wizard.setup.step.title", { step: 1, title: "Ollama URL" }),
				prompt: localization.getString("wizard.ollama.url.prompt"),
				value: "http://localhost:11434",
				placeHolder: "http://localhost:11434",
				ignoreFocusOut: false
			});

			if (ollamaUrl) {
				await this.setupOllamaUrl(ollamaUrl);
			}
		}

		// Step 2: Select Model
		const availableModels = await this.getAvailableModelsForWizard();
		const providerModels = providerId === "gemini" ? availableModels.gemini
			: providerId === "vscode-copilot" ? availableModels.copilot
				: availableModels.ollama;

		if (providerModels && providerModels.length > 0) {
			const modelItems: vscode.QuickPickItem[] = providerModels.map((m: any) => ({
				label: (m.recommended ? "$(star-full) " : "") + m.name,
				description: m.description,
				detail: localization.getStringWithParams("wizard.model.speed", { speed: m.speed, quality: m.quality }),
				id: m.id
			}));

			const selectedModel = await vscode.window.showQuickPick(modelItems, {
				title: localization.getStringWithParams("wizard.setup.step.title", { step: 2, title: localization.getString("wizard.model.title") }),
				placeHolder: localization.getString("wizard.model.placeholder"),
				ignoreFocusOut: false
			});

			if (!selectedModel) {
				return; // User cancelled
			}

			// Get the model id from the original model data
			const modelMatch = providerModels.find((m: any) => selectedModel.label.includes(m.name));
			if (modelMatch) {
				await this.setupModel(modelMatch.id);
			}
		}

		// Step 3: Select WCAG Level
		const wcagItems: vscode.QuickPickItem[] = [
			{
				label: "WCAG 2.2 Level A",
				description: localization.getString("wizard.wcag.level.a.description"),
				detail: localization.getString("wizard.wcag.level.a.detail")
			},
			{
				label: "$(star-full) WCAG 2.2 Level AA",
				description: localization.getString("wizard.wcag.level.aa.description"),
				detail: localization.getString("wizard.wcag.level.aa.detail")
			},
			{
				label: "WCAG 2.2 Level AAA",
				description: localization.getString("wizard.wcag.level.aaa.description"),
				detail: localization.getString("wizard.wcag.level.aaa.detail")
			}
		];

		const selectedWcag = await vscode.window.showQuickPick(wcagItems, {
			title: localization.getStringWithParams("wizard.setup.step.title", { step: 3, title: "WCAG Level" }),
			placeHolder: localization.getString("wizard.wcag.placeholder"),
			ignoreFocusOut: false
		});

		if (!selectedWcag) {
			return;
		}

		let wcagLevel = "AA";
		if (selectedWcag.label.includes("AAA")) {
			wcagLevel = "AAA";
		} else if (selectedWcag.label.includes("Level A") && !selectedWcag.label.includes("AA")) {
			wcagLevel = "A";
		}
		await this.setupWcagLevel(wcagLevel);

		// Step 4: Select Language
		const langItems: vscode.QuickPickItem[] = [
			{
				label: localization.getString("wizard.language.english.label"),
				description: localization.getString("wizard.language.english.description"),
				detail: localization.getString("wizard.language.english.detail")
			},
			{
				label: localization.getString("wizard.language.turkish.label"),
				description: localization.getString("wizard.language.turkish.description"),
				detail: localization.getString("wizard.language.turkish.detail")
			}
		];

		const selectedLang = await vscode.window.showQuickPick(langItems, {
			title: localization.getStringWithParams("wizard.setup.step.title", { step: 4, title: "Language" }),
			placeHolder: localization.getString("wizard.language.placeholder"),
			ignoreFocusOut: false
		});

		if (!selectedLang) {
			return;
		}

		const language = selectedLang.label.includes("English") ? "en" : "tr";
		await this.setupLanguage(language);

		// Step 5: Test Connection
		const testChoice = await vscode.window.showInformationMessage(
			localization.getString("wizard.complete.test.prompt"),
			{ modal: true },
			localization.getString("wizard.test.connection.button"),
			localization.getString("wizard.button.finish.short")
		);

		if (testChoice === localization.getString("wizard.test.connection.button")) {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: localization.getString("wizard.test.progress.title"),
					cancellable: false
				},
				async () => {
					const testResult = await this.testAIConnection();
					if (testResult.success) {
						vscode.window.showInformationMessage(
							localization.getStringWithParams("wizard.test.success.detail", { message: testResult.message })
						);
					} else {
						vscode.window.showErrorMessage(
							localization.getStringWithParams("wizard.test.failed.detail", { message: testResult.message })
						);
					}
				}
			);
		}

		// Finish wizard
		await this.finishWizard();
		vscode.window.showInformationMessage(localization.getString("wizard.finish.success"));
	}

	private async getAvailableModelsForWizard(): Promise<any> {
		const { LocalizationManager: _LocalizationManager } = await import("./utils/localizationManager");
		// localization değişkeni kaldırıldı çünkü kullanılmıyor

		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const _aiConfig = config.get("ai") as any || {};
		const _aiModelConfig = config.get("aiModels") as any || {};

		const models: {
			gemini: Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean }>;
			copilot: Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean, available?: boolean }>;
			ollama: Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean, available?: boolean }>;
			all: Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean, available?: boolean }>;
		} = {
			gemini: [],
			copilot: [],
			ollama: [],
			all: []
		};

		// Gemini models - dinamik olarak API'den yükle
		try {
			const geminiModels = await this.getAvailableGeminiModels();
			models.gemini = geminiModels;
		} catch (error) {
			logger.warn("Gemini modelleri yüklenemedi, varsayılan modeller kullanılıyor:", error);
			models.gemini = await this.getDefaultGeminiModels();
		}

		// Copilot models - dinamik olarak API'den yükle
		try {
			// Önce GitHub Copilot durumunu kontrol et
			const copilotStatus = await this.checkCopilotStatus();

			if (copilotStatus.available) {
				await this.aiProviderManager.refreshCopilotModels();
				const copilotModels = await this.aiProviderManager.getAvailableCopilotModels();

				if (copilotModels.length > 0) {
					models.copilot = copilotModels.map((model: any) => ({
						id: model.id,
						name: model.name,
						description: model.description || `${model.vendor} - ${model.family}`,
						speed: this.getModelSpeed(model.id),
						quality: this.getModelQuality(model.id),
						recommended: this.isRecommendedModel(model.id),
						available: true
					}));
				} else {
					// GitHub Copilot aktif ama model bulunamadı - yine de seçilebilir olsun
					models.copilot = await this.getDefaultCopilotModels(true);
				}
			} else {
				// GitHub Copilot aktif değil - yine de seçilebilir olsun (kullanıcı sonra yükleyebilir)
				models.copilot = await this.getDefaultCopilotModels(true);
			}
		} catch (error) {
			logger.error("Sihirbaz için Copilot modelleri yüklenemedi:", error);
			models.copilot = await this.getDefaultCopilotModels(true);
		}

		// Ollama models - dinamik olarak API'den yükle
		try {
			const ollamaModels = await this.getAvailableOllamaModels();
			models.ollama = ollamaModels;
		} catch (error) {
			logger.warn("Ollama modelleri yüklenemedi, varsayılan modeller kullanılıyor:", error);
			models.ollama = await this.getDefaultOllamaModels();
		}

		models.all = [...models.gemini, ...models.copilot, ...models.ollama];

		logger.info("Sihirbaz modelleri yüklendi:", {
			gemini: models.gemini.length,
			copilot: models.copilot.length,
			total: models.all.length
		});

		return models;
	}

	private async getAvailableGeminiModels(): Promise<Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean }>> {
		const { LocalizationManager } = await import("./utils/localizationManager");
		const localization = LocalizationManager.getInstance();

		// Gemini API'den modelleri doğrudan çek
		try {
			// Doğrudan GeminiProvider instance'ı oluştur (mevcut provider ne olursa olsun)
			const geminiProvider = new GeminiProvider();
			const isConfigured = await geminiProvider.isApiKeyConfigured();

			if (isConfigured) {
				logger.info("Gemini API anahtarı mevcut, modeller API'den çekiliyor...");
				const availableModels = await geminiProvider.getAvailableModels();

				if (availableModels && availableModels.length > 0) {
					logger.info(`Gemini API'den ${availableModels.length} model çekildi`);
					return availableModels.map((model: any) => ({
						id: model.id || model.name,
						name: model.name || this.formatGeminiModelName(model.id),
						description: model.description || localization.getString(`gemini.model.${model.id?.replace("models/", "").replace("-", ".")}.description`) || "Google Gemini model",
						speed: model.speed || this.getModelSpeed(model.id),
						quality: model.quality || this.getModelQuality(model.id),
						recommended: model.recommended || this.isRecommendedModel(model.id),
						inputTokenLimit: model.inputTokenLimit,
						outputTokenLimit: model.outputTokenLimit
					}));
				}
			} else {
				logger.info("Gemini API anahtarı yapılandırılmamış, varsayılan modeller kullanılacak");
			}
		} catch (error) {
			logger.warn("Gemini API modelleri yüklenemedi:", error);
		}

		// Varsayılan modelleri döndür
		return await this.getDefaultGeminiModels();
	}

	private async getDefaultGeminiModels(): Promise<Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean }>> {
		const { LocalizationManager } = await import("./utils/localizationManager");
		const localization = LocalizationManager.getInstance();

		return [
			// Gemini 3 Series (Latest)
			{
				id: "gemini-3-flash",
				name: "Gemini 3 Flash",
				description: localization.getString("gemini.model.gemini.3.flash.description"),
				speed: "fast",
				quality: "very-high",
				recommended: true
			},
			{
				id: "gemini-3-pro",
				name: "Gemini 3 Pro",
				description: localization.getString("gemini.model.gemini.3.pro.description"),
				speed: "medium",
				quality: "very-high"
			},
			// Gemini 2.5 Series
			{
				id: "gemini-2.5-flash",
				name: "Gemini 2.5 Flash",
				description: localization.getString("gemini.model.gemini.2.5.flash.description"),
				speed: "fast",
				quality: "very-high"
			},
			{
				id: "gemini-2.5-pro",
				name: "Gemini 2.5 Pro",
				description: localization.getString("gemini.model.gemini.2.5.pro.description"),
				speed: "medium",
				quality: "very-high"
			},
			// Gemini 2 Series
			{
				id: "gemini-2.0-flash",
				name: "Gemini 2.0 Flash",
				description: localization.getString("gemini.model.gemini.2.0.flash.description"),
				speed: "fast",
				quality: "high"
			},
			{
				id: "gemini-1.5-flash",
				name: "Gemini 1.5 Flash",
				description: localization.getString("gemini.model.gemini.1.5.flash.description"),
				speed: "fast",
				quality: "high"
			},
			{
				id: "gemini-1.5-pro",
				name: "Gemini 1.5 Pro",
				description: localization.getString("gemini.model.gemini.1.5.pro.description"),
				speed: "medium",
				quality: "very-high"
			}
		];
	}

	private formatGeminiModelName(modelId: string): string {
		// models/gemini-1.5-flash -> Gemini 1.5 Flash
		return modelId
			.replace("models/", "")
			.replace("gemini-", "Gemini ")
			.replace(/-/g, " ")
			.replace(/\b\w/g, l => l.toUpperCase());
	}

	private async checkCopilotStatus(): Promise<{ available: boolean, reason?: string }> {
		try {
			// GitHub Copilot uzantısının yüklü ve aktif olup olmadığını kontrol et
			const copilotExtension = vscode.extensions.getExtension("GitHub.copilot");

			if (!copilotExtension) {
				return { available: false, reason: "GitHub Copilot extension not installed" };
			}

			if (!copilotExtension.isActive) {
				await copilotExtension.activate();
			}

			// VS Code Language Models API ile Copilot modellerini kontrol et
			try {
				const models = await vscode.lm.selectChatModels();
				const copilotModels = models.filter(model => {
					const vendor = (model.vendor || "").toLowerCase();
					const family = (model.family || "").toLowerCase();
					const id = (model.id || "").toLowerCase();

					return vendor.includes("copilot") ||
						id.includes("copilot") ||
						family.includes("gpt") ||
						family.includes("claude") ||
						family.includes("o1") ||
						family.includes("o3");
				});

				if (copilotModels.length > 0) {
					return { available: true };
				} else {
					return { available: false, reason: "No Copilot models available - subscription may be inactive" };
				}
			} catch (error) {
				return { available: false, reason: "Cannot access Copilot models - authentication may be required" };
			}
		} catch (error) {
			logger.error("Copilot status check error:", error);
			return { available: false, reason: `Error checking Copilot status: ${error}` };
		}
	}

	private getModelSpeed(modelId: string): string {
		const fastModels = ["mini", "haiku", "flash", "3.5-turbo"];
		const slowModels = ["opus", "pro"];

		const lowerModelId = modelId.toLowerCase();

		if (fastModels.some(fast => lowerModelId.includes(fast))) {
			return "fast";
		} else if (slowModels.some(slow => lowerModelId.includes(slow))) {
			return "slow";
		}
		return "medium";
	}

	private getModelQuality(modelId: string): string {
		const veryHighQuality = ["4o", "opus", "pro", "3.5-sonnet"];
		const highQuality = ["4", "sonnet", "flash"];

		const lowerModelId = modelId.toLowerCase();

		if (veryHighQuality.some(high => lowerModelId.includes(high))) {
			return "very-high";
		} else if (highQuality.some(high => lowerModelId.includes(high))) {
			return "high";
		}
		return "medium";
	}

	private isRecommendedModel(modelId: string): boolean {
		const recommendedModels = [
			// Latest models
			"gpt-5.2", "gpt-5.2-codex",
			"gpt-5.1", "gpt-5", "gpt-5-mini",
			"gemini-3-flash", "gemini-3-pro",
			"claude-4.5", "claude-4.5-sonnet", "claude-4.5-haiku",
			"o3", "o3-mini", "o4-mini",
			// Current top models
			"gemini-2.5-flash", "gemini-2.5-pro",
			"claude-sonnet-4", "claude-4",
			"gpt-4.1", "gpt-4o",
			"claude-3.5-sonnet"
		];
		const lowerModelId = modelId.toLowerCase();

		return recommendedModels.some(recommended =>
			lowerModelId.includes(recommended.toLowerCase())
		);
	}

	private async getDefaultCopilotModels(available: boolean): Promise<Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean, available: boolean }>> {
		const localization = (await import("./utils/localizationManager")).LocalizationManager.getInstance();

		return [
			// GPT-5.2 Series (Production Ready)
			{
				id: "gpt-5.2-codex",
				name: "GPT-5.2 Codex",
				description: localization.getString("copilot.model.gpt.5.2.codex.description"),
				speed: "fast",
				quality: "very-high",
				recommended: true,
				available
			},
			{
				id: "gpt-5.2",
				name: "GPT-5.2",
				description: localization.getString("copilot.model.gpt.5.2.description"),
				speed: "medium",
				quality: "very-high",
				available
			},
			// GPT-5 Series
			{
				id: "gpt-5",
				name: "GPT-5",
				description: localization.getString("copilot.model.gpt.5.description"),
				speed: "medium",
				quality: "very-high",
				available
			},
			{
				id: "gpt-5-mini",
				name: "GPT-5 Mini",
				description: localization.getString("copilot.model.gpt.5.mini.description"),
				speed: "fast",
				quality: "very-high",
				available
			},
			// Claude 4.5 Series (Latest)
			{
				id: "claude-4.5-sonnet",
				name: "Claude 4.5 Sonnet",
				description: localization.getString("copilot.model.claude.4.5.sonnet.description"),
				speed: "medium",
				quality: "very-high",
				recommended: true,
				available
			},
			{
				id: "claude-4.5-haiku",
				name: "Claude 4.5 Haiku",
				description: localization.getString("copilot.model.claude.haiku.4.5.description"),
				speed: "fast",
				quality: "very-high",
				available
			},
			// Claude 4 Series
			{
				id: "claude-sonnet-4-20250514",
				name: "Claude Sonnet 4",
				description: localization.getString("copilot.model.claude.4.sonnet.description"),
				speed: "medium",
				quality: "very-high",
				available
			},
			// o-Series (Reasoning Models)
			{
				id: "o3",
				name: "o3",
				description: localization.getString("copilot.model.o3.description"),
				speed: "slow",
				quality: "very-high",
				available
			},
			{
				id: "o3-mini",
				name: "o3-mini",
				description: localization.getString("copilot.model.o3.mini.description"),
				speed: "fast",
				quality: "very-high",
				available
			},
			{
				id: "o4-mini",
				name: "o4-mini",
				description: localization.getString("copilot.model.o4.mini.description"),
				speed: "fast",
				quality: "very-high",
				available
			},
			// GPT-4 Series
			{
				id: "gpt-4.1",
				name: "GPT-4.1",
				description: localization.getString("copilot.model.gpt.4.1.description"),
				speed: "medium",
				quality: "very-high",
				available
			},
			{
				id: "gpt-4o",
				name: "GPT-4o",
				description: localization.getString("copilot.model.gpt.4o.description"),
				speed: "medium",
				quality: "very-high",
				available
			},
			{
				id: "gpt-4o-mini",
				name: "GPT-4o-mini",
				description: localization.getString("copilot.model.gpt.4o.mini.description"),
				speed: "fast",
				quality: "high",
				available
			},
			// Claude 3.5 Series
			{
				id: "claude-3.5-sonnet",
				name: "Claude 3.5 Sonnet",
				description: localization.getString("copilot.model.claude.3.5.sonnet.description"),
				speed: "medium",
				quality: "very-high",
				available
			},
			{
				id: "claude-3.5-haiku",
				name: "Claude 3.5 Haiku",
				description: localization.getString("copilot.model.claude.3.5.haiku.description"),
				speed: "fast",
				quality: "high",
				available
			}
		];
	}

	private async setupProvider(provider: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		aiConfig.provider = provider;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

		await this.aiProviderManager.setProvider(provider);

		// Önce kalıcı ayarlara kaydet
		if (this.persistentSettingsManager) {
			await this.persistentSettingsManager.persistSetting("ai", aiConfig);
		}

		// JSON'a kaydet
		if (this.jsonManager) {
			await this.jsonManager.updateWizardStep("provider", {
				value: provider,
				completed: true
			});

			// VS Code configuration'dan JSON'a senkronize et
			await this.jsonManager.syncFromVSCodeConfiguration();
		}

		const { LocalizationManager } = await import("./utils/localizationManager");
		const localization = LocalizationManager.getInstance();
		const currentLang = localization.getCurrentLanguage();
		const isEnglish = currentLang === "en";

		let providerName = "Google Gemini";
		if (provider === "vscode-copilot") {
			providerName = "GitHub Copilot";
		} else if (provider === "ollama") {
			providerName = "Ollama (Local)";
		}

		const message = isEnglish
			? `✅ AI Provider set: ${providerName}`
			: `✅ AI Sağlayıcı ayarlandı: ${providerName}`;

		vscode.window.showInformationMessage(message);
	}

	private async setupModel(modelId: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");

		// Model ayarını hem ai config'e hem de aiModels config'e kaydet (geriye dönük uyum için)
		const aiConfig = config.get("ai") as any || {};
		aiConfig.selectedModel = modelId;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

		const aiModelConfig = config.get("aiModels") as any || {};
		aiModelConfig.selectedModel = modelId;
		await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);

		await this.aiProviderManager.setModel(modelId);

		// Önce kalıcı ayarlara kaydet
		if (this.persistentSettingsManager) {
			await this.persistentSettingsManager.persistSetting("ai", aiConfig);
			await this.persistentSettingsManager.persistSetting("aiModels", aiModelConfig);
		}

		// JSON'a kaydet
		if (this.jsonManager) {
			await this.jsonManager.updateWizardStep("model", {
				value: modelId,
				completed: true
			});

			// VS Code configuration'dan JSON'a senkronize et
			await this.jsonManager.syncFromVSCodeConfiguration();
		}

		const { LocalizationManager } = await import("./utils/localizationManager");
		const localization = LocalizationManager.getInstance();
		const currentLang = localization.getCurrentLanguage();
		const isEnglish = currentLang === "en";

		const message = isEnglish
			? `✅ AI Model set: ${modelId}`
			: `✅ AI Modeli ayarlandı: ${modelId}`;

		vscode.window.showInformationMessage(message);
	}

	private async setupApiKey(apiKey: string): Promise<boolean> {
		if (!apiKey || apiKey.trim().length === 0) {
			return false;
		}

		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		aiConfig.apiKey = apiKey;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

		// Önce kalıcı ayarlara kaydet
		if (this.persistentSettingsManager) {
			await this.persistentSettingsManager.persistSetting("ai", aiConfig);
		}

		// JSON'a kaydet (API key'i kaydetmiyoruz, sadece varlığını)
		if (this.jsonManager) {
			await this.jsonManager.updateWizardStep("apiKey", {
				hasValue: true,
				completed: true
			});

			// VS Code configuration'dan JSON'a senkronize et
			await this.jsonManager.syncFromVSCodeConfiguration();
		}

		const { LocalizationManager } = await import("./utils/localizationManager");
		const localization = LocalizationManager.getInstance();
		const currentLang = localization.getCurrentLanguage();
		const isEnglish = currentLang === "en";

		const message = isEnglish
			? "✅ API Key saved successfully"
			: "✅ API Anahtarı başarıyla kaydedildi";

		vscode.window.showInformationMessage(message);
		return true;
	}

	private async setupWcagLevel(level: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		await config.update("wcagLevel", level, vscode.ConfigurationTarget.Global);

		// Önce kalıcı ayarlara kaydet
		if (this.persistentSettingsManager) {
			await this.persistentSettingsManager.persistSetting("wcagLevel", level);
		}

		// JSON'a kaydet
		if (this.jsonManager) {
			await this.jsonManager.updateWizardStep("wcagLevel", {
				value: level,
				completed: true
			});

			// VS Code configuration'dan JSON'a senkronize et
			await this.jsonManager.syncFromVSCodeConfiguration();
		}
	}

	private async setupLanguage(language: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		await config.update("language", language, vscode.ConfigurationTarget.Global);

		// Önce kalıcı ayarlara kaydet
		if (this.persistentSettingsManager) {
			await this.persistentSettingsManager.persistSetting("language", language);
		}

		// JSON'a kaydet
		if (this.jsonManager) {
			await this.jsonManager.updateWizardStep("language", {
				value: language,
				completed: true
			});

			// VS Code configuration'dan JSON'a senkronize et
			await this.jsonManager.syncFromVSCodeConfiguration();
		}
	}

	private async setupJiraConfig(jiraConfig: {
		customPrompt?: string;
		useCustomPrompt?: boolean;
		defaultPriority?: string;
		defaultComponent?: string;
		includeCodeExamples?: boolean;
		includeTestingSteps?: boolean;
	}): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		await config.update("jira", jiraConfig, vscode.ConfigurationTarget.Global);

		// Önce kalıcı ayarlara kaydet
		if (this.persistentSettingsManager) {
			await this.persistentSettingsManager.persistSetting("jira", jiraConfig);
		}

		// JSON'a kaydet
		if (this.jsonManager) {
			await this.jsonManager.updateWizardStep("jiraConfig", {
				config: jiraConfig,
				completed: true
			});

			// VS Code configuration'dan JSON'a senkronize et
			await this.jsonManager.syncFromVSCodeConfiguration();
		}
	}

	private async finishWizard(): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");

			// Wizard tamamlandığını işaretle
			await config.update("wizardCompleted", true, vscode.ConfigurationTarget.Global);

			// Mevcut ayarları doğrula ve tutarlı hale getir
			const aiConfig = config.get("ai") as any || {};
			const aiModelConfig = config.get("aiModels") as any || {};

			// Model ayarı tutarlılığını sağla
			if (aiConfig.selectedModel && !aiModelConfig.selectedModel) {
				aiModelConfig.selectedModel = aiConfig.selectedModel;
				await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);
			} else if (!aiConfig.selectedModel && aiModelConfig.selectedModel) {
				aiConfig.selectedModel = aiModelConfig.selectedModel;
				await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
			}

			// AI Provider ayarlarını bir kez daha yükle
			if (aiConfig.provider) {
				await this.aiProviderManager.setProvider(aiConfig.provider);
			}
			if (aiConfig.selectedModel || aiModelConfig.selectedModel) {
				await this.aiProviderManager.setModel(aiConfig.selectedModel || aiModelConfig.selectedModel);
			}

			// Sihirbazda yapılan ayarları kalıcı storage'a kaydet
			if (this.persistentSettingsManager) {
				try {
					// Wizard completion'ı önce kalıcı storage'a kaydet
					await this.persistentSettingsManager.persistSetting("wizardCompleted", true);

					// Tüm wizard ayarlarını tek seferde kalıcı storage'a kaydet
					const wizardSettings = {
						ai: aiConfig,
						aiModels: aiModelConfig,
						language: config.get("language", "en"),
						wcagLevel: config.get("wcagLevel", "AA"),
						jira: config.get("jira", {}),
						autoApply: config.get("autoApply", false),
						includeComments: config.get("includeComments", true),
						enableStatistics: config.get("enableStatistics", true),
						interfacePreferences: config.get("interfacePreferences", {}),
						wizardCompleted: true
					};

					// Her ayarı ayrı ayrı kalıcı storage'a kaydet
					for (const [key, value] of Object.entries(wizardSettings)) {
						await this.persistentSettingsManager.persistSetting(key, value);
					}

					// Mevcut VS Code configuration'ı da kalıcı storage'a persist et
					await this.persistentSettingsManager.persistCurrentConfiguration();

					logger.info("🎯 Sihirbaz ayarları kalıcı storage'a kaydedildi");
				} catch (persistError) {
					logger.error("❌ Sihirbaz ayarları kalıcı storage'a kaydedilemedi:", persistError);
					// Hata olsa bile wizard'ı bitir, sadece log'la
				}
			} else {
				logger.warn("⚠️ PersistentSettingsManager bulunamadı, sihirbaz ayarları sadece VS Code configuration'a kaydedildi");
			}

			// JSON Manager'a da wizard tamamlandığını kaydet
			if (this.jsonManager) {
				try {
					// Wizard'ı tamamlandı olarak işaretle
					await this.jsonManager.updateWizardSettings({
						completed: true,
						completedAt: new Date().toISOString()
					});

					// VS Code configuration'dan JSON'a son kez senkronize et
					await this.jsonManager.syncFromVSCodeConfiguration();

					logger.info("🎯 Sihirbaz tamamlandı ve JSON dosyasına kaydedildi");
				} catch (jsonError) {
					logger.error("❌ Sihirbaz JSON'a kaydedilemedi:", jsonError);
					// Hata olsa bile wizard'ı bitir, sadece log'la
				}
			}

			const { LocalizationManager } = await import("./utils/localizationManager");
			const localization = LocalizationManager.getInstance();
			const currentLang = localization.getCurrentLanguage();
			const isEnglish = currentLang === "en";

			const message = isEnglish
				? "🎉 AccessiMind setup completed! You can now start making accessibility improvements."
				: "🎉 AccessiMind kurulumu tamamlandı! Artık kod iyileştirmelerine başlayabilirsiniz.";

			const actionText = isEnglish ? "Try Now" : "Hemen Dene";

			vscode.window.showInformationMessage(message, actionText).then(action => {
				if (action === actionText) {
					vscode.commands.executeCommand("wcagEnhancer.improveCurrentSelected");
				}
			});

			logger.info("🎯 AccessiMind wizard completed successfully with persistent settings");
		} catch (error) {
			logger.error("Wizard finish error:", error);
			vscode.window.showErrorMessage("Ayar kaydetme sırasında hata oluştu. Lütfen ayarları manuel olarak kontrol edin.");
		}
	}

	private async testAIConnection(): Promise<{ success: boolean, message: string }> {
		try {
			const { AITestUtils } = await import("./utils/aiTestUtils");
			const { LocalizationManager } = await import("./utils/localizationManager");
			const localization = LocalizationManager.getInstance();
			const currentLang = localization.getCurrentLanguage();
			const isEnglish = currentLang === "en";

			const aiTestUtils = AITestUtils.getInstance();
			const result = await aiTestUtils.testAIProvider();

			const successMessage = isEnglish ? "AI connection successful!" : "AI bağlantısı başarılı!";
			const failMessage = isEnglish ? "Connection failed" : "Bağlantı başarısız";
			const _errorPrefix = isEnglish ? "Test error: " : "Test hatası: ";
			const _unknownError = isEnglish ? "Unknown error" : "Bilinmeyen hata";

			return {
				success: result.success,
				message: result.success ? successMessage : (result.error || failMessage)
			};
		} catch (error) {
			const { LocalizationManager } = await import("./utils/localizationManager");
			const localization = LocalizationManager.getInstance();
			const currentLang = localization.getCurrentLanguage();
			const isEnglish = currentLang === "en";

			const _errorPrefix = isEnglish ? "Test error: " : "Test hatası: ";
			const _unknownError = isEnglish ? "Unknown error" : "Bilinmeyen hata";

			return {
				success: false,
				message: `${_errorPrefix}${error instanceof Error ? error.message : _unknownError}`
			};
		}
	}

	private async refreshAvailableModels(): Promise<any> {
		try {
			logger.info("Modeller yeniden yükleniyor...");

			// Copilot modellerini yenile
			await this.aiProviderManager.refreshCopilotModels();

			// Modelleri yeniden yükle
			const refreshedModels = await this.getAvailableModelsForWizard();

			logger.info("Modeller başarıyla yenilendi:", {
				gemini: refreshedModels.gemini.length,
				copilot: refreshedModels.copilot.length
			});

			return refreshedModels;
		} catch (error) {
			logger.error("Model yenileme hatası:", error);
			throw error;
		}
	}


	/**
	 * Generates the HTML for the modern setup wizard.
	 * This wizard allows the user to select an AI provider (Gemini or Copilot),
	 * then dynamically fetches available models from the API, and ensures that
	 * all generated outputs are fully WCAG and ARIA compliant.
	 *
	 * @param availableModels - The models fetched dynamically from the provider APIs.
	 * @returns The HTML string for the wizard UI.
	 */
	private getModernWizardHTML(availableModels: any): string {
		// Use the localization manager for multi-language support
		const localization = LocalizationManager.getInstance();
		localization.detectLanguage();

		const currentLang = localization.getCurrentLanguage();
		const isEnglish = currentLang === "en";
		const langCode = currentLang;

		return `
<!DOCTYPE html>
<html lang="${langCode}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${isEnglish ? "AccessiMind Setup Wizard" : "AccessiMind Kurulum Sihirbazı"}</title>
	<style>
		:root {
			--primary-color: #007acc;
			--secondary-color: #e7f3ff;
			--success-color: #28a745;
			--warning-color: #ffc107;
			--danger-color: #dc3545;
			--text-color: var(--vscode-foreground);
			--bg-color: var(--vscode-editor-background);
			--border-color: var(--vscode-panel-border);
			--card-bg: var(--vscode-input-background);
		}

		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: var(--vscode-font-family);
			background: var(--bg-color);
			color: var(--text-color);
			line-height: 1.6;
			overflow-x: hidden;
		}

		.wizard-container {
			max-width: 800px;
			margin: 0 auto;
			padding: 20px;
			min-height: 100vh;
		}

		.wizard-header {
			text-align: center;
			margin-bottom: 40px;
			padding: 30px 0;
			background: linear-gradient(135deg, var(--primary-color), #005a9e);
			border-radius: 12px;
			color: white;
		}

		.wizard-header h1 {
			font-size: 2.5rem;
			margin-bottom: 10px;
			font-weight: 600;
		}

		.wizard-header p {
			font-size: 1.1rem;
			opacity: 0.9;
		}

		.step-indicator {
			display: flex;
			justify-content: center;
			margin-bottom: 40px;
			gap: 10px;
		}

		.step {
			width: 40px;
			height: 40px;
			border-radius: 50%;
			background: var(--border-color);
			display: flex;
			align-items: center;
			justify-content: center;
			font-weight: bold;
			transition: all 0.3s ease;
			position: relative;
		}

		.step.active {
			background: var(--primary-color);
			color: white;
			box-shadow: 0 0 20px rgba(0, 122, 204, 0.5);
		}

		.step.completed {
			background: var(--success-color);
			color: white;
		}

		.step-content {
			display: none;
			background: var(--card-bg);
			border-radius: 12px;
			padding: 30px;
			margin-bottom: 20px;
			border: 1px solid var(--border-color);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		}

		.step-content.active {
			display: block;
			animation: fadeIn 0.5s ease-in-out;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(20px); }
			to { opacity: 1; transform: translateY(0); }
		}

		.step-title {
			font-size: 1.8rem;
			margin-bottom: 15px;
			color: var(--primary-color);
			font-weight: 600;
		}

		.step-description {
			font-size: 1rem;
			margin-bottom: 25px;
			color: var(--vscode-descriptionForeground);
		}

		.provider-selection {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 20px;
			margin-bottom: 30px;
		}

		.provider-card {
			background: var(--card-bg);
			border: 2px solid var(--border-color);
			border-radius: 12px;
			padding: 25px;
			cursor: pointer;
			transition: all 0.3s ease;
			text-align: center;
			position: relative;
		}

		.provider-card:hover {
			border-color: var(--primary-color);
			transform: translateY(-2px);
			box-shadow: 0 8px 25px rgba(0, 122, 204, 0.15);
		}

		.provider-card.selected {
			border-color: var(--primary-color);
			background: var(--secondary-color);
		}

		.provider-icon {
			font-size: 3rem;
			margin-bottom: 15px;
		}

		.provider-name {
			font-size: 1.4rem;
			font-weight: 600;
			margin-bottom: 10px;
		}

		.provider-description {
			font-size: 0.9rem;
			color: var(--vscode-descriptionForeground);
		}

		.model-selection {
			margin-bottom: 30px;
		}

		.model-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 15px;
			margin-bottom: 20px;
		}

		.model-card {
			background: var(--card-bg);
			border: 2px solid var(--border-color);
			border-radius: 8px;
			padding: 20px;
			cursor: pointer;
			transition: all 0.3s ease;
			position: relative;
		}

		.model-card:hover {
			border-color: var(--primary-color);
			transform: translateY(-1px);
		}

		.model-card.selected {
			border-color: var(--primary-color);
			background: var(--vscode-button-secondaryBackground, var(--secondary-color));
		}

		.selection-indicator {
			position: absolute;
			top: 10px;
			right: 10px;
			width: 24px;
			height: 24px;
			background: var(--success-color);
			color: white;
			border-radius: 50%;
			display: none;
			align-items: center;
			justify-content: center;
			font-size: 14px;
			font-weight: bold;
			box-shadow: 0 2px 5px rgba(0,0,0,0.2);
			z-index: 2;
		}

		.selected .selection-indicator {
			display: flex;
		}

		.provider-card.selected .selection-indicator {
			top: 10px;
			right: 10px;
		}

		.model-card.recommended::before {
			content: "✨ ${localization.getString("wizard.model.recommended") || "Recommended"}";
			position: absolute;
			top: -10px;
			right: 10px;
			background: var(--success-color);
			color: white;
			padding: 4px 8px;
			border-radius: 12px;
			font-size: 0.7rem;
			font-weight: bold;
		}

		.model-name {
			font-size: 1.2rem;
			font-weight: 600;
			margin-bottom: 8px;
		}

		.model-description {
			font-size: 0.9rem;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 10px;
		}

		.model-badges {
			display: flex;
			gap: 8px;
		}

		.badge {
			padding: 4px 8px;
			border-radius: 12px;
			font-size: 0.7rem;
			font-weight: bold;
		}

		.badge.speed-fast { background: var(--success-color); color: white; }
		.badge.speed-medium { background: var(--warning-color); color: black; }
		.badge.quality-high { background: var(--primary-color); color: white; }
		.badge.quality-very-high { background: var(--success-color); color: white; }
		.badge.unavailable { background: var(--danger-color); color: white; }

		.model-card.unavailable {
			opacity: 0.6;
			cursor: not-allowed;
		}

		.model-card.unavailable:hover {
			transform: none;
			border-color: var(--border-color);
		}

		.form-group {
			margin-bottom: 20px;
		}

		.form-label {
			display: block;
			margin-bottom: 8px;
			font-weight: 600;
		}

		.form-input {
			width: 100%;
			padding: 12px;
			border: 2px solid var(--border-color);
			border-radius: 6px;
			background: var(--card-bg);
			color: var(--text-color);
			font-size: 1rem;
			transition: border-color 0.3s ease;
		}

		.form-input:focus {
			outline: none;
			border-color: var(--primary-color);
			box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
		}

		.form-select {
			width: 100%;
			padding: 12px;
			border: 2px solid var(--border-color);
			border-radius: 6px;
			background: var(--card-bg);
			color: var(--text-color);
			font-size: 1rem;
		}

		.button-group {
			display: flex;
			gap: 15px;
			justify-content: flex-end;
			margin-top: 30px;
		}

		.btn {
			padding: 12px 24px;
			border: none;
			border-radius: 6px;
			font-size: 1rem;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s ease;
			text-decoration: none;
			display: inline-flex;
			align-items: center;
			gap: 8px;
		}

		.btn-primary {
			background: var(--primary-color);
			color: white;
		}

		.btn-primary:hover {
			background: #005a9e;
			transform: translateY(-1px);
		}

		.btn-secondary {
			background: var(--border-color);
			color: var(--text-color);
		}

		.btn-secondary:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.btn-success {
			background: var(--success-color);
			color: white;
		}

		.btn-success:hover {
			background: #218838;
		}

		.alert {
			padding: 15px;
			border-radius: 6px;
			margin-bottom: 20px;
			border-left: 4px solid;
		}

		.alert-success {
			background: rgba(40, 167, 69, 0.1);
			border-color: var(--success-color);
			color: var(--success-color);
		}

		.alert-warning {
			background: rgba(255, 193, 7, 0.1);
			border-color: var(--warning-color);
			color: var(--warning-color);
		}

		.alert-danger {
			background: rgba(220, 53, 69, 0.1);
			border-color: var(--danger-color);
			color: var(--danger-color);
		}

		.test-result {
			margin-top: 20px;
			padding: 15px;
			border-radius: 6px;
			display: none;
		}

		.loading {
			display: inline-block;
			width: 20px;
			height: 20px;
			border: 3px solid rgba(255, 255, 255, 0.3);
			border-radius: 50%;
			border-top-color: #fff;
			animation: spin 1s ease-in-out infinite;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		.help-section {
			background: var(--secondary-color);
			border-radius: 8px;
			padding: 20px;
			margin-top: 30px;
		}

		.help-title {
			font-size: 1.2rem;
			font-weight: 600;
			margin-bottom: 15px;
			color: var(--primary-color);
		}

		.help-links {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 15px;
		}

		.help-link {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px;
			background: var(--card-bg);
			border-radius: 6px;
			text-decoration: none;
			color: var(--text-color);
			transition: background-color 0.3s ease;
		}

		.help-link:hover {
			background: var(--vscode-list-hoverBackground);
		}

		@media (max-width: 768px) {
			.provider-selection {
				grid-template-columns: 1fr;
			}
			
			.model-grid {
				grid-template-columns: 1fr;
			}
			
			.button-group {
				flex-direction: column;
			}
			
			.help-links {
				grid-template-columns: 1fr;
			}
		}

		.accessibility-features {
			margin-top: 20px;
		}

		.screen-reader-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		/* Focus indicators for better keyboard navigation */
		.provider-card:focus, .model-card:focus, .step:focus {
			outline: 3px solid var(--vscode-focusBorder);
			outline-offset: 2px;
			box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.3);
		}

		/* Clickable steps styling */
		.step.clickable {
			cursor: pointer;
			transition: all 0.3s ease;
		}

		.step.clickable:hover {
			transform: scale(1.1);
			box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
		}

		.step.clickable.completed:hover {
			box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
		}

		.step.clickable:disabled {
			cursor: not-allowed;
			opacity: 0.6;
		}

		.btn:focus {
			outline: 3px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}

		.form-input:focus, .form-select:focus {
			outline: 3px solid var(--vscode-focusBorder);
			outline-offset: 1px;
			border-color: var(--vscode-focusBorder);
		}

		/* High contrast mode support */
		@media (prefers-contrast: high) {
			.provider-card, .model-card {
				border-width: 3px;
			}
			
			.btn {
				border: 2px solid currentColor;
			}
			
			.step {
				border: 2px solid currentColor;
			}
		}

		/* Reduced motion support */
		@media (prefers-reduced-motion: reduce) {
			*, *::before, *::after {
				animation-duration: 0.01ms !important;
				animation-iteration-count: 1 !important;
				transition-duration: 0.01ms !important;
			}
		}

		/* Enhanced touch targets for mobile */
		@media (pointer: coarse) {
			.provider-card, .model-card, .btn {
				min-height: 44px;
				min-width: 44px;
			}
		}

		/* Color blind friendly indicators */
		.badge.speed-fast::before { content: "⚡ "; }
		.badge.speed-medium::before { content: "⏳ "; }
		.badge.speed-slow::before { content: "🐌 "; }
		.badge.quality-high::before { content: "⭐ "; }
		.badge.quality-very-high::before { content: "🌟 "; }
		.badge.quality-medium::before { content: "📊 "; }

		/* Skip links */
		.skip-link {
			position: absolute;
			top: -40px;
			left: 6px;
			background: var(--vscode-editor-background);
			color: var(--vscode-foreground);
			padding: 8px;
			text-decoration: none;
			border-radius: 4px;
			border: 2px solid var(--vscode-focusBorder);
		}

		.visually-hidden {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		/* Update card styles to respond to radio input state */
		input[type="radio"]:checked + .provider-card,
		input[type="radio"]:checked + .model-card {
			border-color: var(--primary-color);
			background: var(--secondary-color);
			box-shadow: 0 0 0 2px var(--primary-color);
		}

		/* Focus styles via the input */
		input[type="radio"]:focus + .provider-card,
		input[type="radio"]:focus + .model-card {
			outline: 3px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
		
		/* Remove old focus styles from cards since input handles it */
		.provider-card:focus, .model-card:focus {
			outline: none;
		}
		
		/* Ensure label acts as container */
		.provider-card, .model-card {
			display: block; /* Make label behave like the div */
			/* ... other existing styles ... */
		}

		/* Selection indicator visibility */
		input[type="radio"]:checked + .provider-card .selection-indicator,
		input[type="radio"]:checked + .model-card .selection-indicator {
			display: flex;
		}

	
	/* CRITICAL FIX: Button clickability */
	button.provider-card,
	button.model-card {
		pointer-events: auto !important;
		cursor: pointer !important;
		position: relative;
		z-index: 10;
		border: none;
		background: none;
		text-align: left;
		width: 100%;
		font-family: inherit;
		font-size: inherit;
		min-height: 44px;
		padding: 16px;
	}
	
	button.provider-card *,
	button.model-card * {
		pointer-events: none;
	}
	
	button[aria-pressed="true"].provider-card,
	button[aria-pressed="true"].model-card {
		border-color: var(--primary-color);
		background: var(--secondary-color);
		box-shadow: 0 0 0 2px var(--primary-color);
	}
	
	button.provider-card:focus,
	button.model-card:focus {
		outline: 3px solid var(--vscode-focusBorder);
		outline-offset: 2px;
	}
	
	button[aria-pressed="true"] .selection-indicator {
		display: flex !important;
	}

		.skip-link:focus {
			top: 6px;
		}
	</style>
</head>
<body>
	<a href="#main-content" class="skip-link">Skip to main content</a>
	<div id="main-content" class="wizard-container" role="main" aria-labelledby="wizard-title">
		<header class="wizard-header">
			<h1 id="wizard-title">♿ ${localization.getString("wizard.title")}</h1>
			<p role="doc-subtitle">${localization.getString("wizard.welcome.description")}</p>
		</header>

		<nav class="step-indicator" role="navigation" aria-label="${localization.getString("wizard.steps.title") || "Setup steps"}" aria-describedby="step-help">
			<div class="step active clickable" data-step="1" role="button" tabindex="0" aria-label="${localization.getString("wizard.step1.title") || "Step 1: AI Provider Selection"}" aria-current="step">1</div>
			<div class="step clickable" data-step="2" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step2.title") || "Step 2: Model Selection"}">2</div>
			<div class="step clickable" data-step="3" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step3.title") || "Step 3: Interface & Language"}">3</div>
			<div class="step clickable" data-step="4" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step4.title") || "Step 4: API Test"}">4</div>
			<div class="step clickable" data-step="5" role="button" tabindex="-1" aria-label="Step 5: Jira Configuration (Optional)">5</div>
			<div class="step clickable" data-step="6" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step5.title") || "Step 6: Complete Setup"}">6</div>
			<div id="step-help" class="screen-reader-only">Click on step numbers to navigate between completed steps</div>
		</nav>

		<!-- Step 1: AI Provider Selection -->
		<section class="step-content active" data-step="1" role="tabpanel" aria-labelledby="step1-title" aria-describedby="step1-desc">
			<h2 id="step1-title" class="step-title">${localization.getString("wizard.provider.title")}</h2>
			<p id="step1-desc" class="step-description">${localization.getString("wizard.provider.description")}</p>
			
			<!-- Accessibility Note: The selected provider and model will be used to generate outputs fully compliant with WCAG and ARIA standards for maximum accessibility. -->
			<div class="alert alert-success" role="status" aria-live="polite" style="margin-bottom:18px;">
				${isEnglish
				? "All outputs generated by the selected provider and model will strictly comply with WCAG and ARIA accessibility standards. This ensures your code is accessible to users with disabilities."
				: "Seçilen sağlayıcı ve model ile üretilen tüm çıktılar WCAG ve ARIA erişilebilirlik standartlarına tam uyumlu olacaktır. Böylece kodunuz tüm engelli kullanıcılar için erişilebilir olur."}
			</div>

			<fieldset class="provider-selection" id="providerSelectionGroup" role="group" aria-label="Select AI Provider">
				<legend class="screen-reader-only">Choose your AI provider for WCAG improvements</legend>
				
				<button type="button" class="provider-card" data-provider="gemini" aria-pressed="false" onclick="selectProvider('gemini', this)">
					<div class="selection-indicator" aria-hidden="true">✓</div>
					<div class="provider-icon" aria-hidden="true">🚀</div>
					<div class="provider-name">${localization.getString("provider.gemini.name")}</div>
					<div id="gemini-desc" class="provider-description">${localization.getString("provider.gemini.description")}</div>
				</button>
				
				<button type="button" class="provider-card" data-provider="vscode-copilot" aria-pressed="false" onclick="selectProvider('vscode-copilot', this)">
					<div class="selection-indicator" aria-hidden="true">✓</div>
					<div class="provider-icon" aria-hidden="true">🤖</div>
					<div class="provider-name">${localization.getString("provider.vscode-copilot.name")}</div>
					<div id="copilot-desc" class="provider-description">${localization.getString("provider.vscode-copilot.description")}</div>
				</button>

				<button type="button" class="provider-card" data-provider="ollama" aria-pressed="false" onclick="selectProvider('ollama', this)">
					<div class="selection-indicator" aria-hidden="true">✓</div>
					<div class="provider-icon" aria-hidden="true">🦙</div>
					<div class="provider-name">Ollama (Local)</div>
					<div id="ollama-desc" class="provider-description">${isEnglish ? "Run open-source models locally on your machine" : "Açık kaynaklı modelleri makinenizde yerel olarak çalıştırın"}</div>
				</button>
			</fieldset>

			<!-- Gemini API Key Input (shown when Gemini is selected) -->
			<div id="geminiApiKeySection" class="api-key-section" style="display: none; margin-top: 20px;">
				<div class="alert alert-info" role="status" style="margin-bottom: 15px;">
					<strong>🔑 ${isEnglish ? "API Key Required" : "API Anahtarı Gerekli"}:</strong>
					${isEnglish
				? "Enter your Gemini API key below. You can get a free key from "
				: "Aşağıya Gemini API anahtarınızı girin. Ücretsiz anahtar için "}
					<a href="#" onclick="openGeminiApiPage(); return false;" style="color: var(--primary-color);">Google AI Studio</a>
				</div>
				<div class="form-group">
					<label class="form-label" for="step1GeminiApiKey">
						${isEnglish ? "Gemini API Key" : "Gemini API Anahtarı"}
					</label>
					<input type="password" 
						id="step1GeminiApiKey" 
						class="form-input" 
						placeholder="AIzaSy..."
						aria-describedby="step1ApiKeyHelp"
						style="width: 100%; padding: 12px; font-size: 14px;">
					<div id="step1ApiKeyHelp" class="form-text">
						${isEnglish ? "Your API key will be stored securely in VS Code settings." : "API anahtarınız VS Code ayarlarında güvenli bir şekilde saklanacaktır."}
					</div>
				</div>
				<button type="button" class="btn btn-secondary" onclick="saveApiKeyFromStep1()" style="margin-top: 10px;">
					💾 ${isEnglish ? "Save API Key" : "API Anahtarını Kaydet"}
				</button>
				<div id="step1ApiKeyStatus" class="api-key-status" style="margin-top: 10px; display: none;"></div>
			</div>

			<!-- Copilot Info (shown when Copilot is selected) -->
			<div id="copilotInfoSection" class="copilot-info-section" style="display: none; margin-top: 20px;">
				<div class="alert alert-success" role="status">
					<strong>✅ ${isEnglish ? "No API Key Required" : "API Anahtarı Gerekmez"}:</strong>
					${isEnglish
				? "GitHub Copilot uses your existing Copilot subscription. Make sure you have an active subscription and the GitHub Copilot extension installed."
				: "GitHub Copilot mevcut Copilot aboneliğinizi kullanır. Aktif bir aboneliğiniz ve GitHub Copilot uzantısının yüklü olduğundan emin olun."}
				</div>
			</div>

			<!-- Ollama URL Input (shown when Ollama is selected) -->
			<div id="ollamaUrlSection" class="ollama-url-section" style="display: none; margin-top: 20px;">
				<div class="alert alert-info" role="status" style="margin-bottom: 15px;">
					<strong>🌐 ${isEnglish ? "Ollama Connection" : "Ollama Bağlantısı"}:</strong>
					${isEnglish
				? "Make sure Ollama is running on your machine. Default URL is http://localhost:11434"
				: "Ollama'nın makinenizde çalıştığından emin olun. Varsayılan URL: http://localhost:11434"}
				</div>
				<div class="form-group">
					<label class="form-label" for="step1OllamaUrl">
						${isEnglish ? "Ollama API URL" : "Ollama API URL'i"}
					</label>
					<input type="text" 
						id="step1OllamaUrl" 
						class="form-input" 
						placeholder="http://localhost:11434"
						value="http://localhost:11434"
						aria-describedby="step1OllamaUrlHelp"
						style="width: 100%; padding: 12px; font-size: 14px;">
					<div id="step1OllamaUrlHelp" class="form-text">
						${isEnglish ? "The URL where your Ollama API is listening." : "Ollama API'nizin dinlediği URL."}
					</div>
				</div>
				<button type="button" class="btn btn-secondary" onclick="saveOllamaUrlFromStep1()" style="margin-top: 10px;">
					🔄 ${isEnglish ? "Fetch Models" : "Modelleri Getir"}
				</button>
				<div id="step1OllamaStatus" class="ollama-status" style="margin-top: 10px; display: none;"></div>
			</div>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-primary" onclick="submitStep(1)" disabled id="submitStep1" aria-describedby="submit-help">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
				<div id="submit-help" class="screen-reader-only">${isEnglish ? "Button will be enabled after selecting a provider" : "Sağlayıcı seçtikten sonra düğme aktif olacak"}</div>
			</div>
		</section>

		<!-- Step 2: Model Selection -->
		<section class="step-content" data-step="2" role="tabpanel" aria-labelledby="step2-title" aria-describedby="step2-desc" aria-hidden="true">
			<h2 id="step2-title" class="step-title">${localization.getString("wizard.model.title")}</h2>
			<p id="step2-desc" class="step-description">${localization.getString("wizard.model.description")}</p>
			
			<!-- Accessibility Note: Model selection directly affects the accessibility quality of generated code. -->
			<div class="alert alert-success" role="status" aria-live="polite" style="margin-bottom:18px;">
				${isEnglish
				? "The selected AI model will generate code and suggestions that are fully WCAG and ARIA compliant, ensuring accessibility for all users."
				: "Seçilen yapay zeka modeli, tüm kullanıcılar için erişilebilirliği garanti altına almak amacıyla WCAG ve ARIA standartlarına tam uyumlu kod ve öneriler üretecektir."}
			</div>

			<div class="model-refresh-section" style="margin-bottom: 20px;">
				<button class="btn btn-secondary" onclick="refreshModels()" id="refreshModelsButton" aria-describedby="refresh-help">
					🔄 ${localization.getString("wizard.model.refresh") || "Refresh Models"}
				</button>
				<div id="refresh-help" class="screen-reader-only">
					${localization.getString("wizard.model.refresh.help") || "Click to reload available models from API"}
				</div>
			</div>
			
			<fieldset class="model-selection" aria-label="Select AI Model">
				<legend class="screen-reader-only">Choose your preferred AI model</legend>
				<div id="geminiModels" class="model-grid" style="display: none;" role="radiogroup" aria-label="Gemini Models">
					${availableModels.gemini.map((model: any) => `
						<div class="model-option-wrapper">
							<input type="radio" name="model" id="model-${model.id}" value="${model.id}" data-provider="gemini" class="visually-hidden" onchange="selectModel(this.value, 'gemini')">
							<label for="model-${model.id}" class="model-card ${model.recommended ? "recommended" : ""}">
								<div class="selection-indicator" aria-hidden="true">✓</div>
								<div class="model-name">${model.name}</div>
								<div id="model-${model.id}-desc" class="model-description">${model.description}</div>
								<div class="model-badges" aria-label="Model characteristics">
									<span class="badge speed-${model.speed}" aria-label="Speed: ${localization.getString("wizard.model.speed." + model.speed) || model.speed}">${localization.getString("wizard.model.speed." + model.speed) || model.speed}</span>
									<span class="badge quality-${model.quality}" aria-label="Quality: ${localization.getString("wizard.model.quality." + model.quality) || model.quality}">${localization.getString("wizard.model.quality." + model.quality) || model.quality}</span>
								</div>
							</label>
						</div>
					`).join("")}
				</div>
				
				<!-- Copilot Models -->
				<div id="copilotModels" class="model-grid" role="radiogroup" aria-label="Select GitHub Copilot Model" style="display: none;">
					${availableModels.copilot.map((model: any) => `
						<div class="model-option-wrapper">
							<input type="radio" name="model" id="model-${model.id}" value="${model.id}" data-provider="vscode-copilot" class="visually-hidden" ${!model.available ? "disabled" : ""} onchange="selectModel(this.value, 'vscode-copilot')">
							<label for="model-${model.id}" class="model-card ${model.recommended ? "recommended" : ""} ${!model.available ? "unavailable" : ""}">
								<div class="selection-indicator" aria-hidden="true">✓</div>
								<div class="model-name">${model.name} ${!model.available ? "(" + (isEnglish ? "Unavailable" : "Kullanılamıyor") + ")" : ""}</div>
								<div class="model-description">${model.description}</div>
								<div class="model-badges" aria-hidden="true">
									<span class="badge speed-${model.speed}">${model.speed}</span>
									<span class="badge quality-${model.quality}">${model.quality}</span>
									${!model.available ? '<span class="badge unavailable">' + (isEnglish ? "Unavailable" : "Kullanılamıyor") + "</span>" : ""}
								</div>
							</label>
						</div>
					`).join("")}
				</div>

				<!-- Ollama Models -->
				<div id="ollamaModels" class="model-grid" role="radiogroup" aria-label="Select Ollama Model" style="display: none;">
					${availableModels.ollama.map((model: any) => `
						<div class="model-option-wrapper">
							<input type="radio" name="model" id="model-${model.id}" value="${model.id}" data-provider="ollama" class="visually-hidden" ${!model.available ? "disabled" : ""} onchange="selectModel(this.value, 'ollama')">
							<label for="model-${model.id}" class="model-card ${model.recommended ? "recommended" : ""} ${!model.available ? "unavailable" : ""}">
								<div class="selection-indicator" aria-hidden="true">✓</div>
								<div class="model-name">${model.name} ${!model.available ? "(" + (isEnglish ? "Unavailable" : "Kullanılamıyor") + ")" : ""}</div>
								<div class="model-description">${model.description}</div>
								<div class="model-badges" aria-hidden="true">
									<span class="badge speed-${model.speed}">${model.speed}</span>
									<span class="badge quality-${model.quality}">${model.quality}</span>
									${!model.available ? '<span class="badge unavailable">' + (isEnglish ? "Unavailable" : "Kullanılamıyor") + "</span>" : ""}
								</div>
							</label>
						</div>
					`).join("")}
				</div>
			</fieldset>

			<!-- API Test Section in Step 2 -->
			<div id="step2ApiTest" class="api-test-section" style="margin-top: 25px; padding: 20px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border-color);">
				<h3 style="margin-bottom: 15px; font-size: 1.1rem;">
					🧪 ${isEnglish ? "Test Connection" : "Bağlantıyı Test Et"}
				</h3>
				<p style="margin-bottom: 15px; color: var(--vscode-descriptionForeground);">
					${isEnglish
				? "Test your AI connection to verify everything is configured correctly."
				: "Her şeyin doğru yapılandırıldığını doğrulamak için AI bağlantınızı test edin."}
				</p>
				<button class="btn btn-secondary" onclick="testConnectionFromStep2()" id="testConnectionStep2Button">
					🔌 ${isEnglish ? "Test Connection" : "Bağlantıyı Test Et"}
				</button>
				<div id="step2TestResult" class="test-result" style="margin-top: 15px; display: none;" role="status" aria-live="polite"></div>
			</div>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-primary" onclick="submitStep(2)" disabled id="submitStep2" aria-describedby="submit2-help">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
				<div id="submit2-help" class="screen-reader-only">${isEnglish ? "Button will be enabled after selecting a model" : "Model seçtikten sonra düğme aktif olacak"}</div>
			</div>
		</section>

		<!-- Step 3: Interface & Language Settings -->
		<section class="step-content" data-step="3" role="tabpanel" aria-labelledby="step3-title" aria-describedby="step3-desc" aria-hidden="true">
			<h2 id="step3-title" class="step-title">${localization.getString("wizard.interface.title") || "Interface & Language Settings"}</h2>
			<p id="step3-desc" class="step-description">${localization.getString("wizard.interface.description") || "Configure your interface preferences and language settings."}</p>
			
			<form role="form" aria-label="Interface Configuration">
				<div class="form-group">
					<label class="form-label" for="wcagLevel">${localization.getString("wizard.wcag.level.label")}</label>
					<select id="wcagLevel" class="form-select" aria-describedby="wcagLevelHelp" aria-required="true">
						<option value="A">${localization.getString("welcome.wcag.level.a") || "Level A - Basic accessibility requirements"}</option>
						<option value="AA" selected>${localization.getString("welcome.wcag.level.aa") || "Level AA - Standard accessibility (Recommended)"}</option>
						<option value="AAA">${localization.getString("welcome.wcag.level.aaa") || "Level AAA - Enhanced accessibility for critical applications"}</option>
					</select>
					<div id="wcagLevelHelp" class="form-text">${localization.getString("wizard.wcag.level.help")}</div>
				</div>
				
				<div class="form-group">
					<label class="form-label" for="responseLanguage">${localization.getString("wizard.language.label")}</label>
					<select id="responseLanguage" class="form-select" aria-describedby="languageHelp">
						<option value="auto">${localization.getString("wizard.language.auto")}</option>
						<option value="en" ${currentLang === "en" ? "selected" : ""}>English</option>
						<option value="tr" ${currentLang === "tr" ? "selected" : ""}>Türkçe</option>
					</select>
					<div id="languageHelp" class="form-text">Choose the language for AI responses and interface</div>
				</div>
			</form>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-primary" onclick="submitStep(3)" aria-label="${isEnglish ? "Submit and go to next step" : "Gönder ve sonraki adıma git"}">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>

		<!-- Step 4: API Test & Configuration -->
		<section class="step-content" data-step="4" role="tabpanel" aria-labelledby="step4-title" aria-describedby="step4-desc" aria-hidden="true">
			<h2 id="step4-title" class="step-title">${localization.getString("wizard.api.test.title") || "API Test & Configuration"}</h2>
			<p id="step4-desc" class="step-description">${localization.getString("wizard.api.test.description") || "Test your AI connection and configure API settings."}</p>
			
			<div id="geminiApiConfig" style="display: none;">
				<div class="alert alert-warning">
					<strong>⚠️ ${localization.getString("wizard.api.warning.title") || "Note"}:</strong> ${localization.getString("wizard.api.warning.gemini") || "You can get a free API key from Google AI Studio."}
				</div>
				
				<div class="form-group">
					<label class="form-label" for="geminiApiKey">${localization.getString("wizard.api.key.label")} - Gemini</label>
					<input type="password" id="geminiApiKey" class="form-input" placeholder="AIzaSy... (${localization.getString("wizard.api.key.placeholder")})" aria-describedby="apiKeyHelp">
					<small id="apiKeyHelp" class="form-text">${localization.getString("wizard.api.key.help")}</small>
				</div>
				
				<button class="btn btn-secondary" onclick="openGeminiApiPage()">
					📋 ${localization.getString("wizard.api.key.get")}
				</button>
				
				<button class="btn btn-primary" onclick="testApiKey()" id="testApiButton" style="margin-left: 10px;">
					🧪 ${localization.getString("wizard.button.test")}
				</button>
			</div>
			
			<!-- Copilot Config Info -->
			<div id="copilotApiConfig" style="display: none;">
				<div class="alert alert-success" role="status">
					<strong>✅ GitHub Copilot</strong>
					<p>${isEnglish ? "Configured via VS Code Language Models API." : "VS Code Language Models API üzerinden yapılandırıldı."}</p>
				</div>
				<button class="btn btn-primary" onclick="testCopilotConnection()" id="testCopilotButton">
					🧪 ${localization.getString("wizard.button.test")}
				</button>
			</div>

			<!-- Ollama Config Info -->
			<div id="ollamaApiConfig" style="display: none;">
				<div class="alert alert-success" role="status">
					<strong>✅ Ollama (Local)</strong>
					<p>${isEnglish ? "Ollama is running locally." : "Ollama yerel olarak çalışıyor."}</p>
					<p id="ollamaUrlDisplay" style="font-family: monospace; font-size: 0.9rem; margin-top: 5px;"></p>
				</div>
				<button class="btn btn-primary" onclick="testConnection()" id="testOllamaButton">
					🧪 ${localization.getString("wizard.button.test")}
				</button>
			</div>
			
			<div id="apiTestResult" class="test-result" style="display: none;"></div>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-primary" onclick="submitStep(4)" id="submitStep4">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>

		<!-- Step 5: Jira Configuration (Optional) -->
		<section class="step-content" data-step="5" role="tabpanel" aria-labelledby="step5-title" aria-describedby="step5-desc" aria-hidden="true">
			<h2 id="step5-title" class="step-title">🎫 Jira Configuration (Optional)</h2>
			<p id="step5-desc" class="step-description">Configure Jira task creation settings for WCAG improvement tasks. This step is optional but recommended for teams using Jira.</p>
			
			<form role="form" aria-label="Jira Configuration">
				<div class="form-group">
					<label class="form-label" for="jiraCustomPrompt">Custom AI Prompt (Optional)</label>
					<textarea id="jiraCustomPrompt" class="form-input" rows="3" placeholder="e.g., Focus on screen reader compatibility, include testing steps..." aria-describedby="promptHelp"></textarea>
					<div id="promptHelp" class="form-text">Additional context or specific requirements for Jira task generation</div>
				</div>
				
				<div class="form-group">
					<div class="checkbox-group">
						<input type="checkbox" id="useCustomPrompt" class="form-checkbox" aria-describedby="useCustomPrompt-desc">
						<label for="useCustomPrompt" class="checkbox-label" id="useCustomPrompt-label">Always ask for custom prompt when creating Jira tasks</label>
						<div id="useCustomPrompt-desc" class="screen-reader-only">Enabling this will prompt for details every time a Jira task is being created.</div>
					</div>
				</div>
				
				<div class="form-group">
					<label class="form-label" for="defaultPriority">Default Task Priority</label>
					<select id="defaultPriority" class="form-select" aria-describedby="priorityHelp">
						<option value="Critical">🔴 Critical - Blocks accessibility for many users</option>
						<option value="High">🟠 High - Significant accessibility barrier</option>
						<option value="Medium" selected>🟡 Medium - Important accessibility improvement</option>
						<option value="Low">🟢 Low - Nice-to-have accessibility enhancement</option>
					</select>
					<div id="priorityHelp" class="form-text">Default priority level for WCAG Jira tasks</div>
				</div>
				
				<div class="form-group">
					<label class="form-label" for="defaultComponent">Default Component/Area</label>
					<select id="defaultComponent" class="form-select" aria-describedby="componentHelp">
						<option value="images">🖼️ Images & Media - Alt text, captions, audio descriptions</option>
						<option value="navigation">🔗 Navigation & Links - Link text, skip links, breadcrumbs</option>
						<option value="forms">📝 Forms & Input - Labels, validation, instructions</option>
						<option value="color">🎨 Color & Contrast - Color contrast, color-only information</option>
						<option value="keyboard">⌨️ Keyboard Access - Tab order, focus management</option>
						<option value="structure">🏗️ Structure & Semantics - Headings, landmarks, ARIA</option>
						<option value="responsive">📱 Responsive & Mobile - Mobile accessibility, touch targets</option>
						<option value="media">🔊 Audio & Video - Captions, transcripts, controls</option>
						<option value="other" selected>🌐 Other - General accessibility improvements</option>
					</select>
					<div id="componentHelp" class="form-text">Default component/area focus for WCAG tasks</div>
				</div>
				
				<div class="form-group">
					<div class="checkbox-group">
						<input type="checkbox" id="includeCodeExamples" class="form-checkbox" checked aria-describedby="includeCodeExamples-desc">
						<label for="includeCodeExamples" class="checkbox-label" id="includeCodeExamples-label">Include code examples in Jira task descriptions</label>
						<div id="includeCodeExamples-desc" class="screen-reader-only">The generated Jira task will include snippets of the code that needs accessibility improvements.</div>
					</div>
				</div>
				
				<div class="form-group">
					<div class="checkbox-group">
						<input type="checkbox" id="includeTestingSteps" class="form-checkbox" checked aria-describedby="includeTestingSteps-desc">
						<label for="includeTestingSteps" class="checkbox-label" id="includeTestingSteps-label">Include testing steps in Jira task descriptions</label>
						<div id="includeTestingSteps-desc" class="screen-reader-only">The generated Jira task will include specific steps for QA to verify the accessibility fixes.</div>
					</div>
				</div>
			</form>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-secondary" onclick="skipJiraConfig()" aria-label="Skip Jira configuration">
					Skip <span aria-hidden="true">→</span>
				</button>
				<button class="btn btn-primary" onclick="submitStep(5)" aria-label="Save Jira configuration and continue">
					${isEnglish ? "Save & Continue" : "Kaydet ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>

		<!-- Step 6: Complete Setup -->
		<section class="step-content" data-step="6" role="tabpanel" aria-labelledby="step6-title" aria-describedby="step6-desc" aria-hidden="true">
			<h2 id="step6-title" class="step-title">${localization.getString("wizard.complete.title") || "Complete Setup"}</h2>
			<p id="step6-desc" class="step-description">${localization.getString("wizard.complete.description") || "Finalize your AccessiMind setup and access additional options."}</p>
			
			<div class="alert alert-success" role="alert" aria-live="polite">
				<strong>🎉 ${localization.getString("wizard.test.success.title") || "Great"}!</strong> ${localization.getString("wizard.test.success")}
			</div>
			
			<div class="form-group">
				<button class="btn btn-primary" onclick="testConnection()" id="testButton" aria-describedby="test-connection-help">
					🧪 ${localization.getString("wizard.test.connection")}
				</button>
				<div id="test-connection-help" class="screen-reader-only">Tests the complete AI configuration and connection</div>
			</div>
			
			<div id="testResult" class="test-result" role="status" aria-live="polite" aria-atomic="true"></div>
			
			<section class="help-section" aria-labelledby="quickstart-title">
				<h3 id="quickstart-title" class="help-title">🚀 ${localization.getString("wizard.quickstart.title")}</h3>
				<nav class="help-links" role="navigation" aria-label="Quick start actions">
					<a href="#" class="help-link" onclick="tryCommand('wcagEnhancer.improveCurrentSelected')" role="button" aria-describedby="try-help">
						<span aria-hidden="true">⚡</span>
						<span>${localization.getString("wizard.quickstart.try")}</span>
					</a>
					<div id="try-help" class="screen-reader-only">Runs a quick WCAG improvement on current file or selection</div>
					
					<a href="#" class="help-link" onclick="openSettings()" role="button" aria-describedby="settings-help">
						<span aria-hidden="true">⚙️</span>
						<span>${localization.getString("wizard.quickstart.settings")}</span>
					</a>
					<div id="settings-help" class="screen-reader-only">Opens VS Code settings for AccessiMind</div>
					
					<a href="#" class="help-link" onclick="openExternal('https://www.w3.org/WAI/WCAG22/quickref/')" role="button" aria-describedby="guide-help">
						<span aria-hidden="true">📚</span>
						<span>${localization.getString("wizard.quickstart.guide")}</span>
					</a>
					<div id="guide-help" class="screen-reader-only">Opens WCAG 2.2 quick reference guide in external browser</div>
					
					<a href="#" class="help-link" onclick="openExternal('https://makersuite.google.com/')" role="button" aria-describedby="api-help">
						<span aria-hidden="true">🔑</span>
						<span>${localization.getString("wizard.quickstart.api")}</span>
					</a>
					<div id="api-help" class="screen-reader-only">Opens Google AI Studio to get API key in external browser</div>
				</nav>
			</section>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-success" onclick="finishWizard()" id="finishButton" aria-describedby="finish-help">
					🎉 ${isEnglish ? "Finish and Complete" : "Tamamla ve Bitir"}
				</button>
				<div id="finish-help" class="screen-reader-only">${isEnglish ? "Completes the setup and starts using AccessiMind" : "Kurulumu tamamlar ve AccessiMind'ı kullanmaya başlar"}</div>
			</div>
		</section>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		let currentStep = 1;
		let selectedProvider = null;
		let selectedModel = null;
		let completedSteps = []; // Tamamlanan adımları takip et
		
		// Event Listeners Setup
		function attachEventListeners() {
			console.log('Attaching event listeners...');
			
			// Sağlayıcı seçimi
			const providerRadios = document.querySelectorAll('input[name="provider"]');
			console.log('Found provider radios:', providerRadios.length);
			providerRadios.forEach(radio => {
				// Remove old listeners to prevent duplicates if called multiple times
				// (Check if we can use a simpler approach or just rely on replacement)
				// Actually, for named functions we can remove. For content replacement, just re-adding might stack?
				// Better to clean up or use event delegation.
				// Let's use event delegation on the container for robustness.
			});
		}

		// Consolidated Event Delegation
		document.addEventListener('change', (e) => {
			if (e.target.name === 'provider') {
				// console.log('Provider selected:', e.target.value);
				// alert('Debug: Provider change detected: ' + e.target.value); 
				selectProvider(e.target.value);
			} else if (e.target.name === 'model') {
				// console.log('Model selected:', e.target.value);
				selectModel(e.target.value, e.target.dataset.provider);
			}
		});
		
		// Adım navigasyonu için click listener'lar (Delegation)
		document.addEventListener('click', (e) => {
			const step = e.target.closest('.step.clickable');
			if (step) {
				const stepNumber = parseInt(step.dataset.step);
				navigateToStep(stepNumber);
			}
		});

		document.addEventListener('keydown', (e) => {
			if (e.target.classList.contains('step') && (e.key === 'Enter' || e.key === ' ')) {
				e.preventDefault();
				const step = e.target;
				const stepNumber = parseInt(step.dataset.step);
				navigateToStep(stepNumber);
			}
		});
		
		function navigateToStep(stepNumber) {
			// Sadece tamamlanmış adımlara veya bir sonraki adıma gidebilir
			if (stepNumber <= Math.max(...completedSteps, currentStep)) {
				currentStep = stepNumber;
				updateStepDisplay();
				focusCurrentStep();
				announceToScreenReader(\`Adım \${stepNumber}'ye geçildi\`);
			}
		}
		
		function selectProvider(provider, buttonElement) {
			try {
				selectedProvider = provider;
				
				// Tüm sağlayıcı düğmelerinin pressed durumunu kaldır
				document.querySelectorAll('.provider-card').forEach(btn => {
					btn.setAttribute('aria-pressed', 'false');
				});
				
				// Seçili düğmeyi pressed yap
				if (buttonElement) {
					buttonElement.setAttribute('aria-pressed', 'true');
				}
				
				// API Key ve Copilot bilgi bölümlerini göster/gizle
				const geminiApiSection = document.getElementById('geminiApiKeySection');
				const copilotInfoSection = document.getElementById('copilotInfoSection');
				const ollamaUrlSection = document.getElementById('ollamaUrlSection');
				
				if (!geminiApiSection || !copilotInfoSection || !ollamaUrlSection) {
					// Silent fail or log?
					console.error('Missing sections');
					return;
				}

				if (provider === 'gemini') {
					geminiApiSection.style.display = 'block';
					copilotInfoSection.style.display = 'none';
					ollamaUrlSection.style.display = 'none';
					announceToScreenReader('${isEnglish ? "Gemini selected. Please enter your API key." : "Gemini seçildi. Lütfen API anahtarınızı girin."}');
				} else if (provider === 'ollama') {
					geminiApiSection.style.display = 'none';
					copilotInfoSection.style.display = 'none';
					ollamaUrlSection.style.display = 'block';
					announceToScreenReader('${isEnglish ? "Ollama selected. Please configure your local URL." : "Ollama seçildi. Lütfen yerel URL'nizi yapılandırın."}');
				} else {
					geminiApiSection.style.display = 'none';
					copilotInfoSection.style.display = 'block';
					ollamaUrlSection.style.display = 'none';
					announceToScreenReader('${isEnglish ? "GitHub Copilot selected. No API key required." : "GitHub Copilot seçildi. API anahtarı gerekmez."}');
				}
				
				// Submit butonunu etkinleştir
				const submitBtn = document.getElementById('submitStep1');
				if (submitBtn) {
					submitBtn.disabled = false;
                    submitBtn.removeAttribute('disabled'); // Ensure attribute is removed
                    // Also update aria-disabled just in case styling uses it
                    submitBtn.setAttribute('aria-disabled', 'false');
				} else {
					console.error('Submit button not found');
				}
				
				// Sağlayıcıyı kaydet ve modelleri al
				vscode.postMessage({
					command: 'setupProvider',
					provider: provider
				});
			} catch (e) {
				console.error('Error in selectProvider:', e);
				// Fallback: Try to enable button anyway
				const submitBtn = document.getElementById('submitStep1');
				if (submitBtn) submitBtn.disabled = false;
			}
		}
		
		function saveApiKeyFromStep1() {
			const apiKeyInput = document.getElementById('step1GeminiApiKey');
			const statusDiv = document.getElementById('step1ApiKeyStatus');
			const apiKey = apiKeyInput.value.trim();
			
			if (!apiKey) {
				statusDiv.style.display = 'block';
				statusDiv.className = 'api-key-status alert alert-warning';
				statusDiv.textContent = '${isEnglish ? "Please enter an API key." : "Lütfen bir API anahtarı girin."}';
				announceToScreenReader('${isEnglish ? "Please enter an API key." : "Lütfen bir API anahtarı girin."}');
				return;
			}
			
			// API anahtarını kaydet
			vscode.postMessage({
				command: 'setupApiKey',
				apiKey: apiKey
			});
			
			statusDiv.style.display = 'block';
			statusDiv.className = 'api-key-status alert alert-success';
			statusDiv.textContent = '${isEnglish ? "API key saved successfully!" : "API anahtarı başarıyla kaydedildi!"}';
			announceToScreenReader('${isEnglish ? "API key saved successfully!" : "API anahtarı başarıyla kaydedildi!"}');
		}

		function saveOllamaUrlFromStep1() {
			const urlInput = document.getElementById('step1OllamaUrl');
			const statusDiv = document.getElementById('step1OllamaStatus');
			const url = urlInput.value.trim();
			
			if (!url) {
				statusDiv.style.display = 'block';
				statusDiv.className = 'ollama-status alert alert-warning';
				statusDiv.textContent = '${isEnglish ? "Please enter an Ollama URL." : "Lütfen bir Ollama URL'i girin."}';
				announceToScreenReader('${isEnglish ? "Please enter an Ollama URL." : "Lütfen bir Ollama URL'i girin."}');
				return;
			}
			
			statusDiv.style.display = 'block';
			statusDiv.className = 'ollama-status alert alert-info';
			statusDiv.innerHTML = '<span class="loading"></span> ${isEnglish ? "Connecting to Ollama..." : "Ollama'ya bağlanılıyor..."}';
			
			// Ollama URL'ini kaydet ve modelleri yenile
			vscode.postMessage({
				command: 'setupOllamaUrl',
				url: url
			});
		}
		
		function testConnectionFromStep2() {
			const testButton = document.getElementById('testConnectionStep2Button');
			const testResult = document.getElementById('step2TestResult');
			
			if (!selectedModel) {
				testResult.style.display = 'block';
				testResult.className = 'test-result alert alert-warning';
				testResult.textContent = '${isEnglish ? "Please select a model first." : "Lütfen önce bir model seçin."}';
				announceToScreenReader('${isEnglish ? "Please select a model first." : "Lütfen önce bir model seçin."}');
				return;
			}
			
			testButton.innerHTML = '<span class="loading"></span> ${isEnglish ? "Testing..." : "Test ediliyor..."}';
			testButton.disabled = true;
			
			vscode.postMessage({
				command: 'testConnection'
			});
			
			// Result will be handled by message listener
		}
		
		function selectModel(model, provider) {
			// Unavailable check handled by disabled attribute on input
			// But extra check just in case
			const modelInput = document.getElementById('model-' + model);
			if (modelInput && modelInput.disabled) {
				showAlert('${localization.getString("wizard.model.unavailable.message") || "This model is not available. Please check your subscription or try another model."}', 'warning');
				return;
			}
			
			selectedModel = model;
			
			// UI updated by CSS
			
			// Model adını bul ve anons et
			const modelLabel = document.querySelector(\`label[for="model-\${model}"]\`);
			const modelName = modelLabel?.querySelector('.model-name')?.textContent || model;
			announceToScreenReader(\`${isEnglish ? "Model selected" : "Model seçildi"}: \${modelName}\`);
			
			// Submit butonunu etkinleştir
			document.getElementById('submitStep2').disabled = false;
			
			// Modeli kaydet
			vscode.postMessage({
				command: 'setupModel',
				model: model,
				provider: provider
			});
		}
		
		function submitStep(step) {
			// Her adımda submit işlemi yap ve sonra nextStep çağır
			switch(step) {
				case 1:
					if (!selectedProvider) {
						showAlert('${isEnglish ? "Please select an AI provider first." : "Lütfen önce bir AI sağlayıcısı seçin."}', 'warning');
						return;
					}
					break;
				case 2:
					if (!selectedModel) {
						showAlert('${isEnglish ? "Please select an AI model first." : "Lütfen önce bir AI modeli seçin."}', 'warning');
						return;
					}
					break;
				case 3:
					// Interface ayarları doğrulama
					const wcagLevel = document.getElementById('wcagLevel').value;
					const language = document.getElementById('responseLanguage').value;
					
					vscode.postMessage({
						command: 'setupWcagLevel',
						level: wcagLevel
					});
					
					vscode.postMessage({
						command: 'setupLanguage',
						language: language
					});
					break;
				case 4:
					// API konfigürasyonu kontrolü
					if (selectedProvider === 'gemini') {
						const apiKey = document.getElementById('geminiApiKey').value;
						if (!apiKey || apiKey.trim().length < 20) {
							showAlert('${isEnglish ? "Please enter a valid API key." : "Lütfen geçerli bir API anahtarı girin."}', 'danger');
							return;
						}
						
						vscode.postMessage({
							command: 'setupApiKey',
							apiKey: apiKey
						});
					}
					break;
				case 5:
					// Jira konfigürasyonu
					const jiraConfig = {
						customPrompt: document.getElementById('jiraCustomPrompt').value || '',
						useCustomPrompt: document.getElementById('useCustomPrompt').checked || false,
						defaultPriority: document.getElementById('defaultPriority').value || 'Medium',
						defaultComponent: document.getElementById('defaultComponent').value || 'other',
						includeCodeExamples: document.getElementById('includeCodeExamples').checked !== false,
						includeTestingSteps: document.getElementById('includeTestingSteps').checked !== false
					};
					
					vscode.postMessage({
						command: 'setupJiraConfig',
						config: jiraConfig
					});
					break;
			}
			
			// Adımı tamamlandı olarak işaretle
			if (!completedSteps.includes(step)) {
				completedSteps.push(step);
			}
			
			// Submit işlemi başarılı, sonraki adıma geç
			nextStep();
		}
		
		function nextStep() {
			if (currentStep < 6) {
				currentStep++;
				updateStepDisplay();
				focusCurrentStep();
				announceToScreenReader(\`Adım \${currentStep}'ye geçildi\`);
			}
		}
		
		function skipJiraConfig() {
			// Varsayılan Jira konfigürasyonu ile atla
			const defaultJiraConfig = {
				customPrompt: '',
				useCustomPrompt: false,
				defaultPriority: 'Medium',
				defaultComponent: 'other',
				includeCodeExamples: true,
				includeTestingSteps: true
			};
			
			vscode.postMessage({
				command: 'setupJiraConfig',
				config: defaultJiraConfig
			});
			
			// Sonraki adıma geç
			nextStep();
		}
		
		function prevStep() {
			if (currentStep > 1) {
				currentStep--;
				updateStepDisplay();
				focusCurrentStep();
				announceToScreenReader(\`Adım \${currentStep}'ye geri dönüldü\`);
			}
		}
		
		function updateStepDisplay() {
			// Adım göstergelerini güncelle
			document.querySelectorAll('.step').forEach((step, index) => {
				const stepNumber = index + 1;
				step.classList.remove('active', 'completed');
				step.setAttribute('tabindex', '-1');
				
				if (stepNumber === currentStep) {
					step.classList.add('active');
					step.setAttribute('tabindex', '0');
					step.setAttribute('aria-current', 'step');
				} else {
					step.removeAttribute('aria-current');
					if (completedSteps.includes(stepNumber)) {
						step.classList.add('completed');
						step.setAttribute('tabindex', '0'); // Tamamlanan adımlar tıklanabilir
					}
				}
			});
			
			// İçerik panellerini güncelle
			document.querySelectorAll('.step-content').forEach((content, index) => {
				const stepNumber = index + 1;
				content.classList.remove('active');
				content.setAttribute('aria-hidden', 'true');
				
				if (stepNumber === currentStep) {
					content.classList.add('active');
					content.setAttribute('aria-hidden', 'false');
				}
			});
			
			// Provider seçimi yapıldıysa modelleri ve API config'i göster
			if (selectedProvider) {
				showModelsForProvider(selectedProvider);
				showApiConfigForProvider(selectedProvider);
			}
		}
		
		function showModelsForProvider(provider) {
			document.getElementById('geminiModels').style.display = provider === 'gemini' ? 'grid' : 'none';
			document.getElementById('copilotModels').style.display = provider === 'vscode-copilot' ? 'grid' : 'none';
			document.getElementById('ollamaModels').style.display = provider === 'ollama' ? 'grid' : 'none';
		}
		
		function showApiConfigForProvider(provider) {
			document.getElementById('geminiApiConfig').style.display = provider === 'gemini' ? 'block' : 'none';
			document.getElementById('copilotApiConfig').style.display = provider === 'vscode-copilot' ? 'block' : 'none';
			document.getElementById('ollamaApiConfig').style.display = provider === 'ollama' ? 'block' : 'none';
		}
		
		
		function testConnection() {
			const testButton = document.getElementById('testButton');
			const testResult = document.getElementById('testResult');
			
			testButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.test.testing")}';
			testButton.disabled = true;
			
			vscode.postMessage({
				command: 'testConnection'
			});
		}
		
		function testApiKey() {
			const apiKey = document.getElementById('geminiApiKey').value;
			const testButton = document.getElementById('testApiButton');
			const testResult = document.getElementById('apiTestResult');
			
			if (!apiKey || apiKey.trim().length < 20) {
				showAlert('${localization.getString("wizard.api.key.validation") || "Please enter a valid API key."}', 'danger');
				return;
			}
			
			testButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.test.testing")}';
			testButton.disabled = true;
			
			// API anahtarını kaydet
			vscode.postMessage({
				command: 'setupApiKey',
				apiKey: apiKey
			});
			
			// Sonra testi çalıştır
			setTimeout(() => {
				vscode.postMessage({
					command: 'testConnection'
				});
			}, 500);
		}
		
		function testCopilotConnection() {
			const testButton = document.getElementById('testCopilotButton');
			const testResult = document.getElementById('apiTestResult');
			
			testButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.test.testing")}';
			testButton.disabled = true;
			
			vscode.postMessage({
				command: 'testConnection'
			});
		}
		
		function refreshModels() {
			const refreshButton = document.getElementById('refreshModelsButton');
			if (!refreshButton) return;
			
			refreshButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.model.refreshing") || "Refreshing..."}';
			refreshButton.disabled = true;
			
			vscode.postMessage({
				command: 'refreshModels'
			});
		}
		
		function finishWizard() {
			vscode.postMessage({
				command: 'finishWizard'
			});
		}
		
		function openSettings() {
			vscode.postMessage({
				command: 'openSettings'
			});
		}
		
		function openExternal(url) {
			vscode.postMessage({
				command: 'openExternal',
				url: url
			});
		}
		
		function openGeminiApiPage() {
			openExternal('https://makersuite.google.com/app/apikey');
		}
		
		function tryCommand(commandId) {
			vscode.postMessage({
				command: 'tryCommand',
				commandId: commandId
			});
		}
		
		function showAlert(message, type) {
			const alertDiv = document.createElement('div');
			alertDiv.className = \`alert alert-\${type}\`;
			alertDiv.textContent = message;
			
			const container = document.querySelector('.step-content.active');
			container.insertBefore(alertDiv, container.firstChild);
			
			setTimeout(() => {
				alertDiv.remove();
			}, 5000);
		}
		
		// VS Code mesajlarını dinle
		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.command) {
				case 'loadCurrentSettings':
					// Mevcut ayarları wizard'a yükle
					if (message.models) {
						updateModelGrids(message.models);
					}
					loadExistingSettings(message.settings);
					break;
				case 'providerSetup':
					if (message.success && message.models) {
						// Provider seçildikten sonra modelleri güncelle
						updateModelGrids(message.models);
						showModelsForProvider(selectedProvider);
						showApiConfigForProvider(selectedProvider);
						announceToScreenReader(\`\${message.provider} sağlayıcısı seçildi ve modeller yüklendi\`);
					}
					break;
					
				case 'testResult':
					const testButton = document.getElementById('testButton');
					const testResult = document.getElementById('testResult');
					
					if (testButton) {
						testButton.innerHTML = '🧪 ${localization.getString("wizard.test.connection")}';
						testButton.disabled = false;
					}
					
					// API test butonlarını da güncelle
					const testApiButton = document.getElementById('testApiButton');
					const testCopilotButton = document.getElementById('testCopilotButton');
					const testStep2Button = document.getElementById('testConnectionStep2Button');
					
					if (testApiButton) {
						testApiButton.innerHTML = '🧪 ${localization.getString("wizard.button.test")}';
						testApiButton.disabled = false;
					}
					
					if (testCopilotButton) {
						testCopilotButton.innerHTML = '🧪 ${localization.getString("wizard.button.test")}';
						testCopilotButton.disabled = false;
					}
					
					// Step 2 test butonunu güncelle
					if (testStep2Button) {
						testStep2Button.innerHTML = '🔌 ${isEnglish ? "Test Connection" : "Bağlantıyı Test Et"}';
						testStep2Button.disabled = false;
					}
					
					// Test sonucunu göster - önce Step 2'deki sonuca bak
					const step2TestResult = document.getElementById('step2TestResult');
					const apiTestResult = document.getElementById('apiTestResult');
					const mainTestResult = document.getElementById('testResult');
					const statusText = message.success ? '${isEnglish ? "Success" : "Başarılı"}' : '${isEnglish ? "Failed" : "Başarısız"}';
					const fullAnnouncement = \`\${statusText}: \${message.message}\`;
					
					// Aktif step'e göre doğru result alanını göster
					if (currentStep === 2 && step2TestResult) {
						step2TestResult.style.display = 'block';
						step2TestResult.className = \`test-result alert \${message.success ? 'alert-success' : 'alert-danger'}\`;
						step2TestResult.textContent = message.message;
						announceToScreenReader(fullAnnouncement, 'assertive');
					} else if (apiTestResult) {
						apiTestResult.style.display = 'block';
						apiTestResult.className = \`test-result alert \${message.success ? 'alert-success' : 'alert-danger'}\`;
						apiTestResult.textContent = message.message;
						announceToScreenReader(fullAnnouncement, 'assertive');
					} else if (mainTestResult) {
						mainTestResult.style.display = 'block';
						mainTestResult.className = \`test-result alert \${message.success ? 'alert-success' : 'alert-danger'}\`;
						mainTestResult.textContent = message.message;
						announceToScreenReader(fullAnnouncement, 'assertive');
					}
					break;
					
				case 'modelsRefreshed':
					const refreshButton = document.getElementById('refreshModelsButton');
					if (refreshButton) {
						refreshButton.innerHTML = '🔄 ${localization.getString("wizard.model.refresh") || "Refresh Models"}';
						refreshButton.disabled = false;
					}
					
					if (message.success && message.models) {
						// Model gridlerini güncelle
						updateModelGrids(message.models);
						const geminiCount = message.models.gemini?.length || 0;
						const copilotCount = message.models.copilot?.length || 0;
						const successMessage = '${localization.getString("wizard.model.refresh.success") || "Models refreshed successfully!"}';
						showAlert(successMessage, 'success');
						
						// Ekran okuyucu için detaylı duyuru
						const announcement = '${isEnglish ? "Models refreshed." : "Modeller yenilendi."} ' + 
							geminiCount + ' Gemini ${isEnglish ? "models" : "modeli"}, ' + 
							copilotCount + ' Copilot ${isEnglish ? "models loaded" : "modeli yüklendi"}.';
						announceToScreenReader(announcement, 'assertive');
					} else {
						showAlert('${localization.getString("wizard.model.refresh.failed") || "Failed to refresh models. Please try again."}', 'danger');
						announceToScreenReader('${isEnglish ? "Failed to refresh models. Please try again." : "Modeller yenilenemedi. Lütfen tekrar deneyin."}', 'assertive');
					}
					break;
					
				case 'apiKeySetup':
					if (message.success) {
						showAlert('${localization.getString("success.api.key.saved")}', 'success');
					} else {
						showAlert('${localization.getString("wizard.api.key.save.failed") || "API key could not be saved. Please try again."}', 'danger');
					}
					break;
					
				case 'jiraConfigSetup':
					if (message.success) {
						showAlert('Jira configuration saved successfully!', 'success');
					} else {
						showAlert('Failed to save Jira configuration. Please try again.', 'danger');
					}
					break;
					
				case 'ollamaUrlSetup':
					const ollamaStatus = document.getElementById('step1OllamaStatus');
					if (ollamaStatus) {
						if (message.success) {
							ollamaStatus.className = 'ollama-status alert alert-success';
							ollamaStatus.textContent = '${isEnglish ? "Ollama URL saved and models fetched!" : "Ollama URL'i kaydedildi ve modeller getirildi!"}';
							if (message.models) {
								updateModelGrids(message.models);
							}
						} else {
							ollamaStatus.className = 'ollama-status alert alert-danger';
							ollamaStatus.textContent = '${isEnglish ? "Failed to connect to Ollama. Please check the URL." : "Ollama'ya bağlanılamadı. Lütfen URL'i kontrol edin."}';
						}
					}
					break;
			}
		});
		
		function updateModelGrids(models) {
			console.log('UpdateModelGrids called with models:', models);
			
			// Gemini modelleri güncelle
			const geminiGrid = document.getElementById('geminiModels');
			if (geminiGrid && models.gemini) {
				console.log('Updating Gemini grid, count:', models.gemini.length);
				geminiGrid.innerHTML = models.gemini.map((model, index) => \`
					<div class="model-option-wrapper">
						<input type="radio" name="model" id="model-\${model.id}" value="\${model.id}" data-provider="gemini" class="visually-hidden" onchange="selectModel(this.value, 'gemini')">
						<label for="model-\${model.id}" class="model-card \${model.recommended ? 'recommended' : ''}">
							<div class="selection-indicator" aria-hidden="true">✓</div>
							<div class="model-name">\${model.name}</div>
							<div class="model-description">\${model.description}</div>
							<div class="model-badges" aria-hidden="true">
								<span class="badge speed-\${model.speed}">\${model.speed}</span>
								<span class="badge quality-\${model.quality}">\${model.quality}</span>
							</div>
						</label>
					</div>
				\`).join('');
			}
			
			// Copilot modelleri güncelle
			const copilotGrid = document.getElementById('copilotModels');
			if (copilotGrid && models.copilot) {
				console.log('Updating Copilot grid, count:', models.copilot.length);
				copilotGrid.innerHTML = models.copilot.map((model, index) => \`
					<div class="model-option-wrapper">
						<input type="radio" name="model" id="model-\${model.id}" value="\${model.id}" data-provider="vscode-copilot" class="visually-hidden" \${!model.available ? 'disabled' : ''} onchange="selectModel(this.value, 'vscode-copilot')">
						<label for="model-\${model.id}" class="model-card \${model.recommended ? 'recommended' : ''} \${!model.available ? 'unavailable' : ''}">
							<div class="selection-indicator" aria-hidden="true">✓</div>
							<div class="model-name">\${model.name} \${!model.available ? '(' + (isEnglish ? "Unavailable" : "Kullanılamıyor") + ')' : ''}</div>
							<div class="model-description">\${model.description}</div>
							<div class="model-badges" aria-hidden="true">
								<span class="badge speed-\${model.speed}">\${model.speed}</span>
								<span class="badge quality-\${model.quality}">\${model.quality}</span>
								\${!model.available ? '<span class="badge unavailable">' + (isEnglish ? "Unavailable" : "Kullanılamıyor") + '</span>' : ''}
							</div>
						</label>
					</div>
				\`).join('');
			}

			// Ollama modelleri güncelle
			const ollamaGrid = document.getElementById('ollamaModels');
			if (ollamaGrid && models.ollama) {
				console.log('Updating Ollama grid, count:', models.ollama.length);
				ollamaGrid.innerHTML = models.ollama.map((model, index) => \`
					<div class="model-option-wrapper">
						<input type="radio" name="model" id="model-\${model.id}" value="\${model.id}" data-provider="ollama" class="visually-hidden" \${!model.available ? 'disabled' : ''} onchange="selectModel(this.value, 'ollama')">
						<label for="model-\${model.id}" class="model-card \${model.recommended ? 'recommended' : ''} \${!model.available ? 'unavailable' : ''}">
							<div class="selection-indicator" aria-hidden="true">✓</div>
							<div class="model-name">\${model.name} \${!model.available ? '(' + (isEnglish ? "Unavailable" : "Kullanılamıyor") + ')' : ''}</div>
							<div class="model-description">\${model.description}</div>
							<div class="model-badges" aria-hidden="true">
								<span class="badge speed-\${model.speed}">\${model.speed}</span>
								<span class="badge quality-\${model.quality}">\${model.quality}</span>
								\${!model.available ? '<span class="badge unavailable">' + (isEnglish ? "Unavailable" : "Kullanılamıyor") + '</span>' : ''}
							</div>
						</label>
					</div>
				\`).join('');
			}
			
			// Event listener'ları yeniden ekle (Change listener)
			// DEPRECATED: Handled by global event delegation now.
			// document.querySelectorAll('input[name="model"]').forEach(radio => {
			// 	radio.addEventListener('change', (e) => selectModel(e.target.value, e.target.dataset.provider));
			// });
		}

// Gelişmiş klavye navigasyonu
document.addEventListener('keydown', (e) => {
	// Adım navigasyonu için ok tuşları
	if (e.key === 'ArrowLeft' && currentStep > 1 && !e.target.matches('input, select, textarea')) {
		e.preventDefault();
		prevStep();
	} else if (e.key === 'ArrowRight' && currentStep < 6 && !e.target.matches('input, select, textarea')) {
		e.preventDefault();
		nextStep();
	}

	// Escape tuşu ile sihirbazı kapat
	if (e.key === 'Escape') {
		const confirmed = confirm('Are you sure you want to exit the setup wizard?');
		if (confirmed) {
			window.close();
		}
	}

	// Tab trapping için (modal davranışı)
	if (e.key === 'Tab') {
		const focusableElements = document.querySelectorAll(
			'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (e.shiftKey && document.activeElement === firstElement) {
			e.preventDefault();
			lastElement.focus();
		} else if (!e.shiftKey && document.activeElement === lastElement) {
			e.preventDefault();
			firstElement.focus();
		}
	}
});

// Mevcut ayarları yükle
function loadExistingSettings(settings) {
	console.log('Loading existing settings:', settings);

	// Eğer ayarlar mevcutsa wizard'ı doldur
	if (settings.isProviderConfigured && settings.provider) {
		selectedProvider = settings.provider;

		// Provider kartını seçili göster
		const providerInput = document.querySelector(\`input[name="provider"][value="\${settings.provider}"]\`);
		if (providerInput) {
			providerInput.checked = true;
			// dispatch change event to trigger UI updates if needed, though checks are mostly styled by CSS
			// but we need to trigger selectProvider logic (showing sections)
			// selectProvider(settings.provider); // Assuming loadExistingSettings handles sections separately
		}

		// Provider'a göre model ve API bölümlerini göster
		showModelsForProvider(settings.provider);
		showApiConfigForProvider(settings.provider);
	}

	if (settings.isModelConfigured && settings.model) {
		selectedModel = settings.model;

		// Model kartını seçili göster (modeller yüklendikten sonra)
		setTimeout(() => {
			const modelInput = document.querySelector(\`input[name="model"][value="\${settings.model}"]\`);
			if (modelInput) {
				modelInput.checked = true;
			}
		}, 500);
	}

	if (settings.isApiKeyConfigured) {
		// API key alanını doldur (güvenlik için gizli)
		const apiKeyInput = document.getElementById('geminiApiKey');
		if (apiKeyInput && settings.provider === 'gemini') {
			if (settings.apiKey === "***CONFIGURED***") {
				apiKeyInput.placeholder = "${isEnglish ? "API Key configured(hidden for security)" : "API Anahtarı yapılandırıldı(güvenlik için gizli)"}";
				apiKeyInput.style.backgroundColor = 'var(--vscode-input-placeholderForeground)';
			}
		}
	}

	// Ollama URL'ini yükle
	if (settings.ollamaUrl) {
		const ollamaUrlInput = document.getElementById('step1OllamaUrl');
		if (ollamaUrlInput) {
			ollamaUrlInput.value = settings.ollamaUrl;
		}
		const ollamaUrlDisplay = document.getElementById('ollamaUrlDisplay');
		if (ollamaUrlDisplay) {
			ollamaUrlDisplay.textContent = settings.ollamaUrl;
		}
	}

	// WCAG seviyesi seç
	if (settings.wcagLevel) {
		const wcagSelect = document.getElementById('wcagLevel');
		if (wcagSelect) {
			wcagSelect.value = settings.wcagLevel;
		}
	}

	// Dil seç
	if (settings.language) {
		const languageSelect = document.getElementById('language');
		if (languageSelect) {
			languageSelect.value = settings.language;
		}
	}

	// Eğer tamamen yapılandırılmışsa, adım göstergelerini güncelle
	if (settings.isFullyConfigured) {
		completedSteps = [1, 2, 3, 4, 5];
		updateStepDisplay(); // updateStepIndicators yerine updateStepDisplay kullanıyoruz

		announceToScreenReader("${isEnglish ? "Previous settings loaded. You can review or modify your configuration." : "Önceki ayarlar yüklendi. Yapılandırmanızı gözden geçirebilir veya değiştirebilirsiniz."}");
	} else {
		announceToScreenReader("${isEnglish ? "Some settings loaded. Please complete the remaining configuration." : "Bazı ayarlar yüklendi. Lütfen kalan yapılandırmayı tamamlayın."}");
	}
}

// Adım göstergelerini güncelle (alias for compatibility)
function updateStepIndicators() {
	updateStepDisplay();
}

// ARIA live region'lar için yardımcı fonksiyon
function announceToScreenReader(message, priority = 'polite') {
	let liveRegion = document.getElementById('a11y-announcer');
	if (!liveRegion) {
		liveRegion = document.createElement('div');
		liveRegion.id = 'a11y-announcer';
		liveRegion.setAttribute('aria-live', priority);
		liveRegion.setAttribute('aria-atomic', 'true');
		liveRegion.className = 'screen-reader-only';
		document.body.appendChild(liveRegion);
	} else {
		liveRegion.setAttribute('aria-live', priority);
	}

	// Aynı mesajın tekrar duyurulması için textContent'i temizleyip tekrar yazıyoruz
	liveRegion.textContent = '';
	setTimeout(() => {
		liveRegion.textContent = message;
	}, 50);
}

// Erişilebilirlik: Gelişmiş Focus management
function focusCurrentStep() {
	const activeStep = document.querySelector('.step-content.active');
	if (activeStep) {
		// Önce başlığa odaklan ki kullanıcı hangi adımda olduğunu bilsin
		const stepTitle = activeStep.querySelector('.step-title');
		if (stepTitle) {
			stepTitle.setAttribute('tabindex', '-1');
			stepTitle.focus();

			// Sonra ilk etkileşimli elemana geç
			setTimeout(() => {
				const focusable = activeStep.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])');
				if (focusable) {
					focusable.focus();
				}
			}, 100);
		}
	}
}

// Form doğrulama ile erişilebilirlik
function validateStep(stepNumber) {
	const currentContent = document.querySelector(\`.step-content[data-step="\${stepNumber}"]\`);
			if (!currentContent) return true;
			
			const requiredFields = currentContent.querySelectorAll('[aria-required="true"], [required]');
			let isValid = true;
			
			requiredFields.forEach(field => {
				if (!field.value || field.value.trim() === '') {
					field.setAttribute('aria-invalid', 'true');
					field.focus();
					announceToScreenReader(\`\${field.labels[0]?.textContent || 'Field'} is required\`, 'assertive');
					isValid = false;
				} else {
					field.setAttribute('aria-invalid', 'false');
				}
			});
			
			return isValid;
		}
		
		// İlk yükleme
		document.addEventListener('DOMContentLoaded', () => {
			focusCurrentStep();
		});
	</script>
</body>
</html>
		`;
	}

	private async getCurrentSettings(): Promise<any> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");

		// AI provider ve model ayarları
		const aiConfig = config.get("ai") as any || {};
		const aiModelConfig = config.get("aiModels") as any || {};

		// Mevcut ayarları topla
		const currentSettings = {
			provider: aiConfig.provider || null,
			model: aiModelConfig.selectedModel || null,
			apiKey: aiConfig.apiKey ? "***CONFIGURED***" : null,
			wcagLevel: config.get("wcagLevel") || "AA",
			language: config.get("language") || "auto",
			jira: config.get("jira") || {},
			wizardCompleted: config.get("wizardCompleted") || false,
			// Ayarların yapılandırılma durumu
			isProviderConfigured: !!(aiConfig.provider),
			isModelConfigured: !!(aiModelConfig.selectedModel),
			isApiKeyConfigured: !!(aiConfig.apiKey),
			isFullyConfigured: !!(aiConfig.provider && aiModelConfig.selectedModel && aiConfig.apiKey)
		};

		logger.info("Mevcut wizard ayarları yüklendi:", currentSettings);
		return currentSettings;
	}

	private async setupOllamaUrl(url: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		aiConfig.ollamaUrl = url;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

		if (this.persistentSettingsManager) {
			await this.persistentSettingsManager.persistSetting("ai", aiConfig);
		}

		if (this.jsonManager) {
			await this.jsonManager.updateWizardStep("ollamaUrl" as any, {
				value: url,
				completed: true
			});
			await this.jsonManager.syncFromVSCodeConfiguration();
		}

		logger.info(`Ollama URL set to: ${url}`);
	}

	private async getAvailableOllamaModels(): Promise<Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean, available?: boolean }>> {
		try {
			// Ollama provider'ı doğrudan oluşturup modelleri çek
			// Import'u burada yaparak sadece ihtiyaç olduğunda yüklenmesini sağlarız
			const { OllamaProvider } = await import("./utils/aiProvider");
			const tempOllama = new OllamaProvider();
			const models = await tempOllama.getAvailableModels();
			if (models && models.length > 0) {
				return models.map((model: any) => ({
					...model,
					available: true
				}));
			}
		} catch (error) {
			logger.warn("Ollama modelleri çekilemedi:", error);
		}
		return await this.getDefaultOllamaModels();
	}

	private async getDefaultOllamaModels(): Promise<Array<{ id: string, name: string, description: string, speed: string, quality: string, recommended?: boolean, available?: boolean }>> {
		const { LocalizationManager } = await import("./utils/localizationManager");
		const localization = LocalizationManager.getInstance();
		const isEnglish = localization.getCurrentLanguage() === "en";

		return [
			{
				id: "llama3",
				name: "Llama 3",
				description: isEnglish ? "Meta's latest powerful model" : "Meta'nın en yeni güçlü modeli",
				speed: "fast",
				quality: "high",
				recommended: true,
				available: true
			},
			{
				id: "mistral",
				name: "Mistral",
				description: isEnglish ? "Small and efficient" : "Küçük ve verimli",
				speed: "fast",
				quality: "medium",
				available: true
			},
			{
				id: "phi3",
				name: "Phi-3",
				description: isEnglish ? "Microsoft's lightweight model" : "Microsoft'un hafif modeli",
				speed: "fast",
				quality: "medium",
				available: true
			}
		];
	}
}
