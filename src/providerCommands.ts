import * as vscode from "vscode";
import { AIProviderManager } from "./utils/aiProvider";
import { StatisticsManager } from "./utils/statisticsManager";
import { LocalizationManager } from "./utils/localizationManager";
import { StatsViewProvider } from "./views/statsViewProvider";
import { ModernStatsViewProvider } from "./views/modernStatsViewProvider";
import { logger } from "./utils/logger";

// Shared dependencies
let aiProviderManager: AIProviderManager;
let statisticsManager: StatisticsManager;
let localizationManager: LocalizationManager;
let statsViewProvider: StatsViewProvider;
let modernStatsViewProvider: ModernStatsViewProvider;
let updateStatusBarCallback: (() => void) | null = null;

export function initializeProviderCommands(
	aiProvider: AIProviderManager,
	statsManager: StatisticsManager,
	localization: LocalizationManager,
	statsProvider: StatsViewProvider,
	modernStatsProvider: ModernStatsViewProvider,
	statusBarCallback: () => void
): void {
	aiProviderManager = aiProvider;
	statisticsManager = statsManager;
	localizationManager = localization;
	statsViewProvider = statsProvider;
	modernStatsViewProvider = modernStatsProvider;
	updateStatusBarCallback = statusBarCallback;
}

export async function improveCurrentFileWithProvider(providerType: "gemini" | "vscode-copilot"): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage(localizationManager.getString("error.no.active.editor"));
		return;
	}

	const document = editor.document;
	const fileName = document.fileName;
	const language = document.languageId;
	const code = document.getText();

	if (!code.trim()) {
		vscode.window.showErrorMessage(localizationManager.getString("error.empty.file"));
		return;
	}

	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: localizationManager.getStringWithParams("progress.provider.improving", { provider: providerType === "gemini" ? "Gemini" : "Copilot" }),
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();

			progress.report({ increment: 0, message: localizationManager.getString("progress.switching.provider") });

			// Temporarily switch to requested provider
			const originalProvider = aiProviderManager.getCurrentProviderName();

			try {
				await aiProviderManager.setProvider(providerType);
				const provider = await aiProviderManager.getCurrentProviderInstance();

				progress.report({ increment: 20, message: "Analyzing code..." });

				const config = vscode.workspace.getConfiguration("wcagEnhancer");
				const wcagLevel = config.get("wcagLevel") as "A" | "AA" | "AAA" || "AA";
				const includeComments = config.get("includeComments") !== false;
				const autoApply = config.get("autoApply") || false;

				progress.report({ increment: 40, message: localizationManager.getString("progress.applying.rules") });

				const improvementResult = await provider.improveCode({
					code,
					fileType: fileName.split(".").pop() || "unknown",
					language,
					wcagLevel,
					includeComments,
					responseLanguage: localizationManager.getCurrentLanguage() as "en" | "tr"
				});

				const processingTime = Date.now() - startTime;

				progress.report({ increment: 80, message: localizationManager.getString("progress.preparing.results") });

				if (improvementResult.success && improvementResult.improvedCode) {
					// Count improved lines
					const originalLines = code.split("\n");
					const improvedLines = improvementResult.improvedCode.split("\n");
					const linesImproved = Math.abs(improvedLines.length - originalLines.length) +
						originalLines.filter((line, index) =>
							improvedLines[index] && line.trim() !== improvedLines[index].trim()
						).length;

					// Extract WCAG criteria from improved code
					const wcagCriteria = extractWcagCriteriaFromCode(improvementResult.improvedCode);

					// Record statistics with specific provider
					statisticsManager.recordImprovement({
						type: "file",
						language,
						fileName,
						linesImproved,
						wcagCriteria,
						processingTime,
						tokensUsed: improvementResult.tokensUsed || 0,
						provider: providerType,
						model: improvementResult.model || "unknown"
					});

					progress.report({ increment: 100, message: localizationManager.getString("progress.completed") });

					// Update statistics views
					const detailedStats = statisticsManager.getDetailedStatistics();
					statsViewProvider.updateStatistics(detailedStats);
					modernStatsViewProvider.updateStatistics(detailedStats);
					if (updateStatusBarCallback) {
						updateStatusBarCallback();
					}

					if (autoApply) {
						// Automatically apply changes
						const edit = new vscode.WorkspaceEdit();
						const fullRange = new vscode.Range(
							document.positionAt(0),
							document.positionAt(code.length)
						);
						edit.replace(document.uri, fullRange, improvementResult.improvedCode);
						await vscode.workspace.applyEdit(edit);

						vscode.window.showInformationMessage(
							localizationManager.getStringWithParams("success.provider.improved.detail", {
								lines: linesImproved,
								provider: providerType === "gemini" ? "Gemini" : "Copilot",
								criteria: wcagCriteria.length
							})
						);
					} else {
						// Show diff for manual review
						const originalUri = document.uri;
						const improvedUri = vscode.Uri.parse(`untitled:${fileName}.${providerType}.improved`);

						await vscode.workspace.openTextDocument(improvedUri).then(async (_improvedDoc) => {
							const edit = new vscode.WorkspaceEdit();
							edit.insert(improvedUri, new vscode.Position(0, 0), improvementResult.improvedCode!);
							await vscode.workspace.applyEdit(edit);

							await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri,
								localizationManager.getStringWithParams("progress.provider.diff.title", { filename: fileName, provider: providerType === "gemini" ? "Gemini" : "Copilot" }));

							vscode.window.showInformationMessage(
								localizationManager.getStringWithParams("success.provider.selection.improved.detail", {
									lines: linesImproved,
									provider: providerType === "gemini" ? "Gemini" : "Copilot",
									criteria: wcagCriteria.length
								}),
								localizationManager.getString("button.apply.changes"),
								localizationManager.getString("button.show.stats")
							).then(action => {
								if (action === localizationManager.getString("button.apply.changes")) {
									const edit = new vscode.WorkspaceEdit();
									const fullRange = new vscode.Range(
										document.positionAt(0),
										document.positionAt(code.length)
									);
									edit.replace(document.uri, fullRange, improvementResult.improvedCode!);
									vscode.workspace.applyEdit(edit);
								} else if (action === localizationManager.getString("button.show.stats")) {
									vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
								}
							});
						});
					}
				} else {
					// Record error
					statisticsManager.recordError(`${providerType}_improvement_failed`, improvementResult.error || localizationManager.getString("error.unknown.occurred"));

					vscode.window.showErrorMessage(
						localizationManager.getStringWithParams("error.provider.improvement.failed", { provider: providerType === "gemini" ? "Gemini" : "Copilot", error: improvementResult.error || localizationManager.getString("error.unknown.occurred") })
					);
				}
			} finally {
				// Restore original provider if different
				if (originalProvider !== providerType) {
					try {
						await aiProviderManager.setProvider(originalProvider);
					} catch (error) {
						logger.warn("Failed to restore original provider:", error);
					}
				}
			}
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : localizationManager.getString("error.unknown.occurred");
		statisticsManager.recordError(`${providerType}_improvement_exception`, errorMessage);

		vscode.window.showErrorMessage(localizationManager.getStringWithParams("error.provider.improvement.exception", { provider: providerType === "gemini" ? "Gemini" : "Copilot", error: errorMessage }));
		logger.error(`${providerType} file improvement error:`, error);
	}
}

export async function improveSelectedCodeWithProvider(providerType: "gemini" | "vscode-copilot"): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage(localizationManager.getString("error.no.active.editor"));
		return;
	}

	const selection = editor.selection;
	if (selection.isEmpty) {
		vscode.window.showErrorMessage(localizationManager.getString("error.no.selection"));
		return;
	}

	const document = editor.document;
	const fileName = document.fileName;
	const language = document.languageId;
	const selectedCode = document.getText(selection);
	const fullCode = document.getText();

	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: localizationManager.getStringWithParams("progress.provider.improving.selection", { provider: providerType === "gemini" ? "Gemini" : "Copilot" }),
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();

			progress.report({ increment: 0, message: localizationManager.getString("progress.switching.provider") });

			// Temporarily switch to requested provider
			const originalProvider = aiProviderManager.getCurrentProviderName();

			try {
				await aiProviderManager.setProvider(providerType);
				const provider = await aiProviderManager.getCurrentProviderInstance();

				progress.report({ increment: 20, message: "Analyzing selected code..." });

				const config = vscode.workspace.getConfiguration("wcagEnhancer");
				const wcagLevel = config.get("wcagLevel") as "A" | "AA" | "AAA" || "AA";
				const includeComments = config.get("includeComments") !== false;
				const autoApply = config.get("autoApply") || false;

				progress.report({ increment: 40, message: localizationManager.getString("progress.applying.rules") });

				const improvementResult = await provider.improveCode({
					code: fullCode,
					fileType: fileName.split(".").pop() || "unknown",
					language,
					selectedText: selectedCode,
					wcagLevel,
					includeComments,
					responseLanguage: localizationManager.getCurrentLanguage() as "en" | "tr"
				});

				const processingTime = Date.now() - startTime;

				progress.report({ increment: 80, message: localizationManager.getString("progress.preparing.results") });

				if (improvementResult.success && improvementResult.improvedCode) {
					// Count improved lines
					const originalLines = selectedCode.split("\n");
					const improvedLines = improvementResult.improvedCode.split("\n");
					const linesImproved = Math.abs(improvedLines.length - originalLines.length) +
						originalLines.filter((line, index) =>
							improvedLines[index] && line.trim() !== improvedLines[index].trim()
						).length;

					// Extract WCAG criteria
					const wcagCriteria = extractWcagCriteriaFromCode(improvementResult.improvedCode);

					// Record statistics with specific provider
					statisticsManager.recordImprovement({
						type: "selection",
						language,
						fileName,
						linesImproved,
						wcagCriteria,
						processingTime,
						tokensUsed: improvementResult.tokensUsed || 0,
						provider: providerType,
						model: improvementResult.model || "unknown"
					});

					progress.report({ increment: 100, message: localizationManager.getString("progress.completed") });

					// Update statistics views
					const detailedStats = statisticsManager.getDetailedStatistics();
					statsViewProvider.updateStatistics(detailedStats);
					modernStatsViewProvider.updateStatistics(detailedStats);
					if (updateStatusBarCallback) {
						updateStatusBarCallback();
					}

					if (autoApply) {
						// Automatically apply changes to selection
						const edit = new vscode.WorkspaceEdit();
						edit.replace(document.uri, selection, improvementResult.improvedCode);
						await vscode.workspace.applyEdit(edit);

						vscode.window.showInformationMessage(
							localizationManager.getStringWithParams("success.provider.selection.improved.detail", {
								lines: linesImproved,
								provider: providerType === "gemini" ? "Gemini" : "Copilot",
								criteria: wcagCriteria.length
							})
						);
					} else {
						// Show improvement result and ask for confirmation
						vscode.window.showInformationMessage(
							localizationManager.getStringWithParams("success.provider.selection.improved.detail", {
								lines: linesImproved,
								provider: providerType === "gemini" ? "Gemini" : "Copilot",
								criteria: wcagCriteria.length
							}),
							localizationManager.getString("button.apply.changes"),
							localizationManager.getString("button.show.preview"),
							localizationManager.getString("button.show.stats")
						).then(async action => {
							if (action === localizationManager.getString("button.apply.changes")) {
								const edit = new vscode.WorkspaceEdit();
								edit.replace(document.uri, selection, improvementResult.improvedCode!);
								await vscode.workspace.applyEdit(edit);
							} else if (action === localizationManager.getString("button.show.preview")) {
								// Create diff view for selection
								const originalUri = vscode.Uri.parse(`untitled:original-selection.${language}`);
								const improvedUri = vscode.Uri.parse(`untitled:${providerType}-selection.${language}`);

								const editOriginal = new vscode.WorkspaceEdit();
								const editImproved = new vscode.WorkspaceEdit();

								editOriginal.insert(originalUri, new vscode.Position(0, 0), selectedCode);
								editImproved.insert(improvedUri, new vscode.Position(0, 0), improvementResult.improvedCode!);

								await vscode.workspace.applyEdit(editOriginal);
								await vscode.workspace.applyEdit(editImproved);

								await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri,
									localizationManager.getStringWithParams("progress.provider.selection.diff.title", { provider: providerType === "gemini" ? "Gemini" : "Copilot" }));
							} else if (action === localizationManager.getString("button.show.stats")) {
								vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
							}
						});
					}
				} else {
					// Record error
					statisticsManager.recordError(`${providerType}_selection_improvement_failed`, improvementResult.error || localizationManager.getString("error.unknown.occurred"));

					vscode.window.showErrorMessage(
						localizationManager.getStringWithParams("error.provider.improvement.failed", { provider: providerType === "gemini" ? "Gemini" : "Copilot", error: improvementResult.error || localizationManager.getString("error.unknown.occurred") })
					);
				}
			} finally {
				// Restore original provider if different
				if (originalProvider !== providerType) {
					try {
						await aiProviderManager.setProvider(originalProvider);
					} catch (error) {
						logger.warn("Failed to restore original provider:", error);
					}
				}
			}
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : localizationManager.getString("error.unknown.occurred");
		statisticsManager.recordError(`${providerType}_selection_improvement_exception`, errorMessage);

		vscode.window.showErrorMessage(localizationManager.getStringWithParams("error.provider.improvement.exception", { provider: providerType === "gemini" ? "Gemini" : "Copilot", error: errorMessage }));
		logger.error(`${providerType} selection improvement error:`, error);
	}
}

export async function improveCurrentSelectedWithProvider(providerType: "gemini" | "vscode-copilot"): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage(localizationManager.getString("error.no.active.editor"));
		return;
	}

	// Smart detection: if there's a selection, improve selection; otherwise improve file
	const selection = editor.selection;

	if (selection.isEmpty) {
		await improveCurrentFileWithProvider(providerType);
	} else {
		await improveSelectedCodeWithProvider(providerType);
	}
}

function extractWcagCriteriaFromCode(code: string): string[] {
	const criteria: string[] = [];

	// WCAG kriterlerini regex ile tespit et
	const wcagPattern = /(?:WCAG|1\.\d+\.\d+|2\.\d+\.\d+|3\.\d+\.\d+|4\.\d+\.\d+)/gi;
	const matches = code.match(wcagPattern);

	if (matches) {
		criteria.push(...matches.map(match => match.toUpperCase()));
	}

	// Erişilebilirlik özelliklerini tespit et
	const accessibilityFeatures = [
		"aria-label", "aria-describedby", "aria-labelledby", "aria-hidden",
		"aria-expanded", "aria-controls", "aria-current", "aria-live",
		"alt", "title", "role", "tabindex", "focus", "keyboard",
		"contrast", "color", "semantic", "heading", "landmark",
		"skip-link", "screen-reader", "accessible", "a11y"
	];

	accessibilityFeatures.forEach(feature => {
		if (code.toLowerCase().includes(feature)) {
			criteria.push(feature.toUpperCase());
		}
	});

	// HTML semantic elements
	const semanticElements = [
		"<header>", "<nav>", "<main>", "<section>", "<article>",
		"<aside>", "<footer>", "<h1>", "<h2>", "<h3>", "<h4>", "<h5>", "<h6>",
		"<figure>", "<figcaption>", "<time>", "<address>"
	];

	semanticElements.forEach(element => {
		if (code.toLowerCase().includes(element)) {
			criteria.push("SEMANTIC_HTML");
		}
	});

	return [...new Set(criteria)]; // Remove duplicates
}