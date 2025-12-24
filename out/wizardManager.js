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
exports.WizardManager = void 0;
const vscode = __importStar(require("vscode"));
const aiProvider_1 = require("./utils/aiProvider");
const logger_1 = require("./utils/logger");
const localizationManager_1 = require("./utils/localizationManager");
class WizardManager {
    constructor() {
        this.persistentSettingsManager = null;
        this.jsonManager = null;
        this.aiProviderManager = aiProvider_1.AIProviderManager.getInstance();
    }
    static getInstance() {
        if (!WizardManager.instance) {
            WizardManager.instance = new WizardManager();
        }
        return WizardManager.instance;
    }
    /**
     * Set the persistent settings manager instance
     */
    setPersistentSettingsManager(manager) {
        this.persistentSettingsManager = manager;
    }
    /**
     * Set the JSON manager instance
     */
    setJsonManager(manager) {
        this.jsonManager = manager;
    }
    async showWizard() {
        // Create and show wizard WebView
        const panel = vscode.window.createWebviewPanel("wcagWizard", "♿ AccessiMind Setup Wizard", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        // Get available models dynamically and current settings
        const availableModels = await this.getAvailableModelsForWizard();
        const currentSettings = await this.getCurrentSettings();
        panel.webview.html = this.getModernWizardHTML(availableModels);
        // Send current settings to webview after it loads
        setTimeout(() => {
            panel.webview.postMessage({
                command: "loadCurrentSettings",
                settings: currentSettings
            });
        }, 1000);
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case "setupProvider":
                    await this.setupProvider(message.provider);
                    // Provider seçildikten sonra modelleri yenile ve gönder
                    const refreshedModels = await this.getAvailableModelsForWizard();
                    panel.webview.postMessage({
                        command: "providerSetup",
                        provider: message.provider,
                        models: refreshedModels,
                        success: true
                    });
                    break;
                case "setupModel":
                    await this.setupModel(message.model);
                    panel.webview.postMessage({
                        command: "modelSetup",
                        model: message.model,
                        provider: message.provider,
                        success: true
                    });
                    break;
                case "setupApiKey": {
                    const success = await this.setupApiKey(message.apiKey);
                    panel.webview.postMessage({
                        command: "apiKeySetup",
                        success: success
                    });
                    break;
                }
                case "setupWcagLevel":
                    await this.setupWcagLevel(message.level);
                    break;
                case "setupLanguage":
                    await this.setupLanguage(message.language);
                    break;
                case "setupJiraConfig":
                    await this.setupJiraConfig(message.config);
                    panel.webview.postMessage({
                        command: "jiraConfigSetup",
                        success: true
                    });
                    break;
                case "testConnection": {
                    const testResult = await this.testAIConnection();
                    panel.webview.postMessage({
                        command: "testResult",
                        success: testResult.success,
                        message: testResult.message
                    });
                    break;
                }
                case "refreshModels": {
                    const refreshedModels = await this.refreshAvailableModels();
                    panel.webview.postMessage({
                        command: "modelsRefreshed",
                        models: refreshedModels,
                        success: true
                    });
                    break;
                }
                case "finishWizard": {
                    await this.finishWizard();
                    panel.dispose();
                    break;
                }
                case "previousStep": {
                    panel.webview.postMessage({
                        command: "navigateStep",
                        direction: "previous"
                    });
                    break;
                }
                case "nextStep": {
                    panel.webview.postMessage({
                        command: "navigateStep",
                        direction: "next"
                    });
                    break;
                }
                case "openSettings": {
                    await vscode.commands.executeCommand("workbench.action.openSettings", "wcagEnhancer");
                    break;
                }
                case "openExternal": {
                    if (message.url) {
                        await vscode.env.openExternal(vscode.Uri.parse(message.url));
                    }
                    break;
                }
            }
        });
    }
    async getAvailableModelsForWizard() {
        const { LocalizationManager: _LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
        // localization değişkeni kaldırıldı çünkü kullanılmıyor
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const _aiConfig = config.get("ai") || {};
        const _aiModelConfig = config.get("aiModels") || {};
        const models = {
            gemini: [],
            copilot: [],
            all: []
        };
        // Gemini models - dinamik olarak API'den yükle
        try {
            const geminiModels = await this.getAvailableGeminiModels();
            models.gemini = geminiModels;
        }
        catch (error) {
            logger_1.logger.warn("Gemini modelleri yüklenemedi, varsayılan modeller kullanılıyor:", error);
            models.gemini = await this.getDefaultGeminiModels();
        }
        // Copilot models - dinamik olarak API'den yükle
        try {
            // Önce GitHub Copilot durumunu kontrol et
            const copilotStatus = await this.checkCopilotStatus();
            if (copilotStatus.available) {
                await this.aiProviderManager.refreshCopilotModels();
                const copilotModels = await this.aiProviderManager.getAvailableCopilotModels();
                if (copilotModels.length > 0) {
                    models.copilot = copilotModels.map((model) => ({
                        id: model.id,
                        name: model.name,
                        description: model.description || `${model.vendor} - ${model.family}`,
                        speed: this.getModelSpeed(model.id),
                        quality: this.getModelQuality(model.id),
                        recommended: this.isRecommendedModel(model.id),
                        available: true
                    }));
                }
                else {
                    // GitHub Copilot aktif ama model bulunamadı - yine de seçilebilir olsun
                    models.copilot = await this.getDefaultCopilotModels(true);
                }
            }
            else {
                // GitHub Copilot aktif değil - yine de seçilebilir olsun (kullanıcı sonra yükleyebilir)
                models.copilot = await this.getDefaultCopilotModels(true);
            }
        }
        catch (error) {
            logger_1.logger.error("Sihirbaz için Copilot modelleri yüklenemedi:", error);
            models.copilot = await this.getDefaultCopilotModels(true);
        }
        models.all = [...models.gemini, ...models.copilot];
        logger_1.logger.info("Sihirbaz modelleri yüklendi:", {
            gemini: models.gemini.length,
            copilot: models.copilot.length,
            total: models.all.length
        });
        return models;
    }
    async getAvailableGeminiModels() {
        const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
        const localization = LocalizationManager.getInstance();
        // Gemini API'den modelleri doğrudan çek
        try {
            // Doğrudan GeminiProvider instance'ı oluştur (mevcut provider ne olursa olsun)
            const geminiProvider = new aiProvider_1.GeminiProvider();
            const isConfigured = await geminiProvider.isApiKeyConfigured();
            if (isConfigured) {
                logger_1.logger.info("Gemini API anahtarı mevcut, modeller API'den çekiliyor...");
                const availableModels = await geminiProvider.getAvailableModels();
                if (availableModels && availableModels.length > 0) {
                    logger_1.logger.info(`Gemini API'den ${availableModels.length} model çekildi`);
                    return availableModels.map((model) => ({
                        id: model.id || model.name,
                        name: model.name || this.formatGeminiModelName(model.id),
                        description: model.description || localization.getString(`gemini.model.${model.id?.replace("models/", "").replace("-", ".")}.description`) || "Google Gemini model",
                        speed: model.speed || this.getModelSpeed(model.id),
                        quality: model.quality || this.getModelQuality(model.id),
                        recommended: model.recommended || this.isRecommendedModel(model.id),
                        inputTokenLimit: model.inputTokenLimit,
                        outputTokenLimit: model.outputTokenLimit
                    }));
                }
            }
            else {
                logger_1.logger.info("Gemini API anahtarı yapılandırılmamış, varsayılan modeller kullanılacak");
            }
        }
        catch (error) {
            logger_1.logger.warn("Gemini API modelleri yüklenemedi:", error);
        }
        // Varsayılan modelleri döndür
        return await this.getDefaultGeminiModels();
    }
    async getDefaultGeminiModels() {
        const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
        const localization = LocalizationManager.getInstance();
        const isEnglish = localization.getCurrentLanguage() === "en";
        return [
            {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
                description: isEnglish ? "Latest & fastest - Best for quick improvements" : "En yeni ve en hızlı - Hızlı iyileştirmeler için en iyi",
                speed: "fast",
                quality: "very-high",
                recommended: true
            },
            {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                description: isEnglish ? "Most capable - Best for complex analysis" : "En yetenekli - Karmaşık analizler için en iyi",
                speed: "medium",
                quality: "very-high"
            },
            // Gemini 3 Series (Latest)
            {
                id: "gemini-3-flash",
                name: "Gemini 3 Flash",
                description: isEnglish ? "Next-gen speed - Ultra fast responses" : "Yeni nesil hız - Ultra hızlı yanıtlar",
                speed: "fast",
                quality: "very-high"
            },
            {
                id: "gemini-3-pro",
                name: "Gemini 3 Pro",
                description: isEnglish ? "Next-gen intelligence - Breakthrough capabilities" : "Yeni nesil zeka - Çığır açan yetenekler",
                speed: "medium",
                quality: "very-high"
            },
            // Gemini 2 Series
            {
                id: "gemini-2.0-flash",
                name: "Gemini 2.0 Flash",
                description: isEnglish ? "Fast and reliable - Good balance" : "Hızlı ve güvenilir - İyi denge",
                speed: "fast",
                quality: "high"
            },
            {
                id: "gemini-1.5-flash",
                name: "Gemini 1.5 Flash",
                description: isEnglish ? "Stable performance" : "Kararlı performans",
                speed: "fast",
                quality: "high"
            },
            {
                id: "gemini-1.5-pro",
                name: "Gemini 1.5 Pro",
                description: isEnglish ? "High quality for complex tasks" : "Karmaşık görevler için yüksek kalite",
                speed: "medium",
                quality: "very-high"
            }
        ];
    }
    formatGeminiModelName(modelId) {
        // models/gemini-1.5-flash -> Gemini 1.5 Flash
        return modelId
            .replace("models/", "")
            .replace("gemini-", "Gemini ")
            .replace(/-/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    async checkCopilotStatus() {
        try {
            // GitHub Copilot uzantısının yüklü ve aktif olup olmadığını kontrol et
            const copilotExtension = vscode.extensions.getExtension("GitHub.copilot");
            if (!copilotExtension) {
                return { available: false, reason: "GitHub Copilot extension not installed" };
            }
            if (!copilotExtension.isActive) {
                await copilotExtension.activate();
            }
            // VS Code Language Models API ile Copilot modellerini kontrol et
            try {
                const models = await vscode.lm.selectChatModels();
                const copilotModels = models.filter(model => model.vendor === "copilot" ||
                    model.id.includes("copilot") ||
                    model.family.includes("gpt") ||
                    model.family.includes("claude"));
                if (copilotModels.length > 0) {
                    return { available: true };
                }
                else {
                    return { available: false, reason: "No Copilot models available - subscription may be inactive" };
                }
            }
            catch (error) {
                return { available: false, reason: "Cannot access Copilot models - authentication may be required" };
            }
        }
        catch (error) {
            logger_1.logger.error("Copilot status check error:", error);
            return { available: false, reason: `Error checking Copilot status: ${error}` };
        }
    }
    getModelSpeed(modelId) {
        const fastModels = ["mini", "haiku", "flash", "3.5-turbo"];
        const slowModels = ["opus", "pro"];
        const lowerModelId = modelId.toLowerCase();
        if (fastModels.some(fast => lowerModelId.includes(fast))) {
            return "fast";
        }
        else if (slowModels.some(slow => lowerModelId.includes(slow))) {
            return "slow";
        }
        return "medium";
    }
    getModelQuality(modelId) {
        const veryHighQuality = ["4o", "opus", "pro", "3.5-sonnet"];
        const highQuality = ["4", "sonnet", "flash"];
        const lowerModelId = modelId.toLowerCase();
        if (veryHighQuality.some(high => lowerModelId.includes(high))) {
            return "very-high";
        }
        else if (highQuality.some(high => lowerModelId.includes(high))) {
            return "high";
        }
        return "medium";
    }
    isRecommendedModel(modelId) {
        const recommendedModels = [
            // Latest models
            "gpt-5", "gpt-5-mini",
            "claude-4.5", "claude-4.5-sonnet", "claude-4.5-haiku",
            "o3", "o3-mini", "o4-mini",
            "gemini-3-flash", "gemini-3-pro",
            // Current top models
            "gemini-2.5-flash", "gemini-2.5-pro",
            "claude-sonnet-4", "claude-4",
            "gpt-4.1", "gpt-4o",
            "claude-3.5-sonnet"
        ];
        const lowerModelId = modelId.toLowerCase();
        return recommendedModels.some(recommended => lowerModelId.includes(recommended.toLowerCase()));
    }
    async getDefaultCopilotModels(available) {
        const localization = (await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")))).LocalizationManager.getInstance();
        const isEnglish = localization.getCurrentLanguage() === "en";
        return [
            // GPT-5 Series (Latest)
            {
                id: "gpt-5",
                name: "GPT-5",
                description: isEnglish ? "Most advanced GPT - Breakthrough capabilities" : "En gelişmiş GPT - Çığır açan yetenekler",
                speed: "medium",
                quality: "very-high",
                recommended: true,
                available
            },
            {
                id: "gpt-5-mini",
                name: "GPT-5 Mini",
                description: isEnglish ? "Fast GPT-5 variant - Efficient and powerful" : "Hızlı GPT-5 versiyonu - Verimli ve güçlü",
                speed: "fast",
                quality: "very-high",
                available
            },
            // Claude 4.5 Series (Latest)
            {
                id: "claude-4.5-sonnet",
                name: "Claude 4.5 Sonnet",
                description: isEnglish ? "Latest Claude - Superior reasoning & coding" : "En yeni Claude - Üstün mantık ve kodlama",
                speed: "medium",
                quality: "very-high",
                recommended: true,
                available
            },
            {
                id: "claude-4.5-haiku",
                name: "Claude 4.5 Haiku",
                description: isEnglish ? "Fastest Claude 4.5 - Quick responses" : "En hızlı Claude 4.5 - Hızlı yanıtlar",
                speed: "fast",
                quality: "very-high",
                available
            },
            // Claude 4 Series
            {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                description: isEnglish ? "Claude 4 - Exceptional reasoning" : "Claude 4 - Üstün mantık yürütme",
                speed: "medium",
                quality: "very-high",
                available
            },
            // o-Series (Reasoning Models)
            {
                id: "o3",
                name: "o3",
                description: isEnglish ? "Advanced reasoning model - Complex problem solving" : "Gelişmiş mantık modeli - Karmaşık problem çözme",
                speed: "slow",
                quality: "very-high",
                available
            },
            {
                id: "o3-mini",
                name: "o3-mini",
                description: isEnglish ? "Fast reasoning model - Efficient for coding" : "Hızlı mantık modeli - Kodlama için verimli",
                speed: "fast",
                quality: "very-high",
                available
            },
            {
                id: "o4-mini",
                name: "o4-mini",
                description: isEnglish ? "Latest o-series - Enhanced reasoning" : "En yeni o-serisi - Geliştirilmiş mantık",
                speed: "fast",
                quality: "very-high",
                available
            },
            // GPT-4 Series
            {
                id: "gpt-4.1",
                name: "GPT-4.1",
                description: isEnglish ? "Enhanced GPT-4 - Improved capabilities" : "Geliştirilmiş GPT-4 - İyileştirilmiş yetenekler",
                speed: "medium",
                quality: "very-high",
                available
            },
            {
                id: "gpt-4o",
                name: "GPT-4o",
                description: isEnglish ? "OpenAI flagship - Most capable" : "OpenAI amiral gemisi - En yetenekli",
                speed: "medium",
                quality: "very-high",
                available
            },
            {
                id: "gpt-4o-mini",
                name: "GPT-4o Mini",
                description: isEnglish ? "Fast and efficient - Good balance" : "Hızlı ve verimli - İyi denge",
                speed: "fast",
                quality: "high",
                available
            },
            // Claude 3.5 Series
            {
                id: "claude-3.5-sonnet",
                name: "Claude 3.5 Sonnet",
                description: isEnglish ? "Advanced reasoning - High quality" : "Gelişmiş mantık yürütme - Yüksek kalite",
                speed: "medium",
                quality: "very-high",
                available
            },
            {
                id: "claude-3.5-haiku",
                name: "Claude 3.5 Haiku",
                description: isEnglish ? "Fastest Claude 3.5 - Quick responses" : "En hızlı Claude 3.5 - Hızlı yanıtlar",
                speed: "fast",
                quality: "high",
                available
            }
        ];
    }
    async setupProvider(provider) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        aiConfig.provider = provider;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
        await this.aiProviderManager.setProvider(provider);
        // Önce kalıcı ayarlara kaydet
        if (this.persistentSettingsManager) {
            await this.persistentSettingsManager.persistSetting("ai", aiConfig);
        }
        // JSON'a kaydet
        if (this.jsonManager) {
            await this.jsonManager.updateWizardStep("provider", {
                value: provider,
                completed: true
            });
            // VS Code configuration'dan JSON'a senkronize et
            await this.jsonManager.syncFromVSCodeConfiguration();
        }
        const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
        const localization = LocalizationManager.getInstance();
        const currentLang = localization.getCurrentLanguage();
        const isEnglish = currentLang === "en";
        const providerName = provider === "gemini" ? "Google Gemini" : "GitHub Copilot";
        const message = isEnglish
            ? `✅ AI Provider set: ${providerName}`
            : `✅ AI Sağlayıcı ayarlandı: ${providerName}`;
        vscode.window.showInformationMessage(message);
    }
    async setupModel(modelId) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        // Model ayarını hem ai config'e hem de aiModels config'e kaydet (geriye uyumluluk için)
        const aiConfig = config.get("ai") || {};
        aiConfig.selectedModel = modelId;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
        const aiModelConfig = config.get("aiModels") || {};
        aiModelConfig.selectedModel = modelId;
        await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);
        await this.aiProviderManager.setModel(modelId);
        // Önce kalıcı ayarlara kaydet
        if (this.persistentSettingsManager) {
            await this.persistentSettingsManager.persistSetting("ai", aiConfig);
            await this.persistentSettingsManager.persistSetting("aiModels", aiModelConfig);
        }
        // JSON'a kaydet
        if (this.jsonManager) {
            await this.jsonManager.updateWizardStep("model", {
                value: modelId,
                completed: true
            });
            // VS Code configuration'dan JSON'a senkronize et
            await this.jsonManager.syncFromVSCodeConfiguration();
        }
        const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
        const localization = LocalizationManager.getInstance();
        const currentLang = localization.getCurrentLanguage();
        const isEnglish = currentLang === "en";
        const message = isEnglish
            ? `✅ AI Model set: ${modelId}`
            : `✅ AI Modeli ayarlandı: ${modelId}`;
        vscode.window.showInformationMessage(message);
    }
    async setupApiKey(apiKey) {
        if (!apiKey || apiKey.trim().length === 0) {
            return false;
        }
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        aiConfig.apiKey = apiKey;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
        // Önce kalıcı ayarlara kaydet
        if (this.persistentSettingsManager) {
            await this.persistentSettingsManager.persistSetting("ai", aiConfig);
        }
        // JSON'a kaydet (API key'i kaydetmiyoruz, sadece varlığını)
        if (this.jsonManager) {
            await this.jsonManager.updateWizardStep("apiKey", {
                hasValue: true,
                completed: true
            });
            // VS Code configuration'dan JSON'a senkronize et
            await this.jsonManager.syncFromVSCodeConfiguration();
        }
        const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
        const localization = LocalizationManager.getInstance();
        const currentLang = localization.getCurrentLanguage();
        const isEnglish = currentLang === "en";
        const message = isEnglish
            ? "✅ API Key saved successfully"
            : "✅ API Anahtarı başarıyla kaydedildi";
        vscode.window.showInformationMessage(message);
        return true;
    }
    async setupWcagLevel(level) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        await config.update("wcagLevel", level, vscode.ConfigurationTarget.Global);
        // Önce kalıcı ayarlara kaydet
        if (this.persistentSettingsManager) {
            await this.persistentSettingsManager.persistSetting("wcagLevel", level);
        }
        // JSON'a kaydet
        if (this.jsonManager) {
            await this.jsonManager.updateWizardStep("wcagLevel", {
                value: level,
                completed: true
            });
            // VS Code configuration'dan JSON'a senkronize et
            await this.jsonManager.syncFromVSCodeConfiguration();
        }
    }
    async setupLanguage(language) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        await config.update("language", language, vscode.ConfigurationTarget.Global);
        // Önce kalıcı ayarlara kaydet
        if (this.persistentSettingsManager) {
            await this.persistentSettingsManager.persistSetting("language", language);
        }
        // JSON'a kaydet
        if (this.jsonManager) {
            await this.jsonManager.updateWizardStep("language", {
                value: language,
                completed: true
            });
            // VS Code configuration'dan JSON'a senkronize et
            await this.jsonManager.syncFromVSCodeConfiguration();
        }
    }
    async setupJiraConfig(jiraConfig) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        await config.update("jira", jiraConfig, vscode.ConfigurationTarget.Global);
        // Önce kalıcı ayarlara kaydet
        if (this.persistentSettingsManager) {
            await this.persistentSettingsManager.persistSetting("jira", jiraConfig);
        }
        // JSON'a kaydet
        if (this.jsonManager) {
            await this.jsonManager.updateWizardStep("jiraConfig", {
                config: jiraConfig,
                completed: true
            });
            // VS Code configuration'dan JSON'a senkronize et
            await this.jsonManager.syncFromVSCodeConfiguration();
        }
    }
    async finishWizard() {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            // Wizard tamamlandığını işaretle
            await config.update("wizardCompleted", true, vscode.ConfigurationTarget.Global);
            // Mevcut ayarları doğrula ve tutarlı hale getir
            const aiConfig = config.get("ai") || {};
            const aiModelConfig = config.get("aiModels") || {};
            // Model ayarı tutarlılığını sağla
            if (aiConfig.selectedModel && !aiModelConfig.selectedModel) {
                aiModelConfig.selectedModel = aiConfig.selectedModel;
                await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);
            }
            else if (!aiConfig.selectedModel && aiModelConfig.selectedModel) {
                aiConfig.selectedModel = aiModelConfig.selectedModel;
                await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
            }
            // AI Provider ayarlarını bir kez daha yükle
            if (aiConfig.provider) {
                await this.aiProviderManager.setProvider(aiConfig.provider);
            }
            if (aiConfig.selectedModel || aiModelConfig.selectedModel) {
                await this.aiProviderManager.setModel(aiConfig.selectedModel || aiModelConfig.selectedModel);
            }
            // Sihirbazda yapılan ayarları kalıcı storage'a kaydet
            if (this.persistentSettingsManager) {
                try {
                    // Wizard completion'ı önce kalıcı storage'a kaydet
                    await this.persistentSettingsManager.persistSetting("wizardCompleted", true);
                    // Tüm wizard ayarlarını tek seferde kalıcı storage'a kaydet
                    const wizardSettings = {
                        ai: aiConfig,
                        aiModels: aiModelConfig,
                        language: config.get("language", "en"),
                        wcagLevel: config.get("wcagLevel", "AA"),
                        jira: config.get("jira", {}),
                        autoApply: config.get("autoApply", false),
                        includeComments: config.get("includeComments", true),
                        enableStatistics: config.get("enableStatistics", true),
                        interfacePreferences: config.get("interfacePreferences", {}),
                        wizardCompleted: true
                    };
                    // Her ayarı ayrı ayrı kalıcı storage'a kaydet
                    for (const [key, value] of Object.entries(wizardSettings)) {
                        await this.persistentSettingsManager.persistSetting(key, value);
                    }
                    // Mevcut VS Code configuration'ı da kalıcı storage'a persist et
                    await this.persistentSettingsManager.persistCurrentConfiguration();
                    logger_1.logger.info("🎯 Sihirbaz ayarları kalıcı storage'a kaydedildi");
                }
                catch (persistError) {
                    logger_1.logger.error("❌ Sihirbaz ayarları kalıcı storage'a kaydedilemedi:", persistError);
                    // Hata olsa bile wizard'ı bitir, sadece log'la
                }
            }
            else {
                logger_1.logger.warn("⚠️ PersistentSettingsManager bulunamadı, sihirbaz ayarları sadece VS Code configuration'a kaydedildi");
            }
            // JSON Manager'a da wizard tamamlandığını kaydet
            if (this.jsonManager) {
                try {
                    // Wizard'ı tamamlandı olarak işaretle
                    await this.jsonManager.updateWizardSettings({
                        completed: true,
                        completedAt: new Date().toISOString()
                    });
                    // VS Code configuration'dan JSON'a son kez senkronize et
                    await this.jsonManager.syncFromVSCodeConfiguration();
                    logger_1.logger.info("🎯 Sihirbaz tamamlandı ve JSON dosyasına kaydedildi");
                }
                catch (jsonError) {
                    logger_1.logger.error("❌ Sihirbaz JSON'a kaydedilemedi:", jsonError);
                    // Hata olsa bile wizard'ı bitir, sadece log'la
                }
            }
            const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
            const localization = LocalizationManager.getInstance();
            const currentLang = localization.getCurrentLanguage();
            const isEnglish = currentLang === "en";
            const message = isEnglish
                ? "🎉 AccessiMind setup completed! You can now start making accessibility improvements."
                : "🎉 AccessiMind kurulumu tamamlandı! Artık kod iyileştirmelerine başlayabilirsiniz.";
            const actionText = isEnglish ? "Try Now" : "Hemen Dene";
            vscode.window.showInformationMessage(message, actionText).then(action => {
                if (action === actionText) {
                    vscode.commands.executeCommand("wcagEnhancer.improveCurrentSelected");
                }
            });
            logger_1.logger.info("🎯 AccessiMind wizard completed successfully with persistent settings");
        }
        catch (error) {
            logger_1.logger.error("Wizard finish error:", error);
            vscode.window.showErrorMessage("Ayar kaydetme sırasında hata oluştu. Lütfen ayarları manuel olarak kontrol edin.");
        }
    }
    async testAIConnection() {
        try {
            const { AITestUtils } = await Promise.resolve().then(() => __importStar(require("./utils/aiTestUtils")));
            const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
            const localization = LocalizationManager.getInstance();
            const currentLang = localization.getCurrentLanguage();
            const isEnglish = currentLang === "en";
            const aiTestUtils = AITestUtils.getInstance();
            const result = await aiTestUtils.testAIProvider();
            const successMessage = isEnglish ? "AI connection successful!" : "AI bağlantısı başarılı!";
            const failMessage = isEnglish ? "Connection failed" : "Bağlantı başarısız";
            const _errorPrefix = isEnglish ? "Test error: " : "Test hatası: ";
            const _unknownError = isEnglish ? "Unknown error" : "Bilinmeyen hata";
            return {
                success: result.success,
                message: result.success ? successMessage : (result.error || failMessage)
            };
        }
        catch (error) {
            const { LocalizationManager } = await Promise.resolve().then(() => __importStar(require("./utils/localizationManager")));
            const localization = LocalizationManager.getInstance();
            const currentLang = localization.getCurrentLanguage();
            const isEnglish = currentLang === "en";
            const _errorPrefix = isEnglish ? "Test error: " : "Test hatası: ";
            const _unknownError = isEnglish ? "Unknown error" : "Bilinmeyen hata";
            return {
                success: false,
                message: `${_errorPrefix}${error instanceof Error ? error.message : _unknownError}`
            };
        }
    }
    async refreshAvailableModels() {
        try {
            logger_1.logger.info("Modeller yeniden yükleniyor...");
            // Copilot modellerini yenile
            await this.aiProviderManager.refreshCopilotModels();
            // Modelleri yeniden yükle
            const refreshedModels = await this.getAvailableModelsForWizard();
            logger_1.logger.info("Modeller başarıyla yenilendi:", {
                gemini: refreshedModels.gemini.length,
                copilot: refreshedModels.copilot.length
            });
            return refreshedModels;
        }
        catch (error) {
            logger_1.logger.error("Model yenileme hatası:", error);
            throw error;
        }
    }
    /**
     * Generates the HTML for the modern setup wizard.
     * This wizard allows the user to select an AI provider (Gemini or Copilot),
     * then dynamically fetches available models from the API, and ensures that
     * all generated outputs are fully WCAG and ARIA compliant.
     *
     * @param availableModels - The models fetched dynamically from the provider APIs.
     * @returns The HTML string for the wizard UI.
     */
    getModernWizardHTML(availableModels) {
        // Use the localization manager for multi-language support
        const localization = localizationManager_1.LocalizationManager.getInstance();
        localization.detectLanguage();
        const currentLang = localization.getCurrentLanguage();
        const isEnglish = currentLang === "en";
        const langCode = currentLang;
        return `
<!DOCTYPE html>
<html lang="${langCode}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${isEnglish ? "AccessiMind Setup Wizard" : "AccessiMind Kurulum Sihirbazı"}</title>
	<style>
		:root {
			--primary-color: #007acc;
			--secondary-color: #e7f3ff;
			--success-color: #28a745;
			--warning-color: #ffc107;
			--danger-color: #dc3545;
			--text-color: var(--vscode-foreground);
			--bg-color: var(--vscode-editor-background);
			--border-color: var(--vscode-panel-border);
			--card-bg: var(--vscode-input-background);
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
			overflow-x: hidden;
		}

		.wizard-container {
			max-width: 800px;
			margin: 0 auto;
			padding: 20px;
			min-height: 100vh;
		}

		.wizard-header {
			text-align: center;
			margin-bottom: 40px;
			padding: 30px 0;
			background: linear-gradient(135deg, var(--primary-color), #005a9e);
			border-radius: 12px;
			color: white;
		}

		.wizard-header h1 {
			font-size: 2.5rem;
			margin-bottom: 10px;
			font-weight: 600;
		}

		.wizard-header p {
			font-size: 1.1rem;
			opacity: 0.9;
		}

		.step-indicator {
			display: flex;
			justify-content: center;
			margin-bottom: 40px;
			gap: 10px;
		}

		.step {
			width: 40px;
			height: 40px;
			border-radius: 50%;
			background: var(--border-color);
			display: flex;
			align-items: center;
			justify-content: center;
			font-weight: bold;
			transition: all 0.3s ease;
			position: relative;
		}

		.step.active {
			background: var(--primary-color);
			color: white;
			box-shadow: 0 0 20px rgba(0, 122, 204, 0.5);
		}

		.step.completed {
			background: var(--success-color);
			color: white;
		}

		.step-content {
			display: none;
			background: var(--card-bg);
			border-radius: 12px;
			padding: 30px;
			margin-bottom: 20px;
			border: 1px solid var(--border-color);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		}

		.step-content.active {
			display: block;
			animation: fadeIn 0.5s ease-in-out;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(20px); }
			to { opacity: 1; transform: translateY(0); }
		}

		.step-title {
			font-size: 1.8rem;
			margin-bottom: 15px;
			color: var(--primary-color);
			font-weight: 600;
		}

		.step-description {
			font-size: 1rem;
			margin-bottom: 25px;
			color: var(--vscode-descriptionForeground);
		}

		.provider-selection {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 20px;
			margin-bottom: 30px;
		}

		.provider-card {
			background: var(--card-bg);
			border: 2px solid var(--border-color);
			border-radius: 12px;
			padding: 25px;
			cursor: pointer;
			transition: all 0.3s ease;
			text-align: center;
			position: relative;
		}

		.provider-card:hover {
			border-color: var(--primary-color);
			transform: translateY(-2px);
			box-shadow: 0 8px 25px rgba(0, 122, 204, 0.15);
		}

		.provider-card.selected {
			border-color: var(--primary-color);
			background: var(--secondary-color);
		}

		.provider-icon {
			font-size: 3rem;
			margin-bottom: 15px;
		}

		.provider-name {
			font-size: 1.4rem;
			font-weight: 600;
			margin-bottom: 10px;
		}

		.provider-description {
			font-size: 0.9rem;
			color: var(--vscode-descriptionForeground);
		}

		.model-selection {
			margin-bottom: 30px;
		}

		.model-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 15px;
			margin-bottom: 20px;
		}

		.model-card {
			background: var(--card-bg);
			border: 2px solid var(--border-color);
			border-radius: 8px;
			padding: 20px;
			cursor: pointer;
			transition: all 0.3s ease;
			position: relative;
		}

		.model-card:hover {
			border-color: var(--primary-color);
			transform: translateY(-1px);
		}

		.model-card.selected {
			border-color: var(--primary-color);
			background: var(--secondary-color);
		}

		.model-card.recommended::before {
			content: "✨ ${localization.getString("wizard.model.recommended") || "Recommended"}";
			position: absolute;
			top: -10px;
			right: 10px;
			background: var(--success-color);
			color: white;
			padding: 4px 8px;
			border-radius: 12px;
			font-size: 0.7rem;
			font-weight: bold;
		}

		.model-name {
			font-size: 1.2rem;
			font-weight: 600;
			margin-bottom: 8px;
		}

		.model-description {
			font-size: 0.9rem;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 10px;
		}

		.model-badges {
			display: flex;
			gap: 8px;
		}

		.badge {
			padding: 4px 8px;
			border-radius: 12px;
			font-size: 0.7rem;
			font-weight: bold;
		}

		.badge.speed-fast { background: var(--success-color); color: white; }
		.badge.speed-medium { background: var(--warning-color); color: black; }
		.badge.quality-high { background: var(--primary-color); color: white; }
		.badge.quality-very-high { background: var(--success-color); color: white; }
		.badge.unavailable { background: var(--danger-color); color: white; }

		.model-card.unavailable {
			opacity: 0.6;
			cursor: not-allowed;
		}

		.model-card.unavailable:hover {
			transform: none;
			border-color: var(--border-color);
		}

		.form-group {
			margin-bottom: 20px;
		}

		.form-label {
			display: block;
			margin-bottom: 8px;
			font-weight: 600;
		}

		.form-input {
			width: 100%;
			padding: 12px;
			border: 2px solid var(--border-color);
			border-radius: 6px;
			background: var(--card-bg);
			color: var(--text-color);
			font-size: 1rem;
			transition: border-color 0.3s ease;
		}

		.form-input:focus {
			outline: none;
			border-color: var(--primary-color);
			box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
		}

		.form-select {
			width: 100%;
			padding: 12px;
			border: 2px solid var(--border-color);
			border-radius: 6px;
			background: var(--card-bg);
			color: var(--text-color);
			font-size: 1rem;
		}

		.button-group {
			display: flex;
			gap: 15px;
			justify-content: flex-end;
			margin-top: 30px;
		}

		.btn {
			padding: 12px 24px;
			border: none;
			border-radius: 6px;
			font-size: 1rem;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s ease;
			text-decoration: none;
			display: inline-flex;
			align-items: center;
			gap: 8px;
		}

		.btn-primary {
			background: var(--primary-color);
			color: white;
		}

		.btn-primary:hover {
			background: #005a9e;
			transform: translateY(-1px);
		}

		.btn-secondary {
			background: var(--border-color);
			color: var(--text-color);
		}

		.btn-secondary:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.btn-success {
			background: var(--success-color);
			color: white;
		}

		.btn-success:hover {
			background: #218838;
		}

		.alert {
			padding: 15px;
			border-radius: 6px;
			margin-bottom: 20px;
			border-left: 4px solid;
		}

		.alert-success {
			background: rgba(40, 167, 69, 0.1);
			border-color: var(--success-color);
			color: var(--success-color);
		}

		.alert-warning {
			background: rgba(255, 193, 7, 0.1);
			border-color: var(--warning-color);
			color: var(--warning-color);
		}

		.alert-danger {
			background: rgba(220, 53, 69, 0.1);
			border-color: var(--danger-color);
			color: var(--danger-color);
		}

		.test-result {
			margin-top: 20px;
			padding: 15px;
			border-radius: 6px;
			display: none;
		}

		.loading {
			display: inline-block;
			width: 20px;
			height: 20px;
			border: 3px solid rgba(255, 255, 255, 0.3);
			border-radius: 50%;
			border-top-color: #fff;
			animation: spin 1s ease-in-out infinite;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		.help-section {
			background: var(--secondary-color);
			border-radius: 8px;
			padding: 20px;
			margin-top: 30px;
		}

		.help-title {
			font-size: 1.2rem;
			font-weight: 600;
			margin-bottom: 15px;
			color: var(--primary-color);
		}

		.help-links {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 15px;
		}

		.help-link {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px;
			background: var(--card-bg);
			border-radius: 6px;
			text-decoration: none;
			color: var(--text-color);
			transition: background-color 0.3s ease;
		}

		.help-link:hover {
			background: var(--vscode-list-hoverBackground);
		}

		@media (max-width: 768px) {
			.provider-selection {
				grid-template-columns: 1fr;
			}
			
			.model-grid {
				grid-template-columns: 1fr;
			}
			
			.button-group {
				flex-direction: column;
			}
			
			.help-links {
				grid-template-columns: 1fr;
			}
		}

		.accessibility-features {
			margin-top: 20px;
		}

		.screen-reader-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		/* Focus indicators for better keyboard navigation */
		.provider-card:focus, .model-card:focus, .step:focus {
			outline: 3px solid var(--vscode-focusBorder);
			outline-offset: 2px;
			box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.3);
		}

		/* Clickable steps styling */
		.step.clickable {
			cursor: pointer;
			transition: all 0.3s ease;
		}

		.step.clickable:hover {
			transform: scale(1.1);
			box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
		}

		.step.clickable.completed:hover {
			box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
		}

		.step.clickable:disabled {
			cursor: not-allowed;
			opacity: 0.6;
		}

		.btn:focus {
			outline: 3px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}

		.form-input:focus, .form-select:focus {
			outline: 3px solid var(--vscode-focusBorder);
			outline-offset: 1px;
			border-color: var(--vscode-focusBorder);
		}

		/* High contrast mode support */
		@media (prefers-contrast: high) {
			.provider-card, .model-card {
				border-width: 3px;
			}
			
			.btn {
				border: 2px solid currentColor;
			}
			
			.step {
				border: 2px solid currentColor;
			}
		}

		/* Reduced motion support */
		@media (prefers-reduced-motion: reduce) {
			*, *::before, *::after {
				animation-duration: 0.01ms !important;
				animation-iteration-count: 1 !important;
				transition-duration: 0.01ms !important;
			}
		}

		/* Enhanced touch targets for mobile */
		@media (pointer: coarse) {
			.provider-card, .model-card, .btn {
				min-height: 44px;
				min-width: 44px;
			}
		}

		/* Color blind friendly indicators */
		.badge.speed-fast::before { content: "⚡ "; }
		.badge.speed-medium::before { content: "⏳ "; }
		.badge.speed-slow::before { content: "🐌 "; }
		.badge.quality-high::before { content: "⭐ "; }
		.badge.quality-very-high::before { content: "🌟 "; }
		.badge.quality-medium::before { content: "📊 "; }

		/* Skip links */
		.skip-link {
			position: absolute;
			top: -40px;
			left: 6px;
			background: var(--vscode-editor-background);
			color: var(--vscode-foreground);
			padding: 8px;
			text-decoration: none;
			border-radius: 4px;
			border: 2px solid var(--vscode-focusBorder);
		}

		.skip-link:focus {
			top: 6px;
		}
	</style>
</head>
<body>
	<a href="#main-content" class="skip-link">Skip to main content</a>
	<div id="main-content" class="wizard-container" role="main" aria-labelledby="wizard-title">
		<header class="wizard-header">
			<h1 id="wizard-title">♿ ${localization.getString("wizard.title")}</h1>
			<p role="doc-subtitle">${localization.getString("wizard.welcome.description")}</p>
		</header>

		<nav class="step-indicator" role="navigation" aria-label="${localization.getString("wizard.steps.title") || "Setup steps"}" aria-describedby="step-help">
			<div class="step active clickable" data-step="1" role="button" tabindex="0" aria-label="${localization.getString("wizard.step1.title") || "Step 1: AI Provider Selection"}" aria-current="step">1</div>
			<div class="step clickable" data-step="2" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step2.title") || "Step 2: Model Selection"}">2</div>
			<div class="step clickable" data-step="3" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step3.title") || "Step 3: Interface & Language"}">3</div>
			<div class="step clickable" data-step="4" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step4.title") || "Step 4: API Test"}">4</div>
			<div class="step clickable" data-step="5" role="button" tabindex="-1" aria-label="Step 5: Jira Configuration (Optional)">5</div>
			<div class="step clickable" data-step="6" role="button" tabindex="-1" aria-label="${localization.getString("wizard.step5.title") || "Step 6: Complete Setup"}">6</div>
			<div id="step-help" class="screen-reader-only">Click on step numbers to navigate between completed steps</div>
		</nav>

		<!-- Step 1: AI Provider Selection -->
		<section class="step-content active" data-step="1" role="tabpanel" aria-labelledby="step1-title" aria-describedby="step1-desc">
			<h2 id="step1-title" class="step-title">${localization.getString("wizard.provider.title")}</h2>
			<p id="step1-desc" class="step-description">${localization.getString("wizard.provider.description")}</p>
			
			<!-- Accessibility Note: The selected provider and model will be used to generate outputs fully compliant with WCAG and ARIA standards for maximum accessibility. -->
			<div class="alert alert-success" role="status" aria-live="polite" style="margin-bottom:18px;">
				${isEnglish
            ? "All outputs generated by the selected provider and model will strictly comply with WCAG and ARIA accessibility standards. This ensures your code is accessible to users with disabilities."
            : "Seçilen sağlayıcı ve model ile üretilen tüm çıktılar WCAG ve ARIA erişilebilirlik standartlarına tam uyumlu olacaktır. Böylece kodunuz tüm engelli kullanıcılar için erişilebilir olur."}
			</div>

			<fieldset class="provider-selection" aria-label="Select AI Provider">
				<legend class="screen-reader-only">Choose your AI provider for WCAG improvements</legend>
				<div class="provider-card" data-provider="gemini" role="radio" tabindex="0" aria-label="${localization.getString("wizard.provider.gemini.select")}" aria-describedby="gemini-desc">
					<div class="provider-icon" aria-hidden="true">🚀</div>
					<div class="provider-name">${localization.getString("provider.gemini.name")}</div>
					<div id="gemini-desc" class="provider-description">${localization.getString("provider.gemini.description")}</div>
				</div>
				
				<div class="provider-card" data-provider="vscode-copilot" role="radio" tabindex="0" aria-label="${localization.getString("wizard.provider.copilot.select")}" aria-describedby="copilot-desc">
					<div class="provider-icon" aria-hidden="true">🤖</div>
					<div class="provider-name">${localization.getString("provider.vscode-copilot.name")}</div>
					<div id="copilot-desc" class="provider-description">${localization.getString("provider.vscode-copilot.description")}</div>
				</div>
			</fieldset>

			<!-- Gemini API Key Input (shown when Gemini is selected) -->
			<div id="geminiApiKeySection" class="api-key-section" style="display: none; margin-top: 20px;">
				<div class="alert alert-info" role="status" style="margin-bottom: 15px;">
					<strong>🔑 ${isEnglish ? "API Key Required" : "API Anahtarı Gerekli"}:</strong>
					${isEnglish
            ? "Enter your Gemini API key below. You can get a free key from "
            : "Aşağıya Gemini API anahtarınızı girin. Ücretsiz anahtar için "}
					<a href="#" onclick="openGeminiApiPage(); return false;" style="color: var(--primary-color);">Google AI Studio</a>
				</div>
				<div class="form-group">
					<label class="form-label" for="step1GeminiApiKey">
						${isEnglish ? "Gemini API Key" : "Gemini API Anahtarı"}
					</label>
					<input type="password" 
						id="step1GeminiApiKey" 
						class="form-input" 
						placeholder="AIzaSy..."
						aria-describedby="step1ApiKeyHelp"
						style="width: 100%; padding: 12px; font-size: 14px;">
					<div id="step1ApiKeyHelp" class="form-text">
						${isEnglish ? "Your API key will be stored securely in VS Code settings." : "API anahtarınız VS Code ayarlarında güvenli bir şekilde saklanacaktır."}
					</div>
				</div>
				<button type="button" class="btn btn-secondary" onclick="saveApiKeyFromStep1()" style="margin-top: 10px;">
					💾 ${isEnglish ? "Save API Key" : "API Anahtarını Kaydet"}
				</button>
				<div id="step1ApiKeyStatus" class="api-key-status" style="margin-top: 10px; display: none;"></div>
			</div>

			<!-- Copilot Info (shown when Copilot is selected) -->
			<div id="copilotInfoSection" class="copilot-info-section" style="display: none; margin-top: 20px;">
				<div class="alert alert-success" role="status">
					<strong>✅ ${isEnglish ? "No API Key Required" : "API Anahtarı Gerekmez"}:</strong>
					${isEnglish
            ? "GitHub Copilot uses your existing Copilot subscription. Make sure you have an active subscription and the GitHub Copilot extension installed."
            : "GitHub Copilot mevcut Copilot aboneliğinizi kullanır. Aktif bir aboneliğiniz ve GitHub Copilot uzantısının yüklü olduğundan emin olun."}
				</div>
			</div>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-primary" onclick="submitStep(1)" disabled id="submitStep1" aria-describedby="submit-help">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
				<div id="submit-help" class="screen-reader-only">${isEnglish ? "Button will be enabled after selecting a provider" : "Sağlayıcı seçtikten sonra düğme aktif olacak"}</div>
			</div>
		</section>

		<!-- Step 2: Model Selection -->
		<section class="step-content" data-step="2" role="tabpanel" aria-labelledby="step2-title" aria-describedby="step2-desc" aria-hidden="true">
			<h2 id="step2-title" class="step-title">${localization.getString("wizard.model.title")}</h2>
			<p id="step2-desc" class="step-description">${localization.getString("wizard.model.description")}</p>
			
			<!-- Accessibility Note: Model selection directly affects the accessibility quality of generated code. -->
			<div class="alert alert-success" role="status" aria-live="polite" style="margin-bottom:18px;">
				${isEnglish
            ? "The selected AI model will generate code and suggestions that are fully WCAG and ARIA compliant, ensuring accessibility for all users."
            : "Seçilen yapay zeka modeli, tüm kullanıcılar için erişilebilirliği garanti altına almak amacıyla WCAG ve ARIA standartlarına tam uyumlu kod ve öneriler üretecektir."}
			</div>

			<div class="model-refresh-section" style="margin-bottom: 20px;">
				<button class="btn btn-secondary" onclick="refreshModels()" id="refreshModelsButton" aria-describedby="refresh-help">
					🔄 ${localization.getString("wizard.model.refresh") || "Refresh Models"}
				</button>
				<div id="refresh-help" class="screen-reader-only">
					${localization.getString("wizard.model.refresh.help") || "Click to reload available models from API"}
				</div>
			</div>
			
			<fieldset class="model-selection" aria-label="Select AI Model">
				<legend class="screen-reader-only">Choose your preferred AI model</legend>
				<div id="geminiModels" class="model-grid" style="display: none;" role="radiogroup" aria-label="Gemini Models">
					${availableModels.gemini.map((model) => `
						<div class="model-card ${model.recommended ? "recommended" : ""}" data-model="${model.id}" data-provider="gemini" role="radio" tabindex="0" aria-label="${localization.getString("wizard.model.select.aria").replace("%MODEL%", model.name)}" aria-describedby="model-${model.id}-desc">
							<div class="model-name">${model.name}</div>
							<div id="model-${model.id}-desc" class="model-description">${model.description}</div>
							<div class="model-badges" aria-label="Model characteristics">
								<span class="badge speed-${model.speed}" aria-label="Speed: ${localization.getString("wizard.model.speed." + model.speed) || model.speed}">${localization.getString("wizard.model.speed." + model.speed) || model.speed}</span>
								<span class="badge quality-${model.quality}" aria-label="Quality: ${localization.getString("wizard.model.quality." + model.quality) || model.quality}">${localization.getString("wizard.model.quality." + model.quality) || model.quality}</span>
							</div>
						</div>
					`).join("")}
				</div>
				
				<div id="copilotModels" class="model-grid" style="display: none;" role="radiogroup" aria-label="Copilot Models">
					${availableModels.copilot.map((model) => `
						<div class="model-card ${model.recommended ? "recommended" : ""} ${!model.available ? "unavailable" : ""}" data-model="${model.id}" data-provider="vscode-copilot" role="radio" tabindex="0" aria-label="${localization.getString("wizard.model.select.aria").replace("%MODEL%", model.name)}" aria-describedby="model-${model.id}-desc" ${!model.available ? "aria-disabled=\"true\"" : ""}>
							<div class="model-name">${model.name} ${!model.available ? "(" + localization.getString("wizard.model.unavailable") + ")" : ""}</div>
							<div id="model-${model.id}-desc" class="model-description">${model.description}</div>
							<div class="model-badges" aria-label="Model characteristics">
								<span class="badge speed-${model.speed}" aria-label="Speed: ${localization.getString("wizard.model.speed." + model.speed) || model.speed}">${localization.getString("wizard.model.speed." + model.speed) || model.speed}</span>
								<span class="badge quality-${model.quality}" aria-label="Quality: ${localization.getString("wizard.model.quality." + model.quality) || model.quality}">${localization.getString("wizard.model.quality." + model.quality) || model.quality}</span>
								${!model.available ? "<span class=\"badge unavailable\" aria-label=\"Model unavailable\">" + localization.getString("wizard.model.unavailable") + "</span>" : ""}
							</div>
						</div>
					`).join("")}
				</div>
			</fieldset>

			<!-- API Test Section in Step 2 -->
			<div id="step2ApiTest" class="api-test-section" style="margin-top: 25px; padding: 20px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border-color);">
				<h3 style="margin-bottom: 15px; font-size: 1.1rem;">
					🧪 ${isEnglish ? "Test Connection" : "Bağlantıyı Test Et"}
				</h3>
				<p style="margin-bottom: 15px; color: var(--vscode-descriptionForeground);">
					${isEnglish
            ? "Test your AI connection to verify everything is configured correctly."
            : "Her şeyin doğru yapılandırıldığını doğrulamak için AI bağlantınızı test edin."}
				</p>
				<button class="btn btn-secondary" onclick="testConnectionFromStep2()" id="testConnectionStep2Button">
					🔌 ${isEnglish ? "Test Connection" : "Bağlantıyı Test Et"}
				</button>
				<div id="step2TestResult" class="test-result" style="margin-top: 15px; display: none;" role="status" aria-live="polite"></div>
			</div>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-primary" onclick="submitStep(2)" disabled id="submitStep2" aria-describedby="submit2-help">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
				<div id="submit2-help" class="screen-reader-only">${isEnglish ? "Button will be enabled after selecting a model" : "Model seçtikten sonra düğme aktif olacak"}</div>
			</div>
		</section>

		<!-- Step 3: Interface & Language Settings -->
		<section class="step-content" data-step="3" role="tabpanel" aria-labelledby="step3-title" aria-describedby="step3-desc" aria-hidden="true">
			<h2 id="step3-title" class="step-title">${localization.getString("wizard.interface.title") || "Interface & Language Settings"}</h2>
			<p id="step3-desc" class="step-description">${localization.getString("wizard.interface.description") || "Configure your interface preferences and language settings."}</p>
			
			<form role="form" aria-label="Interface Configuration">
				<div class="form-group">
					<label class="form-label" for="wcagLevel">${localization.getString("wizard.wcag.level.label")}</label>
					<select id="wcagLevel" class="form-select" aria-describedby="wcagLevelHelp" aria-required="true">
						<option value="A">${localization.getString("welcome.wcag.level.a") || "Level A - Basic accessibility requirements"}</option>
						<option value="AA" selected>${localization.getString("welcome.wcag.level.aa") || "Level AA - Standard accessibility (Recommended)"}</option>
						<option value="AAA">${localization.getString("welcome.wcag.level.aaa") || "Level AAA - Enhanced accessibility for critical applications"}</option>
					</select>
					<div id="wcagLevelHelp" class="form-text">${localization.getString("wizard.wcag.level.help")}</div>
				</div>
				
				<div class="form-group">
					<label class="form-label" for="responseLanguage">${localization.getString("wizard.language.label")}</label>
					<select id="responseLanguage" class="form-select" aria-describedby="languageHelp">
						<option value="auto">${localization.getString("wizard.language.auto")}</option>
						<option value="en" ${currentLang === "en" ? "selected" : ""}>English</option>
						<option value="tr" ${currentLang === "tr" ? "selected" : ""}>Türkçe</option>
					</select>
					<div id="languageHelp" class="form-text">Choose the language for AI responses and interface</div>
				</div>
			</form>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-primary" onclick="submitStep(3)" aria-label="${isEnglish ? "Submit and go to next step" : "Gönder ve sonraki adıma git"}">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>

		<!-- Step 4: API Test & Configuration -->
		<section class="step-content" data-step="4" role="tabpanel" aria-labelledby="step4-title" aria-describedby="step4-desc" aria-hidden="true">
			<h2 id="step4-title" class="step-title">${localization.getString("wizard.api.test.title") || "API Test & Configuration"}</h2>
			<p id="step4-desc" class="step-description">${localization.getString("wizard.api.test.description") || "Test your AI connection and configure API settings."}</p>
			
			<div id="geminiApiConfig" style="display: none;">
				<div class="alert alert-warning">
					<strong>⚠️ ${localization.getString("wizard.api.warning.title") || "Note"}:</strong> ${localization.getString("wizard.api.warning.gemini") || "You can get a free API key from Google AI Studio."}
				</div>
				
				<div class="form-group">
					<label class="form-label" for="geminiApiKey">${localization.getString("wizard.api.key.label")} - Gemini</label>
					<input type="password" id="geminiApiKey" class="form-input" placeholder="AIzaSy... (${localization.getString("wizard.api.key.placeholder")})" aria-describedby="apiKeyHelp">
					<small id="apiKeyHelp" class="form-text">${localization.getString("wizard.api.key.help")}</small>
				</div>
				
				<button class="btn btn-secondary" onclick="openGeminiApiPage()">
					📋 ${localization.getString("wizard.api.key.get")}
				</button>
				
				<button class="btn btn-primary" onclick="testApiKey()" id="testApiButton" style="margin-left: 10px;">
					🧪 ${localization.getString("wizard.button.test")}
				</button>
			</div>
			
			<div id="copilotApiConfig" style="display: none;">
				<div class="alert alert-success">
					<strong>✅ ${localization.getString("wizard.api.success.title") || "Perfect"}!</strong> ${localization.getString("wizard.api.success.copilot") || "You are ready if you have a GitHub Copilot subscription."}
				</div>
				
				<p>${localization.getString("wizard.api.copilot.info") || "GitHub Copilot is automatically configured in VS Code. No additional setup required."}</p>
				
				<button class="btn btn-primary" onclick="testCopilotConnection()" id="testCopilotButton">
					🧪 ${localization.getString("wizard.button.test")}
				</button>
			</div>
			
			<div id="apiTestResult" class="test-result" style="display: none;"></div>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-primary" onclick="submitStep(4)" id="submitStep4">
					${isEnglish ? "Submit & Continue" : "Gönder ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>

		<!-- Step 5: Jira Configuration (Optional) -->
		<section class="step-content" data-step="5" role="tabpanel" aria-labelledby="step5-title" aria-describedby="step5-desc" aria-hidden="true">
			<h2 id="step5-title" class="step-title">🎫 Jira Configuration (Optional)</h2>
			<p id="step5-desc" class="step-description">Configure Jira task creation settings for WCAG improvement tasks. This step is optional but recommended for teams using Jira.</p>
			
			<form role="form" aria-label="Jira Configuration">
				<div class="form-group">
					<label class="form-label" for="jiraCustomPrompt">Custom AI Prompt (Optional)</label>
					<textarea id="jiraCustomPrompt" class="form-input" rows="3" placeholder="e.g., Focus on screen reader compatibility, include testing steps..." aria-describedby="promptHelp"></textarea>
					<div id="promptHelp" class="form-text">Additional context or specific requirements for Jira task generation</div>
				</div>
				
				<div class="form-group">
					<div class="checkbox-group">
						<input type="checkbox" id="useCustomPrompt" class="form-checkbox">
						<label for="useCustomPrompt" class="checkbox-label">Always ask for custom prompt when creating Jira tasks</label>
					</div>
				</div>
				
				<div class="form-group">
					<label class="form-label" for="defaultPriority">Default Task Priority</label>
					<select id="defaultPriority" class="form-select" aria-describedby="priorityHelp">
						<option value="Critical">🔴 Critical - Blocks accessibility for many users</option>
						<option value="High">🟠 High - Significant accessibility barrier</option>
						<option value="Medium" selected>🟡 Medium - Important accessibility improvement</option>
						<option value="Low">🟢 Low - Nice-to-have accessibility enhancement</option>
					</select>
					<div id="priorityHelp" class="form-text">Default priority level for WCAG Jira tasks</div>
				</div>
				
				<div class="form-group">
					<label class="form-label" for="defaultComponent">Default Component/Area</label>
					<select id="defaultComponent" class="form-select" aria-describedby="componentHelp">
						<option value="images">🖼️ Images & Media - Alt text, captions, audio descriptions</option>
						<option value="navigation">🔗 Navigation & Links - Link text, skip links, breadcrumbs</option>
						<option value="forms">📝 Forms & Input - Labels, validation, instructions</option>
						<option value="color">🎨 Color & Contrast - Color contrast, color-only information</option>
						<option value="keyboard">⌨️ Keyboard Access - Tab order, focus management</option>
						<option value="structure">🏗️ Structure & Semantics - Headings, landmarks, ARIA</option>
						<option value="responsive">📱 Responsive & Mobile - Mobile accessibility, touch targets</option>
						<option value="media">🔊 Audio & Video - Captions, transcripts, controls</option>
						<option value="other" selected>🌐 Other - General accessibility improvements</option>
					</select>
					<div id="componentHelp" class="form-text">Default component/area focus for WCAG tasks</div>
				</div>
				
				<div class="form-group">
					<div class="checkbox-group">
						<input type="checkbox" id="includeCodeExamples" class="form-checkbox" checked>
						<label for="includeCodeExamples" class="checkbox-label">Include code examples in Jira task descriptions</label>
					</div>
				</div>
				
				<div class="form-group">
					<div class="checkbox-group">
						<input type="checkbox" id="includeTestingSteps" class="form-checkbox" checked>
						<label for="includeTestingSteps" class="checkbox-label">Include testing steps in Jira task descriptions</label>
					</div>
				</div>
			</form>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-secondary" onclick="skipJiraConfig()" aria-label="Skip Jira configuration">
					Skip <span aria-hidden="true">→</span>
				</button>
				<button class="btn btn-primary" onclick="submitStep(5)" aria-label="Save Jira configuration and continue">
					${isEnglish ? "Save & Continue" : "Kaydet ve Devam Et"} <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>

		<!-- Step 6: Complete Setup -->
		<section class="step-content" data-step="6" role="tabpanel" aria-labelledby="step6-title" aria-describedby="step6-desc" aria-hidden="true">
			<h2 id="step6-title" class="step-title">${localization.getString("wizard.complete.title") || "Complete Setup"}</h2>
			<p id="step6-desc" class="step-description">${localization.getString("wizard.complete.description") || "Finalize your AccessiMind setup and access additional options."}</p>
			
			<div class="alert alert-success" role="alert" aria-live="polite">
				<strong>🎉 ${localization.getString("wizard.test.success.title") || "Great"}!</strong> ${localization.getString("wizard.test.success")}
			</div>
			
			<div class="form-group">
				<button class="btn btn-primary" onclick="testConnection()" id="testButton" aria-describedby="test-connection-help">
					🧪 ${localization.getString("wizard.test.connection")}
				</button>
				<div id="test-connection-help" class="screen-reader-only">Tests the complete AI configuration and connection</div>
			</div>
			
			<div id="testResult" class="test-result" role="status" aria-live="polite" aria-atomic="true"></div>
			
			<section class="help-section" aria-labelledby="quickstart-title">
				<h3 id="quickstart-title" class="help-title">🚀 ${localization.getString("wizard.quickstart.title")}</h3>
				<nav class="help-links" role="navigation" aria-label="Quick start actions">
					<a href="#" class="help-link" onclick="tryCommand('wcagEnhancer.improveCurrentSelected')" role="button" aria-describedby="try-help">
						<span aria-hidden="true">⚡</span>
						<span>${localization.getString("wizard.quickstart.try")}</span>
					</a>
					<div id="try-help" class="screen-reader-only">Runs a quick WCAG improvement on current file or selection</div>
					
					<a href="#" class="help-link" onclick="openSettings()" role="button" aria-describedby="settings-help">
						<span aria-hidden="true">⚙️</span>
						<span>${localization.getString("wizard.quickstart.settings")}</span>
					</a>
					<div id="settings-help" class="screen-reader-only">Opens VS Code settings for AccessiMind</div>
					
					<a href="#" class="help-link" onclick="openExternal('https://www.w3.org/WAI/WCAG22/quickref/')" role="button" aria-describedby="guide-help">
						<span aria-hidden="true">📚</span>
						<span>${localization.getString("wizard.quickstart.guide")}</span>
					</a>
					<div id="guide-help" class="screen-reader-only">Opens WCAG 2.2 quick reference guide in external browser</div>
					
					<a href="#" class="help-link" onclick="openExternal('https://makersuite.google.com/')" role="button" aria-describedby="api-help">
						<span aria-hidden="true">🔑</span>
						<span>${localization.getString("wizard.quickstart.api")}</span>
					</a>
					<div id="api-help" class="screen-reader-only">Opens Google AI Studio to get API key in external browser</div>
				</nav>
			</section>

			<div class="button-group" role="navigation" aria-label="Step navigation">
				<button class="btn btn-secondary" onclick="prevStep()" aria-label="${isEnglish ? "Go to previous step" : "Önceki adıma git"}">
					<span aria-hidden="true">←</span> ${isEnglish ? "Previous" : "Önceki"}
				</button>
				<button class="btn btn-success" onclick="finishWizard()" id="finishButton" aria-describedby="finish-help">
					🎉 ${isEnglish ? "Finish and Complete" : "Tamamla ve Bitir"}
				</button>
				<div id="finish-help" class="screen-reader-only">${isEnglish ? "Completes the setup and starts using AccessiMind" : "Kurulumu tamamlar ve AccessiMind'ı kullanmaya başlar"}</div>
			</div>
		</section>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		let currentStep = 1;
		let selectedProvider = null;
		let selectedModel = null;
		let completedSteps = []; // Tamamlanan adımları takip et
		
		// Sağlayıcı seçimi
		document.querySelectorAll('.provider-card').forEach(card => {
			card.addEventListener('click', () => selectProvider(card.dataset.provider));
			card.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					selectProvider(card.dataset.provider);
				}
			});
		});
		
		// Model seçimi
		document.querySelectorAll('.model-card').forEach(card => {
			card.addEventListener('click', () => selectModel(card.dataset.model, card.dataset.provider));
			card.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					selectModel(card.dataset.model, card.dataset.provider);
				}
			});
		});
		
		// Adım navigasyonu için click listener'lar
		document.querySelectorAll('.step.clickable').forEach(step => {
			step.addEventListener('click', () => {
				const stepNumber = parseInt(step.dataset.step);
				navigateToStep(stepNumber);
			});
			step.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					const stepNumber = parseInt(step.dataset.step);
					navigateToStep(stepNumber);
				}
			});
		});
		
		function navigateToStep(stepNumber) {
			// Sadece tamamlanmış adımlara veya bir sonraki adıma gidebilir
			if (stepNumber <= Math.max(...completedSteps, currentStep)) {
				currentStep = stepNumber;
				updateStepDisplay();
				focusCurrentStep();
				announceToScreenReader(\`Adım \${stepNumber}'ye geçildi\`);
			}
		}
		
		function selectProvider(provider) {
			selectedProvider = provider;
			
			// UI güncellemesi
			document.querySelectorAll('.provider-card').forEach(card => {
				card.classList.remove('selected');
				card.setAttribute('aria-checked', 'false');
			});
			const selectedCard = document.querySelector(\`[data-provider="\${provider}"]\`);
			selectedCard.classList.add('selected');
			selectedCard.setAttribute('aria-checked', 'true');
			
			// API Key ve Copilot bilgi bölümlerini göster/gizle
			const geminiApiSection = document.getElementById('geminiApiKeySection');
			const copilotInfoSection = document.getElementById('copilotInfoSection');
			
			if (provider === 'gemini') {
				geminiApiSection.style.display = 'block';
				copilotInfoSection.style.display = 'none';
				announceToScreenReader('${isEnglish ? "Gemini selected. Please enter your API key." : "Gemini seçildi. Lütfen API anahtarınızı girin."}');
			} else {
				geminiApiSection.style.display = 'none';
				copilotInfoSection.style.display = 'block';
				announceToScreenReader('${isEnglish ? "GitHub Copilot selected. No API key required." : "GitHub Copilot seçildi. API anahtarı gerekmez."}');
			}
			
			// Submit butonunu etkinleştir
			document.getElementById('submitStep1').disabled = false;
			
			// Sağlayıcıyı kaydet ve modelleri al
			vscode.postMessage({
				command: 'setupProvider',
				provider: provider
			});
		}
		
		function saveApiKeyFromStep1() {
			const apiKeyInput = document.getElementById('step1GeminiApiKey');
			const statusDiv = document.getElementById('step1ApiKeyStatus');
			const apiKey = apiKeyInput.value.trim();
			
			if (!apiKey) {
				statusDiv.style.display = 'block';
				statusDiv.className = 'api-key-status alert alert-warning';
				statusDiv.textContent = '${isEnglish ? "Please enter an API key." : "Lütfen bir API anahtarı girin."}';
				announceToScreenReader('${isEnglish ? "Please enter an API key." : "Lütfen bir API anahtarı girin."}');
				return;
			}
			
			// API anahtarını kaydet
			vscode.postMessage({
				command: 'setupApiKey',
				apiKey: apiKey
			});
			
			statusDiv.style.display = 'block';
			statusDiv.className = 'api-key-status alert alert-success';
			statusDiv.textContent = '${isEnglish ? "API key saved successfully!" : "API anahtarı başarıyla kaydedildi!"}';
			announceToScreenReader('${isEnglish ? "API key saved successfully!" : "API anahtarı başarıyla kaydedildi!"}');
		}
		
		function testConnectionFromStep2() {
			const testButton = document.getElementById('testConnectionStep2Button');
			const testResult = document.getElementById('step2TestResult');
			
			if (!selectedModel) {
				testResult.style.display = 'block';
				testResult.className = 'test-result alert alert-warning';
				testResult.textContent = '${isEnglish ? "Please select a model first." : "Lütfen önce bir model seçin."}';
				announceToScreenReader('${isEnglish ? "Please select a model first." : "Lütfen önce bir model seçin."}');
				return;
			}
			
			testButton.innerHTML = '<span class="loading"></span> ${isEnglish ? "Testing..." : "Test ediliyor..."}';
			testButton.disabled = true;
			
			vscode.postMessage({
				command: 'testConnection'
			});
			
			// Result will be handled by message listener
		}
		
		function selectModel(model, provider) {
			// Unavailable modelleri seçilemez yap
			const modelCard = document.querySelector(\`[data-model="\${model}"]\`);
			if (modelCard && modelCard.classList.contains('unavailable')) {
				showAlert('${localization.getString("wizard.model.unavailable.message") || "This model is not available. Please check your subscription or try another model."}', 'warning');
				return;
			}
			
			selectedModel = model;
			
			// UI güncellemesi
			document.querySelectorAll('.model-card').forEach(card => {
				card.classList.remove('selected');
			});
			modelCard.classList.add('selected');
			
			// Submit butonunu etkinleştir
			document.getElementById('submitStep2').disabled = false;
			
			// Modeli kaydet
			vscode.postMessage({
				command: 'setupModel',
				model: model,
				provider: provider
			});
		}
		
		function submitStep(step) {
			// Her adımda submit işlemi yap ve sonra nextStep çağır
			switch(step) {
				case 1:
					if (!selectedProvider) {
						showAlert('${isEnglish ? "Please select an AI provider first." : "Lütfen önce bir AI sağlayıcısı seçin."}', 'warning');
						return;
					}
					break;
				case 2:
					if (!selectedModel) {
						showAlert('${isEnglish ? "Please select an AI model first." : "Lütfen önce bir AI modeli seçin."}', 'warning');
						return;
					}
					break;
				case 3:
					// Interface ayarları doğrulama
					const wcagLevel = document.getElementById('wcagLevel').value;
					const language = document.getElementById('responseLanguage').value;
					
					vscode.postMessage({
						command: 'setupWcagLevel',
						level: wcagLevel
					});
					
					vscode.postMessage({
						command: 'setupLanguage',
						language: language
					});
					break;
				case 4:
					// API konfigürasyonu kontrolü
					if (selectedProvider === 'gemini') {
						const apiKey = document.getElementById('geminiApiKey').value;
						if (!apiKey || apiKey.trim().length < 20) {
							showAlert('${isEnglish ? "Please enter a valid API key." : "Lütfen geçerli bir API anahtarı girin."}', 'danger');
							return;
						}
						
						vscode.postMessage({
							command: 'setupApiKey',
							apiKey: apiKey
						});
					}
					break;
				case 5:
					// Jira konfigürasyonu
					const jiraConfig = {
						customPrompt: document.getElementById('jiraCustomPrompt').value || '',
						useCustomPrompt: document.getElementById('useCustomPrompt').checked || false,
						defaultPriority: document.getElementById('defaultPriority').value || 'Medium',
						defaultComponent: document.getElementById('defaultComponent').value || 'other',
						includeCodeExamples: document.getElementById('includeCodeExamples').checked !== false,
						includeTestingSteps: document.getElementById('includeTestingSteps').checked !== false
					};
					
					vscode.postMessage({
						command: 'setupJiraConfig',
						config: jiraConfig
					});
					break;
			}
			
			// Adımı tamamlandı olarak işaretle
			if (!completedSteps.includes(step)) {
				completedSteps.push(step);
			}
			
			// Submit işlemi başarılı, sonraki adıma geç
			nextStep();
		}
		
		function nextStep() {
			if (currentStep < 6) {
				currentStep++;
				updateStepDisplay();
				focusCurrentStep();
				announceToScreenReader(\`Adım \${currentStep}'ye geçildi\`);
			}
		}
		
		function skipJiraConfig() {
			// Varsayılan Jira konfigürasyonu ile atla
			const defaultJiraConfig = {
				customPrompt: '',
				useCustomPrompt: false,
				defaultPriority: 'Medium',
				defaultComponent: 'other',
				includeCodeExamples: true,
				includeTestingSteps: true
			};
			
			vscode.postMessage({
				command: 'setupJiraConfig',
				config: defaultJiraConfig
			});
			
			// Sonraki adıma geç
			nextStep();
		}
		
		function prevStep() {
			if (currentStep > 1) {
				currentStep--;
				updateStepDisplay();
				focusCurrentStep();
				announceToScreenReader(\`Adım \${currentStep}'ye geri dönüldü\`);
			}
		}
		
		function updateStepDisplay() {
			// Adım göstergelerini güncelle
			document.querySelectorAll('.step').forEach((step, index) => {
				const stepNumber = index + 1;
				step.classList.remove('active', 'completed');
				step.setAttribute('tabindex', '-1');
				
				if (stepNumber === currentStep) {
					step.classList.add('active');
					step.setAttribute('tabindex', '0');
					step.setAttribute('aria-current', 'step');
				} else {
					step.removeAttribute('aria-current');
					if (completedSteps.includes(stepNumber)) {
						step.classList.add('completed');
						step.setAttribute('tabindex', '0'); // Tamamlanan adımlar tıklanabilir
					}
				}
			});
			
			// İçerik panellerini güncelle
			document.querySelectorAll('.step-content').forEach((content, index) => {
				const stepNumber = index + 1;
				content.classList.remove('active');
				content.setAttribute('aria-hidden', 'true');
				
				if (stepNumber === currentStep) {
					content.classList.add('active');
					content.setAttribute('aria-hidden', 'false');
				}
			});
			
			// Provider seçimi yapıldıysa modelleri ve API config'i göster
			if (selectedProvider) {
				showModelsForProvider(selectedProvider);
				showApiConfigForProvider(selectedProvider);
			}
		}
		
		function showModelsForProvider(provider) {
			document.getElementById('geminiModels').style.display = provider === 'gemini' ? 'grid' : 'none';
			document.getElementById('copilotModels').style.display = provider === 'vscode-copilot' ? 'grid' : 'none';
		}
		
		function showApiConfigForProvider(provider) {
			document.getElementById('geminiApiConfig').style.display = provider === 'gemini' ? 'block' : 'none';
			document.getElementById('copilotApiConfig').style.display = provider === 'vscode-copilot' ? 'block' : 'none';
		}
		
		
		function testConnection() {
			const testButton = document.getElementById('testButton');
			const testResult = document.getElementById('testResult');
			
			testButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.test.testing")}';
			testButton.disabled = true;
			
			vscode.postMessage({
				command: 'testConnection'
			});
		}
		
		function testApiKey() {
			const apiKey = document.getElementById('geminiApiKey').value;
			const testButton = document.getElementById('testApiButton');
			const testResult = document.getElementById('apiTestResult');
			
			if (!apiKey || apiKey.trim().length < 20) {
				showAlert('${localization.getString("wizard.api.key.validation") || "Please enter a valid API key."}', 'danger');
				return;
			}
			
			testButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.test.testing")}';
			testButton.disabled = true;
			
			// API anahtarını kaydet
			vscode.postMessage({
				command: 'setupApiKey',
				apiKey: apiKey
			});
			
			// Sonra testi çalıştır
			setTimeout(() => {
				vscode.postMessage({
					command: 'testConnection'
				});
			}, 500);
		}
		
		function testCopilotConnection() {
			const testButton = document.getElementById('testCopilotButton');
			const testResult = document.getElementById('apiTestResult');
			
			testButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.test.testing")}';
			testButton.disabled = true;
			
			vscode.postMessage({
				command: 'testConnection'
			});
		}
		
		function refreshModels() {
			const refreshButton = document.getElementById('refreshModelsButton');
			if (!refreshButton) return;
			
			refreshButton.innerHTML = '<span class="loading"></span> ${localization.getString("wizard.model.refreshing") || "Refreshing..."}';
			refreshButton.disabled = true;
			
			vscode.postMessage({
				command: 'refreshModels'
			});
		}
		
		function finishWizard() {
			vscode.postMessage({
				command: 'finishWizard'
			});
		}
		
		function openSettings() {
			vscode.postMessage({
				command: 'openSettings'
			});
		}
		
		function openExternal(url) {
			vscode.postMessage({
				command: 'openExternal',
				url: url
			});
		}
		
		function openGeminiApiPage() {
			openExternal('https://makersuite.google.com/app/apikey');
		}
		
		function tryCommand(commandId) {
			vscode.postMessage({
				command: 'tryCommand',
				commandId: commandId
			});
		}
		
		function showAlert(message, type) {
			const alertDiv = document.createElement('div');
			alertDiv.className = \`alert alert-\${type}\`;
			alertDiv.textContent = message;
			
			const container = document.querySelector('.step-content.active');
			container.insertBefore(alertDiv, container.firstChild);
			
			setTimeout(() => {
				alertDiv.remove();
			}, 5000);
		}
		
		// VS Code mesajlarını dinle
		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.command) {
				case 'loadCurrentSettings':
					// Mevcut ayarları wizard'a yükle
					loadExistingSettings(message.settings);
					break;
				case 'providerSetup':
					if (message.success && message.models) {
						// Provider seçildikten sonra modelleri güncelle
						updateModelGrids(message.models);
						showModelsForProvider(selectedProvider);
						showApiConfigForProvider(selectedProvider);
						announceToScreenReader(\`\${message.provider} sağlayıcısı seçildi ve modeller yüklendi\`);
					}
					break;
					
				case 'testResult':
					const testButton = document.getElementById('testButton');
					const testResult = document.getElementById('testResult');
					
					if (testButton) {
						testButton.innerHTML = '🧪 ${localization.getString("wizard.test.connection")}';
						testButton.disabled = false;
					}
					
					// API test butonlarını da güncelle
					const testApiButton = document.getElementById('testApiButton');
					const testCopilotButton = document.getElementById('testCopilotButton');
					const testStep2Button = document.getElementById('testConnectionStep2Button');
					
					if (testApiButton) {
						testApiButton.innerHTML = '🧪 ${localization.getString("wizard.button.test")}';
						testApiButton.disabled = false;
					}
					
					if (testCopilotButton) {
						testCopilotButton.innerHTML = '🧪 ${localization.getString("wizard.button.test")}';
						testCopilotButton.disabled = false;
					}
					
					// Step 2 test butonunu güncelle
					if (testStep2Button) {
						testStep2Button.innerHTML = '🔌 ${isEnglish ? "Test Connection" : "Bağlantıyı Test Et"}';
						testStep2Button.disabled = false;
					}
					
					// Test sonucunu göster - önce Step 2'deki sonuca bak
					const step2TestResult = document.getElementById('step2TestResult');
					const apiTestResult = document.getElementById('apiTestResult');
					const mainTestResult = document.getElementById('testResult');
					
					// Aktif step'e göre doğru result alanını göster
					if (currentStep === 2 && step2TestResult) {
						step2TestResult.style.display = 'block';
						step2TestResult.className = \`test-result alert \${message.success ? 'alert-success' : 'alert-danger'}\`;
						step2TestResult.textContent = message.message;
						announceToScreenReader(message.message);
					} else if (apiTestResult) {
						apiTestResult.style.display = 'block';
						apiTestResult.className = \`test-result alert \${message.success ? 'alert-success' : 'alert-danger'}\`;
						apiTestResult.textContent = message.message;
					} else if (mainTestResult) {
						mainTestResult.style.display = 'block';
						mainTestResult.className = \`test-result alert \${message.success ? 'alert-success' : 'alert-danger'}\`;
						mainTestResult.textContent = message.message;
					}
					break;
					
				case 'modelsRefreshed':
					const refreshButton = document.getElementById('refreshModelsButton');
					if (refreshButton) {
						refreshButton.innerHTML = '🔄 ${localization.getString("wizard.model.refresh") || "Refresh Models"}';
						refreshButton.disabled = false;
					}
					
					if (message.success && message.models) {
						// Model gridlerini güncelle
						updateModelGrids(message.models);
						const geminiCount = message.models.gemini?.length || 0;
						const copilotCount = message.models.copilot?.length || 0;
						const successMessage = '${localization.getString("wizard.model.refresh.success") || "Models refreshed successfully!"}';
						showAlert(successMessage, 'success');
						
						// Ekran okuyucu için detaylı duyuru
						const announcement = '${isEnglish ? "Models refreshed." : "Modeller yenilendi."} ' + 
							geminiCount + ' Gemini ${isEnglish ? "models" : "modeli"}, ' + 
							copilotCount + ' Copilot ${isEnglish ? "models loaded" : "modeli yüklendi"}.';
						announceToScreenReader(announcement, 'assertive');
					} else {
						showAlert('${localization.getString("wizard.model.refresh.failed") || "Failed to refresh models. Please try again."}', 'danger');
						announceToScreenReader('${isEnglish ? "Failed to refresh models. Please try again." : "Modeller yenilenemedi. Lütfen tekrar deneyin."}', 'assertive');
					}
					break;
					
				case 'apiKeySetup':
					if (message.success) {
						showAlert('${localization.getString("success.api.key.saved")}', 'success');
					} else {
						showAlert('${localization.getString("wizard.api.key.save.failed") || "API key could not be saved. Please try again."}', 'danger');
					}
					break;
					
				case 'jiraConfigSetup':
					if (message.success) {
						showAlert('Jira configuration saved successfully!', 'success');
					} else {
						showAlert('Failed to save Jira configuration. Please try again.', 'danger');
					}
					break;
			}
		});
		
		function updateModelGrids(models) {
			// Gemini modelleri güncelle
			const geminiGrid = document.getElementById('geminiModels');
			if (geminiGrid && models.gemini) {
				geminiGrid.innerHTML = models.gemini.map((model, index) => \`
					<div class="model-card \${model.recommended ? 'recommended' : ''}" 
						data-model="\${model.id}" 
						data-provider="gemini" 
						role="radio" 
						tabindex="0"
						aria-label="\${model.name}. \${model.description}. ${isEnglish ? "Speed" : "Hız"}: \${model.speed}, ${isEnglish ? "Quality" : "Kalite"}: \${model.quality}\${model.recommended ? '. ${isEnglish ? "Recommended" : "Önerilen"}' : ''}"
						aria-checked="false">
						<div class="model-name">\${model.name}</div>
						<div class="model-description">\${model.description}</div>
						<div class="model-badges" aria-hidden="true">
							<span class="badge speed-\${model.speed}">\${model.speed}</span>
							<span class="badge quality-\${model.quality}">\${model.quality}</span>
						</div>
					</div>
				\`).join('');
			}
			
			// Copilot modelleri güncelle
			const copilotGrid = document.getElementById('copilotModels');
			if (copilotGrid && models.copilot) {
				copilotGrid.innerHTML = models.copilot.map((model, index) => \`
					<div class="model-card \${model.recommended ? 'recommended' : ''} \${!model.available ? 'unavailable' : ''}" 
						data-model="\${model.id}" 
						data-provider="vscode-copilot" 
						role="radio" 
						tabindex="0"
						aria-label="\${model.name}. \${model.description}. ${isEnglish ? "Speed" : "Hız"}: \${model.speed}, ${isEnglish ? "Quality" : "Kalite"}: \${model.quality}\${model.recommended ? '. ${isEnglish ? "Recommended" : "Önerilen"}' : ''}\${!model.available ? '. ${isEnglish ? "Unavailable" : "Kullanılamıyor"}' : ''}"
						aria-checked="false"
						\${!model.available ? 'aria-disabled="true"' : ''}>
						<div class="model-name">\${model.name} \${!model.available ? '(${isEnglish ? "Unavailable" : "Kullanılamıyor"})' : ''}</div>
						<div class="model-description">\${model.description}</div>
						<div class="model-badges" aria-hidden="true">
							<span class="badge speed-\${model.speed}">\${model.speed}</span>
							<span class="badge quality-\${model.quality}">\${model.quality}</span>
							\${!model.available ? '<span class="badge unavailable">${isEnglish ? "Unavailable" : "Kullanılamıyor"}</span>' : ''}
						</div>
					</div>
				\`).join('');
			}
			
			// Event listener'ları yeniden ekle
			document.querySelectorAll('.model-card').forEach(card => {
				card.addEventListener('click', () => selectModel(card.dataset.model, card.dataset.provider));
				card.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						selectModel(card.dataset.model, card.dataset.provider);
					}
				});
			});
		}
		
		// Gelişmiş klavye navigasyonu
		document.addEventListener('keydown', (e) => {
			// Adım navigasyonu için ok tuşları
			if (e.key === 'ArrowLeft' && currentStep > 1 && !e.target.matches('input, select, textarea')) {
				e.preventDefault();
				prevStep();
			} else if (e.key === 'ArrowRight' && currentStep < 6 && !e.target.matches('input, select, textarea')) {
				e.preventDefault();
				nextStep();
			}
			
			// Escape tuşu ile sihirbazı kapat
			if (e.key === 'Escape') {
				const confirmed = confirm('Are you sure you want to exit the setup wizard?');
				if (confirmed) {
					window.close();
				}
			}
			
			// Tab trapping için (modal davranışı)
			if (e.key === 'Tab') {
				const focusableElements = document.querySelectorAll(
					'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
				);
				const firstElement = focusableElements[0];
				const lastElement = focusableElements[focusableElements.length - 1];
				
				if (e.shiftKey && document.activeElement === firstElement) {
					e.preventDefault();
					lastElement.focus();
				} else if (!e.shiftKey && document.activeElement === lastElement) {
					e.preventDefault();
					firstElement.focus();
				}
			}
		});
		
		// Mevcut ayarları yükle
		function loadExistingSettings(settings) {
			console.log('Loading existing settings:', settings);
			
			// Eğer ayarlar mevcutsa wizard'ı doldur
			if (settings.isProviderConfigured && settings.provider) {
				selectedProvider = settings.provider;
				
				// Provider kartını seçili göster
				document.querySelectorAll('.provider-card').forEach(card => {
					if (card.dataset.provider === settings.provider) {
						card.classList.add('selected');
						card.setAttribute('aria-selected', 'true');
					}
				});
				
				// Provider'a göre model ve API bölümlerini göster
				showModelsForProvider(settings.provider);
				showApiConfigForProvider(settings.provider);
			}

			if (settings.isModelConfigured && settings.model) {
				selectedModel = settings.model;
				
				// Model kartını seçili göster (modeller yüklendikten sonra)
				setTimeout(() => {
					document.querySelectorAll('.model-card').forEach(card => {
						if (card.dataset.model === settings.model) {
							card.classList.add('selected');
							card.setAttribute('aria-selected', 'true');
						}
					});
				}, 500);
			}

			if (settings.isApiKeyConfigured) {
				// API key alanını doldur (güvenlik için gizli)
				const apiKeyInput = document.getElementById('geminiApiKey');
				if (apiKeyInput && settings.provider === 'gemini') {
					if (settings.apiKey === "***CONFIGURED***") {
						apiKeyInput.placeholder = "${isEnglish ? "API Key configured (hidden for security)" : "API Anahtarı yapılandırıldı (güvenlik için gizli)"}";
						apiKeyInput.style.backgroundColor = 'var(--vscode-input-placeholderForeground)';
					}
				}
			}

			// WCAG seviyesi seç
			if (settings.wcagLevel) {
				const wcagSelect = document.getElementById('wcagLevel');
				if (wcagSelect) {
					wcagSelect.value = settings.wcagLevel;
				}
			}

			// Dil seç
			if (settings.language) {
				const languageSelect = document.getElementById('language');
				if (languageSelect) {
					languageSelect.value = settings.language;
				}
			}

			// Eğer tamamen yapılandırılmışsa, adım göstergelerini güncelle
			if (settings.isFullyConfigured) {
				completedSteps = [1, 2, 3, 4, 5];
				updateStepIndicators();
				
				announceToScreenReader("${isEnglish ? "Previous settings loaded. You can review or modify your configuration." : "Önceki ayarlar yüklendi. Yapılandırmanızı gözden geçirebilir veya değiştirebilirsiniz."}");
			} else {
				announceToScreenReader("${isEnglish ? "Some settings loaded. Please complete the remaining configuration." : "Bazı ayarlar yüklendi. Lütfen kalan yapılandırmayı tamamlayın."}");
			}
		}
		
		// ARIA live region'lar için yardımcı fonksiyon
		function announceToScreenReader(message, priority = 'polite') {
			const announcement = document.createElement('div');
			announcement.setAttribute('aria-live', priority);
			announcement.setAttribute('aria-atomic', 'true');
			announcement.className = 'screen-reader-only';
			announcement.textContent = message;
			
			document.body.appendChild(announcement);
			
			setTimeout(() => {
				document.body.removeChild(announcement);
			}, 1000);
		}
		
		// Erişilebilirlik: Gelişmiş Focus management
		function focusCurrentStep() {
			const activeStep = document.querySelector('.step-content.active');
			if (activeStep) {
				// Önce başlığa odaklan ki kullanıcı hangi adımda olduğunu bilsin
				const stepTitle = activeStep.querySelector('.step-title');
				if (stepTitle) {
					stepTitle.setAttribute('tabindex', '-1');
					stepTitle.focus();
					
					// Sonra ilk etkileşimli elemana geç
					setTimeout(() => {
						const focusable = activeStep.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])');
						if (focusable) {
							focusable.focus();
						}
					}, 100);
				}
			}
		}
		
		// Form doğrulama ile erişilebilirlik
		function validateStep(stepNumber) {
			const currentContent = document.querySelector(\`.step-content[data-step="\${stepNumber}"]\`);
			if (!currentContent) return true;
			
			const requiredFields = currentContent.querySelectorAll('[aria-required="true"], [required]');
			let isValid = true;
			
			requiredFields.forEach(field => {
				if (!field.value || field.value.trim() === '') {
					field.setAttribute('aria-invalid', 'true');
					field.focus();
					announceToScreenReader(\`\${field.labels[0]?.textContent || 'Field'} is required\`, 'assertive');
					isValid = false;
				} else {
					field.setAttribute('aria-invalid', 'false');
				}
			});
			
			return isValid;
		}
		
		// İlk yükleme
		document.addEventListener('DOMContentLoaded', () => {
			focusCurrentStep();
		});
	</script>
</body>
</html>
		`;
    }
    async getCurrentSettings() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        // AI provider ve model ayarları
        const aiConfig = config.get("ai") || {};
        const aiModelConfig = config.get("aiModels") || {};
        // Mevcut ayarları topla
        const currentSettings = {
            provider: aiConfig.provider || null,
            model: aiModelConfig.selectedModel || null,
            apiKey: aiConfig.apiKey ? "***CONFIGURED***" : null,
            wcagLevel: config.get("wcagLevel") || "AA",
            language: config.get("language") || "auto",
            jira: config.get("jira") || {},
            wizardCompleted: config.get("wizardCompleted") || false,
            // Ayarların yapılandırılma durumu
            isProviderConfigured: !!(aiConfig.provider),
            isModelConfigured: !!(aiModelConfig.selectedModel),
            isApiKeyConfigured: !!(aiConfig.apiKey),
            isFullyConfigured: !!(aiConfig.provider && aiModelConfig.selectedModel && aiConfig.apiKey)
        };
        logger_1.logger.info("Mevcut wizard ayarları yüklendi:", currentSettings);
        return currentSettings;
    }
}
exports.WizardManager = WizardManager;
//# sourceMappingURL=wizardManager.js.map