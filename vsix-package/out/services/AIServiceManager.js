"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIServiceManager = void 0;
const vscode = require("vscode");
const GeminiService_1 = require("./GeminiService");
const CopilotService_1 = require("./CopilotService");
class AIServiceManager {
    constructor(settingsManager) {
        this.settingsManager = settingsManager;
        this.geminiService = new GeminiService_1.GeminiService(settingsManager);
        this.copilotService = new CopilotService_1.CopilotService(settingsManager);
    }
    async initialize() {
        const settings = await this.settingsManager.getAIProviderSettings();
        if (!settings) {
            return false;
        }
        switch (settings.provider) {
            case 'gemini':
                this.currentService = this.geminiService;
                break;
            case 'copilot':
                this.currentService = this.copilotService;
                break;
            default:
                return false;
        }
        return await this.currentService.initialize();
    }
    async switchProvider(provider) {
        const settings = await this.settingsManager.getAIProviderSettings();
        if (!settings) {
            return false;
        }
        // Update settings
        settings.provider = provider;
        await this.settingsManager.setAIProviderSettings(settings);
        // Switch service
        switch (provider) {
            case 'gemini':
                this.currentService = this.geminiService;
                break;
            case 'copilot':
                this.currentService = this.copilotService;
                break;
            default:
                return false;
        }
        return await this.currentService.initialize();
    }
    async analyzeCode(code, filePath) {
        if (!this.currentService) {
            throw new Error('AI service not initialized');
        }
        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        return await this.currentService.analyzeCode(code, filePath, accessibilitySettings.detailLevel);
    }
    async improveCode(code, filePath, issues) {
        if (!this.currentService) {
            throw new Error('AI service not initialized');
        }
        return await this.currentService.improveCode(code, filePath, issues);
    }
    async endToEndImprovement(code, filePath) {
        if (!this.currentService) {
            throw new Error('AI service not initialized');
        }
        // Step 1: Analyze code
        const analysis = await this.analyzeCode(code, filePath);
        // Step 2: Improve code based on analysis
        const improvement = await this.improveCode(code, filePath, analysis.issues);
        // Step 3: Re-analyze improved code to verify improvements
        const finalAnalysis = await this.analyzeCode(improvement.improvedCode, filePath);
        return {
            analysis,
            improvement,
            finalCode: improvement.improvedCode
        };
    }
    async testConnection() {
        if (!this.currentService) {
            return false;
        }
        return await this.currentService.testConnection();
    }
    isConfigured() {
        return !!this.currentService && this.currentService.isConfigured();
    }
    getCurrentProvider() {
        if (!this.currentService) {
            return undefined;
        }
        if (this.currentService === this.geminiService) {
            return 'gemini';
        }
        else if (this.currentService === this.copilotService) {
            return 'copilot';
        }
        return undefined;
    }
    async getModelInfo() {
        if (!this.currentService) {
            return undefined;
        }
        if ('getModelInfo' in this.currentService) {
            return await this.currentService.getModelInfo();
        }
        return undefined;
    }
    async getAvailableProviders() {
        const geminiConfigured = await this.geminiService.initialize();
        const copilotConfigured = await this.copilotService.initialize();
        return [
            {
                provider: 'gemini',
                name: 'Google Gemini',
                available: true,
                configured: geminiConfigured
            },
            {
                provider: 'copilot',
                name: 'VS Code Copilot',
                available: !!vscode.extensions.getExtension('GitHub.copilot'),
                configured: copilotConfigured
            }
        ];
    }
    // Utility methods for error handling and logging
    async showProviderError(provider, error) {
        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        const message = accessibilitySettings.language === 'en'
            ? `Error with ${provider} provider: ${error.message}`
            : `${provider} sağlayıcısında hata: ${error.message}`;
        vscode.window.showErrorMessage(message);
    }
    async handleServiceError(error, context) {
        console.error(`AI Service error in ${context}:`, error);
        const provider = this.getCurrentProvider() || 'unknown';
        await this.showProviderError(provider, error);
        // Try to fallback to basic analysis if available
        if (provider === 'gemini' && this.copilotService.isConfigured()) {
            const fallbackMessage = 'Falling back to Copilot service...';
            vscode.window.showInformationMessage(fallbackMessage);
            await this.switchProvider('copilot');
        }
    }
}
exports.AIServiceManager = AIServiceManager;
//# sourceMappingURL=AIServiceManager.js.map