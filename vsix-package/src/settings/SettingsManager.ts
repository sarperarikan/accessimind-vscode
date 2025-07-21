import * as vscode from 'vscode';

export interface AIProviderSettings {
    provider: 'gemini' | 'copilot';
    apiKey: string;
    model?: string;
    endpoint?: string;
}

export interface AccessibilitySettings {
    wcagLevel: 'A' | 'AA' | 'AAA';
    enableScreenReader: boolean;
    enableVoiceAnnouncements: boolean;
    enableKeyboardShortcuts: boolean;
    highContrastMode: boolean;
    detailLevel: 'basic' | 'detailed' | 'comprehensive';
    autoDetectIssues: boolean;
    language: 'en' | 'tr';
}

export interface UsageStats {
    totalAnalyzes: number;
    totalImprovements: number;
    lastUsed: Date;
    installDate: Date;
}

export class SettingsManager {
    private context: vscode.ExtensionContext;
    private readonly SETTINGS_KEY = 'accessimind.settings';
    private readonly STATS_KEY = 'accessimind.stats';
    private readonly FIRST_TIME_KEY = 'accessimind.firstTime';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    // İlk kurulum kontrolü
    async isFirstTimeSetup(): Promise<boolean> {
        const firstTime = this.context.globalState.get<boolean>(this.FIRST_TIME_KEY, true);
        return firstTime;
    }

    async setFirstTimeSetupComplete(): Promise<void> {
        await this.context.globalState.update(this.FIRST_TIME_KEY, false);
    }

    // AI Provider ayarları
    async getAIProviderSettings(): Promise<AIProviderSettings | undefined> {
        return this.context.globalState.get<AIProviderSettings>(`${this.SETTINGS_KEY}.aiProvider`);
    }

    async setAIProviderSettings(settings: AIProviderSettings): Promise<void> {
        await this.context.globalState.update(`${this.SETTINGS_KEY}.aiProvider`, settings);
        
        // İlk ayar yapıldığında first time setup'ı tamamla
        await this.setFirstTimeSetupComplete();
        
        // Ses bildirimi
        const accessibilitySettings = await this.getAccessibilitySettings();
        const message = accessibilitySettings.language === 'en' ?
            'AI provider settings saved' :
            'AI sağlayıcısı ayarları kaydedildi';
        this.announceToScreenReader(message);
    }

    async hasValidAISettings(): Promise<boolean> {
        const settings = await this.getAIProviderSettings();
        return !!(settings && settings.provider && settings.apiKey);
    }

    // Erişilebilirlik ayarları
    async getAccessibilitySettings(): Promise<AccessibilitySettings> {
        const defaultSettings: AccessibilitySettings = {
            wcagLevel: 'AA',
            enableScreenReader: true,
            enableVoiceAnnouncements: true,
            enableKeyboardShortcuts: true,
            highContrastMode: false,
            detailLevel: 'detailed',
            autoDetectIssues: true,
            language: 'en'
        };
        
        return this.context.globalState.get<AccessibilitySettings>(
            `${this.SETTINGS_KEY}.accessibility`,
            defaultSettings
        );
    }

    async setAccessibilitySettings(settings: AccessibilitySettings): Promise<void> {
        await this.context.globalState.update(`${this.SETTINGS_KEY}.accessibility`, settings);
        const message = settings.language === 'en' ?
            'Accessibility settings updated' :
            'Erişilebilirlik ayarları güncellendi';
        this.announceToScreenReader(message);
    }

    // Kullanım istatistikleri
    async getUsageStats(): Promise<UsageStats> {
        const defaultStats: UsageStats = {
            totalAnalyzes: 0,
            totalImprovements: 0,
            lastUsed: new Date(),
            installDate: new Date()
        };
        
        const stats = this.context.globalState.get<UsageStats>(this.STATS_KEY, defaultStats);
        
        // Date objelerini yeniden oluştur (JSON'dan geliyorlar)
        return {
            ...stats,
            lastUsed: new Date(stats.lastUsed),
            installDate: new Date(stats.installDate)
        };
    }

    async incrementUsageStats(type: 'analyze' | 'improve'): Promise<void> {
        const stats = await this.getUsageStats();
        
        if (type === 'analyze') {
            stats.totalAnalyzes++;
        } else if (type === 'improve') {
            stats.totalImprovements++;
        }
        
        stats.lastUsed = new Date();
        
        await this.context.globalState.update(this.STATS_KEY, stats);
    }

    // Tüm ayarları sıfırla
    async resetAllSettings(): Promise<void> {
        await this.context.globalState.update(`${this.SETTINGS_KEY}.aiProvider`, undefined);
        await this.context.globalState.update(`${this.SETTINGS_KEY}.accessibility`, undefined);
        await this.context.globalState.update(this.STATS_KEY, undefined);
        await this.context.globalState.update(this.FIRST_TIME_KEY, true);
        
        const accessibilitySettings = await this.getAccessibilitySettings();
        const message = accessibilitySettings.language === 'en' ?
            'All settings reset' :
            'Tüm ayarlar sıfırlandı';
        this.announceToScreenReader(message);
        
        const notification = accessibilitySettings.language === 'en' ?
            'All settings reset. Extension restarting...' :
            'Tüm ayarlar sıfırlandı. Extension yeniden başlatılıyor...';
        vscode.window.showInformationMessage(notification);
    }

    // Ayarları dışa aktar
    async exportSettings(): Promise<string> {
        const aiSettings = await this.getAIProviderSettings();
        const accessibilitySettings = await this.getAccessibilitySettings();
        const stats = await this.getUsageStats();
        
        const exportData = {
            aiProvider: aiSettings,
            accessibility: accessibilitySettings,
            stats: stats,
            exportDate: new Date().toISOString(),
            version: '0.3.2'
        };
        
        // API anahtarını güvenlik için maskeleme
        if (exportData.aiProvider) {
            exportData.aiProvider.apiKey = exportData.aiProvider.apiKey.replace(/.(?=.{4})/g, '*');
        }
        
        return JSON.stringify(exportData, null, 2);
    }

    // Ayarları içe aktar (API anahtarı hariç)
    async importSettings(settingsJson: string): Promise<boolean> {
        try {
            const importData = JSON.parse(settingsJson);
            
            if (importData.accessibility) {
                await this.setAccessibilitySettings(importData.accessibility);
            }
            
            // Stats'ı import et ama API key'i atla
            if (importData.stats) {
                await this.context.globalState.update(this.STATS_KEY, importData.stats);
            }
            
            const accessibilitySettings = await this.getAccessibilitySettings();
            const message = accessibilitySettings.language === 'en' ?
                'Settings imported successfully' :
                'Ayarlar başarıyla içe aktarıldı';
            this.announceToScreenReader(message);
            return true;
        } catch (error) {
            const errorMessage = (await this.getAccessibilitySettings()).language === 'en' ?
                'Error importing settings: ' + error :
                'Ayarlar içe aktarılırken hata oluştu: ' + error;
            vscode.window.showErrorMessage(errorMessage);
            return false;
        }
    }

    // Screen reader için ses bildirimi
    private async announceToScreenReader(message: string): Promise<void> {
        const accessibilitySettings = await this.getAccessibilitySettings();
        
        if (accessibilitySettings.enableVoiceAnnouncements) {
            // VS Code'un built-in accessibility API'sini kullan
            vscode.window.showInformationMessage(`🔊 ${message}`);
            
            // Console'a da yazdır screen reader'lar için
            console.log(`[AccessiMind Announcement]: ${message}`);
        }
    }

    // Klavye kısayolları durumunu kontrol et
    async areKeyboardShortcutsEnabled(): Promise<boolean> {
        const settings = await this.getAccessibilitySettings();
        return settings.enableKeyboardShortcuts;
    }

    // Debugging ve troubleshooting için
    async getDiagnosticInfo(): Promise<object> {
        return {
            hasAISettings: await this.hasValidAISettings(),
            isFirstTime: await this.isFirstTimeSetup(),
            accessibilitySettings: await this.getAccessibilitySettings(),
            stats: await this.getUsageStats(),
            storageKeys: this.context.globalState.keys(),
            extensionVersion: '0.4.0'
        };
    }
}