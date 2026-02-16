import * as vscode from "vscode";
import { AIProviderManager } from "../utils/aiProvider";
import { logger } from "../utils/logger";

export interface WcagImprovementOptions {
	includeComments?: boolean;
	wcagLevel?: "A" | "AA" | "AAA";
	autoSave?: boolean;
	isSelection?: boolean;
	language?: "en" | "tr";
}

export interface WcagImprovementResult {
	success: boolean;
	improvedCode?: string;
	error?: string;
	wcagCriteria?: string[];
	tokensUsed?: number;
	improvementsSummary?: string[];
	summary?: string;
}

export class WcagImprover {
	private providerManager: any; // AIProviderManager

	constructor() {
		this.providerManager = AIProviderManager.getInstance();
	}

	async improveCode(
		code: string,
		language: string,
		fileName: string,
		options: WcagImprovementOptions = {}
	): Promise<WcagImprovementResult> {
		try {
			logger.info(`WCAG iyileştirme başlıyor: ${fileName} (${language})`);

			const {
				includeComments = true,
				wcagLevel = "AA",
				isSelection = false,
				language: userLanguage = "en"
			} = options;

			// Get AI improvement (prompt is built inside provider.improveCode via buildWCAGPrompt)
			const provider = await this.providerManager.getCurrentProviderInstance();
			const response = await provider.improveCode({
				code,
				fileType: fileName.split(".").pop() || "unknown",
				language,
				mode: "edit",
				wcagLevel,
				includeComments,
				responseLanguage: userLanguage
			});

			if (response.success && response.content) {
				// Extract WCAG criteria from the improved code comments
				const wcagCriteria = this.extractWcagCriteriaFromCode(response.content);
				const improvementsSummary = this.generateImprovementsSummary(code, response.content, language);

				logger.info(`WCAG iyileştirme tamamlandı: ${wcagCriteria.length} kriter uygulandı`);

				const summary = improvementsSummary.length > 0
					? `Applied ${wcagCriteria.length} WCAG criteria: ${improvementsSummary.slice(0, 3).join(", ")}${improvementsSummary.length > 3 ? "..." : ""}`
					: `Applied ${wcagCriteria.length} WCAG improvements`;

				return {
					success: true,
					improvedCode: response.content,
					wcagCriteria,
					tokensUsed: response.tokensUsed,
					improvementsSummary,
					summary
				};
			} else {
				throw new Error(response.error || "AI iyileştirme başarısız");
			}

		} catch (error) {
			logger.error("WCAG iyileştirme hatası:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Bilinmeyen hata"
			};
		}
	}

	private extractWcagCriteriaFromCode(code: string): string[] {
		const criteria = new Set<string>();
		if (!code) return [];
		const perf = vscode.workspace.getConfiguration("wcagEnhancer").get("performance") as any || {};
		const MAX_SCAN_SIZE = typeof perf?.maxScanSize === "number" ? perf.maxScanSize : 500000;
		const MAX_MATCHES = typeof perf?.maxRegexMatches === "number" ? perf.maxRegexMatches : 100;
		if (code.length > MAX_SCAN_SIZE) return [];
		const wcagRegex = /WCAG\s+(\d+\.\d+\.\d+)/gi;
		let count = 0;
		for (const m of code.matchAll(wcagRegex)) {
			if (m[1]) {
				criteria.add(m[1]);
				count++;
				if (count >= MAX_MATCHES) break;
			}
		}

		// If no criteria found in comments, infer from code improvements
		if (criteria.size === 0) {
			if (code.includes("alt=") || code.includes("aria-label")) {
				criteria.add("1.1.1");
			}
			if (code.includes("aria-") || code.includes("role=")) {
				criteria.add("4.1.2");
			}
			if (code.includes("tabindex") || code.includes("onkeydown")) {
				criteria.add("2.1.1");
			}
			if (code.includes("label") && code.includes("input")) {
				criteria.add("1.3.1");
			}
		}

		return Array.from(criteria).sort();
	}

	private generateImprovementsSummary(originalCode: string, improvedCode: string, _language: string): string[] {
		const summary: string[] = [];

		// Count improvements
		const originalAltCount = (originalCode.match(/alt=/g) || []).length;
		const improvedAltCount = (improvedCode.match(/alt=/g) || []).length;
		if (improvedAltCount > originalAltCount) {
			summary.push(`🖼️ ${improvedAltCount - originalAltCount} alt metni eklendi`);
		}

		const originalAriaCount = (originalCode.match(/aria-/g) || []).length;
		const improvedAriaCount = (improvedCode.match(/aria-/g) || []).length;
		if (improvedAriaCount > originalAriaCount) {
			summary.push(`🏷️ ${improvedAriaCount - originalAriaCount} ARIA özelliği eklendi`);
		}

		const originalTabindexCount = (originalCode.match(/tabindex/g) || []).length;
		const improvedTabindexCount = (improvedCode.match(/tabindex/g) || []).length;
		if (improvedTabindexCount > originalTabindexCount) {
			summary.push(`⌨️ ${improvedTabindexCount - originalTabindexCount} klavye navigasyonu eklendi`);
		}

		const originalLabelCount = (originalCode.match(/<label/g) || []).length;
		const improvedLabelCount = (improvedCode.match(/<label/g) || []).length;
		if (improvedLabelCount > originalLabelCount) {
			summary.push(`🏷️ ${improvedLabelCount - originalLabelCount} form etiketi eklendi`);
		}

		const originalRoleCount = (originalCode.match(/role=/g) || []).length;
		const improvedRoleCount = (improvedCode.match(/role=/g) || []).length;
		if (improvedRoleCount > originalRoleCount) {
			summary.push(`🎭 ${improvedRoleCount - originalRoleCount} semantik rol eklendi`);
		}

		// Check for semantic improvements
		const semanticElements = ["header", "nav", "main", "section", "article", "aside", "footer"];
		semanticElements.forEach(element => {
			const originalCount = (originalCode.match(new RegExp(`<${element}`, "g")) || []).length;
			const improvedCount = (improvedCode.match(new RegExp(`<${element}`, "g")) || []).length;
			if (improvedCount > originalCount) {
				summary.push(`📝 ${improvedCount - originalCount} ${element} elementi eklendi`);
			}
		});

		if (summary.length === 0) {
			summary.push("✨ Kod WCAG standartlarına uygun hale getirildi");
		}

		return summary;
	}
}
