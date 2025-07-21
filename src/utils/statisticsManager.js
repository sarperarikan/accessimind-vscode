"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statisticsManager = void 0;
// statisticsManager.ts
const vscode = __importStar(require("vscode"));
class StatisticsManager {
    constructor(context) {
        this.context = context;
        this.stats = this.loadStats();
    }
    loadStats() {
        const defaultStats = {
            totalCodeStructures: 0,
            agentModeCount: 0,
            editModeCount: 0,
            debugModeCount: 0,
            quickImproveCount: 0,
            lastEnhancement: "",
            enhancementHistory: [],
            apiUsageCount: 0,
            errorsCount: 0,
            codeStructuresByType: {},
            accessibilityIssuesFixed: 0,
            ariaLabelsAdded: 0,
            formsEnhanced: 0,
            tablesImproved: 0,
            imagesOptimized: 0,
            dailyStats: {},
            weeklyStats: {},
            monthlyStats: {},
            yearlyStats: {},
            quarterlyStats: {},
            wcagCriteriaStats: {},
            codeStructureImprovements: {
                totalElementsImproved: 0,
                htmlElements: {},
                cssProperties: {},
                javascriptFunctions: {},
                ariaAttributes: {},
                semanticElements: {},
                accessibilityFeatures: {}
            }
        };
        try {
            const savedStats = this.context.globalState.get("enhancementStats");
            return savedStats || defaultStats;
        }
        catch (error) {
            console.error("Stats load error:", error);
            return defaultStats;
        }
    }
    saveStats() {
        try {
            this.context.globalState.update("enhancementStats", this.stats);
        }
        catch (error) {
            console.error("Stats save error:", error);
        }
    }
    getCurrentDate() {
        return new Date().toISOString().split("T")[0];
    }
    getCurrentWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil(days / 7);
        return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
    }
    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    }
    getCurrentYear() {
        return new Date().getFullYear();
    }
    getCurrentQuarter() {
        const now = new Date();
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        return `Q${quarter}-${now.getFullYear()}`;
    }
    updateTimeBasedStats(record) {
        const date = this.getCurrentDate();
        const week = this.getCurrentWeek();
        const month = this.getCurrentMonth();
        const year = this.getCurrentYear();
        const quarter = this.getCurrentQuarter();
        // Günlük istatistikleri güncelle
        if (!this.stats.dailyStats[date]) {
            this.stats.dailyStats[date] = {
                date,
                totalEnhancements: 0,
                successfulEnhancements: 0,
                failedEnhancements: 0,
                apiCalls: 0,
                errors: 0,
                enhancementTypes: {},
                wcagCriteriaUsed: {},
                codeStructuresImproved: 0
            };
        }
        const dailyStats = this.stats.dailyStats[date];
        dailyStats.totalEnhancements++;
        if (record.success) {
            dailyStats.successfulEnhancements++;
        }
        else {
            dailyStats.failedEnhancements++;
            dailyStats.errors++;
        }
        dailyStats.apiCalls++;
        dailyStats.codeStructuresImproved += record.codeStructuresEnhanced || 1;
        // Haftalık istatistikleri güncelle
        if (!this.stats.weeklyStats[week]) {
            this.stats.weeklyStats[week] = {
                week,
                year,
                weekNumber: parseInt(week.split("-W")[1]),
                totalEnhancements: 0,
                successfulEnhancements: 0,
                failedEnhancements: 0,
                apiCalls: 0,
                errors: 0,
                dailyBreakdown: {},
                enhancementTypes: {},
                wcagCriteriaUsed: {},
                codeStructuresImproved: 0
            };
        }
        const weeklyStats = this.stats.weeklyStats[week];
        weeklyStats.totalEnhancements++;
        if (record.success) {
            weeklyStats.successfulEnhancements++;
        }
        else {
            weeklyStats.failedEnhancements++;
            weeklyStats.errors++;
        }
        weeklyStats.apiCalls++;
        weeklyStats.codeStructuresImproved += record.codeStructuresEnhanced || 1;
        weeklyStats.dailyBreakdown[date] = (weeklyStats.dailyBreakdown[date] || 0) + 1;
        // Aylık istatistikleri güncelle
        if (!this.stats.monthlyStats[month]) {
            this.stats.monthlyStats[month] = {
                month,
                year,
                totalEnhancements: 0,
                successfulEnhancements: 0,
                failedEnhancements: 0,
                apiCalls: 0,
                errors: 0,
                weeklyBreakdown: {},
                enhancementTypes: {},
                wcagCriteriaUsed: {},
                codeStructuresImproved: 0
            };
        }
        const monthlyStats = this.stats.monthlyStats[month];
        monthlyStats.totalEnhancements++;
        if (record.success) {
            monthlyStats.successfulEnhancements++;
        }
        else {
            monthlyStats.failedEnhancements++;
            monthlyStats.errors++;
        }
        monthlyStats.apiCalls++;
        monthlyStats.codeStructuresImproved += record.codeStructuresEnhanced || 1;
        monthlyStats.weeklyBreakdown[week] = (monthlyStats.weeklyBreakdown[week] || 0) + 1;
        // Yıllık istatistikleri güncelle
        if (!this.stats.yearlyStats[year]) {
            this.stats.yearlyStats[year] = {
                year,
                totalEnhancements: 0,
                successfulEnhancements: 0,
                failedEnhancements: 0,
                apiCalls: 0,
                errors: 0,
                monthlyBreakdown: {},
                enhancementTypes: {},
                wcagCriteriaUsed: {},
                codeStructuresImproved: 0
            };
        }
        const yearlyStats = this.stats.yearlyStats[year];
        yearlyStats.totalEnhancements++;
        if (record.success) {
            yearlyStats.successfulEnhancements++;
        }
        else {
            yearlyStats.failedEnhancements++;
            yearlyStats.errors++;
        }
        yearlyStats.apiCalls++;
        yearlyStats.codeStructuresImproved += record.codeStructuresEnhanced || 1;
        yearlyStats.monthlyBreakdown[month] = (yearlyStats.monthlyBreakdown[month] || 0) + 1;
        // Çeyreklik istatistikleri güncelle
        if (!this.stats.quarterlyStats[quarter]) {
            this.stats.quarterlyStats[quarter] = {
                quarter,
                year,
                quarterNumber: parseInt(quarter.split("-")[0].substring(1)),
                totalEnhancements: 0,
                successfulEnhancements: 0,
                failedEnhancements: 0,
                apiCalls: 0,
                errors: 0,
                monthlyBreakdown: {},
                enhancementTypes: {},
                wcagCriteriaUsed: {},
                codeStructuresImproved: 0
            };
        }
        const quarterlyStats = this.stats.quarterlyStats[quarter];
        quarterlyStats.totalEnhancements++;
        if (record.success) {
            quarterlyStats.successfulEnhancements++;
        }
        else {
            quarterlyStats.failedEnhancements++;
            quarterlyStats.errors++;
        }
        quarterlyStats.apiCalls++;
        quarterlyStats.codeStructuresImproved += record.codeStructuresEnhanced || 1;
        quarterlyStats.monthlyBreakdown[month] = (quarterlyStats.monthlyBreakdown[month] || 0) + 1;
    }
    updateWCAGCriteriaStats(record) {
        if (record.wcagCriteriaUsed) {
            record.wcagCriteriaUsed.forEach(criterion => {
                if (!this.stats.wcagCriteriaStats[criterion]) {
                    this.stats.wcagCriteriaStats[criterion] = {
                        criterion,
                        description: this.getWCAGDescription(criterion),
                        usageCount: 0,
                        successCount: 0,
                        failureCount: 0,
                        lastUsed: record.timestamp,
                        enhancementTypes: {}
                    };
                }
                const criterionStats = this.stats.wcagCriteriaStats[criterion];
                criterionStats.usageCount++;
                criterionStats.lastUsed = record.timestamp;
                if (record.success) {
                    criterionStats.successCount++;
                }
                else {
                    criterionStats.failureCount++;
                }
                criterionStats.enhancementTypes[record.mode] = (criterionStats.enhancementTypes[record.mode] || 0) + 1;
            });
        }
    }
    updateCodeStructureStats(record) {
        if (record.enhancementDetails) {
            const details = record.enhancementDetails;
            // HTML elementleri
            if (details.htmlElementsImproved) {
                Object.entries(details.htmlElementsImproved).forEach(([element, count]) => {
                    this.stats.codeStructureImprovements.htmlElements[element] =
                        (this.stats.codeStructureImprovements.htmlElements[element] || 0) + count;
                    this.stats.codeStructureImprovements.totalElementsImproved += count;
                });
            }
            // CSS özellikleri
            if (details.cssPropertiesAdded) {
                Object.entries(details.cssPropertiesAdded).forEach(([property, count]) => {
                    this.stats.codeStructureImprovements.cssProperties[property] =
                        (this.stats.codeStructureImprovements.cssProperties[property] || 0) + count;
                });
            }
            // ARIA özellikleri
            if (details.ariaAttributesAdded) {
                Object.entries(details.ariaAttributesAdded).forEach(([attribute, count]) => {
                    this.stats.codeStructureImprovements.ariaAttributes[attribute] =
                        (this.stats.codeStructureImprovements.ariaAttributes[attribute] || 0) + count;
                });
            }
            // Semantik iyileştirmeler
            if (details.semanticImprovements) {
                Object.entries(details.semanticImprovements).forEach(([improvement, count]) => {
                    this.stats.codeStructureImprovements.semanticElements[improvement] =
                        (this.stats.codeStructureImprovements.semanticElements[improvement] || 0) + count;
                });
            }
            // Erişilebilirlik özellikleri
            if (details.accessibilityFeaturesAdded) {
                Object.entries(details.accessibilityFeaturesAdded).forEach(([feature, count]) => {
                    this.stats.codeStructureImprovements.accessibilityFeatures[feature] =
                        (this.stats.codeStructureImprovements.accessibilityFeatures[feature] || 0) + count;
                });
            }
        }
    }
    getWCAGDescription(criterion) {
        const descriptions = {
            "1.1.1": "Non-text Content - Provide text alternatives for non-text content",
            "1.2.1": "Audio-only and Video-only - Provide alternatives for time-based media",
            "1.2.2": "Captions - Provide captions for all prerecorded audio content",
            "1.2.3": "Audio Description - Provide audio descriptions for video content",
            "1.3.1": "Info and Relationships - Structure information and relationships",
            "1.3.2": "Meaningful Sequence - Present content in a meaningful sequence",
            "1.3.3": "Sensory Characteristics - Do not rely solely on sensory characteristics",
            "1.4.1": "Use of Color - Do not use color as the only visual means of conveying information",
            "1.4.2": "Audio Control - Provide user control for audio content",
            "2.1.1": "Keyboard - Make all functionality available from a keyboard",
            "2.1.2": "No Keyboard Trap - Ensure no keyboard trap exists",
            "2.2.1": "Timing Adjustable - Allow users to adjust timing",
            "2.2.2": "Pause, Stop, Hide - Provide user control for moving content",
            "2.3.1": "Three Flashes - Avoid content that flashes more than three times",
            "2.4.1": "Bypass Blocks - Provide ways to bypass repeated blocks",
            "2.4.2": "Page Titled - Provide descriptive page titles",
            "2.4.3": "Focus Order - Ensure logical focus order",
            "2.4.4": "Link Purpose - Make link purpose clear from context",
            "2.5.1": "Pointer Gestures - Support pointer gestures",
            "2.5.2": "Pointer Cancellation - Allow cancellation of pointer actions",
            "2.5.3": "Label in Name - Ensure labels match accessible names",
            "2.5.4": "Motion Actuation - Support motion actuation",
            "3.1.1": "Language of Page - Specify the language of the page",
            "3.1.2": "Language of Parts - Specify the language of parts",
            "3.2.1": "On Focus - Do not change context on focus",
            "3.2.2": "On Input - Do not change context on input",
            "3.3.1": "Error Identification - Identify and describe errors",
            "3.3.2": "Labels or Instructions - Provide labels or instructions",
            "3.3.3": "Error Suggestion - Provide suggestions for errors",
            "3.3.4": "Error Prevention - Help users avoid and correct mistakes",
            "4.1.1": "Parsing - Ensure content can be parsed by assistive technologies",
            "4.1.2": "Name, Role, Value - Provide accessible names and roles",
            "4.1.3": "Status Messages - Provide status messages to assistive technologies"
        };
        return descriptions[criterion] || "Unknown WCAG criterion";
    }
    recordEnhancement(mode, success, fileType = "unknown", error, enhancementDetails) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        if (!config.get("enableStats", true)) {
            return;
        }
        this.stats.totalCodeStructures++;
        this.stats.lastEnhancement = new Date().toISOString();
        switch (mode) {
            case "agent":
                this.stats.agentModeCount++;
                break;
            case "edit":
                this.stats.editModeCount++;
                break;
            case "debug":
                this.stats.debugModeCount++;
                break;
            case "quick":
                this.stats.quickImproveCount++;
                break;
        }
        if (success) {
            this.stats.apiUsageCount++;
        }
        else {
            this.stats.errorsCount++;
        }
        // Update code structures by type
        if (!this.stats.codeStructuresByType[fileType]) {
            this.stats.codeStructuresByType[fileType] = 0;
        }
        this.stats.codeStructuresByType[fileType]++;
        // Update enhancement details
        if (enhancementDetails) {
            if (enhancementDetails.accessibilityIssuesFixed) {
                this.stats.accessibilityIssuesFixed += enhancementDetails.accessibilityIssuesFixed;
            }
            if (enhancementDetails.ariaLabelsAdded) {
                this.stats.ariaLabelsAdded += enhancementDetails.ariaLabelsAdded;
            }
            if (enhancementDetails.formsEnhanced) {
                this.stats.formsEnhanced += enhancementDetails.formsEnhanced;
            }
            if (enhancementDetails.tablesImproved) {
                this.stats.tablesImproved += enhancementDetails.tablesImproved;
            }
            if (enhancementDetails.imagesOptimized) {
                this.stats.imagesOptimized += enhancementDetails.imagesOptimized;
            }
        }
        // Add to history (keep last 100 records)
        const record = {
            timestamp: new Date().toISOString(),
            mode,
            fileType,
            success,
            error,
            codeStructuresEnhanced: (enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.codeStructuresEnhanced) || 1,
            accessibilityIssuesFixed: (enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.accessibilityIssuesFixed) || 0,
            apiResponseTime: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.apiResponseTime,
            wcagCriteriaUsed: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.wcagCriteriaUsed,
            enhancementDetails: {
                htmlElementsImproved: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.htmlElementsImproved,
                cssPropertiesAdded: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.cssPropertiesAdded,
                ariaAttributesAdded: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.ariaAttributesAdded,
                semanticImprovements: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.semanticImprovements,
                accessibilityFeaturesAdded: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.accessibilityFeaturesAdded
            },
            progressPercentage: enhancementDetails === null || enhancementDetails === void 0 ? void 0 : enhancementDetails.progressPercentage
        };
        this.stats.enhancementHistory.unshift(record);
        if (this.stats.enhancementHistory.length > 100) {
            this.stats.enhancementHistory = this.stats.enhancementHistory.slice(0, 100);
        }
        // Update time-based statistics
        this.updateTimeBasedStats(record);
        // Update WCAG criteria statistics
        this.updateWCAGCriteriaStats(record);
        // Update code structure statistics
        this.updateCodeStructureStats(record);
        this.saveStats();
    }
    // API yanıtından otomatik istatistik kaydetme
    recordApiResponse(mode, success, fileType = "unknown", apiResponseTime, wcagCriteriaUsed = [], enhancementDetails, error) {
        this.recordEnhancement(mode, success, fileType, error, Object.assign({ apiResponseTime,
            wcagCriteriaUsed }, enhancementDetails));
    }
    getStats() {
        return Object.assign({}, this.stats);
    }
    getStatistics() {
        return Object.assign({}, this.stats);
    }
    getDailyStats(date) {
        const targetDate = date || this.getCurrentDate();
        return this.stats.dailyStats[targetDate] || null;
    }
    getWeeklyStats(week) {
        const targetWeek = week || this.getCurrentWeek();
        return this.stats.weeklyStats[targetWeek] || null;
    }
    getMonthlyStats(month) {
        const targetMonth = month || this.getCurrentMonth();
        return this.stats.monthlyStats[targetMonth] || null;
    }
    getYearlyStats(year) {
        const targetYear = year || this.getCurrentYear();
        return this.stats.yearlyStats[targetYear] || null;
    }
    getQuarterlyStats(quarter) {
        const targetQuarter = quarter || this.getCurrentQuarter();
        return this.stats.quarterlyStats[targetQuarter] || null;
    }
    getWCAGCriteriaStats() {
        return Object.assign({}, this.stats.wcagCriteriaStats);
    }
    getCodeStructureStats() {
        return Object.assign({}, this.stats.codeStructureImprovements);
    }
    resetStats() {
        this.stats = {
            totalCodeStructures: 0,
            agentModeCount: 0,
            editModeCount: 0,
            debugModeCount: 0,
            quickImproveCount: 0,
            lastEnhancement: "",
            enhancementHistory: [],
            apiUsageCount: 0,
            errorsCount: 0,
            codeStructuresByType: {},
            accessibilityIssuesFixed: 0,
            ariaLabelsAdded: 0,
            formsEnhanced: 0,
            tablesImproved: 0,
            imagesOptimized: 0,
            dailyStats: {},
            weeklyStats: {},
            monthlyStats: {},
            yearlyStats: {},
            quarterlyStats: {},
            wcagCriteriaStats: {},
            codeStructureImprovements: {
                totalElementsImproved: 0,
                htmlElements: {},
                cssProperties: {},
                javascriptFunctions: {},
                ariaAttributes: {},
                semanticElements: {},
                accessibilityFeatures: {}
            }
        };
        this.saveStats();
    }
    resetStatistics() {
        this.resetStats();
    }
    getSuccessRate() {
        if (this.stats.totalCodeStructures === 0)
            return 0;
        return ((this.stats.totalCodeStructures - this.stats.errorsCount) / this.stats.totalCodeStructures) * 100;
    }
    getMostUsedMode() {
        const modes = [
            { name: "Agent", count: this.stats.agentModeCount },
            { name: "Edit", count: this.stats.editModeCount },
            { name: "Debug", count: this.stats.debugModeCount },
            { name: "Quick", count: this.stats.quickImproveCount }
        ];
        return modes.reduce((a, b) => a.count > b.count ? a : b).name;
    }
    getMostEnhancedFileType() {
        const entries = Object.entries(this.stats.codeStructuresByType);
        if (entries.length === 0)
            return "None";
        return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
    }
    getTotalAccessibilityImprovements() {
        return this.stats.accessibilityIssuesFixed + this.stats.ariaLabelsAdded +
            this.stats.formsEnhanced + this.stats.tablesImproved + this.stats.imagesOptimized;
    }
    getRecentActivity(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return this.stats.enhancementHistory.filter(record => new Date(record.timestamp) > cutoffDate);
    }
    getEnhancementSummary() {
        return {
            totalCodeStructures: this.stats.totalCodeStructures,
            accessibilityIssuesFixed: this.stats.accessibilityIssuesFixed,
            ariaLabelsAdded: this.stats.ariaLabelsAdded,
            formsEnhanced: this.stats.formsEnhanced,
            tablesImproved: this.stats.tablesImproved,
            imagesOptimized: this.stats.imagesOptimized,
            successRate: this.getSuccessRate()
        };
    }
    initialize(context) {
        this.context = context;
    }
    getInstance() {
        return this;
    }
}
// Singleton instance
let statisticsManagerInstance = null;
exports.statisticsManager = {
    initialize(context) {
        statisticsManagerInstance = new StatisticsManager(context);
    },
    getInstance() {
        if (!statisticsManagerInstance) {
            throw new Error("StatisticsManager not initialized. Call initialize() first.");
        }
        return statisticsManagerInstance;
    }
};
