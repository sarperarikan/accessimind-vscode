import * as vscode from 'vscode';
import { SettingsManager, AIProviderSettings } from '../settings/SettingsManager';

export interface CodeAnalysisResult {
  issues: WCAGIssue[];
  summary: string;
  suggestions: CodeSuggestion[];
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
}

export interface WCAGIssue {
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  description?: string;
  examples?: string[];
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface CodeSuggestion {
  title: string;
  description: string;
  code: string;
  line?: number;
  type: 'fix' | 'enhancement' | 'best-practice';
}

export interface CodeImprovementResult {
  originalCode: string;
  improvedCode: string;
  changes: ChangeDescription[];
  explanation: string;
}

export interface ChangeDescription {
  line: number;
  type: 'added' | 'modified' | 'removed';
  description: string;
  wcagRule?: string;
}

export abstract class AIService {
  protected settingsManager: SettingsManager;
  protected settings?: AIProviderSettings;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  async initialize(): Promise<boolean> {
    this.settings = await this.settingsManager.getAIProviderSettings();
    return this.isConfigured();
  }

  abstract isConfigured(): boolean;
  abstract analyzeCode(code: string, filePath: string, detailLevel: string): Promise<CodeAnalysisResult>;
  abstract improveCode(code: string, filePath: string, issues?: WCAGIssue[]): Promise<CodeImprovementResult>;
  abstract testConnection(): Promise<boolean>;

  protected getLanguageFromFilePath(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
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

  protected buildPrompt(code: string, language: string, action: 'analyze' | 'improve', detailLevel: string): string {
    const basePrompt = `You are an expert accessibility consultant specializing in WCAG 2.2 conformance. `;

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
    } else {
      return `${basePrompt}Improve the following ${language} code for better WCAG 2.2 accessibility conformance.

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