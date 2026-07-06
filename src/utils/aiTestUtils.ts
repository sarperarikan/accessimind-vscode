import * as vscode from "vscode";
import { AIProviderManager, GeminiProvider } from "./aiProvider";
import { testCodexAccountConnection } from "./codexAccountAuth";

import { logger } from "./logger";

export interface AITestResult {
	success: boolean;
	message: string;
	provider: string;
	model?: string;
	responseTime?: number;
	tokensUsed?: number;
	error?: string;
	details?: {
		apiKeyConfigured: boolean;
		connectionSuccessful: boolean;
		modelAvailable: boolean;
		responseReceived: boolean;
	};
}

export class AITestUtils {
	private static instance: AITestUtils;
	private aiProviderManager: AIProviderManager;

	private constructor() {
		this.aiProviderManager = AIProviderManager.getInstance();
	}

	public static getInstance(): AITestUtils {
		if (!AITestUtils.instance) {
			AITestUtils.instance = new AITestUtils();
		}
		return AITestUtils.instance;
	}

	public async testAIProvider(): Promise<AITestResult> {
		const startTime = Date.now();
		const currentProvider = this.aiProviderManager.getCurrentProviderName();

		try {
			logger.info(`AI sağlayıcı testi başlatılıyor: ${currentProvider}`);

			if (currentProvider === "gemini") {
				return await this.testGeminiProvider();
			} else if (currentProvider === "vscode-copilot") {
				return await this.testCopilotProvider();
			} else if (currentProvider === "ollama") {
				return await this.testOllamaProvider();
			} else if (currentProvider === "codex-subscription") {
				return await this.testCodexSubscriptionProvider();
			} else {
				return {
					success: false,
					message: `Bilinmeyen sağlayıcı: ${currentProvider}`,
					provider: currentProvider,
					error: "Desteklenmeyen sağlayıcı türü"
				};
			}
		} catch (error) {
			const responseTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";

			logger.error("AI sağlayıcı testi hatası:", error);

			return {
				success: false,
				message: `Test başarısız: ${errorMessage}`,
				provider: currentProvider,
				responseTime,
				error: errorMessage
			};
		}
	}

	private async testGeminiProvider(): Promise<AITestResult> {
		const startTime = Date.now();
		// const geminiApi = GeminiAPI.getInstance();
		const provider = await this.aiProviderManager.getCurrentProviderInstance();
		const geminiApi = provider as GeminiProvider;

		try {
			// 1. API anahtarı kontrolü
			const isApiKeyConfigured = await geminiApi.isApiKeyConfigured();
			if (!isApiKeyConfigured) {
				return {
					success: false,
					message: "Gemini API anahtarı yapılandırılmamış",
					provider: "gemini",
					responseTime: Date.now() - startTime,
					error: "API anahtarı bulunamadı",
					details: {
						apiKeyConfigured: false,
						connectionSuccessful: false,
						modelAvailable: false,
						responseReceived: false
					}
				};
			}

			// 2. Bağlantı testi
			const connectionTest = await geminiApi.testConnection();
			const responseTime = Date.now() - startTime;

			if (connectionTest.success) {
				return {
					success: true,
					message: `✅ Gemini bağlantısı başarılı! Model: ${connectionTest.model}`,
					provider: "gemini",
					model: connectionTest.model,
					responseTime,
					details: {
						apiKeyConfigured: true,
						connectionSuccessful: true,
						modelAvailable: true,
						responseReceived: true
					}
				};
			} else {
				return {
					success: false,
					message: `❌ Gemini bağlantı hatası: ${connectionTest.message}`,
					provider: "gemini",
					responseTime,
					error: connectionTest.message,
					details: {
						apiKeyConfigured: true,
						connectionSuccessful: false,
						modelAvailable: false,
						responseReceived: false
					}
				};
			}
		} catch (error) {
			const responseTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";

			return {
				success: false,
				message: `❌ Gemini test hatası: ${errorMessage}`,
				provider: "gemini",
				responseTime,
				error: errorMessage,
				details: {
					apiKeyConfigured: false,
					connectionSuccessful: false,
					modelAvailable: false,
					responseReceived: false
				}
			};
		}
	}

	private async testCopilotProvider(): Promise<AITestResult> {
		const startTime = Date.now();

		try {
			// VSCode Copilot provider test
			const provider = await this.aiProviderManager.getCurrentProviderInstance();
			const isAvailable = await provider.isAvailable();

			if (!isAvailable) {
				return {
					success: false,
					message: "❌ GitHub Copilot mevcut değil. Lütfen Copilot aboneliğinizi kontrol edin.",
					provider: "vscode-copilot",
					responseTime: Date.now() - startTime,
					error: "Copilot aboneliği bulunamadı",
					details: {
						apiKeyConfigured: false,
						connectionSuccessful: false,
						modelAvailable: false,
						responseReceived: false
					}
				};
			}

			// Test simple code improvement
			const testResult = await provider.improveCode({
				code: "<div>Test</div>",
				fileType: "html",
				language: "html",
				wcagLevel: "AA",
				includeComments: false
			});

			const responseTime = Date.now() - startTime;

			if (testResult.success) {
				return {
					success: true,
					message: `✅ GitHub Copilot bağlantısı başarılı! Model: ${testResult.model || "Bilinmeyen"}`,
					provider: "vscode-copilot",
					model: testResult.model,
					responseTime,
					tokensUsed: testResult.tokensUsed,
					details: {
						apiKeyConfigured: true,
						connectionSuccessful: true,
						modelAvailable: true,
						responseReceived: true
					}
				};
			} else {
				return {
					success: false,
					message: `❌ GitHub Copilot test hatası: ${testResult.error || "Bilinmeyen hata"}`,
					provider: "vscode-copilot",
					responseTime,
					error: testResult.error,
					details: {
						apiKeyConfigured: true,
						connectionSuccessful: false,
						modelAvailable: true,
						responseReceived: false
					}
				};
			}
		} catch (error) {
			const responseTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";

			return {
				success: false,
				message: `❌ GitHub Copilot test hatası: ${errorMessage}`,
				provider: "vscode-copilot",
				responseTime,
				error: errorMessage,
				details: {
					apiKeyConfigured: false,
					connectionSuccessful: false,
					modelAvailable: false,
					responseReceived: false
				}
			};
		}
	}

	private async testOllamaProvider(): Promise<AITestResult> {
		const startTime = Date.now();

		try {
			// Ollama provider test
			const provider = await this.aiProviderManager.getCurrentProviderInstance();
			const isAvailable = await provider.isAvailable();

			if (!isAvailable) {
				return {
					success: false,
					message: "❌ Ollama servisine ulaşılamadı. Lütfen Ollama'nın çalıştığından ve URL'in doğru olduğundan emin olun.",
					provider: "ollama",
					responseTime: Date.now() - startTime,
					error: "Ollama servisi çevrimdışı",
					details: {
						apiKeyConfigured: true, // API key gerekmez
						connectionSuccessful: false,
						modelAvailable: false,
						responseReceived: false
					}
				};
			}

			// Test simple code improvement to verify model works
			const testResult = await provider.improveCode({
				code: "<div>Test</div>",
				fileType: "html",
				language: "html",
				wcagLevel: "AA",
				includeComments: false
			});

			const responseTime = Date.now() - startTime;

			if (testResult.success) {
				return {
					success: true,
					message: `✅ Ollama bağlantısı başarılı! Model: ${testResult.model || "Bilinmeyen"}`,
					provider: "ollama",
					model: testResult.model,
					responseTime,
					details: {
						apiKeyConfigured: true,
						connectionSuccessful: true,
						modelAvailable: true,
						responseReceived: true
					}
				};
			} else {
				return {
					success: false,
					message: `❌ Ollama test hatası: ${testResult.error || "Bilinmeyen hata"}`,
					provider: "ollama",
					responseTime,
					error: testResult.error,
					details: {
						apiKeyConfigured: true,
						connectionSuccessful: true,
						modelAvailable: false,
						responseReceived: false
					}
				};
			}
		} catch (error) {
			const responseTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";

			return {
				success: false,
				message: `❌ Ollama test hatası: ${errorMessage}`,
				provider: "ollama",
				responseTime,
				error: errorMessage,
				details: {
					apiKeyConfigured: true,
					connectionSuccessful: false,
					modelAvailable: false,
					responseReceived: false
				}
			};
		}
	}

	private async testCodexSubscriptionProvider(): Promise<AITestResult> {
		const result = await testCodexAccountConnection();

		if (result.success) {
			return {
				success: true,
				message: `Codex account connection succeeded. Model: ${result.model}`,
				provider: "codex-subscription",
				model: result.model,
				responseTime: result.responseTime,
				details: {
					apiKeyConfigured: true,
					connectionSuccessful: true,
					modelAvailable: true,
					responseReceived: true
				}
			};
		}

		return {
			success: false,
			message: result.message,
			provider: "codex-subscription",
			model: result.model,
			responseTime: result.responseTime,
			error: result.error,
			details: {
				apiKeyConfigured: false,
				connectionSuccessful: false,
				modelAvailable: false,
				responseReceived: false
			}
		};
	}

	public async showTestResult(result: AITestResult): Promise<void> {
		const panel = vscode.window.createWebviewPanel(
			"aiTestResult",
			"🧪 AI Bağlantı Test Sonucu",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		panel.webview.html = this.getTestResultHtml(result);

		// Handle webview messages
		panel.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "retryTest": {
					panel.dispose();
					const newResult = await this.testAIProvider();
					await this.showTestResult(newResult);
					break;
				}
				case "openSettings": {
					await vscode.commands.executeCommand("workbench.view.extension.wcagEnhancer");
					break;
				}
				case "setApiKey": {
					await vscode.commands.executeCommand("wcagEnhancer.setApiKey");
					break;
				}
				case "openExternal": {
					if (message.url) {
						await vscode.env.openExternal(vscode.Uri.parse(message.url));
					}
					break;
				}
			}
		});
	}

	private getTestResultHtml(result: AITestResult): string {
		const statusIcon = result.success ? "✅" : "❌";
		// const statusColor = result.success ? "#28a745" : "#dc3545";
		let providerName = "Google Gemini";
		if (result.provider === "vscode-copilot") {
			providerName = "GitHub Copilot";
		} else if (result.provider === "ollama") {
			providerName = "Ollama (Local)";
		} else if (result.provider === "codex-subscription") {
			providerName = "Codex Subscription (ChatGPT)";
		}

		return `
<!DOCTYPE html>
<html lang="tr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AI Bağlantı Test Sonucu</title>
	<style>
		:root {
			--primary-color: #007acc;
			--success-color: #28a745;
			--danger-color: #dc3545;
			--warning-color: #ffc107;
			--text-color: var(--vscode-foreground);
			--bg-color: var(--vscode-editor-background);
			--border-color: var(--vscode-panel-border);
			--card-bg: var(--vscode-input-background);
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
			line-height: 1.6;
			padding: 32px;
		}

		.container {
			max-width: 600px;
			margin: 0 auto;
		}

		.header {
			text-align: center;
			margin-bottom: 32px;
			padding: 24px;
			background: ${result.success ? "linear-gradient(135deg, #28a745, #20c997)" : "linear-gradient(135deg, #dc3545, #e74c3c)"};
			border-radius: 12px;
			color: white;
		}

		.header h1 {
			font-size: 2rem;
			margin-bottom: 8px;
		}

		.status-icon {
			font-size: 4rem;
			margin-bottom: 16px;
		}

		.result-card {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 24px;
			margin-bottom: 24px;
		}

		.result-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px 0;
			border-bottom: 1px solid var(--border-color);
		}

		.result-item:last-child {
			border-bottom: none;
		}

		.result-label {
			font-weight: 600;
		}

		.result-value {
			color: var(--vscode-descriptionForeground);
		}

		.result-value.success {
			color: var(--success-color);
		}

		.result-value.error {
			color: var(--danger-color);
		}

		.details-section {
			margin-top: 24px;
		}

		.details-title {
			font-size: 1.2rem;
			font-weight: 600;
			margin-bottom: 16px;
			color: var(--primary-color);
		}

		.detail-item {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 8px 0;
		}

		.detail-icon {
			width: 20px;
			height: 20px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 0.8rem;
			color: white;
		}

		.detail-icon.success {
			background: var(--success-color);
		}

		.detail-icon.error {
			background: var(--danger-color);
		}

		.action-buttons {
			display: flex;
			gap: 12px;
			justify-content: center;
			margin-top: 32px;
		}

		.btn {
			padding: 12px 24px;
			border: none;
			border-radius: 6px;
			font-size: 1rem;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.2s ease;
			text-decoration: none;
			display: inline-flex;
			align-items: center;
			gap: 8px;
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
			background: var(--vscode-button-hoverBackground);
		}

		.btn-success {
			background: var(--success-color);
			color: white;
		}

		.btn-danger {
			background: var(--danger-color);
			color: white;
		}

		.error-message {
			background: rgba(220, 53, 69, 0.1);
			border: 1px solid var(--danger-color);
			border-radius: 6px;
			padding: 16px;
			margin-top: 16px;
			color: var(--danger-color);
		}

		.suggestions {
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			padding: 20px;
			margin-top: 24px;
		}

		.suggestions h3 {
			color: var(--primary-color);
			margin-bottom: 12px;
		}

		.suggestions ul {
			list-style: none;
			padding: 0;
		}

		.suggestions li {
			padding: 8px 0;
			border-bottom: 1px solid var(--border-color);
		}

		.suggestions li:last-child {
			border-bottom: none;
		}

		@media (max-width: 600px) {
			body {
				padding: 16px;
			}
			
			.action-buttons {
				flex-direction: column;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="status-icon">${statusIcon}</div>
			<h1>AI Bağlantı Testi</h1>
			<p>Sağlayıcı: ${providerName}</p>
		</div>

		<div class="result-card">
			<div class="result-item">
				<span class="result-label">Durum</span>
				<span class="result-value ${result.success ? "success" : "error"}">
					${result.success ? "Başarılı" : "Başarısız"}
				</span>
			</div>
			<div class="result-item">
				<span class="result-label">Sağlayıcı</span>
				<span class="result-value">${providerName}</span>
			</div>
			${result.model ? `
			<div class="result-item">
				<span class="result-label">Model</span>
				<span class="result-value">${result.model}</span>
			</div>
			` : ""}
			${result.responseTime ? `
			<div class="result-item">
				<span class="result-label">Yanıt Süresi</span>
				<span class="result-value">${result.responseTime}ms</span>
			</div>
			` : ""}
			${result.tokensUsed ? `
			<div class="result-item">
				<span class="result-label">Kullanılan Token</span>
				<span class="result-value">${result.tokensUsed}</span>
			</div>
			` : ""}
		</div>

		${result.details ? `
		<div class="details-section">
			<h3 class="details-title">Detaylı Kontrol Sonuçları</h3>
			<div class="result-card">
				<div class="detail-item">
					<div class="detail-icon ${result.details.apiKeyConfigured ? "success" : "error"}">
						${result.details.apiKeyConfigured ? "✓" : "✗"}
					</div>
					<span>API Anahtarı Yapılandırması</span>
				</div>
				<div class="detail-item">
					<div class="detail-icon ${result.details.connectionSuccessful ? "success" : "error"}">
						${result.details.connectionSuccessful ? "✓" : "✗"}
					</div>
					<span>Bağlantı Başarılı</span>
				</div>
				<div class="detail-item">
					<div class="detail-icon ${result.details.modelAvailable ? "success" : "error"}">
						${result.details.modelAvailable ? "✓" : "✗"}
					</div>
					<span>Model Erişilebilir</span>
				</div>
				<div class="detail-item">
					<div class="detail-icon ${result.details.responseReceived ? "success" : "error"}">
						${result.details.responseReceived ? "✓" : "✗"}
					</div>
					<span>Yanıt Alındı</span>
				</div>
			</div>
		</div>
		` : ""}

		${result.error ? `
		<div class="error-message">
			<strong>Hata Detayı:</strong> ${result.error}
		</div>
		` : ""}

		${!result.success ? `
		<div class="suggestions">
			<h3>💡 Çözüm Önerileri</h3>
			<ul>
				${result.provider === "gemini" ? `
				<li>• Google AI Studio'dan geçerli bir API anahtarı aldığınızdan emin olun</li>
				<li>• API anahtarının doğru formatta olduğunu kontrol edin (AIza ile başlamalı)</li>
				<li>• İnternet bağlantınızı kontrol edin</li>
				<li>• Gemini API limitlerini aşmadığınızdan emin olun</li>
				` : result.provider === "vscode-copilot" ? `
				<li>• GitHub Copilot aboneliğinizin aktif olduğunu kontrol edin</li>
				<li>• VS Code'da GitHub hesabınızla giriş yaptığınızdan emin olun</li>
				<li>• GitHub Copilot uzantısının yüklü ve etkin olduğunu kontrol edin</li>
				<li>• VS Code'u yeniden başlatmayı deneyin</li>
				` : result.provider === "codex-subscription" ? `
				<li>AccessiMind: Connect Codex Account komutunu calistirin</li>
				<li>Terminalde codex login ile ChatGPT/Codex hesabinizda oturum acin</li>
				<li>API anahtari girmeyin; bu provider Codex hesabinizin oturumunu kullanir</li>
				<li>Windows app alias engellenirse wcagEnhancer.ai.codexPath ayarina codex.exe yolunu girin</li>
				` : `
				<li>• Ollama servisinin çalıştığından emin olun (ollama serve)</li>
				<li>• Ollama API URL'inin doğru olduğunu kontrol edin (Varsayılan: http://localhost:11434)</li>
				<li>• Seçilen modelin Ollama'da yüklü olduğundan emin olun (ollama pull model_adı)</li>
				<li>• Güvenlik duvarı ayarlarının bağlantıyı engellemediğinden emin olun</li>
				`}
			</ul>
		</div>
		` : ""}

		<div class="action-buttons">
			<button class="btn btn-primary" onclick="retryTest()">
				🔄 Tekrar Test Et
			</button>
			<button class="btn btn-secondary" onclick="openSettings()">
				⚙️ Ayarları Aç
			</button>
			${result.provider === "gemini" && !result.success ? `
			<button class="btn btn-success" onclick="setApiKey()">
				🔑 API Anahtarı Ayarla
			</button>
			<button class="btn btn-secondary" onclick="openGeminiStudio()">
				📋 Gemini Studio
			</button>
			` : ""}
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		function retryTest() {
			vscode.postMessage({ command: 'retryTest' });
		}

		function openSettings() {
			vscode.postMessage({ command: 'openSettings' });
		}

		function setApiKey() {
			vscode.postMessage({ command: 'setApiKey' });
		}

		function openGeminiStudio() {
			vscode.postMessage({ 
				command: 'openExternal', 
				url: 'https://makersuite.google.com/' 
			});
		}
	</script>
</body>
</html>
		`;
	}
}
