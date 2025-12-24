"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
class AIService {
    constructor(settingsManager) {
        this.settingsManager = settingsManager;
    }
    async initialize() {
        this.settings = await this.settingsManager.getAIProviderSettings();
        return this.isConfigured();
    }
    getLanguageFromFilePath(filePath) {
        const extension = filePath.split('.').pop()?.toLowerCase() || '';
        const languageMap = {
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'vue': 'vue',
            'svelte': 'svelte'
        };
        return languageMap[extension] || 'text';
    }
    buildPrompt(code, language, action, detailLevel) {
        const basePrompt = `You are an expert accessibility consultant specializing in WCAG 2.2 compliance. `;
        if (action === 'analyze') {
            return `${basePrompt}Analyze the following ${language} code for WCAG accessibility issues.

Detail Level: ${detailLevel}

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Provide analysis in this JSON format:
{
  "issues": [
    {
      "line": number,
      "column": number,
      "severity": "error|warning|info",
      "rule": "WCAG rule reference",
      "message": "Brief description",
      "description": "Detailed explanation (if detail level allows)",
      "examples": ["code examples (if comprehensive)"],
      "wcagLevel": "A|AA|AAA"
    }
  ],
  "summary": "Overall accessibility assessment",
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "How to implement",
      "code": "Example implementation",
      "type": "fix|enhancement|best-practice"
    }
  ]
}`;
        }
        else {
            return `${basePrompt}Improve the following ${language} code for better WCAG 2.2 accessibility compliance.

Code to improve:
\`\`\`${language}
${code}
\`\`\`

Provide response in this JSON format:
{
  "improvedCode": "The improved code with accessibility enhancements",
  "changes": [
    {
      "line": number,
      "type": "added|modified|removed",
      "description": "What changed and why",
      "wcagRule": "Relevant WCAG rule if applicable"
    }
  ],
  "explanation": "Overall explanation of improvements made"
}`;
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=AIService.js.map