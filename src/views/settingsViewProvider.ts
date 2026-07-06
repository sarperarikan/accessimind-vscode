import * as vscode from "vscode";
import { SettingsManager } from "../utils/settingsManager";
import { AITestUtils } from "../utils/aiTestUtils";
import { AIProviderManager } from "../utils/aiProvider";
import { logger } from "../utils/logger";
import { LocalizationManager } from "../utils/localizationManager";

export class SettingsViewProvider implements vscode.TreeDataProvider<SettingItem> {
	public static readonly viewType = "wcagEnhancer.settingsView";
	private _onDidChangeTreeData: vscode.EventEmitter<SettingItem | undefined | null | void> = new vscode.EventEmitter<SettingItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<SettingItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private settings: SettingItem[] = [];
	private settingsManager: SettingsManager;
	private aiTestUtils: AITestUtils;
	private aiProviderManager: AIProviderManager;
	private localization: LocalizationManager;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.settingsManager = SettingsManager.getInstance();
		this.aiTestUtils = AITestUtils.getInstance();
		this.aiProviderManager = AIProviderManager.getInstance();
		this.localization = LocalizationManager.getInstance();
		this.refresh();

		// Configuration değişikliklerini dinle
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration("wcagEnhancer")) {
				this.refresh();
			}
		});
	}

	public refreshView(): void {
		void this.refresh();
	}

	private t(en: string, tr: string): string {
		return this.localization.getCurrentLanguage() === "tr" ? tr : en;
	}

	private getProviderDisplayName(provider: string): string {
		switch (provider) {
			case "vscode-copilot":
				return "GitHub Copilot";
			case "ollama":
				return "Ollama";
			case "codex-subscription":
				return "Codex Subscription";
			case "gemini":
			default:
				return "Google Gemini";
		}
	}

	getTreeItem(element: SettingItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: SettingItem): Thenable<SettingItem[]> {
		if (!element) {
			return Promise.resolve(this.settings);
		}

		if (element.children) {
			return Promise.resolve(element.children);
		}

		return Promise.resolve([]);
	}

	private async refresh(): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		const aiModelConfig = config.get("aiModels") as any || {};
		const currentProvider = aiConfig.provider || "gemini";
		const currentModel = aiModelConfig.selectedModel || "gemini-2.5-flash";
		const wcagLevel = config.get("wcagLevel") || "AA";
		const language = config.get("language") || "auto";
		const autoApply = config.get("autoApply") || false;
		const includeComments = config.get("includeComments") !== false;
		const enableStatistics = config.get("enableStatistics") !== false;

		// Available models for current provider
		let availableModels: any[] = [];
		try {
			if (currentProvider === "gemini") {
				availableModels = await this.aiProviderManager.getAvailableModelsForProvider("gemini");
			} else if (currentProvider === "vscode-copilot") {
				availableModels = await this.aiProviderManager.getAvailableModelsForProvider("vscode-copilot");
			} else if (currentProvider === "ollama") {
				availableModels = await this.aiProviderManager.getAvailableModelsForProvider("ollama");
			} else if (currentProvider === "codex-subscription") {
				availableModels = await this.aiProviderManager.getAvailableModelsForProvider("codex-subscription");
			}
		} catch (error) {
			logger.error("Model listesi alınamadı:", error);
		}

		this.settings = [
			new SettingCategory(this.t("AI Provider Configuration", "AI Sa�lay�c� Yap�land�rmas�"), "ai-provider-config", [
				new SettingItem(
					"AI Provider",
					this.getProviderDisplayName(currentProvider),
					"Select AI provider for WCAG improvements",
					"aiProvider",
					"gear",
					[
						new SettingAction("Select Gemini", "selectProvider", { provider: "gemini" }),
						new SettingAction("Select Copilot", "selectProvider", { provider: "vscode-copilot" }),
						new SettingAction("Select Ollama", "selectProvider", { provider: "ollama" }),
						new SettingAction("Select Codex Subscription", "selectProvider", { provider: "codex-subscription" })
					]
				),
				...(currentProvider === "gemini" ? [
					new SettingItem(
						"Gemini API Key",
						aiConfig.apiKey ? "✅ Configured" : "❌ Not Configured",
						"Get API key from Google AI Studio",
						"apiKey",
						"key",
						[
							new SettingAction("🔑 Set API Key", "setApiKey"),
							new SettingAction("📋 Open API Studio", "openExternal", { url: "https://makersuite.google.com/" })
						]
					)
				] : []),
				new SettingItem(
					"Connection Test",
					"Test current AI provider",
					"Check if AI connection is working",
					"testConnection",
					"play",
					[
						new SettingAction("🧪 Test Connection", "testConnection")
					]
				)
			]),

			new SettingCategory(this.t("AI Model Settings", "AI Model Ayarlar�"), "ai-model-settings", [
				new SettingItem(
					"Selected Model",
					this.getModelDisplayName(currentModel, availableModels),
					`Current ${this.getProviderDisplayName(currentProvider)} model`,
					"selectedModel",
					"circuit-board",
					availableModels.map(model =>
						new SettingAction(
							`${model.name}${model.id === currentModel ? " ✅" : ""}`,
							"selectModel",
							{ modelId: model.id, provider: currentProvider }
						)
					)
				),
				new SettingItem(
					"Model Preferences",
					"Model preferences for different use cases",
					"Preferred models for different scenarios",
					"modelPreferences",
					"settings",
					[
						new SettingAction("⚡ For Quick Improvements", "showModelPreferences", { type: "quick" }),
						new SettingAction("🔍 For Complex Analysis", "showModelPreferences", { type: "complex" })
					]
				)
			]),

			new SettingCategory(this.t("WCAG Configuration", "WCAG Yap�land�rmas�"), "wcag-config", [
				new SettingItem(
					"WCAG Level",
					`Level ${wcagLevel}`,
					"Target WCAG conformance level",
					"wcagLevel",
					"shield",
					[
						new SettingAction(`Level A${wcagLevel === "A" ? " ✅" : ""}`, "setWcagLevel", { level: "A" }),
						new SettingAction(`Level AA${wcagLevel === "AA" ? " ✅" : ""}`, "setWcagLevel", { level: "AA" }),
						new SettingAction(`Level AAA${wcagLevel === "AAA" ? " ✅" : ""}`, "setWcagLevel", { level: "AAA" })
					]
				),
				new SettingItem(
					"Auto Apply",
					autoApply ? "✅ Enabled" : "❌ Disabled",
					"Apply improvements automatically without confirmation",
					"autoApply",
					autoApply ? "check" : "x",
					[
						new SettingAction(autoApply ? "❌ Disable" : "✅ Enable", "toggleAutoApply")
					]
				),
				new SettingItem(
					"Include Comments",
					includeComments ? "✅ Include" : "❌ Exclude",
					"Add explanatory comments about WCAG improvements",
					"includeComments",
					includeComments ? "comment" : "comment-discussion",
					[
						new SettingAction(includeComments ? "❌ Exclude" : "✅ Include", "toggleIncludeComments")
					]
				)
			]),

			new SettingCategory(this.t("Language & Localization", "Dil ve Yerelle�tirme"), "language-settings", [
				new SettingItem(
					this.t("Interface Language", "Aray�z Dili"),
					this.getLanguageDisplayName(language as string),
					this.t("AI responses and interface language", "AI yan�tlar� ve aray�z dili"),
					"language",
					"globe",
					[
						new SettingAction(`${this.t("Auto", "Otomatik")}${language === "auto" ? " ✅" : ""}`, "setLanguage", { language: "auto" }),
						new SettingAction(`${this.t("English", "�ngilizce")}${language === "en" ? " ✅" : ""}`, "setLanguage", { language: "en" }),
						new SettingAction(`${this.t("Turkish", "T�rk�e")}${language === "tr" ? " ✅" : ""}`, "setLanguage", { language: "tr" })
					]
				)
			]),

			new SettingCategory(this.t("Statistics & Analytics", "�statistikler ve Analitik"), "statistics-settings", [
				new SettingItem(
					"Statistics Tracking",
					enableStatistics ? "✅ Enabled" : "❌ Disabled",
					"Track usage statistics and metrics",
					"enableStatistics",
					enableStatistics ? "graph" : "graph-left",
					[
						new SettingAction(enableStatistics ? "❌ Disable" : "✅ Enable", "toggleStatistics"),
						new SettingAction("📊 View Statistics", "showStatistics"),
						new SettingAction("📤 Export Statistics", "exportStatistics"),
						new SettingAction("🗑️ Reset Statistics", "resetStatistics")
					]
				)
			]),

			new SettingCategory(this.t("Keyboard Shortcuts", "Klavye K�sayollar�"), "keyboard-shortcuts", [
				new SettingItem(
					"Shortcut Configuration",
					"Customize keyboard shortcuts",
					"Manage keyboard shortcuts for all commands",
					"shortcuts",
					"symbol-key",
					[
						new SettingAction("⌨️ Customize Shortcuts", "openKeybindings"),
						new SettingAction("🔄 Reset to Defaults", "resetKeybindings")
					]
				)
			]),

			new SettingCategory(this.t("Statistics & Analytics", "�statistikler ve Analitik"), "statistics-analytics", [
				new SettingItem(
					"View Statistics",
					"Display detailed WCAG enhancement statistics",
					"Show comprehensive usage and performance statistics",
					"showStatistics",
					"graph",
					[
						new SettingAction("📊 Show Statistics", "showStatistics"),
						new SettingAction("📤 Export Statistics", "exportStatistics"),
						new SettingAction("🗑️ Reset Statistics", "resetStatistics")
					]
				),
				new SettingItem(
					"Open Dynamic Panel",
					"Open real-time statistics panel",
					"View live statistics and manage data",
					"openDynamicPanel",
					"dashboard",
					[]
				)
			]),

			new SettingCategory(this.t("Help & Resources", "Yard�m ve Kaynaklar"), "help-resources", [
				new SettingItem(
					"Documentation & Guides",
					"Access to help resources",
					"WCAG guides and extension documentation",
					"help",
					"book",
					[
						new SettingAction("📖 WCAG 2.2 Guide", "openExternal", { url: "https://www.w3.org/WAI/WCAG22/quickref/" }),
						new SettingAction("🎯 Accessibility Testing", "openExternal", { url: "https://wave.webaim.org/" }),
						new SettingAction("🚀 Show Setup Wizard Again", "showWizard"),
						new SettingAction("💬 GitHub Discussions", "openExternal", { url: "https://github.com/your-repo/wcag-enhancer/discussions" }),
						new SettingAction("🐛 Report Bug", "openExternal", { url: "https://github.com/your-repo/wcag-enhancer/issues" })
					]
				)
			])
		];

		this._onDidChangeTreeData.fire();
	}

	private getModelDisplayName(modelId: string, availableModels: any[]): string {
		const model = availableModels.find(m => m.id === modelId);
		return model ? `${model.name} ✅` : modelId;
	}

	private getLanguageDisplayName(language: string): string {
		const languageMap: { [key: string]: string } = {
			"auto": "Auto",
			"en": "English",
			"tr": "Türkçe"
		};
		return languageMap[language] || language;
	}

	async handleSettingClick(item: SettingItem): Promise<void> {
		if (!item.actions || item.actions.length === 0) return;

		// Tek action varsa direkt çalıştır
		if (item.actions.length === 1) {
			await this.executeAction(item.actions[0]);
			return;
		}

		// Birden fazla action varsa quickpick göster
		const quickPickItems = item.actions.map(action => ({
			label: action.label,
			action: action
		}));

		const selected = await vscode.window.showQuickPick(quickPickItems, {
			title: item.label,
			placeHolder: item.description
		});

		if (selected) {
			await this.executeAction(selected.action);
		}
	}

	private async executeAction(action: SettingAction): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");

		try {
			switch (action.actionType) {
				case "selectProvider":
					await this.selectProvider(action.data?.provider);
					break;

				case "setApiKey":
					await this.setApiKey();
					break;

				case "selectModel":
					await this.selectModel(action.data?.modelId, action.data?.provider);
					break;

				case "setWcagLevel":
					await config.update("wcagLevel", action.data?.level, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(`✅ WCAG seviyesi ${action.data?.level} olarak ayarlandı`);
					break;

				case "setLanguage":
					await config.update("language", action.data?.language, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage("✅ Dil ayarı güncellendi");
					break;

				case "toggleAutoApply":
					const currentAutoApply = config.get("autoApply") || false;
					await config.update("autoApply", !currentAutoApply, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(`✅ Otomatik uygulama ${!currentAutoApply ? "etkinleştirildi" : "devre dışı bırakıldı"}`);
					break;

				case "toggleIncludeComments":
					const currentIncludeComments = config.get("includeComments") !== false;
					await config.update("includeComments", !currentIncludeComments, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(`✅ Açıklayıcı yorumlar ${!currentIncludeComments ? "dahil edilecek" : "dahil edilmeyecek"}`);
					break;

				case "toggleStatistics":
					const currentStats = config.get("enableStatistics") !== false;
					await config.update("enableStatistics", !currentStats, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(`✅ İstatistik takibi ${!currentStats ? "etkinleştirildi" : "devre dışı bırakıldı"}`);
					break;

				case "testConnection":
					await this.testConnection();
					break;

				case "showStatistics":
					await vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
					break;

				case "exportStatistics":
					await vscode.commands.executeCommand("wcagEnhancer.exportStatistics");
					break;

				case "resetStatistics":
					await vscode.commands.executeCommand("wcagEnhancer.resetStatistics");
					break;

				case "showWizard":
					await vscode.commands.executeCommand("wcagEnhancer.showWelcome");
					break;

				case "openKeybindings":
					await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", "@ext:wcagEnhancer");
					break;

				case "resetKeybindings":
					await this.resetKeybindings();
					break;

				case "openExternal":
					if (action.data?.url) {
						await vscode.env.openExternal(vscode.Uri.parse(action.data.url));
					}
					break;

				case "showModelPreferences":
					await this.showModelPreferences(action.data?.type);
					break;

				case "runCommand":
					if (action.data?.command) {
						await vscode.commands.executeCommand(action.data.command);
					}
					break;

				default:
					logger.warn("Unknown action type:", action.actionType);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`❌ Ayar güncellenirken hata oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
			logger.error("Ayar güncelleme hatası:", error);
		}
	}

	private async selectProvider(provider: string): Promise<void> {
		if (!provider) return;

		try {
			const success = await this.aiProviderManager.setProvider(provider);
			if (success) {
				vscode.window.showInformationMessage(`AI provider set to ${this.getProviderDisplayName(provider)}`);
			} else {
				vscode.window.showErrorMessage(`${this.getProviderDisplayName(provider)} provider is not available`);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`❌ Sağlayıcı ayarlanamadı: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
		}
	}

	private async setApiKey(): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		const currentKey = aiConfig.apiKey || "";

		const apiKey = await vscode.window.showInputBox({
			title: "🔑 Gemini API Anahtarı",
			prompt: "Google AI Studio'dan API anahtarınızı girin",
			placeHolder: "AIzaSy... (API anahtarınız)",
			password: true,
			value: currentKey,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return "❌ API anahtarı boş olamaz";
				}
				if (value.length < 20) {
					return "⚠️ API anahtarı çok kısa (minimum 20 karakter)";
				}
				if (!value.startsWith("AIza")) {
					return "⚠️ Gemini API anahtarları genellikle \"AIza\" ile başlar";
				}
				return null;
			}
		});

		if (apiKey !== undefined) {
			aiConfig.apiKey = apiKey;
			await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

			vscode.window.showInformationMessage(
				"✅ Gemini API anahtarı güncellendi!",
				"🧪 Bağlantıyı Test Et"
			).then(action => {
				if (action === "🧪 Bağlantıyı Test Et") {
					this.testConnection();
				}
			});
		}
	}

	private async selectModel(modelId: string, provider: string): Promise<void> {
		if (!modelId || !provider) return;

		try {
			const success = await this.aiProviderManager.setModel(modelId);
			if (success) {
				vscode.window.showInformationMessage(`✅ AI modeli ${modelId} olarak ayarlandı`);
			} else {
				vscode.window.showErrorMessage(`❌ Model ayarlanamadı: ${modelId}`);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`❌ Model ayarlanamadı: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
		}
	}

	private async testConnection(): Promise<void> {
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "🧪 AI bağlantısı test ediliyor...",
				cancellable: false
			}, async () => {
				const result = await this.aiTestUtils.testAIProvider();
				await this.aiTestUtils.showTestResult(result);
			});
		} catch (error) {
			vscode.window.showErrorMessage(`❌ Bağlantı testi başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
		}
	}

	private async resetKeybindings(): Promise<void> {
		const confirm = await vscode.window.showWarningMessage(
			"⚠️ Tüm AccessiMind klavye kısayolları varsayılan değerlerine sıfırlanacak. Devam etmek istiyor musunuz?",
			{ modal: true },
			"Sıfırla"
		);

		if (confirm === "Sıfırla") {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			await config.update("shortcuts", undefined, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage("✅ Klavye kısayolları varsayılan değerlerine sıfırlandı!");
		}
	}

	private async showModelPreferences(type: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const modelConfig = config.get("aiModels") as any || {};
		const preferences = modelConfig.modelPreferences || {};

		const title = type === "quick" ? "Hızlı İyileştirmeler İçin Model" : "Karmaşık Analiz İçin Model";
		const currentModel = type === "quick" ? preferences.forQuickImprovements : preferences.forComplexAnalysis;

		const availableModels = type === "quick"
			? [
				{ id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
				{ id: "gemini-flash-latest", name: "Gemini Flash Latest" },
				{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
				{ id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
				{ id: "gpt-4o-mini", name: "GPT-4o Mini" },
				{ id: "claude-3-haiku", name: "Claude 3 Haiku" }
			]
			: [
				{ id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
				{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
				{ id: "gpt-4o", name: "GPT-4o" },
				{ id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet" }
			];

		const options = availableModels.map(model => ({
			label: `${model.name}${model.id === currentModel ? " ✅" : ""}`,
			value: model.id
		}));

		const selected = await vscode.window.showQuickPick(options, {
			title: title,
			placeHolder: `Mevcut: ${currentModel || "Varsayılan"}`
		});

		if (selected) {
			const key = type === "quick" ? "forQuickImprovements" : "forComplexAnalysis";
			preferences[key] = selected.value;
			modelConfig.modelPreferences = preferences;
			await config.update("aiModels", modelConfig, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`✅ ${title} tercihi güncellendi`);
		}
	}
}

export class SettingItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly value: string,
		public readonly description: string,
		public readonly settingKey: string,
		public readonly iconName: string,
		public readonly actions?: SettingAction[],
		public readonly children?: SettingItem[]
	) {
		super(
			label,
			children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
		);

		this.tooltip = `${label}: ${description}`;
		this.description = value;
		this.iconPath = new vscode.ThemeIcon(iconName);
		this.contextValue = settingKey;

		if (actions && actions.length > 0) {
			this.command = {
				command: "wcagEnhancer.settings.itemClicked",
				title: "Ayarı Değiştir",
				arguments: [this]
			};
		}
	}
}

export class SettingCategory extends SettingItem {
	constructor(
		label: string,
		categoryKey: string,
		children: SettingItem[]
	) {
		super(label, "", "", categoryKey, "folder", undefined, children);
		this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
		this.contextValue = "category";
	}
}

export class SettingAction {
	constructor(
		public readonly label: string,
		public readonly actionType: string,
		public readonly data?: any
	) { }
}


