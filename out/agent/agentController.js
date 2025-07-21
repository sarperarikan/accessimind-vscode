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
exports.AgentController = void 0;
exports.agentController = agentController;
exports.activateAgentMode = activateAgentMode;
// agentController.ts
const vscode = __importStar(require("vscode"));
const agentUtils_1 = require("./agentUtils");
const validationUtils_1 = require("../utils/validationUtils");
const logger_1 = require("../utils/logger");
const geminiApi_1 = require("../utils/geminiApi");
// import { StatisticsManager } from "../utils/statisticsManager"; // Future use
class AgentController {
    constructor() { }
    async startAgentMode() {
        try {
            // Timeout koruması
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("İşlem zaman aşımına uğradı (30 saniye)")), 30000);
            });
            const geminiApi = geminiApi_1.GeminiAPI.getInstance();
            const isConnected = await geminiApi.testConnection();
            if (!isConnected) {
                const openSettings = "Ayarları Aç";
                const action = await vscode.window.showWarningMessage("Gemini API bağlantısı başarısız. Kod üretimi için ayarlardan API anahtarınızı kontrol edin.", openSettings);
                if (action === openSettings) {
                    await vscode.commands.executeCommand("wcagEnhancer.showSettings");
                }
                return;
            }
            // Kullanıcıdan talimat al
            const userPrompt = await vscode.window.showInputBox({
                prompt: "WCAG 2.2 uyumlu kod üretimi için talimatınızı girin:",
                placeHolder: "Örnek: \"Bu formu erişilebilir hale getir\" veya \"Bu butona ARIA etiketleri ekle\"",
                validateInput: validationUtils_1.validateUserInput
            });
            if (!userPrompt) {
                vscode.window.showWarningMessage("Talimat girilmedi.");
                return;
            }
            // Progress göster
            await Promise.race([
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "WCAG 2.2 Uyumlu Kod Üretiliyor...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0 });
                    // Mevcut seçili metni al
                    const editor = vscode.window.activeTextEditor;
                    const selection = editor?.selection;
                    const selectedText = editor?.document.getText(selection) || "";
                    const _fileType = editor?.document.languageId || "unknown";
                    progress.report({ increment: 50 });
                    // Erişilebilir kod üret
                    const generatedCode = await (0, agentUtils_1.generateAccessibleCode)(userPrompt, selectedText);
                    progress.report({ increment: 100 });
                    // İstatistik kaydet
                    try {
                        // Statistics recording - to be updated with new system
                    }
                    catch (error) {
                        console.error("Stats recording error:", error);
                    }
                    // Sonucu göster ve uygula
                    await this.showGeneratedCode(generatedCode, editor, selection);
                }),
                timeoutPromise
            ]);
        }
        catch (error) {
            logger_1.logger.error("Agent mode error:", error);
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
            // Hata istatistiği kaydet
            try {
                const editor = vscode.window.activeTextEditor;
                const _fileType = editor?.document.languageId || "unknown";
                // Error recording - to be updated with new system
            }
            catch (statsError) {
                console.error("Stats recording error:", statsError);
            }
            vscode.window.showErrorMessage(`Hata oluştu: ${errorMessage}`);
        }
    }
    async analyzeCurrentFile() {
        // Analyze current file implementation
        vscode.window.showInformationMessage("Agent analyze mode - coming soon!");
    }
    async improveCurrentFile() {
        // Improve current file implementation
        vscode.window.showInformationMessage("Agent improve mode - coming soon!");
    }
    async showGeneratedCode(generatedCode, editor, selection) {
        const options = ["Kodu Uygula", "Yeni Dosya Oluştur", "Kopyala", "İptal"];
        const action = await vscode.window.showInformationMessage("WCAG 2.2 uyumlu kod üretildi!", ...options);
        switch (action) {
            case "Kodu Uygula":
                if (editor && selection) {
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, generatedCode);
                    });
                    vscode.window.showInformationMessage("Kod başarıyla uygulandı!");
                }
                else {
                    // Yeni dosya oluştur
                    const document = await vscode.workspace.openTextDocument({
                        content: generatedCode,
                        language: "html"
                    });
                    await vscode.window.showTextDocument(document);
                }
                break;
            case "Yeni Dosya Oluştur":
                await this.createNewFile(generatedCode);
                break;
            case "Kopyala":
                await vscode.env.clipboard.writeText(generatedCode);
                vscode.window.showInformationMessage("Kod panoya kopyalandı!");
                break;
            default:
                break;
        }
    }
    async createNewFile(content) {
        try {
            // Dizin seçimi
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage("Çalışma alanı bulunamadı.");
                return;
            }
            const defaultUri = workspaceFolders[0].uri;
            const uri = await vscode.window.showSaveDialog({
                defaultUri: defaultUri,
                filters: {
                    "HTML Files": ["html"],
                    "All Files": ["*"]
                },
                saveLabel: "WCAG Kod Dosyası Oluştur"
            });
            if (uri) {
                const wsedit = new vscode.WorkspaceEdit();
                wsedit.createFile(uri, { overwrite: true });
                wsedit.insert(uri, new vscode.Position(0, 0), content);
                await vscode.workspace.applyEdit(wsedit);
                // Dosyayı aç
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
                vscode.window.showInformationMessage(`WCAG uyumlu kod dosyası oluşturuldu: ${uri.fsPath}`);
            }
        }
        catch (error) {
            logger_1.logger.error("Create file error:", error);
            vscode.window.showErrorMessage("Dosya oluşturma hatası!");
        }
    }
}
exports.AgentController = AgentController;
// Export function for extension.ts
async function agentController() {
    const controller = new AgentController();
    await controller.startAgentMode();
}
// Legacy function for backward compatibility
async function activateAgentMode(_context) {
    const controller = new AgentController();
    await controller.startAgentMode();
}
//# sourceMappingURL=agentController.js.map