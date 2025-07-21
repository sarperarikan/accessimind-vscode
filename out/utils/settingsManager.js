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
exports.SettingsManager = void 0;
const vscode = __importStar(require("vscode"));
const aiTestUtils_1 = require("./aiTestUtils");
const logger_1 = require("./logger");
class SettingsManager {
    constructor() {
        this.aiTestUtils = aiTestUtils_1.AITestUtils.getInstance();
        this.setupConfigChangeListener();
    }
    static getInstance() {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }
    setupConfigChangeListener() {
        this.configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration("wcagEnhancer.ai")) {
                this.onAISettingsChanged();
            }
        });
    }
    async onAISettingsChanged() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai");
        const language = config.get("language", "auto");
        // Get current language for messages
        const currentLanguage = this.getCurrentLanguage(language);
        if (aiConfig?.provider === "gemini") {
            const apiKey = aiConfig?.apiKey;
            if (apiKey && apiKey.trim() !== "") {
                vscode.window.showInformationMessage(this.getLocalizedMessage("AI settings updated", currentLanguage));
                // Auto test if enabled
                if (aiConfig?.autoTestOnChange) {
                    await this.aiTestUtils.testAIProvider();
                }
            }
            else {
                vscode.window.showWarningMessage(this.getLocalizedMessage("Gemini API key is missing", currentLanguage));
            }
        }
        else if (aiConfig?.provider === "vscode-copilot") {
            vscode.window.showInformationMessage(this.getLocalizedMessage("Copilot provider selected", currentLanguage));
            // Auto test if enabled
            if (aiConfig?.autoTestOnChange) {
                await this.aiTestUtils.testAIProvider();
            }
        }
    }
    async updateAIProvider(provider) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        aiConfig.provider = provider;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
    }
    async updateApiKey(apiKey) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        aiConfig.apiKey = apiKey;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
    }
    async updateSelectedModel(model) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        // Model ayarını hem ai config'e hem de aiModels config'e kaydet (tutarlılık için)
        const aiConfig = config.get("ai") || {};
        aiConfig.selectedModel = model;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
        const aiModelConfig = config.get("aiModels") || {};
        aiModelConfig.selectedModel = model;
        await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);
    }
    async updateAISetting(key, value) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        aiConfig[key] = value;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
    }
    async validateSettings() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai");
        const language = config.get("language", "auto");
        const currentLanguage = this.getCurrentLanguage(language);
        if (!aiConfig) {
            return {
                isValid: false,
                message: this.getLocalizedMessage("AI configuration is missing", currentLanguage)
            };
        }
        const provider = aiConfig.provider;
        if (!provider) {
            return {
                isValid: false,
                message: this.getLocalizedMessage("AI provider not selected", currentLanguage)
            };
        }
        if (provider === "gemini") {
            const apiKey = aiConfig.apiKey;
            if (!apiKey || apiKey.trim() === "") {
                return {
                    isValid: false,
                    message: this.getLocalizedMessage("Gemini API key is required", currentLanguage)
                };
            }
            if (!apiKey.startsWith("AIza")) {
                return {
                    isValid: false,
                    message: this.getLocalizedMessage("Invalid Gemini API key format", currentLanguage)
                };
            }
        }
        return {
            isValid: true,
            message: this.getLocalizedMessage("Settings are valid", currentLanguage)
        };
    }
    async testAIConnection() {
        try {
            const result = await this.aiTestUtils.testAIProvider();
            await this.aiTestUtils.showTestResult(result);
        }
        catch (error) {
            logger_1.logger.error("AI connection test error:", error);
            const language = vscode.workspace.getConfiguration("wcagEnhancer").get("language", "auto");
            const currentLanguage = this.getCurrentLanguage(language);
            vscode.window.showErrorMessage(this.getLocalizedMessage("AI test failed", currentLanguage));
        }
    }
    getAIConfig() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        return config.get("ai") || {};
    }
    getCurrentProvider() {
        const aiConfig = this.getAIConfig();
        return aiConfig.provider || "gemini";
    }
    getApiKey() {
        const aiConfig = this.getAIConfig();
        return aiConfig.apiKey || "";
    }
    getSelectedModel() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        const aiModelConfig = config.get("aiModels") || {};
        // Önce aiModels'dan, sonra ai config'den model almaya çalış
        return aiModelConfig.selectedModel || aiConfig.selectedModel || "gemini-2.5-flash";
    }
    /**
     * Get current language for messages
     */
    getCurrentLanguage(languageSetting) {
        if (languageSetting === "auto") {
            return "en";
        }
        return languageSetting;
    }
    /**
     * Get localized message
     */
    getLocalizedMessage(key, language) {
        const messages = {
            "AI settings updated": {
                en: "AI settings updated successfully",
                tr: "AI ayarları başarıyla güncellendi"
            },
            "Gemini API key is missing": {
                en: "Gemini API key is missing or empty",
                tr: "Gemini API anahtarı eksik veya boş"
            },
            "Copilot provider selected": {
                en: "GitHub Copilot provider selected",
                tr: "GitHub Copilot sağlayıcısı seçildi"
            },
            "AI configuration is missing": {
                en: "AI configuration is missing",
                tr: "AI yapılandırması eksik"
            },
            "AI provider not selected": {
                en: "AI provider not selected",
                tr: "AI sağlayıcısı seçilmemiş"
            },
            "Gemini API key is required": {
                en: "Gemini API key is required for this provider",
                tr: "Bu sağlayıcı için Gemini API anahtarı gerekli"
            },
            "Invalid Gemini API key format": {
                en: "Invalid Gemini API key format. Key should start with \"AIza\"",
                tr: "Geçersiz Gemini API anahtarı formatı. Anahtar \"AIza\" ile başlamalı"
            },
            "Settings are valid": {
                en: "Settings are valid",
                tr: "Ayarlar geçerli"
            },
            "AI test failed": {
                en: "AI connection test failed",
                tr: "AI bağlantı testi başarısız"
            }
        };
        return messages[key]?.[language] || messages[key]?.["en"] || key;
    }
    dispose() {
        if (this.configChangeListener) {
            this.configChangeListener.dispose();
        }
    }
}
exports.SettingsManager = SettingsManager;
//# sourceMappingURL=settingsManager.js.map