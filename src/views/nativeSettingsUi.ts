import * as vscode from "vscode";

import { AIProviderManager } from "../utils/aiProvider";
import {
	DISABILITY_FOCUS_OPTIONS,
	getDisabilityFocusSummary,
	normalizeDisabilityFocusGroups,
} from "../utils/disabilityFocus";
import { LocalizationManager } from "../utils/localizationManager";
import { getAiConfig, getNormalizedSelectedModel, updateNormalizedSelectedModel } from "../utils/configurationUtils";
import { OllamaProvider } from "../infrastructure/providers";

function t(localization: LocalizationManager, en: string, tr: string): string {
	return localization.getCurrentLanguage() === "tr" ? tr : en;
}

async function updateObjectSetting(
	config: vscode.WorkspaceConfiguration,
	key: string,
	patch: Record<string, unknown>
): Promise<void> {
	const current = config.get<Record<string, unknown>>(key, {});
	await config.update(key, { ...current, ...patch }, vscode.ConfigurationTarget.Global);
}

export class NativeSettingsUi {
	public static async open(): Promise<void> {
		const localization = LocalizationManager.getInstance();
		const providerManager = AIProviderManager.getInstance();

		for (;;) {
			const section = await vscode.window.showQuickPick([
				{ label: t(localization, "AI Provider & Models", "AI Sağlayıcı ve Modeller"), value: "ai" },
				{ label: t(localization, "General", "Genel"), value: "general" },
				{ label: t(localization, "Analysis", "Analiz"), value: "analysis" },
				{ label: "Jira", value: "jira" },
				{ label: t(localization, "Shortcuts", "Kısayollar"), value: "shortcuts" },
				{ label: t(localization, "Statistics", "İstatistikler"), value: "statistics" },
			], {
				title: "AccessiMind Settings",
				placeHolder: t(localization, "Choose a settings section", "Bir ayar bölümü seçin"),
				ignoreFocusOut: true,
			});

			if (!section) {
				return;
			}

			switch (section.value) {
				case "ai":
					await this.openAiSettings(localization, providerManager);
					break;
				case "general":
					await this.openGeneralSettings(localization);
					break;
				case "analysis":
					await this.openAnalysisSettings(localization);
					break;
				case "jira":
					await this.openJiraSettings(localization);
					break;
				case "shortcuts":
					await this.openShortcutSettings(localization);
					break;
				case "statistics":
					await this.openStatisticsSettings(localization);
					break;
			}
		}
	}

	private static async openAiSettings(localization: LocalizationManager, providerManager: AIProviderManager): Promise<void> {
		for (;;) {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = getAiConfig(config);
			const provider = aiConfig.provider || "gemini";
			const selectedModel = getNormalizedSelectedModel(config);

			const selection = await vscode.window.showQuickPick([
				{ label: t(localization, "Provider", "Sağlayıcı"), description: provider, value: "provider" },
				{ label: t(localization, "Model", "Model"), description: selectedModel, value: "model" },
				{ label: t(localization, "Gemini API Key", "Gemini API Anahtarı"), description: aiConfig.apiKey ? t(localization, "Configured", "Yapılandırıldı") : t(localization, "Not configured", "Yapılandırılmadı"), value: "apikey" },
				{ label: t(localization, "Test Connection", "Bağlantıyı Test Et"), value: "test" },
			], {
				title: t(localization, "AI Provider & Models", "AI Sağlayıcı ve Modeller"),
				ignoreFocusOut: true,
			});

			if (!selection) {
				return;
			}

			if (selection.value === "provider") {
				const next = await vscode.window.showQuickPick([
					{ label: "gemini", value: "gemini" },
					{ label: "vscode-copilot", value: "vscode-copilot" },
					{ label: "ollama", value: "ollama" },
					{ label: "codex-subscription", value: "codex-subscription" },
				], {
					title: t(localization, "Select provider", "Sağlayıcı seçin"),
					ignoreFocusOut: true,
				});

				if (next) {
					await config.update("ai", { ...aiConfig, provider: next.value }, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(t(localization, "AI provider updated.", "AI sağlayıcı güncellendi."));
				}
				continue;
			}

			if (selection.value === "model") {
				if (provider === "ollama") {
					const ollamaProvider = new OllamaProvider();
					const ollamaModels = await ollamaProvider.getAvailableModels();
					const modelOptions = ollamaModels.map((model) => ({
						label: model.name,
						description: model.description,
						value: model.id,
					}));

					if (modelOptions.length === 0) {
						vscode.window.showWarningMessage(
							t(
								localization,
								"No Ollama models were found. Check whether Ollama is running and models are installed.",
								"Ollama modeli bulunamadı. Ollama çalışıyor mu ve modeller kurulu mu kontrol edin."
							)
						);
						continue;
					}

					const next = await vscode.window.showQuickPick(modelOptions, {
						title: t(localization, "Select Ollama model", "Ollama modeli seçin"),
						placeHolder: t(localization, "Choose an installed Ollama model", "Kurulu bir Ollama modeli seçin"),
						ignoreFocusOut: true,
					});

					if (next) {
						await updateNormalizedSelectedModel(config, next.value);
						vscode.window.showInformationMessage(t(localization, "Ollama model updated.", "Ollama modeli güncellendi."));
					}
					continue;
				}

				const modelOptions = provider === "vscode-copilot"
					? (await providerManager.getAvailableCopilotModels()).map((model) => ({ label: model.name, value: model.id }))
					: provider === "codex-subscription"
						? (await providerManager.getAvailableModelsForProvider("codex-subscription")).map((model) => ({ label: model.name, value: model.id }))
						: (await providerManager.getAvailableModelsForProvider("gemini")).map((model) => ({ label: model.name, value: model.id }));

				const next = await vscode.window.showQuickPick(modelOptions, {
					title: t(localization, "Select model", "Model seçin"),
					ignoreFocusOut: true,
				});

				if (next) {
					await updateNormalizedSelectedModel(config, next.value);
					vscode.window.showInformationMessage(t(localization, "Model updated.", "Model güncellendi."));
				}
				continue;
			}

			if (selection.value === "apikey") {
				await vscode.commands.executeCommand("wcagEnhancer.setApiKey");
				continue;
			}

			await vscode.commands.executeCommand("wcagEnhancer.testAIConnection");
		}
	}

	private static async openGeneralSettings(localization: LocalizationManager): Promise<void> {
		for (;;) {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const prefs = config.get<Record<string, unknown>>("interfacePreferences", {});
			const selection = await vscode.window.showQuickPick([
				{ label: t(localization, "Language", "Dil"), description: String(config.get("language", "en")), value: "language" },
				{ label: t(localization, "Theme", "Tema"), description: String(prefs.theme || "auto"), value: "theme" },
				{ label: t(localization, "Show Notifications", "Bildirimleri Göster"), description: prefs.showNotifications !== false ? t(localization, "On", "Açık") : t(localization, "Off", "Kapalı"), value: "notifications" },
				{ label: t(localization, "Auto-save Improvements", "İyileştirmeleri Otomatik Kaydet"), description: prefs.autoSave === true ? t(localization, "On", "Açık") : t(localization, "Off", "Kapalı"), value: "autosave" },
			], {
				title: t(localization, "General Settings", "Genel Ayarlar"),
				ignoreFocusOut: true,
			});

			if (!selection) {
				return;
			}

			switch (selection.value) {
				case "language": {
					const next = await vscode.window.showQuickPick([
						{ label: t(localization, "Auto", "Otomatik"), value: "auto" },
						{ label: "English", value: "en" },
						{ label: "Türkçe", value: "tr" },
					], { title: t(localization, "Interface language", "Arayüz dili"), ignoreFocusOut: true });
					if (next) {
						await config.update("language", next.value, vscode.ConfigurationTarget.Global);
						vscode.window.showInformationMessage(t(localization, "Language updated.", "Dil güncellendi."));
					}
					break;
				}
				case "theme": {
					const next = await vscode.window.showQuickPick([
						{ label: t(localization, "Auto (System)", "Otomatik (Sistem)"), value: "auto" },
						{ label: t(localization, "Dark", "Koyu"), value: "dark" },
						{ label: t(localization, "Light", "Açık"), value: "light" },
					], { title: t(localization, "Theme", "Tema"), ignoreFocusOut: true });
					if (next) {
						await updateObjectSetting(config, "interfacePreferences", { theme: next.value });
						vscode.window.showInformationMessage(t(localization, "Theme preference saved.", "Tema tercihi kaydedildi."));
					}
					break;
				}
				case "notifications":
					await updateObjectSetting(config, "interfacePreferences", { showNotifications: prefs.showNotifications === false });
					vscode.window.showInformationMessage(t(localization, "Notification preference updated.", "Bildirim tercihi güncellendi."));
					break;
				case "autosave":
					await updateObjectSetting(config, "interfacePreferences", { autoSave: prefs.autoSave !== true });
					vscode.window.showInformationMessage(t(localization, "Auto-save preference updated.", "Otomatik kaydet tercihi güncellendi."));
					break;
			}
		}
	}

	private static async openAnalysisSettings(localization: LocalizationManager): Promise<void> {
		for (;;) {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const disabilityFocus = normalizeDisabilityFocusGroups(config.get("analysisDisabilityFocus", []));
			const selection = await vscode.window.showQuickPick([
				{ label: t(localization, "WCAG Level", "WCAG Seviyesi"), description: String(config.get("wcagLevel", "AA")), value: "wcag" },
				{ label: t(localization, "Strict Mode", "Kati Mod"), description: config.get("strictMode", false) ? t(localization, "On", "Acik") : t(localization, "Off", "Kapali"), value: "strict" },
				{ label: t(localization, "Custom Rules File", "Ozel Kurallar Dosyasi"), description: String(config.get("customRulesPath", "") || t(localization, "Not set", "Ayarlanmadi")), value: "rules" },
				{ label: t(localization, "Auto Apply", "Otomatik Uygula"), description: config.get("autoApply", false) ? t(localization, "On", "Acik") : t(localization, "Off", "Kapali"), value: "autoApply" },
				{ label: t(localization, "Context-aware Analysis", "Baglama Duyarli Analiz"), description: config.get("contextAwareAnalysis", true) ? t(localization, "On", "Acik") : t(localization, "Off", "Kapali"), value: "context" },
				{ label: t(localization, "Disability Focus Groups", "Engel Grubu Odaklari"), description: getDisabilityFocusSummary(disabilityFocus, localization.getCurrentLanguage() as "en" | "tr"), value: "disabilityFocus" },
				{ label: t(localization, "Include Comments", "Yorumlari Dahil Et"), description: Boolean(config.get("includeComments", true)) ? t(localization, "On", "Acik") : t(localization, "Off", "Kapali"), value: "comments" },
			], {
				title: t(localization, "Analysis Settings", "Analiz Ayarlari"),
				ignoreFocusOut: true,
			});

			if (!selection) {
				return;
			}

			switch (selection.value) {
				case "wcag": {
					const next = await vscode.window.showQuickPick([
						{ label: "A", value: "A" },
						{ label: "AA", value: "AA" },
						{ label: "AAA", value: "AAA" },
					], { title: t(localization, "WCAG Level", "WCAG Seviyesi"), ignoreFocusOut: true });
					if (next) {
						await config.update("wcagLevel", next.value, vscode.ConfigurationTarget.Global);
						vscode.window.showInformationMessage(t(localization, "WCAG level updated.", "WCAG seviyesi guncellendi."));
					}
					break;
				}
				case "strict":
					await config.update("strictMode", !config.get("strictMode", false), vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(t(localization, "Strict mode updated.", "Kati mod guncellendi."));
					break;
				case "rules": {
					const choice = await vscode.window.showQuickPick([
						{ label: t(localization, "Choose Markdown File", "Markdown Dosyasi Sec"), value: "pick" },
						{ label: t(localization, "Clear Current File", "Gecerli Dosyayi Temizle"), value: "clear" },
					], { title: t(localization, "Custom Rules File", "Ozel Kurallar Dosyasi"), ignoreFocusOut: true });
					if (choice?.value === "pick") {
						const files = await vscode.window.showOpenDialog({
							canSelectMany: false,
							filters: { Markdown: ["md"] },
							title: t(localization, "Select custom rules file", "Ozel kurallar dosyasini secin"),
						});
						if (files?.[0]) {
							await config.update("customRulesPath", files[0].fsPath, vscode.ConfigurationTarget.Global);
							vscode.window.showInformationMessage(t(localization, "Custom rules file saved.", "Ozel kurallar dosyasi kaydedildi."));
						}
					}
					if (choice?.value === "clear") {
						await config.update("customRulesPath", "", vscode.ConfigurationTarget.Global);
						vscode.window.showInformationMessage(t(localization, "Custom rules file cleared.", "Ozel kurallar dosyasi temizlendi."));
					}
					break;
				}
				case "autoApply":
					await config.update("autoApply", !config.get("autoApply", false), vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(t(localization, "Auto apply updated.", "Otomatik uygulama guncellendi."));
					break;
				case "context":
					await config.update("contextAwareAnalysis", !config.get("contextAwareAnalysis", true), vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(t(localization, "Context-aware analysis updated.", "Baglama duyarli analiz guncellendi."));
					break;
				case "disabilityFocus": {
					const picks = await vscode.window.showQuickPick(
						DISABILITY_FOCUS_OPTIONS.map((option) => ({
							label: option.label,
							description: option.description,
							value: option.id,
							picked: disabilityFocus.includes(option.id),
						})),
						{
							title: t(localization, "Choose disability focus groups", "Odaklanilacak engel gruplarini secin"),
							placeHolder: t(localization, "Leave empty to balance all groups", "Tum gruplara dengeli yaklasmak icin bos birakin"),
							canPickMany: true,
							ignoreFocusOut: true,
						}
					);
					if (picks) {
						await config.update("analysisDisabilityFocus", picks.map((pick) => pick.value), vscode.ConfigurationTarget.Global);
						vscode.window.showInformationMessage(t(localization, "Disability focus updated.", "Engel grubu odaklari guncellendi."));
					}
					break;
				}
				case "comments":
					await config.update("includeComments", !Boolean(config.get("includeComments", true)), vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(t(localization, "Comment preference updated.", "Yorum tercihi guncellendi."));
					break;
			}
		}
	}
	private static async openJiraSettings(localization: LocalizationManager): Promise<void> {
		for (;;) {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const jira = config.get<Record<string, unknown>>("jira", {});
			const selection = await vscode.window.showQuickPick([
				{ label: t(localization, "Base URL", "Temel URL"), description: String(jira.baseUrl || t(localization, "Not set", "Ayarlanmadı")), value: "baseUrl" },
				{ label: t(localization, "Project Key", "Proje Anahtarı"), description: String(jira.projectKey || t(localization, "Not set", "Ayarlanmadı")), value: "projectKey" },
				{ label: t(localization, "Issue Type", "Issue Türü"), description: String(jira.issueType || "Bug"), value: "issueType" },
				{ label: t(localization, "Auto-create Issues", "Issue'ları Otomatik Oluştur"), description: Boolean(jira.autoCreateIssues) ? t(localization, "On", "Açık") : t(localization, "Off", "Kapalı"), value: "autoCreate" },
				{ label: t(localization, "Priority Mapping", "Öncelik Eşlemesi"), description: String(jira.priorityMapping || "severity"), value: "priority" },
			], {
				title: "Jira Settings",
				ignoreFocusOut: true,
			});

			if (!selection) {
				return;
			}

			switch (selection.value) {
				case "baseUrl": {
					const next = await vscode.window.showInputBox({ title: "Jira Base URL", value: String(jira.baseUrl || ""), ignoreFocusOut: true });
					if (next !== undefined) {
						await updateObjectSetting(config, "jira", { baseUrl: next.trim() });
						vscode.window.showInformationMessage(t(localization, "Jira base URL saved.", "Jira temel URL kaydedildi."));
					}
					break;
				}
				case "projectKey": {
					const next = await vscode.window.showInputBox({ title: "Jira Project Key", value: String(jira.projectKey || ""), ignoreFocusOut: true });
					if (next !== undefined) {
						await updateObjectSetting(config, "jira", { projectKey: next.trim() });
						vscode.window.showInformationMessage(t(localization, "Jira project key saved.", "Jira proje anahtarı kaydedildi."));
					}
					break;
				}
				case "issueType": {
					const next = await vscode.window.showQuickPick([
						{ label: "Bug", value: "Bug" },
						{ label: "Task", value: "Task" },
						{ label: "Story", value: "Story" },
						{ label: "Improvement", value: "Improvement" },
					], { title: "Jira Issue Type", ignoreFocusOut: true });
					if (next) {
						await updateObjectSetting(config, "jira", { issueType: next.value });
						vscode.window.showInformationMessage(t(localization, "Jira issue type updated.", "Jira issue türü güncellendi."));
					}
					break;
				}
				case "autoCreate":
					await updateObjectSetting(config, "jira", { autoCreateIssues: !Boolean(jira.autoCreateIssues) });
					vscode.window.showInformationMessage(t(localization, "Jira auto-create preference updated.", "Jira otomatik oluşturma tercihi güncellendi."));
					break;
				case "priority": {
					const next = await vscode.window.showQuickPick([
						{ label: "severity", value: "severity" },
						{ label: "level", value: "level" },
						{ label: "impact", value: "impact" },
					], { title: t(localization, "Priority Mapping", "Öncelik Eşlemesi"), ignoreFocusOut: true });
					if (next) {
						await updateObjectSetting(config, "jira", { priorityMapping: next.value });
						vscode.window.showInformationMessage(t(localization, "Jira priority mapping updated.", "Jira öncelik eşlemesi güncellendi."));
					}
					break;
				}
			}
		}
	}

	private static async openShortcutSettings(localization: LocalizationManager): Promise<void> {
		const selection = await vscode.window.showQuickPick([
			{ label: t(localization, "Open Keyboard Shortcuts", "Klavye Kısayollarını Aç"), value: "open" },
			{ label: t(localization, "Reset AccessiMind Shortcuts", "AccessiMind Kısayollarını Sıfırla"), value: "reset" },
		], {
			title: t(localization, "Shortcut Settings", "Kısayol Ayarları"),
			ignoreFocusOut: true,
		});

		if (!selection) {
			return;
		}

		if (selection.value === "open") {
			await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", "@ext:wcagEnhancer");
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			t(localization, "Reset AccessiMind shortcut settings to defaults?", "AccessiMind kısayol ayarları varsayılanlara sıfırlansın mı?"),
			{ modal: true },
			t(localization, "Reset", "Sıfırla")
		);

		if (confirm === t(localization, "Reset", "Sıfırla")) {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			await config.update("shortcuts", undefined, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(t(localization, "Shortcut settings reset.", "Kısayol ayarları sıfırlandı."));
		}
	}

	private static async openStatisticsSettings(localization: LocalizationManager): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const enabled = Boolean(config.get("enableStatistics", true));
		const selection = await vscode.window.showQuickPick([
			{ label: t(localization, "Statistics Tracking", "İstatistik Takibi"), description: enabled ? t(localization, "On", "Açık") : t(localization, "Off", "Kapalı"), value: "toggle" },
			{ label: t(localization, "Show Detailed Statistics", "Detaylı İstatistikleri Göster"), value: "show" },
			{ label: t(localization, "Export Statistics", "İstatistikleri Dışa Aktar"), value: "export" },
			{ label: t(localization, "Reset Statistics", "İstatistikleri Sıfırla"), value: "reset" },
		], {
			title: t(localization, "Statistics", "İstatistikler"),
			ignoreFocusOut: true,
		});

		if (!selection) {
			return;
		}

		switch (selection.value) {
			case "toggle":
				await config.update("enableStatistics", !enabled, vscode.ConfigurationTarget.Global);
				vscode.window.showInformationMessage(t(localization, "Statistics preference updated.", "İstatistik tercihi güncellendi."));
				break;
			case "show":
				await vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
				break;
			case "export":
				await vscode.commands.executeCommand("wcagEnhancer.exportStatistics");
				break;
			case "reset":
				await vscode.commands.executeCommand("wcagEnhancer.resetStatistics");
				break;
		}
	}
}

