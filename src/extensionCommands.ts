import * as vscode from "vscode";

import { LocalizationManager } from "./utils/localizationManager";
import { PersistentSettingsManager } from "./utils/persistentSettingsManager";
import { SettingsViewProvider } from "./views/settingsViewProvider";

interface RegisterExtensionCommandsOptions {
	context: vscode.ExtensionContext;
	settingsViewProvider: SettingsViewProvider;
	persistentSettingsManager: PersistentSettingsManager;
	onAnalyzeOpenCode: () => Promise<void>;
	onAnalyzeSelectedCode: () => Promise<void>;
	onPreviewImprovement: () => Promise<void>;
	onCreateJiraTask: () => Promise<void>;
	onSetApiKey: () => Promise<void>;
	onTestAIConnection: () => Promise<void>;
	onShowWelcome: () => Promise<void>;
	onShowDetailedStatistics: () => Promise<void>;
	onExportStatistics: () => Promise<void>;
	onResetStatistics: () => Promise<void>;
	onInlineChat: () => Promise<void>;
	onOpenSettings: () => void;
	onOpenHelp: () => void;
	onShowInBrowser: () => Promise<void>;
	onRunUserJourneyScan: () => Promise<void>;
	onRunDomDiffRisk: () => Promise<void>;
	onRunDesignTokenGuard: () => Promise<void>;
	onAnalyzeComponentMemory: () => Promise<void>;
	onApplyLastFixToSimilar: () => Promise<void>;
	onGenerateA11yTest: () => Promise<void>;
	onGeneratePrSummary: () => Promise<void>;
	onRunRegressionShield: () => Promise<void>;
	onStartAgentSession: () => Promise<void>;
	onSelectProviderModel: () => Promise<void>;
	onConnectCodexAccount: () => Promise<void>;
	onTestCodexAccount: () => Promise<void>;
	onOpenChatGptBridge: () => Promise<void>;
	onConfigureChatGptAuth: () => Promise<void>;
	onOpenChatGptAuthGuide: () => Promise<void>;
}

export function registerExtensionCommands({
	context,
	settingsViewProvider,
	persistentSettingsManager,
	onAnalyzeOpenCode,
	onAnalyzeSelectedCode,
	onPreviewImprovement,
	onCreateJiraTask,
	onSetApiKey,
	onTestAIConnection,
	onShowWelcome,
	onShowDetailedStatistics,
	onExportStatistics,
	onResetStatistics,
	onInlineChat,
	onOpenSettings,
	onOpenHelp,
	onShowInBrowser,
	onRunUserJourneyScan,
	onRunDomDiffRisk,
	onRunDesignTokenGuard,
	onAnalyzeComponentMemory,
	onApplyLastFixToSimilar,
	onGenerateA11yTest,
	onGeneratePrSummary,
	onRunRegressionShield,
	onStartAgentSession,
	onSelectProviderModel,
	onConnectCodexAccount,
	onTestCodexAccount,
	onOpenChatGptBridge,
	onConfigureChatGptAuth,
	onOpenChatGptAuthGuide,
}: RegisterExtensionCommandsOptions): void {
	const localization = LocalizationManager.getInstance();
	const t = (en: string, tr: string) => (localization.getCurrentLanguage() === "tr" ? tr : en);

	context.subscriptions.push(
		vscode.commands.registerCommand("wcagEnhancer.analyzeOpenCode", onAnalyzeOpenCode),
		vscode.commands.registerCommand("wcagEnhancer.analyzeSelectedCode", onAnalyzeSelectedCode),
		vscode.commands.registerCommand("wcagEnhancer.previewImprovement", onPreviewImprovement),
		vscode.commands.registerCommand("wcagEnhancer.createJiraTask", onCreateJiraTask),
		vscode.commands.registerCommand("wcagEnhancer.setApiKey", onSetApiKey),
		vscode.commands.registerCommand("wcagEnhancer.testAIConnection", onTestAIConnection),
		vscode.commands.registerCommand("wcagEnhancer.showWelcome", onShowWelcome),
		vscode.commands.registerCommand("wcagEnhancer.showDetailedStatistics", onShowDetailedStatistics),
		vscode.commands.registerCommand("wcagEnhancer.exportStatistics", onExportStatistics),
		vscode.commands.registerCommand("wcagEnhancer.resetStatistics", onResetStatistics),
		vscode.commands.registerCommand("wcagEnhancer.openChat", async () => {
			await vscode.commands.executeCommand("wcagEnhancer.chatView.focus");
		}),
		vscode.commands.registerCommand("wcagEnhancer.inlineChat", onInlineChat),
		vscode.commands.registerCommand("wcagEnhancer.settings.itemClicked", async (item) => {
			await settingsViewProvider.handleSettingClick(item);
		}),
		vscode.commands.registerCommand("wcagEnhancer.openSettings", async () => {
			onOpenSettings();
		}),
		vscode.commands.registerCommand("wcagEnhancer.openHelp", async () => {
			onOpenHelp();
		}),
		vscode.commands.registerCommand("wcagEnhancer.userJourneyScan", onRunUserJourneyScan),
		vscode.commands.registerCommand("wcagEnhancer.domDiffRisk", onRunDomDiffRisk),
		vscode.commands.registerCommand("wcagEnhancer.designTokenGuard", onRunDesignTokenGuard),
		vscode.commands.registerCommand("wcagEnhancer.componentMemory", onAnalyzeComponentMemory),
		vscode.commands.registerCommand("wcagEnhancer.applyLastFixToSimilar", onApplyLastFixToSimilar),
		vscode.commands.registerCommand("wcagEnhancer.generateA11yTest", onGenerateA11yTest),
		vscode.commands.registerCommand("wcagEnhancer.generatePrSummary", onGeneratePrSummary),
		vscode.commands.registerCommand("wcagEnhancer.regressionShield", onRunRegressionShield),
		vscode.commands.registerCommand("wcagEnhancer.startAgentSession", onStartAgentSession),
		vscode.commands.registerCommand("wcagEnhancer.selectProviderModel", onSelectProviderModel),
		vscode.commands.registerCommand("wcagEnhancer.connectCodexAccount", onConnectCodexAccount),
		vscode.commands.registerCommand("wcagEnhancer.testCodexAccount", onTestCodexAccount),
		vscode.commands.registerCommand("wcagEnhancer.openChatGptBridge", onOpenChatGptBridge),
		vscode.commands.registerCommand("wcagEnhancer.configureChatGptAuth", onConfigureChatGptAuth),
		vscode.commands.registerCommand("wcagEnhancer.openChatGptAuthGuide", onOpenChatGptAuthGuide),
		vscode.commands.registerCommand("wcagEnhancer.restoreSettings", async () => {
			await persistentSettingsManager.restoreSettings();
		}),
		vscode.commands.registerCommand("wcagEnhancer.exportSettings", async () => {
			await persistentSettingsManager.exportPersistedSettings();
		}),
		vscode.commands.registerCommand("wcagEnhancer.importSettings", async () => {
			await persistentSettingsManager.importPersistedSettings();
		}),
		vscode.commands.registerCommand("wcagEnhancer.clearPersistedSettings", async () => {
			const action = await vscode.window.showWarningMessage(
				t(
					"Are you sure you want to clear all persistent settings? This action cannot be undone.",
					"Tüm kalıcı ayarları temizlemek istediğinize emin misiniz? Bu işlem geri alınamaz."
				),
				{ modal: true },
				t("Clear Persistent Settings", "Kalıcı Ayarları Temizle")
			);

			if (action === t("Clear Persistent Settings", "Kalıcı Ayarları Temizle")) {
				await persistentSettingsManager.clearPersistedSettings();
			}
		}),
		vscode.commands.registerCommand("wcagEnhancer.showSettingsStatus", async () => {
			const status = persistentSettingsManager.getSettingsStatus();
			const message = `${t("AccessiMind Settings Status", "AccessiMind Ayar Durumu")}:

${t("Global Settings", "Genel Ayarlar")}: ${status.globalSettingsCount} ${t("items", "öğe")}
${t("Workspace Settings", "Çalışma Alanı Ayarları")}: ${status.workspaceSettingsCount} ${t("items", "öğe")}
${t("Cache Size", "Önbellek Boyutu")}: ${status.cacheSize} ${t("items", "öğe")}
${t("Persistent Settings", "Kalıcı Ayarlar")}: ${status.hasPersistedSettings ? t("Available", "Mevcut") : t("Not Found", "Bulunamadı")}`;

			vscode.window.showInformationMessage(message);
		}),
		vscode.commands.registerCommand("wcagEnhancer.showInBrowser", onShowInBrowser)
	);
}
