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
	// localizationManager = localization; // Future use
	statsViewProvider = statsProvider;
	modernStatsViewProvider = modernStatsProvider;
	updateStatusBarCallback = statusBarCallback;
}

export async function improveCurrentFile(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("❌ Aktif bir dosya bulunamadı");
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
			title: "🔄 WCAG iyileştirmesi yapılıyor...",
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();
			
			progress.report({ increment: 0, message: "AI sağlayıcısı hazırlanıyor..." });
			
			const provider = await aiProviderManager.getCurrentProviderInstance();
			const providerName = aiProviderManager.getCurrentProviderName();
			
			progress.report({ increment: 20, message: "Analyzing code..." });
			
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const wcagLevel = config.get("wcagLevel") as "A" | "AA" | "AAA" || "AA";
			const includeComments = config.get("includeComments") !== false;
			const autoApply = config.get("autoApply") || false;
			
			progress.report({ increment: 40, message: "WCAG kuralları uygulanıyor..." });
			
			const improvementResult = await provider.improveCode({
				code,
				fileType: fileName.split(".").pop() || "unknown",
				language,
				wcagLevel,
				includeComments
			});
			
			const processingTime = Date.now() - startTime;
			
			progress.report({ increment: 80, message: "Sonuçlar hazırlanıyor..." });
			
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
				
				// Record statistics
				statisticsManager.recordImprovement({
					type: "file",
					language,
					fileName,
					linesImproved,
					wcagCriteria,
					processingTime,
					tokensUsed: improvementResult.tokensUsed || 0,
					provider: providerName as "gemini" | "vscode-copilot",
					model: improvementResult.model || "unknown"
				});
				
				progress.report({ increment: 100, message: "Tamamlandı!" });
				
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
						`✅ ${linesImproved} satır iyileştirildi ve otomatik olarak uygulandı! (${wcagCriteria.length} WCAG kriteri)`
					);
				} else {
					// Show diff for manual review
					const originalUri = document.uri;
					const improvedUri = vscode.Uri.parse(`untitled:${fileName}.improved`);
					
					await vscode.workspace.openTextDocument(improvedUri).then(async (_improvedDoc) => {
						const edit = new vscode.WorkspaceEdit();
						edit.insert(improvedUri, new vscode.Position(0, 0), improvementResult.improvedCode!);
						await vscode.workspace.applyEdit(edit);
						
						await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri, `${fileName} - WCAG İyileştirmesi`);
						
						vscode.window.showInformationMessage(
							`✅ ${linesImproved} satır iyileştirildi! (${wcagCriteria.length} WCAG kriteri)`,
							"Değişiklikleri Uygula",
							"İstatistikleri Görüntüle"
						).then(action => {
							if (action === "Değişiklikleri Uygula") {
								const edit = new vscode.WorkspaceEdit();
								const fullRange = new vscode.Range(
									document.positionAt(0),
									document.positionAt(code.length)
								);
								edit.replace(document.uri, fullRange, improvementResult.improvedCode!);
								vscode.workspace.applyEdit(edit);
							} else if (action === "İstatistikleri Görüntüle") {
								vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
							}
						});
					});
				}
			} else {
				// Record error
				statisticsManager.recordError("improvement_failed", improvementResult.error || "Bilinmeyen hata");
				
				vscode.window.showErrorMessage(
					`❌ İyileştirme başarısız: ${improvementResult.error || "Bilinmeyen hata"}`
				);
			}
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
		statisticsManager.recordError("improvement_exception", errorMessage);
		
		vscode.window.showErrorMessage(`❌ WCAG iyileştirme hatası: ${errorMessage}`);
		logger.error("Dosya iyileştirme hatası:", error);
	}
}

export async function improveSelectedCode(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("❌ Aktif bir dosya bulunamadı");
		return;
	}

	const selection = editor.selection;
	if (selection.isEmpty) {
		vscode.window.showErrorMessage("❌ Kod seçimi bulunamadı");
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
			title: "🔄 Seçili kod iyileştiriliyor...",
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();
			
			progress.report({ increment: 0, message: "AI sağlayıcısı hazırlanıyor..." });
			
			const provider = await aiProviderManager.getCurrentProviderInstance();
			const providerName = aiProviderManager.getCurrentProviderName();
			
			progress.report({ increment: 20, message: "Analyzing selected code..." });
			
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const wcagLevel = config.get("wcagLevel") as "A" | "AA" | "AAA" || "AA";
			const includeComments = config.get("includeComments") !== false;
			const autoApply = config.get("autoApply") || false;
			
			progress.report({ increment: 40, message: "WCAG kuralları uygulanıyor..." });
			
			const improvementResult = await provider.improveCode({
				code: fullCode,
				fileType: fileName.split(".").pop() || "unknown",
				language,
				selectedText: selectedCode,
				wcagLevel,
				includeComments
			});
			
			const processingTime = Date.now() - startTime;
			
			progress.report({ increment: 80, message: "Sonuçlar hazırlanıyor..." });
			
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
				
				// Record statistics
				statisticsManager.recordImprovement({
					type: "selection",
					language,
					fileName,
					linesImproved,
					wcagCriteria,
					processingTime,
					tokensUsed: improvementResult.tokensUsed || 0,
					provider: providerName as "gemini" | "vscode-copilot",
					model: improvementResult.model || "unknown"
				});
				
				progress.report({ increment: 100, message: "Tamamlandı!" });
				
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
						`✅ Seçili ${linesImproved} satır iyileştirildi ve otomatik olarak uygulandı! (${wcagCriteria.length} WCAG kriteri)`
					);
				} else {
					// Show improvement result and ask for confirmation
					vscode.window.showInformationMessage(
						`✅ Seçili kod iyileştirildi! ${linesImproved} satır, ${wcagCriteria.length} WCAG kriteri`,
						"Değişiklikleri Uygula",
						"Önizleme Göster",
						"İstatistikleri Görüntüle"
					).then(async action => {
						if (action === "Değişiklikleri Uygula") {
							const edit = new vscode.WorkspaceEdit();
							edit.replace(document.uri, selection, improvementResult.improvedCode!);
							await vscode.workspace.applyEdit(edit);
						} else if (action === "Önizleme Göster") {
							// Create diff view for selection
							const originalUri = vscode.Uri.parse(`untitled:original-selection.${language}`);
							const improvedUri = vscode.Uri.parse(`untitled:improved-selection.${language}`);
							
							const _originalDoc = await vscode.workspace.openTextDocument(originalUri);
							const _improvedDoc = await vscode.workspace.openTextDocument(improvedUri);
							
							const editOriginal = new vscode.WorkspaceEdit();
							const editImproved = new vscode.WorkspaceEdit();
							
							editOriginal.insert(originalUri, new vscode.Position(0, 0), selectedCode);
							editImproved.insert(improvedUri, new vscode.Position(0, 0), improvementResult.improvedCode!);
							
							await vscode.workspace.applyEdit(editOriginal);
							await vscode.workspace.applyEdit(editImproved);
							
							await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri, "Seçili Kod - WCAG İyileştirmesi");
						} else if (action === "İstatistikleri Görüntüle") {
							vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
						}
					});
				}
			} else {
				// Record error
				statisticsManager.recordError("selection_improvement_failed", improvementResult.error || "Bilinmeyen hata");
				
				vscode.window.showErrorMessage(
					`❌ Seçili kod iyileştirmesi başarısız: ${improvementResult.error || "Bilinmeyen hata"}`
				);
			}
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
		statisticsManager.recordError("selection_improvement_exception", errorMessage);
		
		vscode.window.showErrorMessage(`❌ Seçili kod iyileştirme hatası: ${errorMessage}`);
		logger.error("Seçili kod iyileştirme hatası:", error);
	}
}

export async function improveCurrentSelected(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("❌ Aktif bir dosya bulunamadı");
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
