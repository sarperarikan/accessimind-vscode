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
exports.AccessiMindJsonManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
/**
 * AccessiMind ayarlarını JSON dosyasında yöneten sınıf
 * VS Code açılıp kapandığında ayarların kalıcılığını sağlar
 */
class AccessiMindJsonManager {
    constructor(context) {
        this.settings = null;
        this.isInitialized = false;
        this.context = context;
        // JSON dosyasını workspace root'a yerleştir
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
            path.dirname(context.extensionPath);
        this.jsonFilePath = path.join(workspaceRoot, "accessimind.json");
    }
    static getInstance(context) {
        if (!AccessiMindJsonManager.instance && context) {
            AccessiMindJsonManager.instance = new AccessiMindJsonManager(context);
        }
        return AccessiMindJsonManager.instance;
    }
    /**
     * JSON manager'ı başlat
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // JSON dosyasının varlığını kontrol et
            await this.checkJsonFileExists();
            // Settings'i yükle
            await this.loadSettings();
            // File watcher kurma
            this.setupFileWatcher();
            this.isInitialized = true;
            logger_1.logger.info(`🔧 AccessiMindJsonManager başarıyla başlatıldı: ${this.jsonFilePath}`);
        }
        catch (error) {
            logger_1.logger.error("❌ AccessiMindJsonManager başlatma hatası:", error);
            throw error;
        }
    }
    /**
     * JSON dosyasının varlığını kontrol et, yoksa oluştur
     */
    async checkJsonFileExists() {
        try {
            await fs.promises.access(this.jsonFilePath, fs.constants.F_OK);
            logger_1.logger.info(`📁 AccessiMind JSON dosyası mevcut: ${this.jsonFilePath}`);
        }
        catch (error) {
            // Dosya yoksa default ayarlarla oluştur
            logger_1.logger.info(`📁 AccessiMind JSON dosyası bulunamadı, oluşturuluyor: ${this.jsonFilePath}`);
            try {
                await this.createDefaultJsonFile();
            }
            catch (createError) {
                logger_1.logger.error("❌ JSON dosyası oluşturulamadı:", createError);
                // Workspace dışında bir yerde oluşturmayı dene
                await this.createFallbackJsonFile();
            }
        }
    }
    /**
     * Default JSON dosyasını oluştur
     */
    async createDefaultJsonFile() {
        const defaultSettings = {
            version: "1.0.0",
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            wizard: {
                completed: false,
                steps: {
                    provider: { completed: false },
                    model: { completed: false },
                    apiKey: { completed: false, hasValue: false },
                    wcagLevel: { completed: false },
                    language: { completed: false },
                    jiraConfig: { completed: false }
                }
            },
            settings: {
                ai: {
                    apiKeyConfigured: false
                },
                aiModels: {},
                language: "auto",
                wcagLevel: "AA",
                autoApply: false,
                includeComments: true,
                enableStatistics: true,
                responseDetail: "summary",
                interfacePreferences: {
                    theme: "auto",
                    compactMode: false,
                    showAdvancedOptions: false
                },
                shortcuts: {
                    analyzeOpenCode: "ctrl+alt+w",
                    analyzeSelectedCode: "ctrl+alt+shift+w",
                    showInterface: "ctrl+alt+u"
                }
            },
            statistics: {
                enabled: true,
                sessionCount: 0,
                totalAnalyses: 0,
                totalImprovements: 0
            },
            metadata: {
                extensionVersion: this.context.extension?.packageJSON?.version,
                vscodeVersion: vscode.version,
                platform: process.platform,
                workspaceId: vscode.workspace.workspaceFolders?.[0]?.uri.toString()
            }
        };
        await this.saveSettingsToFile(defaultSettings);
        this.settings = defaultSettings;
    }
    /**
     * JSON dosyasından ayarları yükle
     */
    async loadSettings() {
        try {
            const fileContent = await fs.promises.readFile(this.jsonFilePath, 'utf8');
            const parsedSettings = JSON.parse(fileContent);
            // Version kontrolü ve migration
            await this.migrateSettingsIfNeeded(parsedSettings);
            this.settings = parsedSettings;
            logger_1.logger.info("📥 AccessiMind ayarları JSON dosyasından başarıyla yüklendi");
            return this.settings;
        }
        catch (error) {
            logger_1.logger.error("❌ JSON dosyasından ayar yükleme hatası:", error);
            // Hatalı dosya varsa backup al ve yeniden oluştur
            try {
                await this.handleCorruptedFile();
                return await this.loadSettings();
            }
            catch (recoveryError) {
                logger_1.logger.error("❌ JSON dosyası kurtarma hatası:", recoveryError);
                // Son çare olarak default ayarlar döndür
                return await this.createInMemoryDefaults();
            }
        }
    }
    /**
     * Ayarları JSON dosyasına kaydet
     */
    async saveSettings(newSettings) {
        try {
            if (!this.settings) {
                await this.loadSettings();
            }
            // Mevcut ayarlarla merge et
            this.settings = this.mergeSettings(this.settings, newSettings);
            this.settings.lastModified = new Date().toISOString();
            await this.saveSettingsToFile(this.settings);
            logger_1.logger.info("💾 AccessiMind ayarları JSON dosyasına başarıyla kaydedildi");
        }
        catch (error) {
            logger_1.logger.error("❌ JSON dosyasına ayar kaydetme hatası:", error);
            throw error;
        }
    }
    /**
     * Wizard ayarlarını güncellle
     */
    async updateWizardSettings(wizardData) {
        const currentSettings = await this.getSettings();
        const updatedSettings = {
            wizard: {
                ...currentSettings.wizard,
                ...wizardData
            }
        };
        if (wizardData.completed) {
            updatedSettings.wizard.completedAt = new Date().toISOString();
        }
        await this.saveSettings(updatedSettings);
    }
    /**
     * Wizard step'ini güncelle
     */
    async updateWizardStep(stepName, stepData) {
        const currentSettings = await this.getSettings();
        const updatedSettings = {
            wizard: {
                ...currentSettings.wizard,
                steps: {
                    ...currentSettings.wizard.steps,
                    [stepName]: {
                        ...currentSettings.wizard.steps[stepName],
                        ...stepData,
                        completed: true
                    }
                }
            }
        };
        await this.saveSettings(updatedSettings);
    }
    /**
     * VS Code configuration'dan ayarları senkronize et
     */
    async syncFromVSCodeConfiguration() {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiConfig = config.get("ai") || {};
            const aiModelConfig = config.get("aiModels") || {};
            const updatedSettings = {
                settings: {
                    ai: {
                        provider: aiConfig.provider,
                        selectedModel: aiConfig.selectedModel,
                        apiKeyConfigured: !!(aiConfig.apiKey && aiConfig.apiKey.trim()),
                        autoTestOnChange: aiConfig.autoTestOnChange
                    },
                    aiModels: {
                        selectedModel: aiModelConfig.selectedModel || aiConfig.selectedModel,
                        availableModels: aiModelConfig.availableModels
                    },
                    language: config.get("language"),
                    wcagLevel: config.get("wcagLevel"),
                    autoApply: config.get("autoApply"),
                    includeComments: config.get("includeComments"),
                    enableStatistics: config.get("enableStatistics"),
                    customPrompt: config.get("customPrompt"),
                    responseDetail: config.get("responseDetail"),
                    interfacePreferences: config.get("interfacePreferences"),
                    jira: config.get("jira"),
                    shortcuts: {
                        analyzeOpenCode: config.get("shortcuts.analyzeOpenCode"),
                        analyzeSelectedCode: config.get("shortcuts.analyzeSelectedCode"),
                        showInterface: config.get("shortcuts.showInterface")
                    }
                }
            };
            await this.saveSettings(updatedSettings);
            logger_1.logger.info("🔄 VS Code configuration'dan JSON'a senkronizasyon tamamlandı");
        }
        catch (error) {
            logger_1.logger.error("❌ VS Code configuration senkronizasyon hatası:", error);
        }
    }
    /**
     * JSON'dan VS Code configuration'a ayarları uygula
     */
    async applyToVSCodeConfiguration() {
        try {
            const settings = await this.getSettings();
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            // Sadece değer olan ayarları uygula
            const updatePromises = [];
            if (settings.settings.ai?.provider) {
                const aiConfig = config.get("ai") || {};
                aiConfig.provider = settings.settings.ai.provider;
                if (settings.settings.ai.selectedModel) {
                    aiConfig.selectedModel = settings.settings.ai.selectedModel;
                }
                updatePromises.push(config.update("ai", aiConfig, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.aiModels?.selectedModel) {
                const aiModelConfig = config.get("aiModels") || {};
                aiModelConfig.selectedModel = settings.settings.aiModels.selectedModel;
                updatePromises.push(config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.language) {
                updatePromises.push(config.update("language", settings.settings.language, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.wcagLevel) {
                updatePromises.push(config.update("wcagLevel", settings.settings.wcagLevel, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.autoApply !== undefined) {
                updatePromises.push(config.update("autoApply", settings.settings.autoApply, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.includeComments !== undefined) {
                updatePromises.push(config.update("includeComments", settings.settings.includeComments, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.enableStatistics !== undefined) {
                updatePromises.push(config.update("enableStatistics", settings.settings.enableStatistics, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.customPrompt) {
                updatePromises.push(config.update("customPrompt", settings.settings.customPrompt, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.responseDetail) {
                updatePromises.push(config.update("responseDetail", settings.settings.responseDetail, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.interfacePreferences) {
                updatePromises.push(config.update("interfacePreferences", settings.settings.interfacePreferences, vscode.ConfigurationTarget.Global));
            }
            if (settings.settings.jira) {
                updatePromises.push(config.update("jira", settings.settings.jira, vscode.ConfigurationTarget.Global));
            }
            if (settings.wizard.completed) {
                updatePromises.push(config.update("wizardCompleted", true, vscode.ConfigurationTarget.Global));
            }
            await Promise.all(updatePromises);
            logger_1.logger.info("✅ JSON ayarları VS Code configuration'a başarıyla uygulandı");
            // Settings applied mesajını göster
            vscode.window.showInformationMessage("✅ AccessiMind settings have been applied!");
        }
        catch (error) {
            logger_1.logger.error("❌ JSON ayarlarını VS Code'a uygulama hatası:", error);
            vscode.window.showErrorMessage("❌ Ayarları uygularken hata oluştu: " + error);
        }
    }
    /**
     * Mevcut ayarları al
     */
    async getSettings() {
        if (!this.settings) {
            await this.loadSettings();
        }
        return this.settings;
    }
    /**
     * JSON dosyasını izle
     */
    setupFileWatcher() {
        const filePattern = new vscode.RelativePattern(path.dirname(this.jsonFilePath), path.basename(this.jsonFilePath));
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern);
        this.fileWatcher.onDidChange(async () => {
            logger_1.logger.info("🔄 AccessiMind JSON dosyası değişti, yeniden yükleniyor...");
            await this.loadSettings();
        });
        this.fileWatcher.onDidDelete(() => {
            logger_1.logger.warn("⚠️ AccessiMind JSON dosyası silindi!");
            vscode.window.showWarningMessage("⚠️ AccessiMind ayar dosyası silindi!");
        });
    }
    /**
     * İstatistikleri güncelle
     */
    async updateStatistics(stats) {
        const currentSettings = await this.getSettings();
        const updatedSettings = {
            statistics: {
                ...currentSettings.statistics,
                ...stats,
                lastUsed: new Date().toISOString()
            }
        };
        await this.saveSettings(updatedSettings);
    }
    /**
     * Settings merge utility
     */
    mergeSettings(current, updates) {
        return {
            ...current,
            ...updates,
            wizard: updates.wizard ? { ...current.wizard, ...updates.wizard } : current.wizard,
            settings: updates.settings ? { ...current.settings, ...updates.settings } : current.settings,
            statistics: updates.statistics ? { ...current.statistics, ...updates.statistics } : current.statistics,
            metadata: updates.metadata ? { ...current.metadata, ...updates.metadata } : current.metadata
        };
    }
    /**
     * Ayarları dosyaya kaydet
     */
    async saveSettingsToFile(settings) {
        const jsonContent = JSON.stringify(settings, null, 2);
        await fs.promises.writeFile(this.jsonFilePath, jsonContent, 'utf8');
    }
    /**
     * Version migration
     */
    async migrateSettingsIfNeeded(settings) {
        // Gelecekte version migration gerektiğinde buraya eklenecek
        if (!settings.version || settings.version !== "1.0.0") {
            logger_1.logger.info("🔄 AccessiMind settings migration işlemi başlatılıyor...");
            settings.version = "1.0.0";
            settings.lastModified = new Date().toISOString();
            await this.saveSettingsToFile(settings);
        }
    }
    /**
     * Bozuk dosyayı handle et
     */
    async handleCorruptedFile() {
        try {
            // Backup oluştur
            const backupPath = this.jsonFilePath + `.backup.${Date.now()}`;
            await fs.promises.copyFile(this.jsonFilePath, backupPath);
            logger_1.logger.info(`📁 Bozuk JSON dosyası yedeklendi: ${backupPath}`);
            // Yeni dosya oluştur
            await this.createDefaultJsonFile();
            vscode.window.showWarningMessage(`⚠️ AccessiMind ayar dosyası bozuktu ve yeniden oluşturuldu. Eski dosya şu konuma yedeklendi: ${backupPath}`);
        }
        catch (error) {
            logger_1.logger.error("❌ Bozuk dosya backup hatası:", error);
            throw error;
        }
    }
    /**
     * JSON dosya yolunu al
     */
    /**
     * Fallback JSON dosyası oluştur (workspace dışında)
     */
    async createFallbackJsonFile() {
        try {
            // Extension path'inde bir fallback oluştur
            const fallbackPath = path.join(this.context.globalStorageUri?.fsPath || this.context.extensionPath, "accessimind-fallback.json");
            // Directory oluştur
            const fallbackDir = path.dirname(fallbackPath);
            await fs.promises.mkdir(fallbackDir, { recursive: true });
            // Fallback JSON path'ini güncelle
            this.jsonFilePath = fallbackPath;
            // Default dosyayı oluştur
            await this.createDefaultJsonFile();
            logger_1.logger.warn(`⚠️ Workspace'de JSON oluşturulamadı, fallback konumu kullanılıyor: ${fallbackPath}`);
            vscode.window.showWarningMessage(`⚠️ AccessiMind ayar dosyası workspace'de oluşturulamadı. Geçici konum kullanılıyor: ${fallbackPath}`);
        }
        catch (error) {
            logger_1.logger.error("❌ Fallback JSON dosyası da oluşturulamadı:", error);
            throw new Error("JSON dosyası oluşturulamadı. Yazma izinlerini kontrol edin.");
        }
    }
    /**
     * In-memory default settings oluştur (son çare)
     */
    async createInMemoryDefaults() {
        logger_1.logger.warn("⚠️ JSON dosyası okunamadı, in-memory defaults kullanılıyor");
        const defaults = {
            version: "1.0.0",
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            wizard: {
                completed: false,
                steps: {
                    provider: { completed: false },
                    model: { completed: false },
                    apiKey: { completed: false, hasValue: false },
                    wcagLevel: { completed: false },
                    language: { completed: false },
                    jiraConfig: { completed: false }
                }
            },
            settings: {
                ai: { apiKeyConfigured: false },
                aiModels: {},
                language: "auto",
                wcagLevel: "AA",
                autoApply: false,
                includeComments: true,
                enableStatistics: true,
                responseDetail: "summary",
                interfacePreferences: {
                    theme: "auto",
                    compactMode: false,
                    showAdvancedOptions: false
                },
                shortcuts: {
                    analyzeOpenCode: "ctrl+alt+w",
                    analyzeSelectedCode: "ctrl+alt+shift+w",
                    showInterface: "ctrl+alt+u"
                }
            },
            statistics: {
                enabled: true,
                sessionCount: 0,
                totalAnalyses: 0,
                totalImprovements: 0
            },
            metadata: {
                extensionVersion: this.context.extension?.packageJSON?.version,
                vscodeVersion: vscode.version,
                platform: process.platform,
                workspaceId: "in-memory-fallback"
            }
        };
        this.settings = defaults;
        vscode.window.showWarningMessage("⚠️ AccessiMind settings file could not be read. Temporary settings will be used in this session.");
        return defaults;
    }
    /**
     * JSON dosya yolunu güvenli şekilde al
     */
    getJsonFilePath() {
        return this.jsonFilePath;
    }
    /**
     * JSON dosyasının sağlığını kontrol et
     */
    async validateJsonHealth() {
        const issues = [];
        try {
            // Dosya varlığını kontrol et
            await fs.promises.access(this.jsonFilePath, fs.constants.F_OK);
        }
        catch (error) {
            issues.push("Dosya bulunamadı");
            return { isHealthy: false, issues };
        }
        try {
            // Dosya okunabilirliğini kontrol et
            await fs.promises.access(this.jsonFilePath, fs.constants.R_OK);
        }
        catch (error) {
            issues.push("Dosya okunamıyor (izin sorunu)");
        }
        try {
            // Dosya yazılabilirliğini kontrol et
            await fs.promises.access(this.jsonFilePath, fs.constants.W_OK);
        }
        catch (error) {
            issues.push("Dosyaya yazılamıyor (izin sorunu)");
        }
        try {
            // JSON parse edilebilirliğini kontrol et
            const content = await fs.promises.readFile(this.jsonFilePath, 'utf8');
            JSON.parse(content);
        }
        catch (error) {
            issues.push("JSON formatı geçersiz");
        }
        return {
            isHealthy: issues.length === 0,
            issues
        };
    }
    /**
     * JSON dosyasını onar
     */
    async repairJsonFile() {
        try {
            const health = await this.validateJsonHealth();
            if (health.isHealthy) {
                logger_1.logger.info("✅ JSON dosyası sağlıklı, onarım gerekmiyor");
                return;
            }
            logger_1.logger.warn("🔧 JSON dosyası onarılıyor...", health.issues);
            // Backup oluştur
            try {
                const backupPath = this.jsonFilePath + `.repair-backup.${Date.now()}`;
                await fs.promises.copyFile(this.jsonFilePath, backupPath);
                logger_1.logger.info(`📁 Onarım öncesi backup oluşturuldu: ${backupPath}`);
            }
            catch (backupError) {
                logger_1.logger.warn("⚠️ Backup oluşturulamadı:", backupError);
            }
            // Yeni dosya oluştur
            await this.createDefaultJsonFile();
            vscode.window.showInformationMessage("🔧 AccessiMind JSON dosyası onarıldı!");
        }
        catch (error) {
            logger_1.logger.error("❌ JSON dosyası onarılamadı:", error);
            throw error;
        }
    }
    /**
     * Resource'ları temizle
     */
    dispose() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        logger_1.logger.info("🔄 AccessiMindJsonManager temizlendi");
    }
}
exports.AccessiMindJsonManager = AccessiMindJsonManager;
//# sourceMappingURL=accessiMindJsonManager.js.map