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
exports.PersistentSettingsManager = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./logger");
const accessiMindJsonManager_1 = require("./accessiMindJsonManager");
/**
 * VS Code extension ayarlarının kalıcı olarak saklanması için gelişmiş ayar yöneticisi
 * Extension restart edildiğinde bile ayarların korunmasını sağlar
 */
class PersistentSettingsManager {
    constructor(context) {
        this.settingsCache = new Map();
        this.isInitialized = false;
        this.context = context;
        // JSON yöneticisini başlat
        this.jsonManager = accessiMindJsonManager_1.AccessiMindJsonManager.getInstance(context);
    }
    static getInstance(context) {
        if (!PersistentSettingsManager.instance && context) {
            PersistentSettingsManager.instance = new PersistentSettingsManager(context);
        }
        return PersistentSettingsManager.instance;
    }
    /**
     * Kalıcı ayar yöneticisini başlat
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Kaydedilmiş ayarları yükle
            await this.loadPersistedSettings();
            // Configuration değişikliklerini dinle
            this.setupConfigurationListener();
            // Workspace state ile VS Code configuration'ı senkronize et
            await this.syncWithWorkspaceConfiguration();
            this.isInitialized = true;
            logger_1.logger.info("🔧 PersistentSettingsManager başarıyla başlatıldı");
        }
        catch (error) {
            logger_1.logger.error("❌ PersistentSettingsManager başlatma hatası:", error);
        }
    }
    /**
     * Configuration değişikliklerini dinle ve kalıcı storage'a kaydet
     */
    setupConfigurationListener() {
        this.configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration("wcagEnhancer")) {
                await this.persistCurrentConfiguration();
                logger_1.logger.info("🔄 Ayar değişikliği algılandı ve kalıcı storage'a kaydedildi");
                if (this.jsonManager) {
                    await this.jsonManager.syncFromVSCodeConfiguration();
                    logger_1.logger.info("🔄 Ayar değişikliği JSON dosyasına da senkronize edildi");
                }
            }
        });
    }
    /**
     * Mevcut VS Code configuration'ını kalıcı storage'a kaydet
     */
    async persistCurrentConfiguration() {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const settingsToSave = {
                ai: config.get("ai", {}),
                aiModels: config.get("aiModels", {}),
                language: config.get("language", "en"),
                wcagLevel: config.get("wcagLevel", "AA"),
                autoApply: config.get("autoApply", false),
                includeComments: config.get("includeComments", true),
                enableStatistics: config.get("enableStatistics", true),
                customPrompt: config.get("customPrompt", ""),
                responseDetail: config.get("responseDetail", "summary"),
                interfacePreferences: config.get("interfacePreferences", {}),
                jira: config.get("jira", {}),
                wizardCompleted: config.get("wizardCompleted", false),
                shortcuts: {
                    analyzeOpenCode: config.get("shortcuts.analyzeOpenCode", "ctrl+alt+w"),
                    analyzeSelectedCode: config.get("shortcuts.analyzeSelectedCode", "ctrl+alt+shift+w"),
                    showInterface: config.get("shortcuts.showInterface", "ctrl+alt+u")
                }
            };
            // Global state'e kaydet
            await this.context.globalState.update("wcagEnhancer.persistedSettings", settingsToSave);
            // Workspace state'e de kaydet (workspace-specific ayarlar için)
            await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", settingsToSave);
            // Cache'i güncelle
            this.settingsCache.set("persistedSettings", settingsToSave);
            logger_1.logger.info("💾 Ayarlar kalıcı storage'a başarıyla kaydedildi");
        }
        catch (error) {
            logger_1.logger.error("❌ Ayarları kalıcı storage'a kaydetme hatası:", error);
        }
    }
    /**
     * Kalıcı storage'dan ayarları yükle
     */
    async loadPersistedSettings() {
        try {
            // Global state'den ayarları yükle
            const globalSettings = this.context.globalState.get("wcagEnhancer.persistedSettings");
            // Workspace state'den ayarları yükle
            const workspaceSettings = this.context.workspaceState.get("wcagEnhancer.workspaceSettings");
            // Mevcut ayarları kontrol et
            if (globalSettings || workspaceSettings) {
                // Workspace ayarları öncelik alır, sonra global ayarlar
                const settingsToRestore = { ...globalSettings, ...workspaceSettings };
                // Cache'i güncelle
                this.settingsCache.set("persistedSettings", settingsToRestore);
                logger_1.logger.info("📥 Kalıcı storage'dan ayarlar başarıyla yüklendi");
            }
            else {
                logger_1.logger.info("ℹ️ Kalıcı storage'da önceki ayar bulunamadı");
            }
        }
        catch (error) {
            logger_1.logger.error("❌ Kalıcı storage'dan ayar yükleme hatası:", error);
        }
    }
    /**
     * Kalıcı storage'daki ayarları VS Code configuration'a geri yükle
     */
    async restoreSettings() {
        try {
            const persistedSettings = this.settingsCache.get("persistedSettings") ||
                this.context.globalState.get("wcagEnhancer.persistedSettings");
            if (!persistedSettings) {
                logger_1.logger.info("ℹ️ Geri yüklenecek ayar bulunamadı");
                return;
            }
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            // Ayarları tek tek geri yükle
            const restorePromises = [
                this.updateConfigSafely(config, "ai", persistedSettings.ai),
                this.updateConfigSafely(config, "aiModels", persistedSettings.aiModels),
                this.updateConfigSafely(config, "language", persistedSettings.language),
                this.updateConfigSafely(config, "wcagLevel", persistedSettings.wcagLevel),
                this.updateConfigSafely(config, "autoApply", persistedSettings.autoApply),
                this.updateConfigSafely(config, "includeComments", persistedSettings.includeComments),
                this.updateConfigSafely(config, "enableStatistics", persistedSettings.enableStatistics),
                this.updateConfigSafely(config, "customPrompt", persistedSettings.customPrompt),
                this.updateConfigSafely(config, "responseDetail", persistedSettings.responseDetail),
                this.updateConfigSafely(config, "interfacePreferences", persistedSettings.interfacePreferences),
                this.updateConfigSafely(config, "jira", persistedSettings.jira),
                this.updateConfigSafely(config, "wizardCompleted", persistedSettings.wizardCompleted)
            ];
            // Shortcuts ayrı olarak güncelle
            if (persistedSettings.shortcuts) {
                restorePromises.push(this.updateConfigSafely(config, "shortcuts.analyzeOpenCode", persistedSettings.shortcuts.analyzeOpenCode), this.updateConfigSafely(config, "shortcuts.analyzeSelectedCode", persistedSettings.shortcuts.analyzeSelectedCode), this.updateConfigSafely(config, "shortcuts.showInterface", persistedSettings.shortcuts.showInterface));
            }
            await Promise.all(restorePromises);
            logger_1.logger.info("✅ Settings successfully restored");
            // Success message
            vscode.window.showInformationMessage("✅ AccessiMind settings successfully restored!");
        }
        catch (error) {
            logger_1.logger.error("❌ Settings restore error:", error);
            vscode.window.showErrorMessage("❌ Settings restore error: " + error);
        }
    }
    /**
     * Güvenli şekilde configuration güncelle
     */
    async updateConfigSafely(config, key, value) {
        if (value !== undefined && value !== null) {
            try {
                await config.update(key, value, vscode.ConfigurationTarget.Global);
            }
            catch (error) {
                logger_1.logger.error(`❌ ${key} ayarı güncellenirken hata:`, error);
            }
        }
    }
    /**
     * Workspace configuration ile senkronize et
     */
    async syncWithWorkspaceConfiguration() {
        try {
            const persistedSettings = this.settingsCache.get("persistedSettings");
            if (persistedSettings) {
                const config = vscode.workspace.getConfiguration("wcagEnhancer");
                // Mevcut ayarlarla karşılaştır ve gerekirse güncelle
                const currentSettings = {
                    ai: config.get("ai", {}),
                    aiModels: config.get("aiModels", {}),
                    language: config.get("language", "en"),
                    wcagLevel: config.get("wcagLevel", "AA"),
                    wizardCompleted: config.get("wizardCompleted", false)
                };
                // Önemli ayarlar eksik ise geri yükle
                if (!currentSettings.ai || Object.keys(currentSettings.ai).length === 0) {
                    if (persistedSettings.ai && Object.keys(persistedSettings.ai).length > 0) {
                        await config.update("ai", persistedSettings.ai, vscode.ConfigurationTarget.Global);
                        logger_1.logger.info("🔄 AI ayarları senkronize edildi");
                    }
                }
                if (!currentSettings.aiModels || Object.keys(currentSettings.aiModels).length === 0) {
                    if (persistedSettings.aiModels && Object.keys(persistedSettings.aiModels).length > 0) {
                        await config.update("aiModels", persistedSettings.aiModels, vscode.ConfigurationTarget.Global);
                        logger_1.logger.info("🔄 AI model ayarları senkronize edildi");
                    }
                }
                // Wizard tamamlanma durumunu da kontrol et
                if (!currentSettings.wizardCompleted && persistedSettings.wizardCompleted) {
                    await config.update("wizardCompleted", persistedSettings.wizardCompleted, vscode.ConfigurationTarget.Global);
                    logger_1.logger.info("🔄 Wizard tamamlanma durumu senkronize edildi");
                }
                // Dil ayarını da senkronize et
                if (currentSettings.language === "en" && persistedSettings.language && persistedSettings.language !== "en") {
                    await config.update("language", persistedSettings.language, vscode.ConfigurationTarget.Global);
                    logger_1.logger.info("🔄 Dil ayarları senkronize edildi");
                }
                // WCAG seviyesini de senkronize et
                if (currentSettings.wcagLevel === "AA" && persistedSettings.wcagLevel && persistedSettings.wcagLevel !== "AA") {
                    await config.update("wcagLevel", persistedSettings.wcagLevel, vscode.ConfigurationTarget.Global);
                    logger_1.logger.info("🔄 WCAG seviyesi senkronize edildi");
                }
            }
        }
        catch (error) {
            logger_1.logger.error("❌ Workspace configuration senkronizasyon hatası:", error);
        }
    }
    /**
     * Belirli bir ayarı kalıcı storage'a kaydet
     */
    async persistSetting(key, value) {
        try {
            const currentSettings = this.settingsCache.get("persistedSettings") || {};
            currentSettings[key] = value;
            await this.context.globalState.update("wcagEnhancer.persistedSettings", currentSettings);
            await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", currentSettings);
            this.settingsCache.set("persistedSettings", currentSettings);
            logger_1.logger.info(`💾 ${key} ayarı kalıcı storage'a kaydedildi`);
        }
        catch (error) {
            logger_1.logger.error(`❌ ${key} ayarını kalıcı storage'a kaydetme hatası:`, error);
        }
    }
    /**
     * Belirli bir ayarı kalıcı storage'dan al
     */
    getPersistedSetting(key, defaultValue) {
        const settings = this.settingsCache.get("persistedSettings") ||
            this.context.globalState.get("wcagEnhancer.persistedSettings") || {};
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }
    /**
     * Tüm kalıcı ayarları temizle
     */
    async clearPersistedSettings() {
        try {
            await this.context.globalState.update("wcagEnhancer.persistedSettings", undefined);
            await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", undefined);
            this.settingsCache.clear();
            logger_1.logger.info("🗑️ All persistent settings cleared");
            vscode.window.showInformationMessage("🗑️ AccessiMind persistent settings cleared");
        }
        catch (error) {
            logger_1.logger.error("❌ Persistent settings clear error:", error);
        }
    }
    /**
     * Kalıcı ayarları dışa aktar
     */
    async exportPersistedSettings() {
        try {
            const settings = this.settingsCache.get("persistedSettings") ||
                this.context.globalState.get("wcagEnhancer.persistedSettings");
            if (!settings) {
                vscode.window.showWarningMessage("⚠️ No persistent settings found to export");
                return;
            }
            const jsonContent = JSON.stringify(settings, null, 2);
            const timestamp = new Date().toISOString().split("T")[0];
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    "JSON Files": ["json"]
                },
                defaultUri: vscode.Uri.file(`accessimind-settings-${timestamp}.json`)
            });
            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, "utf8"));
                vscode.window.showInformationMessage("✅ AccessiMind settings successfully exported!");
            }
        }
        catch (error) {
            logger_1.logger.error("❌ Settings export error:", error);
            vscode.window.showErrorMessage("❌ Settings export error: " + error);
        }
    }
    /**
     * Kalıcı ayarları içe aktar
     */
    async importPersistedSettings() {
        try {
            const uri = await vscode.window.showOpenDialog({
                filters: {
                    "JSON Files": ["json"]
                },
                canSelectMany: false,
                openLabel: "Import AccessiMind Settings"
            });
            if (uri && uri[0]) {
                const fileContent = await vscode.workspace.fs.readFile(uri[0]);
                const settings = JSON.parse(fileContent.toString());
                // Kalıcı storage'a kaydet
                await this.context.globalState.update("wcagEnhancer.persistedSettings", settings);
                await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", settings);
                this.settingsCache.set("persistedSettings", settings);
                // VS Code configuration'a uygula
                await this.restoreSettings();
                vscode.window.showInformationMessage("✅ AccessiMind settings successfully imported and applied!");
            }
        }
        catch (error) {
            logger_1.logger.error("❌ Settings import error:", error);
            vscode.window.showErrorMessage("❌ Settings import error: " + error);
        }
    }
    /**
     * Mevcut durumu raporla
     */
    getSettingsStatus() {
        const globalSettings = this.context.globalState.get("wcagEnhancer.persistedSettings") || {};
        const workspaceSettings = this.context.workspaceState.get("wcagEnhancer.workspaceSettings") || {};
        const cachedSettings = this.settingsCache.get("persistedSettings") || {};
        return {
            hasPersistedSettings: Object.keys(globalSettings).length > 0 || Object.keys(workspaceSettings).length > 0,
            globalSettingsCount: Object.keys(globalSettings).length,
            workspaceSettingsCount: Object.keys(workspaceSettings).length,
            cacheSize: Object.keys(cachedSettings).length
        };
    }
    /**
     * Resource'ları temizle
     */
    dispose() {
        if (this.configChangeListener) {
            this.configChangeListener.dispose();
            this.configChangeListener = undefined;
        }
        this.settingsCache.clear();
        logger_1.logger.info("🔄 PersistentSettingsManager temizlendi");
    }
}
exports.PersistentSettingsManager = PersistentSettingsManager;
//# sourceMappingURL=persistentSettingsManager.js.map