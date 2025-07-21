"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsTracker = void 0;
const logger_1 = require("../utils/logger");
class StatisticsTracker {
    constructor(context) {
        this.context = context;
        this.stats = this.loadStatistics();
    }
    // Improvement tracking
    recordImprovement(type, language, details) {
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
            logger_1.logger.info(`İstatistik kaydedildi: ${type} iyileştirmesi, ${details.linesImproved} satır, ${language}`);
        }
        catch (error) {
            logger_1.logger.error("İstatistik kaydetme hatası:", error);
        }
    }
    // Analysis tracking
    recordAnalysis(language, issuesFound, analysisTime) {
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
            logger_1.logger.info(`Analiz istatistiği kaydedildi: ${language}, ${issuesFound} sorun, ${analysisTime}ms`);
        }
        catch (error) {
            logger_1.logger.error("Analiz istatistiği kaydetme hatası:", error);
        }
    }
    // Report generation tracking
    recordReportGeneration(language, issuesCount) {
        try {
            this.stats.totalReports++;
            this.saveStatistics();
            logger_1.logger.info(`Rapor istatistiği kaydedildi: ${language}, ${issuesCount} sorun`);
        }
        catch (error) {
            logger_1.logger.error("Rapor istatistiği kaydetme hatası:", error);
        }
    }
    // Chat interaction tracking
    recordChatInteraction(userMessage, aiResponse) {
        try {
            this.stats.totalChatInteractions++;
            // Estimate tokens used (rough estimation)
            const estimatedTokens = Math.ceil((userMessage.length + aiResponse.length) / 4);
            this.stats.totalTokensUsed += estimatedTokens;
            this.saveStatistics();
            logger_1.logger.info(`Chat istatistiği kaydedildi: ${estimatedTokens} tahmini token`);
        }
        catch (error) {
            logger_1.logger.error("Chat istatistiği kaydetme hatası:", error);
        }
    }
    // Specific improvement tracking
    recordSpecificImprovement(type, language) {
        try {
            // Record as a regular improvement with estimated values
            this.recordImprovement("selection", language, {
                linesImproved: 1,
                wcagCriteria: this.getWcagCriteriaForType(type),
                improvementTime: 1000,
                tokensUsed: 100 // Rough estimate
            });
            logger_1.logger.info(`Spesifik iyileştirme kaydedildi: ${type}, ${language}`);
        }
        catch (error) {
            logger_1.logger.error("Spesifik iyileştirme kaydetme hatası:", error);
        }
    }
    // Error tracking
    recordError(type, message) {
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
            logger_1.logger.info(`Hata istatistiği kaydedildi: ${type} - ${message}`);
        }
        catch (error) {
            logger_1.logger.error("Hata istatistiği kaydetme hatası:", error);
        }
    }
    // Get detailed statistics
    getDetailedStatistics() {
        return Object.assign({}, this.stats);
    }
    // Get summary statistics
    getSummaryStatistics() {
        var _a, _b;
        const totalTimeFormatted = this.formatTime(this.stats.totalTime);
        const successRate = `${(this.stats.performance.successRate * 100).toFixed(1)}%`;
        // Find top language
        const topLanguage = ((_a = Object.entries(this.stats.languageStats)
            .sort(([, a], [, b]) => b.improvements - a.improvements)[0]) === null || _a === void 0 ? void 0 : _a[0]) || "N/A";
        // Find top WCAG criterion
        const topWcagCriterion = ((_b = Object.entries(this.stats.wcagCriteriaStats)
            .sort(([, a], [, b]) => b.count - a.count)[0]) === null || _b === void 0 ? void 0 : _b[0]) || "N/A";
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
    resetStatistics() {
        this.stats = this.createEmptyStatistics();
        this.saveStatistics();
        logger_1.logger.info("İstatistikler sıfırlandı");
    }
    // Export statistics
    exportStatistics() {
        return JSON.stringify(this.stats, null, 2);
    }
    // Private methods
    loadStatistics() {
        try {
            const savedStats = this.context.globalState.get("wcagEnhancer.statistics");
            if (savedStats) {
                // Merge with empty stats to ensure all properties exist
                return Object.assign(Object.assign({}, this.createEmptyStatistics()), savedStats);
            }
        }
        catch (error) {
            logger_1.logger.error("İstatistik yükleme hatası:", error);
        }
        return this.createEmptyStatistics();
    }
    saveStatistics() {
        try {
            this.context.globalState.update("wcagEnhancer.statistics", this.stats);
        }
        catch (error) {
            logger_1.logger.error("İstatistik kaydetme hatası:", error);
        }
    }
    createEmptyStatistics() {
        return {
            totalImprovements: 0,
            totalLinesImproved: 0,
            totalAnalyses: 0,
            totalReports: 0,
            totalChatInteractions: 0,
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
    updatePerformanceMetrics() {
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
    getToday() {
        return new Date().toISOString().split("T")[0];
    }
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}s ${minutes % 60}d ${seconds % 60}sn`;
        }
        else if (minutes > 0) {
            return `${minutes}d ${seconds % 60}sn`;
        }
        else {
            return `${seconds}sn`;
        }
    }
    getWcagCriteriaForType(type) {
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
exports.StatisticsTracker = StatisticsTracker;
