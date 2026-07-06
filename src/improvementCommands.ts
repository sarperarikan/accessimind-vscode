import * as vscode from "vscode";
import { AIProviderManager } from "./utils/aiProvider";
import { StatisticsManager } from "./utils/statisticsManager";
import { LocalizationManager } from "./utils/localizationManager";
import { StatsViewProvider } from "./views/statsViewProvider";
import { ModernStatsViewProvider } from "./views/modernStatsViewProvider";
import { normalizeGeneratedCode } from "./utils/codeGenerationUtils";
import { getDisabilityFocusInstruction } from "./utils/disabilityFocus";
import { logger } from "./utils/logger";
import { getRuntimeSettings } from "./utils/runtimeSettings";
import { evaluateFixConfidence } from "./innovation/fixConfidence";

// Shared dependencies
let aiProviderManager: AIProviderManager;
let statisticsManager: StatisticsManager;
let localizationManager: LocalizationManager;
let statsViewProvider: StatsViewProvider;
let modernStatsViewProvider: ModernStatsViewProvider;
let updateStatusBarCallback: (() => void) | null = null;

export function initializeImprovementCommands(
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

interface ImprovementResultData {
	improvedCode: string;
	linesImproved: number;
	wcagCriteria: string[];
	providerName: string;
	modelName: string;
	originalCode: string; // To calculate diffs if needed
}

/**
 * Shared function to process code improvement via AI
 */
async function processImprovement(
	document: vscode.TextDocument,
	selection?: vscode.Selection
): Promise<ImprovementResultData | null> {
	const fileName = document.fileName;
	const language = document.languageId;
	const fullCode = document.getText();
	const selectedCode = selection ? document.getText(selection) : fullCode;
	const isSelection = !!selection;

	if (!selectedCode.trim()) {
		vscode.window.showErrorMessage(localizationManager.getString("error.empty.code"));
		return null;
	}

	let result: ImprovementResultData | null = null;

	try {
		const currentLanguage = localizationManager.getCurrentLanguage() as "en" | "tr";
		const typeStr = isSelection ? localizationManager.getString("progress.type.selection") : localizationManager.getString("progress.type.file");

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: localizationManager.getStringWithParams("progress.improving.with", {
				type: typeStr,
				provider: aiProviderManager.getCurrentProviderName(),
				model: aiProviderManager.getCurrentModelName()
			}),
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();

			progress.report({ increment: 0, message: localizationManager.getString("progress.preparing.provider") });

			const provider = await aiProviderManager.getCurrentProviderInstance();
			const providerName = aiProviderManager.getCurrentProviderName();

			progress.report({ increment: 20, message: isSelection ? localizationManager.getString("progress.improving.selection") : localizationManager.getString("progress.improving.file") });

			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const wcagLevel = config.get("wcagLevel") as "A" | "AA" | "AAA" || "AA";
			const includeComments = config.get("includeComments") !== false;
			const runtimeSettings = getRuntimeSettings();
			const fullCodeForPrompt = [
				getDisabilityFocusInstruction(
					runtimeSettings.disabilityFocusGroups as Array<"screenReader" | "lowVision" | "hearing" | "motor" | "cognitive">,
					currentLanguage
				),
				fullCode,
			].join("\n\n");

			progress.report({ increment: 40, message: localizationManager.getString("progress.applying.rules") });

			const improvementResult = await provider.improveCode({
				code: fullCodeForPrompt,
				fileType: fileName.split(".").pop() || "unknown",
				language,
				selectedText: isSelection ? selectedCode : undefined,
				wcagLevel,
				includeComments,
				responseLanguage: currentLanguage
			});

			const processingTime = Date.now() - startTime;

			progress.report({ increment: 80, message: localizationManager.getString("progress.preparing.results") });

			if (improvementResult.success && improvementResult.improvedCode) {
				const normalized = normalizeGeneratedCode({
					originalCode: isSelection ? selectedCode : fullCode,
					generatedContent: improvementResult.improvedCode,
					language,
					mode: isSelection ? "selection" : "file"
				});
				improvementResult.improvedCode = normalized.code;
				const confidence = evaluateFixConfidence(isSelection ? selectedCode : fullCode, improvementResult.improvedCode);
				if (confidence.pattern && vscode.workspace.workspaceFolders?.length) {
					await vscode.commands.executeCommand("setContext", "wcagEnhancer.hasLastFixPattern", true);
				}
				if (normalized.warnings.length > 0) {
					void vscode.window.showWarningMessage(normalized.warnings.join(" "));
				}

				// Count improved lines
				const originalLines = selectedCode.split("\n");
				const improvedLines = improvementResult.improvedCode.split("\n");
				const linesImproved = Math.abs(improvedLines.length - originalLines.length) +
					originalLines.filter((line, index) =>
						improvedLines[index] && line.trim() !== improvedLines[index].trim()
					).length;

				// Extract WCAG criteria from improved code
				const wcagCriteria = extractWcagCriteriaFromCode(improvementResult.improvedCode);

				// Record statistics
				statisticsManager.recordImprovement({
					type: isSelection ? "selection" : "file",
					language,
					fileName,
					linesImproved,
					wcagCriteria,
					processingTime,
					tokensUsed: improvementResult.tokensUsed || 0,
					provider: providerName as "gemini" | "vscode-copilot" | "ollama",
					model: improvementResult.model || "unknown"
				});

				progress.report({ increment: 100, message: localizationManager.getString("progress.complete") });

				// Update statistics views
				const detailedStats = statisticsManager.getDetailedStatistics();
				statsViewProvider.updateStatistics(detailedStats);
				modernStatsViewProvider.updateStatistics(detailedStats);
				if (updateStatusBarCallback) {
					updateStatusBarCallback();
				}

				result = {
					improvedCode: improvementResult.improvedCode,
					linesImproved,
					wcagCriteria,
					providerName: providerName,
					modelName: improvementResult.model || "unknown",
					originalCode: selectedCode
				};
			} else {
				// Record error
				const errorMsg = improvementResult.error || localizationManager.getString("error.unknown");
				statisticsManager.recordError(
					isSelection ? "selection_improvement_failed" : "improvement_failed",
					errorMsg
				);

				vscode.window.showErrorMessage(
					localizationManager.getStringWithParams("error.improvement.failed.detail", {
						error: errorMsg
					})
				);
			}
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : localizationManager.getString("error.unknown");
		statisticsManager.recordError("improvement_exception", errorMessage);

		vscode.window.showErrorMessage(
			localizationManager.getStringWithParams("error.improvement.exception.detail", {
				error: errorMessage
			})
		);
		logger.error("Improvement error:", error);
	}

	return result;
}

export async function improveCurrentFile(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage(localizationManager.getString("error.no.active.editor"));
		return;
	}

	const result = await processImprovement(editor.document);
	if (!result) return;

	const config = vscode.workspace.getConfiguration("wcagEnhancer");
	const autoApply = config.get("autoApply") || false;
	const document = editor.document;
	const fullRange = new vscode.Range(
		document.positionAt(0),
		document.positionAt(document.getText().length)
	);

	if (autoApply) {
		const edit = new vscode.WorkspaceEdit();
		edit.replace(document.uri, fullRange, result.improvedCode);
		await vscode.workspace.applyEdit(edit);

		vscode.window.showInformationMessage(
			localizationManager.getStringWithParams("success.improved.detail", {
				lines: result.linesImproved,
				criteria: result.wcagCriteria.length,
				provider: result.providerName,
				model: result.modelName
			}),
			localizationManager.getString("button.apply.changes"),
			localizationManager.getString("button.preview.changes"),
			localizationManager.getString("button.show.stats")
		).then(async action => {
			if (action === localizationManager.getString("button.apply.changes")) {
				const edit = new vscode.WorkspaceEdit();
				edit.replace(document.uri, fullRange, result.improvedCode);
				vscode.workspace.applyEdit(edit);
			} else if (action === localizationManager.getString("button.preview.changes")) {
				// Show diff
				const improvedUri = vscode.Uri.parse(`untitled:${document.fileName}.improved`);
				await vscode.workspace.openTextDocument(improvedUri).then(async () => {
					const edit = new vscode.WorkspaceEdit();
					edit.insert(improvedUri, new vscode.Position(0, 0), result.improvedCode);
					await vscode.workspace.applyEdit(edit);
					await vscode.commands.executeCommand("vscode.diff", document.uri, improvedUri,
						localizationManager.getStringWithParams("view.diff.title.file", { filename: document.fileName }));
				});
			} else if (action === localizationManager.getString("button.show.stats")) {
				vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
			}
		});
	}
}

export async function improveSelectedCode(): Promise<void> {
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

	const result = await processImprovement(editor.document, selection);
	if (!result) return;

	const config = vscode.workspace.getConfiguration("wcagEnhancer");
	const autoApply = config.get("autoApply") || false;
	const document = editor.document;

	if (autoApply) {
		const edit = new vscode.WorkspaceEdit();
		edit.replace(document.uri, selection, result.improvedCode);
		await vscode.workspace.applyEdit(edit);

		vscode.window.showInformationMessage(
			localizationManager.getStringWithParams("success.selection.improved.detail", {
				lines: result.linesImproved,
				criteria: result.wcagCriteria.length,
				provider: result.providerName,
				model: result.modelName
			}),
			localizationManager.getString("button.apply.changes"),
			localizationManager.getString("button.preview.changes"),
			localizationManager.getString("button.show.stats")
		).then(async action => {
			if (action === localizationManager.getString("button.apply.changes")) {
				const edit = new vscode.WorkspaceEdit();
				edit.replace(document.uri, selection, result.improvedCode);
				await vscode.workspace.applyEdit(edit);
			} else if (action === localizationManager.getString("button.preview.changes")) {
				// Create diff view for selection
				const language = document.languageId;
				const originalUri = vscode.Uri.parse(`untitled:original-selection.${language}`);
				const improvedUri = vscode.Uri.parse(`untitled:improved-selection.${language}`);

				await vscode.workspace.openTextDocument(originalUri);
				await vscode.workspace.openTextDocument(improvedUri);

				const editOriginal = new vscode.WorkspaceEdit();
				const editImproved = new vscode.WorkspaceEdit();

				editOriginal.insert(originalUri, new vscode.Position(0, 0), result.originalCode);
				editImproved.insert(improvedUri, new vscode.Position(0, 0), result.improvedCode);

				await vscode.workspace.applyEdit(editOriginal);
				await vscode.workspace.applyEdit(editImproved);

				await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri,
					localizationManager.getString("view.diff.title.selection"));
			} else if (action === localizationManager.getString("button.show.stats")) {
				vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
			}
		});
	}
}

// New command: Preview Improvement
export async function previewImprovement(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage(localizationManager.getString("error.no.active.editor"));
		return;
	}

	const selection = !editor.selection.isEmpty ? editor.selection : undefined;
	const result = await processImprovement(editor.document, selection);

	if (!result) return;

	const document = editor.document;
	const language = document.languageId;

	if (selection) {
		// Preview for selection
		const originalUri = vscode.Uri.parse(`untitled:original-selection.${language}`);
		const improvedUri = vscode.Uri.parse(`untitled:improved-selection.${language}`);

		await vscode.workspace.openTextDocument(originalUri);
		await vscode.workspace.openTextDocument(improvedUri);

		const editOriginal = new vscode.WorkspaceEdit();
		const editImproved = new vscode.WorkspaceEdit();

		editOriginal.insert(originalUri, new vscode.Position(0, 0), result.originalCode);
		editImproved.insert(improvedUri, new vscode.Position(0, 0), result.improvedCode);

		await vscode.workspace.applyEdit(editOriginal);
		await vscode.workspace.applyEdit(editImproved);

		await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri,
			localizationManager.getString("view.diff.title.preview.selection"));
	} else {
		// Preview for full file
		const improvedUri = vscode.Uri.parse(`untitled:${document.fileName}.improved`);

		await vscode.workspace.openTextDocument(improvedUri).then(async () => {
			const edit = new vscode.WorkspaceEdit();
			edit.insert(improvedUri, new vscode.Position(0, 0), result.improvedCode);
			await vscode.workspace.applyEdit(edit);
			await vscode.commands.executeCommand("vscode.diff", document.uri, improvedUri,
				localizationManager.getStringWithParams("view.diff.title.preview", { filename: document.fileName }));
		});
	}
}

export async function improveCurrentSelected(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage(localizationManager.getString("error.no.active.editor"));
		return;
	}

	// Smart detection: if there's a selection, improve selection; otherwise improve file
	const selection = editor.selection;

	if (selection.isEmpty) {
		await improveCurrentFile();
	} else {
		await improveSelectedCode();
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
