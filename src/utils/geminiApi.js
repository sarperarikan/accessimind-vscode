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
exports.GeminiAPI = void 0;
const vscode = __importStar(require("vscode"));
const settingsManager_1 = require("./settingsManager");
const logger_1 = require("./logger");
class GeminiAPI {
    constructor() {
        this.apiKey = "";
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
        this.loadApiKey();
    }
    static getInstance() {
        if (!GeminiAPI.instance) {
            GeminiAPI.instance = new GeminiAPI();
        }
        return GeminiAPI.instance;
    }
    loadApiKey() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const config = vscode.workspace.getConfiguration("aiAccessibility");
                this.apiKey = config.get("apiKey") || "";
            }
            catch (error) {
                logger_1.logger.error("API key yüklenirken hata:", error);
            }
        });
    }
    setApiKey(apiKey) {
        return __awaiter(this, void 0, void 0, function* () {
            this.apiKey = apiKey;
            yield settingsManager_1.SettingsManager.getInstance().updateApiKey(apiKey);
        });
    }
    improveCode(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                if (!this.apiKey) {
                    return {
                        success: false,
                        error: "Gemini API anahtarı bulunamadı. Lütfen ayarlardan API anahtarınızı girin."
                    };
                }
                const model = request.model || (yield this.getDefaultModel());
                const wcagLevel = request.wcagLevel || "AA";
                const includeComments = request.includeComments !== false;
                const prompt = this.buildWCAGPrompt(request, wcagLevel, includeComments);
                const response = yield this.makeApiCall(model, prompt, request.mode);
                const responseTime = Date.now() - startTime;
                // İstatistikleri güncelle
                yield this.updateStatistics(response, responseTime, model, request.mode, wcagLevel);
                return {
                    success: response.success,
                    content: response.content,
                    error: response.error,
                    tokensUsed: response.tokensUsed,
                    responseTime,
                    model
                };
            }
            catch (error) {
                logger_1.logger.error("Kod iyileştirme hatası:", error);
                return {
                    success: false,
                    error: `Kod iyileştirme sırasında hata oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`
                };
            }
        });
    }
    getDefaultModel() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const config = vscode.workspace.getConfiguration("aiAccessibility");
                return config.get("model") || "gemini-2.0-flash";
            }
            catch (_a) {
                return "gemini-2.0-flash";
            }
        });
    }
    buildWCAGPrompt(request, wcagLevel, includeComments) {
        const { code, fileType, language, selectedText, mode } = request;
        let prompt = `Sen bir WCAG 2.2 erişilebilirlik uzmanısın. ${wcagLevel} seviyesinde erişilebilirlik iyileştirmeleri yap.

Dosya Türü: ${fileType}
Dil: ${language}
WCAG Seviyesi: ${wcagLevel}

${mode === "ask" ? "Sadece soruyu yanıtla ve öneriler ver." : ""}
${mode === "agent" ? "Kodu analiz et ve WCAG iyileştirme önerileri sun." : ""}
${mode === "edit" ? "Kodu WCAG uyumlu hale getir ve iyileştirilmiş versiyonu döndür." : ""}

${selectedText ? `Seçili Kod:\n\`\`\`${language}\n${selectedText}\n\`\`\`` : ""}

Mevcut Kod:
\`\`\`${language}
${code}
\`\`\`

${includeComments ? "Lütfen yapılan değişiklikleri açıklayan yorumlar ekle." : ""}

Yanıt formatı:
${mode === "edit" ? "- İyileştirilmiş kodu döndür\n- Her değişikliği açıkla\n- WCAG kriterlerini belirt" : "- WCAG analizi yap\n- İyileştirme önerileri sun\n- Örnek kodlar ver"}

WCAG 2.2 kriterlerine odaklan:
- Görsel (1.x): Kontrast, metin alternatifi, renk kullanımı
- İşlevsel (2.x): Klavye erişimi, navigasyon, zaman sınırları
- Anlaşılabilir (3.x): Okunabilirlik, tahmin edilebilirlik, hata tanımlama
- Sağlam (4.x): Uyumluluk, ARIA kullanımı, semantik HTML

Yanıtını Türkçe olarak ver.`;
        return prompt;
    }
    makeApiCall(model, prompt, mode) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const maxTokens = yield this.getMaxTokens();
                const temperature = yield this.getTemperature();
                const requestBody = {
                    contents: [{
                            parts: [{
                                    text: prompt
                                }]
                        }],
                    generationConfig: {
                        maxOutputTokens: maxTokens,
                        temperature: temperature,
                        topP: 0.8,
                        topK: 40
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                };
                const response = yield fetch(`${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!response.ok) {
                    const errorData = yield response.json().catch(() => ({}));
                    throw new Error(`API Hatası: ${response.status} - ${((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) || response.statusText}`);
                }
                const data = yield response.json();
                if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                    throw new Error("Geçersiz API yanıtı");
                }
                const content = data.candidates[0].content.parts[0].text;
                const tokensUsed = ((_b = data.usageMetadata) === null || _b === void 0 ? void 0 : _b.totalTokenCount) || 0;
                return {
                    success: true,
                    content,
                    tokensUsed
                };
            }
            catch (error) {
                logger_1.logger.error("API çağrısı hatası:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "API çağrısı başarısız"
                };
            }
        });
    }
    getMaxTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const config = vscode.workspace.getConfiguration("aiAccessibility");
                return config.get("maxTokens") || 4096;
            }
            catch (_a) {
                return 4096;
            }
        });
    }
    getTemperature() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const config = vscode.workspace.getConfiguration("aiAccessibility");
                return config.get("temperature") || 0.7;
            }
            catch (_a) {
                return 0.7;
            }
        });
    }
    updateStatistics(response, responseTime, model, mode, wcagLevel) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // WCAG kriterlerini içerikten tespit et
                const wcagCriteria = this.extractWCAGCriteria(response.content || "");
                // İstatistik güncellemesi StatisticsTracker tarafından extension.ts'de yapılacak
                logger_1.logger.info(`API yanıtı: ${response.success ? "Başarılı" : "Başarısız"}, Süre: ${responseTime}ms, Model: ${model}`);
            }
            catch (error) {
                logger_1.logger.error("İstatistik güncelleme hatası:", error);
            }
        });
    }
    extractWCAGCriteria(content) {
        const criteria = [];
        // WCAG kriterlerini regex ile tespit et
        const wcagPattern = /(?:WCAG|1\.\d+\.\d+|2\.\d+\.\d+|3\.\d+\.\d+|4\.\d+\.\d+)/gi;
        const matches = content.match(wcagPattern);
        if (matches) {
            criteria.push(...matches.map(match => match.toUpperCase()));
        }
        // Erişilebilirlik özelliklerini tespit et
        const accessibilityFeatures = [
            "aria-label", "aria-describedby", "aria-labelledby", "aria-hidden",
            "alt", "title", "role", "tabindex", "focus", "keyboard",
            "contrast", "color", "semantic", "heading", "landmark"
        ];
        for (const feature of accessibilityFeatures) {
            if (content.toLowerCase().includes(feature)) {
                criteria.push(feature.toUpperCase());
            }
        }
        return [...new Set(criteria)]; // Tekrarları kaldır
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.makeApiCall("gemini-2.0-flash", "Merhaba", "ask");
                return response.success;
            }
            catch (_a) {
                return false;
            }
        });
    }
    getAvailableModels() {
        return [
            "gemini-2.0-flash-exp",
            "gemini-2.0-flash",
            "gemini-1.5-flash"
        ];
    }
    getModelInfo(model) {
        const modelInfo = {
            "gemini-2.0-flash-exp": {
                name: "Gemini 2.0 Flash (Hızlı)",
                description: "En hızlı yanıt süresi, temel iyileştirmeler için",
                maxTokens: 8192
            },
            "gemini-2.0-flash": {
                name: "Gemini 2.0 Flash (Standart)",
                description: "Dengeli performans ve kalite, genel kullanım için",
                maxTokens: 8192
            },
            "gemini-1.5-flash": {
                name: "Gemini 1.5 Flash",
                description: "En yüksek kalite, karmaşık iyileştirmeler için",
                maxTokens: 8192
            }
        };
        return modelInfo[model] || modelInfo["gemini-2.0-flash"];
    }
}
exports.GeminiAPI = GeminiAPI;
