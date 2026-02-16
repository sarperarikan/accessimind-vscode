import * as vscode from "vscode";
import { DetailedStatistics, StatisticsManager } from "../utils/statisticsManager";
import { logger } from "../utils/logger";

export class StatsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wcagEnhancer.statsView";
	private _view?: vscode.WebviewView;
	private _statisticsManager?: StatisticsManager;

	constructor(private readonly _extensionUri: vscode.Uri) { }

	public setStatisticsManager(statisticsManager: StatisticsManager): void {
		this._statisticsManager = statisticsManager;
		this.setupRealTimeListeners();
	}

	private setupRealTimeListeners(): void {
		if (!this._statisticsManager) return;

		// Listen for real-time statistics changes
		this._statisticsManager.on("statisticsChanged", (stats) => {
			this.updateStatistics(stats);
		});

		logger.info("StatsViewProvider real-time listeners initialized");
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			enableCommandUris: true,
			enableForms: false,
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
					await this.resetStats();
					break;
				case "exportStats":
					await this.exportStats(data.format, data.period);
					break;
				case "showDetailedStats":
					await vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
					break;
				case "openSettings":
					await vscode.commands.executeCommand("workbench.view.extension.wcagEnhancer");
					break;

				case "filterStats":
					await this.filterStats(data.period, data.language);
					break;
				case "getTokenAnalytics":
					this.sendTokenAnalytics();
					break;
				case "showTokenPrediction":
					await this.showTokenPrediction();
					break;
			}
		});

		// İlk istatistik yüklemesi
		this.updateStats();
	}

	// Dış kullanım için updateStatistics metodu
	public updateStatistics(stats: DetailedStatistics): void {
		if (!this._view) return;

		try {
			const processedStats = this.processStatistics(stats);

			this._view.webview.postMessage({
				type: "updateStats",
				stats: processedStats
			});
		} catch (error) {
			// console.error("İstatistik güncelleme hatası:", error);
		}
	}

	private processStatistics(stats: DetailedStatistics): any {
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

	private calculateWeeklyTrend(dailyStats: { [date: string]: any }): any[] {
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

	private updateStats() {
		// Bu metod geriye dönük uyum için tutuldu
		// Gerçek istatistikler updateStatistics metodu ile güncellenir
		if (!this._view) return;

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

	private async resetStats() {
		try {
			// Dil ayarını al
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const language = config.get("language") || "en";
			const isEnglish = language === "en";

			const warningMessage = isEnglish ?
				"⚠️ All statistics will be deleted. This action cannot be undone!" :
				"⚠️ Tüm istatistikler silinecek. Bu işlem geri alınamaz!";

			const buttonText = isEnglish ? "Delete Statistics" : "İstatistikleri Sil";

			const confirm = await vscode.window.showWarningMessage(
				warningMessage,
				{ modal: true },
				buttonText
			);

			if (confirm === buttonText) {
				await vscode.commands.executeCommand("wcagEnhancer.resetStatistics");

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
		} catch (error) {
			// console.error("İstatistik sıfırlama hatası:", error);
			if (this._view) {
				const config = vscode.workspace.getConfiguration("wcagEnhancer");
				const language = config.get("language") || "en";
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

	private async exportStats(format: string = "json", period: string = "all"): Promise<void> {
		try {
			const stats = this.getFilteredStats(period);
			let content: string;
			let fileExtension: string;
			let mimeType: string;

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
				const language = config.get("language") || "en";
				const isEnglish = language === "en";

				const successMessage = isEnglish ?
					`✅ Statistics exported successfully as ${format.toUpperCase()}!` :
					`✅ İstatistikler ${format.toUpperCase()} formatında başarıyla dışa aktarıldı!`;

				vscode.window.showInformationMessage(successMessage);
			}
		} catch (error) {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const language = config.get("language") || "en";
			const isEnglish = language === "en";

			const errorMessage = isEnglish ?
				`❌ Export failed: ${error}` :
				`❌ Dışa aktarma başarısız: ${error}`;

			vscode.window.showErrorMessage(errorMessage);
		}
	}

	private async filterStats(period: string, language?: string): Promise<void> {
		try {
			const filteredStats = this.getFilteredStats(period, language);
			const processedStats = this.processStatistics(filteredStats);

			if (this._view) {
				this._view.webview.postMessage({
					type: "updateStats",
					stats: processedStats
				});
			}
		} catch (error) {
			// console.error("İstatistik filtreleme hatası:", error);
		}
	}

	private getFilteredStats(period: string, language?: string): any {
		// Bu metod gerçek istatistikleri filtrelemek için kullanılacak
		// Şimdilik boş bir obje döndürüyoruz
		return {
			totalImprovements: 0,
			totalLinesImproved: 0,
			totalTokensUsed: 0,
			totalProcessingTime: 0,
			dailyStats: {},
			languageStats: {},
			wcagCriteriaStats: {},
			errors: { total: 0, byType: {}, recent: [] }
		};
	}

	private convertToCSV(stats: any): string {
		const headers = ["Date", "Improvements", "Lines Improved", "Processing Time (ms)", "Language", "WCAG Criteria"];
		const rows = [headers.join(",")];

		// Günlük istatistikleri CSV'ye çevir
		Object.entries(stats.dailyStats || {}).forEach(([date, dayStats]: [string, any]) => {
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
		Object.entries(stats.languageStats || {}).forEach(([lang, langStats]: [string, any]) => {
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

	private sendTokenAnalytics(): void {
		if (!this._statisticsManager || !this._view) return;

		try {
			const tokenAnalytics = this._statisticsManager.getTokenAnalytics();
			this._view.webview.postMessage({
				type: "updateTokenAnalytics",
				tokenData: tokenAnalytics
			});
		} catch (error) {
			// console.error("Token analytics error:", error);
		}
	}

	private async showTokenPrediction(): Promise<void> {
		try {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage("No active file to predict token usage for");
				return;
			}

			const document = editor.document;
			const code = document.getText();
			const language = document.languageId;

			if (!this._statisticsManager) return;

			const prediction = this._statisticsManager.predictTokenUsage(code, language, "improvement");

			const message = `🔮 Token Prediction for ${document.fileName.split('/').pop()}

Estimated Tokens: ${prediction.estimatedTokens}
Estimated Cost: $${prediction.estimatedCost.toFixed(4)}
Confidence: ${Math.round(prediction.confidence * 100)}%
Recommended Model: ${prediction.recommendedModel}

Reasoning:
${prediction.reasoning.join('\n')}`;

			vscode.window.showInformationMessage(message, { modal: true });
		} catch (error) {
			vscode.window.showErrorMessage(`Error predicting token usage: ${error}`);
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get language configuration
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const language = config.get("language", "en");
		const isEnglish = language === "en";

		return `
<!DOCTYPE html>
<html lang="${language}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${isEnglish ? "AccessiMind Statistics" : "AccessiMind İstatistikleri"}</title>
	<style>
		:root {
			--primary-color: #007acc;
			--secondary-color: #e7f3ff;
			--success-color: #28a745;
			--warning-color: #ffc107;
			--danger-color: #dc3545;
			--info-color: #17a2b8;
			--text-color: var(--vscode-foreground);
			--bg-color: var(--vscode-editor-background);
			--border-color: var(--vscode-panel-border);
			--card-bg: var(--vscode-input-background);
			--hover-bg: var(--vscode-list-hoverBackground);
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
			max-width: 100%;
		}

		.header {
			text-align: center;
			margin-bottom: 20px;
			padding: 16px;
			background: linear-gradient(135deg, var(--primary-color), #005a9e);
			border-radius: 8px;
			color: white;
		}

		.header h1 {
			font-size: 1.5rem;
			margin-bottom: 4px;
			font-weight: 600;
		}

		.header p {
			opacity: 0.9;
			font-size: 0.9rem;
		}

		.stats-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
			margin-bottom: 20px;
		}

		@media (max-width: 300px) {
			.stats-grid {
				grid-template-columns: 1fr;
			}
		}

		.stat-card {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 16px;
			text-align: center;
			transition: all 0.2s ease;
			position: relative;
		}

		.stat-card:hover {
			border-color: var(--primary-color);
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(0, 122, 204, 0.1);
		}

		.stat-number {
			font-size: 1.8rem;
			font-weight: bold;
			color: var(--primary-color);
			margin-bottom: 4px;
			display: block;
		}

		.stat-label {
			color: var(--vscode-descriptionForeground);
			font-size: 0.8rem;
			font-weight: 500;
		}

		.stat-card.success .stat-number { color: var(--success-color); }
		.stat-card.warning .stat-number { color: var(--warning-color); }
		.stat-card.info .stat-number { color: var(--info-color); }

		.section {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			margin-bottom: 16px;
			overflow: hidden;
		}

		.section-header {
			background: var(--hover-bg);
			padding: 12px 16px;
			border-bottom: 1px solid var(--border-color);
			font-weight: 600;
			font-size: 0.9rem;
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.section-content {
			padding: 16px;
		}

		.progress-bar {
			width: 100%;
			height: 8px;
			background: var(--border-color);
			border-radius: 4px;
			overflow: hidden;
			margin: 8px 0;
		}

		.progress-fill {
			height: 100%;
			background: linear-gradient(90deg, var(--success-color), var(--primary-color));
			border-radius: 4px;
			transition: width 0.3s ease;
		}

		.trend-chart {
			display: flex;
			align-items: end;
			gap: 4px;
			height: 60px;
			margin: 12px 0;
		}

		.trend-bar {
			flex: 1;
			background: var(--primary-color);
			border-radius: 2px 2px 0 0;
			min-height: 2px;
			opacity: 0.7;
			transition: all 0.2s ease;
			position: relative;
		}

		.trend-bar:hover {
			opacity: 1;
			transform: scaleY(1.1);
		}

		.trend-bar::after {
			content: attr(data-value);
			position: absolute;
			top: -20px;
			left: 50%;
			transform: translateX(-50%);
			font-size: 0.7rem;
			color: var(--vscode-descriptionForeground);
			opacity: 0;
			transition: opacity 0.2s ease;
		}

		.trend-bar:hover::after {
			opacity: 1;
		}

		.language-item, .criteria-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 8px 0;
			border-bottom: 1px solid var(--border-color);
		}

		.language-item:last-child, .criteria-item:last-child {
			border-bottom: none;
		}

		.language-name, .criteria-name {
			font-weight: 500;
			font-size: 0.85rem;
		}

		.language-stats, .criteria-count {
			color: var(--vscode-descriptionForeground);
			font-size: 0.8rem;
		}

		.action-buttons {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 8px;
			margin-top: 16px;
		}

		.btn {
			padding: 8px 12px;
			border: none;
			border-radius: 4px;
			font-size: 0.8rem;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s ease;
			text-decoration: none;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
		}

		.btn-primary {
			background: var(--primary-color);
			color: white;
		}

		.btn-primary:hover {
			background: #005a9e;
			transform: translateY(-1px);
		}

		.btn-secondary {
			background: var(--border-color);
			color: var(--text-color);
		}

		.btn-secondary:hover {
			background: var(--hover-bg);
		}

		.btn-success {
			background: var(--success-color);
			color: white;
		}

		.btn-danger {
			background: var(--danger-color);
			color: white;
		}

		.btn:hover {
			transform: translateY(-1px);
		}

		.empty-state {
			text-align: center;
			padding: 40px 20px;
			color: var(--vscode-descriptionForeground);
		}

		.empty-state .icon {
			font-size: 3rem;
			margin-bottom: 16px;
			opacity: 0.5;
		}

		.empty-state h3 {
			margin-bottom: 8px;
			color: var(--text-color);
		}

		.empty-state p {
			margin-bottom: 16px;
			font-size: 0.9rem;
		}

		.quick-stats {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 8px;
			margin-bottom: 16px;
		}

		.quick-stat {
			background: var(--hover-bg);
			padding: 8px;
			border-radius: 4px;
			text-align: center;
		}

		.quick-stat-value {
			font-weight: bold;
			color: var(--primary-color);
			font-size: 1.1rem;
		}

		.quick-stat-label {
			font-size: 0.7rem;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}

		.loading {
			display: inline-block;
			width: 16px;
			height: 16px;
			border: 2px solid rgba(255, 255, 255, 0.3);
			border-radius: 50%;
			border-top-color: #fff;
			animation: spin 1s ease-in-out infinite;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		.alert {
			padding: 12px;
			border-radius: 4px;
			margin-bottom: 16px;
			border-left: 4px solid;
		}

		.alert-success {
			background: rgba(40, 167, 69, 0.1);
			border-color: var(--success-color);
			color: var(--success-color);
		}

		.alert-error {
			background: rgba(220, 53, 69, 0.1);
			border-color: var(--danger-color);
			color: var(--danger-color);
		}

		/* Erişilebilirlik iyileştirmeleri */
		.screen-reader-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		/* High contrast mode support */
		@media (prefers-contrast: high) {
			.stat-card, .section {
				border-width: 2px;
			}
		}

		/* Reduced motion support */
		@media (prefers-reduced-motion: reduce) {
			*, *::before, *::after {
				animation-duration: 0.01ms !important;
				animation-iteration-count: 1 !important;
				transition-duration: 0.01ms !important;
			}
		}

		/* Form elemanları için stiller */
		.form-label {
			display: block;
			margin-bottom: 4px;
			font-weight: 500;
			font-size: 0.8rem;
			color: var(--text-color);
		}

		.form-select {
			width: 100%;
			padding: 6px 8px;
			border: 1px solid var(--border-color);
			border-radius: 4px;
			background: var(--card-bg);
			color: var(--text-color);
			font-size: 0.8rem;
			cursor: pointer;
		}

		.form-select:focus {
			outline: none;
			border-color: var(--primary-color);
			box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
		}

		.controls-section .section-content {
			padding: 12px 16px;
		}

		@media (max-width: 600px) {
			.controls-section .section-content > div {
				grid-template-columns: 1fr;
				gap: 8px;
			}
			
			.controls-section .section-content > div > div:last-child {
				grid-column: 1;
			}
		}
	</style>
</head>
<body>
	<div class="stats-container">
		<div class="header">
			<h1>♿ ${isEnglish ? "WCAG Statistics" : "WCAG İstatistikleri"}</h1>
			<p>${isEnglish ? "Accessibility improvement metrics" : "Erişilebilirlik iyileştirme metrikleri"}</p>
		</div>

		<!-- Filtreleme ve Dışarı Aktarma Araçları -->
		<div class="controls-section" style="margin-bottom: 20px;">
			<div class="section">
				<div class="section-header">
					🔍 ${isEnglish ? "Filters and Export" : "Filtreler ve Dışa Aktarma"}
				</div>
				<div class="section-content">
					<div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end;">
						<div>
							<label class="form-label" for="periodFilter">${isEnglish ? "Period:" : "Dönem:"}</label>
							<select id="periodFilter" class="form-select" onchange="filterStats()">
								<option value="all">${isEnglish ? "All" : "Tümü"}</option>
								<option value="today">${isEnglish ? "Today" : "Bugün"}</option>
								<option value="week">${isEnglish ? "This Week" : "Bu Hafta"}</option>
								<option value="month">${isEnglish ? "This Month" : "Bu Ay"}</option>
								<option value="year">${isEnglish ? "This Year" : "Bu Yıl"}</option>
							</select>
						</div>
						<div>
							<label class="form-label" for="languageFilter">${isEnglish ? "Language:" : "Dil:"}</label>
							<select id="languageFilter" class="form-select" onchange="filterStats()">
								<option value="all">${isEnglish ? "All" : "Tümü"}</option>
								<!-- Dinamik olarak doldurulacak -->
							</select>
						</div>
						<div>
							<label class="form-label" for="exportFormat">${isEnglish ? "Format:" : "Format:"}</label>
							<select id="exportFormat" class="form-select">
								<option value="json">JSON</option>
								<option value="csv">CSV</option>
							</select>
						</div>
						<div>
							<button class="btn btn-primary" onclick="exportStatsAdvanced()" title="${isEnglish ? "Export statistics in selected format" : "İstatistikleri seçilen formatta dışa aktar"}">
								📤 ${isEnglish ? "Export" : "Dışa Aktar"}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div id="emptyState" class="empty-state">
			<div class="icon">📊</div>
			<h3>${isEnglish ? "No statistics yet" : "Henüz istatistik yok"}</h3>
			<p>${isEnglish ? "Statistics will appear here when you use AccessiMind commands from the command palette." : "AccessiMind komutlarını kullandığınızda istatistikler burada görünecek."}</p>
			<p style="margin-top: 15px; padding: 10px; background: var(--vscode-textCodeBlock-background); border-radius: 5px; font-size: 14px;">
				💡 <strong>${isEnglish ? "Tip:" : "İpucu:"}</strong> ${isEnglish ? "Press <kbd>Ctrl+Shift+P</kbd> and search for \"AccessiMind\" to get started!" : "<kbd>Ctrl+Shift+P</kbd> tuşuna basın ve \"AccessiMind\" aratın!"}
			</p>
		</div>

		<div id="statsContent" style="display: none;">
			<!-- Genel İstatistikler -->
			<div class="stats-grid">
				<div class="stat-card success">
					<span class="stat-number" id="totalImprovements">0</span>
					<div class="stat-label">${isEnglish ? "Total Improvements" : "Toplam İyileştirme"}</div>
				</div>
				<div class="stat-card info">
					<span class="stat-number" id="totalLines">0</span>
					<div class="stat-label">${isEnglish ? "Lines Improved" : "İyileştirilen Satır"}</div>
				</div>
				<div class="stat-card warning">
					<span class="stat-number" id="successRate">100%</span>
					<div class="stat-label">${isEnglish ? "Success Rate" : "Başarı Oranı"}</div>
				</div>
				<div class="stat-card">
					<span class="stat-number" id="avgTime">0ms</span>
					<div class="stat-label">${isEnglish ? "Avg. Processing Time" : "Ort. İşleme Süresi"}</div>
				</div>
			</div>

			<!-- Günlük/Aylık Özet -->
			<div class="section">
				<div class="section-header">
					📅 ${isEnglish ? "Daily & Monthly Summary" : "Günlük ve Aylık Özet"}
				</div>
				<div class="section-content">
					<div class="quick-stats">
						<div class="quick-stat">
							<div class="quick-stat-value" id="todayImprovements">0</div>
							<div class="quick-stat-label">${isEnglish ? "Today" : "Bugün"}</div>
						</div>
						<div class="quick-stat">
							<div class="quick-stat-value" id="monthImprovements">0</div>
							<div class="quick-stat-label">${isEnglish ? "This Month" : "Bu Ay"}</div>
						</div>
						<div class="quick-stat">
							<div class="quick-stat-value" id="totalTokens">0</div>
							<div class="quick-stat-label">${isEnglish ? "Tokens" : "Token"}</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Haftalık Trend -->
			<div class="section">
				<div class="section-header">
					📈 ${isEnglish ? "Weekly Trend" : "Haftalık Trend"}
				</div>
				<div class="section-content">
					<div class="trend-chart" id="trendChart">
						<!-- Dinamik olarak doldurulacak -->
					</div>
				</div>
			</div>

			<!-- En Çok Kullanılan Dil -->
			<div class="section">
				<div class="section-header">
					💻 ${isEnglish ? "Language Statistics" : "Dil İstatistikleri"}
				</div>
				<div class="section-content">
					<div id="languageStats">
						<!-- Dinamik olarak doldurulacak -->
					</div>
				</div>
			</div>

			<!-- WCAG Kriterleri -->
			<div class="section">
				<div class="section-header">
					♿ ${isEnglish ? "WCAG Criteria" : "WCAG Kriterleri"}
				</div>
				<div class="section-content">
					<div id="wcagStats">
						<!-- Dinamik olarak doldurulacak -->
					</div>
				</div>
			</div>

			<!-- Token Analytics -->
			<div class="section">
				<div class="section-header">
					🪙 ${isEnglish ? "Token Analytics & Cost Management" : "Token Analitikleri ve Maliyet Yönetimi"}
				</div>
				<div class="section-content">
					<div class="stats-grid">
						<div class="stat-card">
							<span class="stat-number" id="totalTokenCost">$0.00</span>
							<div class="stat-label">${isEnglish ? "Total Cost (30 days)" : "Toplam Maliyet (30 gün)"}</div>
						</div>
						<div class="stat-card info">
							<span class="stat-number" id="totalTokensUsed">0</span>
							<div class="stat-label">${isEnglish ? "Total Tokens" : "Toplam Token"}</div>
						</div>
						<div class="stat-card warning">
							<span class="stat-number" id="avgCostPerOperation">$0.00</span>
							<div class="stat-label">${isEnglish ? "Avg Cost/Operation" : "Ort. Maliyet/İşlem"}</div>
						</div>
						<div class="stat-card success">
							<span class="stat-number" id="optimizationScore">0%</span>
							<div class="stat-label">${isEnglish ? "Optimization Score" : "Optimizasyon Skoru"}</div>
						</div>
					</div>

					<!-- Cost Breakdown -->
					<div style="margin-top: 16px;">
						<h4 style="margin-bottom: 8px; font-size: 0.9rem;">${isEnglish ? "Cost Breakdown" : "Maliyet Dağılımı"}</h4>
						<div id="costBreakdown">
							<!-- Dinamik olarak doldurulacak -->
						</div>
					</div>

					<!-- Efficiency Metrics -->
					<div style="margin-top: 16px;">
						<h4 style="margin-bottom: 8px; font-size: 0.9rem;">${isEnglish ? "Efficiency Metrics" : "Verimlilik Metrikleri"}</h4>
						<div class="quick-stats">
							<div class="quick-stat">
								<div class="quick-stat-value" id="tokensPerLine">0</div>
								<div class="quick-stat-label">${isEnglish ? "Tokens/Line" : "Token/Satır"}</div>
							</div>
							<div class="quick-stat">
								<div class="quick-stat-value" id="tokensPerSecond">0</div>
								<div class="quick-stat-label">${isEnglish ? "Tokens/Second" : "Token/Saniye"}</div>
							</div>
							<div class="quick-stat">
								<div class="quick-stat-value" id="costPerLine">$0.00</div>
								<div class="quick-stat-label">${isEnglish ? "Cost/Line" : "Maliyet/Satır"}</div>
							</div>
						</div>
					</div>

					<!-- Recommendations -->
					<div style="margin-top: 16px;">
						<h4 style="margin-bottom: 8px; font-size: 0.9rem;">💡 ${isEnglish ? "Optimization Recommendations" : "Optimizasyon Önerileri"}</h4>
						<div id="optimizationRecommendations">
							<!-- Dinamik olarak doldurulacak -->
						</div>
					</div>

					<!-- Token Prediction -->
					<div style="margin-top: 16px;">
						<h4 style="margin-bottom: 8px; font-size: 0.9rem;">🔮 ${isEnglish ? "Token Prediction" : "Token Tahmini"}</h4>
						<button class="btn btn-primary" onclick="showTokenPrediction()" style="width: 100%;">
							${isEnglish ? "Estimate Token Usage for Current File" : "Mevcut Dosya İçin Token Kullanımını Tahmin Et"}
						</button>
					</div>
				</div>
			</div>

			<!-- Aksiyon Butonları -->
			<div class="action-buttons">
				<button class="btn btn-primary" onclick="showDetailedStats()">
					📊 ${isEnglish ? "Detailed Statistics" : "Detaylı İstatistikler"}
				</button>
				<button class="btn btn-secondary" onclick="openSettings()">
					⚙️ ${isEnglish ? "Settings" : "Ayarlar"}
				</button>
				<button class="btn btn-success" onclick="exportStats()">
					📤 ${isEnglish ? "Export" : "Dışa Aktar"}
				</button>
				<button class="btn btn-danger" onclick="resetStats()">
					🗑️ ${isEnglish ? "Reset" : "Sıfırla"}
				</button>
			</div>
		</div>

		<div id="messageArea" style="display: none;"></div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const isEnglish = ${isEnglish};
		
		let currentStats = null;

		// VS Code mesajlarını dinle
		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.type) {
				case 'updateStats':
					updateStatsDisplay(message.stats);
					break;
				case 'showMessage':
					showMessage(message.message, message.isError);
					break;
				case 'updateTokenAnalytics':
					updateTokenAnalytics(message.tokenData);
					break;
			}
		});

		function updateStatsDisplay(stats) {
			currentStats = stats;
			
			// Eğer hiç istatistik yoksa empty state göster
			if (stats.totalImprovements === 0) {
				document.getElementById('emptyState').style.display = 'block';
				document.getElementById('statsContent').style.display = 'none';
				return;
			}
			
			// İstatistikleri göster
			document.getElementById('emptyState').style.display = 'none';
			document.getElementById('statsContent').style.display = 'block';
			
			// Genel istatistikleri güncelle
			document.getElementById('totalImprovements').textContent = stats.totalImprovements;
			document.getElementById('totalLines').textContent = stats.totalLinesImproved;
			document.getElementById('successRate').textContent = stats.successRate + '%';
			document.getElementById('avgTime').textContent = stats.averageProcessingTime + 'ms';
			
			// Günlük/Aylık özet
			document.getElementById('todayImprovements').textContent = stats.today.improvements;
			document.getElementById('monthImprovements').textContent = stats.thisMonth.improvements;
			document.getElementById('totalTokens').textContent = formatNumber(stats.totalTokensUsed);
			
			// Haftalık trend
			updateTrendChart(stats.weeklyTrend || []);
			
			// Dil istatistikleri
			updateLanguageStats(stats.languageStats || {});
			
			// WCAG kriterleri
			updateWcagStats(stats.wcagCriteriaStats || {});
			
			// Token Analytics - check if token data is available
			vscode.postMessage({ type: 'getTokenAnalytics' });
		}

		function updateTrendChart(trendData) {
			const chartContainer = document.getElementById('trendChart');
			chartContainer.innerHTML = '';
			
			if (trendData.length === 0) {
				chartContainer.innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">' + (isEnglish ? 'No trend data yet' : 'Henüz trend verisi yok') + '</p>';
				return;
			}
			
			const maxValue = Math.max(...trendData.map(d => d.improvements), 1);
			
			trendData.forEach(day => {
				const bar = document.createElement('div');
				bar.className = 'trend-bar';
				const height = Math.max((day.improvements / maxValue) * 100, 2);
				bar.style.height = height + '%';
				bar.setAttribute('data-value', day.improvements);
				bar.title = \`\${day.dayName}: \${day.improvements} improvements\`;
				chartContainer.appendChild(bar);
			});
		}

		function updateLanguageStats(languageStats) {
			const container = document.getElementById('languageStats');
			container.innerHTML = '';
			
			const languages = Object.entries(languageStats)
				.sort(([,a], [,b]) => b.improvements - a.improvements)
				.slice(0, 5); // En çok kullanılan 5 dil
			
			if (languages.length === 0) {
				container.innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">' + (isEnglish ? 'No language data yet' : 'Henüz dil verisi yok') + '</p>';
				return;
			}
			
			languages.forEach(([lang, stats]) => {
				const item = document.createElement('div');
				item.className = 'language-item';
				item.innerHTML = \`
					<div class="language-name">\${getLanguageDisplayName(lang)}</div>
					<div class="language-stats">\${stats.improvements} ${isEnglish ? 'improvements' : 'iyileştirme'}, \${stats.linesImproved} ${isEnglish ? 'lines' : 'satır'}</div>
				\`;
				container.appendChild(item);
			});
		}

		function updateWcagStats(wcagStats) {
			const container = document.getElementById('wcagStats');
			container.innerHTML = '';
			
			const criteria = Object.entries(wcagStats)
				.sort(([,a], [,b]) => b - a)
				.slice(0, 5); // En çok kullanılan 5 kriter
			
			if (criteria.length === 0) {
				container.innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">' + (isEnglish ? 'No WCAG data yet' : 'Henüz WCAG verisi yok') + '</p>';
				return;
			}
			
			criteria.forEach(([criterion, count]) => {
				const item = document.createElement('div');
				item.className = 'criteria-item';
				item.innerHTML = \`
					<div class="criteria-name">\${formatWcagCriterion(criterion)}</div>
					<div class="criteria-count">\${count} ${isEnglish ? 'times applied' : 'kez uygulandı'}</div>
				\`;
				container.appendChild(item);
			});
		}

		function getLanguageDisplayName(lang) {
			const langMap = {
				'html': 'HTML',
				'css': 'CSS',
				'javascript': 'JavaScript',
				'typescript': 'TypeScript',
				'jsx': 'React JSX',
				'tsx': 'React TSX',
				'vue': 'Vue.js',
				'scss': 'SCSS',
				'less': 'LESS'
			};
			return langMap[lang] || lang.toUpperCase();
		}

		function formatWcagCriterion(criterion) {
			// WCAG kriterleri için daha okunabilir format
			return criterion.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
		}

		function formatNumber(num) {
			if (num >= 1000000) {
				return (num / 1000000).toFixed(1) + 'M';
			} else if (num >= 1000) {
				return (num / 1000).toFixed(1) + 'K';
			}
			return num.toString();
		}

		function updateTokenAnalytics(tokenData) {
			if (!tokenData) return;
			
			// Token cost metrics
			document.getElementById('totalTokenCost').textContent = '$' + (tokenData.totalCost || 0).toFixed(4);
			document.getElementById('totalTokensUsed').textContent = formatNumber(tokenData.totalTokens || 0);
			document.getElementById('avgCostPerOperation').textContent = '$' + (tokenData.averageCostPerOperation || 0).toFixed(4);
			document.getElementById('optimizationScore').textContent = Math.round(tokenData.recommendations?.optimizationScore || 0) + '%';
			
			// Efficiency metrics
			if (tokenData.efficiency) {
				document.getElementById('tokensPerLine').textContent = (tokenData.efficiency.tokensPerLine || 0).toFixed(1);
				document.getElementById('tokensPerSecond').textContent = (tokenData.efficiency.tokensPerSecond || 0).toFixed(1);
				document.getElementById('costPerLine').textContent = '$' + (tokenData.efficiency.costPerLine || 0).toFixed(4);
			}
			
			// Cost breakdown
			updateCostBreakdown(tokenData.costByModel || {}, tokenData.costByProvider || {});
			
			// Optimization recommendations
			updateOptimizationRecommendations(tokenData.recommendations || {});
		}

		function updateCostBreakdown(costByModel, costByProvider) {
			const container = document.getElementById('costBreakdown');
			container.innerHTML = '';
			
			// Model breakdown
			const modelEntries = Object.entries(costByModel).sort(([,a], [,b]) => b - a);
			const providerEntries = Object.entries(costByProvider).sort(([,a], [,b]) => b - a);
			
			if (modelEntries.length === 0) {
				container.innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">' + (isEnglish ? 'No cost data yet' : 'Henüz maliyet verisi yok') + '</p>';
				return;
			}
			
			// Create tabs for model vs provider view
			const tabsHtml = \`
				<div style="display: flex; gap: 8px; margin-bottom: 12px;">
					<button id="modelTab" class="btn btn-secondary" onclick="switchCostView('model')" style="flex: 1; font-size: 0.7rem;">${isEnglish ? 'By Model' : 'Modele Göre'}</button>
					<button id="providerTab" class="btn btn-secondary" onclick="switchCostView('provider')" style="flex: 1; font-size: 0.7rem;">${isEnglish ? 'By Provider' : 'Sağlayıcıya Göre'}</button>
				</div>
				<div id="modelView"></div>
				<div id="providerView" style="display: none;"></div>
			\`;
			container.innerHTML = tabsHtml;
			
			// Populate model view
			const modelView = document.getElementById('modelView');
			modelEntries.slice(0, 3).forEach(([model, cost]) => {
				const item = document.createElement('div');
				item.className = 'language-item';
				item.innerHTML = \`
					<div class="language-name">\${model}</div>
					<div class="language-stats">$\${cost.toFixed(4)}</div>
				\`;
				modelView.appendChild(item);
			});
			
			// Populate provider view
			const providerView = document.getElementById('providerView');
			providerEntries.forEach(([provider, cost]) => {
				const item = document.createElement('div');
				item.className = 'language-item';
				item.innerHTML = \`
					<div class="language-name">\${provider.charAt(0).toUpperCase() + provider.slice(1)}</div>
					<div class="language-stats">$\${cost.toFixed(4)}</div>
				\`;
				providerView.appendChild(item);
			});
			
			// Set default active tab
			document.getElementById('modelTab').classList.add('btn-primary');
			document.getElementById('modelTab').classList.remove('btn-secondary');
		}

		function switchCostView(view) {
			const modelTab = document.getElementById('modelTab');
			const providerTab = document.getElementById('providerTab');
			const modelView = document.getElementById('modelView');
			const providerView = document.getElementById('providerView');
			
			if (view === 'model') {
				modelTab.className = 'btn btn-primary';
				providerTab.className = 'btn btn-secondary';
				modelView.style.display = 'block';
				providerView.style.display = 'none';
			} else {
				modelTab.className = 'btn btn-secondary';
				providerTab.className = 'btn btn-primary';
				modelView.style.display = 'none';
				providerView.style.display = 'block';
			}
		}

		function updateOptimizationRecommendations(recommendations) {
			const container = document.getElementById('optimizationRecommendations');
			container.innerHTML = '';
			
			if (!recommendations.costSavingTips || recommendations.costSavingTips.length === 0) {
				container.innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">' + (isEnglish ? 'No recommendations yet' : 'Henüz öneri yok') + '</p>';
				return;
			}
			
			// Most efficient model
			if (recommendations.mostEfficientModel) {
				const modelRec = document.createElement('div');
				modelRec.innerHTML = \`
					<div style="background: var(--vscode-textCodeBlock-background); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
						<strong>🏆 ${isEnglish ? 'Most Efficient Model:' : 'En Verimli Model:'}</strong> \${recommendations.mostEfficientModel}
					</div>
				\`;
				container.appendChild(modelRec);
			}
			
			// Cost saving tips
			recommendations.costSavingTips.forEach(tip => {
				const tipElement = document.createElement('div');
				tipElement.innerHTML = \`
					<div style="background: var(--vscode-input-background); padding: 8px; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid var(--info-color);">
						💡 \${tip}
					</div>
				\`;
				container.appendChild(tipElement);
			});
		}

		function showTokenPrediction() {
			vscode.postMessage({ type: 'showTokenPrediction' });
		}

		function showMessage(message, isError) {
			const messageArea = document.getElementById('messageArea');
			messageArea.innerHTML = \`
				<div class="alert \${isError ? 'alert-error' : 'alert-success'}">
					\${message}
				</div>
			\`;
			messageArea.style.display = 'block';
			
			setTimeout(() => {
				messageArea.style.display = 'none';
			}, 5000);
		}

		// Action functions
		function showDetailedStats() {
			vscode.postMessage({ type: 'showDetailedStats' });
		}

		function openSettings() {
			vscode.postMessage({ type: 'openSettings' });
		}

		function exportStats() {
			vscode.postMessage({ type: 'exportStats' });
		}

		function resetStats() {
			vscode.postMessage({ type: 'resetStats' });
		}



		// Yeni filtreleme ve dışarı aktarma fonksiyonları
		function filterStats() {
			const period = document.getElementById('periodFilter').value;
			const language = document.getElementById('languageFilter').value;
			
			vscode.postMessage({
				type: 'filterStats',
				period: period,
				language: language === 'all' ? undefined : language
			});
		}

		function exportStatsAdvanced() {
			const format = document.getElementById('exportFormat').value;
			const period = document.getElementById('periodFilter').value;
			
			vscode.postMessage({
				type: 'exportStats',
				format: format,
				period: period
			});
		}

		function updateLanguageFilter(languageStats) {
			const languageFilter = document.getElementById('languageFilter');
			const currentValue = languageFilter.value;
			
			// Mevcut seçenekleri temizle (sadece "Tümü" hariç)
			languageFilter.innerHTML = '<option value="all">' + (isEnglish ? 'All' : 'Tümü') + '</option>';
			
			// Kullanılan dilleri ekle
			Object.keys(languageStats || {}).forEach(lang => {
				const option = document.createElement('option');
				option.value = lang;
				option.textContent = getLanguageDisplayName(lang);
				languageFilter.appendChild(option);
			});
			
			// Önceki seçimi korumaya çalış
			if (currentValue && document.querySelector('option[value="' + currentValue + '"]')) {
				languageFilter.value = currentValue;
			}
		}

		// updateStatsDisplay fonksiyonunu genişlet
		const originalUpdateStatsDisplay = updateStatsDisplay;
		updateStatsDisplay = function(stats) {
			originalUpdateStatsDisplay(stats);
			// Dil filtresini güncelle
			updateLanguageFilter(stats.languageStats);
		};

		// İlk yükleme
		vscode.postMessage({ type: 'getStats' });
	</script>
</body>
</html>
		`;
	}
}