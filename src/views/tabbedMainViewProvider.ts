import * as vscode from "vscode";
import { AIProviderManager } from "../utils/aiProvider";
import { StatisticsManager } from "../utils/statisticsManager";
import { localization } from "../utils/localizationManager";

export class TabbedMainViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wcagEnhancer.tabbedMainView";
	private _view?: vscode.WebviewView;
	private _context?: vscode.ExtensionContext;
	private _statisticsManager: StatisticsManager;
	private _aiProviderManager: AIProviderManager;

	constructor(private readonly _extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
		this._context = context;
		this._statisticsManager = StatisticsManager.getInstance(context!);
		this._aiProviderManager = AIProviderManager.getInstance();
		
		// Set up real-time statistics listener
		this.setupRealTimeListeners();
	}

	private setupRealTimeListeners(): void {
		// Listen for real-time statistics changes
		this._statisticsManager.on("statisticsChanged", (stats) => {
			if (this._view) {
				this._view.webview.postMessage({ type: "statistics", stats });
			}
		});
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case "getStatistics": {
					const stats = this._statisticsManager.getDetailedStatistics();
					this._view?.webview.postMessage({ type: "statistics", stats });
					break;
				}
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const isEnglish = localization.getCurrentLanguage() === "en";
		const statsLoadingText = isEnglish ? "Loading statistics..." : "İstatistikler yükleniyor...";
		const totalImprovementsText = isEnglish ? "Total Improvements" : "Toplam İyileştirme";
		const linesImprovedText = isEnglish ? "Lines Improved" : "İyileştirilen Satır";
		const avgProcessingTimeText = isEnglish ? "Avg Processing Time" : "Ort. İşlem Süresi";
		const totalTokensText = isEnglish ? "Total Tokens Used" : "Toplam Token";
		
		return `
<!DOCTYPE html>
<html lang="${isEnglish ? "en" : "tr"}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AccessiMind</title>
	<style>
		body { font-family: var(--vscode-font-family); margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-foreground); height: 100vh; display: flex; flex-direction: column; }
		.header { display: flex; align-items: center; gap: 8px; padding: 16px 20px 8px 20px; border-bottom: 1px solid var(--vscode-panel-border); }
		.tab-content { flex: 1; padding: 0; overflow-y: auto; height: 100%; }
		#stats-section { padding: 24px; }
		.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
		.stat-card { background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; text-align: center; }
		.stat-number { font-size: 2rem; font-weight: bold; color: var(--vscode-textLink-foreground); }
		.stat-label { margin-top: 5px; color: var(--vscode-descriptionForeground); }
	</style>
</head>
<body>
	<div class="header" role="banner">
		<span style="font-size:20px;font-weight:600;">AccessiMind - ${isEnglish ? "Statistics" : "İstatistikler"}</span>
	</div>
	<main class="tab-content" id="tabpanel-stats" role="main" aria-label="${isEnglish ? "Statistics" : "İstatistikler"}">
		<section id="stats-section">
			<div id="stats-loading">${statsLoadingText}</div>
			<div class="stats-grid" id="stats-grid" style="display:none;"></div>
		</section>
	</main>
	<script>
		const vscode = acquireVsCodeApi();

		// Load statistics on page load
		vscode.postMessage({ type: 'getStatistics' });

		window.addEventListener('message', event => {
			const msg = event.data;
			if (msg.type === 'statistics') {
				document.getElementById('stats-loading').style.display = 'none';
				const grid = document.getElementById('stats-grid');
				grid.style.display = '';
				grid.innerHTML = '';
				const stats = msg.stats;
				const statList = [
					{ label: '${totalImprovementsText}', value: stats.totalImprovements },
					{ label: '${linesImprovedText}', value: stats.totalLinesImproved },
					{ label: '${avgProcessingTimeText}', value: stats.averageProcessingTime + 'ms' },
					{ label: '${totalTokensText}', value: stats.totalTokensUsed }
				];
				statList.forEach(({ label, value }) => {
					const card = document.createElement('div');
					card.className = 'stat-card';
					card.innerHTML = \`<div class="stat-number">\${value}</div><div class="stat-label">\${label}</div>\`;
					grid.appendChild(card);
				});
			}
		});
	</script>
</body>
</html>`;
	}
} 