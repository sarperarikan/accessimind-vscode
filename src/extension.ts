// extension.ts
import * as vscode from 'vscode';
import { StatsViewProvider } from "./views/statsViewProvider";
import { ModernStatsViewProvider } from "./views/modernStatsViewProvider";
import { SettingsViewProvider } from "./views/settingsViewProvider";
import { TabbedMainViewProvider } from "./views/tabbedMainViewProvider";
import { ChatViewProvider } from "./views/chatViewProvider";
import { ModernSettingsPanel } from "./views/modernSettingsPanel";
import { HelpPanel } from "./views/helpPanel";
import { WcagImprover } from "./core/wcagImprover";
import { StatisticsManager } from "./utils/statisticsManager";
import { AIProviderManager } from "./utils/aiProvider";
import { LocalizationManager } from "./utils/localizationManager";
import { PersistentSettingsManager } from "./utils/persistentSettingsManager";
import { AccessiMindJsonManager } from "./utils/accessiMindJsonManager";
import { SettingsManager } from "./utils/settingsManager";
import { logger } from "./utils/logger";
import { initializeImprovementCommands } from "./improvementCommands";
import { initializeProviderCommands } from "./providerCommands";
import { initializeJiraTaskCommands, createJiraTask } from "./jiraTaskCommands";
import { WizardManager } from "./wizardManager";

let wcagImprover: WcagImprover;
let aiProviderManager: AIProviderManager;
let statisticsManager: StatisticsManager;
let statsViewProvider: StatsViewProvider;
let modernStatsViewProvider: ModernStatsViewProvider;
let settingsViewProvider: SettingsViewProvider;
let tabbedMainViewProvider: TabbedMainViewProvider;
let localization: LocalizationManager;
let persistentSettingsManager: PersistentSettingsManager;
let jsonManager: AccessiMindJsonManager;
let settingsManager: SettingsManager;
let statusBarItem: vscode.StatusBarItem;
let wizardManager: WizardManager;

export async function activate(context: vscode.ExtensionContext) {
	try {
		logger.info('🚀 AccessiMind activation starting...');

		// Initialize core components
		wcagImprover = new WcagImprover();
		aiProviderManager = AIProviderManager.getInstance();
		statisticsManager = StatisticsManager.getInstance(context);
		localization = LocalizationManager.getInstance();
		wizardManager = WizardManager.getInstance();

		// Initialize persistent settings manager
		persistentSettingsManager = PersistentSettingsManager.getInstance(context);
		await persistentSettingsManager.initialize();

		// Initialize JSON manager
		jsonManager = AccessiMindJsonManager.getInstance(context);
		await jsonManager.initialize();

		// Initialize standard settings manager
		settingsManager = SettingsManager.getInstance();

		// Connect wizard manager with persistent settings manager and JSON manager
		wizardManager.setPersistentSettingsManager(persistentSettingsManager);
		wizardManager.setJsonManager(jsonManager);

		// Initialize view providers
		statsViewProvider = new StatsViewProvider(context.extensionUri);
		modernStatsViewProvider = new ModernStatsViewProvider(context.extensionUri);
		settingsViewProvider = new SettingsViewProvider(context);
		tabbedMainViewProvider = new TabbedMainViewProvider(context.extensionUri, context);
		// Set up real-time statistics for view providers
		statsViewProvider.setStatisticsManager(statisticsManager);
		modernStatsViewProvider.setStatisticsManager(statisticsManager);

		// Initialize improvement commands module
		initializeImprovementCommands(
			aiProviderManager,
			statisticsManager,
			localization,
			statsViewProvider,
			modernStatsViewProvider,
			updateStatusBar
		);

		// Initialize provider commands module
		initializeProviderCommands(
			aiProviderManager,
			statisticsManager,
			localization,
			statsViewProvider,
			modernStatsViewProvider,
			updateStatusBar
		);

		// Initialize Jira task commands module
		initializeJiraTaskCommands(
			aiProviderManager,
			statisticsManager
		);

		// Register view providers
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider('wcagEnhancer.statsView', statsViewProvider),
			vscode.window.registerWebviewViewProvider('wcagEnhancer.modernStatsView', modernStatsViewProvider),
			vscode.window.registerWebviewViewProvider('wcagEnhancer.tabbedMainView', tabbedMainViewProvider),
			vscode.window.registerWebviewViewProvider('wcagEnhancer.chatView', new ChatViewProvider(context.extensionUri)),
			vscode.window.registerTreeDataProvider('wcagEnhancer.settingsView', settingsViewProvider),
		);

		// Register commands
		registerCommands(context);

		// Register JSON Manager commands
		registerJsonManagerCommands(context);

		// Initialize status bar
		initializeStatusBar(context);

		// Register dynamic keybindings
		registerDynamicKeybindings(context);

		// Setup settings change listener for JSON sync
		setupSettingsChangeListener();

		// Load and apply saved settings (enhanced with persistent settings)
		await loadSavedSettings();

		// JSON dosyasından ayarları yükle (eğer wizard tamamlanmışsa)
		await loadSettingsFromJson();

		// Restore persistent settings if available (JSON'dan sonra, böylece persistent settings öncelik alır)
		await persistentSettingsManager.restoreSettings();

		// Show welcome message on first activation
		showWelcomeMessage(context);

		logger.info('✅ AccessiMind successfully activated!');
	} catch (error) {
		logger.error('❌ AccessiMind activation failed:', error);
		vscode.window.showErrorMessage(`AccessiMind initialization failed: ${error instanceof Error ? error.message : String(error)}`);
		// Re-throw to let VS Code know activation failed
		throw error;
	}
}

function registerCommands(context: vscode.ExtensionContext) {
	// New WCAG analysis commands
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.analyzeOpenCode', async () => {
			await analyzeOpenCodeStructures();
		}),

		vscode.commands.registerCommand('wcagEnhancer.analyzeSelectedCode', async () => {
			await analyzeSelectedCodeStructure();
		}),

		vscode.commands.registerCommand('wcagEnhancer.createJiraTask', async () => {
			await createJiraTask();
		}),

		vscode.commands.registerCommand('wcagEnhancer.setApiKey', async () => {
			await setApiKey();
		}),

		vscode.commands.registerCommand('wcagEnhancer.testAIConnection', async () => {
			await testAIConnection();
		}),

		vscode.commands.registerCommand('wcagEnhancer.showWelcome', async () => {
			await showDetailedWelcomeScreen();
		}),

		vscode.commands.registerCommand('wcagEnhancer.showDetailedStatistics', async () => {
			await showDetailedStatistics();
		}),

		vscode.commands.registerCommand('wcagEnhancer.exportStatistics', async () => {
			await exportStatistics();
		}),

		vscode.commands.registerCommand('wcagEnhancer.resetStatistics', async () => {
			await resetStatistics();
		}),


		vscode.commands.registerCommand('wcagEnhancer.openChat', async () => {
			await vscode.commands.executeCommand('wcagEnhancer.chatView.focus');
		}),

		vscode.commands.registerCommand('wcagEnhancer.inlineChat', async () => {
			await handleInlineChat();
		}),

		// Settings TreeView command
		vscode.commands.registerCommand('wcagEnhancer.settings.itemClicked', async (item) => {
			await settingsViewProvider.handleSettingClick(item);
		}),

		// Open Modern Settings Panel
		vscode.commands.registerCommand('wcagEnhancer.openSettings', async () => {
			ModernSettingsPanel.createOrShow(context);
		}),

		// Open Help Panel
		vscode.commands.registerCommand('wcagEnhancer.openHelp', async () => {
			HelpPanel.createOrShow();
		}),

		// Persistent Settings Management Commands
		vscode.commands.registerCommand('wcagEnhancer.restoreSettings', async () => {
			await persistentSettingsManager.restoreSettings();
		}),

		vscode.commands.registerCommand('wcagEnhancer.exportSettings', async () => {
			await persistentSettingsManager.exportPersistedSettings();
		}),

		vscode.commands.registerCommand('wcagEnhancer.importSettings', async () => {
			await persistentSettingsManager.importPersistedSettings();
		}),

		vscode.commands.registerCommand('wcagEnhancer.clearPersistedSettings', async () => {
			const action = await vscode.window.showWarningMessage(
				'⚠️ Are you sure you want to clear all persistent settings? This action cannot be undone.',
				{ modal: true },
				'Clear Persistent Settings'
			);

			if (action === 'Clear Persistent Settings') {
				await persistentSettingsManager.clearPersistedSettings();
			}
		}),

		vscode.commands.registerCommand('wcagEnhancer.showSettingsStatus', async () => {
			const status = persistentSettingsManager.getSettingsStatus();
			const message = `📊 AccessiMind Settings Status:
			
🌍 Global Settings: ${status.globalSettingsCount} items
📁 Workspace Settings: ${status.workspaceSettingsCount} items
💾 Cache Size: ${status.cacheSize} items
✅ Persistent Settings: ${status.hasPersistedSettings ? 'Available' : 'Not Found'}`;

			vscode.window.showInformationMessage(message);
		})
	);
}

async function analyzeOpenCodeStructures(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("❌ No active file found");
		return;
	}

	const document = editor.document;
	const fileName = document.fileName;
	const language = document.languageId;
	const code = document.getText();

	if (!code.trim()) {
		vscode.window.showErrorMessage("❌ File is empty");
		return;
	}

	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "🔍 Analyzing open code structures...",
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();

			progress.report({ increment: 0, message: "Preparing AI provider..." });

			const provider = await aiProviderManager.getCurrentProviderInstance();

			progress.report({ increment: 30, message: "Analyzing code structures..." });

			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const wcagLevel = config.get("wcagLevel") as "A" | "AA" | "AAA" || "AA";
			const includeComments = config.get("includeComments") !== false;

			const currentProviderName = aiProviderManager.getCurrentProviderName();
			progress.report({ increment: 60, message: `Performing WCAG conformance check with ${currentProviderName}...` });

			// WCAG analysis and implementation
			const analysisPrompt = `
Analyze all structures in the following ${language} code and add necessary ARIA implementations for WCAG ${wcagLevel} conformance:

FILE: ${fileName}
LANGUAGE: ${language}

CODE:
\`\`\`${language}
${code}
\`\`\`

TASKS:
1. Analyze all HTML elements
2. Add missing ARIA labels
3. Fix missing semantic HTML structures
4. Improve keyboard navigation
5. Resolve color contrast issues
6. Add comment lines for each change

OUTPUT FORMAT:
- Return only the corrected code
- Add /* WCAG: description */ comment for each WCAG/ARIA addition
- Preserve original code structure
`;

			const improvementResult = await provider.improveCode({
				code: analysisPrompt,
				fileType: fileName.split(".").pop() || "unknown",
				language,
				wcagLevel,
				includeComments: true
			});

			const processingTime = Date.now() - startTime;

			progress.report({ increment: 90, message: "Updating code..." });

			if (improvementResult.success && improvementResult.content) {
				// Extract the improved code from the AI response
				const improvedCodeMatch = improvementResult.content.match(/```[\w]*\n([\s\S]*?)\n```/);
				const finalCode = improvedCodeMatch ? improvedCodeMatch[1] : improvementResult.content;

				// Apply the improved code to the editor
				await editor.edit(editBuilder => {
					const fullRange = new vscode.Range(
						document.positionAt(0),
						document.positionAt(code.length)
					);
					editBuilder.replace(fullRange, finalCode);
				});

				// Record statistics
				const linesImproved = finalCode.split('\n').length;
				statisticsManager.recordImprovement({
					type: "file",
					language,
					fileName,
					linesImproved,
					processingTime,
					provider: aiProviderManager.getCurrentProviderName() as "gemini" | "vscode-copilot",
					model: "current",
					wcagCriteria: extractWcagCriteriaFromCode(finalCode),
					tokensUsed: improvementResult.tokensUsed || 0
				});

				// Update views
				const stats = statisticsManager.getDetailedStatistics();
				statsViewProvider.updateStatistics(stats);
				modernStatsViewProvider.updateStatistics(stats);
				updateStatusBar();

				vscode.window.showInformationMessage(
					`✅ WCAG analysis completed with ${currentProviderName}! ${linesImproved} lines improved (${processingTime}ms)`
				);
			} else {
				const errorMessage = improvementResult.error || "Bilinmeyen hata oluştu";
				vscode.window.showErrorMessage(`❌ WCAG analysis failed: ${errorMessage}`);

				// API anahtarı eksikse kullanıcıyı ayarlara yönlendir
				if (errorMessage.includes("API anahtarı") || errorMessage.includes("API key")) {
					const action = await vscode.window.showErrorMessage(
						"API anahtarı yapılandırması gerekli. Ayarlar sayfasına gitmek ister misiniz?",
						"Ayarlara Git"
					);
					if (action === "Ayarlara Git") {
						vscode.commands.executeCommand('wcagEnhancer.setApiKey');
					}
				}
			}
		});
	} catch (error) {
		logger.error("WCAG analysis error:", error);

		let errorMessage = "Bilinmeyen hata oluştu";
		if (error instanceof Error) {
			errorMessage = error.message;
		} else if (typeof error === 'string') {
			errorMessage = error;
		}

		vscode.window.showErrorMessage(`❌ WCAG analysis error: ${errorMessage}`);

		// API anahtarı eksikse kullanıcıyı ayarlara yönlendir
		if (errorMessage.includes("API anahtarı") || errorMessage.includes("API key")) {
			const action = await vscode.window.showErrorMessage(
				"API anahtarı yapılandırması gerekli. Ayarlar sayfasına gitmek ister misiniz?",
				"Ayarlara Git"
			);
			if (action === "Ayarlara Git") {
				vscode.commands.executeCommand('wcagEnhancer.setApiKey');
			}
		}
	}
}

async function analyzeSelectedCodeStructure(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("❌ No active file found");
		return;
	}

	const selection = editor.selection;
	if (selection.isEmpty) {
		vscode.window.showErrorMessage("❌ Please select code to analyze");
		return;
	}

	const document = editor.document;
	const fileName = document.fileName;
	const language = document.languageId;
	const selectedCode = document.getText(selection);

	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "🔍 Analyzing selected code structure...",
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();

			progress.report({ increment: 0, message: "Preparing AI provider..." });

			const provider = await aiProviderManager.getCurrentProviderInstance();

			progress.report({ increment: 30, message: "Analyzing selected code..." });

			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const wcagLevel = config.get("wcagLevel") as "A" | "AA" | "AAA" || "AA";
			const includeComments = config.get("includeComments") !== false;

			const currentProviderName = aiProviderManager.getCurrentProviderName();
			progress.report({ increment: 60, message: `Applying WCAG implementation with ${currentProviderName}...` });

			// WCAG analizi ve implementasyonu için özel prompt
			const analysisPrompt = `
Aşağıdaki ${language} kod parçasını WCAG ${wcagLevel} uyumu için analiz et ve iyileştir:

DOSYA: ${fileName}
LANGUAGE: ${language}

SEÇİLİ KOD:
\`\`\`${language}
${selectedCode}
\`\`\`

GÖREVLER:
1. Kod yapısını WCAG standartlarına göre analiz et
2. Eksik ARIA özelliklerini ekle
3. Semantik HTML kullanımını iyileştir
4. Erişilebilirlik etiketlerini ekle
5. Her ekleme için açıklayıcı yorum satırı ekle

ÇIKTI FORMAT:
- Sadece iyileştirilmiş kodu döndür
- Her WCAG/ARIA eklentisi için /* WCAG: detaylı açıklama */ yorum ekle
- Orijinal kod yapısını ve formatlama stilini koru
`;

			const improvementResult = await provider.improveCode({
				code: analysisPrompt,
				fileType: fileName.split(".").pop() || "unknown",
				language,
				wcagLevel,
				includeComments: true
			});

			const processingTime = Date.now() - startTime;

			progress.report({ increment: 90, message: "Updating code..." });

			if (improvementResult.success && improvementResult.content) {
				// Extract the improved code from the AI response
				const improvedCodeMatch = improvementResult.content.match(/```[\w]*\n([\s\S]*?)\n```/);
				const finalCode = improvedCodeMatch ? improvedCodeMatch[1] : improvementResult.content;

				// Replace the selected code
				await editor.edit(editBuilder => {
					editBuilder.replace(selection, finalCode);
				});

				// Record statistics
				const linesImproved = finalCode.split('\n').length;
				statisticsManager.recordImprovement({
					type: "selection",
					language,
					fileName,
					linesImproved,
					processingTime,
					provider: aiProviderManager.getCurrentProviderName() as "gemini" | "vscode-copilot",
					model: "current",
					wcagCriteria: extractWcagCriteriaFromCode(finalCode),
					tokensUsed: improvementResult.tokensUsed || 0
				});

				// Update views
				const stats = statisticsManager.getDetailedStatistics();
				statsViewProvider.updateStatistics(stats);
				modernStatsViewProvider.updateStatistics(stats);
				updateStatusBar();

				vscode.window.showInformationMessage(
					`✅ Selected code WCAG analysis completed with ${currentProviderName}! ${linesImproved} lines improved (${processingTime}ms)`
				);
			} else {
				const errorMessage = improvementResult.error || "Bilinmeyen hata oluştu";
				vscode.window.showErrorMessage(`❌ Selected code WCAG analysis failed: ${errorMessage}`);

				// API anahtarı eksikse kullanıcıyı ayarlara yönlendir
				if (errorMessage.includes("API anahtarı") || errorMessage.includes("API key")) {
					const action = await vscode.window.showErrorMessage(
						"API anahtarı yapılandırması gerekli. Ayarlar sayfasına gitmek ister misiniz?",
						"Ayarlara Git"
					);
					if (action === "Ayarlara Git") {
						vscode.commands.executeCommand('wcagEnhancer.setApiKey');
					}
				}
			}
		});
	} catch (error) {
		logger.error("Selected code WCAG analysis error:", error);

		let errorMessage = "Bilinmeyen hata oluştu";
		if (error instanceof Error) {
			errorMessage = error.message;
		} else if (typeof error === 'string') {
			errorMessage = error;
		}

		vscode.window.showErrorMessage(`❌ Selected code WCAG analysis error: ${errorMessage}`);

		// API anahtarı eksikse kullanıcıyı ayarlara yönlendir
		if (errorMessage.includes("API anahtarı") || errorMessage.includes("API key")) {
			const action = await vscode.window.showErrorMessage(
				"API anahtarı yapılandırması gerekli. Ayarlar sayfasına gitmek ister misiniz?",
				"Ayarlara Git"
			);
			if (action === "Ayarlara Git") {
				vscode.commands.executeCommand('wcagEnhancer.setApiKey');
			}
		}
	}
}



async function handleInlineChat(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("❌ No active file found");
		return;
	}

	const selection = editor.selection;
	if (selection.isEmpty) {
		vscode.window.showErrorMessage("❌ Please select code to modify");
		return;
	}

	const instructions = await vscode.window.showInputBox({
		placeHolder: "Enter instructions (e.g., 'Make this accessible', 'Fix contrast')",
		prompt: "AccessiMind Inline Chat"
	});

	if (!instructions) return;

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "✨ AccessiMind Inline Chat",
		cancellable: false
	}, async (progress) => {
		try {
			const document = editor.document;
			const language = document.languageId;
			const selectedCode = document.getText(selection);

			const provider = await aiProviderManager.getCurrentProviderInstance();

			progress.report({ message: "Thinking..." });

			// Construct specific prompt for inline chat
			const prompt = `
INSTRUCTIONS: ${instructions}
FILE TYPE: ${language}

CODE TO MODIFY:
\`\`\`${language}
${selectedCode}
\`\`\`

Provide the modified code based on the instructions. 
If the instruction implies WCAG improvements, apply relevant WCAG 2.2 criteria.
Return ONLY the modified code without markdown code blocks if possible, or inside a code block.
`;

			const result = await provider.improveCode({
				code: prompt,
				fileType: language,
				language: language,
				mode: 'edit',
				selectedText: instructions,
				includeComments: true
			});

			if (result.success && result.content) {
				// Extract the improved code from the AI response
				const improvedCodeMatch = result.content.match(/```[\w]*\n([\s\S]*?)\n```/);
				const finalCode = improvedCodeMatch ? improvedCodeMatch[1] : result.content;

				await editor.edit(editBuilder => {
					editBuilder.replace(selection, finalCode);
				});

				statisticsManager.recordImprovement({
					type: "inline-chat",
					language,
					fileName: document.fileName,
					linesImproved: finalCode.split('\n').length,
					processingTime: 0,
					provider: aiProviderManager.getCurrentProviderName() as "gemini" | "vscode-copilot",
					model: "current",
					wcagCriteria: [],
					tokensUsed: result.tokensUsed || 0
				});
			} else {
				vscode.window.showErrorMessage(`Inline Chat Error: ${result.error}`);
			}

		} catch (error) {
			vscode.window.showErrorMessage(`Error: ${error}`);
		}
	});
}

function extractWcagCriteriaFromCode(code: string): string[] {
	const criteria: string[] = [];
	if (!code) return criteria;
	const perf = vscode.workspace.getConfiguration("wcagEnhancer").get("performance") as any || {};
	const MAX_SCAN_SIZE = typeof perf?.maxScanSize === "number" ? perf.maxScanSize : 500000;
	const MAX_MATCHES = typeof perf?.maxRegexMatches === "number" ? perf.maxRegexMatches : 100;
	if (code.length > MAX_SCAN_SIZE) return criteria;
	const wcagPatterns = [
		/\/\*\s*WCAG:\s*([^*]+)\*\//gi,
		/\/\/\s*WCAG:\s*(.+)/gi,
		/<!--\s*WCAG:\s*([^-]+)-->/gi
	];
	for (const pattern of wcagPatterns) {
		let count = 0;
		for (const match of code.matchAll(pattern)) {
			if (match[1]) {
				criteria.push(match[1].trim());
				count++;
				if (count >= MAX_MATCHES) break;
			}
		}
	}
	return criteria;
}

async function showDetailedStatistics(): Promise<void> {
	const stats = statisticsManager.getDetailedStatistics();

	const panel = vscode.window.createWebviewPanel(
		'wcagStats',
		'📊 AccessiMind Statistics',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	panel.webview.html = getStatsWebViewContent(stats);

	// Handle messages from the webview
	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case 'close':
				panel.dispose();
				break;
			case 'exportStatistics':
				await exportStatistics();
				break;
			case 'resetStatistics':
				statisticsManager.resetStatistics();
				vscode.window.showInformationMessage('📊 Statistics have been reset.');
				// Refresh the panel with new stats
				panel.webview.html = getStatsWebViewContent(statisticsManager.getDetailedStatistics());
				break;
		}
	});
}

async function exportStatistics(): Promise<void> {
	try {
		const stats = statisticsManager.getDetailedStatistics();
		const jsonContent = JSON.stringify(stats, null, 2);

		const uri = await vscode.window.showSaveDialog({
			filters: {
				"JSON Files": ["json"]
			},
			defaultUri: vscode.Uri.file(`wcag-enhancer-stats-${new Date().toISOString().split("T")[0]}.json`)
		});

		if (uri) {
			await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf8'));
			vscode.window.showInformationMessage('✅ Statistics exported successfully!');
		}
	} catch (error) {
		vscode.window.showErrorMessage(`❌ Export failed: ${error}`);
	}
}

async function exportStatisticsCSV(): Promise<void> {
	try {
		const stats = statisticsManager.getDetailedStatistics();

		// Create CSV content
		const csvData = [
			// Header
			["Metric", "Value", "Description"],
			// Basic stats
			["Total Improvements", stats.totalImprovements || 0, "Number of WCAG improvements made"],
			["Total Lines Improved", stats.totalLinesImproved || 0, "Lines of code enhanced"],
			["Total Tokens Used", stats.totalTokensUsed || 0, "AI tokens consumed"],
			["Average Processing Time", `${stats.averageProcessingTime || 0}ms`, "Average time per improvement"],
			["Success Rate", `${Math.round((stats.totalImprovements || 0) > 0 ? ((stats.totalImprovements || 0) / (stats.totalImprovements || 1)) * 100 : 0)}%`, "Percentage of successful improvements"],
			// Daily stats (safely access nested properties)
			["Today Improvements", (stats as any).daily?.improvements || 0, "Improvements made today"],
			["Today Lines", (stats as any).daily?.linesImproved || 0, "Lines improved today"],
			// Monthly stats (safely access nested properties)
			["This Month Improvements", (stats as any).monthly?.improvements || 0, "Improvements this month"],
			["This Month Lines", (stats as any).monthly?.linesImproved || 0, "Lines improved this month"],
			// Most used language (safely access)
			["Most Used Language", (stats as any).mostUsedLanguage || "N/A", "Primary programming language"],
			// WCAG criteria (safely access)
			...Object.entries((stats as any).wcagCriteriaStats || {}).map(([criteria, count]) =>
				[`WCAG ${criteria}`, count, `Times this criteria was applied`]
			)
		];

		const csvContent = csvData.map(row =>
			row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(",")
		).join("\n");

		const uri = await vscode.window.showSaveDialog({
			filters: {
				"CSV Files": ["csv"]
			},
			defaultUri: vscode.Uri.file(`wcag-enhancer-stats-${new Date().toISOString().split("T")[0]}.csv`)
		});

		if (uri) {
			await vscode.workspace.fs.writeFile(uri, Buffer.from(csvContent, "utf8"));
			vscode.window.showInformationMessage("✅ Statistics exported as CSV successfully!");
		}
	} catch (error) {
		vscode.window.showErrorMessage(`❌ CSV export failed: ${error}`);
	}
}

async function resetStatistics(): Promise<void> {
	const action = await vscode.window.showWarningMessage(
		'⚠️ Are you sure you want to reset all statistics? This action cannot be undone.',
		{ modal: true },
		'Reset Statistics'
	);

	if (action === 'Reset Statistics') {
		statisticsManager.resetStatistics();
		const resetStats = statisticsManager.getDetailedStatistics();
		statsViewProvider.updateStatistics(resetStats);
		modernStatsViewProvider.updateStatistics(resetStats);
		updateStatusBar();
		vscode.window.showInformationMessage('✅ Statistics reset successfully!');
	}
}

function initializeStatusBar(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'wcagEnhancer.showStatusBarMenu';
	statusBarItem.tooltip = 'AccessiMind - Click to view detailed statistics and commands';
	context.subscriptions.push(statusBarItem);

	// Status bar menü komutunu kaydet
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.showStatusBarMenu', async () => {
			await showStatusBarMenu();
		})
	);

	updateStatusBar();
	statusBarItem.show();
}

function updateStatusBar() {
	const stats = statisticsManager.getDetailedStatistics();
	const todayStats = statisticsManager.getTodayStatistics();
	const totalImprovements = stats.totalImprovements;
	const totalLines = stats.totalLinesImproved;

	// Günlük ve toplam istatistikleri göster
	statusBarItem.text = `♿ AccessiMind: ${totalImprovements} (Today: ${todayStats.improvements})`;
	statusBarItem.tooltip = [
		`AccessiMind - Detailed Statistics`,
		``,
		`📊 Total Improvements: ${totalImprovements}`,
		`📈 Total Lines: ${totalLines.toLocaleString()}`,
		`🗓️ Today: ${todayStats.improvements} improvements`,
		`📝 This Month: ${statisticsManager.getThisMonthStatistics().improvements} improvements`,
		`📅 This Year: ${statisticsManager.getThisYearStatistics().improvements} improvements`,
		``,
		`🖱️ Click to open menu`
	].join('\n');
}

async function showStatusBarMenu(): Promise<void> {
	const stats = statisticsManager.getDetailedStatistics();
	const todayStats = statisticsManager.getTodayStatistics();
	const monthStats = statisticsManager.getThisMonthStatistics();
	const yearStats = statisticsManager.getThisYearStatistics();

	const menuItems = [
		{
			label: "💬 Open Chat",
			description: "Open AccessiMind Chat Assistant",
			action: "openChat"
		},
		{
			label: "✨ Inline Chat",
			description: "Modify value with AI instructions",
			action: "inlineChat"
		},
		{
			label: "📊 Show Detailed Statistics",
			description: `Total: ${stats.totalImprovements} improvements, ${stats.totalLinesImproved} lines`,
			action: "showDetailedStats"
		},
		{
			label: "📈 Modern Statistics Panel",
			description: "Advanced analytics and interactive chart view",
			action: "showModernStats"
		},
		{
			label: "📅 Daily Statistics",
			description: `Today: ${todayStats.improvements} improvements, ${todayStats.linesImproved} lines`,
			action: "showDailyStats"
		},
		{
			label: "📊 Monthly Statistics",
			description: `This month: ${monthStats.improvements} improvements, ${monthStats.linesImproved} lines`,
			action: "showMonthlyStats"
		},
		{
			label: "📈 Yearly Statistics",
			description: `This year: ${yearStats.improvements} improvements, ${yearStats.linesImproved} lines`,
			action: "showYearlyStats"
		},
		{
			label: "🔄 Reset Statistics",
			description: "Reset daily, monthly, yearly or all statistics",
			action: "resetStatsMenu"
		},
		{
			label: "📤 Export Statistics",
			description: "Export in JSON or CSV format",
			action: "exportStatsMenu"
		},
		{
			label: "⚙️ WCAG Analysis Commands",
			description: "Access file or selection analysis commands",
			action: "showCommands"
		},
		{
			label: "⚙️ Settings",
			description: "Open AccessiMind settings panel",
			action: "openSettings"
		},
		{
			label: "📚 Help & Documentation",
			description: "View user guide and documentation",
			action: "openHelp"
		}
	];

	const selectedItem = await vscode.window.showQuickPick(menuItems, {
		placeHolder: "AccessiMind - Select an option",
		matchOnDescription: true,
		ignoreFocusOut: false
	});

	if (selectedItem) {
		await handleStatusBarMenuAction(selectedItem.action);
	}
}

async function handleStatusBarMenuAction(action: string): Promise<void> {
	switch (action) {
		case "openChat":
			await vscode.commands.executeCommand('wcagEnhancer.openChat');
			break;
		case "inlineChat":
			await vscode.commands.executeCommand('wcagEnhancer.inlineChat');
			break;
		case "showDetailedStats":
			await showDetailedStatistics();
			break;
		case "showModernStats":
			await showModernStatsPanel();
			break;
		case "showDailyStats":
			await showPeriodStatistics("daily");
			break;
		case "showMonthlyStats":
			await showPeriodStatistics("monthly");
			break;
		case "showYearlyStats":
			await showPeriodStatistics("yearly");
			break;
		case "resetStatsMenu":
			await showResetStatsMenu();
			break;
		case "exportStatsMenu":
			await showExportStatsMenu();
			break;
		case "showCommands":
			await showWcagCommands();
			break;
		case "openSettings":
			await vscode.commands.executeCommand('wcagEnhancer.openSettings');
			break;
		case "openHelp":
			await vscode.commands.executeCommand('wcagEnhancer.openHelp');
			break;
	}
}

async function showModernStatsPanel(): Promise<void> {
	// Open modern statistics panel
	const panel = vscode.window.createWebviewPanel(
		'wcagModernStats',
		'📊 AccessiMind - Modern Statistics',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(""), "media")]
		}
	);

	const stats = statisticsManager.getDetailedStatistics();
	panel.webview.html = getModernStatusPanelContent(stats);

	// Message handling
	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case "exportAnalysisJSON":
				await exportStatistics();
				break;
			case "exportAnalysisCSV":
				await exportStatisticsCSV();
				break;
			case "resetAnalysisData":
				await resetStatistics();
				panel.webview.postMessage({
					command: "updateStats",
					stats: statisticsManager.getDetailedStatistics()
				});
				break;
			case "refreshStats":
				panel.webview.postMessage({
					command: "updateStats",
					stats: statisticsManager.getDetailedStatistics()
				});
				break;
		}
	});
}

async function showPeriodStatistics(period: "daily" | "monthly" | "yearly"): Promise<void> {
	const stats = statisticsManager.getDetailedStatistics();
	let periodStats: any;
	let title: string;
	let description: string;

	switch (period) {
		case "daily":
			periodStats = statisticsManager.getTodayStatistics();
			title = "📅 Daily Statistics";
			description = `Today (${new Date().toLocaleDateString('en-US')})`;
			break;
		case "monthly":
			periodStats = statisticsManager.getThisMonthStatistics();
			title = "📊 Monthly Statistics";
			description = `This Month (${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })})`;
			break;
		case "yearly":
			periodStats = statisticsManager.getThisYearStatistics();
			title = "📈 Yearly Statistics";
			description = `This Year (${new Date().getFullYear()})`;
			break;
	}

	const panel = vscode.window.createWebviewPanel(
		`wcag${period.charAt(0).toUpperCase() + period.slice(1)}Stats`,
		title,
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	// Message handler for period statistics panel
	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case 'exportPeriod':
				await exportPeriodStatistics(message.period);
				break;
			case 'resetPeriod':
				await resetPeriodStatistics(message.period);
				// Update panel with new stats after reset
				const updatedStats = statisticsManager.getDetailedStatistics();
				let newPeriodStats: any;
				switch (message.period) {
					case "daily":
						newPeriodStats = statisticsManager.getTodayStatistics();
						break;
					case "monthly":
						newPeriodStats = statisticsManager.getThisMonthStatistics();
						break;
					case "yearly":
						newPeriodStats = statisticsManager.getThisYearStatistics();
						break;
				}
				panel.webview.html = getPeriodStatsContent(newPeriodStats, title, description, message.period);
				break;
		}
	});

	panel.webview.html = getPeriodStatsContent(periodStats, title, description, period);
}

async function showResetStatsMenu(): Promise<void> {
	const resetOptions = [
		{
			label: "🔄 Reset Daily Statistics",
			description: "Reset only today's statistics",
			action: "resetDaily"
		},
		{
			label: "🔄 Reset Monthly Statistics",
			description: "Reset all statistics for this month",
			action: "resetMonthly"
		},
		{
			label: "🔄 Reset Yearly Statistics",
			description: "Reset all statistics for this year",
			action: "resetYearly"
		},
		{
			label: "🔄 Reset All Statistics",
			description: "⚠️ Permanently delete all historical data",
			action: "resetAll"
		}
	];

	const selectedOption = await vscode.window.showQuickPick(resetOptions, {
		placeHolder: "Select the type of statistics to reset",
		ignoreFocusOut: false
	});

	if (selectedOption) {
		await handleResetAction(selectedOption.action);
	}
}

async function handleResetAction(action: string): Promise<void> {
	let confirmMessage: string;
	let buttonText: string;

	switch (action) {
		case "resetDaily":
			confirmMessage = "⚠️ Today's statistics will be deleted. This action cannot be undone!";
			buttonText = "Delete Daily Statistics";
			break;
		case "resetMonthly":
			confirmMessage = "⚠️ All statistics for this month will be deleted. This action cannot be undone!";
			buttonText = "Delete Monthly Statistics";
			break;
		case "resetYearly":
			confirmMessage = "⚠️ All statistics for this year will be deleted. This action cannot be undone!";
			buttonText = "Delete Yearly Statistics";
			break;
		case "resetAll":
			confirmMessage = "⚠️ ALL STATISTICS will be permanently deleted. This action CANNOT BE UNDONE!";
			buttonText = "Delete All Statistics";
			break;
		default:
			return;
	}

	const confirmation = await vscode.window.showWarningMessage(
		confirmMessage,
		{ modal: true },
		buttonText
	);

	if (confirmation === buttonText) {
		switch (action) {
			case "resetDaily":
				await resetDailyStatistics();
				break;
			case "resetMonthly":
				await resetMonthlyStatistics();
				break;
			case "resetYearly":
				await resetYearlyStatistics();
				break;
			case "resetAll":
				await resetStatistics();
				break;
		}
	}
}

async function resetDailyStatistics(): Promise<void> {
	try {
		const today = new Date().toISOString().split('T')[0];
		const stats = statisticsManager.getDetailedStatistics();

		// Günlük istatistikleri sıfırla
		if (stats.dailyStats[today]) {
			delete stats.dailyStats[today];
		}

		// Context'e kaydet
		await statisticsManager['context'].globalState.update('wcagEnhancer.statistics', stats);

		// View'ları güncelle
		const updatedStats = statisticsManager.getDetailedStatistics();
		statsViewProvider.updateStatistics(updatedStats);
		modernStatsViewProvider.updateStatistics(updatedStats);
		updateStatusBar();

		vscode.window.showInformationMessage('✅ Daily statistics successfully reset!');
	} catch (error) {
		vscode.window.showErrorMessage(`❌ Daily statistics reset error: ${error}`);
	}
}

async function resetMonthlyStatistics(): Promise<void> {
	try {
		const currentMonth = new Date().toISOString().slice(0, 7);
		const stats = statisticsManager.getDetailedStatistics();

		// Bu ayın tüm günlük istatistiklerini sıfırla
		Object.keys(stats.dailyStats).forEach(date => {
			if (date.startsWith(currentMonth)) {
				delete stats.dailyStats[date];
			}
		});

		// Bu ayın aylık istatistiklerini sıfırla
		if (stats.monthlyStats[currentMonth]) {
			delete stats.monthlyStats[currentMonth];
		}

		// Context'e kaydet
		await statisticsManager['context'].globalState.update('wcagEnhancer.statistics', stats);

		// View'ları güncelle
		const updatedStats = statisticsManager.getDetailedStatistics();
		statsViewProvider.updateStatistics(updatedStats);
		modernStatsViewProvider.updateStatistics(updatedStats);
		updateStatusBar();

		vscode.window.showInformationMessage('✅ Monthly statistics successfully reset!');
	} catch (error) {
		vscode.window.showErrorMessage(`❌ Monthly statistics reset error: ${error}`);
	}
}

async function resetYearlyStatistics(): Promise<void> {
	try {
		const currentYear = new Date().getFullYear().toString();
		const stats = statisticsManager.getDetailedStatistics();

		// Bu yılın tüm günlük istatistiklerini sıfırla
		Object.keys(stats.dailyStats).forEach(date => {
			if (date.startsWith(currentYear)) {
				delete stats.dailyStats[date];
			}
		});

		// Bu yılın tüm aylık istatistiklerini sıfırla
		Object.keys(stats.monthlyStats).forEach(month => {
			if (month.startsWith(currentYear)) {
				delete stats.monthlyStats[month];
			}
		});

		// Bu yılın yıllık istatistiklerini sıfırla
		if (stats.yearlyStats[currentYear]) {
			delete stats.yearlyStats[currentYear];
		}

		// Context'e kaydet
		await statisticsManager['context'].globalState.update('wcagEnhancer.statistics', stats);

		// View'ları güncelle
		const updatedStats = statisticsManager.getDetailedStatistics();
		statsViewProvider.updateStatistics(updatedStats);
		modernStatsViewProvider.updateStatistics(updatedStats);
		updateStatusBar();

		vscode.window.showInformationMessage('✅ Yearly statistics successfully reset!');
	} catch (error) {
		vscode.window.showErrorMessage(`❌ Yearly statistics reset error: ${error}`);
	}
}

async function resetPeriodStatistics(period: string): Promise<void> {
	switch (period) {
		case "daily":
			await resetDailyStatistics();
			break;
		case "monthly":
			await resetMonthlyStatistics();
			break;
		case "yearly":
			await resetYearlyStatistics();
			break;
		default:
			vscode.window.showErrorMessage(`❌ Unknown period: ${period}`);
	}
}

async function showExportStatsMenu(): Promise<void> {
	const exportOptions = [
		{
			label: "📊 Export in JSON Format",
			description: "Export all statistics in JSON format",
			action: "exportJSON"
		},
		{
			label: "📈 Export in CSV Format",
			description: "Export statistics in CSV format",
			action: "exportCSV"
		},
		{
			label: "📅 Export Daily Statistics",
			description: "Export only daily data",
			action: "exportDaily"
		},
		{
			label: "📊 Export Monthly Statistics",
			description: "Export only monthly data",
			action: "exportMonthly"
		},
		{
			label: "📈 Export Yearly Statistics",
			description: "Export only yearly data",
			action: "exportYearly"
		}
	];

	const selectedOption = await vscode.window.showQuickPick(exportOptions, {
		placeHolder: "Select export type",
		ignoreFocusOut: false
	});

	if (selectedOption) {
		await handleExportAction(selectedOption.action);
	}
}

async function handleExportAction(action: string): Promise<void> {
	switch (action) {
		case "exportJSON":
			await exportStatistics();
			break;
		case "exportCSV":
			await exportStatisticsCSV();
			break;
		case "exportDaily":
			await exportPeriodStatistics("daily");
			break;
		case "exportMonthly":
			await exportPeriodStatistics("monthly");
			break;
		case "exportYearly":
			await exportPeriodStatistics("yearly");
			break;
	}
}

async function exportPeriodStatistics(period: "daily" | "monthly" | "yearly"): Promise<void> {
	try {
		let data: any;
		let filename: string;

		switch (period) {
			case "daily":
				data = {
					period: "daily",
					date: new Date().toISOString().split('T')[0],
					statistics: statisticsManager.getTodayStatistics(),
					exportedAt: new Date().toISOString()
				};
				filename = `wcag-enhancer-daily-${new Date().toISOString().split('T')[0]}.json`;
				break;
			case "monthly":
				data = {
					period: "monthly",
					month: new Date().toISOString().slice(0, 7),
					statistics: statisticsManager.getThisMonthStatistics(),
					exportedAt: new Date().toISOString()
				};
				filename = `wcag-enhancer-monthly-${new Date().toISOString().slice(0, 7)}.json`;
				break;
			case "yearly":
				data = {
					period: "yearly",
					year: new Date().getFullYear().toString(),
					statistics: statisticsManager.getThisYearStatistics(),
					exportedAt: new Date().toISOString()
				};
				filename = `wcag-enhancer-yearly-${new Date().getFullYear()}.json`;
				break;
		}

		const jsonContent = JSON.stringify(data, null, 2);

		const uri = await vscode.window.showSaveDialog({
			filters: {
				"JSON Files": ["json"]
			},
			defaultUri: vscode.Uri.file(filename)
		});

		if (uri) {
			await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf8'));
			vscode.window.showInformationMessage(`✅ ${period.charAt(0).toUpperCase() + period.slice(1)} statistics exported successfully!`);
		}
	} catch (error) {
		vscode.window.showErrorMessage(`❌ ${period.charAt(0).toUpperCase() + period.slice(1)} export error: ${error}`);
	}
}

async function showWcagCommands(): Promise<void> {
	const commands = [
		{
			label: "🔍 Analyze Open File",
			description: "Analyze the currently open file according to WCAG standards",
			command: "wcagEnhancer.analyzeOpenCode"
		},
		{
			label: "✏️ Analyze Selected Code",
			description: "Analyze the selected code snippet according to WCAG standards",
			command: "wcagEnhancer.analyzeSelectedCode"
		},
		{
			label: "⚙️ Set API Key",
			description: "Set up Gemini AI API key",
			command: "wcagEnhancer.setApiKey"
		},
		{
			label: "🧪 Test AI Connection",
			description: "Test AI provider connection",
			command: "wcagEnhancer.testAIConnection"
		},
		{
			label: "📋 Create Jira Task",
			description: "Create a Jira task for WCAG analysis",
			command: "wcagEnhancer.createJiraTask"
		}
	];

	const selectedCommand = await vscode.window.showQuickPick(commands, {
		placeHolder: "Select command to execute",
		ignoreFocusOut: false
	});

	if (selectedCommand) {
		await vscode.commands.executeCommand(selectedCommand.command);
	}
}

async function showSettingsInterface(): Promise<void> {
	// Create modern status bar panel
	const panel = vscode.window.createWebviewPanel(
		"wcagEnhancerStatusPanel",
		"♿ AccessiMind Dashboard",
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(""), "media")]
		}
	);

	// Get current statistics
	const stats = statisticsManager.getDetailedStatistics();

	// Set up message handling
	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case "exportAnalysisJSON":
				await exportStatistics();
				break;
			case "exportAnalysisCSV":
				await exportStatisticsCSV();
				break;
			case "resetAnalysisData":
				await resetStatistics();
				// Update panel with new stats after reset
				panel.webview.postMessage({
					command: "updateStats",
					stats: statisticsManager.getDetailedStatistics()
				});
				break;
			case "refreshStats":
				panel.webview.postMessage({
					command: "updateStats",
					stats: statisticsManager.getDetailedStatistics()
				});
				break;
			case "closeDashboard":
				panel.dispose();
				break;
		}
	});

	panel.webview.html = getModernStatusPanelContent(stats);
}

function registerDynamicKeybindings(context: vscode.ExtensionContext) {
	// Register keybindings based on configuration
	const config = vscode.workspace.getConfiguration('wcagEnhancer');
	const keybindings = config.get('keybindings') as any || {};

	// Default keybindings if not configured
	const defaultKeybindings = {
		'improveFile': 'ctrl+shift+w',
		'improveSelection': 'ctrl+shift+e',
		'improveCurrentSelected': 'ctrl+shift+r'
	};

	const finalKeybindings = { ...defaultKeybindings, ...keybindings };

	// Register each keybinding
	Object.entries(finalKeybindings).forEach(([command, key]) => {
		if (key && typeof key === 'string') {
			context.subscriptions.push(
				vscode.commands.registerCommand(`wcagEnhancer.keybinding.${command}`, async () => {
					await vscode.commands.executeCommand(`wcagEnhancer.${command}`);
				})
			);
		}
	});
}

async function showWelcomeMessage(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('wcagEnhancer');
	const wizardCompleted = config.get('wizardCompleted', false);

	// Mevcut ayarları kontrol et
	const aiConfig = config.get('ai') as any || {};
	const aiModelConfig = config.get('aiModels') as any || {};
	const isPartiallyConfigured = !!(aiConfig.provider || aiModelConfig.selectedModel);
	const isFullyConfigured = !!(aiConfig.provider && aiModelConfig.selectedModel && aiConfig.apiKey);

	if (!wizardCompleted || isPartiallyConfigured) {
		// Show wizard on first activation or if partially configured
		setTimeout(async () => {
			let message: string;
			let buttonText: string;

			if (isFullyConfigured) {
				message = '🎉 Welcome back to AccessiMind! Your settings are ready. Would you like to review them?';
				buttonText = 'Review Settings';
			} else if (isPartiallyConfigured) {
				message = '⚙️ AccessiMind setup is incomplete. Would you like to complete the configuration?';
				buttonText = 'Complete Setup';
			} else {
				message = '🎉 Welcome to AccessiMind! Would you like to set up your AI provider?';
				buttonText = 'Setup Wizard';
			}

			const action = await vscode.window.showInformationMessage(
				message,
				buttonText,
				'Later'
			);

			if (action === buttonText) {
				await showDetailedWelcomeScreen();
			}
		}, 2000);
	}
}

async function showDetailedWelcomeScreen(): Promise<void> {
	await wizardManager.showWizard();
}

async function setApiKey(): Promise<void> {
	const config = vscode.workspace.getConfiguration('wcagEnhancer');
	const aiConfig = config.get('ai') as any || {};
	const currentKey = aiConfig.apiKey || '';

	const apiKey = await vscode.window.showInputBox({
		title: '🔑 Gemini API Key Configuration',
		prompt: 'Enter your Google Gemini API key from Google AI Studio',
		placeHolder: 'AIzaSy... (Your API key)',
		password: true,
		value: currentKey,
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return '❌ API key cannot be empty';
			}
			if (value.length < 20) {
				return '⚠️ API key seems too short (minimum 20 characters)';
			}
			if (!value.startsWith('AIza')) {
				return '⚠️ Gemini API keys typically start with "AIza"';
			}
			return null;
		}
	});

	if (apiKey !== undefined) {
		aiConfig.apiKey = apiKey;
		await config.update('ai', aiConfig, vscode.ConfigurationTarget.Global);

		vscode.window.showInformationMessage(
			'✅ Gemini API key updated successfully!',
			'Test Connection'
		).then(action => {
			if (action === 'Test Connection') {
				testAIConnection();
			}
		});
	}
}

async function testAIConnection(): Promise<void> {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "🧪 Testing AI connection...",
			cancellable: false
		}, async (progress) => {
			progress.report({ increment: 0, message: 'Validating configuration...' });
			await new Promise(resolve => setTimeout(resolve, 500));

			progress.report({ increment: 50, message: 'Testing AI provider...' });

			// Import AITestUtils dynamically to avoid circular dependencies
			const { AITestUtils } = await import('./utils/aiTestUtils');
			const aiTestUtils = AITestUtils.getInstance();
			const result = await aiTestUtils.testAIProvider();

			progress.report({ increment: 100, message: 'Showing results...' });
			await aiTestUtils.showTestResult(result);
		});
	} catch (error) {
		vscode.window.showErrorMessage(`❌ AI test failed: ${error}`);
	}
}

function getPeriodStatsContent(periodStats: any, title: string, description: string, period: string): string {
	return `
<!DOCTYPE html>
<html lang="tr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		:root {
			--primary-color: var(--vscode-button-background);
			--primary-hover: var(--vscode-button-hoverBackground);
			--text-color: var(--vscode-foreground);
			--bg-color: var(--vscode-editor-background);
			--card-bg: var(--vscode-input-background);
			--border-color: var(--vscode-panel-border);
			--success-color: var(--vscode-terminal-ansiGreen);
			--warning-color: var(--vscode-terminal-ansiYellow);
			--danger-color: var(--vscode-terminal-ansiRed);
			--info-color: var(--vscode-terminal-ansiBlue);
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
			padding: 24px;
		}

		.container {
			max-width: 800px;
			margin: 0 auto;
		}

		.header {
			text-align: center;
			margin-bottom: 32px;
			padding-bottom: 24px;
			border-bottom: 2px solid var(--border-color);
		}

		.header h1 {
			font-size: 28px;
			font-weight: 600;
			margin-bottom: 8px;
			color: var(--primary-color);
		}

		.header .description {
			font-size: 16px;
			color: var(--vscode-descriptionForeground);
		}

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 20px;
			margin-bottom: 32px;
		}

		.stat-card {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 12px;
			padding: 24px;
			text-align: center;
			transition: transform 0.2s ease, box-shadow 0.2s ease;
		}

		.stat-card:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
		}

		.stat-icon {
			font-size: 32px;
			margin-bottom: 12px;
		}

		.stat-number {
			font-size: 2.5rem;
			font-weight: 700;
			color: var(--primary-color);
			margin-bottom: 8px;
		}

		.stat-label {
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
			font-weight: 500;
		}

		.actions {
			display: flex;
			justify-content: center;
			gap: 16px;
			margin-top: 32px;
		}

		.btn {
			padding: 12px 24px;
			background: var(--primary-color);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 8px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 500;
			transition: background-color 0.2s ease;
			text-decoration: none;
			display: inline-flex;
			align-items: center;
			gap: 8px;
		}

		.btn:hover {
			background: var(--primary-hover);
		}

		.btn:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}

		.btn.secondary {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		.btn.danger {
			background: var(--danger-color);
			color: white;
		}

		.summary {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 12px;
			padding: 24px;
			margin-top: 32px;
		}

		.summary h3 {
			font-size: 18px;
			margin-bottom: 16px;
			color: var(--primary-color);
		}

		.summary-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 8px 0;
			border-bottom: 1px solid var(--border-color);
		}

		.summary-item:last-child {
			border-bottom: none;
		}

		.summary-label {
			font-weight: 500;
		}

		.summary-value {
			font-weight: 600;
			color: var(--primary-color);
		}

		@media (max-width: 768px) {
			.stats-grid {
				grid-template-columns: 1fr;
			}
			
			.actions {
				flex-direction: column;
				align-items: center;
			}
		}
	</style>
</head>
<body>
	<div class="container" role="main">
		<header class="header">
			<h1>${title}</h1>
			<div class="description">${description}</div>
		</header>

		<div class="stats-grid">
			<div class="stat-card" role="region" aria-labelledby="improvements-title">
				<div class="stat-icon" role="img" aria-label="Improvements">🔧</div>
				<div class="stat-number" id="improvements-title">${periodStats.improvements || 0}</div>
				<div class="stat-label">Improvements</div>
			</div>

			<div class="stat-card" role="region" aria-labelledby="lines-title">
				<div class="stat-icon" role="img" aria-label="Improved lines">📝</div>
				<div class="stat-number" id="lines-title">${(periodStats.linesImproved || 0).toLocaleString('tr-TR')}</div>
				<div class="stat-label">Improved Lines</div>
			</div>

			${period !== 'daily' ? `
			<div class="stat-card" role="region" aria-labelledby="tokens-title">
				<div class="stat-icon" role="img" aria-label="Used tokens">🔗</div>
				<div class="stat-number" id="tokens-title">${(periodStats.tokensUsed || 0).toLocaleString('tr-TR')}</div>
				<div class="stat-label">Used Tokens</div>
			</div>

			<div class="stat-card" role="region" aria-labelledby="avgtime-title">
				<div class="stat-icon" role="img" aria-label="Average time">⏱️</div>
				<div class="stat-number" id="avgtime-title">${Math.round(periodStats.avgProcessingTime || 0)}</div>
				<div class="stat-label">Avg. Processing Time (ms)</div>
			</div>
			` : ''}
		</div>

		<div class="summary">
			<h3>📊 Summary Information</h3>
			<div class="summary-item">
				<span class="summary-label">Period</span>
				<span class="summary-value">${description}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Total Improvements</span>
				<span class="summary-value">${periodStats.improvements || 0}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Total Lines</span>
				<span class="summary-value">${(periodStats.linesImproved || 0).toLocaleString('tr-TR')}</span>
			</div>
			${period !== 'daily' ? `
			<div class="summary-item">
				<span class="summary-label">Token Usage</span>
				<span class="summary-value">${(periodStats.tokensUsed || 0).toLocaleString('tr-TR')}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Average Processing Time</span>
				<span class="summary-value">${Math.round(periodStats.avgProcessingTime || 0)} ms</span>
			</div>
			` : ''}
			<div class="summary-item">
				<span class="summary-label">Rapor Tarihi</span>
				<span class="summary-value">${new Date().toLocaleDateString('tr-TR', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})}</span>
			</div>
		</div>

		<div class="actions">
			<button class="btn" onclick="exportPeriodData()" aria-label="Export this period's data">
				<span>📤</span>
				Export
			</button>
			<button class="btn secondary" onclick="refreshData()" aria-label="Refresh data">
				<span>🔄</span>
				Yenile
			</button>
			<button class="btn danger" onclick="resetPeriodData()" aria-label="Reset this period's data">
				<span>🗑️</span>
				Reset
			</button>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		function exportPeriodData() {
			// Announce action for screen readers
			announceAction('${period.charAt(0).toUpperCase() + period.slice(1)} data exporting');
			vscode.postMessage({
				command: 'exportPeriod',
				period: '${period}',
				data: ${JSON.stringify(periodStats)}
			});
		}

		function refreshData() {
			announceAction('Veriler yenileniyor');
			window.location.reload();
		}

		function resetPeriodData() {
			announceAction('${period.charAt(0).toUpperCase() + period.slice(1)} data reset requested');
			vscode.postMessage({
				command: 'resetPeriod',
				period: '${period}'
			});
		}

		// Helper function to announce actions for screen readers
		function announceAction(message) {
			const announcement = document.createElement('div');
			announcement.setAttribute('aria-live', 'polite');
			announcement.setAttribute('aria-atomic', 'true');
			announcement.style.position = 'absolute';
			announcement.style.left = '-10000px';
			announcement.style.width = '1px';
			announcement.style.height = '1px';
			announcement.style.overflow = 'hidden';
			announcement.textContent = message;
			
			document.body.appendChild(announcement);
			
			// Remove after announcement
			setTimeout(() => {
				if (document.body.contains(announcement)) {
					document.body.removeChild(announcement);
				}
			}, 1000);
		}

		// Keyboard navigation enhancement
		document.addEventListener('DOMContentLoaded', function() {
			const buttons = document.querySelectorAll('.btn');
			buttons.forEach(button => {
				button.addEventListener('keydown', function(e) {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						button.click();
					}
				});
			});
		});
	</script>
</body>
</html>
	`;
}

function getStatsWebViewContent(stats: any): string {
	// Get time-based statistics
	const today = new Date().toISOString().split('T')[0];
	const thisMonth = new Date().toISOString().slice(0, 7);
	const thisYear = new Date().getFullYear().toString();

	const dailyStats = (stats as any).dailyStats?.[today] || { improvements: 0, linesImproved: 0, tokensUsed: 0 };
	const monthlyStats = (stats as any).monthlyStats?.[thisMonth] || { improvements: 0, linesImproved: 0, tokensUsed: 0 };
	const yearlyStats = (stats as any).yearlyStats?.[thisYear] || { improvements: 0, linesImproved: 0, tokensUsed: 0 };

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AccessiMind Statistics</title>
	<style>
		:root {
			--tab-active: var(--vscode-button-background);
			--tab-inactive: var(--vscode-editor-background);
		}
		
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-foreground);
			padding: 0;
			margin: 0;
		}
		
		.stats-dialog {
			max-width: 900px;
			margin: 0 auto;
			padding: 20px;
		}
		
		/* Header with Close Button */
		.dialog-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-bottom: 16px;
			border-bottom: 1px solid var(--vscode-panel-border);
			margin-bottom: 20px;
		}
		
		.dialog-header h1 {
			margin: 0;
			font-size: 1.5rem;
			display: flex;
			align-items: center;
			gap: 10px;
		}
		
		.close-btn {
			background: transparent;
			border: 1px solid var(--vscode-panel-border);
			color: var(--vscode-foreground);
			padding: 8px 12px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 1rem;
			transition: all 0.2s;
		}
		
		.close-btn:hover {
			background: var(--vscode-inputValidation-errorBackground);
			color: var(--vscode-inputValidation-errorForeground);
			border-color: var(--vscode-inputValidation-errorBorder);
		}
		
		.close-btn:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
		
		/* Tabs */
		.tabs-container {
			margin-bottom: 24px;
		}
		
		.tab-list {
			display: flex;
			gap: 4px;
			border-bottom: 2px solid var(--vscode-panel-border);
			padding-bottom: 0;
		}
		
		.tab-btn {
			padding: 12px 24px;
			background: var(--tab-inactive);
			border: 1px solid var(--vscode-panel-border);
			border-bottom: none;
			border-radius: 8px 8px 0 0;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
			font-weight: 500;
			font-size: 0.95rem;
			transition: all 0.2s;
			position: relative;
			bottom: -2px;
		}
		
		.tab-btn:hover {
			background: var(--vscode-list-hoverBackground);
			color: var(--vscode-foreground);
		}
		
		.tab-btn.active {
			background: var(--vscode-input-background);
			color: var(--vscode-textLink-foreground);
			border-bottom: 2px solid var(--vscode-input-background);
			font-weight: 600;
		}
		
		.tab-btn:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: -2px;
		}
		
		.tab-panel {
			display: none;
			animation: fadeIn 0.3s ease;
		}
		
		.tab-panel.active {
			display: block;
		}
		
		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(10px); }
			to { opacity: 1; transform: translateY(0); }
		}
		
		/* Summary Cards */
		.summary-cards {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 16px;
			margin-bottom: 24px;
		}
		
		.summary-card {
			background: linear-gradient(135deg, var(--vscode-input-background), var(--vscode-editor-background));
			border: 1px solid var(--vscode-panel-border);
			border-radius: 12px;
			padding: 20px;
			text-align: center;
			transition: transform 0.2s, box-shadow 0.2s;
		}
		
		.summary-card:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		}
		
		.card-value {
			font-size: 2rem;
			font-weight: 700;
			color: var(--vscode-textLink-foreground);
			margin-bottom: 4px;
		}
		
		.card-label {
			color: var(--vscode-descriptionForeground);
			font-size: 0.85rem;
		}
		
		/* Data Table */
		.data-table-container {
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			overflow: hidden;
		}
		
		.data-table {
			width: 100%;
			border-collapse: collapse;
		}
		
		.data-table th {
			background: var(--vscode-editor-background);
			padding: 14px 16px;
			text-align: left;
			font-weight: 600;
			font-size: 0.9rem;
			color: var(--vscode-textLink-foreground);
			border-bottom: 2px solid var(--vscode-panel-border);
		}
		
		.data-table td {
			padding: 12px 16px;
			border-bottom: 1px solid var(--vscode-panel-border);
			font-size: 0.9rem;
		}
		
		.data-table tr:last-child td {
			border-bottom: none;
		}
		
		.data-table tr:hover {
			background: var(--vscode-list-hoverBackground);
		}
		
		.data-table .value-cell {
			text-align: right;
			font-weight: 600;
			font-variant-numeric: tabular-nums;
		}
		
		.data-table .value-highlight {
			color: var(--vscode-textLink-foreground);
		}
		
		/* Actions */
		.actions-bar {
			display: flex;
			gap: 12px;
			justify-content: flex-end;
			margin-top: 24px;
			padding-top: 16px;
			border-top: 1px solid var(--vscode-panel-border);
		}
		
		.action-btn {
			padding: 10px 20px;
			border-radius: 6px;
			cursor: pointer;
			font-weight: 500;
			font-size: 0.9rem;
			transition: all 0.2s;
		}
		
		.action-btn.primary {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
		}
		
		.action-btn.primary:hover {
			background: var(--vscode-button-hoverBackground);
		}
		
		.action-btn.secondary {
			background: transparent;
			color: var(--vscode-foreground);
			border: 1px solid var(--vscode-panel-border);
		}
		
		.action-btn.secondary:hover {
			background: var(--vscode-list-hoverBackground);
		}
		
		.action-btn:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
	</style>
</head>
<body>
	<div class="stats-dialog" role="dialog" aria-labelledby="dialog-title">
		<!-- Header -->
		<div class="dialog-header">
			<h1 id="dialog-title">📊 AccessiMind Statistics</h1>
			<button class="close-btn" onclick="closeDialog()" aria-label="Close dialog" title="Close">✕ Close</button>
		</div>
		
		<!-- Tabs -->
		<div class="tabs-container" role="tablist" aria-label="Statistics time periods">
			<div class="tab-list">
				<button class="tab-btn active" role="tab" aria-selected="true" aria-controls="tab-all" id="btn-all" onclick="switchTab('all')">📈 All Time</button>
				<button class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-daily" id="btn-daily" onclick="switchTab('daily')">📅 Daily</button>
				<button class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-monthly" id="btn-monthly" onclick="switchTab('monthly')">📆 Monthly</button>
				<button class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-yearly" id="btn-yearly" onclick="switchTab('yearly')">🗓️ Yearly</button>
			</div>
		</div>
		
		<!-- All Time Panel -->
		<div class="tab-panel active" role="tabpanel" id="tab-all" aria-labelledby="btn-all">
			<div class="summary-cards">
				<div class="summary-card">
					<div class="card-value">${stats.totalImprovements || 0}</div>
					<div class="card-label">Total Improvements</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${stats.totalLinesImproved || 0}</div>
					<div class="card-label">Lines Improved</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${stats.averageProcessingTime || 0}ms</div>
					<div class="card-label">Avg Processing Time</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${stats.totalTokensUsed || 0}</div>
					<div class="card-label">Tokens Used</div>
				</div>
			</div>
			
			<div class="data-table-container">
				<table class="data-table">
					<thead>
						<tr>
							<th>Metric</th>
							<th style="text-align:right">Value</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Total Improvements</td>
							<td class="value-cell value-highlight">${stats.totalImprovements || 0}</td>
						</tr>
						<tr>
							<td>Lines Improved</td>
							<td class="value-cell">${stats.totalLinesImproved || 0}</td>
						</tr>
						<tr>
							<td>Average Processing Time</td>
							<td class="value-cell">${stats.averageProcessingTime || 0} ms</td>
						</tr>
						<tr>
							<td>Total Tokens Used</td>
							<td class="value-cell">${stats.totalTokensUsed || 0}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
		
		<!-- Daily Panel -->
		<div class="tab-panel" role="tabpanel" id="tab-daily" aria-labelledby="btn-daily">
			<div class="summary-cards">
				<div class="summary-card">
					<div class="card-value">${dailyStats.improvements || 0}</div>
					<div class="card-label">Today's Improvements</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${dailyStats.linesImproved || 0}</div>
					<div class="card-label">Lines Today</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${dailyStats.tokensUsed || 0}</div>
					<div class="card-label">Tokens Today</div>
				</div>
			</div>
			
			<div class="data-table-container">
				<table class="data-table">
					<thead>
						<tr>
							<th>Date</th>
							<th style="text-align:right">Improvements</th>
							<th style="text-align:right">Lines</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>${today}</td>
							<td class="value-cell value-highlight">${dailyStats.improvements || 0}</td>
							<td class="value-cell">${dailyStats.linesImproved || 0}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
		
		<!-- Monthly Panel -->
		<div class="tab-panel" role="tabpanel" id="tab-monthly" aria-labelledby="btn-monthly">
			<div class="summary-cards">
				<div class="summary-card">
					<div class="card-value">${monthlyStats.improvements || 0}</div>
					<div class="card-label">This Month</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${monthlyStats.linesImproved || 0}</div>
					<div class="card-label">Lines This Month</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${monthlyStats.tokensUsed || 0}</div>
					<div class="card-label">Tokens This Month</div>
				</div>
			</div>
			
			<div class="data-table-container">
				<table class="data-table">
					<thead>
						<tr>
							<th>Month</th>
							<th style="text-align:right">Improvements</th>
							<th style="text-align:right">Lines</th>
							<th style="text-align:right">Tokens</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>${thisMonth}</td>
							<td class="value-cell value-highlight">${monthlyStats.improvements || 0}</td>
							<td class="value-cell">${monthlyStats.linesImproved || 0}</td>
							<td class="value-cell">${monthlyStats.tokensUsed || 0}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
		
		<!-- Yearly Panel -->
		<div class="tab-panel" role="tabpanel" id="tab-yearly" aria-labelledby="btn-yearly">
			<div class="summary-cards">
				<div class="summary-card">
					<div class="card-value">${yearlyStats.improvements || 0}</div>
					<div class="card-label">This Year</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${yearlyStats.linesImproved || 0}</div>
					<div class="card-label">Lines This Year</div>
				</div>
				<div class="summary-card">
					<div class="card-value">${yearlyStats.tokensUsed || 0}</div>
					<div class="card-label">Tokens This Year</div>
				</div>
			</div>
			
			<div class="data-table-container">
				<table class="data-table">
					<thead>
						<tr>
							<th>Year</th>
							<th style="text-align:right">Improvements</th>
							<th style="text-align:right">Lines</th>
							<th style="text-align:right">Tokens</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>${thisYear}</td>
							<td class="value-cell value-highlight">${yearlyStats.improvements || 0}</td>
							<td class="value-cell">${yearlyStats.linesImproved || 0}</td>
							<td class="value-cell">${yearlyStats.tokensUsed || 0}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
		
		<!-- Actions -->
		<div class="actions-bar">
			<button class="action-btn secondary" onclick="exportStats()">📤 Export Statistics</button>
			<button class="action-btn secondary" onclick="resetStats()">🔄 Reset Statistics</button>
			<button class="action-btn primary" onclick="closeDialog()">✓ Done</button>
		</div>
	</div>
	
	<script>
		const vscode = acquireVsCodeApi();
		
		function switchTab(tabId) {
			// Update tab buttons
			document.querySelectorAll('.tab-btn').forEach(btn => {
				btn.classList.remove('active');
				btn.setAttribute('aria-selected', 'false');
			});
			document.getElementById('btn-' + tabId).classList.add('active');
			document.getElementById('btn-' + tabId).setAttribute('aria-selected', 'true');
			
			// Update panels
			document.querySelectorAll('.tab-panel').forEach(panel => {
				panel.classList.remove('active');
			});
			document.getElementById('tab-' + tabId).classList.add('active');
		}
		
		function exportStats() {
			vscode.postMessage({ command: 'exportStatistics' });
		}
		
		function resetStats() {
			if (confirm('Are you sure you want to reset all statistics?')) {
				vscode.postMessage({ command: 'resetStatistics' });
			}
		}
		
		function closeDialog() {
			vscode.postMessage({ command: 'close' });
		}
		
		// Keyboard navigation for tabs
		document.querySelector('.tab-list').addEventListener('keydown', (e) => {
			const tabs = Array.from(document.querySelectorAll('.tab-btn'));
			const currentIndex = tabs.indexOf(document.activeElement);
			
			if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
				tabs[currentIndex + 1].focus();
			} else if (e.key === 'ArrowLeft' && currentIndex > 0) {
				tabs[currentIndex - 1].focus();
			} else if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.activeElement.click();
			}
		});
	</script>
</body>
</html>
	`;
}

function getModernStatusPanelContent(stats: any): string {
	// Helper function to get safe stat values (no N/A)
	const getSafeValue = (value: any, fallback: string | number = 0): string | number => {
		if (value === null || value === undefined || value === "N/A" || value === "") {
			return fallback;
		}
		return value;
	};

	// Calculate derived statistics
	const totalImprovements = getSafeValue(stats.totalImprovements, 0) as number;
	const totalLines = getSafeValue(stats.totalLinesImproved, 0) as number;
	const totalTokens = getSafeValue(stats.totalTokensUsed, 0) as number;
	const avgTime = getSafeValue(stats.averageProcessingTime, 0) as number;
	const successRate = totalImprovements > 0 ? Math.round((totalImprovements / Math.max(totalImprovements, 1)) * 100) : 0;

	// Get most used language from languageStats
	const languageEntries = Object.entries((stats as any).languageStats || {});
	const topLanguageEntry = languageEntries.length > 0
		? languageEntries.sort(([, a], [, b]) => (b as any).count - (a as any).count)[0]
		: null;
	const topLanguage = topLanguageEntry ? topLanguageEntry[0] : "No data yet";

	// Get time-based statistics
	const today = new Date().toISOString().split('T')[0];
	const thisMonth = new Date().toISOString().slice(0, 7);
	const thisYear = new Date().getFullYear().toString();

	// Calculate current week start (Monday)
	const now = new Date();
	const day = now.getDay();
	const diff = now.getDate() - day + (day === 0 ? -6 : 1);
	const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0];

	const dailyStats = (stats as any).dailyStats?.[today] || { improvements: 0, linesImproved: 0 };
	const weeklyStats = (stats as any).weeklyStats?.[weekStart] || { improvements: 0, linesImproved: 0 };
	const monthlyStats = (stats as any).monthlyStats?.[thisMonth] || { improvements: 0, linesImproved: 0, tokensUsed: 0 };
	const yearlyStats = (stats as any).yearlyStats?.[thisYear] || { improvements: 0, linesImproved: 0, tokensUsed: 0 };

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AccessiMind Dashboard</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.css">
	<style>
		:root {
			--vscode-font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		}
		
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-foreground);
			padding: 16px;
			margin: 0;
			line-height: 1.6;
		}
		
		.dashboard-container {
			max-width: 1200px;
			margin: 0 auto;
		}
		
		.main-layout {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 24px;
			margin-top: 24px;
		}
		
		@media (max-width: 768px) {
			.main-layout {
				grid-template-columns: 1fr;
			}
		}
		
		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 24px;
			padding-bottom: 16px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		
		.header-actions {
			display: flex;
			gap: 8px;
			align-items: center;
		}
		
		.header h1 {
			margin: 0;
			font-size: 24px;
			font-weight: 600;
		}
		
		.panel {
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 12px;
			padding: 24px;
			position: relative;
		}
		
		.panel-header {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-bottom: 20px;
			padding-bottom: 12px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		
		.panel-icon {
			font-size: 20px;
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border-radius: 8px;
		}
		
		.actions-grid {
			display: grid;
			grid-template-columns: 1fr;
			gap: 16px;
		}
		
		.action-button {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 8px;
			padding: 16px 20px;
			display: flex;
			align-items: center;
			gap: 12px;
			cursor: pointer;
			transition: all 0.2s ease;
			text-align: left;
			width: 100%;
			font-family: inherit;
			font-size: 14px;
			font-weight: 500;
		}
		
		.action-button:hover {
			background: var(--vscode-button-hoverBackground);
			transform: translateY(-1px);
		}
		
		.action-button:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
		
		.action-button .icon {
			font-size: 16px;
			min-width: 20px;
		}
		
		.action-button .content {
			flex: 1;
		}
		
		.action-button .title {
			font-weight: 600;
			margin-bottom: 4px;
		}
		
		.action-button .description {
			font-size: 12px;
			opacity: 0.8;
		}
		
		.close-button {
			padding: 6px 8px !important;
			background: transparent !important;
			color: var(--vscode-foreground) !important;
			border: 1px solid var(--vscode-panel-border) !important;
			min-width: 32px;
			justify-content: center;
		}
		
		.close-button:hover {
			background: var(--vscode-toolbar-hoverBackground) !important;
			color: var(--vscode-errorForeground) !important;
		}
		
		.action-card h3 {
			margin: 0;
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-textLink-foreground);
		}
		
		.action-card p {
			margin: 0;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			line-height: 1.4;
		}
		
		.stats-table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 16px;
		}
		
		.stats-table th,
		.stats-table td {
			padding: 12px 16px;
			text-align: left;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		
		.stats-table th {
			background: var(--vscode-editor-background);
			font-weight: 600;
			font-size: 14px;
			color: var(--vscode-textLink-foreground);
		}
		
		.stats-table td {
			font-size: 14px;
		}
		
		.stats-table tr:hover {
			background: var(--vscode-list-hoverBackground);
		}
		
		.stat-value {
			font-weight: 600;
			color: var(--vscode-textLink-foreground);
		}
		
		.stat-value.primary {
			color: var(--vscode-button-background);
			font-size: 16px;
		}
		
		.export-actions {
			display: flex;
			gap: 8px;
			margin-top: 16px;
		}
		
		.export-button {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			padding: 8px 16px;
			cursor: pointer;
			font-size: 12px;
			font-weight: 500;
			transition: all 0.2s ease;
		}
		
		.export-button:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}
		
		.export-button:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
		
		.reset-button {
			background: var(--vscode-errorForeground);
			color: white;
			border: none;
			border-radius: 6px;
			padding: 8px 16px;
			cursor: pointer;
			font-size: 12px;
			font-weight: 500;
			transition: all 0.2s ease;
		}
		
		.reset-button:hover {
			opacity: 0.9;
		}
		
		.reset-button:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
		
				.section-title {
			font-size: 18px;
			font-weight: 600;
			margin-bottom: 16px;
			color: var(--vscode-textLink-foreground);
		}
		
		.refresh-button {
			margin-left: auto;
		}
	</style>
</head>
<body>
	<div class="dashboard-container" role="main" aria-label="AccessiMind Dashboard">
		<!-- Header -->
		<header class="header" role="banner">
			<span style="font-size: 32px;" role="img" aria-label="Accessibility icon">♿</span>
			<h1 id="dashboard-title">AccessiMind Dashboard</h1>
			<div class="header-actions">
				<button
					class="action-button refresh-button"
					onclick="refreshStats()"
					aria-label="Refresh statistics data"
					aria-describedby="dashboard-title">
					<span class="icon" role="img" aria-label="Refresh icon">🔄</span>
					<span>Refresh</span>
				</button>
				<button
					class="action-button close-button"
					onclick="closeDashboard()"
					aria-label="Close dashboard"
					title="Close dashboard">
					<span class="icon" role="img" aria-label="Close icon">✕</span>
				</button>
			</div>
		</header>

		<!-- Two Panel Layout -->
		<div class="main-layout">
			<!-- Left Panel: Functions -->
			<section class="panel" role="region" aria-labelledby="functions-title">
				<div class="panel-header">
					<div class="panel-icon" role="img" aria-label="Statistics management icon">📊</div>
					<h2 id="functions-title">Statistics Management</h2>
				</div>
				
				<div class="actions-grid" role="group" aria-labelledby="functions-title">
					<div role="group" aria-labelledby="export-title">
						<div class="title" id="export-title" style="font-weight: 600; margin-bottom: 8px;">📊 Export Analysis Data</div>
						<div class="description" style="font-size: 12px; margin-bottom: 12px;">Export your improvement statistics and analysis data</div>
						<div class="export-actions">
							<button 
								class="export-button" 
								onclick="exportAnalysisJSON()"
								aria-label="Export statistics as JSON format"
								role="button">
								JSON Format
							</button>
							<button 
								class="export-button" 
								onclick="exportAnalysisCSV()"
								aria-label="Export statistics as CSV format"
								role="button">
								CSV Format
							</button>
						</div>
					</div>
					
					<button 
						class="reset-button" 
						onclick="resetAnalysisData()"
						aria-label="Reset all analysis data - Warning: This action cannot be undone"
						role="button">
						<span class="icon" role="img" aria-label="Reset icon">🔄</span>
						Reset All Data
					</button>
				</div>
			</section>

			<!-- Right Panel: Statistics -->
			<section class="panel" role="region" aria-labelledby="statistics-title">
				<div class="panel-header">
					<div class="panel-icon" role="img" aria-label="Statistics icon">📈</div>
					<h2 id="statistics-title">Statistics Overview</h2>
				</div>
				
				<table class="stats-table" role="table" aria-labelledby="statistics-title" id="statsTable">
					<thead>
						<tr role="row">
							<th scope="col" role="columnheader">Metric</th>
							<th scope="col" role="columnheader">Value</th>
						</tr>
					</thead>
					<tbody role="rowgroup">
						<tr role="row">
							<td role="cell">Total Improvements</td>
							<td role="cell" class="stat-value primary" aria-label="${totalImprovements} total improvements made">${totalImprovements}</td>
						</tr>
						<tr role="row">
							<td role="cell">Lines Improved</td>
							<td role="cell" class="stat-value" aria-label="${totalLines} lines of code enhanced">${totalLines.toLocaleString()}</td>
						</tr>
						<tr role="row">
							<td role="cell">AI Tokens Used</td>
							<td role="cell" class="stat-value" aria-label="${totalTokens} AI processing tokens consumed">${totalTokens.toLocaleString()}</td>
						</tr>
						<tr role="row">
							<td role="cell">Average Processing Time</td>
							<td role="cell" class="stat-value" aria-label="${avgTime} milliseconds average processing time">${avgTime}ms</td>
						</tr>
						<tr role="row">
							<td role="cell">Success Rate</td>
							<td role="cell" class="stat-value" aria-label="${successRate} percent success rate">${successRate}%</td>
						</tr>
						<tr role="row">
							<td role="cell">Top Programming Language</td>
							<td role="cell" class="stat-value" aria-label="Most improved language is ${topLanguage}">${topLanguage}</td>
						</tr>
						<tr role="row">
							<td role="cell">Today's Improvements</td>
							<td role="cell" class="stat-value" aria-label="${dailyStats.improvements} improvements made today">${dailyStats.improvements}</td>
						</tr>
						<tr role="row">
							<td role="cell">This Week's Improvements</td>
							<td role="cell" class="stat-value" aria-label="${weeklyStats.improvements} improvements made this week">${weeklyStats.improvements}</td>
						</tr>
						<tr role="row">
							<td role="cell">This Month's Improvements</td>
							<td role="cell" class="stat-value" aria-label="${monthlyStats.improvements} improvements made this month">${monthlyStats.improvements}</td>
						</tr>
						<tr role="row">
							<td role="cell">This Year's Improvements</td>
							<td role="cell" class="stat-value" aria-label="${yearlyStats.improvements} improvements made this year">${yearlyStats.improvements}</td>
						</tr>
					</tbody>
				</table>
				
				<!-- WCAG Criteria Section -->
				<div style="margin-top: 24px;" role="region" aria-labelledby="wcag-criteria-title">
					<h3 id="wcag-criteria-title" class="section-title">♿ WCAG Criteria Applied</h3>
					<table class="stats-table" role="table" aria-labelledby="wcag-criteria-title">
						<thead>
							<tr role="row">
								<th scope="col" role="columnheader">WCAG Criterion</th>
								<th scope="col" role="columnheader">Times Applied</th>
							</tr>
						</thead>
						<tbody role="rowgroup">
							${Object.entries((stats as any).wcagCriteriaStats || {}).length > 0
			? Object.entries((stats as any).wcagCriteriaStats || {}).map(([criteria, count]) => `
									<tr role="row">
										<td role="cell">WCAG ${criteria}</td>
										<td role="cell" class="stat-value" aria-label="Applied ${count} times">${count}</td>
									</tr>
								`).join("")
			: `
									<tr role="row">
										<td role="cell" colspan="2" style="text-align: center; font-style: italic; opacity: 0.7;">
											No WCAG criteria applied yet. Start improving your code to see statistics here.
										</td>
									</tr>
								`
		}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	</div>

	<script src="https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.js"></script>
	<script>
		const vscode = acquireVsCodeApi();
		
		// Helper function to announce actions for screen readers (defined first)
		function announceAction(message) {
			const announcement = document.createElement('div');
			announcement.setAttribute('aria-live', 'polite');
			announcement.setAttribute('aria-atomic', 'true');
			announcement.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
			announcement.textContent = message;
			document.body.appendChild(announcement);
			setTimeout(() => document.body.removeChild(announcement), 1000);
		}
		
		// Accessibility-focused function implementations
		function refreshStats() {
			// Show loading state for screen readers
			const button = document.querySelector('[onclick="refreshStats()"]');
			if (button) {
				button.setAttribute('aria-busy', 'true');
				button.setAttribute('aria-label', 'Refreshing statistics data, please wait');
			}
			
			vscode.postMessage({ command: 'refreshStats' });
			
			// Reset aria-busy after a short delay
			setTimeout(() => {
				if (button) {
					button.setAttribute('aria-busy', 'false');
					button.setAttribute('aria-label', 'Refresh statistics data');
				}
			}, 1000);
		}
		
		function closeDashboard() {
			// Announce close action for screen readers
			announceAction('Closing AccessiMind dashboard');
			vscode.postMessage({ command: 'closeDashboard' });
		}
		

		

		
		function exportAnalysisJSON() {
			// Announce export action
			announceAction('Exporting statistics data as JSON format');
			vscode.postMessage({ command: 'exportAnalysisJSON' });
		}
		
		function exportAnalysisCSV() {
			// Announce export action
			announceAction('Exporting statistics data as CSV format');
			vscode.postMessage({ command: 'exportAnalysisCSV' });
		}
		
		function resetAnalysisData() {
			// Just send the command - VS Code will handle the confirmation
			announceAction('Requesting statistics reset');
			vscode.postMessage({ command: 'resetAnalysisData' });
		}
		
		// Handle messages from extension
		window.addEventListener('message', event => {
			const message = event.data;
			if (message.command === 'updateStats') {
				updateStatsDisplay(message.stats);
			}
		});
		
		function updateStatsDisplay(stats) {
			// Update stats table with accessibility features
			const statsTable = document.getElementById('statsTable');
			if (statsTable) {
				const tbody = statsTable.querySelector('tbody');
				if (tbody) {
					// Update with safe values (no N/A)
					const totalImprovements = stats.totalImprovements || 0;
					const totalLines = stats.totalLinesImproved || 0;
					const totalTokens = stats.totalTokensUsed || 0;
					const avgTime = stats.averageProcessingTime || 0;
					const successRate = totalImprovements > 0 ? Math.round((totalImprovements / Math.max(totalImprovements, 1)) * 100) : 0;
					
					// Get most used language from languageStats
					const languageEntries = Object.entries(stats.languageStats || {});
					const topLanguageEntry = languageEntries.length > 0 
						? languageEntries.sort(([,a], [,b]) => b.count - a.count)[0]
						: null;
					const topLanguage = topLanguageEntry ? topLanguageEntry[0] : 'No data yet';
					
					// Get time-based statistics  
					const today = new Date().toISOString().split('T')[0];
					const thisMonth = new Date().toISOString().slice(0, 7);
					const thisYear = new Date().getFullYear().toString();
					
					// Calculate current week start (Monday)
					const now = new Date();
					const day = now.getDay();
					const diff = now.getDate() - day + (day === 0 ? -6 : 1);
					const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0];
					
					const dailyStats = stats.dailyStats?.[today] || { improvements: 0 };
					const weeklyStats = stats.weeklyStats?.[weekStart] || { improvements: 0 };
					const monthlyStats = stats.monthlyStats?.[thisMonth] || { improvements: 0 };
					const yearlyStats = stats.yearlyStats?.[thisYear] || { improvements: 0 };
					
					tbody.innerHTML = \`
						<tr role="row">
							<td role="cell">Total Improvements</td>
							<td role="cell" class="stat-value primary" aria-label="\${totalImprovements} total improvements made">\${totalImprovements}</td>
						</tr>
						<tr role="row">
							<td role="cell">Lines Improved</td>
							<td role="cell" class="stat-value" aria-label="\${totalLines} lines of code enhanced">\${totalLines.toLocaleString()}</td>
						</tr>
						<tr role="row">
							<td role="cell">AI Tokens Used</td>
							<td role="cell" class="stat-value" aria-label="\${totalTokens} AI processing tokens consumed">\${totalTokens.toLocaleString()}</td>
						</tr>
						<tr role="row">
							<td role="cell">Average Processing Time</td>
							<td role="cell" class="stat-value" aria-label="\${avgTime} milliseconds average processing time">\${avgTime}ms</td>
						</tr>
						<tr role="row">
							<td role="cell">Success Rate</td>
							<td role="cell" class="stat-value" aria-label="\${successRate} percent success rate">\${successRate}%</td>
						</tr>
						<tr role="row">
							<td role="cell">Top Programming Language</td>
							<td role="cell" class="stat-value" aria-label="Most improved language is \${topLanguage}">\${topLanguage}</td>
						</tr>
						<tr role="row">
							<td role="cell">Today's Improvements</td>
							<td role="cell" class="stat-value" aria-label="\${dailyStats.improvements} improvements made today">\${dailyStats.improvements}</td>
						</tr>
						<tr role="row">
							<td role="cell">This Week's Improvements</td>
							<td role="cell" class="stat-value" aria-label="\${weeklyStats.improvements} improvements made this week">\${weeklyStats.improvements}</td>
						</tr>
						<tr role="row">
							<td role="cell">This Month's Improvements</td>
							<td role="cell" class="stat-value" aria-label="\${monthlyStats.improvements} improvements made this month">\${monthlyStats.improvements}</td>
						</tr>
						<tr role="row">
							<td role="cell">This Year's Improvements</td>
							<td role="cell" class="stat-value" aria-label="\${yearlyStats.improvements} improvements made this year">\${yearlyStats.improvements}</td>
						</tr>
					\`;
				}
			}
			
			// Announce update to screen readers
			announceAction('Statistics data updated successfully');
		}
		
		// Keyboard navigation enhancement
		document.addEventListener('DOMContentLoaded', function() {
			// Add keyboard navigation for custom buttons
			const buttons = document.querySelectorAll('.action-button, .export-button, .reset-button');
			buttons.forEach(button => {
				button.addEventListener('keydown', function(e) {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						button.click();
					}
				});
				
				// Ensure buttons are focusable
				if (!button.hasAttribute('tabindex')) {
					button.setAttribute('tabindex', '0');
				}
			});
			
			// Enhanced focus management
			const focusableElements = document.querySelectorAll(
				'button, [tabindex]:not([tabindex="-1"]), a[href], input, select, textarea'
			);
			
			// Create a focus trap within the dashboard
			if (focusableElements.length > 0) {
				const firstFocusable = focusableElements[0];
				const lastFocusable = focusableElements[focusableElements.length - 1];
				
				document.addEventListener('keydown', function(e) {
					if (e.key === 'Tab') {
						if (e.shiftKey && document.activeElement === firstFocusable) {
							e.preventDefault();
							lastFocusable.focus();
						} else if (!e.shiftKey && document.activeElement === lastFocusable) {
							e.preventDefault();
							firstFocusable.focus();
						}
					}
				});
			}
		});
	</script>
</body>
</html>
	`;
}

async function loadSavedSettings(): Promise<void> {
	try {
		const config = vscode.workspace.getConfiguration('wcagEnhancer');

		// AI provider ve model ayarlarını yükle
		const aiConfig = config.get('ai') as any || {};
		const aiModelConfig = config.get('aiModels') as any || {};

		// Provider ayarını yükle
		if (aiConfig.provider) {
			await aiProviderManager.setProvider(aiConfig.provider);
			logger.info(`🔄 Saved AI provider loaded: ${aiConfig.provider}`);
		}

		// Model ayarını yükle - hem aiConfig hem de aiModelConfig'den kontrol et
		const selectedModel = aiModelConfig.selectedModel || aiConfig.selectedModel;
		if (selectedModel) {
			await aiProviderManager.setModel(selectedModel);
			logger.info(`🔄 Saved AI model loaded: ${selectedModel}`);
		}

		// API key'i yükle (güvenlik için log'lanmaz)
		if (aiConfig.apiKey) {
			logger.info('🔄 Saved API key loaded');
		}

		// Dil ayarını yükle
		const savedLanguage = config.get('language') as string;
		if (savedLanguage && savedLanguage !== 'auto' && (savedLanguage === 'en' || savedLanguage === 'tr')) {
			localization.setLanguage(savedLanguage as 'en' | 'tr');
			logger.info(`🔄 Saved language loaded: ${savedLanguage}`);
		}

		// WCAG seviyesini yükle
		const wcagLevel = config.get('wcagLevel');
		if (wcagLevel) {
			logger.info(`🔄 Saved WCAG level loaded: ${wcagLevel}`);
		}

		// Wizard tamamlanma durumunu kontrol et
		const wizardCompleted = config.get('wizardCompleted', false);
		if (wizardCompleted) {
			logger.info('✅ AccessiMind fully configured from saved settings');

			// Ayarların tutarlılığını kontrol et ve gerekirse düzelt
			if (aiConfig.selectedModel && !aiModelConfig.selectedModel) {
				await config.update('aiModels', { ...aiModelConfig, selectedModel: aiConfig.selectedModel }, vscode.ConfigurationTarget.Global);
				logger.info('🔧 Model setting synchronized to aiModels config');
			} else if (!aiConfig.selectedModel && aiModelConfig.selectedModel) {
				await config.update('ai', { ...aiConfig, selectedModel: aiModelConfig.selectedModel }, vscode.ConfigurationTarget.Global);
				logger.info('🔧 Model setting synchronized to ai config');
			}
		} else {
			logger.info('⚠️ AccessiMind configuration incomplete - wizard needed');
		}

	} catch (error) {
		logger.error('❌ Error loading saved settings:', error);
	}
}

/**
	* JSON dosyasından ayarları yükle ve VS Code'a uygula
	*/
async function loadSettingsFromJson(): Promise<void> {
	try {
		if (!jsonManager) {
			logger.warn("⚠️ JSON Manager henüz başlatılmamış");
			return;
		}

		// JSON dosyasından ayarları al
		const settings = await jsonManager.getSettings();

		// JSON dosyasında ayar varsa VS Code'a uygula
		if (settings.wizard.completed) {
			await jsonManager.applyToVSCodeConfiguration();
			logger.info("✅ JSON dosyasından ayarlar VS Code'a uygulandı");
		} else {
			logger.info("ℹ️ Wizard henüz tamamlanmamış, JSON ayarları uygulanmadı");
		}
	} catch (error) {
		logger.error("❌ JSON dosyasından ayar yükleme hatası:", error);
		// Hata durumunda kullanıcıyı bilgilendir
		vscode.window.showWarningMessage(
			"⚠️ AccessiMind settings file could not be read. New settings will be created."
		);
	}
}

/**
 * Ayar değişikliklerini dinle ve JSON'a otomatik kaydet
 */
function setupSettingsChangeListener(): void {
	const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
		if (event.affectsConfiguration("wcagEnhancer") && jsonManager) {
			try {
				// Küçük bir delay ile çoklu değişiklikleri batch'le
				setTimeout(async () => {
					await jsonManager.syncFromVSCodeConfiguration();
					logger.info("🔄 VS Code ayarları JSON dosyasına senkronize edildi");
				}, 500);
			} catch (error) {
				logger.error("❌ VS Code ayarlarını JSON'a senkronize etme hatası:", error);
			}
		}
	});

	// Extension context'e listener'ı ekle (dispose için)
	if (jsonManager) {
		const context = (jsonManager as any).context;
		if (context && context.subscriptions) {
			context.subscriptions.push(configChangeListener);
		}
	}
}

/**
 * JSON Manager komutlarını kaydet
 */
function registerJsonManagerCommands(context: vscode.ExtensionContext): void {
	// JSON ayarlarını VS Code'a uygula komutu
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.applyJsonSettings', async () => {
			try {
				if (!jsonManager) {
					vscode.window.showErrorMessage("❌ JSON Manager bulunamadı");
					return;
				}

				await jsonManager.applyToVSCodeConfiguration();
				vscode.window.showInformationMessage("✅ JSON settings have been applied to VS Code!");
			} catch (error) {
				logger.error("❌ JSON ayarlarını uygulama hatası:", error);
				vscode.window.showErrorMessage("❌ JSON ayarları uygulanamadı: " + error);
			}
		})
	);

	// VS Code ayarlarını JSON'a senkronize et komutu
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.syncToJson', async () => {
			try {
				if (!jsonManager) {
					vscode.window.showErrorMessage("❌ JSON Manager bulunamadı");
					return;
				}

				await jsonManager.syncFromVSCodeConfiguration();
				vscode.window.showInformationMessage("✅ VS Code ayarları JSON dosyasına senkronize edildi!");
			} catch (error) {
				logger.error("❌ JSON senkronizasyon hatası:", error);
				vscode.window.showErrorMessage("❌ Senkronizasyon başarısız: " + error);
			}
		})
	);

	// JSON dosya yolunu göster komutu
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.showJsonPath', async () => {
			if (!jsonManager) {
				vscode.window.showErrorMessage("❌ JSON Manager bulunamadı");
				return;
			}

			const jsonPath = jsonManager.getJsonFilePath();
			const action = await vscode.window.showInformationMessage(
				`📁 AccessiMind JSON dosya yolu:\n${jsonPath}`,
				"Dosyayı Aç", "Klasörü Aç", "Yolu Kopyala"
			);

			switch (action) {
				case "Dosyayı Aç":
					const uri = vscode.Uri.file(jsonPath);
					await vscode.window.showTextDocument(uri);
					break;
				case "Klasörü Aç":
					const folderUri = vscode.Uri.file(require('path').dirname(jsonPath));
					await vscode.env.openExternal(folderUri);
					break;
				case "Yolu Kopyala":
					await vscode.env.clipboard.writeText(jsonPath);
					vscode.window.showInformationMessage("📋 Dosya yolu panoya kopyalandı!");
					break;
			}
		})
	);

	// JSON dosya durumunu göster komutu
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.showJsonStatus', async () => {
			try {
				if (!jsonManager) {
					vscode.window.showErrorMessage("❌ JSON Manager bulunamadı");
					return;
				}

				const settings = await jsonManager.getSettings();
				const jsonPath = jsonManager.getJsonFilePath();

				const message = `📊 AccessiMind JSON Durumu:

📁 Dosya Yolu: ${jsonPath}
✨ Sürüm: ${settings.version}
📅 Oluşturulma: ${new Date(settings.createdAt).toLocaleString('tr-TR')}
🔄 Son Güncelleme: ${new Date(settings.lastModified).toLocaleString('tr-TR')}

🧙‍♂️ Wizard Durumu: ${settings.wizard.completed ? '✅ Tamamlandı' : '⏳ Devam ediyor'}
${settings.wizard.completedAt ? `📅 Tamamlanma: ${new Date(settings.wizard.completedAt).toLocaleString('tr-TR')}` : ''}

⚙️ AI Sağlayıcı: ${settings.settings.ai?.provider || 'Belirlenmemiş'}
🤖 Model: ${settings.settings.ai?.selectedModel || 'Belirlenmemiş'}
🔑 API Key: ${settings.settings.ai?.apiKeyConfigured ? '✅ Yapılandırılmış' : '❌ Eksik'}
🌍 Dil: ${settings.settings.language || 'auto'}
♿ WCAG Seviyesi: ${settings.settings.wcagLevel || 'AA'}

📈 İstatistikler: ${settings.statistics.enabled ? '✅ Aktif' : '❌ Devre dışı'}
📊 Toplam Analiz: ${settings.statistics.totalAnalyses}
🔧 Toplam İyileştirme: ${settings.statistics.totalImprovements}`;

				vscode.window.showInformationMessage(message);
			} catch (error) {
				logger.error("❌ JSON durumu gösterme hatası:", error);
				vscode.window.showErrorMessage("❌ JSON durumu alınamadı: " + error);
			}
		})
	);

	// JSON dosyasını sıfırla komutu
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.resetJsonFile', async () => {
			const action = await vscode.window.showWarningMessage(
				'⚠️ AccessiMind JSON dosyasını sıfırlamak istediğinizden emin misiniz?\n\nBu işlem tüm wizard ve ayar geçmişinizi silecektir.',
				{ modal: true },
				'JSON Dosyasını Sıfırla'
			);

			if (action === 'JSON Dosyasını Sıfırla') {
				try {
					if (!jsonManager) {
						vscode.window.showErrorMessage("❌ JSON Manager bulunamadı");
						return;
					}

					// JSON manager'ı yeniden başlat (bu default dosya oluşturacak)
					jsonManager.dispose();
					const newJsonManager = AccessiMindJsonManager.getInstance((jsonManager as any).context);
					await newJsonManager.initialize();

					// Global değişkeni güncelle
					jsonManager = newJsonManager;
					wizardManager.setJsonManager(jsonManager);

					vscode.window.showInformationMessage("✅ AccessiMind JSON dosyası başarıyla sıfırlandı!");
				} catch (error) {
					logger.error("❌ JSON sıfırlama hatası:", error);
					vscode.window.showErrorMessage("❌ JSON dosyası sıfırlanamadı: " + error);
				}
			}
		})
	);

	// JSON dosyası sağlık kontrolü komutu
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.validateJsonHealth', async () => {
			try {
				if (!jsonManager) {
					vscode.window.showErrorMessage("❌ JSON Manager bulunamadı");
					return;
				}

				const health = await jsonManager.validateJsonHealth();

				if (health.isHealthy) {
					vscode.window.showInformationMessage("✅ AccessiMind JSON dosyası sağlıklı!");
				} else {
					const action = await vscode.window.showWarningMessage(
						`⚠️ JSON dosyasında sorunlar bulundu:\n${health.issues.join('\n')}`,
						"Dosyayı Onar", "Detayları Göster"
					);

					if (action === "Dosyayı Onar") {
						await vscode.commands.executeCommand('wcagEnhancer.repairJsonFile');
					}
				}
			} catch (error) {
				logger.error("❌ JSON sağlık kontrolü hatası:", error);
				vscode.window.showErrorMessage("❌ Sağlık kontrolü başarısız: " + error);
			}
		})
	);

	// JSON dosyasını onar komutu
	context.subscriptions.push(
		vscode.commands.registerCommand('wcagEnhancer.repairJsonFile', async () => {
			try {
				if (!jsonManager) {
					vscode.window.showErrorMessage("❌ JSON Manager bulunamadı");
					return;
				}

				const action = await vscode.window.showWarningMessage(
					'🔧 JSON dosyasını onarım işlemi:\n\n• Mevcut dosya yedeklenecek\n• Yeni default dosya oluşturulacak\n• Mevcut wizard durumu kaybolabilir\n\nDevam etmek istiyor musunuz?',
					{ modal: true },
					'Dosyayı Onar'
				);

				if (action === 'Dosyayı Onar') {
					await jsonManager.repairJsonFile();
				}
			} catch (error) {
				logger.error("❌ JSON onarım hatası:", error);
				vscode.window.showErrorMessage("❌ Dosya onarılamadı: " + error);
			}
		})
	);
}

export function deactivate() {
	logger.info('🔄 AccessiMind deactivating...');

	// Dispose persistent settings manager
	if (persistentSettingsManager) {
		persistentSettingsManager.dispose();
	}

	// Dispose JSON manager
	if (jsonManager) {
		jsonManager.dispose();
	}

	// Dispose standard settings manager
	if (settingsManager) {
		settingsManager.dispose();
	}

	logger.info('✅ AccessiMind successfully deactivated');
}
