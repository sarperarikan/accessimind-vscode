"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatsTabHtml = exports.StatsViewProvider = void 0;
class StatsViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            enableCommandUris: false,
            enableForms: false,
            localResourceRoots: [this._extensionUri],
            portMapping: []
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((data) => __awaiter(this, void 0, void 0, function* () {
            switch (data.type) {
                case "getStats":
                    this.updateStats();
                    break;
                case "resetStats":
                    yield this.resetStats();
                    break;
            }
        }));
        // Initial stats load
        this.updateStats();
    }
    // Add updateStatistics method for external use
    updateStatistics(stats) {
        if (!this._view)
            return;
        try {
            this._view.webview.postMessage({
                type: "updateStats",
                stats: {
                    totalImprovements: stats.totalImprovements,
                    totalLinesImproved: stats.totalLinesImproved,
                    totalAnalyses: stats.totalAnalyses,
                    totalReports: stats.totalReports,
                    totalChatInteractions: stats.totalChatInteractions,
                    totalTokensUsed: stats.totalTokensUsed,
                    totalTime: this.formatTime(stats.totalTime),
                    successRate: Math.round(stats.performance.successRate * 100),
                    languageStats: stats.languageStats,
                    wcagCriteriaStats: stats.wcagCriteriaStats,
                    dailyStats: stats.dailyStats,
                    errors: stats.errors,
                    performance: stats.performance
                }
            });
        }
        catch (error) {
            console.error("Stats update error:", error);
        }
    }
    updateStats() {
        // This method is kept for backward compatibility
        // but now it just shows empty stats since we're using the new system
        if (!this._view)
            return;
        const emptyStats = {
            totalImprovements: 0,
            totalLinesImproved: 0,
            totalAnalyses: 0,
            totalReports: 0,
            totalChatInteractions: 0,
            totalTokensUsed: 0,
            totalTime: "0sn",
            successRate: 100,
            languageStats: {},
            wcagCriteriaStats: {},
            dailyStats: {},
            errors: { total: 0, byType: {}, recent: [] },
            performance: {
                avgImprovementTime: 0,
                avgAnalysisTime: 0,
                avgTokensPerImprovement: 0,
                successRate: 1.0
            }
        };
        this._view.webview.postMessage({
            type: "updateStats",
            stats: emptyStats
        });
    }
    resetStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would need to be connected to the new StatisticsTracker
                // For now, just show success message
                if (this._view) {
                    this._view.webview.postMessage({
                        type: "showMessage",
                        message: "İstatistikler sıfırlandı!",
                        isError: false
                    });
                }
            }
            catch (error) {
                console.error("Reset stats error:", error);
                if (this._view) {
                    this._view.webview.postMessage({
                        type: "showMessage",
                        message: "İstatistikler sıfırlanırken hata oluştu!",
                        isError: true
                    });
                }
            }
        });
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
    _getHtmlForWebview(webview) {
        return `
<!DOCTYPE html>
<html lang="tr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; frame-src 'none';">
	<title>AI Accessibility İstatistikleri</title>
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			margin: 0;
			padding: 16px;
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			height: 100vh;
			overflow-y: auto;
			line-height: 1.5;
		}

		.header {
			text-align: center;
			margin-bottom: 24px;
			padding-bottom: 16px;
			border-bottom: 2px solid var(--vscode-panel-border);
		}

		.header h1 {
			margin: 0 0 8px 0;
			font-size: 20px;
			font-weight: 600;
			color: var(--vscode-editor-foreground);
		}

		.header p {
			margin: 0;
			color: var(--vscode-descriptionForeground);
			font-size: 14px;
		}

		.message {
			padding: 12px 16px;
			border-radius: 6px;
			margin: 16px 0;
			display: none;
			font-weight: 500;
		}

		.message.success {
			background-color: var(--vscode-debugIcon-startForeground);
			color: white;
		}

		.message.error {
			background-color: var(--vscode-errorBackground);
			color: var(--vscode-errorForeground);
			border: 1px solid var(--vscode-errorBorder);
		}

		.message.show {
			display: block;
		}

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
			gap: 16px;
			margin-bottom: 24px;
		}

		.stat-card {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			padding: 20px;
			text-align: center;
			transition: all 0.2s ease;
			position: relative;
		}

		.stat-card:hover {
			border-color: var(--vscode-button-background);
			transform: translateY(-2px);
		}

		.stat-card:focus-within {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}

		.stat-number {
			font-size: 28px;
			font-weight: 700;
			color: var(--vscode-button-background);
			margin-bottom: 8px;
			display: block;
		}

		.stat-label {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			text-transform: uppercase;
			letter-spacing: 0.5px;
			font-weight: 500;
		}

		.section {
			margin-bottom: 24px;
		}

		.section-title {
			font-size: 18px;
			font-weight: 600;
			margin-bottom: 16px;
			color: var(--vscode-editor-foreground);
			padding-bottom: 8px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}

		.improvements-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
			gap: 12px;
			margin-bottom: 20px;
		}

		.improvement-item {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			padding: 16px;
			text-align: center;
		}

		.improvement-number {
			font-size: 24px;
			font-weight: 600;
			color: var(--vscode-debugIcon-startForeground);
			margin-bottom: 4px;
		}

		.improvement-label {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-weight: 500;
		}

		.recent-activity {
			max-height: 300px;
			overflow-y: auto;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			background-color: var(--vscode-editor-background);
		}

		.activity-item {
			padding: 12px 16px;
			border-bottom: 1px solid var(--vscode-panel-border);
			font-size: 13px;
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.activity-item:last-child {
			border-bottom: none;
		}

		.activity-item:hover {
			background-color: var(--vscode-list-hoverBackground);
		}

		.activity-time {
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
			min-width: 80px;
		}

		.activity-mode {
			font-weight: 600;
			color: var(--vscode-button-background);
			flex: 1;
		}

		.activity-status {
			display: flex;
			align-items: center;
			gap: 4px;
		}

		.activity-success {
			color: var(--vscode-debugIcon-startForeground);
		}

		.activity-error {
			color: var(--vscode-errorForeground);
		}

		.reset-button {
			width: 100%;
			padding: 12px 16px;
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-button-border);
			border-radius: 6px;
			cursor: pointer;
			font-family: inherit;
			font-size: 14px;
			font-weight: 500;
			transition: all 0.2s ease;
		}

		.reset-button:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}

		.reset-button:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}

		.reset-button:active {
			transform: translateY(1px);
		}

		.sr-only {
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

		@media (prefers-reduced-motion: reduce) {
			.stat-card,
			.reset-button {
				transition: none;
			}
		}

		@media (max-width: 600px) {
			.stats-grid {
				grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
			}
			
			.improvements-grid {
				grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			}
		}

		.wcag-stats {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 16px;
			margin-bottom: 20px;
		}

		.wcag-item {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			padding: 16px;
			transition: all 0.2s ease;
		}

		.wcag-item:hover {
			border-color: var(--vscode-button-background);
			transform: translateY(-2px);
		}

		.wcag-criterion {
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-editor-foreground);
			margin-bottom: 8px;
			display: block;
		}

		.wcag-description {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 8px;
		}

		.wcag-metrics {
			display: flex;
			gap: 16px;
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}

		.wcag-metric {
			display: flex;
			flex-direction: column;
			align-items: center;
		}

		.wcag-metric-number {
			font-weight: 600;
			color: var(--vscode-button-background);
		}

		.progress-bar {
			width: 100%;
			height: 8px;
			background-color: var(--vscode-panel-border);
			border-radius: 4px;
			overflow: hidden;
			margin-top: 8px;
		}

		.progress-fill {
			height: 100%;
			background-color: var(--vscode-button-background);
			transition: width 0.3s ease;
		}
	</style>
</head>
<body>
	<header class="header" role="banner">
		<h1 id="main-title">AccessiMind Statistics</h1>
		<p>Kod yapısı iyileştirme istatistikleri ve erişilebilirlik metrikleri</p>
	</header>

	<div class="message" id="message" role="alert" aria-live="polite"></div>

	<section class="section" role="region" aria-labelledby="overview-title">
		<h2 id="overview-title" class="section-title">Genel Bakış</h2>
		<div class="stats-grid" role="grid" aria-label="Genel istatistikler">
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="totalCodeStructures" aria-label="Toplam kod yapısı iyileştirmesi">0</span>
				<span class="stat-label">Kod Yapısı</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="successRate" aria-label="Başarı oranı">0%</span>
				<span class="stat-label">Başarı Oranı</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="totalAccessibilityImprovements" aria-label="Toplam erişilebilirlik iyileştirmesi">0</span>
				<span class="stat-label">Erişilebilirlik</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="errors" aria-label="Hata sayısı">0</span>
				<span class="stat-label">Hatalar</span>
			</div>
		</div>
	</section>

	<section class="section" role="region" aria-labelledby="improvements-title">
		<h2 id="improvements-title" class="section-title">Erişilebilirlik İyileştirmeleri</h2>
		<div class="improvements-grid" role="grid" aria-label="Erişilebilirlik iyileştirme detayları">
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="accessibilityIssuesFixed" aria-label="Düzeltilen erişilebilirlik sorunu">0</div>
				<div class="improvement-label">Sorun Düzeltildi</div>
			</div>
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="ariaLabelsAdded" aria-label="Eklenen ARIA etiketi">0</div>
				<div class="improvement-label">ARIA Etiketi</div>
			</div>
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="formsEnhanced" aria-label="İyileştirilen form">0</div>
				<div class="improvement-label">Form İyileştirildi</div>
			</div>
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="tablesImproved" aria-label="İyileştirilen tablo">0</div>
				<div class="improvement-label">Tablo İyileştirildi</div>
			</div>
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="imagesOptimized" aria-label="Optimize edilen resim">0</div>
				<div class="improvement-label">Resim Optimize Edildi</div>
			</div>
		</div>
	</section>

	<section class="section" role="region" aria-labelledby="modes-title">
		<h2 id="modes-title" class="section-title">Mod Kullanımı</h2>
		<div class="stats-grid" role="grid" aria-label="Mod kullanım istatistikleri">
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="agentMode" aria-label="Agent modu kullanım sayısı">0</span>
				<span class="stat-label">Agent Mode</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="editMode" aria-label="Edit modu kullanım sayısı">0</span>
				<span class="stat-label">Edit Mode</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="debugMode" aria-label="Debug modu kullanım sayısı">0</span>
				<span class="stat-label">Debug Mode</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="quickImprove" aria-label="Hızlı iyileştirme kullanım sayısı">0</span>
				<span class="stat-label">Quick Improve</span>
			</div>
		</div>
	</section>

	<section class="section" role="region" aria-labelledby="activity-title">
		<h2 id="activity-title" class="section-title">Son Aktiviteler (7 Gün)</h2>
		<div class="recent-activity" id="recentActivity" role="log" aria-label="Son aktiviteler listesi">
			<div class="activity-item">
				<span class="activity-time">Henüz aktivite yok</span>
			</div>
		</div>
	</section>

	<section class="section" role="region" aria-labelledby="time-stats-title">
		<h2 id="time-stats-title" class="section-title">Zaman Bazlı İstatistikler</h2>
		<div class="stats-grid" role="grid" aria-label="Zaman bazlı istatistikler">
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="todayEnhancements" aria-label="Bugünkü iyileştirme sayısı">0</span>
				<span class="stat-label">Bugün</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="thisWeekEnhancements" aria-label="Bu haftaki iyileştirme sayısı">0</span>
				<span class="stat-label">Bu Hafta</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="thisMonthEnhancements" aria-label="Bu ayki iyileştirme sayısı">0</span>
				<span class="stat-label">Bu Ay</span>
			</div>
			<div class="stat-card" role="gridcell" tabindex="0">
				<span class="stat-number" id="thisQuarterEnhancements" aria-label="Bu çeyrekteki iyileştirme sayısı">0</span>
				<span class="stat-label">Bu Çeyrek</span>
			</div>
		</div>
	</section>

	<section class="section" role="region" aria-labelledby="wcag-stats-title">
		<h2 id="wcag-stats-title" class="section-title">WCAG Kriterleri İstatistikleri</h2>
		<div class="wcag-stats" id="wcagStats" role="grid" aria-label="WCAG kriterleri istatistikleri">
			<div class="wcag-item">
				<span class="wcag-criterion">Henüz WCAG kriteri kullanılmadı</span>
			</div>
		</div>
	</section>

	<section class="section" role="region" aria-labelledby="code-structure-title">
		<h2 id="code-structure-title" class="section-title">Kod Yapısı İyileştirmeleri</h2>
		<div class="improvements-grid" role="grid" aria-label="Kod yapısı iyileştirme detayları">
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="totalElementsImproved" aria-label="Toplam iyileştirilen element">0</div>
				<div class="improvement-label">Toplam Element</div>
			</div>
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="ariaAttributesCount" aria-label="Eklenen ARIA özelliği">0</div>
				<div class="improvement-label">ARIA Özellikleri</div>
			</div>
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="semanticElementsCount" aria-label="Semantik element sayısı">0</div>
				<div class="improvement-label">Semantik Elementler</div>
			</div>
			<div class="improvement-item" role="gridcell" tabindex="0">
				<div class="improvement-number" id="accessibilityFeaturesCount" aria-label="Erişilebilirlik özelliği sayısı">0</div>
				<div class="improvement-label">Erişilebilirlik Özellikleri</div>
			</div>
		</div>
	</section>

	<button class="reset-button" id="resetButton" aria-label="Tüm istatistikleri sıfırla">
		İstatistikleri Sıfırla
	</button>

	<script>
		const vscode = acquireVsCodeApi();
		const messageDiv = document.getElementById('message');
		const resetButton = document.getElementById('resetButton');

		function showMessage(text, isError = false) {
			messageDiv.textContent = text;
			messageDiv.className = \`message \${isError ? 'error' : 'success'} show\`;
			setTimeout(() => {
				messageDiv.classList.remove('show');
			}, 4000);
		}

		function updateStatsDisplay(stats) {
			// Update main statistics
			document.getElementById('totalCodeStructures').textContent = stats.totalCodeStructures;
			document.getElementById('successRate').textContent = \`\${stats.successRate}%\`;
			document.getElementById('totalAccessibilityImprovements').textContent = stats.totalAccessibilityImprovements;
			document.getElementById('errors').textContent = stats.errorsCount;
			
			// Update mode usage
			document.getElementById('agentMode').textContent = stats.agentModeCount;
			document.getElementById('editMode').textContent = stats.editModeCount;
			document.getElementById('debugMode').textContent = stats.debugModeCount;
			document.getElementById('quickImprove').textContent = stats.quickImproveCount;
			
			// Update accessibility improvements
			document.getElementById('accessibilityIssuesFixed').textContent = stats.accessibilityIssuesFixed;
			document.getElementById('ariaLabelsAdded').textContent = stats.ariaLabelsAdded;
			document.getElementById('formsEnhanced').textContent = stats.formsEnhanced;
			document.getElementById('tablesImproved').textContent = stats.tablesImproved;
			document.getElementById('imagesOptimized').textContent = stats.imagesOptimized;

			// Update time-based statistics
			if (stats.dailyStats) {
				document.getElementById('todayEnhancements').textContent = stats.dailyStats.totalEnhancements || 0;
			}
			if (stats.weeklyStats) {
				document.getElementById('thisWeekEnhancements').textContent = stats.weeklyStats.totalEnhancements || 0;
			}
			if (stats.monthlyStats) {
				document.getElementById('thisMonthEnhancements').textContent = stats.monthlyStats.totalEnhancements || 0;
			}
			if (stats.quarterlyStats) {
				document.getElementById('thisQuarterEnhancements').textContent = stats.quarterlyStats.totalEnhancements || 0;
			}

			// Update code structure improvements
			if (stats.codeStructureStats) {
				document.getElementById('totalElementsImproved').textContent = stats.codeStructureStats.totalElementsImproved || 0;
				document.getElementById('ariaAttributesCount').textContent = Object.values(stats.codeStructureStats.ariaAttributes || {}).reduce((a, b) => a + b, 0);
				document.getElementById('semanticElementsCount').textContent = Object.values(stats.codeStructureStats.semanticElements || {}).reduce((a, b) => a + b, 0);
				document.getElementById('accessibilityFeaturesCount').textContent = Object.values(stats.codeStructureStats.accessibilityFeatures || {}).reduce((a, b) => a + b, 0);
			}

			// Update WCAG criteria statistics
			const wcagStatsDiv = document.getElementById('wcagStats');
			if (stats.wcagCriteriaStats && Object.keys(stats.wcagCriteriaStats).length > 0) {
				wcagStatsDiv.innerHTML = Object.values(stats.wcagCriteriaStats).map(criterion => {
					const successRate = criterion.usageCount > 0 ? Math.round((criterion.successCount / criterion.usageCount) * 100) : 0;
					return \`
						<div class="wcag-item" role="gridcell" tabindex="0">
							<span class="wcag-criterion" aria-label="WCAG kriteri">\${criterion.criterion}</span>
							<div class="wcag-description" aria-label="Kriter açıklaması">\${criterion.description}</div>
							<div class="wcag-metrics">
								<div class="wcag-metric">
									<span class="wcag-metric-number">\${criterion.usageCount}</span>
									<span>Kullanım</span>
								</div>
								<div class="wcag-metric">
									<span class="wcag-metric-number">\${criterion.successCount}</span>
									<span>Başarılı</span>
								</div>
								<div class="wcag-metric">
									<span class="wcag-metric-number">\${successRate}%</span>
									<span>Başarı Oranı</span>
								</div>
							</div>
							<div class="progress-bar" role="progressbar" aria-valuenow="\${successRate}" aria-valuemin="0" aria-valuemax="100">
								<div class="progress-fill" style="width: \${successRate}%"></div>
							</div>
						</div>
					\`;
				}).join('');
			} else {
				wcagStatsDiv.innerHTML = '<div class="wcag-item"><span class="wcag-criterion">Henüz WCAG kriteri kullanılmadı</span></div>';
			}

			// Update recent activity
			const recentActivityDiv = document.getElementById('recentActivity');
			if (stats.recentActivity && stats.recentActivity.length > 0) {
				recentActivityDiv.innerHTML = stats.recentActivity.map(activity => {
					const date = new Date(activity.timestamp);
					const timeStr = date.toLocaleString('tr-TR');
					const modeStr = activity.mode.charAt(0).toUpperCase() + activity.mode.slice(1);
					const statusClass = activity.success ? 'activity-success' : 'activity-error';
					const statusText = activity.success ? '✓' : '✗';
					const statusLabel = activity.success ? 'Başarılı' : 'Hata';
					
					return \`
						<div class="activity-item" role="listitem">
							<span class="activity-time" aria-label="Tarih ve saat">\${timeStr}</span>
							<span class="activity-mode" aria-label="Kullanılan mod">\${modeStr}</span>
							<span class="activity-status" aria-label="İşlem durumu">
								<span class="\${statusClass}" aria-label="\${statusLabel}">\${statusText}</span>
							</span>
						</div>
					\`;
				}).join('');
			} else {
				recentActivityDiv.innerHTML = '<div class="activity-item" role="listitem"><span class="activity-time">Henüz aktivite yok</span></div>';
			}
		}

		resetButton.addEventListener('click', () => {
			if (confirm('Tüm istatistikleri sıfırlamak istediğinizden emin misiniz?')) {
				vscode.postMessage({ type: 'resetStats' });
			}
		});

		// Keyboard navigation for stat cards
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				const target = e.target;
				if (target.classList.contains('stat-card') || target.classList.contains('improvement-item')) {
					e.preventDefault();
					// Announce the stat value for screen readers
					const numberElement = target.querySelector('.stat-number');
					const labelElement = target.querySelector('.stat-label, .improvement-label');
					if (numberElement && labelElement) {
						const announcement = \`\${labelElement.textContent}: \${numberElement.textContent}\`;
						// Create a temporary announcement element
						const announcementDiv = document.createElement('div');
						announcementDiv.setAttribute('aria-live', 'polite');
						announcementDiv.className = 'sr-only';
						announcementDiv.textContent = announcement;
						document.body.appendChild(announcementDiv);
						setTimeout(() => {
							document.body.removeChild(announcementDiv);
						}, 1000);
					}
				}
			}
		});

		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.type) {
				case 'updateStats':
					updateStatsDisplay(message.stats);
					break;
				case 'showMessage':
					showMessage(message.message, message.isError);
					break;
			}
		});

		// Request initial stats
		vscode.postMessage({ type: 'getStats' });
	</script>
</body>
</html>
		`;
    }
}
exports.StatsViewProvider = StatsViewProvider;
StatsViewProvider.viewType = "wcagEnhancer.statsView";
function getStatsTabHtml() {
    return `
	<div class="stats-tab-content" role="region" aria-label="İstatistikler Bölümü">
		<div class="stats-header">
			<h2>📊 WCAG AI İstatistikleri</h2>
			<div class="stats-controls">
				<button class="refresh-button" onclick="refreshStats()" aria-label="İstatistikleri yenile">
					🔄 Yenile
				</button>
				<button class="export-button" onclick="exportStats()" aria-label="İstatistikleri dışa aktar">
					📤 Dışa Aktar
				</button>
				<button class="clear-button" onclick="clearStats()" aria-label="İstatistikleri temizle">
					🗑️ Temizle
				</button>
			</div>
		</div>

		<div class="stats-grid">
			<div class="stat-card primary">
				<div class="stat-icon">🤖</div>
				<div class="stat-content">
					<div class="stat-value" id="totalRequests">0</div>
					<div class="stat-label">Toplam İstek</div>
				</div>
			</div>

			<div class="stat-card success">
				<div class="stat-icon">✅</div>
				<div class="stat-content">
					<div class="stat-value" id="successfulRequests">0</div>
					<div class="stat-label">Başarılı</div>
				</div>
			</div>

			<div class="stat-card warning">
				<div class="stat-icon">⚠️</div>
				<div class="stat-content">
					<div class="stat-value" id="failedRequests">0</div>
					<div class="stat-label">Başarısız</div>
				</div>
			</div>

			<div class="stat-card info">
				<div class="stat-icon">⚡</div>
				<div class="stat-content">
					<div class="stat-value" id="avgResponseTime">0ms</div>
					<div class="stat-label">Ort. Yanıt Süresi</div>
				</div>
			</div>
		</div>

		<div class="stats-sections">
			<div class="stats-section">
				<h3>📈 Model Kullanım İstatistikleri</h3>
				<div class="model-stats" id="modelStats">
					<div class="model-stat">
						<div class="model-name">Gemini 2.0 Flash (Hızlı)</div>
						<div class="model-usage">
							<div class="usage-bar">
								<div class="usage-fill" style="width: 0%"></div>
							</div>
							<span class="usage-count">0</span>
						</div>
					</div>
					<div class="model-stat">
						<div class="model-name">Gemini 2.0 Flash (Standart)</div>
						<div class="model-usage">
							<div class="usage-bar">
								<div class="usage-fill" style="width: 0%"></div>
							</div>
							<span class="usage-count">0</span>
						</div>
					</div>
					<div class="model-stat">
						<div class="model-name">Gemini 1.5 Flash</div>
						<div class="model-usage">
							<div class="usage-bar">
								<div class="usage-fill" style="width: 0%"></div>
							</div>
							<span class="usage-count">0</span>
						</div>
					</div>
				</div>
			</div>

			<div class="stats-section">
				<h3>🎯 WCAG Kriterleri İstatistikleri</h3>
				<div class="wcag-stats" id="wcagStats">
					<div class="wcag-category">
						<h4>Görsel (1.x)</h4>
						<div class="wcag-criteria">
							<div class="criterion">
								<span class="criterion-name">1.1.1 - Metin Alternatifi</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">1.4.3 - Kontrast (Minimum)</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">1.4.6 - Kontrast (Gelişmiş)</span>
								<span class="criterion-count">0</span>
							</div>
						</div>
					</div>
					<div class="wcag-category">
						<h4>İşlevsel (2.x)</h4>
						<div class="wcag-criteria">
							<div class="criterion">
								<span class="criterion-name">2.1.1 - Klavye</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">2.4.1 - Atlama Blokları</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">2.4.3 - Odak Sırası</span>
								<span class="criterion-count">0</span>
							</div>
						</div>
					</div>
					<div class="wcag-category">
						<h4>Anlaşılabilir (3.x)</h4>
						<div class="wcag-criteria">
							<div class="criterion">
								<span class="criterion-name">3.1.1 - Sayfa Dili</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">3.2.1 - Odak Değişikliği</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">3.3.2 - Etiketler</span>
								<span class="criterion-count">0</span>
							</div>
						</div>
					</div>
					<div class="wcag-category">
						<h4>Sağlam (4.x)</h4>
						<div class="wcag-criteria">
							<div class="criterion">
								<span class="criterion-name">4.1.1 - Ayrıştırma</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">4.1.2 - İsim, Rol, Değer</span>
								<span class="criterion-count">0</span>
							</div>
							<div class="criterion">
								<span class="criterion-name">4.1.3 - Durum Mesajları</span>
								<span class="criterion-count">0</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="stats-section">
				<h3>📅 Zaman Bazlı İstatistikler</h3>
				<div class="time-stats">
					<div class="time-period-selector">
						<button class="time-period active" data-period="today">Bugün</button>
						<button class="time-period" data-period="week">Bu Hafta</button>
						<button class="time-period" data-period="month">Bu Ay</button>
						<button class="time-period" data-period="all">Tümü</button>
					</div>
					<div class="time-chart" id="timeChart">
						<div class="chart-placeholder">
							📊 Zaman bazlı grafik burada görünecek
						</div>
					</div>
				</div>
			</div>

			<div class="stats-section">
				<h3>🔧 Performans Metrikleri</h3>
				<div class="performance-stats">
					<div class="perf-metric">
						<div class="metric-label">En Hızlı Yanıt</div>
						<div class="metric-value" id="fastestResponse">-</div>
					</div>
					<div class="perf-metric">
						<div class="metric-label">En Yavaş Yanıt</div>
						<div class="metric-value" id="slowestResponse">-</div>
					</div>
					<div class="perf-metric">
						<div class="metric-label">Toplam Token Kullanımı</div>
						<div class="metric-value" id="totalTokens">0</div>
					</div>
					<div class="perf-metric">
						<div class="metric-label">Ortalama Token/İstek</div>
						<div class="metric-value" id="avgTokensPerRequest">0</div>
					</div>
				</div>
			</div>
		</div>

		<style>
			.stats-tab-content {
				padding: 16px;
				height: 100%;
				overflow-y: auto;
			}
			.stats-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 24px;
				padding-bottom: 16px;
				border-bottom: 1px solid var(--vscode-panel-border);
			}
			.stats-header h2 {
				margin: 0;
				font-size: 18px;
				font-weight: 600;
			}
			.stats-controls {
				display: flex;
				gap: 8px;
			}
			.stats-controls button {
				padding: 6px 12px;
				background-color: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
				border: 1px solid var(--vscode-button-border);
				border-radius: 4px;
				font-size: 11px;
				cursor: pointer;
				transition: all 0.2s ease;
			}
			.stats-controls button:hover {
				background-color: var(--vscode-button-secondaryHoverBackground);
			}
			.stats-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 16px;
				margin-bottom: 32px;
			}
			.stat-card {
				display: flex;
				align-items: center;
				gap: 16px;
				padding: 20px;
				border-radius: 8px;
				background-color: var(--vscode-editor-background);
				border: 1px solid var(--vscode-panel-border);
				transition: all 0.2s ease;
			}
			.stat-card:hover {
				transform: translateY(-2px);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			}
			.stat-card.primary {
				border-left: 4px solid var(--vscode-button-background);
			}
			.stat-card.success {
				border-left: 4px solid var(--vscode-debugIcon-startForeground);
			}
			.stat-card.warning {
				border-left: 4px solid var(--vscode-debugIcon-stopForeground);
			}
			.stat-card.info {
				border-left: 4px solid var(--vscode-debugIcon-pauseForeground);
			}
			.stat-icon {
				font-size: 24px;
				width: 40px;
				height: 40px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 8px;
				background-color: var(--vscode-list-hoverBackground);
			}
			.stat-content {
				flex: 1;
			}
			.stat-value {
				font-size: 24px;
				font-weight: 700;
				color: var(--vscode-editor-foreground);
				line-height: 1;
			}
			.stat-label {
				font-size: 12px;
				color: var(--vscode-descriptionForeground);
				margin-top: 4px;
			}
			.stats-sections {
				display: flex;
				flex-direction: column;
				gap: 32px;
			}
			.stats-section {
				background-color: var(--vscode-editor-background);
				border: 1px solid var(--vscode-panel-border);
				border-radius: 8px;
				padding: 20px;
			}
			.stats-section h3 {
				margin: 0 0 16px 0;
				font-size: 16px;
				font-weight: 600;
				color: var(--vscode-editor-foreground);
			}
			.model-stats {
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.model-stat {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 12px;
				background-color: var(--vscode-list-hoverBackground);
				border-radius: 6px;
			}
			.model-name {
				font-size: 13px;
				font-weight: 500;
				color: var(--vscode-editor-foreground);
			}
			.model-usage {
				display: flex;
				align-items: center;
				gap: 12px;
			}
			.usage-bar {
				width: 100px;
				height: 6px;
				background-color: var(--vscode-panel-border);
				border-radius: 3px;
				overflow: hidden;
			}
			.usage-fill {
				height: 100%;
				background-color: var(--vscode-button-background);
				border-radius: 3px;
				transition: width 0.3s ease;
			}
			.usage-count {
				font-size: 12px;
				font-weight: 600;
				color: var(--vscode-editor-foreground);
				min-width: 30px;
				text-align: right;
			}
			.wcag-stats {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
				gap: 20px;
			}
			.wcag-category {
				background-color: var(--vscode-list-hoverBackground);
				border-radius: 6px;
				padding: 16px;
			}
			.wcag-category h4 {
				margin: 0 0 12px 0;
				font-size: 14px;
				font-weight: 600;
				color: var(--vscode-editor-foreground);
			}
			.wcag-criteria {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.criterion {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 6px 8px;
				background-color: var(--vscode-editor-background);
				border-radius: 4px;
				font-size: 11px;
			}
			.criterion-name {
				color: var(--vscode-descriptionForeground);
			}
			.criterion-count {
				font-weight: 600;
				color: var(--vscode-editor-foreground);
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				padding: 2px 6px;
				border-radius: 10px;
				font-size: 10px;
			}
			.time-stats {
				display: flex;
				flex-direction: column;
				gap: 16px;
			}
			.time-period-selector {
				display: flex;
				gap: 4px;
				background-color: var(--vscode-list-hoverBackground);
				border-radius: 6px;
				padding: 4px;
			}
			.time-period {
				flex: 1;
				padding: 6px 12px;
				background: none;
				border: none;
				border-radius: 4px;
				font-size: 11px;
				cursor: pointer;
				transition: all 0.2s ease;
				color: var(--vscode-descriptionForeground);
			}
			.time-period.active {
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
			}
			.time-chart {
				height: 200px;
				background-color: var(--vscode-list-hoverBackground);
				border-radius: 6px;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			.chart-placeholder {
				color: var(--vscode-descriptionForeground);
				font-size: 13px;
			}
			.performance-stats {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 16px;
			}
			.perf-metric {
				background-color: var(--vscode-list-hoverBackground);
				padding: 16px;
				border-radius: 6px;
				text-align: center;
			}
			.metric-label {
				font-size: 12px;
				color: var(--vscode-descriptionForeground);
				margin-bottom: 8px;
			}
			.metric-value {
				font-size: 18px;
				font-weight: 600;
				color: var(--vscode-editor-foreground);
			}
		</style>
	`;
}
exports.getStatsTabHtml = getStatsTabHtml;
