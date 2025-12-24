import * as vscode from "vscode";
import { logger } from "../utils/logger";

export interface ImprovementStatistics {
	linesImproved: number;
	wcagCriteria: string[];
	improvementTime: number;
	tokensUsed: number;
}

export interface DetailedStatistics {
	totalImprovements: number;
	totalLinesImproved: number;
	totalAnalyses: number;
	totalReports: number;
	totalTokensUsed: number;
	totalTime: number;
	
	// By language
	languageStats: { [language: string]: {
		improvements: number;
		linesImproved: number;
		analyses: number;
		avgTime: number;
	}};
	
	// By WCAG criteria
	wcagCriteriaStats: { [criterion: string]: {
		count: number;
		languages: string[];
	}};
	
	// By time period
	dailyStats: { [date: string]: {
		improvements: number;
		analyses: number;
		linesImproved: number;
	}};
	
	// Error tracking
	errors: {
		total: number;
		byType: { [type: string]: number };
		recent: Array<{
			type: string;
			message: string;
			timestamp: number;
		}>;
	};
	
	// Performance metrics
	performance: {
		avgImprovementTime: number;
		avgAnalysisTime: number;
		avgTokensPerImprovement: number;
		successRate: number;
	};
}

export class StatisticsTracker {
	private context: vscode.ExtensionContext;
	private stats: DetailedStatistics;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.stats = this.loadStatistics();
	}

	// Improvement tracking
	recordImprovement(
		type: "file" | "selection",
		language: string,
		details: ImprovementStatistics
	): void {
		try {
			const today = this.getToday();
			
			// Update totals
			this.stats.totalImprovements++;
			this.stats.totalLinesImproved += details.linesImproved;
			this.stats.totalTokensUsed += details.tokensUsed;
			this.stats.totalTime += details.improvementTime;

			// Update language stats
			if (!this.stats.languageStats[language]) {
				this.stats.languageStats[language] = {
					improvements: 0,
					linesImproved: 0,
					analyses: 0,
					avgTime: 0
				};
			}
			
			const langStats = this.stats.languageStats[language];
			langStats.improvements++;
			langStats.linesImproved += details.linesImproved;
			langStats.avgTime = (langStats.avgTime * (langStats.improvements - 1) + details.improvementTime) / langStats.improvements;

			// Update WCAG criteria stats
			details.wcagCriteria.forEach(criterion => {
				if (!this.stats.wcagCriteriaStats[criterion]) {
					this.stats.wcagCriteriaStats[criterion] = {
						count: 0,
						languages: []
					};
				}
				
				const criteriaStats = this.stats.wcagCriteriaStats[criterion];
				criteriaStats.count++;
				
				if (!criteriaStats.languages.includes(language)) {
					criteriaStats.languages.push(language);
				}
			});

			// Update daily stats
			if (!this.stats.dailyStats[today]) {
				this.stats.dailyStats[today] = {
					improvements: 0,
					analyses: 0,
					linesImproved: 0
				};
			}
			
			this.stats.dailyStats[today].improvements++;
			this.stats.dailyStats[today].linesImproved += details.linesImproved;

			// Update performance metrics
			this.updatePerformanceMetrics();

			// Save statistics
			this.saveStatistics();

			logger.info(`Statistics recorded: ${type} improvement, ${details.linesImproved} lines, ${language}`);

		} catch (error) {
			logger.error("Statistics recording error:", error);
		}
	}

	// Analysis tracking
	recordAnalysis(language: string, issuesFound: number, analysisTime: number): void {
		try {
			const today = this.getToday();
			
			// Update totals
			this.stats.totalAnalyses++;
			this.stats.totalTime += analysisTime;

			// Update language stats
			if (!this.stats.languageStats[language]) {
				this.stats.languageStats[language] = {
					improvements: 0,
					linesImproved: 0,
					analyses: 0,
					avgTime: 0
				};
			}
			
			this.stats.languageStats[language].analyses++;

			// Update daily stats
			if (!this.stats.dailyStats[today]) {
				this.stats.dailyStats[today] = {
					improvements: 0,
					analyses: 0,
					linesImproved: 0
				};
			}
			
			this.stats.dailyStats[today].analyses++;

			// Update performance metrics
			this.updatePerformanceMetrics();

			// Save statistics
			this.saveStatistics();

			logger.info(`Analysis statistics recorded: ${language}, ${issuesFound} issues, ${analysisTime}ms`);

		} catch (error) {
			logger.error("Analysis statistics recording error:", error);
		}
	}

	// Report generation tracking
	recordReportGeneration(language: string, issuesCount: number): void {
		try {
			this.stats.totalReports++;
			this.saveStatistics();

			logger.info(`Report statistics recorded: ${language}, ${issuesCount} issues`);

		} catch (error) {
			logger.error("Report statistics recording error:", error);
		}
	}



	// Specific improvement tracking
	recordSpecificImprovement(type: string, language: string): void {
		try {
			// Record as a regular improvement with estimated values
			this.recordImprovement("selection", language, {
				linesImproved: 1,
				wcagCriteria: this.getWcagCriteriaForType(type),
				improvementTime: 1000, // 1 second estimate
				tokensUsed: 100 // Rough estimate
			});

			logger.info(`Specific improvement recorded: ${type}, ${language}`);

		} catch (error) {
			logger.error("Specific improvement recording error:", error);
		}
	}

	// Error tracking
	recordError(type: string, message: string): void {
		try {
			this.stats.errors.total++;
			
			if (!this.stats.errors.byType[type]) {
				this.stats.errors.byType[type] = 0;
			}
			this.stats.errors.byType[type]++;

			// Add to recent errors (keep last 10)
			this.stats.errors.recent.unshift({
				type,
				message,
				timestamp: Date.now()
			});
			
			if (this.stats.errors.recent.length > 10) {
				this.stats.errors.recent = this.stats.errors.recent.slice(0, 10);
			}

			// Update performance metrics
			this.updatePerformanceMetrics();

			this.saveStatistics();

			logger.info(`Error statistics recorded: ${type} - ${message}`);

		} catch (error) {
			logger.error("Error statistics recording error:", error);
		}
	}

	// Get detailed statistics
	getDetailedStatistics(): DetailedStatistics {
		return { ...this.stats };
	}

	// Get summary statistics
	getSummaryStatistics(): {
		totalImprovements: number;
		totalLinesImproved: number;
		totalAnalyses: number;
		totalTime: string;
		successRate: string;
		topLanguage: string;
		topWcagCriterion: string;
	} {
		const totalTimeFormatted = this.formatTime(this.stats.totalTime);
		const successRate = `${(this.stats.performance.successRate * 100).toFixed(1)}%`;
		
		// Find top language
		const topLanguage = Object.entries(this.stats.languageStats)
			.sort(([,a], [,b]) => b.improvements - a.improvements)[0]?.[0] || "N/A";
		
		// Find top WCAG criterion
		const topWcagCriterion = Object.entries(this.stats.wcagCriteriaStats)
			.sort(([,a], [,b]) => b.count - a.count)[0]?.[0] || "N/A";

		return {
			totalImprovements: this.stats.totalImprovements,
			totalLinesImproved: this.stats.totalLinesImproved,
			totalAnalyses: this.stats.totalAnalyses,
			totalTime: totalTimeFormatted,
			successRate,
			topLanguage,
			topWcagCriterion
		};
	}

	// Reset statistics
	resetStatistics(): void {
		this.stats = this.createEmptyStatistics();
		this.saveStatistics();
		logger.info("Statistics reset");
	}

	// Export statistics
	exportStatistics(): string {
		return JSON.stringify(this.stats, null, 2);
	}

	// Private methods
	private loadStatistics(): DetailedStatistics {
		try {
			const savedStats = this.context.globalState.get<DetailedStatistics>("wcagEnhancer.statistics");
			if (savedStats) {
				// Merge with empty stats to ensure all properties exist
				return { ...this.createEmptyStatistics(), ...savedStats };
			}
		} catch (error) {
			logger.error("Statistics loading error:", error);
		}
		
		return this.createEmptyStatistics();
	}

	private saveStatistics(): void {
		try {
			this.context.globalState.update("wcagEnhancer.statistics", this.stats);
		} catch (error) {
			logger.error("Statistics saving error:", error);
		}
	}

	private createEmptyStatistics(): DetailedStatistics {
		return {
			totalImprovements: 0,
			totalLinesImproved: 0,
			totalAnalyses: 0,
			totalReports: 0,
			totalTokensUsed: 0,
			totalTime: 0,
			languageStats: {},
			wcagCriteriaStats: {},
			dailyStats: {},
			errors: {
				total: 0,
				byType: {},
				recent: []
			},
			performance: {
				avgImprovementTime: 0,
				avgAnalysisTime: 0,
				avgTokensPerImprovement: 0,
				successRate: 1.0
			}
		};
	}

	private updatePerformanceMetrics(): void {
		const totalOperations = this.stats.totalImprovements + this.stats.totalAnalyses;
		const totalErrors = this.stats.errors.total;
		
		if (totalOperations > 0) {
			this.stats.performance.successRate = (totalOperations - totalErrors) / totalOperations;
		}
		
		if (this.stats.totalImprovements > 0) {
			this.stats.performance.avgImprovementTime = this.stats.totalTime / this.stats.totalImprovements;
			this.stats.performance.avgTokensPerImprovement = this.stats.totalTokensUsed / this.stats.totalImprovements;
		}
		
		if (this.stats.totalAnalyses > 0) {
			this.stats.performance.avgAnalysisTime = this.stats.totalTime / this.stats.totalAnalyses;
		}
	}

	private getToday(): string {
		return new Date().toISOString().split("T")[0];
	}

	private formatTime(milliseconds: number): string {
		const seconds = Math.floor(milliseconds / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	private getWcagCriteriaForType(type: string): string[] {
		switch (type) {
			case "aria-labels":
				return ["1.3.1", "4.1.2"];
			case "color-contrast":
				return ["1.4.3", "1.4.6"];
			case "keyboard-navigation":
				return ["2.1.1", "2.1.2", "2.4.3"];
			default:
				return [];
		}
	}
} 