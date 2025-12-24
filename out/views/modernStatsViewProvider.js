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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModernStatsViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class ModernStatsViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    setStatisticsManager(statisticsManager) {
        this._statisticsManager = statisticsManager;
        this.setupRealTimeListeners();
    }
    setupRealTimeListeners() {
        if (!this._statisticsManager)
            return;
        // Listen for real-time statistics changes
        this._statisticsManager.on("statisticsChanged", (stats) => {
            this.updateStatistics(stats);
        });
        logger_1.logger.info("ModernStatsViewProvider real-time listeners initialized");
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            enableCommandUris: true,
            enableForms: true,
            localResourceRoots: [this._extensionUri],
            portMapping: []
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "getStats":
                    this.updateStats();
                    break;
                case "resetStats":
                    await this.showResetMenu();
                    break;
                case "resetDaily":
                    await this.resetPeriodStats("daily");
                    break;
                case "resetMonthly":
                    await this.resetPeriodStats("monthly");
                    break;
                case "resetYearly":
                    await this.resetPeriodStats("yearly");
                    break;
                case "resetAll":
                    await this.resetStats();
                    break;
                case "exportStats":
                    await this.exportStats(data.format, data.period);
                    break;
                case "refreshStats":
                    this.updateStats();
                    break;
                case "filterStats":
                    await this.filterStats(data.period, data.language);
                    break;
                case "showDetailedStats":
                    await this.showDetailedStatsPanel();
                    break;
                case "ready":
                    // View hazır olduğunda otomatik güncelleme başlat
                    this.startAutoUpdate();
                    this.updateStats();
                    break;
            }
        });
        // İlk istatistik yüklemesi
        this.updateStats();
    }
    dispose() {
        if (this._updateInterval) {
            global.clearInterval(this._updateInterval);
        }
    }
    startAutoUpdate() {
        // Her 30 saniyede bir istatistikleri güncelle
        if (this._updateInterval) {
            global.clearInterval(this._updateInterval);
        }
        this._updateInterval = global.setInterval(() => {
            this.updateStats();
        }, 30000);
    }
    // Dış kullanım için updateStatistics metodu
    updateStatistics(stats) {
        if (!this._view)
            return;
        try {
            const processedStats = this.processStatistics(stats);
            this._view.webview.postMessage({
                type: "updateStats",
                stats: processedStats
            });
        }
        catch (error) {
            console.error("Statistics update error:", error);
        }
    }
    processStatistics(stats) {
        const successRate = stats.totalImprovements > 0
            ? Math.round((stats.totalImprovements / (stats.totalImprovements + stats.errors.total)) * 100)
            : 100;
        // Günlük istatistikler
        const today = new Date().toISOString().split("T")[0];
        const todayStats = stats.dailyStats[today] || { improvements: 0, linesImproved: 0, processingTime: 0 };
        // Bu ay istatistikleri
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
        const monthlyStats = Object.entries(stats.dailyStats)
            .filter(([date]) => date.startsWith(currentMonth))
            .reduce((acc, [, dayStats]) => ({
            improvements: acc.improvements + dayStats.improvements,
            linesImproved: acc.linesImproved + dayStats.linesImproved,
            processingTime: acc.processingTime + 0
        }), { improvements: 0, linesImproved: 0, processingTime: 0 });
        // En çok kullanılan dil
        const topLanguage = Object.entries(stats.languageStats)
            .sort(([, a], [, b]) => b.count - a.count)[0];
        // En çok uygulanan WCAG kriteri
        const topWcagCriteria = Object.entries(stats.wcagCriteriaStats)
            .sort(([, a], [, b]) => b - a)[0];
        return {
            // Genel istatistikler
            totalImprovements: stats.totalImprovements,
            totalLinesImproved: stats.totalLinesImproved,
            totalTokensUsed: stats.totalTokensUsed,
            totalTime: this.formatTime(stats.totalProcessingTime),
            successRate: successRate,
            averageProcessingTime: Math.round(stats.totalImprovements > 0 ? stats.totalProcessingTime / stats.totalImprovements : 0),
            // Günlük istatistikler
            today: {
                improvements: todayStats.improvements,
                linesImproved: todayStats.linesImproved,
                processingTime: 0
            },
            // Aylık istatistikler
            thisMonth: {
                improvements: monthlyStats.improvements,
                linesImproved: monthlyStats.linesImproved,
                processingTime: Math.round(monthlyStats.processingTime)
            },
            // Dil istatistikleri
            languageStats: stats.languageStats,
            topLanguage: topLanguage ? {
                name: topLanguage[0],
                improvements: topLanguage[1].count,
                linesImproved: topLanguage[1].linesImproved
            } : null,
            // WCAG kriterleri
            wcagCriteriaStats: stats.wcagCriteriaStats,
            topWcagCriteria: topWcagCriteria ? {
                name: topWcagCriteria[0],
                count: topWcagCriteria[1]
            } : null,
            // Hata istatistikleri
            errors: stats.errors,
            // Performans metrikleri
            performance: {
                avgImprovementTime: stats.totalImprovements > 0 ? Math.round(stats.totalProcessingTime / stats.totalImprovements) : 0,
                avgTokensPerImprovement: stats.totalImprovements > 0 ? Math.round(stats.totalTokensUsed / stats.totalImprovements) : 0,
                successRate: successRate / 100
            },
            // Trend analizi (son 7 gün)
            weeklyTrend: this.calculateWeeklyTrend(stats.dailyStats)
        };
    }
    calculateWeeklyTrend(dailyStats) {
        const last7Days = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split("T")[0];
            const dayStats = dailyStats[dateStr] || { improvements: 0, linesImproved: 0, processingTime: 0 };
            last7Days.push({
                date: dateStr,
                dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
                improvements: dayStats.improvements,
                linesImproved: dayStats.linesImproved
            });
        }
        return last7Days;
    }
    updateStats() {
        if (!this._view || !this._statisticsManager)
            return;
        try {
            const stats = this._statisticsManager.getDetailedStatistics();
            const processedStats = this.processStatistics(stats);
            this._view.webview.postMessage({
                type: "updateStats",
                stats: processedStats
            });
        }
        catch (error) {
            console.error("Statistics update error:", error);
            // Fallback to empty stats
            const emptyStats = {
                totalImprovements: 0,
                totalLinesImproved: 0,
                totalTokensUsed: 0,
                totalTime: "0sn",
                successRate: 100,
                averageProcessingTime: 0,
                today: { improvements: 0, linesImproved: 0, processingTime: 0 },
                thisMonth: { improvements: 0, linesImproved: 0, processingTime: 0 },
                languageStats: {},
                topLanguage: null,
                wcagCriteriaStats: {},
                topWcagCriteria: null,
                errors: { total: 0, byType: {}, recent: [] },
                performance: { avgImprovementTime: 0, avgTokensPerImprovement: 0, successRate: 1.0 },
                weeklyTrend: []
            };
            this._view.webview.postMessage({
                type: "updateStats",
                stats: emptyStats
            });
        }
    }
    async resetStats() {
        try {
            // Dil ayarını al
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const language = config.get("language", "en");
            const isEnglish = language === "en";
            const warningMessage = isEnglish ?
                "⚠️ All statistics will be deleted. This action cannot be undone!" :
                "⚠️ Tüm istatistikler silinecek. Bu işlem geri alınamaz!";
            const buttonText = isEnglish ? "Delete Statistics" : "İstatistikleri Sil";
            const confirm = await vscode.window.showWarningMessage(warningMessage, { modal: true }, buttonText);
            if (confirm === buttonText) {
                await vscode.commands.executeCommand("wcagEnhancer.resetStatistics");
                // İstatistikleri güncelle
                this.updateStats();
                if (this._view) {
                    const successMessage = isEnglish ?
                        "✅ Statistics reset successfully!" :
                        "✅ İstatistikler başarıyla sıfırlandı!";
                    this._view.webview.postMessage({
                        type: "showMessage",
                        message: successMessage,
                        isError: false
                    });
                }
            }
        }
        catch (error) {
            console.error("Statistics reset error:", error);
            if (this._view) {
                const config = vscode.workspace.getConfiguration("wcagEnhancer");
                const language = config.get("language", "en");
                const isEnglish = language === "en";
                const errorMessage = isEnglish ?
                    "❌ Error occurred while resetting statistics!" :
                    "❌ İstatistikler sıfırlanırken hata oluştu!";
                this._view.webview.postMessage({
                    type: "showMessage",
                    message: errorMessage,
                    isError: true
                });
            }
        }
    }
    async exportStats(format = "json", period = "all") {
        try {
            const stats = this.getFilteredStats(period);
            let content;
            let fileExtension;
            let mimeType;
            switch (format) {
                case "csv":
                    content = this.convertToCSV(stats);
                    fileExtension = "csv";
                    mimeType = "text/csv";
                    break;
                case "json":
                default:
                    content = JSON.stringify(stats, null, 2);
                    fileExtension = "json";
                    mimeType = "application/json";
                    break;
            }
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    [`${format.toUpperCase()} Files`]: [fileExtension]
                },
                defaultUri: vscode.Uri.file(`wcag-enhancer-stats-${period}-${new Date().toISOString().split("T")[0]}.${fileExtension}`)
            });
            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
                const config = vscode.workspace.getConfiguration("wcagEnhancer");
                const language = config.get("language", "en");
                const isEnglish = language === "en";
                const successMessage = isEnglish ?
                    `✅ Statistics exported successfully as ${format.toUpperCase()}!` :
                    `✅ İstatistikler ${format.toUpperCase()} formatında başarıyla dışa aktarıldı!`;
                vscode.window.showInformationMessage(successMessage);
            }
        }
        catch (error) {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const language = config.get("language", "en");
            const isEnglish = language === "en";
            const errorMessage = isEnglish ?
                `❌ Export failed: ${error}` :
                `❌ Dışa aktarma başarısız: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
        }
    }
    async filterStats(period, language) {
        try {
            const filteredStats = this.getFilteredStats(period, language);
            const processedStats = this.processStatistics(filteredStats);
            if (this._view) {
                this._view.webview.postMessage({
                    type: "updateStats",
                    stats: processedStats
                });
            }
        }
        catch (error) {
            console.error("Statistics filtering error:", error);
        }
    }
    getFilteredStats(period, language) {
        if (!this._statisticsManager) {
            logger_1.logger.warn("StatisticsManager not available for filtering");
            return {
                totalImprovements: 0,
                totalLinesImproved: 0,
                totalTokensUsed: 0,
                totalProcessingTime: 0,
                dailyStats: {},
                languageStats: {},
                wcagCriteriaStats: {},
                errors: { total: 0, byType: {}, recent: [] },
                providerStats: {},
                modelStats: {},
                recentImprovements: [],
                weeklyStats: {},
                monthlyStats: {},
                yearlyStats: {},
                averageProcessingTime: 0,
                fastestImprovement: 0,
                slowestImprovement: 0,
                mostActiveHour: 0,
                mostActiveDayOfWeek: 0,
                improvementsByHour: {},
                improvementsByDayOfWeek: {}
            };
        }
        const fullStats = this._statisticsManager.getDetailedStatistics();
        let filteredStats = { ...fullStats };
        // Period filtering
        switch (period) {
            case "week":
                const weekStats = this._statisticsManager.getThisWeekStatistics();
                filteredStats = {
                    ...fullStats,
                    totalImprovements: weekStats.improvements,
                    totalLinesImproved: weekStats.linesImproved,
                    totalProcessingTime: weekStats.avgProcessingTime * weekStats.improvements
                };
                break;
            case "month":
                const monthStats = this._statisticsManager.getThisMonthStatistics();
                filteredStats = {
                    ...fullStats,
                    totalImprovements: monthStats.improvements,
                    totalLinesImproved: monthStats.linesImproved,
                    totalTokensUsed: monthStats.tokensUsed,
                    totalProcessingTime: monthStats.avgProcessingTime * monthStats.improvements
                };
                break;
            case "year":
                const yearStats = this._statisticsManager.getThisYearStatistics();
                filteredStats = {
                    ...fullStats,
                    totalImprovements: yearStats.improvements,
                    totalLinesImproved: yearStats.linesImproved,
                    totalTokensUsed: yearStats.tokensUsed,
                    totalProcessingTime: yearStats.avgProcessingTime * yearStats.improvements
                };
                break;
            case "all":
            default:
                filteredStats = fullStats;
                break;
        }
        // Language filtering if specified
        if (language && language !== "all") {
            const langStats = filteredStats.languageStats[language];
            if (langStats) {
                filteredStats = {
                    ...filteredStats,
                    totalImprovements: langStats.count,
                    totalLinesImproved: langStats.linesImproved,
                    languageStats: { [language]: langStats }
                };
            }
        }
        return filteredStats;
    }
    convertToCSV(stats) {
        const headers = ["Date", "Improvements", "Lines Improved", "Processing Time (ms)", "Language", "WCAG Criteria"];
        const rows = [headers.join(",")];
        // Günlük istatistikleri CSV'ye çevir
        Object.entries(stats.dailyStats || {}).forEach(([date, dayStats]) => {
            const row = [
                date,
                dayStats.improvements || 0,
                dayStats.linesImproved || 0,
                dayStats.processingTime || 0,
                "Mixed",
                "Multiple"
            ];
            rows.push(row.join(","));
        });
        // Dil istatistikleri ekle
        Object.entries(stats.languageStats || {}).forEach(([lang, langStats]) => {
            const row = [
                "Summary",
                langStats.count || 0,
                langStats.linesImproved || 0,
                0,
                lang,
                "Various"
            ];
            rows.push(row.join(","));
        });
        return rows.join("\n");
    }
    async showResetMenu() {
        if (!this._view)
            return;
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const language = config.get("language", "en");
        const isEnglish = language === "en";
        const resetOptions = [
            {
                label: isEnglish ? "🔄 Reset Daily Statistics" : "🔄 Günlük İstatistikleri Sıfırla",
                description: isEnglish ? "Reset only today's statistics" : "Sadece bugünün istatistiklerini sıfırla",
                action: "resetDaily"
            },
            {
                label: isEnglish ? "🔄 Reset Monthly Statistics" : "🔄 Aylık İstatistikleri Sıfırla",
                description: isEnglish ? "Reset this month's statistics" : "Bu ayın tüm istatistiklerini sıfırla",
                action: "resetMonthly"
            },
            {
                label: isEnglish ? "🔄 Reset Yearly Statistics" : "🔄 Yıllık İstatistikleri Sıfırla",
                description: isEnglish ? "Reset this year's statistics" : "Bu yılın tüm istatistiklerini sıfırla",
                action: "resetYearly"
            },
            {
                label: isEnglish ? "🔄 Reset All Statistics" : "🔄 Tüm İstatistikleri Sıfırla",
                description: isEnglish ? "⚠️ Permanently delete all historical data" : "⚠️ Tüm geçmiş verileri kalıcı olarak sil",
                action: "resetAll"
            }
        ];
        const selectedOption = await vscode.window.showQuickPick(resetOptions, {
            placeHolder: isEnglish ? "Select reset type" : "Sıfırlanacak istatistik türünü seçin",
            ignoreFocusOut: false
        });
        if (selectedOption) {
            this._view.webview.postMessage({
                type: "executeReset",
                action: selectedOption.action
            });
        }
    }
    async resetPeriodStats(period) {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const language = config.get("language", "en");
            const isEnglish = language === "en";
            let confirmMessage;
            let buttonText;
            switch (period) {
                case "daily":
                    confirmMessage = isEnglish
                        ? "⚠️ Today's statistics will be deleted. This action cannot be undone!"
                        : "⚠️ Bugünün istatistikleri silinecek. Bu işlem geri alınamaz!";
                    buttonText = isEnglish ? "Delete Daily Statistics" : "Günlük İstatistikleri Sil";
                    break;
                case "monthly":
                    confirmMessage = isEnglish
                        ? "⚠️ This month's statistics will be deleted. This action cannot be undone!"
                        : "⚠️ Bu ayın tüm istatistikleri silinecek. Bu işlem geri alınamaz!";
                    buttonText = isEnglish ? "Delete Monthly Statistics" : "Aylık İstatistikleri Sil";
                    break;
                case "yearly":
                    confirmMessage = isEnglish
                        ? "⚠️ This year's statistics will be deleted. This action cannot be undone!"
                        : "⚠️ Bu yılın tüm istatistikleri silinecek. Bu işlem geri alınamaz!";
                    buttonText = isEnglish ? "Delete Yearly Statistics" : "Yıllık İstatistikleri Sil";
                    break;
            }
            const confirmation = await vscode.window.showWarningMessage(confirmMessage, { modal: true }, buttonText);
            if (confirmation === buttonText && this._statisticsManager) {
                switch (period) {
                    case "daily":
                        this._statisticsManager.resetDailyStatistics();
                        break;
                    case "monthly":
                        this._statisticsManager.resetMonthlyStatistics();
                        break;
                    case "yearly":
                        this._statisticsManager.resetYearlyStatistics();
                        break;
                }
                // İstatistikleri güncelle
                this.updateStats();
                const successMessage = isEnglish
                    ? `✅ ${period.charAt(0).toUpperCase() + period.slice(1)} statistics reset successfully!`
                    : `✅ ${period === 'daily' ? 'Günlük' : period === 'monthly' ? 'Aylık' : 'Yıllık'} istatistikler başarıyla sıfırlandı!`;
                if (this._view) {
                    this._view.webview.postMessage({
                        type: "showMessage",
                        message: successMessage,
                        isError: false
                    });
                }
            }
        }
        catch (error) {
            console.error(`${period} istatistik sıfırlama hatası:`, error);
            if (this._view) {
                const config = vscode.workspace.getConfiguration("wcagEnhancer");
                const language = config.get("language", "en");
                const isEnglish = language === "en";
                const errorMessage = isEnglish
                    ? `❌ Error occurred while resetting ${period} statistics!`
                    : `❌ ${period === 'daily' ? 'Günlük' : period === 'monthly' ? 'Aylık' : 'Yıllık'} istatistikler sıfırlanırken hata oluştu!`;
                this._view.webview.postMessage({
                    type: "showMessage",
                    message: errorMessage,
                    isError: true
                });
            }
        }
    }
    async showDetailedStatsPanel() {
        // Detaylı istatistik panelini aç
        await vscode.commands.executeCommand('wcagEnhancer.showDetailedStatistics');
    }
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    _getHtmlForWebview(webview) {
        // VS Code UI toolkit JS dosyasını al
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "toolkit.js"));
        // Dil ayarlarını al
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const language = config.get("language", "en");
        const isEnglish = language === "en";
        return `
<!DOCTYPE html>
<html lang="${language}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' vscode-webview:; script-src 'unsafe-inline' vscode-webview:;">
	<title>${isEnglish ? "AccessiMind Statistics" : "AccessiMind İstatistikleri"}</title>
	<script src="${toolkitUri}"></script>
	<style>
		:root {
			--primary-color: var(--vscode-button-background);
			--primary-hover: var(--vscode-button-hoverBackground);
			--text-color: var(--vscode-foreground);
			--bg-color: var(--vscode-editor-background);
			--card-bg: var(--vscode-input-background);
			--border-color: var(--vscode-panel-border);
			--success-color: var(--vscode-terminal-ansiGreen);
			--warning-color: var(--vscode-terminal-ansiYellow);
			--danger-color: var(--vscode-terminal-ansiRed);
			--info-color: var(--vscode-terminal-ansiBlue);
		}

		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: var(--vscode-font-family);
			background: var(--bg-color);
			color: var(--text-color);
			line-height: 1.5;
			padding: 16px;
			font-size: 13px;
		}

		.stats-container {
			display: flex;
			flex-direction: column;
			gap: 20px;
		}

		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 20px;
		}

		.header h1 {
			font-size: 20px;
			font-weight: 600;
			color: var(--text-color);
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.refresh-btn {
			--vscode-button-background: var(--vscode-button-secondaryBackground);
			--vscode-button-foreground: var(--vscode-button-secondaryForeground);
		}

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
			gap: 16px;
			margin-bottom: 20px;
		}

		.stat-card {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 16px;
			text-align: center;
			transition: all 0.2s ease;
		}

		.stat-card:hover {
			border-color: var(--primary-color);
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		}

		.stat-number {
			font-size: 24px;
			font-weight: bold;
			color: var(--primary-color);
			margin-bottom: 4px;
			display: block;
		}

		.stat-label {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			font-weight: 500;
		}

		.stat-card.success .stat-number { color: var(--success-color); }
		.stat-card.warning .stat-number { color: var(--warning-color); }
		.stat-card.info .stat-number { color: var(--info-color); }
		.stat-card.danger .stat-number { color: var(--danger-color); }

		.actions-section {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 16px;
			margin-bottom: 20px;
		}

		.actions-header {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 12px;
			color: var(--text-color);
		}

		.actions-row {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}

		.actions-row vscode-button {
			flex: 1;
			min-width: 120px;
		}

		.export-section {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 16px;
			margin-bottom: 20px;
		}

		.export-header {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 12px;
			color: var(--text-color);
		}

		.export-controls {
			display: flex;
			gap: 8px;
			align-items: center;
			flex-wrap: wrap;
		}

		.export-controls vscode-dropdown {
			min-width: 100px;
		}

		.trends-section {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 16px;
		}

		.trends-header {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 12px;
			color: var(--text-color);
		}

		.trend-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 8px 0;
			border-bottom: 1px solid var(--border-color);
		}

		.trend-item:last-child {
			border-bottom: none;
		}

		.trend-date {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.trend-value {
			font-weight: 600;
			color: var(--primary-color);
		}

		.loading {
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 40px;
			color: var(--vscode-descriptionForeground);
		}

		.message {
			padding: 12px;
			border-radius: 4px;
			margin: 8px 0;
			font-size: 12px;
		}

		.message.success {
			background: rgba(0, 255, 0, 0.1);
			border: 1px solid var(--success-color);
			color: var(--success-color);
		}

		.message.error {
			background: rgba(255, 0, 0, 0.1);
			border: 1px solid var(--danger-color);
			color: var(--danger-color);
		}

		@media (max-width: 300px) {
			.stats-grid {
				grid-template-columns: 1fr;
			}
			
			.actions-row {
				flex-direction: column;
			}
			
			.export-controls {
				flex-direction: column;
				align-items: stretch;
			}
		}
	</style>
</head>
<body>
	<div class="stats-container">
		<div class="header">
			<h1>📊 ${isEnglish ? "Statistics" : "İstatistikler"}</h1>
			<vscode-button id="refreshBtn" class="refresh-btn" appearance="secondary">
				🔄 ${isEnglish ? "Refresh" : "Yenile"}
			</vscode-button>
		</div>

		<div class="actions-section">
			<div class="actions-header">${isEnglish ? "Quick Actions" : "Hızlı İşlemler"}</div>
			<div class="actions-row">
				<vscode-button id="resetBtn" appearance="secondary">
					🗑️ ${isEnglish ? "Reset Menu" : "Sıfırlama Menüsü"}
				</vscode-button>
				<vscode-button id="detailedBtn" appearance="secondary">
					📈 ${isEnglish ? "Detailed View" : "Detaylı Görünüm"}
				</vscode-button>
			</div>
			<div class="actions-row" style="margin-top: 8px;">
				<vscode-button id="resetDailyBtn" appearance="secondary" style="font-size: 11px;">
					📅 ${isEnglish ? "Reset Daily" : "Günlük Sıfırla"}
				</vscode-button>
				<vscode-button id="resetMonthlyBtn" appearance="secondary" style="font-size: 11px;">
					📊 ${isEnglish ? "Reset Monthly" : "Aylık Sıfırla"}
				</vscode-button>
				<vscode-button id="resetYearlyBtn" appearance="secondary" style="font-size: 11px;">
					📈 ${isEnglish ? "Reset Yearly" : "Yıllık Sıfırla"}
				</vscode-button>
			</div>
		</div>

		<div class="export-section">
			<div class="export-header">${isEnglish ? "Export" : "Dışa Aktarma"}</div>
			<div class="export-controls">
				<vscode-dropdown id="exportFormat">
					<vscode-option value="json">JSON</vscode-option>
					<vscode-option value="csv">CSV</vscode-option>
				</vscode-dropdown>
				<vscode-dropdown id="exportPeriod">
					<vscode-option value="all">${isEnglish ? "All" : "Tümü"}</vscode-option>
					<vscode-option value="month">${isEnglish ? "This Month" : "Bu Ay"}</vscode-option>
					<vscode-option value="week">${isEnglish ? "This Week" : "Bu Hafta"}</vscode-option>
				</vscode-dropdown>
				<vscode-button id="exportBtn" appearance="primary">
					📁 ${isEnglish ? "Export" : "Dışa Aktar"}
				</vscode-button>
			</div>
		</div>

		<div class="stats-grid" id="statsGrid">
			<div class="loading">${isEnglish ? "Loading statistics..." : "İstatistikler yükleniyor..."}</div>
		</div>

		<div class="trends-section" id="trendsSection" style="display: none;">
			<div class="trends-header">${isEnglish ? "Weekly Trend (Last 7 Days)" : "Haftalık Trend (Son 7 Gün)"}</div>
			<div id="trendsList"></div>
		</div>

		<div id="messages"></div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		let currentStats = null;
		const isEnglish = ${isEnglish};

		// Event listeners
		document.getElementById('refreshBtn').addEventListener('click', () => {
			vscode.postMessage({ type: 'refreshStats' });
		});

		document.getElementById('resetBtn').addEventListener('click', () => {
			vscode.postMessage({ type: 'resetStats' });
		});

		document.getElementById('detailedBtn').addEventListener('click', () => {
			vscode.postMessage({ type: 'showDetailedStats' });
		});

		document.getElementById('resetDailyBtn').addEventListener('click', () => {
			vscode.postMessage({ type: 'resetDaily' });
		});

		document.getElementById('resetMonthlyBtn').addEventListener('click', () => {
			vscode.postMessage({ type: 'resetMonthly' });
		});

		document.getElementById('resetYearlyBtn').addEventListener('click', () => {
			vscode.postMessage({ type: 'resetYearly' });
		});

		document.getElementById('exportBtn').addEventListener('click', () => {
			const format = document.getElementById('exportFormat').value;
			const period = document.getElementById('exportPeriod').value;
			vscode.postMessage({
				type: 'exportStats',
				format: format,
				period: period
			});
		});

		// Message handling
		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.type) {
				case 'updateStats':
					updateStatsDisplay(message.stats);
					break;
				case 'showMessage':
					showMessage(message.message, message.isError);
					break;
				case 'executeReset':
					vscode.postMessage({ type: message.action });
					break;
			}
		});

		function updateStatsDisplay(stats) {
			currentStats = stats;
			const grid = document.getElementById('statsGrid');
			
			grid.innerHTML = \`
				<div class="stat-card success">
					<span class="stat-number">\${stats.totalImprovements}</span>
					<div class="stat-label">\${isEnglish ? "Total Improvements" : "Toplam İyileştirme"}</div>
				</div>
				<div class="stat-card info">
					<span class="stat-number">\${stats.totalLinesImproved}</span>
					<div class="stat-label">\${isEnglish ? "Lines Improved" : "İyileştirilen Satır"}</div>
				</div>
				<div class="stat-card warning">
					<span class="stat-number">\${stats.successRate}%</span>
					<div class="stat-label">\${isEnglish ? "Success Rate" : "Başarı Oranı"}</div>
				</div>
				<div class="stat-card">
					<span class="stat-number">\${stats.totalTokensUsed}</span>
					<div class="stat-label">\${isEnglish ? "Tokens Used" : "Kullanılan Token"}</div>
				</div>
				<div class="stat-card">
					<span class="stat-number">\${stats.today.improvements}</span>
					<div class="stat-label">\${isEnglish ? "Today" : "Bugün"}</div>
				</div>
				<div class="stat-card">
					<span class="stat-number">\${stats.thisMonth.improvements}</span>
					<div class="stat-label">\${isEnglish ? "This Month" : "Bu Ay"}</div>
				</div>
			\`;

			// Trend gösterimi
			if (stats.weeklyTrend && stats.weeklyTrend.length > 0) {
				const trendsSection = document.getElementById('trendsSection');
				const trendsList = document.getElementById('trendsList');
				
				trendsList.innerHTML = stats.weeklyTrend.map(trend => \`
					<div class="trend-item">
						<span class="trend-date">\${trend.dayName} (\${trend.date})</span>
						<span class="trend-value">\${trend.improvements} \${isEnglish ? "improvements" : "iyileştirme"}</span>
					</div>
				\`).join('');
				
				trendsSection.style.display = 'block';
			}
		}

		function showMessage(message, isError) {
			const messagesDiv = document.getElementById('messages');
			const messageEl = document.createElement('div');
			messageEl.className = \`message \${isError ? 'error' : 'success'}\`;
			messageEl.textContent = message;
			
			messagesDiv.appendChild(messageEl);
			
			setTimeout(() => {
				messagesDiv.removeChild(messageEl);
			}, 5000);
		}

		// View hazır olduğunu bildir
		document.addEventListener('DOMContentLoaded', () => {
			vscode.postMessage({ type: 'ready' });
		});
	</script>
</body>
</html>
		`;
    }
}
exports.ModernStatsViewProvider = ModernStatsViewProvider;
ModernStatsViewProvider.viewType = "wcagEnhancer.modernStatsView";
//# sourceMappingURL=modernStatsViewProvider.js.map