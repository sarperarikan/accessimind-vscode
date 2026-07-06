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
		this.setupRealTimeListeners();
	}

	private setupRealTimeListeners(): void {
		this._statisticsManager.on("statisticsChanged", (stats) => {
			if (this._view) {
				this._view.webview.postMessage({ type: "statistics", stats });
			}
		});
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
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
				case "openChat":
					await vscode.commands.executeCommand("wcagEnhancer.openChat");
					break;
				case "openSettings":
					await vscode.commands.executeCommand("wcagEnhancer.openSettings");
					break;
			}
		});
	}

	public refreshView(): void {
		if (!this._view) {
			return;
		}

		this._view.webview.html = this._getHtmlForWebview(this._view.webview);
		const stats = this._statisticsManager.getDetailedStatistics();
		this._view.webview.postMessage({ type: "statistics", stats });
	}

	private _getHtmlForWebview(_webview: vscode.Webview): string {
		const isEnglish = localization.getCurrentLanguage() === "en";
		const copy = {
			title: isEnglish ? "Statistics Overview" : "Istatistik Genel Bakis",
			eyebrow: "AccessiMind",
			description: isEnglish
				? "Track current accessibility activity, response speed, and token usage from a quieter, easier-to-scan dashboard."
				: "Guncel erisilebilirlik aktivitelerini, yanit hizini ve token kullanimini daha sade bir panelde izleyin.",
			loading: isEnglish ? "Loading statistics..." : "Istatistikler yukleniyor...",
			summary: isEnglish ? "Live accessibility activity" : "Canli erisilebilirlik aktivitesi",
			summaryBody: isEnglish
				? "Run an analysis or a fix to populate the metrics below."
				: "Asagidaki metrikleri doldurmak icin bir analiz veya duzeltme calistirin.",
			actions: isEnglish ? "Quick actions" : "Hizli aksiyonlar",
			chatAction: isEnglish ? "Open Chat" : "Sohbeti Ac",
			settingsAction: isEnglish ? "Open Settings" : "Ayarlari Ac",
			health: isEnglish ? "Workspace health" : "Calisma alani durumu",
			healthHint: isEnglish ? "Updates automatically when statistics change." : "Istatistikler degistiginde otomatik guncellenir.",
			totalImprovements: isEnglish ? "Total Improvements" : "Toplam Iyilestirme",
			linesImproved: isEnglish ? "Lines Improved" : "Iyilestirilen Satir",
			avgProcessingTime: isEnglish ? "Avg Processing Time" : "Ort. Islem Suresi",
			totalTokens: isEnglish ? "Total Tokens Used" : "Toplam Token",
			totalImprovementsHelp: isEnglish ? "Completed accessibility improvement actions." : "Tamamlanan erisilebilirlik iyilestirme islemleri.",
			linesImprovedHelp: isEnglish ? "Total lines touched by AI-assisted fixes." : "AI destekli duzeltmelerin dokundugu toplam satir sayisi.",
			avgProcessingTimeHelp: isEnglish ? "Average response speed across operations." : "Islemler genelinde ortalama yanit hizi.",
			totalTokensHelp: isEnglish ? "Aggregate token usage across providers." : "Saglayicilar genelinde toplam token kullanimi."
		};

		return `<!DOCTYPE html>
<html lang="${isEnglish ? "en" : "tr"}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AccessiMind</title>
	<style>
		:root {
			color-scheme: light dark;
			--surface-1: color-mix(in srgb, var(--vscode-editor-background) 86%, var(--vscode-list-hoverBackground) 14%);
			--surface-2: color-mix(in srgb, var(--vscode-input-background) 82%, var(--vscode-editor-background) 18%);
			--surface-accent: color-mix(in srgb, var(--vscode-button-background) 14%, transparent);
			--border-soft: color-mix(in srgb, var(--vscode-panel-border) 76%, transparent);
			--text-muted: var(--vscode-descriptionForeground);
			--radius-lg: 18px;
			--radius-md: 12px;
			--radius-pill: 999px;
			--success: #16a34a;
		}
		* { box-sizing: border-box; }
		body {
			font-family: var(--vscode-font-family);
			margin: 0;
			min-height: 100vh;
			background:
				radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-button-background) 16%, transparent), transparent 34%),
				linear-gradient(180deg, color-mix(in srgb, var(--vscode-editor-background) 92%, black 8%), var(--vscode-editor-background));
			color: var(--vscode-foreground);
		}
		.shell {
			display: grid;
			gap: 18px;
			padding: 22px;
		}
		.hero {
			display: grid;
			gap: 10px;
			padding: 22px;
			border: 1px solid var(--border-soft);
			border-radius: var(--radius-lg);
			background: linear-gradient(145deg, var(--surface-accent), var(--surface-1));
			box-shadow: 0 18px 40px rgba(0,0,0,.14);
		}
		.eyebrow {
			font-size: 11px;
			letter-spacing: .12em;
			text-transform: uppercase;
			color: var(--text-muted);
		}
		.hero-title {
			font-size: 22px;
			font-weight: 800;
			line-height: 1.08;
		}
		.hero-copy {
			max-width: 56ch;
			color: var(--text-muted);
			line-height: 1.55;
		}
		.hero-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 4px;
		}
		.hero-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 10px;
		}
		.action-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 42px;
			padding: 0 16px;
			border-radius: var(--radius-pill);
			border: 1px solid var(--border-soft);
			background: color-mix(in srgb, var(--surface-2) 86%, transparent);
			color: var(--vscode-foreground);
			font-weight: 700;
			cursor: pointer;
		}
		.action-btn.primary {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border-color: color-mix(in srgb, var(--vscode-button-background) 70%, black 30%);
		}
		.action-help {
			font-size: 12px;
			color: var(--text-muted);
			line-height: 1.5;
		}
		.pill {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			border-radius: var(--radius-pill);
			border: 1px solid var(--border-soft);
			background: color-mix(in srgb, var(--surface-2) 84%, transparent);
			color: var(--text-muted);
			font-size: 12px;
			font-weight: 600;
		}
		.pill-dot {
			width: 10px;
			height: 10px;
			border-radius: 50%;
			background: var(--success);
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 18%, transparent);
		}
		.loading-state {
			padding: 18px;
			border-radius: var(--radius-md);
			border: 1px dashed var(--border-soft);
			background: color-mix(in srgb, var(--surface-1) 72%, transparent);
			color: var(--text-muted);
		}
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 16px;
		}
		.stat-card {
			display: grid;
			gap: 10px;
			min-height: 156px;
			padding: 18px;
			border: 1px solid var(--border-soft);
			border-radius: var(--radius-md);
			background: linear-gradient(180deg, var(--surface-2), color-mix(in srgb, var(--surface-2) 82%, transparent));
		}
		.stat-kicker {
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: .08em;
			color: var(--text-muted);
		}
		.stat-number {
			font-size: clamp(1.8rem, 4vw, 2.35rem);
			font-weight: 800;
			line-height: 1;
			color: var(--vscode-textLink-foreground);
		}
		.stat-label {
			font-size: 14px;
			font-weight: 700;
		}
		.stat-help {
			font-size: 12px;
			line-height: 1.5;
			color: var(--text-muted);
		}
		@media (max-width: 640px) {
			.shell { padding: 16px; }
			.hero, .stat-card { padding: 16px; }
		}
	</style>
</head>
<body>
	<main class="shell" aria-label="${copy.title}">
		<section class="hero" aria-labelledby="stats-title">
			<div class="eyebrow">${copy.eyebrow}</div>
			<h1 id="stats-title" class="hero-title">${copy.title}</h1>
			<p class="hero-copy">${copy.description}</p>
			<div class="hero-actions" aria-label="${copy.actions}">
				<button class="action-btn primary" type="button" onclick="openChat()">${copy.chatAction}</button>
				<button class="action-btn" type="button" onclick="openSettings()">${copy.settingsAction}</button>
			</div>
			<div class="hero-meta">
				<span class="pill"><span class="pill-dot" aria-hidden="true"></span>${copy.health}</span>
				<span class="pill">${copy.healthHint}</span>
			</div>
			<p class="hero-copy">${copy.summaryBody}</p>
		</section>
		<div id="stats-loading" class="loading-state" role="status" aria-live="polite">${copy.loading}</div>
		<section class="stats-grid" id="stats-grid" style="display:none;" aria-label="${copy.summary}"></section>
	</main>
	<script>
		const vscode = acquireVsCodeApi();
		const copy = ${JSON.stringify(copy)};
		function openChat() { vscode.postMessage({ type: "openChat" }); }
		function openSettings() { vscode.postMessage({ type: "openSettings" }); }
		vscode.postMessage({ type: "getStatistics" });
		window.addEventListener("message", (event) => {
			const msg = event.data;
			if (msg.type !== "statistics") return;
			document.getElementById("stats-loading").style.display = "none";
			const grid = document.getElementById("stats-grid");
			grid.style.display = "";
			grid.innerHTML = "";
			const stats = msg.stats;
			const statList = [
				{ label: copy.totalImprovements, value: stats.totalImprovements, help: copy.totalImprovementsHelp },
				{ label: copy.linesImproved, value: stats.totalLinesImproved, help: copy.linesImprovedHelp },
				{ label: copy.avgProcessingTime, value: stats.averageProcessingTime + "ms", help: copy.avgProcessingTimeHelp },
				{ label: copy.totalTokens, value: stats.totalTokensUsed, help: copy.totalTokensHelp }
			];
			statList.forEach(({ label, value, help }) => {
				const card = document.createElement("article");
				card.className = "stat-card";
				card.innerHTML = \`
					<div class="stat-kicker">AccessiMind</div>
					<div class="stat-number">\${value}</div>
					<div class="stat-label">\${label}</div>
					<div class="stat-help">\${help}</div>
				\`;
				grid.appendChild(card);
			});
		});
	</script>
</body>
</html>`;
	}
}
