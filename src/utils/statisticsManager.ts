// statisticsManager.ts
import * as vscode from "vscode";
import { logger } from "./logger";
import { EventEmitter } from "events";
import { TokenAnalyticsManager, TokenUsage } from "./tokenAnalytics";

export interface ImprovementRecord {
	type: "file" | "selection" | "inline-chat"
	language: string
	fileName: string
	linesImproved: number
	wcagCriteria: string[]
	processingTime: number
	tokensUsed: number
	inputTokens?: number
	outputTokens?: number
	timestamp: number
	provider: "gemini" | "vscode-copilot" | "ollama"
	model: string
}

export interface DetailedStatistics {
	totalImprovements: number
	totalLinesImproved: number
	totalProcessingTime: number
	totalTokensUsed: number

	// By language
	languageStats: {
		[language: string]: {
			count: number
			linesImproved: number
			avgProcessingTime: number
		}
	}

	// By WCAG criteria
	wcagCriteriaStats: { [criterion: string]: number }

	// By date
	dailyStats: {
		[date: string]: {
			improvements: number
			linesImproved: number
		}
	}

	// By provider
	providerStats: {
		[provider: string]: {
			count: number
			linesImproved: number
			avgProcessingTime: number
			tokensUsed: number
		}
	}

	// By model
	modelStats: {
		[model: string]: {
			count: number
			linesImproved: number
			avgProcessingTime: number
			tokensUsed: number
			provider: string
		}
	}

	// Recent improvements
	recentImprovements: ImprovementRecord[]

	// Error tracking
	errors: {
		total: number
		byType: { [type: string]: number }
		recent: Array<{
			type: string
			message: string
			timestamp: number
		}>
	}

	// Time-based analytics
	weeklyStats: {
		[weekStart: string]: {
			improvements: number
			linesImproved: number
			avgProcessingTime: number
		}
	}

	monthlyStats: {
		[month: string]: {
			improvements: number
			linesImproved: number
			avgProcessingTime: number
			tokensUsed: number
		}
	}

	// Yearly statistics
	yearlyStats: {
		[year: string]: {
			improvements: number
			linesImproved: number
			avgProcessingTime: number
			tokensUsed: number
		}
	}

	// Performance metrics
	averageProcessingTime: number
	fastestImprovement: number
	slowestImprovement: number

	// Usage patterns
	mostActiveHour: number
	mostActiveDayOfWeek: number
	improvementsByHour: { [hour: string]: number }
	improvementsByDayOfWeek: { [day: string]: number }
}

export class StatisticsManager extends EventEmitter {
	private context: vscode.ExtensionContext;
	private stats: DetailedStatistics;
	private static instance: StatisticsManager;
	private tokenAnalytics: TokenAnalyticsManager;

	constructor(context: vscode.ExtensionContext) {
		super();
		this.context = context;
		this.stats = this.loadStatistics();
		this.tokenAnalytics = TokenAnalyticsManager.getInstance(context);

		// Set max listeners to prevent warnings
		this.setMaxListeners(50);

		logger.info("StatisticsManager initialized with real-time updates and advanced token analytics");
	}

	static getInstance(context?: vscode.ExtensionContext): StatisticsManager {
		if (!StatisticsManager.instance) {
			if (!context) {
				throw new Error("Context required for first StatisticsManager instance");
			}
			StatisticsManager.instance = new StatisticsManager(context);
		}
		return StatisticsManager.instance;
	}

	recordImprovement(record: Omit<ImprovementRecord, "timestamp">): void {
		try {
			const fullRecord: ImprovementRecord = {
				...record,
				timestamp: Date.now()
			};

			// Update totals
			this.stats.totalImprovements++;
			this.stats.totalLinesImproved += record.linesImproved;
			this.stats.totalProcessingTime += record.processingTime;
			this.stats.totalTokensUsed += record.tokensUsed;

			// Record detailed token usage in TokenAnalytics
			this.tokenAnalytics.recordTokenUsage({
				model: record.model,
				provider: record.provider,
				tokensUsed: record.tokensUsed,
				inputTokens: (record as any).inputTokens || Math.ceil(record.tokensUsed * 0.7),
				outputTokens: (record as any).outputTokens || Math.ceil(record.tokensUsed * 0.3),
				operationType: "improvement",
				codeLanguage: record.language,
				linesProcessed: record.linesImproved,
				processingTime: record.processingTime
			});

			// Update language stats
			if (!this.stats.languageStats[record.language]) {
				this.stats.languageStats[record.language] = {
					count: 0,
					linesImproved: 0,
					avgProcessingTime: 0
				};
			}

			const langStats = this.stats.languageStats[record.language];
			langStats.count++;
			langStats.linesImproved += record.linesImproved;
			langStats.avgProcessingTime =
				(langStats.avgProcessingTime * (langStats.count - 1) + record.processingTime) / langStats.count;

			// Update provider stats
			if (!this.stats.providerStats[record.provider]) {
				this.stats.providerStats[record.provider] = {
					count: 0,
					linesImproved: 0,
					avgProcessingTime: 0,
					tokensUsed: 0
				};
			}

			const providerStats = this.stats.providerStats[record.provider];
			providerStats.count++;
			providerStats.linesImproved += record.linesImproved;
			providerStats.tokensUsed += record.tokensUsed;
			providerStats.avgProcessingTime =
				(providerStats.avgProcessingTime * (providerStats.count - 1) + record.processingTime) / providerStats.count;

			// Update model stats
			if (!this.stats.modelStats[record.model]) {
				this.stats.modelStats[record.model] = {
					count: 0,
					linesImproved: 0,
					avgProcessingTime: 0,
					tokensUsed: 0,
					provider: record.provider
				};
			}

			const modelStats = this.stats.modelStats[record.model];
			modelStats.count++;
			modelStats.linesImproved += record.linesImproved;
			modelStats.tokensUsed += record.tokensUsed;
			modelStats.avgProcessingTime =
				(modelStats.avgProcessingTime * (modelStats.count - 1) + record.processingTime) / modelStats.count;

			// Update WCAG criteria stats
			record.wcagCriteria.forEach(criterion => {
				this.stats.wcagCriteriaStats[criterion] = (this.stats.wcagCriteriaStats[criterion] || 0) + 1;
			});

			// Update daily stats
			const today = this.getToday();
			if (!this.stats.dailyStats[today]) {
				this.stats.dailyStats[today] = {
					improvements: 0,
					linesImproved: 0
				};
			}
			this.stats.dailyStats[today].improvements++;
			this.stats.dailyStats[today].linesImproved += record.linesImproved;

			// Update weekly stats
			const weekStart = this.getWeekStart(new Date());
			if (!this.stats.weeklyStats[weekStart]) {
				this.stats.weeklyStats[weekStart] = {
					improvements: 0,
					linesImproved: 0,
					avgProcessingTime: 0
				};
			}
			const weekStats = this.stats.weeklyStats[weekStart];
			weekStats.improvements++;
			weekStats.linesImproved += record.linesImproved;
			weekStats.avgProcessingTime =
				(weekStats.avgProcessingTime * (weekStats.improvements - 1) + record.processingTime) / weekStats.improvements;

			// Update monthly stats
			const month = this.getMonth();
			if (!this.stats.monthlyStats[month]) {
				this.stats.monthlyStats[month] = {
					improvements: 0,
					linesImproved: 0,
					avgProcessingTime: 0,
					tokensUsed: 0
				};
			}
			const monthStats = this.stats.monthlyStats[month];
			monthStats.improvements++;
			monthStats.linesImproved += record.linesImproved;
			monthStats.tokensUsed += record.tokensUsed;
			monthStats.avgProcessingTime =
				(monthStats.avgProcessingTime * (monthStats.improvements - 1) + record.processingTime) / monthStats.improvements;

			// Update yearly stats
			const year = this.getYear();
			if (!this.stats.yearlyStats[year]) {
				this.stats.yearlyStats[year] = {
					improvements: 0,
					linesImproved: 0,
					avgProcessingTime: 0,
					tokensUsed: 0
				};
			}
			const yearStats = this.stats.yearlyStats[year];
			yearStats.improvements++;
			yearStats.linesImproved += record.linesImproved;
			yearStats.tokensUsed += record.tokensUsed;
			yearStats.avgProcessingTime =
				(yearStats.avgProcessingTime * (yearStats.improvements - 1) + record.processingTime) / yearStats.improvements;

			// Update performance metrics
			this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalImprovements;

			if (this.stats.fastestImprovement === 0 || record.processingTime < this.stats.fastestImprovement) {
				this.stats.fastestImprovement = record.processingTime;
			}

			if (record.processingTime > this.stats.slowestImprovement) {
				this.stats.slowestImprovement = record.processingTime;
			}

			// Update usage patterns
			const date = new Date(fullRecord.timestamp);
			const hour = date.getHours().toString();
			const dayOfWeek = date.getDay().toString();

			this.stats.improvementsByHour[hour] = (this.stats.improvementsByHour[hour] || 0) + 1;
			this.stats.improvementsByDayOfWeek[dayOfWeek] = (this.stats.improvementsByDayOfWeek[dayOfWeek] || 0) + 1;

			// Find most active hour and day
			this.stats.mostActiveHour = parseInt(Object.entries(this.stats.improvementsByHour)
				.sort(([, a], [, b]) => b - a)[0]?.[0] || "0");

			this.stats.mostActiveDayOfWeek = parseInt(Object.entries(this.stats.improvementsByDayOfWeek)
				.sort(([, a], [, b]) => b - a)[0]?.[0] || "0");

			// Add to recent improvements (keep last 50)
			this.stats.recentImprovements.unshift(fullRecord);
			if (this.stats.recentImprovements.length > 50) {
				this.stats.recentImprovements = this.stats.recentImprovements.slice(0, 50);
			}

			// Save updated stats
			this.saveStatistics();

			logger.info("İstatistik kaydedildi:", {
				type: record.type,
				language: record.language,
				linesImproved: record.linesImproved,
				processingTime: record.processingTime,
				provider: record.provider,
				model: record.model
			});

			// Emit events for real-time updates
			this.emit("improvement", fullRecord);
			this.emit("statisticsChanged", this.getDetailedStatistics());

		} catch (error) {
			logger.error("İstatistik kaydetme hatası:", error);
		}
	}

	recordError(type: string, message: string): void {
		try {
			this.stats.errors.total++;
			this.stats.errors.byType[type] = (this.stats.errors.byType[type] || 0) + 1;

			const errorRecord = {
				type,
				message,
				timestamp: Date.now()
			};

			this.stats.errors.recent.unshift(errorRecord);

			// Keep only last 20 errors
			if (this.stats.errors.recent.length > 20) {
				this.stats.errors.recent = this.stats.errors.recent.slice(0, 20);
			}

			this.saveStatistics();

			// Emit error event for real-time updates
			this.emit("error", errorRecord);
			this.emit("statisticsChanged", this.getDetailedStatistics());
		} catch (error) {
			logger.error("Hata istatistiği kaydetme hatası:", error);
		}
	}

	getDetailedStatistics(): DetailedStatistics {
		return { ...this.stats };
	}

	getTodayStatistics(): { improvements: number; linesImproved: number } {
		const today = this.getToday();
		return this.stats.dailyStats[today] || { improvements: 0, linesImproved: 0 };
	}

	getThisMonthStatistics(): { improvements: number; linesImproved: number; tokensUsed: number; avgProcessingTime: number } {
		const month = this.getMonth();
		return this.stats.monthlyStats[month] || { improvements: 0, linesImproved: 0, tokensUsed: 0, avgProcessingTime: 0 };
	}

	getThisWeekStatistics(): { improvements: number; linesImproved: number; avgProcessingTime: number } {
		const weekStart = this.getWeekStart(new Date());
		return this.stats.weeklyStats[weekStart] || { improvements: 0, linesImproved: 0, avgProcessingTime: 0 };
	}

	getThisYearStatistics(): { improvements: number; linesImproved: number; tokensUsed: number; avgProcessingTime: number } {
		const year = this.getYear();
		return this.stats.yearlyStats[year] || { improvements: 0, linesImproved: 0, tokensUsed: 0, avgProcessingTime: 0 };
	}

	getProviderComparison(): Array<{ provider: string; stats: any }> {
		return Object.entries(this.stats.providerStats).map(([provider, stats]) => ({
			provider,
			stats
		})).sort((a, b) => b.stats.count - a.stats.count);
	}

	getModelComparison(): Array<{ model: string; stats: any }> {
		return Object.entries(this.stats.modelStats).map(([model, stats]) => ({
			model,
			stats
		})).sort((a, b) => b.stats.count - a.stats.count);
	}

	getLanguageRanking(): Array<{ language: string; stats: any }> {
		return Object.entries(this.stats.languageStats).map(([language, stats]) => ({
			language,
			stats
		})).sort((a, b) => b.stats.count - a.stats.count);
	}

	getWcagCriteriaRanking(): Array<{ criterion: string; count: number }> {
		return Object.entries(this.stats.wcagCriteriaStats).map(([criterion, count]) => ({
			criterion,
			count
		})).sort((a, b) => b.count - a.count);
	}

	getWeeklyTrend(): Array<{ week: string; stats: any }> {
		return Object.entries(this.stats.weeklyStats).map(([week, stats]) => ({
			week,
			stats
		})).sort((a, b) => a.week.localeCompare(b.week));
	}

	getUsagePatterns(): {
		byHour: Array<{ hour: number; count: number }>;
		byDayOfWeek: Array<{ day: number; dayName: string; count: number }>;
		mostActiveHour: number;
		mostActiveDayOfWeek: number;
	} {
		const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

		return {
			byHour: Object.entries(this.stats.improvementsByHour).map(([hour, count]) => ({
				hour: parseInt(hour),
				count
			})).sort((a, b) => a.hour - b.hour),

			byDayOfWeek: Object.entries(this.stats.improvementsByDayOfWeek).map(([day, count]) => ({
				day: parseInt(day),
				dayName: dayNames[parseInt(day)],
				count
			})).sort((a, b) => a.day - b.day),

			mostActiveHour: this.stats.mostActiveHour,
			mostActiveDayOfWeek: this.stats.mostActiveDayOfWeek
		};
	}

	resetStatistics(): void {
		this.stats = this.createEmptyStats();
		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("statisticsReset");
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info("İstatistikler sıfırlandı");
	}

	resetDailyStatistics(): void {
		const today = this.getToday();
		if (this.stats.dailyStats[today]) {
			delete this.stats.dailyStats[today];
		}
		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("dailyStatisticsReset", today);
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info(`Günlük istatistikler sıfırlandı: ${today}`);
	}

	resetMonthlyStatistics(): void {
		const currentMonth = this.getMonth();

		// Bu ayın tüm günlük istatistiklerini sıfırla
		Object.keys(this.stats.dailyStats).forEach(date => {
			if (date.startsWith(currentMonth)) {
				delete this.stats.dailyStats[date];
			}
		});

		// Bu ayın aylık istatistiklerini sıfırla
		if (this.stats.monthlyStats[currentMonth]) {
			delete this.stats.monthlyStats[currentMonth];
		}

		// Bu ayın haftalık istatistiklerini sıfırla
		Object.keys(this.stats.weeklyStats).forEach(weekStart => {
			if (weekStart.startsWith(currentMonth)) {
				delete this.stats.weeklyStats[weekStart];
			}
		});

		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("monthlyStatisticsReset", currentMonth);
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info(`Aylık istatistikler sıfırlandı: ${currentMonth}`);
	}

	resetYearlyStatistics(): void {
		const currentYear = this.getYear();

		// Bu yılın tüm günlük istatistiklerini sıfırla
		Object.keys(this.stats.dailyStats).forEach(date => {
			if (date.startsWith(currentYear)) {
				delete this.stats.dailyStats[date];
			}
		});

		// Bu yılın tüm aylık istatistiklerini sıfırla
		Object.keys(this.stats.monthlyStats).forEach(month => {
			if (month.startsWith(currentYear)) {
				delete this.stats.monthlyStats[month];
			}
		});

		// Bu yılın tüm haftalık istatistiklerini sıfırla
		Object.keys(this.stats.weeklyStats).forEach(weekStart => {
			if (weekStart.startsWith(currentYear)) {
				delete this.stats.weeklyStats[weekStart];
			}
		});

		// Bu yılın yıllık istatistiklerini sıfırla
		if (this.stats.yearlyStats[currentYear]) {
			delete this.stats.yearlyStats[currentYear];
		}

		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("yearlyStatisticsReset", currentYear);
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info(`Yıllık istatistikler sıfırlandı: ${currentYear}`);
	}

	resetWeeklyStatistics(): void {
		const weekStart = this.getWeekStart(new Date());
		if (this.stats.weeklyStats[weekStart]) {
			delete this.stats.weeklyStats[weekStart];
		}
		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("weeklyStatisticsReset", weekStart);
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info(`Haftalık istatistikler sıfırlandı: ${weekStart}`);
	}

	resetLanguageStatistics(language: string): void {
		if (this.stats.languageStats[language]) {
			delete this.stats.languageStats[language];
		}
		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("languageStatisticsReset", language);
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info(`Dil istatistikleri sıfırlandı: ${language}`);
	}

	resetProviderStatistics(provider: string): void {
		if (this.stats.providerStats[provider]) {
			delete this.stats.providerStats[provider];
		}
		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("providerStatisticsReset", provider);
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info(`Sağlayıcı istatistikleri sıfırlandı: ${provider}`);
	}

	resetWcagCriteriaStatistics(): void {
		this.stats.wcagCriteriaStats = {};
		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("wcagCriteriaStatisticsReset");
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info("WCAG kriterleri istatistikleri sıfırlandı");
	}

	resetErrorStatistics(): void {
		this.stats.errors = {
			total: 0,
			byType: {},
			recent: []
		};
		this.saveStatistics();

		// Emit reset event for real-time updates
		this.emit("errorStatisticsReset");
		this.emit("statisticsChanged", this.getDetailedStatistics());

		logger.info("Hata istatistikleri sıfırlandı");
	}

	exportStatistics(): any {
		return {
			...this.stats,
			exportedAt: new Date().toISOString(),
			version: "1.0.0"
		};
	}

	private loadStatistics(): DetailedStatistics {
		try {
			const stored = this.context.globalState.get<DetailedStatistics>("wcagEnhancer.statistics");
			if (stored) {
				// Migrate old data if needed
				return this.migrateStatistics(stored);
			}
		} catch (error) {
			logger.error("İstatistik yükleme hatası:", error);
		}
		return this.createEmptyStats();
	}

	private migrateStatistics(oldStats: any): DetailedStatistics {
		// Ensure all new fields exist
		const newStats = this.createEmptyStats();

		// Copy existing data
		Object.assign(newStats, oldStats);

		// Add missing fields with defaults
		if (!newStats.providerStats) newStats.providerStats = {};
		if (!newStats.modelStats) newStats.modelStats = {};
		if (!newStats.weeklyStats) newStats.weeklyStats = {};
		if (!newStats.monthlyStats) newStats.monthlyStats = {};
		if (!newStats.improvementsByHour) newStats.improvementsByHour = {};
		if (!newStats.improvementsByDayOfWeek) newStats.improvementsByDayOfWeek = {};
		if (typeof newStats.averageProcessingTime !== "number") newStats.averageProcessingTime = 0;
		if (typeof newStats.fastestImprovement !== "number") newStats.fastestImprovement = 0;
		if (typeof newStats.slowestImprovement !== "number") newStats.slowestImprovement = 0;
		if (typeof newStats.mostActiveHour !== "number") newStats.mostActiveHour = 0;
		if (typeof newStats.mostActiveDayOfWeek !== "number") newStats.mostActiveDayOfWeek = 0;

		return newStats;
	}

	private saveStatistics(): void {
		try {
			this.context.globalState.update("wcagEnhancer.statistics", this.stats);
		} catch (error) {
			logger.error("İstatistik kaydetme hatası:", error);
		}
	}

	private createEmptyStats(): DetailedStatistics {
		return {
			totalImprovements: 0,
			totalLinesImproved: 0,
			totalProcessingTime: 0,
			totalTokensUsed: 0,
			languageStats: {},
			wcagCriteriaStats: {},
			dailyStats: {},
			providerStats: {},
			modelStats: {},
			weeklyStats: {},
			monthlyStats: {},
			yearlyStats: {},
			recentImprovements: [],
			errors: {
				total: 0,
				byType: {},
				recent: []
			},
			averageProcessingTime: 0,
			fastestImprovement: 0,
			slowestImprovement: 0,
			mostActiveHour: 0,
			mostActiveDayOfWeek: 0,
			improvementsByHour: {},
			improvementsByDayOfWeek: {}
		};
	}

	private getToday(): string {
		return new Date().toISOString().split("T")[0];
	}

	private getMonth(): string {
		return new Date().toISOString().slice(0, 7); // YYYY-MM
	}

	private getWeekStart(date: Date): string {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi'yi hafta başı yap
		d.setDate(diff);
		return d.toISOString().split("T")[0];
	}

	private getYear(): string {
		return new Date().getFullYear().toString();
	}

	// Advanced Token Analytics Methods
	getTokenAnalytics() {
		return this.tokenAnalytics.getTokenAnalytics();
	}

	predictTokenUsage(code: string, language: string, operationType: "improvement" | "analysis" | "jira") {
		return this.tokenAnalytics.predictTokenUsage(code, language, operationType);
	}

	getTokenCostBreakdown() {
		const analytics = this.tokenAnalytics.getTokenAnalytics();
		return {
			totalCost: analytics.totalCost,
			costByModel: analytics.costByModel,
			costByProvider: analytics.costByProvider,
			costByLanguage: analytics.costByLanguage,
			efficiency: analytics.efficiency,
			recommendations: analytics.recommendations
		};
	}

	getTokenTrends() {
		const analytics = this.tokenAnalytics.getTokenAnalytics();
		return analytics.trends;
	}

	getOptimizationRecommendations() {
		const analytics = this.tokenAnalytics.getTokenAnalytics();
		return {
			mostEfficientModel: analytics.recommendations.mostEfficientModel,
			costSavingTips: analytics.recommendations.costSavingTips,
			optimizationScore: analytics.recommendations.optimizationScore,
			efficiency: analytics.efficiency
		};
	}

	estimateOperationCost(code: string, language: string, model?: string) {
		const tokenEstimate = this.tokenAnalytics.estimateTokensFromCode(code, language);
		const targetModel = model || "gemini-2.5-flash";
		const cost = this.tokenAnalytics.calculateTokenCost(targetModel, tokenEstimate.input, tokenEstimate.output);

		return {
			estimatedTokens: tokenEstimate.input + tokenEstimate.output,
			estimatedCost: cost,
			model: targetModel,
			breakdown: {
				inputTokens: tokenEstimate.input,
				outputTokens: tokenEstimate.output
			}
		};
	}

	getTokenPricing() {
		const models = [
			"gemini-2.5-flash",
			"gemini-2.5-pro",
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-4",
			"gpt-3.5-turbo"
		];
		return models.map(model => {
			const pricing = this.tokenAnalytics.getTokenPrice(model);
			return {
				model,
				pricing,
				available: !!pricing
			};
		});
	}

	recordJiraTaskCreation(model: string, provider: "gemini" | "vscode-copilot", tokensUsed: number, processingTime: number) {
		this.tokenAnalytics.recordTokenUsage({
			model,
			provider,
			tokensUsed,
			inputTokens: Math.ceil(tokensUsed * 0.6), // Jira tasks typically have less output
			outputTokens: Math.ceil(tokensUsed * 0.4),
			operationType: "jira",
			codeLanguage: "text",
			linesProcessed: 1,
			processingTime
		});
	}

	recordCodeAnalysis(model: string, provider: "gemini" | "vscode-copilot", tokensUsed: number, language: string, linesAnalyzed: number, processingTime: number) {
		this.tokenAnalytics.recordTokenUsage({
			model,
			provider,
			tokensUsed,
			inputTokens: Math.ceil(tokensUsed * 0.8), // Analysis uses more input
			outputTokens: Math.ceil(tokensUsed * 0.2),
			operationType: "analysis",
			codeLanguage: language,
			linesProcessed: linesAnalyzed,
			processingTime
		});
	}

	exportTokenAnalytics() {
		return this.tokenAnalytics.exportTokenData();
	}

	resetTokenAnalytics() {
		this.tokenAnalytics.resetTokenData();
	}
}