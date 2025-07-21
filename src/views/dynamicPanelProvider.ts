import * as vscode from "vscode";
import { StatisticsManager } from "../utils/statisticsManager";
import { AIProviderManager } from "../utils/aiProvider";
import { logger } from "../utils/logger";

export class DynamicPanelProvider {
	private static instance: DynamicPanelProvider;
	private _panel?: vscode.WebviewPanel;
	private _statisticsManager: StatisticsManager;
	private _aiProviderManager: AIProviderManager;
	private _context?: vscode.ExtensionContext;

	private constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this._statisticsManager = StatisticsManager.getInstance(context);
		this._aiProviderManager = AIProviderManager.getInstance();
		
		// Set up real-time statistics listeners
		this.setupRealTimeListeners();
	}

	public static getInstance(context?: vscode.ExtensionContext): DynamicPanelProvider {
		if (!DynamicPanelProvider.instance && context) {
			DynamicPanelProvider.instance = new DynamicPanelProvider(context);
		}
		return DynamicPanelProvider.instance;
	}

	public async showPanel(): Promise<void> {
		if (this._panel) {
			this._panel.reveal();
			return;
		}

		this._panel = vscode.window.createWebviewPanel(
			"wcagEnhancerDynamicPanel",
			"♿ AccessiMind - Dynamic Panel",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this._context!.extensionUri]
			}
		);

		this._panel.webview.html = this._getWebviewContent();

		this._panel.webview.onDidReceiveMessage(async (message) => {
			await this._handleMessage(message);
		});

		this._panel.onDidDispose(() => {
			this._panel = undefined;
		});

		// Initial data load
		await this._loadInitialData();
	}

	private setupRealTimeListeners(): void {
		// Listen for statistics changes
		this._statisticsManager.on("statisticsChanged", (stats) => {
			this.pushStatisticsUpdate(stats);
		});

		// Listen for improvements
		this._statisticsManager.on("improvement", (record) => {
			this.pushImprovementNotification(record);
		});

		// Listen for errors
		this._statisticsManager.on("error", (errorRecord) => {
			this.pushErrorNotification(errorRecord);
		});

		// Listen for statistics reset
		this._statisticsManager.on("statisticsReset", () => {
			this.pushStatisticsResetNotification();
		});

		logger.info("DynamicPanelProvider real-time listeners initialized");
	}

	private pushStatisticsUpdate(stats: any): void {
		if (this._panel && this._panel.visible) {
			this._panel.webview.postMessage({
				type: "statisticsUpdate",
				stats,
				timestamp: new Date().toISOString()
			});
		}
	}

	private pushImprovementNotification(record: any): void {
		if (this._panel && this._panel.visible) {
			this._panel.webview.postMessage({
				type: "realTimeNotification",
				message: `✅ ${record.type === 'file' ? 'File' : 'Selection'} improved! ${record.linesImproved} lines enhanced using ${record.provider}.`,
				messageType: "success",
				duration: 4000,
				record,
				timestamp: new Date().toISOString()
			});
		}
	}

	private pushErrorNotification(errorRecord: any): void {
		if (this._panel && this._panel.visible) {
			this._panel.webview.postMessage({
				type: "realTimeNotification",
				message: `❌ Error occurred: ${errorRecord.message}`,
				messageType: "error",
				duration: 5000,
				errorRecord,
				timestamp: new Date().toISOString()
			});
		}
	}

	private pushStatisticsResetNotification(): void {
		if (this._panel && this._panel.visible) {
			this._panel.webview.postMessage({
				type: "realTimeNotification",
				message: "🔄 Statistics have been reset!",
				messageType: "info",
				duration: 3000,
				timestamp: new Date().toISOString()
			});
		}
	}

	private async _handleMessage(message: any): Promise<void> {
		logger.info(`DynamicPanelProvider: Handling message type: ${message.type}`, { message });
		
		switch (message.type) {
			case "getStatistics":
				await this._sendStatistics();
				break;
			case "resetStatistics":
				await this._resetStatistics();
				break;
			case "exportStatistics":
				await this._exportStatistics(message.format);
				break;
			case "loadWizardSettings":
				await this._loadWizardSettings();
				break;
			case "notification":
				if (message.messageType) {
					await this._showNotification(message.message, message.messageType);
				} else {
					await this._showNotification(message.message, "success");
				}
				break;
		}
	}

	private async _sendStatistics(): Promise<void> {
		const stats = this._statisticsManager.getDetailedStatistics();
		this._panel?.webview.postMessage({
			type: "statistics",
			stats,
			timestamp: new Date().toISOString()
		});
	}

	private async _resetStatistics(): Promise<void> {
		try {
			// Reset the actual statistics
			this._statisticsManager.resetStatistics();
			
			// Send updated statistics to refresh the UI immediately
			await this._sendStatistics();
			
			// Show modern success notification
			this._panel?.webview.postMessage({
				type: "notification",
				message: "✅ Statistics have been successfully reset! All data has been cleared.",
				messageType: "success",
				duration: 4000,
				timestamp: new Date().toISOString()
			});

			// Log the action for accessibility
			logger.info("Statistics reset successfully via Dynamic Panel");

		} catch (error) {
			logger.error("Failed to reset statistics:", error);
			
			this._panel?.webview.postMessage({
				type: "notification",
				message: "❌ Failed to reset statistics. Please try again or check the console for details.",
				messageType: "error",
				duration: 5000,
				timestamp: new Date().toISOString()
			});
		}
	}

	private async _exportStatistics(format: string = "json"): Promise<void> {
		try {
			// Show loading notification
			this._panel?.webview.postMessage({
				type: "notification",
				message: "⏳ Preparing statistics export...",
				messageType: "info",
				duration: 2000,
				timestamp: new Date().toISOString()
			});

			const stats = this._statisticsManager.getDetailedStatistics();
			const content = format === "json" ? 
				JSON.stringify(stats, null, 2) : 
				this._formatStatsAsText(stats);

			const currentDate = new Date().toISOString().split("T")[0];
			const defaultFileName = `wcag-enhancer-stats-${currentDate}.${format}`;

			const uri = await vscode.window.showSaveDialog({
				filters: {
					[format.toUpperCase()]: [format]
				},
				defaultUri: vscode.Uri.file(defaultFileName),
				saveLabel: `Export ${format.toUpperCase()} Statistics`
			});

			if (uri) {
				await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
				
				// Calculate file size for user info
				const fileSizeKB = Math.round(Buffer.from(content, "utf8").length / 1024 * 100) / 100;
				
				this._panel?.webview.postMessage({
					type: "notification",
					message: `📄 Statistics exported successfully! File saved: ${uri.fsPath.split(/[\\/]/).pop()} (${fileSizeKB}KB)`,
					messageType: "success",
					duration: 5000,
					timestamp: new Date().toISOString()
				});

				logger.info(`Statistics exported successfully: ${uri.fsPath}, Format: ${format}, Size: ${fileSizeKB}KB`);
			} else {
				// User cancelled the dialog
				this._panel?.webview.postMessage({
					type: "notification",
					message: "📋 Export cancelled by user",
					messageType: "info",
					duration: 2000,
					timestamp: new Date().toISOString()
				});
			}
		} catch (error) {
			logger.error("Export statistics failed:", error);
			
			this._panel?.webview.postMessage({
				type: "notification",
				message: `❌ Export failed: ${error instanceof Error ? error.message : "Unknown error"}. Please ensure you have write permissions to the target location.`,
				messageType: "error",
				duration: 6000,
				timestamp: new Date().toISOString()
			});
		}
	}







	private async _switchProvider(provider: string): Promise<void> {
		try {
			// Switch AI provider
			await this._aiProviderManager.switchProvider(provider);
			
			// Provider değişikliğinden sonra yeniden yükle
			await this._aiProviderManager.loadCurrentProvider();
			
			const currentProviderInstance = await this._aiProviderManager.getCurrentProviderInstance();
			const isAvailable = await currentProviderInstance.isAvailable();
			
			this._panel?.webview.postMessage({
				type: "providerChanged",
				provider,
				providerName: currentProviderInstance.getDisplayName(),
				isAvailable: isAvailable,
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			console.error("Provider switch error:", error);
			this._panel?.webview.postMessage({
				type: "error",
				message: `Provider switch failed: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: new Date().toISOString()
			});
		}
	}

	private async _loadInitialData(): Promise<void> {
		try {
			logger.info("DynamicPanelProvider: Loading initial data...");
			
			// Önce provider'ı yeniden yükle
			await this._aiProviderManager.loadCurrentProvider();
			
			await this._sendStatistics();
			
			// Send current provider info
			const currentProvider = this._aiProviderManager.getCurrentProviderName();
			const currentProviderInstance = await this._aiProviderManager.getCurrentProviderInstance();
			const isAvailable = await currentProviderInstance.isAvailable();
			
			logger.info(`DynamicPanelProvider: Initial data - Provider: ${currentProvider}, Available: ${isAvailable}, Display Name: ${currentProviderInstance.getDisplayName()}`);
			
			// Provider-specific availability checks
			if (currentProvider === "gemini") {
				const geminiApi = (currentProviderInstance as any).geminiApi;
				if (geminiApi) {
					const isConfigured = await geminiApi.isApiKeyConfigured();
					logger.info(`DynamicPanelProvider: Gemini API key configured: ${isConfigured}`);
					
					if (!isConfigured) {
						logger.warn("DynamicPanelProvider: Gemini API key not configured");
					}
				}
			} else if (currentProvider === "vscode-copilot") {
				const copilotProvider = currentProviderInstance as any;
				if (copilotProvider.getAvailableModels) {
					const models = await copilotProvider.getAvailableModels();
					logger.info(`DynamicPanelProvider: VS Code Copilot models available: ${models.length}`, models);
				}
			}
			
			this._panel?.webview.postMessage({
				type: "initialData",
				provider: currentProvider,
				providerName: currentProviderInstance.getDisplayName(),
				isAvailable: isAvailable,
				timestamp: new Date().toISOString()
			});
			
			logger.info("DynamicPanelProvider: Initial data loaded successfully");
		} catch (error) {
			logger.error("DynamicPanelProvider: Failed to load initial data:", error);
			this._panel?.webview.postMessage({
				type: "error",
				message: `Failed to load initial data: ${error}`,
				timestamp: new Date().toISOString()
			});
		}
	}

	private async _loadWizardSettings(): Promise<void> {
		try {
			logger.info("DynamicPanelProvider: Loading wizard settings...");
			
			// Sihirbaz ayarlarını config'den yükle
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = config.get("ai") as any || {};
			const aiModelConfig = config.get("aiModels") as any || {};
			
			const wizardSettings = {
				provider: aiConfig.provider || "gemini",
				model: aiModelConfig.selectedModel,
				apiKey: aiConfig.apiKey,
				wcagLevel: config.get("wcagLevel", "AA"),
				language: config.get("language", "en"),
				includeComments: config.get("includeComments", true),
				wizardCompleted: config.get("wizardCompleted", false)
			};
			
			logger.info("DynamicPanelProvider: Wizard settings loaded:", wizardSettings);
			
			// Provider availability check
			const currentProviderInstance = await this._aiProviderManager.getCurrentProviderInstance();
			const isAvailable = await currentProviderInstance.isAvailable();
			
			const providerStatus = {
				isAvailable,
				displayName: currentProviderInstance.getDisplayName()
			};
			
			// Sihirbaz ayarlarını webview'a gönder
			this._panel?.webview.postMessage({
				type: "wizardSettings",
				settings: {
					...wizardSettings,
					providerStatus
				},
				timestamp: new Date().toISOString()
			});
			
			logger.info("DynamicPanelProvider: Wizard settings sent to webview");
		} catch (error) {
			logger.error("DynamicPanelProvider: Failed to load wizard settings:", error);
			this._panel?.webview.postMessage({
				type: "error",
				message: `Failed to load wizard settings: ${error}`,
				timestamp: new Date().toISOString()
			});
		}
	}





	private _formatStatsAsText(stats: any): string {
		return `AccessiMind Statistics Report
Generated: ${new Date().toISOString()}

Summary:
- Total Improvements: ${stats.totalImprovements}
- Total Lines Improved: ${stats.totalLinesImproved}
- Total Tokens Used: ${stats.totalTokensUsed}
- Success Rate: ${stats.successRate}%

Performance:
- Average Improvement Time: ${stats.performance?.avgImprovementTime || 0}ms
- Average Tokens per Improvement: ${stats.performance?.avgTokensPerImprovement || 0}

Language Statistics:
${Object.entries(stats.languageStats || {}).map(([lang, count]) => `- ${lang}: ${count}`).join("\n")}

WCAG Criteria Statistics:
${Object.entries(stats.wcagCriteriaStats || {}).map(([criteria, count]) => `- ${criteria}: ${count}`).join("\n")}
`;
	}



	private async _showNotification(message: string, type: string = "success"): Promise<void> {
		this._panel?.webview.postMessage({
			type: "notification",
			message,
			messageType: type,
			duration: type === "error" ? 6000 : type === "info" ? 3000 : 4000,
			timestamp: new Date().toISOString()
		});
	}

	private _getWebviewContent(): string {
		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind Dynamic Panel</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            height: 100vh;
            overflow: hidden;
        }

        .container {
            display: flex;
            height: 100%;
            gap: 20px;
        }

        .left-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-panel-border);
            padding-right: 20px;
        }

        .right-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .panel-header {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--vscode-focusBorder);
        }

        .stats-container {
            flex: 1;
            overflow-y: auto;
        }

        .stats-card {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .stats-title {
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--vscode-focusBorder);
            font-size: 16px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin-bottom: 15px;
        }

        .stat-item {
            text-align: center;
            padding: 16px;
            background: var(--vscode-editor-background);
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
            transition: transform 0.2s ease;
        }

        .stat-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--vscode-focusBorder);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .action-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .action-button {
            padding: 8px 16px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .action-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
        }

        .primary-action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .primary-action-button:focus {
            outline: 3px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }

        .primary-action-button:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .primary-action-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            background: var(--vscode-button-secondaryBackground) !important;
        }

        .loading-button {
            position: relative;
            pointer-events: none;
        }

        .loading-button::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            margin: -10px 0 0 -10px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s linear infinite;
        }

        .loading-button .button-text {
            opacity: 0;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 20px;
            background: #4caf50;
            color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 500;
            font-size: 14px;
            line-height: 1.4;
            max-width: 400px;
            min-width: 280px;
            word-wrap: break-word;
            border-left: 4px solid #2e7d32;
            display: flex;
            align-items: flex-start;
            gap: 8px;
            transition: all 0.3s ease-in-out;
        }
        
        .notification.error {
            background: #f44336;
            border-left-color: #c62828;
            color: #ffffff;
        }
        
        .notification.info {
            background: #2196f3;
            border-left-color: #1565c0;
            color: #ffffff;
        }
        
        .notification.warning {
            background: #ff9800;
            border-left-color: #ef6c00;
            color: #ffffff;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: currentColor;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            margin-left: auto;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            opacity: 0.8;
            transition: opacity 0.2s ease, background-color 0.2s ease;
            flex-shrink: 0;
        }
        
        .notification-close:hover,
        .notification-close:focus {
            opacity: 1;
            background-color: rgba(255, 255, 255, 0.2);
            outline: 2px solid rgba(255, 255, 255, 0.5);
            outline-offset: 1px;
        }
        
        .notification-close:focus {
            outline-style: solid;
        }
        
        .notification:focus {
            outline: 2px solid #ffffff;
            outline-offset: 2px;
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--vscode-progressBar-background);
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* WCAG Accessibility Improvements */
        .action-button:focus,
        .provider-selector select:focus {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }

        /* High contrast support */
        @media (prefers-contrast: high) {
            .action-button {
                border: 2px solid var(--vscode-panel-border);
            }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
            .notification,
            .stat-item,
            .action-button {
                animation: none;
                transition: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="left-panel">
            <div class="panel-header">📊 Statistics Management</div>
            
            <div class="provider-info" style="padding: 12px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; margin-bottom: 20px;">
                <p style="color: var(--vscode-descriptionForeground); font-size: 14px; margin: 0;">
                    📈 Monitor and manage your WCAG enhancement statistics
                </p>
                <div id="providerStatus" style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 8px;">
                    <span id="statusIndicator" style="width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: #4caf50;"></span>
                    <span id="statusText">Statistics panel active</span>
                </div>
            </div>

            <div class="stats-info" style="padding: 20px; background: var(--vscode-input-background); border: 2px solid var(--vscode-focusBorder); border-radius: 12px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 15px; color: var(--vscode-foreground); font-size: 18px; text-align: center;">
                    📊 Statistics Overview
                </h3>
                <p style="margin-bottom: 15px; color: var(--vscode-descriptionForeground); font-size: 14px; text-align: center;">
                    View real-time statistics about your WCAG improvements. Statistics are automatically updated when you use WCAG enhancement commands from the command palette.
                </p>
                <div style="padding: 12px; background: var(--vscode-editor-background); border-radius: 8px; border-left: 4px solid var(--vscode-focusBorder);">
                    <p style="margin: 0; color: var(--vscode-descriptionForeground); font-size: 13px;">
                        💡 <strong>Tip:</strong> Use Ctrl+Shift+P to open the command palette and run AccessiMind commands to generate statistics.
                    </p>
                </div>
            </div>
        </div>

        <div class="right-panel">
            <div class="panel-header">📊 Real-time Statistics</div>
            
            <div class="stats-container" id="statsContainer">
                <div class="stats-card">
                    <div class="stats-title">📈 Overview</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value" id="totalImprovements">0</div>
                            <div class="stat-label">Improvements</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="totalLines">0</div>
                            <div class="stat-label">Lines Improved</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="totalTokens">0</div>
                            <div class="stat-label">Tokens Used</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="successRate">100%</div>
                            <div class="stat-label">Success Rate</div>
                        </div>
                    </div>
                </div>

                <div class="stats-card">
                    <div class="stats-title">⚡ Performance</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value" id="avgTime">0ms</div>
                            <div class="stat-label">Avg Time</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="avgTokens">0</div>
                            <div class="stat-label">Avg Tokens</div>
                        </div>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="action-button" onclick="refreshStats()" aria-label="Refresh statistics">🔄 Refresh</button>
                    <button class="action-button" onclick="exportStats('json')" aria-label="Export statistics as JSON">📤 Export JSON</button>
                    <button class="action-button" onclick="exportStats('txt')" aria-label="Export statistics as text">📤 Export TXT</button>
                    <button class="action-button" onclick="resetStats()" aria-label="Reset all statistics">🗑️ Reset</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let isProcessing = false;

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            requestStats();
            setupEventListeners();
            loadWizardSettings();
        });

        function setupEventListeners() {
            // Add keyboard event listeners for better accessibility
            document.addEventListener('keydown', handleKeyboardShortcuts);
            
            // Add button state management
            const primaryButtons = document.querySelectorAll('.primary-action-button');
            primaryButtons.forEach(button => {
                button.addEventListener('click', () => {
                    setButtonLoading(button, true);
                });
            });
        }

        function handleKeyboardShortcuts(event) {
            // Alt + R for Refresh Statistics
            if (event.altKey && event.key === 'r') {
                event.preventDefault();
                refreshStats();
                announceToScreenReader('Statistics refreshed via keyboard shortcut');
            }
        }

        function setButtonLoading(button, isLoading) {
            if (isLoading) {
                button.classList.add('loading-button');
                button.disabled = true;
                
                // Wrap existing text for opacity control
                if (!button.querySelector('.button-text')) {
                    button.innerHTML = '<span class="button-text">' + button.innerHTML + '</span>';
                }
            } else {
                button.classList.remove('loading-button');
                button.disabled = false;
            }
        }

        function announceToScreenReader(message) {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'assertive');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.style.position = 'absolute';
            announcement.style.left = '-10000px';
            announcement.style.width = '1px';
            announcement.style.height = '1px';
            announcement.style.overflow = 'hidden';
            announcement.textContent = message;
            
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        }

        function requestStats() {
            vscode.postMessage({ type: 'getStatistics' });
        }

        function refreshStats() {
            requestStats();
            showNotification('Statistics refreshed', 'success');
        }

        function exportStats(format) {
            vscode.postMessage({ type: 'exportStatistics', format });
        }

        function resetStats() {
            // Show modern confirmation dialog with better accessibility
            const isConfirmed = confirm(
                '⚠️ Reset All Statistics\\n\\n' +
                'This action will permanently delete all your WCAG enhancement statistics including:\\n' +
                '• Total improvements count\\n' +
                '• Language-specific statistics\\n' +
                '• Provider performance data\\n' +
                '• Historical usage patterns\\n\\n' +
                'This action cannot be undone. Are you sure you want to continue?'
            );
            
            if (isConfirmed) {
                // Show loading state with accessibility announcement
                showNotification('🔄 Resetting statistics...', 'info');
                vscode.postMessage({ type: 'resetStatistics' });
            } else {
                // Provide feedback when user cancels
                showNotification('📋 Reset operation cancelled', 'info');
            }
        }



        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.textContent = message;
            notification.setAttribute('role', 'alert');
            notification.setAttribute('aria-live', 'polite');
            notification.setAttribute('aria-atomic', 'true');
            
            // Add WCAG compliant focus management for important notifications
            if (type === 'error') {
                notification.setAttribute('aria-live', 'assertive');
                notification.tabIndex = 0;
            }
            
            // Add close button for better UX
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '×';
            closeButton.className = 'notification-close';
            closeButton.setAttribute('aria-label', 'Close notification');
            closeButton.setAttribute('title', 'Close notification');
            closeButton.onclick = () => notification.remove();
            
            notification.appendChild(closeButton);
            document.body.appendChild(notification);
            
            // Enhanced auto-remove with configurable duration
            const duration = type === 'error' ? 6000 : type === 'info' ? 3000 : 4000;
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);
            
            // Add smooth fade-in animation
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            requestAnimationFrame(() => {
                notification.style.transition = 'all 0.3s ease-in-out';
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            });
        }

        function updateStats(stats) {
            document.getElementById('totalImprovements').textContent = stats.totalImprovements || 0;
            document.getElementById('totalLines').textContent = stats.totalLinesImproved || 0;
            document.getElementById('totalTokens').textContent = stats.totalTokensUsed || 0;
            document.getElementById('successRate').textContent = \`\${stats.successRate || 100}%\`;
            document.getElementById('avgTime').textContent = \`\${stats.performance?.avgImprovementTime || 0}ms\`;
            document.getElementById('avgTokens').textContent = stats.performance?.avgTokensPerImprovement || 0;
        }

        function loadWizardSettings() {
            // Request wizard settings from extension
            vscode.postMessage({ type: 'loadWizardSettings' });
        }

        function resetAllButtonStates() {
            const loadingButtons = document.querySelectorAll('.loading-button');
            loadingButtons.forEach(button => {
                setButtonLoading(button, false);
            });
        }

        function updateProviderStatus(provider, isAvailable, displayName) {
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            
            if (isAvailable) {
                statusIndicator.style.background = '#28a745';
                statusIndicator.style.boxShadow = '0 0 4px #28a745';
                statusText.textContent = \`\${displayName} - Online\`;
            } else {
                statusIndicator.style.background = '#dc3545';
                statusIndicator.style.boxShadow = 'none';
                statusText.textContent = \`\${displayName} - Offline\`;
            }
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('Webview received message:', message.type, message);
            
            switch (message.type) {
                case 'statistics':
                    updateStats(message.stats);
                    break;
                    
                case 'notification':
                    // Reset button states on any notification
                    resetAllButtonStates();
                    
                    if (message.messageType) {
                        showNotification(message.message, message.messageType);
                        announceToScreenReader(message.message);
                    } else {
                        showNotification(message.message, 'success');
                        announceToScreenReader(message.message);
                    }
                    break;
                    
                case 'error':
                    showNotification(message.message, 'error');
                    break;
                    

                    
                case 'initialData':
                    if (message.providerName && message.isAvailable !== undefined) {
                        updateProviderStatus(message.provider, message.isAvailable, message.providerName);
                    }
                    if (message.isAvailable === false) {
                        showNotification('⚠️ Selected AI provider is not available. Please check your configuration.', 'warning');
                        announceToScreenReader('Warning: AI provider is not available. Please check your configuration.');
                    } else {
                        announceToScreenReader(\`AI provider \${message.providerName} is ready and available.\`);
                    }
                    break;
                    
                case 'wizardSettings':
                    if (message.settings) {
                        const settings = message.settings;
                        
                        // Update status
                        if (settings.providerStatus) {
                            updateProviderStatus(
                                settings.provider, 
                                settings.providerStatus.isAvailable, 
                                settings.providerStatus.displayName
                            );
                        }
                        
                        // Show wizard configuration with accessibility
                        console.log('Wizard settings loaded:', settings);
                        const providerMessage = \`🤖 Using \${settings.providerStatus?.displayName || settings.provider} - \${settings.model || 'default model'}\`;
                        showNotification(providerMessage, 'success');
                        announceToScreenReader(\`AI provider configured: \${settings.providerStatus?.displayName || settings.provider}\`);
                    }
                    break;
                    
                // Real-time update handlers
                case 'statisticsUpdate':
                    console.log('📊 Real-time statistics update received');
                    updateStats(message.stats);
                    announceToScreenReader('Statistics updated in real-time');
                    break;
                    
                case 'realTimeNotification':
                    console.log('🔔 Real-time notification received:', message.message);
                    showNotification(message.message, message.messageType || 'info');
                    announceToScreenReader(message.message);
                    
                    // Reset button states for real-time notifications
                    resetAllButtonStates();
                    break;
            }
        });
    </script>
</body>
</html>
`;
	}


} 