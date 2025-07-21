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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateAgentMode = exports.agentController = exports.AgentController = void 0;
// agentController.ts
const vscode = __importStar(require("vscode"));
const agentUtils_1 = require("./agentUtils");
const validationUtils_1 = require("../utils/validationUtils");
const logger_1 = require("../utils/logger");
const geminiApi_1 = require("../utils/geminiApi");
const statisticsManager_1 = require("../utils/statisticsManager");
class AgentController {
    constructor() { }
    startAgentMode() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Timeout koruması
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("İşlem zaman aşımına uğradı (30 saniye)")), 30000);
                });
                const geminiApi = geminiApi_1.GeminiAPI.getInstance();
                const isConnected = yield geminiApi.testConnection();
                if (!isConnected) {
                    const openSettings = "Ayarları Aç";
                    const action = yield vscode.window.showWarningMessage("Gemini API bağlantısı başarısız. Kod üretimi için ayarlardan API anahtarınızı kontrol edin.", openSettings);
                    if (action === openSettings) {
                        yield vscode.commands.executeCommand("wcagEnhancer.showSettings");
                    }
                    return;
                }
                // Kullanıcıdan talimat al
                const userPrompt = yield vscode.window.showInputBox({
                    prompt: "WCAG 2.2 uyumlu kod üretimi için talimatınızı girin:",
                    placeHolder: "Örnek: \"Bu formu erişilebilir hale getir\" veya \"Bu butona ARIA etiketleri ekle\"",
                    validateInput: validationUtils_1.validateUserInput
                });
                if (!userPrompt) {
                    vscode.window.showWarningMessage("Talimat girilmedi.");
                    return;
                }
                // Progress göster
                yield Promise.race([
                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "WCAG 2.2 Uyumlu Kod Üretiliyor...",
                        cancellable: false
                    }, (progress) => __awaiter(this, void 0, void 0, function* () {
                        progress.report({ increment: 0 });
                        // Mevcut seçili metni al
                        const editor = vscode.window.activeTextEditor;
                        const selection = editor === null || editor === void 0 ? void 0 : editor.selection;
                        const selectedText = (editor === null || editor === void 0 ? void 0 : editor.document.getText(selection)) || "";
                        const fileType = (editor === null || editor === void 0 ? void 0 : editor.document.languageId) || "unknown";
                        progress.report({ increment: 50 });
                        // Erişilebilir kod üret
                        const generatedCode = yield (0, agentUtils_1.generateAccessibleCode)(userPrompt, selectedText);
                        progress.report({ increment: 100 });
                        // İstatistik kaydet
                        try {
                            statisticsManager_1.statisticsManager.getInstance().recordEnhancement("agent", true, fileType);
                        }
                        catch (error) {
                            console.error("Stats recording error:", error);
                        }
                        // Sonucu göster ve uygula
                        yield this.showGeneratedCode(generatedCode, editor, selection);
                    })),
                    timeoutPromise
                ]);
            }
            catch (error) {
                logger_1.logger.error("Agent mode error:", error);
                const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
                // Hata istatistiği kaydet
                try {
                    const editor = vscode.window.activeTextEditor;
                    const fileType = (editor === null || editor === void 0 ? void 0 : editor.document.languageId) || "unknown";
                    statisticsManager_1.statisticsManager.getInstance().recordEnhancement("agent", false, fileType, errorMessage);
                }
                catch (statsError) {
                    console.error("Stats recording error:", statsError);
                }
                vscode.window.showErrorMessage(`Hata oluştu: ${errorMessage}`);
            }
        });
    }
    analyzeCurrentFile() {
        return __awaiter(this, void 0, void 0, function* () {
            // Analyze current file implementation
            vscode.window.showInformationMessage("Agent analyze mode - coming soon!");
        });
    }
    improveCurrentFile() {
        return __awaiter(this, void 0, void 0, function* () {
            // Improve current file implementation
            vscode.window.showInformationMessage("Agent improve mode - coming soon!");
        });
    }
    showGeneratedCode(generatedCode, editor, selection) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = ["Kodu Uygula", "Yeni Dosya Oluştur", "Kopyala", "İptal"];
            const action = yield vscode.window.showInformationMessage("WCAG 2.2 uyumlu kod üretildi!", ...options);
            switch (action) {
                case "Kodu Uygula":
                    if (editor && selection) {
                        yield editor.edit(editBuilder => {
                            editBuilder.replace(selection, generatedCode);
                        });
                        vscode.window.showInformationMessage("Kod başarıyla uygulandı!");
                    }
                    else {
                        // Yeni dosya oluştur
                        const document = yield vscode.workspace.openTextDocument({
                            content: generatedCode,
                            language: "html"
                        });
                        yield vscode.window.showTextDocument(document);
                    }
                    break;
                case "Yeni Dosya Oluştur":
                    yield this.createNewFile(generatedCode);
                    break;
                case "Kopyala":
                    yield vscode.env.clipboard.writeText(generatedCode);
                    vscode.window.showInformationMessage("Kod panoya kopyalandı!");
                    break;
                default:
                    break;
            }
        });
    }
    createNewFile(content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Dizin seçimi
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    vscode.window.showErrorMessage("Çalışma alanı bulunamadı.");
                    return;
                }
                const defaultUri = workspaceFolders[0].uri;
                const uri = yield vscode.window.showSaveDialog({
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
                    yield vscode.workspace.applyEdit(wsedit);
                    // Dosyayı aç
                    const document = yield vscode.workspace.openTextDocument(uri);
                    yield vscode.window.showTextDocument(document);
                    vscode.window.showInformationMessage(`WCAG uyumlu kod dosyası oluşturuldu: ${uri.fsPath}`);
                }
            }
            catch (error) {
                logger_1.logger.error("Create file error:", error);
                vscode.window.showErrorMessage("Dosya oluşturma hatası!");
            }
        });
    }
}
exports.AgentController = AgentController;
// Export function for extension.ts
function agentController() {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = new AgentController();
        yield controller.startAgentMode();
    });
}
exports.agentController = agentController;
// Legacy function for backward compatibility
function activateAgentMode(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = new AgentController();
        yield controller.startAgentMode();
    });
}
exports.activateAgentMode = activateAgentMode;
