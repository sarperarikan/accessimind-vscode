import { AIProviderManager } from "../utils/aiProvider";
import { SettingsManager } from "../utils/settingsManager";
import { logger } from "../utils/logger";
import { LocalizationManager } from "../utils/localizationManager";

export interface WcagIssue {
	id: string;
	severity: "critical" | "major" | "minor";
	description: string;
	wcagCriterion: string;
	line?: number;
	column?: number;
	element?: string;
	suggestion: string;
}

export interface WcagAnalysisResult {
	issues: WcagIssue[];
	summary: {
		totalIssues: number;
		criticalIssues: number;
		majorIssues: number;
		minorIssues: number;
		conformanceLevel: "A" | "AA" | "AAA" | "Non-conformant";
	};
	recommendations: string[];
	wcagCriteria: string[];
}

export class WcagAnalyzer {
	private aiProviderManager: AIProviderManager;
	private localization: LocalizationManager;

	constructor() {
		this.aiProviderManager = AIProviderManager.getInstance();
		this.localization = LocalizationManager.getInstance();
	}

	async analyzeCode(code: string, language: string, fileName: string): Promise<WcagAnalysisResult> {
		try {
			logger.info(`WCAG analysis starting: ${fileName} (${language})`);

			// First, check if AI provider is properly configured
			const settingsManager = SettingsManager.getInstance();
			const validationResult = await settingsManager.validateSettings();
			if (!validationResult.isValid) {
				logger.warn(this.localization.getStringWithParams("analyzer.error.provider.not.configured", { MESSAGE: validationResult.message || "" }));
			}

			// First, perform local static analysis
			const staticIssues = this.performStaticAnalysis(code, language);

			// Then, use AI for deeper analysis only if AI provider is configured
			let aiAnalysis: { issues: WcagIssue[] } = { issues: [] };
			if (validationResult.isValid) {
				try {
					aiAnalysis = await this.performAiAnalysis(code, language, fileName);
				} catch (aiError) {
					logger.warn(this.localization.getString("analyzer.error.ai.failed.fallback"), aiError);
				}
			}

			// Combine results
			const allIssues = [...staticIssues, ...aiAnalysis.issues];

			const summary = this.generateSummary(allIssues);
			const recommendations = this.generateRecommendations(allIssues);
			const wcagCriteria = this.extractWcagCriteria(allIssues);

			logger.info(`WCAG analysis completed: ${allIssues.length} issues found (${staticIssues.length} static, ${aiAnalysis.issues.length} AI)`);

			return {
				issues: allIssues,
				summary,
				recommendations,
				wcagCriteria
			};

		} catch (error) {
			logger.error("WCAG analysis error:", error);
			throw new Error(`WCAG analysis failed: ${error instanceof Error ? error.message : this.localization.getString("analyzer.error.unknown")}`);
		}
	}

	async generateDetailedReport(code: string, language: string, fileName: string): Promise<WcagAnalysisResult> {
		const analysisResult = await this.analyzeCode(code, language, fileName);

		// Add additional details for report
		analysisResult.recommendations.push(
			this.localization.getString("analyzer.report.regular.tests"),
			this.localization.getString("analyzer.report.automated.tests"),
			this.localization.getString("analyzer.report.user.tests"),
			this.localization.getString("analyzer.report.review.docs")
		);

		return analysisResult;
	}

	private performStaticAnalysis(code: string, language: string): WcagIssue[] {
		const issues: WcagIssue[] = [];

		if (["html", "htm", "jsx", "tsx", "vue", "svelte"].includes(language)) {
			// HTML-based analysis
			issues.push(...this.analyzeHtmlAccessibility(code));
		}

		if (["css", "scss", "sass", "less"].includes(language)) {
			// CSS-based analysis
			issues.push(...this.analyzeCssAccessibility(code));
		}

		if (["js", "ts", "jsx", "tsx"].includes(language)) {
			// JavaScript-based analysis
			issues.push(...this.analyzeJsAccessibility(code));
		}

		return issues;
	}

	private analyzeHtmlAccessibility(code: string): WcagIssue[] {
		const issues: WcagIssue[] = [];

		// Check for missing alt attributes
		const imgWithoutAlt = code.match(/<img(?![^>]*alt=)[^>]*>/gi);
		if (imgWithoutAlt) {
			issues.push({
				id: "img-alt-missing",
				severity: "critical",
				description: this.localization.getString("analyzer.img.alt.missing.desc"),
				wcagCriterion: "1.1.1",
				suggestion: this.localization.getString("analyzer.img.alt.missing.suggestion")
			});
		}

		// Check for missing form labels
		const inputWithoutLabel = code.match(/<input(?![^>]*aria-label)(?![^>]*aria-labelledby)[^>]*>/gi);
		if (inputWithoutLabel) {
			issues.push({
				id: "input-label-missing",
				severity: "critical",
				description: this.localization.getString("analyzer.input.label.missing.desc"),
				wcagCriterion: "1.3.1",
				suggestion: this.localization.getString("analyzer.input.label.missing.suggestion")
			});
		}

		// Check for missing heading hierarchy
		const headings = code.match(/<h[1-6][^>]*>/gi);
		if (headings) {
			const headingLevels = headings.map(h => parseInt(h.match(/h([1-6])/)?.[1] || "1"));
			if (headingLevels.length > 1) {
				for (let i = 1; i < headingLevels.length; i++) {
					if (headingLevels[i] - headingLevels[i - 1] > 1) {
						issues.push({
							id: "heading-hierarchy",
							severity: "major",
							description: this.localization.getString("analyzer.heading.hierarchy.desc"),
							wcagCriterion: "1.3.1",
							suggestion: this.localization.getString("analyzer.heading.hierarchy.suggestion")
						});
						break;
					}
				}
			}
		}

		// Check for missing button accessibility
		const buttonsWithoutText = code.match(/<button[^>]*>[\s]*<\/button>/gi);
		if (buttonsWithoutText) {
			issues.push({
				id: "button-empty",
				severity: "critical",
				description: this.localization.getString("analyzer.button.empty.desc"),
				wcagCriterion: "2.4.4",
				suggestion: this.localization.getString("analyzer.button.empty.suggestion")
			});
		}

		// Check for missing table headers
		const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
		const tables = code.match(tableRegex);
		if (tables) {
			const tablesWithoutHeaders = tables.filter(table => !table.includes("<th"));
			if (tablesWithoutHeaders.length > 0) {
				issues.push({
					id: "table-headers-missing",
					severity: "major",
					description: this.localization.getString("analyzer.table.headers.missing.desc"),
					wcagCriterion: "1.3.1",
					suggestion: this.localization.getString("analyzer.table.headers.missing.suggestion")
				});
			}
		}

		return issues;
	}

	private analyzeCssAccessibility(code: string): WcagIssue[] {
		const issues: WcagIssue[] = [];

		// Check for low contrast colors (basic check)
		const colorProperties = code.match(/color\s*:\s*#[0-9a-f]{3,6}/gi);
		const backgroundProperties = code.match(/background-color\s*:\s*#[0-9a-f]{3,6}/gi);

		if (colorProperties && backgroundProperties) {
			issues.push({
				id: "color-contrast-check",
				severity: "minor",
				description: this.localization.getString("analyzer.color.contrast.desc"),
				wcagCriterion: "1.4.3",
				suggestion: this.localization.getString("analyzer.color.contrast.suggestion")
			});
		}

		// Check for fixed font sizes
		const fixedFontSizes = code.match(/font-size\s*:\s*\d+px/gi);
		if (fixedFontSizes) {
			issues.push({
				id: "fixed-font-size",
				severity: "minor",
				description: this.localization.getString("analyzer.fixed.font.desc"),
				wcagCriterion: "1.4.4",
				suggestion: this.localization.getString("analyzer.fixed.font.suggestion")
			});
		}

		return issues;
	}

	private analyzeJsAccessibility(code: string): WcagIssue[] {
		const issues: WcagIssue[] = [];

		// Check for click-only event handlers
		const clickOnlyEvents = code.match(/onclick\s*=/gi);
		const keyboardEvents = code.match(/onkey(down|up|press)\s*=/gi);

		if (clickOnlyEvents && !keyboardEvents) {
			issues.push({
				id: "keyboard-navigation",
				severity: "major",
				description: this.localization.getString("analyzer.keyboard.nav.desc"),
				wcagCriterion: "2.1.1",
				suggestion: this.localization.getString("analyzer.keyboard.nav.suggestion")
			});
		}

		// Check for missing focus management
		const focusManagement = code.match(/(focus\(\)|blur\(\)|tabindex)/gi);
		if (!focusManagement && code.includes("addEventListener")) {
			issues.push({
				id: "focus-management",
				severity: "minor",
				description: this.localization.getString("analyzer.focus.management.desc"),
				wcagCriterion: "2.4.3",
				suggestion: this.localization.getString("analyzer.focus.management.suggestion")
			});
		}

		return issues;
	}

	private async performAiAnalysis(code: string, language: string, fileName: string): Promise<{ issues: WcagIssue[] }> {
		try {
			// AI provider check
			const settingsManager = SettingsManager.getInstance();
			const validationResult = await settingsManager.validateSettings();
			if (!validationResult.isValid) {
				throw new Error(this.localization.getStringWithParams("analyzer.error.provider.config.missing", { MESSAGE: validationResult.message || "" }));
			}

			// Get current AI provider
			const currentProvider = await this.aiProviderManager.getCurrentProviderInstance();
			const providerName = this.aiProviderManager.getCurrentProviderName();
			const currentLang = this.localization.getCurrentLanguage();

			// Build language-aware analysis prompt
			const prompt = currentLang === "tr"
				? `Sen bir WCAG 2.2 erişilebilirlik uzmanısın. Aşağıdaki kodu analiz et ve WCAG sorunlarını tespit et.

Kod:
\`\`\`${language}
${code}
\`\`\`

Dosya: ${fileName}
Dil: ${language}

Lütfen şu formatta JSON yanıt ver:
{
	"issues": [
	  {
	    "id": "unique-id",
	    "severity": "critical|major|minor",
	    "description": "Sorun açıklaması",
	    "wcagCriterion": "1.1.1",
	    "suggestion": "Çözüm önerisi"
	  }
	]
}

Sadece gerçek WCAG sorunlarını raporla. Özellikle şunlara odaklan:
- Erişilebilirlik API'leri (ARIA)
- Klavye navigasyonu
- Renk kontrastı
- Semantik HTML
- Form erişilebilirliği
- Resim alt metinleri`
				: `You are a WCAG 2.2 accessibility expert. Analyze the following code and identify WCAG issues.

Code:
\`\`\`${language}
${code}
\`\`\`

File: ${fileName}
Language: ${language}

Please respond in the following JSON format:
{
	"issues": [
	  {
	    "id": "unique-id",
	    "severity": "critical|major|minor",
	    "description": "Issue description",
	    "wcagCriterion": "1.1.1",
	    "suggestion": "Suggested fix"
	  }
	]
}

Only report real WCAG issues. Focus on:
- Accessibility APIs (ARIA)
- Keyboard navigation
- Color contrast
- Semantic HTML
- Form accessibility
- Image alt texts`;

			const response = await currentProvider.analyzeCode({
				code: prompt,
				fileType: "analysis",
				language: "text",
				wcagLevel: "AA",
				includeComments: true,
				responseLanguage: currentLang as "en" | "tr"
			});

			if (!response.success) {
				throw new Error(response.error || this.localization.getStringWithParams("analyzer.error.ai.analysis.failed", { PROVIDER: providerName }));
			}

			if (response.content) {
				try {
					// Try to parse JSON response
					const jsonMatch = response.content.match(/\{[\s\S]*\}/);
					if (jsonMatch) {
						const analysisData = JSON.parse(jsonMatch[0]);
						logger.info(`WCAG AI analysis completed (${providerName}): ${analysisData.issues?.length || 0} issues found`);
						return { issues: analysisData.issues || [] };
					}
				} catch (parseError) {
					logger.warn(this.localization.getStringWithParams("analyzer.error.response.not.json", { PROVIDER: providerName }));
					// Fallback to text analysis
					return this.parseTextAnalysis(response.content);
				}
			}

			return { issues: [] };

		} catch (error) {
			logger.error("AI analysis error:", error);

			// More specific messages based on error type
			if (error instanceof Error) {
				if (error.message.includes("API") || error.message.includes("provider")) {
					throw new Error(this.localization.getString("analyzer.error.provider") + error.message);
				} else if (error.message.includes("key")) {
					throw new Error(this.localization.getString("analyzer.error.api.key") + error.message);
				} else {
					throw new Error(this.localization.getString("analyzer.error.during.analysis") + error.message);
				}
			}

			throw new Error(this.localization.getString("analyzer.error.unknown"));
		}
	}

	private parseTextAnalysis(text: string): { issues: WcagIssue[] } {
		const issues: WcagIssue[] = [];

		// Simple text parsing for common WCAG issues mentioned in AI response
		if (text.toLowerCase().includes("alt")) {
			issues.push({
				id: "ai-alt-text",
				severity: "major",
				description: this.localization.getString("analyzer.ai.alt.text.desc"),
				wcagCriterion: "1.1.1",
				suggestion: this.localization.getString("analyzer.ai.alt.text.suggestion")
			});
		}

		if (text.toLowerCase().includes("aria")) {
			issues.push({
				id: "ai-aria",
				severity: "major",
				description: this.localization.getString("analyzer.ai.aria.desc"),
				wcagCriterion: "4.1.2",
				suggestion: this.localization.getString("analyzer.ai.aria.suggestion")
			});
		}

		return { issues };
	}

	private generateSummary(issues: WcagIssue[]): WcagAnalysisResult["summary"] {
		const criticalIssues = issues.filter(i => i.severity === "critical").length;
		const majorIssues = issues.filter(i => i.severity === "major").length;
		const minorIssues = issues.filter(i => i.severity === "minor").length;

		let conformanceLevel: "A" | "AA" | "AAA" | "Non-conformant" = "AAA";

		if (criticalIssues > 0) {
			conformanceLevel = "Non-conformant";
		} else if (majorIssues > 0) {
			conformanceLevel = "A";
		} else if (minorIssues > 0) {
			conformanceLevel = "AA";
		}

		return {
			totalIssues: issues.length,
			criticalIssues,
			majorIssues,
			minorIssues,
			conformanceLevel
		};
	}

	private generateRecommendations(issues: WcagIssue[]): string[] {
		const recommendations: string[] = [];

		if (issues.some(i => i.id.includes("alt"))) {
			recommendations.push(this.localization.getString("analyzer.recommend.alt"));
		}

		if (issues.some(i => i.id.includes("label"))) {
			recommendations.push(this.localization.getString("analyzer.recommend.labels"));
		}

		if (issues.some(i => i.id.includes("heading"))) {
			recommendations.push(this.localization.getString("analyzer.recommend.headings"));
		}

		if (issues.some(i => i.id.includes("keyboard"))) {
			recommendations.push(this.localization.getString("analyzer.recommend.keyboard"));
		}

		if (issues.some(i => i.id.includes("contrast"))) {
			recommendations.push(this.localization.getString("analyzer.recommend.contrast"));
		}

		if (recommendations.length === 0) {
			recommendations.push(this.localization.getString("analyzer.recommend.conformant"));
		}

		return recommendations;
	}

	private extractWcagCriteria(issues: WcagIssue[]): string[] {
		const criteria = new Set<string>();
		issues.forEach(issue => {
			if (issue.wcagCriterion) {
				criteria.add(issue.wcagCriterion);
			}
		});
		return Array.from(criteria).sort();
	}
} 