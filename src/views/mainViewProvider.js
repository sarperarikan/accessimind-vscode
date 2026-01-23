"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
	if (k2 === undefined) k2 = k;
	var desc = Object.getOwnPropertyDescriptor(m, k);
	if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
		desc = { enumerable: true, get: function () { return m[k]; } };
	}
	Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
	if (k2 === undefined) k2 = k;
	o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
	Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
	o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
	if (mod && mod.__esModule) return mod;
	var result = {};
	if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
	__setModuleDefault(result, mod);
	return result;
};
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
exports.MainViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const geminiApi_1 = require("../utils/geminiApi");
const statisticsManager_1 = require("../utils/statisticsManager");
const localizationManager_1 = require("../utils/localizationManager");
class MainViewProvider {
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
		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage((data) => __awaiter(this, void 0, void 0, function* () {
			switch (data.type) {
				case "chat":
					yield this._handleChatMessage(data.message);
					break;
				case "improveFile":
					yield this._handleImproveFile();
					break;
				case "improveSelection":
					yield this._handleImproveSelection();
					break;
				case "getStats":
					yield this._handleGetStats();
					break;
				case "resetStats":
					yield this._handleResetStats();
					break;
				case "setApiKey":
					yield this._handleSetApiKey();
					break;
				case "testApiKey":
					yield this._handleTestApiKey();
					break;
			}
		}));
	}
	_handleChatMessage(message) {
		return __awaiter(this, void 0, void 0, function* () {
			if (!this._view)
				return;
			const startTime = Date.now();
			let apiResponseTime = 0;
			try {
				// Show typing indicator
				this._view.webview.postMessage({
					type: "setTyping",
					isTyping: true
				});
				const geminiApi = geminiApi_1.GeminiAPI.getInstance();
				const isConnected = yield geminiApi.testConnection();
				if (!isConnected) {
					this._view.webview.postMessage({
						type: "addChatMessage",
						message: localizationManager_1.localization.getString("error.api.key.missing"),
						isUser: false,
						isError: true
					});
					return;
				}
				const response = yield geminiApi.improveCode({
					code: "",
					fileType: "chat",
					language: "text",
					mode: "ask"
				});
				apiResponseTime = Date.now() - startTime;
				// Record statistics with WCAG criteria
				statisticsManager_1.statisticsManager.getInstance().recordApiResponse("chat", true, "chat", apiResponseTime, ["2.4.1", "2.4.2", "2.4.3"], // Common WCAG criteria for chat
					{
						codeStructuresEnhanced: 1,
						htmlElementsImproved: { "div": 1 },
						accessibilityFeaturesAdded: { "chat_interface": 1 }
					});
				// Hide typing indicator and show response
				this._view.webview.postMessage({
					type: "setTyping",
					isTyping: false
				});
				this._view.webview.postMessage({
					type: "addChatMessage",
					message: response.content || "Yanıt alınamadı",
					isUser: false,
					isError: false
				});
			}
			catch (error) {
				console.error("Chat error:", error);
				apiResponseTime = Date.now() - startTime;
				statisticsManager_1.statisticsManager.getInstance().recordApiResponse("chat", false, "chat", apiResponseTime, [], {}, error instanceof Error ? error.message : "Unknown error");
				this._view.webview.postMessage({
					type: "setTyping",
					isTyping: false
				});
				this._view.webview.postMessage({
					type: "addChatMessage",
					message: `Hata oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
					isUser: false,
					isError: true
				});
			}
		});
	}
	_handleImproveFile() {
		return __awaiter(this, void 0, void 0, function* () {
			try {
				// Use the registered WCAG command instead of custom implementation
				yield vscode.commands.executeCommand('wcagEnhancer.improveFile');
			}
			catch (error) {
				console.error("Improve file error:", error);
				vscode.window.showErrorMessage(`Dosya iyileştirme hatası: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
			}
		});
	}
	analyzeCodeImprovements(originalCode, improvedCode, language) {
		const improvements = {
			wcagCriteria: [],
			totalElements: 0,
			htmlElements: {},
			cssProperties: {},
			ariaAttributes: {},
			semanticElements: {},
			accessibilityFeatures: {}
		};
		// Analyze HTML improvements
		if (language === "html" || language === "htm") {
			// Count ARIA attributes added
			const ariaMatches = improvedCode.match(/aria-[a-zA-Z-]+/g) || [];
			ariaMatches.forEach(attr => {
				improvements.ariaAttributes[attr] = (improvements.ariaAttributes[attr] || 0) + 1;
			});
			// Count semantic elements
			const semanticElements = ["nav", "main", "article", "section", "aside", "header", "footer", "figure", "figcaption"];
			semanticElements.forEach(element => {
				const matches = (improvedCode.match(new RegExp(`<${element}[^>]*>`, "gi")) || []).length;
				if (matches > 0) {
					improvements.semanticElements[element] = matches;
				}
			});
			// Count accessibility features
			const accessibilityFeatures = ["role", "tabindex", "alt", "title", "label"];
			accessibilityFeatures.forEach(feature => {
				const matches = (improvedCode.match(new RegExp(`${feature}=`, "gi")) || []).length;
				if (matches > 0) {
					improvements.accessibilityFeatures[feature] = matches;
				}
			});
		}
		// Analyze CSS improvements
		if (language === "css") {
			const cssProperties = ["color", "background-color", "font-size", "line-height", "margin", "padding"];
			cssProperties.forEach(property => {
				const matches = (improvedCode.match(new RegExp(`${property}:`, "gi")) || []).length;
				if (matches > 0) {
					improvements.cssProperties[property] = matches;
				}
			});
		}
		// Determine WCAG criteria based on improvements
		if (Object.keys(improvements.ariaAttributes).length > 0) {
			improvements.wcagCriteria.push("4.1.2"); // Name, Role, Value
		}
		if (Object.keys(improvements.semanticElements).length > 0) {
			improvements.wcagCriteria.push("1.3.1"); // Info and Relationships
		}
		if (improvements.accessibilityFeatures["alt"]) {
			improvements.wcagCriteria.push("1.1.1"); // Non-text Content
		}
		if (improvements.accessibilityFeatures["tabindex"]) {
			improvements.wcagCriteria.push("2.1.1"); // Keyboard
		}
		// Calculate total elements improved
		improvements.totalElements = Object.values(improvements.htmlElements).reduce((a, b) => a + b, 0) +
			Object.values(improvements.cssProperties).reduce((a, b) => a + b, 0) +
			Object.values(improvements.ariaAttributes).reduce((a, b) => a + b, 0) +
			Object.values(improvements.semanticElements).reduce((a, b) => a + b, 0) +
			Object.values(improvements.accessibilityFeatures).reduce((a, b) => a + b, 0);
		return improvements;
	}
	_handleImproveSelection() {
		return __awaiter(this, void 0, void 0, function* () {
			try {
				// Use the registered WCAG command instead of custom implementation
				yield vscode.commands.executeCommand('wcagEnhancer.improveSelection');
			}
			catch (error) {
				console.error("Improve selection error:", error);
				const errorMessage = error instanceof Error ? error.message : localizationManager_1.localization.getString("error.unknown");
				vscode.window.showErrorMessage(`Seçim iyileştirme hatası: ${errorMessage}`);
			}
		});
	}
	_handleGetStats() {
		return __awaiter(this, void 0, void 0, function* () {
			if (!this._view)
				return;
			try {
				const stats = statisticsManager_1.statisticsManager.getInstance().getStatistics();
				this._view.webview.postMessage({
					type: "updateStats",
					stats: stats
				});
			}
			catch (error) {
				console.error("Get stats error:", error);
			}
		});
	}
	_handleResetStats() {
		return __awaiter(this, void 0, void 0, function* () {
			try {
				statisticsManager_1.statisticsManager.getInstance().resetStatistics();
				vscode.window.showInformationMessage(localizationManager_1.localization.getString("success.stats.reset"));
				if (this._view) {
					this._handleGetStats();
				}
			}
			catch (error) {
				console.error("Reset stats error:", error);
				vscode.window.showErrorMessage("İstatistikler sıfırlanırken hata oluştu");
			}
		});
	}
	_handleSetApiKey() {
		return __awaiter(this, void 0, void 0, function* () {
			try {
				const apiKey = yield vscode.window.showInputBox({
					prompt: localizationManager_1.localization.getString("prompt.enter.api.key"),
					password: true,
					placeHolder: "Gemini API anahtarınızı girin..."
				});
				if (apiKey) {
					const config = vscode.workspace.getConfiguration("wcagEnhancer");
					yield config.update("apiKey", apiKey, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(localizationManager_1.localization.getString("success.api.key.saved"));
				}
			}
			catch (error) {
				console.error("Set API key error:", error);
				vscode.window.showErrorMessage("API anahtarı kaydedilirken hata oluştu");
			}
		});
	}
	_handleTestApiKey() {
		return __awaiter(this, void 0, void 0, function* () {
			try {
				const geminiApi = geminiApi_1.GeminiAPI.getInstance();
				const isConnected = yield geminiApi.testConnection();
				if (!isConnected) {
					vscode.window.showErrorMessage(localizationManager_1.localization.getString("error.api.key.missing"));
					return;
				}
				const testPrompt = "Merhaba! Bu bir testtir. Sadece \"Başarılı\" yaz.";
				const result = yield geminiApi.improveCode({
					code: testPrompt,
					fileType: "chat",
					language: "text",
					mode: "ask"
				});
				if (result.content && (result.content.toLowerCase().includes("başarılı") || result.content.length > 0)) {
					vscode.window.showInformationMessage(localizationManager_1.localization.getString("success.api.key.working"));
				}
				else {
					vscode.window.showWarningMessage("API anahtarı ile bağlantı kuruldu ancak beklenen yanıt alınamadı.");
				}
			}
			catch (error) {
				console.error("Test API key error:", error);
				const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
				vscode.window.showErrorMessage(`API anahtarı testi başarısız: ${errorMessage}`);
			}
		});
	}
	_getHtmlForWebview(webview) {
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.js"));
		return `<!DOCTYPE html>
<html lang="tr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; frame-src 'none';">
	<title>AI Accessibility Enhancer</title>
	<link href="${styleResetUri}" rel="stylesheet">
	<link href="${styleVSCodeUri}" rel="stylesheet">
	<style>
		:root {
			--vscode-font-family: var(--vscode-font-family);
			--vscode-font-size: var(--vscode-font-size);
			--vscode-foreground: var(--vscode-foreground);
			--vscode-background: var(--vscode-background);
			--vscode-button-background: var(--vscode-button-background);
			--vscode-button-foreground: var(--vscode-button-foreground);
			--vscode-button-hoverBackground: var(--vscode-button-hoverBackground);
			--vscode-input-background: var(--vscode-input-background);
			--vscode-input-foreground: var(--vscode-input-foreground);
			--vscode-input-border: var(--vscode-input-border);
			--vscode-textLink-foreground: var(--vscode-textLink-foreground);
			--vscode-textLink-activeForeground: var(--vscode-textLink-activeForeground);
			--vscode-focusBorder: var(--vscode-focusBorder);
			--vscode-errorForeground: var(--vscode-errorForeground);
			--vscode-successForeground: var(--vscode-successForeground);
			--vscode-warningForeground: var(--vscode-warningForeground);
		}

		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background: var(--vscode-background);
			margin: 0;
			padding: 0;
			height: 100vh;
			overflow: hidden;
		}

		.container {
			display: flex;
			flex-direction: column;
			height: 100vh;
		}

		.header {
			background: var(--vscode-editor-background);
			border-bottom: 1px solid var(--vscode-panel-border);
			padding: 12px 16px;
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.logo {
			font-size: 18px;
			font-weight: bold;
			color: var(--vscode-textLink-foreground);
		}

		.tabs {
			display: flex;
			background: var(--vscode-editor-background);
			border-bottom: 1px solid var(--vscode-panel-border);
		}

		.tab {
			padding: 12px 20px;
			background: transparent;
			border: none;
			color: var(--vscode-foreground);
			cursor: pointer;
			font-size: 14px;
			transition: all 0.2s ease;
			position: relative;
		}

		.tab:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.tab.active {
			background: var(--vscode-tab-activeBackground);
			color: var(--vscode-tab-activeForeground);
		}

		.tab.active::after {
			content: '';
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			height: 2px;
			background: var(--vscode-focusBorder);
		}

		.content {
			flex: 1;
			overflow: hidden;
		}

		.tab-content {
			display: none;
			height: 100%;
			flex-direction: column;
		}

		.tab-content.active {
			display: flex;
		}

		/* Chat Tab Styles */
		.chat-container {
			display: flex;
			flex-direction: column;
			height: 100%;
		}

		.chat-messages {
			flex: 1;
			overflow-y: auto;
			padding: 16px;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.message {
			padding: 12px 16px;
			border-radius: 8px;
			max-width: 80%;
			word-wrap: break-word;
		}

		.message.user {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			align-self: flex-end;
		}

		.message.assistant {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			align-self: flex-start;
		}

		.message.error {
			background: var(--vscode-inputValidation-errorBackground);
			color: var(--vscode-errorForeground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
		}

		.typing-indicator {
			display: none;
			align-self: flex-start;
			padding: 12px 16px;
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			color: var(--vscode-descriptionForeground);
		}

		.typing-indicator.show {
			display: block;
		}

		.chat-input-container {
			padding: 16px;
			border-top: 1px solid var(--vscode-panel-border);
			background: var(--vscode-editor-background);
		}

		.chat-input-form {
			display: flex;
			gap: 8px;
		}

		.chat-input {
			flex: 1;
			padding: 8px 12px;
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: inherit;
			font-size: inherit;
		}

		.chat-input:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		.chat-send-btn {
			padding: 8px 16px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-family: inherit;
			font-size: inherit;
		}

		.chat-send-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.chat-send-btn:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		.quick-actions {
			display: flex;
			gap: 8px;
			margin-bottom: 12px;
			flex-wrap: wrap;
		}

		.quick-action-btn {
			padding: 6px 12px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-button-border);
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
			font-family: inherit;
		}

		.quick-action-btn:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		/* Stats Tab Styles */
		.stats-container {
			padding: 16px;
			overflow-y: auto;
		}

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 16px;
			margin-bottom: 24px;
		}

		.stat-card {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			padding: 16px;
			text-align: center;
		}

		.stat-value {
			font-size: 24px;
			font-weight: bold;
			color: var(--vscode-textLink-foreground);
			margin-bottom: 4px;
		}

		.stat-label {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		.stats-chart {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			padding: 16px;
			margin-bottom: 16px;
		}

		.chart-title {
			font-size: 16px;
			font-weight: bold;
			margin-bottom: 12px;
			color: var(--vscode-foreground);
		}

		.chart-bar {
			display: flex;
			align-items: center;
			margin-bottom: 8px;
			gap: 8px;
		}

		.chart-label {
			min-width: 100px;
			font-size: 12px;
			color: var(--vscode-foreground);
		}

		.chart-progress {
			flex: 1;
			height: 8px;
			background: var(--vscode-progressBar-background);
			border-radius: 4px;
			overflow: hidden;
		}

		.chart-fill {
			height: 100%;
			background: var(--vscode-progressBar-foreground);
			transition: width 0.3s ease;
		}

		.chart-value {
			min-width: 40px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			text-align: right;
		}

		.stats-actions {
			display: flex;
			gap: 8px;
			justify-content: center;
		}

		.stats-btn {
			padding: 8px 16px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-family: inherit;
			font-size: inherit;
		}

		.stats-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.stats-btn.secondary {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-button-border);
		}

		.stats-btn.secondary:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		/* Settings Tab Styles */
		.settings-container {
			padding: 16px;
			overflow-y: auto;
		}

		.settings-section {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			padding: 16px;
			margin-bottom: 16px;
		}

		.settings-title {
			font-size: 16px;
			font-weight: bold;
			margin-bottom: 12px;
			color: var(--vscode-foreground);
		}

		.settings-group {
			margin-bottom: 16px;
		}

		.settings-label {
			display: block;
			margin-bottom: 4px;
			font-size: 12px;
			color: var(--vscode-foreground);
			font-weight: 500;
		}

		.settings-input {
			width: 100%;
			padding: 8px 12px;
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: inherit;
			font-size: inherit;
			box-sizing: border-box;
		}

		.settings-input:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		.settings-select {
			width: 100%;
			padding: 8px 12px;
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: inherit;
			font-size: inherit;
			box-sizing: border-box;
		}

		.settings-actions {
			display: flex;
			gap: 8px;
			margin-top: 12px;
		}

		.settings-btn {
			padding: 8px 16px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-family: inherit;
			font-size: inherit;
		}

		.settings-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.settings-btn.secondary {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-button-border);
		}

		.settings-btn.secondary:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		/* Accessibility */
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

		/* Focus styles */
		button:focus,
		input:focus,
		select:focus {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}

		/* High contrast support */
		@media (prefers-contrast: high) {
			.message,
			.stat-card,
			.settings-section {
				border-width: 2px;
			}
		}

		/* Reduced motion support */
		@media (prefers-reduced-motion: reduce) {
			* {
				animation-duration: 0.01ms !important;
				animation-iteration-count: 1 !important;
				transition-duration: 0.01ms !important;
			}
		}
	</style>
</head>
<body>
	<div class="container" role="main">
		<header class="header" role="banner">
			<div class="logo" role="heading" aria-level="1">🚀 AccessiMind</div>
		</header>

		<nav class="tabs" role="tablist" aria-label="Ana navigasyon">
			<button class="tab active" role="tab" aria-selected="true" aria-controls="chat-panel" id="chat-tab">
				💬 Chat
			</button>
			<button class="tab" role="tab" aria-selected="false" aria-controls="stats-panel" id="stats-tab">
				📊 İstatistikler
			</button>
			<button class="tab" role="tab" aria-selected="false" aria-controls="settings-panel" id="settings-tab">
				⚙️ Ayarlar
			</button>
		</nav>

		<main class="content" role="main">
			<!-- Chat Tab -->
			<div id="chat-panel" class="tab-content active" role="tabpanel" aria-labelledby="chat-tab">
				<div class="chat-container">
					<div class="quick-actions">
						<button class="quick-action-btn" onclick="improveFile()" aria-label="Mevcut dosyayı iyileştir">
							📄 Mevcut Dosya
						</button>
						<button class="quick-action-btn" onclick="improveSelection()" aria-label="Seçili alanı iyileştir">
							📋 Seçili Alan
						</button>
					</div>

					<div class="chat-messages" id="chat-messages" role="log" aria-live="polite">
						<div class="message assistant">
							Merhaba! AccessiMind'a hoş geldiniz. Size WCAG 2.2 erişilebilirlik konusunda yardımcı olabilirim. 
							Kod iyileştirme için yukarıdaki butonları kullanabilir veya sorularınızı yazabilirsiniz.
						</div>
					</div>

					<div class="typing-indicator" id="typing-indicator" aria-live="polite">
						AI yazıyor...
					</div>

					<div class="chat-input-container">
						<form class="chat-input-form" onsubmit="sendMessage(event)">
							<input 
								type="text" 
								class="chat-input" 
								id="chat-input" 
								placeholder="WCAG erişilebilirlik hakkında soru sorun..."
								aria-label="Mesajınızı yazın"
							>
							<button type="submit" class="chat-send-btn" id="send-btn" aria-label="Mesaj gönder">
								Gönder
							</button>
						</form>
					</div>
				</div>
			</div>

			<!-- Stats Tab -->
			<div id="stats-panel" class="tab-content" role="tabpanel" aria-labelledby="stats-tab">
				<div class="stats-container">
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-value" id="total-improvements">0</div>
							<div class="stat-label">Toplam İyileştirme</div>
						</div>
						<div class="stat-card">
							<div class="stat-value" id="success-rate">0%</div>
							<div class="stat-label">Başarı Oranı</div>
						</div>
						<div class="stat-card">
							<div class="stat-value" id="total-lines">0</div>
							<div class="stat-label">İyileştirilen Satır</div>
						</div>
						<div class="stat-card">
							<div class="stat-value" id="chat-messages-count">0</div>
							<div class="stat-label">Chat Mesajı</div>
						</div>
					</div>

					<div class="stats-chart">
						<div class="chart-title">Dil Dağılımı</div>
						<div id="language-chart"></div>
					</div>

					<div class="stats-chart">
						<div class="chart-title">İyileştirme Türleri</div>
						<div id="type-chart"></div>
					</div>

					<div class="stats-actions">
						<button class="stats-btn" onclick="refreshStats()" aria-label="İstatistikleri yenile">
							🔄 Yenile
						</button>
						<button class="stats-btn secondary" onclick="resetStats()" aria-label="İstatistikleri sıfırla">
							🗑️ Sıfırla
						</button>
					</div>
				</div>
			</div>

			<!-- Settings Tab -->
			<div id="settings-panel" class="tab-content" role="tabpanel" aria-labelledby="settings-tab">
				<div class="settings-container">
					<div class="settings-section">
						<div class="settings-title">API Ayarları</div>
						
						<div class="settings-group">
							<label class="settings-label" for="api-key">Gemini API Anahtarı</label>
							<input 
								type="password" 
								class="settings-input" 
								id="api-key" 
								placeholder="API anahtarınızı girin..."
								aria-describedby="api-key-help"
							>
							<div id="api-key-help" class="sr-only">Gemini API anahtarınızı girin. Google AI Studio'dan alabilirsiniz.</div>
						</div>

						<div class="settings-group">
							<label class="settings-label" for="model-select">Model</label>
							<select class="settings-select" id="model-select" aria-describedby="model-help">
								<option value="gemini-2.5-flash">Gemini 2.5 Flash (Önerilen)</option>
								<option value="gemini-pro">Gemini Pro</option>
								<option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
							</select>
							<div id="model-help" class="sr-only">Kullanmak istediğiniz Gemini modelini seçin.</div>
						</div>

						<div class="settings-actions">
							<button class="settings-btn" onclick="setApiKey()" aria-label="API anahtarını kaydet">
								💾 Kaydet
							</button>
							<button class="settings-btn secondary" onclick="testApiKey()" aria-label="API anahtarını test et">
								🧪 Test Et
							</button>
						</div>
					</div>

					<div class="settings-section">
						<div class="settings-title">WCAG Ayarları</div>
						
						<div class="settings-group">
							<label class="settings-label" for="wcag-level">WCAG Seviyesi</label>
							<select class="settings-select" id="wcag-level" aria-describedby="wcag-help">
								<option value="A">A (Temel)</option>
								<option value="AA" selected>AA (Orta - Önerilen)</option>
								<option value="AAA">AAA (Yüksek)</option>
							</select>
							<div id="wcag-help" class="sr-only">Hedef WCAG uyum seviyesini seçin.</div>
						</div>

						<div class="settings-group">
							<label class="settings-label" for="language-select">Dil</label>
							<select class="settings-select" id="language-select" aria-describedby="language-help">
								<option value="auto">Otomatik</option>
								<option value="tr" selected>Türkçe</option>
								<option value="en">English</option>
							</select>
							<div id="language-help" class="sr-only">Arayüz dilini seçin.</div>
						</div>
					</div>

					<div class="settings-section">
						<div class="settings-title">Yardım</div>
						
						<div class="settings-actions">
							<button class="settings-btn secondary" onclick="showTroubleshooting()" aria-label="Sorun giderme rehberini göster">
								🔧 Sorun Giderme
							</button>
							<button class="settings-btn secondary" onclick="diagnoseApi()" aria-label="API tanılama yap">
								🔍 API Tanılama
							</button>
						</div>
					</div>
				</div>
			</div>
		</main>
	</div>

	<script src="${scriptUri}"></script>
</body>
</html>`;
	}
}
exports.MainViewProvider = MainViewProvider;
MainViewProvider.viewType = "wcagEnhancer.mainView";
