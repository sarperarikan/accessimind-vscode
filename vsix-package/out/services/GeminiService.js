"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const AIService_1 = require("./AIService");
class GeminiService extends AIService_1.AIService {
    constructor(settingsManager) {
        super(settingsManager);
    }
    async initialize() {
        const initialized = await super.initialize();
        if (!initialized || !this.settings) {
            return false;
        }
        try {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(this.settings.apiKey);
            const modelName = this.settings.model || 'gemini-2.0-flash-exp';
            this.model = this.genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 0.8,
                    maxOutputTokens: 4000,
                },
                safetySettings: [
                    {
                        category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                    },
                    {
                        category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                    }
                ]
            });
            return true;
        }
        catch (error) {
            console.error('Failed to initialize Gemini service:', error);
            return false;
        }
    }
    isConfigured() {
        return !!(this.settings && this.settings.provider === 'gemini' && this.settings.apiKey);
    }
    async testConnection() {
        if (!this.model) {
            return false;
        }
        try {
            const result = await this.model.generateContent('Test connection. Reply with "OK"');
            const response = result.response.text();
            return response.includes('OK');
        }
        catch (error) {
            console.error('Gemini connection test failed:', error);
            return false;
        }
    }
    async analyzeCode(code, filePath, detailLevel) {
        if (!this.model) {
            throw new Error('Gemini service not initialized');
        }
        const language = this.getLanguageFromFilePath(filePath);
        const prompt = this.buildPrompt(code, language, 'analyze', detailLevel);
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            // JSON yanıtı parse etmeye çalış
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid JSON response from Gemini');
            }
            const analysisResult = JSON.parse(jsonMatch[0]);
            // Validation and fallback
            return {
                issues: Array.isArray(analysisResult.issues) ? analysisResult.issues : [],
                summary: analysisResult.summary || 'Analysis completed',
                suggestions: Array.isArray(analysisResult.suggestions) ? analysisResult.suggestions : [],
                detailLevel: detailLevel
            };
        }
        catch (error) {
            console.error('Error analyzing code with Gemini:', error);
            // Fallback response
            return {
                issues: [],
                summary: 'Analysis failed. Please check your Gemini API configuration.',
                suggestions: [],
                detailLevel: detailLevel
            };
        }
    }
    async improveCode(code, filePath, issues) {
        if (!this.model) {
            throw new Error('Gemini service not initialized');
        }
        const language = this.getLanguageFromFilePath(filePath);
        let prompt = this.buildPrompt(code, language, 'improve', 'detailed');
        // Include specific issues if provided
        if (issues && issues.length > 0) {
            prompt += `\n\nPlease focus on fixing these specific issues:\n`;
            issues.forEach(issue => {
                prompt += `- Line ${issue.line}: ${issue.message} (${issue.rule})\n`;
            });
        }
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            // JSON yanıtı parse etmeye çalış
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid JSON response from Gemini');
            }
            const improvementResult = JSON.parse(jsonMatch[0]);
            return {
                originalCode: code,
                improvedCode: improvementResult.improvedCode || code,
                changes: Array.isArray(improvementResult.changes) ? improvementResult.changes : [],
                explanation: improvementResult.explanation || 'Code improvement completed'
            };
        }
        catch (error) {
            console.error('Error improving code with Gemini:', error);
            // Fallback response
            return {
                originalCode: code,
                improvedCode: code,
                changes: [],
                explanation: 'Code improvement failed. Please check your Gemini API configuration.'
            };
        }
    }
    // Gemini-specific helper methods
    async generateWithRetry(prompt, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await this.model.generateContent(prompt);
                return result.response.text();
            }
            catch (error) {
                console.warn(`Gemini API attempt ${i + 1} failed:`, error);
                if (i === maxRetries - 1)
                    throw error;
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
        throw new Error('Max retries exceeded');
    }
    async getModelInfo() {
        return {
            name: 'Gemini',
            version: this.settings?.model || 'gemini-2.0-flash-exp',
            capabilities: [
                'WCAG 2.2 Analysis',
                'Code Improvement',
                'Accessibility Suggestions',
                'Multi-language Support'
            ]
        };
    }
}
exports.GeminiService = GeminiService;
//# sourceMappingURL=GeminiService.js.map