import * as vscode from "vscode";
import { logger } from "./logger";
import { AccessiMindJsonManager } from "./accessiMindJsonManager";
import { LocalizationManager } from "./localizationManager";

/**
 * VS Code extension ayarlarının kalıcı olarak saklanması için gelişmiş ayar yöneticisi
 * Extension restart edildiğinde bile ayarların korunmasını sağlar
 */
export class PersistentSettingsManager {
    private static instance: PersistentSettingsManager;
    private context: vscode.ExtensionContext;
    private configChangeListener: vscode.Disposable | undefined;
    private settingsCache: Map<string, any> = new Map();
    private isInitialized: boolean = false;
    private jsonManager: AccessiMindJsonManager | undefined;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // JSON yöneticisini başlat
        this.jsonManager = AccessiMindJsonManager.getInstance(context);
    }

    public static getInstance(context?: vscode.ExtensionContext): PersistentSettingsManager {
        if (!PersistentSettingsManager.instance && context) {
            PersistentSettingsManager.instance = new PersistentSettingsManager(context);
        }
        return PersistentSettingsManager.instance;
    }

    /**
     * Kalıcı ayar yöneticisini başlat
     */
    public async initialize(): Promise<void> {
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
            logger.info("🔧 PersistentSettingsManager başarıyla başlatıldı");
        } catch (error) {
            logger.error("❌ PersistentSettingsManager başlatma hatası:", error);
        }
    }

    /**
     * Configuration değişikliklerini dinle ve kalıcı storage'a kaydet
     */
    private setupConfigurationListener(): void {
        this.configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration("wcagEnhancer")) {
                await this.persistCurrentConfiguration();
                logger.info("🔄 Ayar değişikliği algılandı ve kalıcı storage'a kaydedildi");
                if (this.jsonManager) {
                    await this.jsonManager.syncFromVSCodeConfiguration();
                    logger.info("🔄 Ayar değişikliği JSON dosyasına da senkronize edildi");
                }
            }
        });
    }

    /**
     * Mevcut VS Code configuration'ını kalıcı storage'a kaydet
     */
    public async persistCurrentConfiguration(): Promise<void> {
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

            logger.info("💾 Ayarlar kalıcı storage'a başarıyla kaydedildi");
        } catch (error) {
            logger.error("❌ Ayarları kalıcı storage'a kaydetme hatası:", error);
        }
    }

    /**
     * Kalıcı storage'dan ayarları yükle
     */
    private async loadPersistedSettings(): Promise<void> {
        try {
            // Global state'den ayarları yükle
            const globalSettings = this.context.globalState.get("wcagEnhancer.persistedSettings") as any;

            // Workspace state'den ayarları yükle
            const workspaceSettings = this.context.workspaceState.get("wcagEnhancer.workspaceSettings") as any;

            // Mevcut ayarları kontrol et
            if (globalSettings || workspaceSettings) {
                // Workspace ayarları öncelik alır, sonra global ayarlar
                const settingsToRestore = { ...globalSettings, ...workspaceSettings };

                // Cache'i güncelle
                this.settingsCache.set("persistedSettings", settingsToRestore);

                logger.info("📥 Kalıcı storage'dan ayarlar başarıyla yüklendi");
            } else {
                logger.info("ℹ️ Kalıcı storage'da önceki ayar bulunamadı");
            }
        } catch (error) {
            logger.error("❌ Kalıcı storage'dan ayar yükleme hatası:", error);
        }
    }

    /**
     * Kalıcı storage'daki ayarları VS Code configuration'a geri yükle
     */
    public async restoreSettings(): Promise<void> {
        try {
            const persistedSettings = this.settingsCache.get("persistedSettings") ||
                this.context.globalState.get("wcagEnhancer.persistedSettings") as any;

            if (!persistedSettings) {
                logger.info("ℹ️ Geri yüklenecek ayar bulunamadı");
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
                restorePromises.push(
                    this.updateConfigSafely(config, "shortcuts.analyzeOpenCode", persistedSettings.shortcuts.analyzeOpenCode),
                    this.updateConfigSafely(config, "shortcuts.analyzeSelectedCode", persistedSettings.shortcuts.analyzeSelectedCode),
                    this.updateConfigSafely(config, "shortcuts.showInterface", persistedSettings.shortcuts.showInterface)
                );
            }

            await Promise.all(restorePromises);

            logger.info("✅ Settings successfully restored");

            const localization = LocalizationManager.getInstance();
            vscode.window.showInformationMessage(localization.getString("persistent.settings.restored"));

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error("❌ Settings restore error:", error);
            const localization = LocalizationManager.getInstance();
            vscode.window.showErrorMessage(
                localization.getStringWithParams("persistent.settings.error.restore", { error: errorMessage })
            );
        }
    }

    /**
     * Güvenli şekilde configuration güncelle
     */
    private async updateConfigSafely(config: vscode.WorkspaceConfiguration, key: string, value: any): Promise<void> {
        if (value !== undefined && value !== null) {
            try {
                await config.update(key, value, vscode.ConfigurationTarget.Global);
            } catch (error) {
                logger.error(`❌ ${key} ayarı güncellenirken hata:`, error);
            }
        }
    }

    /**
     * Workspace configuration ile senkronize et
     */
    private async syncWithWorkspaceConfiguration(): Promise<void> {
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
                        logger.info("🔄 AI ayarları senkronize edildi");
                    }
                }

                if (!currentSettings.aiModels || Object.keys(currentSettings.aiModels).length === 0) {
                    if (persistedSettings.aiModels && Object.keys(persistedSettings.aiModels).length > 0) {
                        await config.update("aiModels", persistedSettings.aiModels, vscode.ConfigurationTarget.Global);
                        logger.info("🔄 AI model ayarları senkronize edildi");
                    }
                }

                // Wizard tamamlanma durumunu da kontrol et
                if (!currentSettings.wizardCompleted && persistedSettings.wizardCompleted) {
                    await config.update("wizardCompleted", persistedSettings.wizardCompleted, vscode.ConfigurationTarget.Global);
                    logger.info("🔄 Wizard tamamlanma durumu senkronize edildi");
                }

                // Dil ayarını da senkronize et
                if (currentSettings.language === "en" && persistedSettings.language && persistedSettings.language !== "en") {
                    await config.update("language", persistedSettings.language, vscode.ConfigurationTarget.Global);
                    logger.info("🔄 Dil ayarları senkronize edildi");
                }

                // WCAG seviyesini de senkronize et
                if (currentSettings.wcagLevel === "AA" && persistedSettings.wcagLevel && persistedSettings.wcagLevel !== "AA") {
                    await config.update("wcagLevel", persistedSettings.wcagLevel, vscode.ConfigurationTarget.Global);
                    logger.info("🔄 WCAG seviyesi senkronize edildi");
                }
            }
        } catch (error) {
            logger.error("❌ Workspace configuration senkronizasyon hatası:", error);
        }
    }

    /**
     * Belirli bir ayarı kalıcı storage'a kaydet
     */
    public async persistSetting(key: string, value: any): Promise<void> {
        try {
            const currentSettings = this.settingsCache.get("persistedSettings") || {};
            currentSettings[key] = value;

            await this.context.globalState.update("wcagEnhancer.persistedSettings", currentSettings);
            await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", currentSettings);

            this.settingsCache.set("persistedSettings", currentSettings);

            logger.info(`💾 ${key} ayarı kalıcı storage'a kaydedildi`);
        } catch (error) {
            logger.error(`❌ ${key} ayarını kalıcı storage'a kaydetme hatası:`, error);
        }
    }

    /**
     * Belirli bir ayarı kalıcı storage'dan al
     */
    public getPersistedSetting(key: string, defaultValue?: any): any {
        const settings = this.settingsCache.get("persistedSettings") ||
            this.context.globalState.get("wcagEnhancer.persistedSettings") as any || {};

        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    /**
     * Tüm kalıcı ayarları temizle
     */
    public async clearPersistedSettings(): Promise<void> {
        try {
            await this.context.globalState.update("wcagEnhancer.persistedSettings", undefined);
            await this.context.workspaceState.update("wcagEnhancer.workspaceSettings", undefined);
            this.settingsCache.clear();

            logger.info("🗑️ All persistent settings cleared");
            const localization = LocalizationManager.getInstance();
            vscode.window.showInformationMessage(localization.getString("persistent.settings.cleared"));
        } catch (error) {
            logger.error("❌ Persistent settings clear error:", error);
        }
    }

    /**
     * Kalıcı ayarları dışa aktar
     */
    public async exportPersistedSettings(): Promise<void> {
        try {
            const settings = this.settingsCache.get("persistedSettings") ||
                this.context.globalState.get("wcagEnhancer.persistedSettings") as any;

            const localization = LocalizationManager.getInstance();

            if (!settings) {
                vscode.window.showWarningMessage(localization.getString("persistent.settings.no.data"));
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
                vscode.window.showInformationMessage(localization.getString("persistent.settings.exported"));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error("❌ Settings export error:", error);
            const localization = LocalizationManager.getInstance();
            vscode.window.showErrorMessage(
                localization.getStringWithParams("persistent.settings.error.export", { error: errorMessage })
            );
        }
    }

    /**
     * Kalıcı ayarları içe aktar
     */
    public async importPersistedSettings(): Promise<void> {
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

                const localization = LocalizationManager.getInstance();
                vscode.window.showInformationMessage(localization.getString("persistent.settings.imported"));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error("❌ Settings import error:", error);
            const localization = LocalizationManager.getInstance();
            vscode.window.showErrorMessage(
                localization.getStringWithParams("persistent.settings.error.import", { error: errorMessage })
            );
        }
    }

    /**
     * Mevcut durumu raporla
     */
    public getSettingsStatus(): {
        hasPersistedSettings: boolean;
        globalSettingsCount: number;
        workspaceSettingsCount: number;
        cacheSize: number;
    } {
        const globalSettings = this.context.globalState.get("wcagEnhancer.persistedSettings") as any || {};
        const workspaceSettings = this.context.workspaceState.get("wcagEnhancer.workspaceSettings") as any || {};
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
    public dispose(): void {
        if (this.configChangeListener) {
            this.configChangeListener.dispose();
            this.configChangeListener = undefined;
        }
        this.settingsCache.clear();
        logger.info("🔄 PersistentSettingsManager temizlendi");
    }
}