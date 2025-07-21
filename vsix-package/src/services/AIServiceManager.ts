import * as vscode from 'vscode';
import { SettingsManager, AIProviderSettings, AccessibilitySettings } from '../settings/SettingsManager';
import { AIService, CodeAnalysisResult, CodeImprovementResult, WCAGIssue } from './AIService';
import { GeminiService } from './GeminiService';
import { CopilotService } from './CopilotService';

export class AIServiceManager {
    private settingsManager: SettingsManager;
    private currentService?: AIService;
    private geminiService: GeminiService;
    private copilotService: CopilotService;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
        this.geminiService = new GeminiService(settingsManager);
        this.copilotService = new CopilotService(settingsManager);
    }

    async initialize(): Promise<boolean> {
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

    async switchProvider(provider: 'gemini' | 'copilot'): Promise<boolean> {
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

    async analyzeCode(code: string, filePath: string): Promise<CodeAnalysisResult> {
        if (!this.currentService) {
            throw new Error('AI service not initialized');
        }

        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        return await this.currentService.analyzeCode(code, filePath, accessibilitySettings.detailLevel);
    }

    async improveCode(code: string, filePath: string, issues?: WCAGIssue[]): Promise<CodeImprovementResult> {
        if (!this.currentService) {
            throw new Error('AI service not initialized');
        }

        return await this.currentService.improveCode(code, filePath, issues);
    }

    async endToEndImprovement(code: string, filePath: string): Promise<{
        analysis: CodeAnalysisResult;
        improvement: CodeImprovementResult;
        finalCode: string;
    }> {
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

    async testConnection(): Promise<boolean> {
        if (!this.currentService) {
            return false;
        }

        return await this.currentService.testConnection();
    }

    isConfigured(): boolean {
        return !!this.currentService && this.currentService.isConfigured();
    }

    getCurrentProvider(): string | undefined {
        if (!this.currentService) {
            return undefined;
        }

        if (this.currentService === this.geminiService) {
            return 'gemini';
        } else if (this.currentService === this.copilotService) {
            return 'copilot';
        }

        return undefined;
    }

    async getModelInfo(): Promise<{ name: string; version: string; capabilities: string[] } | undefined> {
        if (!this.currentService) {
            return undefined;
        }

        if ('getModelInfo' in this.currentService) {
            return await (this.currentService as any).getModelInfo();
        }

        return undefined;
    }

    async getAvailableProviders(): Promise<Array<{
        provider: string;
        name: string;
        available: boolean;
        configured: boolean;
    }>> {
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
    private async showProviderError(provider: string, error: any): Promise<void> {
        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        const message = accessibilitySettings.language === 'en' 
            ? `Error with ${provider} provider: ${error.message}`
            : `${provider} sağlayıcısında hata: ${error.message}`;
        
        vscode.window.showErrorMessage(message);
    }

    async handleServiceError(error: any, context: string): Promise<void> {
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