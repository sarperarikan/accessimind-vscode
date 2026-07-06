import * as path from "path";
import * as vscode from "vscode";

import { WcagImprover } from "./core/wcagImprover";
import { buildPreviewHtml, normalizeGeneratedCode } from "./utils/codeGenerationUtils";
import { AIProviderManager } from "./utils/aiProvider";
import { LocalizationManager } from "./utils/localizationManager";
import { logger } from "./utils/logger";
import { getDisabilityFocusInstruction } from "./utils/disabilityFocus";
import { getRuntimeSettings, readCustomRules } from "./utils/runtimeSettings";
import { StatisticsManager } from "./utils/statisticsManager";
import { WizardManager } from "./wizardManager";
import { evaluateFixConfidence } from "./innovation/fixConfidence";
import {
	openCodexAccountLoginTerminal,
	selectCodexSubscriptionProvider,
	testCodexAccountConnection,
} from "./utils/codexAccountAuth";

interface StatsViewLike {
	updateStatistics(stats: unknown): void;
}

interface ExtensionActionsOptions {
	context: vscode.ExtensionContext;
	aiProviderManager: AIProviderManager;
	localization: LocalizationManager;
	statisticsManager: StatisticsManager;
	statsViewProvider: StatsViewLike;
	modernStatsViewProvider: StatsViewLike;
	updateStatusBar: () => void;
	wizardManager: WizardManager;
	wcagImprover: WcagImprover;
}

export function createExtensionActions({
	context,
	aiProviderManager,
	localization,
	statisticsManager,
	statsViewProvider,
	modernStatsViewProvider,
	updateStatusBar,
	wizardManager,
	wcagImprover,
}: ExtensionActionsOptions) {
	const isEnglish = (): boolean => localization.getCurrentLanguage() === "en";
	const localize = (en: string, tr: string): string => (isEnglish() ? en : tr);
	const handleApiKeyConfigurationError = async (errorMessage: string): Promise<void> => {
		if (!errorMessage.includes("API anahtarı") && !errorMessage.includes("API key")) {
			return;
		}

		const action = await vscode.window.showErrorMessage(
			localization.getString("prompt.api.key.required"),
			localization.getString("button.go.to.settings")
		);

		if (action === localization.getString("button.go.to.settings")) {
			void vscode.commands.executeCommand("wcagEnhancer.setApiKey");
		}
	};

	const extractWcagCriteriaFromCode = (code: string): string[] => {
		const criteria: string[] = [];
		if (!code) {
			return criteria;
		}

		const perf = vscode.workspace.getConfiguration("wcagEnhancer").get("performance") as Record<string, unknown> | undefined;
		const maxScanSize = typeof perf?.maxScanSize === "number" ? perf.maxScanSize : 500000;
		const maxMatches = typeof perf?.maxRegexMatches === "number" ? perf.maxRegexMatches : 100;

		if (code.length > maxScanSize) {
			return criteria;
		}

		const wcagPatterns = [
			/\/\*\s*WCAG:\s*([^*]+)\*\//gi,
			/\/\/\s*WCAG:\s*(.+)/gi,
			/<!--\s*WCAG:\s*([^-]+)-->/gi,
		];

		for (const pattern of wcagPatterns) {
			let count = 0;
			for (const match of code.matchAll(pattern)) {
				if (!match[1]) {
					continue;
				}

				criteria.push(match[1].trim());
				count += 1;

				if (count >= maxMatches) {
					break;
				}
			}
		}

		return criteria;
	};

	const updateStatisticsViews = (): void => {
		const stats = statisticsManager.getDetailedStatistics();
		statsViewProvider.updateStatistics(stats);
		modernStatsViewProvider.updateStatistics(stats);
		updateStatusBar();
	};

	const analyzeCode = async (mode: "file" | "selection"): Promise<void> => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(localization.getString("error.no.active.editor"));
			return;
		}

		const selection = editor.selection;
		if (mode === "selection" && selection.isEmpty) {
			vscode.window.showErrorMessage(localization.getString("error.no.code.selected"));
			return;
		}

		const document = editor.document;
		const fileName = document.fileName;
		const language = document.languageId;
		const code = document.getText();
		const selectedCode = mode === "selection" ? document.getText(selection) : undefined;

		if (mode === "file" && !code.trim()) {
			vscode.window.showErrorMessage(localization.getString("error.empty.file"));
			return;
		}

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: mode === "file"
					? localize("Analyzing open code structures...", "Açık dosya yapıları analiz ediliyor...")
					: localize("Analyzing selected code structure...", "Seçili kod yapısı analiz ediliyor..."),
				cancellable: false,
			},
			async (progress) => {
				const startTime = Date.now();
				progress.report({ increment: 0, message: localize("Preparing AI provider...", "AI sağlayıcısı hazırlanıyor...") });

				const provider = await aiProviderManager.getCurrentProviderInstance();
				progress.report({
					increment: 30,
					message: mode === "file"
						? localize("Analyzing code structures...", "Kod yapıları analiz ediliyor...")
						: localize("Analyzing selected code...", "Seçili kod analiz ediliyor..."),
				});

				const config = vscode.workspace.getConfiguration("wcagEnhancer");
				const wcagLevel = (config.get("wcagLevel") as "A" | "AA" | "AAA") || "AA";
				const includeComments = config.get("includeComments") !== false;
				const currentProviderName = aiProviderManager.getCurrentProviderName();
				const runtimeSettings = getRuntimeSettings();
				const customRules = await readCustomRules();
				const guidedCode = [
					runtimeSettings.strictMode ? "STRICT_MODE: true" : "",
					runtimeSettings.contextAwareAnalysis
						? "CONTEXT_AWARE_ANALYSIS: enabled. Evaluate surrounding structure and interaction flow."
						: "CONTEXT_AWARE_ANALYSIS: disabled. Limit changes to the target scope.",
					getDisabilityFocusInstruction(
						runtimeSettings.disabilityFocusGroups as Array<"screenReader" | "lowVision" | "hearing" | "motor" | "cognitive">,
						localization.getCurrentLanguage() as "en" | "tr"
					),
					customRules ? `CUSTOM_RULES:\n${customRules}` : "",
					code,
				].filter(Boolean).join("\n\n");

				progress.report({
					increment: 60,
					message:
						mode === "file"
							? `Performing WCAG conformance check with ${currentProviderName}...`
							: localize(
								`Applying WCAG implementation with ${currentProviderName}...`,
								`${currentProviderName} ile WCAG uygulaması yapılıyor...`
							),
				});

				const improvementResult = await provider.improveCode({
					code: guidedCode,
					fileType: fileName.split(".").pop() || "unknown",
					language,
					selectedText: selectedCode,
					wcagLevel,
					includeComments,
					responseLanguage: localization.getCurrentLanguage() as "en" | "tr",
				});

				const processingTime = Date.now() - startTime;
				progress.report({ increment: 90, message: localize("Updating code...", "Kod güncelleniyor...") });

				if (!improvementResult.success || !improvementResult.content) {
					const errorMessage = improvementResult.error || localization.getString("error.unknown.occurred");
					vscode.window.showErrorMessage(
						localization.getStringWithParams("error.analysis.failed.detail", { error: errorMessage })
					);
					await handleApiKeyConfigurationError(errorMessage);
					return;
				}

				const normalized = normalizeGeneratedCode({
					originalCode: mode === "file" ? code : selectedCode || "",
					generatedContent: improvementResult.content,
					language,
					mode,
				});
				const finalCode = normalized.code;
				const confidence = evaluateFixConfidence(mode === "file" ? code : selectedCode || "", finalCode);
				if (confidence.pattern) {
					await context.workspaceState.update("accessimind.lastFixPattern", confidence.pattern);
				}

				await editor.edit((editBuilder) => {
					if (mode === "file") {
						const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(code.length));
						editBuilder.replace(fullRange, finalCode);
						return;
					}

					editBuilder.replace(selection, finalCode);
				});

				statisticsManager.recordImprovement({
					type: mode,
					language,
					fileName,
					linesImproved: finalCode.split("\n").length,
					processingTime,
					provider: aiProviderManager.getCurrentProviderName() as "gemini" | "vscode-copilot" | "ollama",
					model: "current",
					wcagCriteria: extractWcagCriteriaFromCode(finalCode),
					tokensUsed: improvementResult.tokensUsed || 0,
				});

				updateStatisticsViews();

				if (normalized.warnings.length > 0) {
					if (runtimeSettings.showNotifications) {
						void vscode.window.showWarningMessage(normalized.warnings.join(" "));
					}
				}

				if (confidence.score < 55) {
					if (runtimeSettings.showNotifications) {
						void vscode.window.showWarningMessage(
							localize(
								`Low fix confidence (${confidence.score}%). Please review diff before committing.`,
								`Dusuk duzeltme guveni (${confidence.score}%). Commit oncesi farki kontrol edin.`
							)
						);
					}
				}

				if (runtimeSettings.showNotifications) {
					vscode.window.showInformationMessage(
						localization.getStringWithParams("success.analysis.completed.detail", {
							provider: currentProviderName,
							lines: finalCode.split("\n").length,
							time: processingTime,
						}) + ` ${localize("Confidence", "Guven")}: ${confidence.score}%`
					);
				}
			}
		);
	};

	const analyzeOpenCodeStructures = async (): Promise<void> => {
		try {
			await analyzeCode("file");
		} catch (error) {
			logger.error("WCAG analysis error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: typeof error === "string"
						? error
						: localization.getString("error.unknown.occurred");

			vscode.window.showErrorMessage(
				localization.getStringWithParams("error.analysis.exception.detail", { error: errorMessage })
			);
			await handleApiKeyConfigurationError(errorMessage);
		}
	};

	const analyzeSelectedCodeStructure = async (): Promise<void> => {
		try {
			await analyzeCode("selection");
		} catch (error) {
			logger.error("Selected code WCAG analysis error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: typeof error === "string"
						? error
						: localization.getString("error.unknown.occurred");

			vscode.window.showErrorMessage(
				localization.getStringWithParams("error.analysis.exception.detail", { error: errorMessage })
			);
			await handleApiKeyConfigurationError(errorMessage);
		}
	};

	const handleInlineChat = async (): Promise<void> => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(localization.getString("error.no.active.editor"));
			return;
		}

		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showErrorMessage(localize("Please select code to modify", "Lütfen değiştirmek için kod seçin"));
			return;
		}

		const instructions = await vscode.window.showInputBox({
			placeHolder: localize(
				"Enter instructions (e.g., 'Make this accessible', 'Fix contrast')",
				"Talimat girin (örn. 'Bunu erişilebilir yap', 'Kontrastı düzelt')"
			),
			prompt: localize("AccessiMind Inline Chat", "AccessiMind Satır İçi Sohbet"),
		});

		if (!instructions) {
			return;
		}

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: localize("AccessiMind Inline Chat", "AccessiMind Satır İçi Sohbet"),
				cancellable: false,
			},
			async (progress) => {
				try {
					const document = editor.document;
					const language = document.languageId;
					const selectedCode = document.getText(selection);
					const provider = await aiProviderManager.getCurrentProviderInstance();
					const runtimeSettings = getRuntimeSettings();
					const customRules = await readCustomRules();

					progress.report({ message: localize("Thinking...", "Düşünüyor...") });

					const prompt = `
INSTRUCTIONS: ${instructions}
FILE TYPE: ${language}
STRICT_MODE: ${runtimeSettings.strictMode ? "ON" : "OFF"}
CONTEXT_AWARE_ANALYSIS: ${runtimeSettings.contextAwareAnalysis ? "ON" : "OFF"}
${getDisabilityFocusInstruction(
	runtimeSettings.disabilityFocusGroups as Array<"screenReader" | "lowVision" | "hearing" | "motor" | "cognitive">,
	localization.getCurrentLanguage() as "en" | "tr"
)}
${customRules ? `CUSTOM_RULES:\n${customRules}\n` : ""}

CODE TO MODIFY:
\`\`\`${language}
${selectedCode}
\`\`\`

Provide the modified code based on the instructions.
If the instruction implies WCAG improvements, apply relevant WCAG 2.2 criteria.
Write all inline comments and user-facing code comments in ${isEnglish() ? "English" : "Turkish"}.
Return ONLY the modified code without markdown code blocks if possible, or inside a code block.
`;

					const result = await provider.improveCode({
						code: prompt,
						fileType: language,
						language,
						mode: "edit",
						selectedText: instructions,
						includeComments: true,
						responseLanguage: localization.getCurrentLanguage() as "en" | "tr",
					});

					if (!result.success || !result.content) {
						vscode.window.showErrorMessage(
							localize("Inline Chat Error", "Satır içi sohbet hatası") + `: ${result.error}`
						);
						return;
					}

					const normalized = normalizeGeneratedCode({
						originalCode: selectedCode,
						generatedContent: result.content,
						language,
						mode: "selection",
					});
					const finalCode = normalized.code;

					await editor.edit((editBuilder) => {
						editBuilder.replace(selection, finalCode);
					});

					statisticsManager.recordImprovement({
						type: "inline-chat",
						language,
						fileName: document.fileName,
						linesImproved: finalCode.split("\n").length,
						processingTime: 0,
						provider: aiProviderManager.getCurrentProviderName() as "gemini" | "vscode-copilot",
						model: "current",
						wcagCriteria: [],
						tokensUsed: result.tokensUsed || 0,
					});

					updateStatisticsViews();

					if (normalized.warnings.length > 0 && runtimeSettings.showNotifications) {
						void vscode.window.showWarningMessage(normalized.warnings.join(" "));
					}
				} catch (error) {
					vscode.window.showErrorMessage(`${localize("Error", "Hata")}: ${error}`);
				}
			}
		);
	};

	const showDetailedWelcomeScreen = async (): Promise<void> => {
		await wizardManager.showWizard();
	};

	const setApiKey = async (): Promise<void> => {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = (config.get("ai") as Record<string, unknown>) || {};
		const currentKey = typeof aiConfig.apiKey === "string" ? aiConfig.apiKey : "";

		const apiKey = await vscode.window.showInputBox({
			title: localize("Gemini API Key Configuration", "Gemini API Anahtarı Yapılandırması"),
			prompt: localize(
				"Enter your Google Gemini API key from Google AI Studio",
				"Google AI Studio üzerinden aldığınız Gemini API anahtarını girin"
			),
			placeHolder: localize("AIzaSy... (Your API key)", "AIzaSy... (API anahtarınız)"),
			password: true,
			value: currentKey,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return localize("API key cannot be empty", "API anahtarı boş olamaz");
				}
				if (value.length < 20) {
					return localize("API key seems too short (minimum 20 characters)", "API anahtarı çok kısa görünüyor (en az 20 karakter)");
				}
				if (!value.startsWith("AIza")) {
					return localize('Gemini API keys typically start with "AIza"', 'Gemini API anahtarları genelde "AIza" ile başlar');
				}
				return null;
			},
		});

		if (apiKey === undefined) {
			return;
		}

		aiConfig.apiKey = apiKey;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

		const testConnectionLabel = localize("Test Connection", "Bağlantıyı Test Et");
		vscode.window.showInformationMessage(
			localize("Gemini API key updated successfully!", "Gemini API anahtarı başarıyla güncellendi!"),
			testConnectionLabel
		).then((action) => {
			if (action === testConnectionLabel) {
				void testAIConnection();
			}
		});
	};

	const testAIConnection = async (): Promise<void> => {
		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: localize("Testing AI connection...", "AI bağlantısı test ediliyor..."),
					cancellable: false,
				},
				async (progress) => {
					progress.report({ increment: 0, message: localize("Validating configuration...", "Yapılandırma doğrulanıyor...") });
					await new Promise((resolve) => setTimeout(resolve, 500));

					progress.report({ increment: 50, message: localize("Testing AI provider...", "AI sağlayıcısı test ediliyor...") });

					const { AITestUtils } = await import("./utils/aiTestUtils");
					const aiTestUtils = AITestUtils.getInstance();
					const result = await aiTestUtils.testAIProvider();

					progress.report({ increment: 100, message: localize("Showing results...", "Sonuçlar gösteriliyor...") });
					await aiTestUtils.showTestResult(result);
				}
			);
		} catch (error) {
			vscode.window.showErrorMessage(`${localize("AI test failed", "AI testi başarısız")}: ${error}`);
		}
	};

	const connectCodexAccount = async (): Promise<void> => {
		await openCodexAccountLoginTerminal();
		const testLabel = localize("Test Codex Account", "Codex Hesabini Test Et");
		void vscode.window.showInformationMessage(
			localize(
				"Codex Subscription selected. Complete ChatGPT sign-in in the terminal, then test the account connection.",
				"Codex Subscription secildi. Terminalde ChatGPT oturumunu tamamlayin, sonra hesap baglantisini test edin."
			),
			testLabel
		).then((action) => {
			if (action === testLabel) {
				void testCodexAccount();
			}
		});
	};

	const testCodexAccount = async (): Promise<void> => {
		await selectCodexSubscriptionProvider();
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: localize("Testing Codex account...", "Codex hesabi test ediliyor..."),
				cancellable: false,
			},
			async () => {
				const result = await testCodexAccountConnection();
				if (result.success) {
					vscode.window.showInformationMessage(
						localize(
							`Codex account is connected. Model: ${result.model}, ${result.responseTime}ms.`,
							`Codex hesabi bagli. Model: ${result.model}, ${result.responseTime}ms.`
						)
					);
					return;
				}

				const loginLabel = localize("Connect Codex Account", "Codex Hesabini Bagla");
				vscode.window.showErrorMessage(result.error || result.message, loginLabel).then((action) => {
					if (action === loginLabel) {
						void connectCodexAccount();
					}
				});
			}
		);
	};

	const showInBrowser = async (): Promise<void> => {
		const fs = await import("fs");
		const os = await import("os");
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage(
				localize("No active file. Open a file to preview.", "Aktif dosya yok. Önizleme için bir dosya açın.")
			);
			return;
		}

		const document = editor.document;
		const content = document.getText();
		const fileName = path.basename(document.fileName);
		const fileExt = path.extname(document.fileName).toLowerCase();

		const previewHtml = buildPreviewHtml(content, fileName, document.languageId || fileExt.slice(1));
		const previewDirectory = path.join(os.tmpdir(), "accessimind-preview");
		fs.mkdirSync(previewDirectory, { recursive: true });

		const safeBaseName = fileName.replace(/[^\w.-]/g, "_");
		const previewPath = path.join(previewDirectory, `${safeBaseName}.preview.html`);
		fs.writeFileSync(previewPath, previewHtml, "utf8");

		await vscode.env.openExternal(vscode.Uri.file(previewPath));
	};

	const openBrowserSession = async (): Promise<void> => {
		const urlInput = await vscode.window.showInputBox({
			title: localize("AccessiMind Browser Inspector", "AccessiMind Tarayici Denetleyici"),
			prompt: localize(
				"Enter a URL to inspect, or leave empty to use the current HTML file.",
				"Incelemek icin bir URL girin veya gecerli HTML dosyasini kullanmak icin bos birakin."
			),
			placeHolder: "https://example.com",
			ignoreFocusOut: true,
		});

		if (urlInput === undefined) {
			return;
		}

		const editor = vscode.window.activeTextEditor;
		const normalizedUrl = urlInput.trim();
		const { EmbeddedBrowserInspectorPanel } = await import("./views/embeddedBrowserInspectorPanel");

		if (!normalizedUrl) {
			if (!editor) {
				vscode.window.showWarningMessage(
					localize("No active HTML file. Enter a URL or open an HTML file first.", "Aktif HTML dosyasi yok. Once bir URL girin veya bir HTML dosyasi acin.")
				);
				return;
			}

			const document = editor.document;
			const isHtmlDocument = document.languageId === "html" || path.extname(document.fileName).toLowerCase() === ".html";
			if (!isHtmlDocument) {
				vscode.window.showWarningMessage(
					localize(
						"Browser Session can use the active file only when it is HTML. Otherwise enter a URL.",
						"Tarayici Oturumu aktif dosyayi sadece HTML ise kullanabilir. Aksi durumda URL girin."
					)
				);
				return;
			}

			EmbeddedBrowserInspectorPanel.createOrShow({
				documentUri: document.uri,
				htmlContent: document.getText(),
				targetUrl: document.uri.toString()
			}, {
				aiProviderManager,
				localization,
				statisticsManager
			});
			return;
		}

		const targetUrl = /^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`;
		EmbeddedBrowserInspectorPanel.createOrShow({
			targetUrl
		}, {
			aiProviderManager,
			localization,
			statisticsManager
		});
	};
	void wcagImprover;

	return {
		analyzeOpenCodeStructures,
		analyzeSelectedCodeStructure,
		handleInlineChat,
		showDetailedWelcomeScreen,
		setApiKey,
		testAIConnection,
		connectCodexAccount,
		testCodexAccount,
		showInBrowser,
		openBrowserSession,
	};
}

