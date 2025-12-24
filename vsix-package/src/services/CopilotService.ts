import * as vscode from 'vscode';
import { AIService, CodeAnalysisResult, CodeImprovementResult, WCAGIssue } from './AIService';
import { SettingsManager } from '../settings/SettingsManager';

export class CopilotService extends AIService {
    private copilotAPI?: any;

    constructor(settingsManager: SettingsManager) {
        super(settingsManager);
    }

    async initialize(): Promise<boolean> {
        const initialized = await super.initialize();
        if (!initialized || !this.settings) {
            return false;
        }

        try {
            // VS Code Copilot API'sini kullan
            this.copilotAPI = await this.getCopilotAPI();
            return this.copilotAPI !== undefined;
        } catch (error) {
            console.error('Failed to initialize Copilot service:', error);
            return false;
        }
    }

    private async getCopilotAPI(): Promise<any> {
        try {
            // VS Code'un internal Copilot API'sine erişim
            const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
            if (!copilotExtension) {
                throw new Error('GitHub Copilot extension not found');
            }

            if (!copilotExtension.isActive) {
                await copilotExtension.activate();
            }

            // Copilot API'sine erişim (experimental)
            return copilotExtension.exports;
        } catch (error) {
            console.warn('Copilot API access failed, falling back to commands:', error);
            return null;
        }
    }

    isConfigured(): boolean {
        return !!(this.settings && this.settings.provider === 'copilot');
    }

    async testConnection(): Promise<boolean> {
        try {
            // Copilot extension'ının aktif olduğunu kontrol et
            const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
            return !!(copilotExtension && copilotExtension.isActive);
        } catch (error) {
            console.error('Copilot connection test failed:', error);
            return false;
        }
    }

    async analyzeCode(code: string, filePath: string, detailLevel: string): Promise<CodeAnalysisResult> {
        try {
            const language = this.getLanguageFromFilePath(filePath);
            const prompt = this.buildAccessibilityPrompt(code, language, 'analyze', detailLevel);
            
            const result = await this.requestCopilotCompletion(prompt, language);
            
            if (result) {
                return this.parseAnalysisResult(result, detailLevel);
            }
            
        } catch (error) {
            console.error('Error analyzing code with Copilot:', error);
        }

        // Fallback response
        return {
            issues: [],
            summary: 'Analysis completed using basic patterns. For advanced analysis, ensure Copilot is properly configured.',
            suggestions: this.getBasicAccessibilitySuggestions(code, filePath),
            detailLevel: detailLevel as 'basic' | 'detailed' | 'comprehensive'
        };
    }

    async improveCode(code: string, filePath: string, issues?: WCAGIssue[]): Promise<CodeImprovementResult> {
        try {
            const language = this.getLanguageFromFilePath(filePath);
            const prompt = this.buildAccessibilityPrompt(code, language, 'improve', 'detailed', issues);
            
            const result = await this.requestCopilotCompletion(prompt, language);
            
            if (result) {
                return this.parseImprovementResult(code, result);
            }
            
        } catch (error) {
            console.error('Error improving code with Copilot:', error);
        }

        // Fallback: basic improvements
        return {
            originalCode: code,
            improvedCode: this.applyBasicImprovements(code, filePath),
            changes: [],
            explanation: 'Basic accessibility improvements applied. For advanced improvements, ensure Copilot is properly configured.'
        };
    }

    private async requestCopilotCompletion(prompt: string, language: string): Promise<string | null> {
        try {
            if (this.copilotAPI) {
                // Use Copilot API if available
                const result = await this.copilotAPI.generateCompletion({
                    prompt: prompt,
                    language: language,
                    maxTokens: 2000
                });
                return result?.text || null;
            }

            // Fallback: use Copilot commands
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, `\n// ${prompt}\n`);
                });

                // Trigger Copilot suggestion
                await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
                
                // Wait a bit for suggestion to appear
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                return null; // Manual process, no direct result
            }

            return null;
        } catch (error) {
            console.error('Copilot completion request failed:', error);
            return null;
        }
    }

    private buildAccessibilityPrompt(code: string, language: string, action: 'analyze' | 'improve', detailLevel: string, issues?: WCAGIssue[]): string {
        const basePrompt = `Accessibility expert analyzing ${language} code for WCAG 2.2 compliance.\n\n`;
        
        if (action === 'analyze') {
            return `${basePrompt}Analyze this code for accessibility issues (${detailLevel} level):\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nFind WCAG violations, missing ARIA attributes, keyboard navigation issues, and color contrast problems.`;
        } else {
            let prompt = `${basePrompt}Improve this code for better accessibility:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nAdd proper ARIA labels, semantic HTML, keyboard support, and WCAG compliance.`;
            
            if (issues && issues.length > 0) {
                prompt += `\n\nFix these specific issues:\n${issues.map(issue => `- Line ${issue.line}: ${issue.message}`).join('\n')}`;
            }
            
            return prompt;
        }
    }

    private parseAnalysisResult(result: string, detailLevel: string): CodeAnalysisResult {
        // Basic parsing of Copilot response
        const issues: WCAGIssue[] = [];
        const suggestions: any[] = [];

        // Look for common accessibility issues in the response
        if (result.includes('missing alt') || result.includes('alt attribute')) {
            issues.push({
                line: 1,
                column: 1,
                severity: 'error',
                rule: 'WCAG 1.1.1',
                message: 'Missing alt attribute for image',
                wcagLevel: 'A'
            });
        }

        if (result.includes('missing label') || result.includes('aria-label')) {
            issues.push({
                line: 1,
                column: 1,
                severity: 'warning',
                rule: 'WCAG 4.1.2',
                message: 'Form element missing accessible label',
                wcagLevel: 'A'
            });
        }

        return {
            issues,
            summary: `Copilot-assisted analysis completed (${detailLevel} level)`,
            suggestions,
            detailLevel: detailLevel as 'basic' | 'detailed' | 'comprehensive'
        };
    }

    private parseImprovementResult(originalCode: string, result: string): CodeImprovementResult {
        return {
            originalCode,
            improvedCode: result || originalCode,
            changes: [{
                line: 1,
                type: 'modified',
                description: 'Accessibility improvements applied via Copilot'
            }],
            explanation: 'Code improved using VS Code Copilot suggestions for better accessibility'
        };
    }

    private getBasicAccessibilitySuggestions(code: string, filePath: string): any[] {
        const suggestions: any[] = [];
        const language = this.getLanguageFromFilePath(filePath);

        if (language === 'html') {
            if (code.includes('<img') && !code.includes('alt=')) {
                suggestions.push({
                    title: 'Add alt attributes to images',
                    description: 'All images should have descriptive alt text',
                    code: '<img src="image.jpg" alt="Descriptive text">',
                    type: 'fix'
                });
            }

            if (code.includes('<input') && !code.includes('aria-label') && !code.includes('<label')) {
                suggestions.push({
                    title: 'Add labels to form inputs',
                    description: 'Form inputs need accessible labels',
                    code: '<label for="input-id">Label text</label>\n<input id="input-id" type="text">',
                    type: 'fix'
                });
            }
        }

        return suggestions;
    }

    private applyBasicImprovements(code: string, filePath: string): string {
        let improvedCode = code;
        const language = this.getLanguageFromFilePath(filePath);

        if (language === 'html') {
            // Add basic accessibility improvements
            improvedCode = improvedCode.replace(
                /<img([^>]*?)src="([^"]*)"([^>]*?)>/gi,
                (match, before, src, after) => {
                    if (!match.includes('alt=')) {
                        return `<img${before}src="${src}"${after} alt="Image description">`;
                    }
                    return match;
                }
            );

            // Add role attributes where missing
            improvedCode = improvedCode.replace(
                /<button([^>]*?)>/gi,
                (match) => {
                    if (!match.includes('aria-') && !match.includes('role=')) {
                        return match.replace('>', ' role="button">');
                    }
                    return match;
                }
            );
        }

        return improvedCode;
    }

    async getModelInfo(): Promise<{ name: string; version: string; capabilities: string[] }> {
        return {
            name: 'VS Code Copilot',
            version: 'GitHub Copilot',
            capabilities: [
                'Code Completion',
                'WCAG Suggestions',
                'Context-Aware Improvements',
                'Multi-language Support'
            ]
        };
    }
}