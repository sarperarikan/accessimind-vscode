"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeProviderCommands = initializeProviderCommands;
exports.improveCurrentFileWithProvider = improveCurrentFileWithProvider;
exports.improveSelectedCodeWithProvider = improveSelectedCodeWithProvider;
exports.improveCurrentSelectedWithProvider = improveCurrentSelectedWithProvider;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./utils/logger");
// Shared dependencies
let aiProviderManager;
let statisticsManager;
let localizationManager;
let statsViewProvider;
let modernStatsViewProvider;
let updateStatusBarCallback = null;
function initializeProviderCommands(aiProvider, statsManager, localization, statsProvider, modernStatsProvider, statusBarCallback) {
    aiProviderManager = aiProvider;
    statisticsManager = statsManager;
    // localizationManager = localization; // Future use
    statsViewProvider = statsProvider;
    modernStatsViewProvider = modernStatsProvider;
    updateStatusBarCallback = statusBarCallback;
}
async function improveCurrentFileWithProvider(providerType) {
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
            title: `🔄 ${providerType === "gemini" ? "Gemini" : "Copilot"} ile WCAG iyileştirmesi...`,
            cancellable: false
        }, async (progress) => {
            const startTime = Date.now();
            progress.report({ increment: 0, message: "AI sağlayıcısı değiştiriliyor..." });
            // Temporarily switch to requested provider
            const originalProvider = aiProviderManager.getCurrentProviderName();
            try {
                await aiProviderManager.setProvider(providerType);
                const provider = await aiProviderManager.getCurrentProviderInstance();
                progress.report({ increment: 20, message: "Analyzing code..." });
                const config = vscode.workspace.getConfiguration("wcagEnhancer");
                const wcagLevel = config.get("wcagLevel") || "AA";
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
                        originalLines.filter((line, index) => improvedLines[index] && line.trim() !== improvedLines[index].trim()).length;
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
                        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(code.length));
                        edit.replace(document.uri, fullRange, improvementResult.improvedCode);
                        await vscode.workspace.applyEdit(edit);
                        vscode.window.showInformationMessage(`✅ ${linesImproved} satır ${providerType === "gemini" ? "Gemini" : "Copilot"} ile iyileştirildi! (${wcagCriteria.length} WCAG kriteri)`);
                    }
                    else {
                        // Show diff for manual review
                        const originalUri = document.uri;
                        const improvedUri = vscode.Uri.parse(`untitled:${fileName}.${providerType}.improved`);
                        await vscode.workspace.openTextDocument(improvedUri).then(async (_improvedDoc) => {
                            const edit = new vscode.WorkspaceEdit();
                            edit.insert(improvedUri, new vscode.Position(0, 0), improvementResult.improvedCode);
                            await vscode.workspace.applyEdit(edit);
                            await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri, `${fileName} - ${providerType === "gemini" ? "Gemini" : "Copilot"} WCAG İyileştirmesi`);
                            vscode.window.showInformationMessage(`✅ ${linesImproved} satır ${providerType === "gemini" ? "Gemini" : "Copilot"} ile iyileştirildi! (${wcagCriteria.length} WCAG kriteri)`, "Değişiklikleri Uygula", "İstatistikleri Görüntüle").then(action => {
                                if (action === "Değişiklikleri Uygula") {
                                    const edit = new vscode.WorkspaceEdit();
                                    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(code.length));
                                    edit.replace(document.uri, fullRange, improvementResult.improvedCode);
                                    vscode.workspace.applyEdit(edit);
                                }
                                else if (action === "İstatistikleri Görüntüle") {
                                    vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
                                }
                            });
                        });
                    }
                }
                else {
                    // Record error
                    statisticsManager.recordError(`${providerType}_improvement_failed`, improvementResult.error || "Bilinmeyen hata");
                    vscode.window.showErrorMessage(`❌ ${providerType === "gemini" ? "Gemini" : "Copilot"} iyileştirmesi başarısız: ${improvementResult.error || "Bilinmeyen hata"}`);
                }
            }
            finally {
                // Restore original provider if different
                if (originalProvider !== providerType) {
                    try {
                        await aiProviderManager.setProvider(originalProvider);
                    }
                    catch (error) {
                        logger_1.logger.warn("Orijinal sağlayıcı geri yüklenemedi:", error);
                    }
                }
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
        statisticsManager.recordError(`${providerType}_improvement_exception`, errorMessage);
        vscode.window.showErrorMessage(`❌ ${providerType === "gemini" ? "Gemini" : "Copilot"} iyileştirme hatası: ${errorMessage}`);
        logger_1.logger.error(`${providerType} dosya iyileştirme hatası:`, error);
    }
}
async function improveSelectedCodeWithProvider(providerType) {
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
            title: `🔄 ${providerType === "gemini" ? "Gemini" : "Copilot"} ile seçili kod iyileştiriliyor...`,
            cancellable: false
        }, async (progress) => {
            const startTime = Date.now();
            progress.report({ increment: 0, message: "AI sağlayıcısı değiştiriliyor..." });
            // Temporarily switch to requested provider
            const originalProvider = aiProviderManager.getCurrentProviderName();
            try {
                await aiProviderManager.setProvider(providerType);
                const provider = await aiProviderManager.getCurrentProviderInstance();
                progress.report({ increment: 20, message: "Analyzing selected code..." });
                const config = vscode.workspace.getConfiguration("wcagEnhancer");
                const wcagLevel = config.get("wcagLevel") || "AA";
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
                        originalLines.filter((line, index) => improvedLines[index] && line.trim() !== improvedLines[index].trim()).length;
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
                        vscode.window.showInformationMessage(`✅ Seçili ${linesImproved} satır ${providerType === "gemini" ? "Gemini" : "Copilot"} ile iyileştirildi! (${wcagCriteria.length} WCAG kriteri)`);
                    }
                    else {
                        // Show improvement result and ask for confirmation
                        vscode.window.showInformationMessage(`✅ Seçili kod ${providerType === "gemini" ? "Gemini" : "Copilot"} ile iyileştirildi! ${linesImproved} satır, ${wcagCriteria.length} WCAG kriteri`, "Değişiklikleri Uygula", "Önizleme Göster", "İstatistikleri Görüntüle").then(async (action) => {
                            if (action === "Değişiklikleri Uygula") {
                                const edit = new vscode.WorkspaceEdit();
                                edit.replace(document.uri, selection, improvementResult.improvedCode);
                                await vscode.workspace.applyEdit(edit);
                            }
                            else if (action === "Önizleme Göster") {
                                // Create diff view for selection
                                const originalUri = vscode.Uri.parse(`untitled:original-selection.${language}`);
                                const improvedUri = vscode.Uri.parse(`untitled:${providerType}-selection.${language}`);
                                const editOriginal = new vscode.WorkspaceEdit();
                                const editImproved = new vscode.WorkspaceEdit();
                                editOriginal.insert(originalUri, new vscode.Position(0, 0), selectedCode);
                                editImproved.insert(improvedUri, new vscode.Position(0, 0), improvementResult.improvedCode);
                                await vscode.workspace.applyEdit(editOriginal);
                                await vscode.workspace.applyEdit(editImproved);
                                await vscode.commands.executeCommand("vscode.diff", originalUri, improvedUri, `${providerType === "gemini" ? "Gemini" : "Copilot"} - Seçili Kod WCAG İyileştirmesi`);
                            }
                            else if (action === "İstatistikleri Görüntüle") {
                                vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
                            }
                        });
                    }
                }
                else {
                    // Record error
                    statisticsManager.recordError(`${providerType}_selection_improvement_failed`, improvementResult.error || "Bilinmeyen hata");
                    vscode.window.showErrorMessage(`❌ ${providerType === "gemini" ? "Gemini" : "Copilot"} seçili kod iyileştirmesi başarısız: ${improvementResult.error || "Bilinmeyen hata"}`);
                }
            }
            finally {
                // Restore original provider if different
                if (originalProvider !== providerType) {
                    try {
                        await aiProviderManager.setProvider(originalProvider);
                    }
                    catch (error) {
                        logger_1.logger.warn("Orijinal sağlayıcı geri yüklenemedi:", error);
                    }
                }
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
        statisticsManager.recordError(`${providerType}_selection_improvement_exception`, errorMessage);
        vscode.window.showErrorMessage(`❌ ${providerType === "gemini" ? "Gemini" : "Copilot"} seçili kod iyileştirme hatası: ${errorMessage}`);
        logger_1.logger.error(`${providerType} seçili kod iyileştirme hatası:`, error);
    }
}
async function improveCurrentSelectedWithProvider(providerType) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("❌ Aktif bir dosya bulunamadı");
        return;
    }
    // Smart detection: if there's a selection, improve selection; otherwise improve file
    const selection = editor.selection;
    if (selection.isEmpty) {
        await improveCurrentFileWithProvider(providerType);
    }
    else {
        await improveSelectedCodeWithProvider(providerType);
    }
}
function extractWcagCriteriaFromCode(code) {
    const criteria = [];
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
//# sourceMappingURL=providerCommands.js.map