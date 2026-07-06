import * as vscode from "vscode";

import { SelfCorrectionManager } from "../core/selfCorrectionManager";
import { AIProviderManager } from "../infrastructure/providers";
import { logger } from "../utils/logger";
import { LocalizationManager } from "../utils/localizationManager";

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wcagEnhancer.chatView";
	private _view?: vscode.WebviewView;
	private readonly providerManager = AIProviderManager.getInstance();
	private readonly localization = LocalizationManager.getInstance();

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		this.sendActiveFileInfo();

		vscode.window.onDidChangeActiveTextEditor(() => {
			this.sendActiveFileInfo();
		});

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case "sendMessage":
					await this.handleUserMessage(data.text);
					break;
				case "insertToEditor":
					await this.handleInsertToEditor(data.text);
					break;
				case "shareMessage":
					await this.handleShareMessage(data.text, data.messageId);
					break;
				case "closeChat":
					void vscode.commands.executeCommand("workbench.action.closeSidebar");
					break;
				case "newChat":
					this._view?.webview.postMessage({ type: "clearMessages" });
					this.sendSystemMessage(this.t("New chat started. How can I help?", "Yeni sohbet baÅŸladÄ±. NasÄ±l yardÄ±mcÄ± olabilirim?"));
					break;
				case "getActiveFile":
					this.sendActiveFileInfo();
					break;
				case "saveHistory":
					await this.saveChatHistory(data.messages);
					break;
				case "loadHistory":
					await this.loadChatHistory();
					break;
			}
		});
	}

	public refreshView(): void {
		if (!this._view) {
			return;
		}

		this._view.webview.html = this._getHtmlForWebview(this._view.webview);
		this.sendActiveFileInfo();
	}

	private sendActiveFileInfo(): void {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const fileName = editor.document.fileName.split(/[/\\]/).pop() || "Unknown";
			this._view?.webview.postMessage({
				type: "activeFileChanged",
				fileName,
				language: editor.document.languageId,
				fullPath: editor.document.fileName,
				label: this.t("Active file", "Aktif dosya"),
			});
			return;
		}

		this._view?.webview.postMessage({
			type: "activeFileChanged",
			fileName: this.t("No file open", "AÃ§Ä±k dosya yok"),
			language: "",
			fullPath: "",
			label: this.t("Active file", "Aktif dosya"),
		});
	}

	private async saveChatHistory(_messages: unknown[]): Promise<void> {
		this._view?.webview.postMessage({
			type: "historySaved",
			success: true,
		});
	}

	private async loadChatHistory(): Promise<void> {
		this._view?.webview.postMessage({
			type: "historyLoaded",
			history: [],
		});
	}

	private async handleInsertToEditor(text: string): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage(this.t("No active editor is available.", "KullanÄ±labilir aktif editÃ¶r yok."));
			return;
		}

		try {
			await editor.edit((editBuilder) => {
				if (editor.selection.isEmpty) {
					editBuilder.insert(editor.selection.active, text);
				} else {
					editBuilder.replace(editor.selection, text);
				}
			});
			vscode.window.showInformationMessage(this.t("Text inserted into the editor.", "Metin editÃ¶re eklendi."));
		} catch (error) {
			logger.error("Failed to insert chat output into editor:", error);
			vscode.window.showErrorMessage(this.t("Failed to insert text into the editor.", "Metin editÃ¶re eklenemedi."));
		}
	}

	private async handleShareMessage(text: string, messageId: string): Promise<void> {
		try {
			await vscode.env.clipboard.writeText(text);
			this._view?.webview.postMessage({
				type: "shareSuccess",
				message: this.t("Copied to clipboard.", "Panoya kopyalandÄ±."),
				messageId,
			});
			vscode.window.showInformationMessage(this.t("Message copied to clipboard.", "Mesaj panoya kopyalandÄ±."));
		} catch (error) {
			logger.error("Failed to copy chat message:", error);
			vscode.window.showErrorMessage(this.t("Failed to copy message to clipboard.", "Mesaj panoya kopyalanamadÄ±."));
		}
	}

	private async handleUserMessage(text: string): Promise<void> {
		if (!this._view) {
			return;
		}

		try {
			this._view.webview.postMessage({ type: "setLoading", value: true });

			const normalizedText = text.toLowerCase();
			const isFixRequest = normalizedText.includes("fix") || normalizedText.includes("düzelt") || normalizedText.includes("duzelt");

			if (isFixRequest) {
				await this.handleFixRequest(text);
				return;
			}

			await this.handleChatRequest(text);
		} catch (error) {
			logger.error("Chat error:", error);
			this.sendSystemMessage(this.t("An internal error occurred while processing the chat request.", "Sohbet isteði iþlenirken dahili bir hata oluþtu."));
		} finally {
			this._view.webview.postMessage({ type: "setLoading", value: false });
		}
	}

	private async handleFixRequest(text: string): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			this.sendSystemMessage(this.t("Open a file before requesting an automated fix.", "Otomatik düzeltme istemeden önce bir dosya açýn."));
			return;
		}

		const document = editor.document;
		const code = document.getText();
		if (!code.trim()) {
			this.sendSystemMessage(this.t("The active file is empty. There is nothing to fix.", "Aktif dosya boþ. Düzeltilecek bir þey yok."));
			return;
		}

		this.sendAgentMessage(this.t("Starting automated fix process...", "Otomatik düzeltme süreci baþlatýlýyor..."));

		const manager = SelfCorrectionManager.getInstance();
		const onProgress = (message: string) => {
			this.sendAgentMessage(`${this.t("Progress", "Ýlerleme")}: ${message}`);
		};

		const result = await manager.attemptFix(code, text, document.languageId, onProgress);
		if (!result.success || !result.code) {
			this.sendSystemMessage(`${this.t("Fix could not be completed", "Düzeltme tamamlanamadý")}: ${result.error || this.t("Unknown error.", "Bilinmeyen hata.")}`);
			return;
		}

		const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(code.length)
		);

		await editor.edit((editBuilder) => {
			editBuilder.replace(fullRange, result.code!);
		});

		this.sendAgentMessage(this.t(`Fix applied successfully after ${result.iterations} iteration(s).`, `Düzeltme ${result.iterations} yineleme sonunda baþarýyla uygulandý.`));
	}

	private async handleChatRequest(text: string): Promise<void> {
		const provider = await this.providerManager.getCurrentProviderInstance();
		if (!(await provider.isAvailable())) {
			this.sendSystemMessage(
				this.t("The current AI provider is not available. Check AccessiMind settings and test the connection.", "Geçerli AI saðlayýcýsý kullanýlamýyor. AccessiMind ayarlarýný kontrol edip baðlantýyý test edin.")
			);
			return;
		}

		let response;
		try {
			response = await provider.chat(text);
		} catch (error) {
			logger.warn("Primary chat request failed:", error);
			response = { success: false, error: String(error) };
		}

		if (response.success && response.content) {
			this.sendAgentMessage(response.content);
			return;
		}

		this.sendSystemMessage(`${this.t("Chat request failed", "Sohbet isteði baþarýsýz oldu")}: ${response.error || this.t("Unknown error.", "Bilinmeyen hata.")}`);
	}

	private t(en: string, tr: string): string {
		return this.localization.getCurrentLanguage() === "tr" ? tr : en;
	}

	private sendAgentMessage(text: string): void {
		this._view?.webview.postMessage({
			type: "addMessage",
			role: "agent",
			text,
		});
	}

	private sendSystemMessage(text: string): void {
		this._view?.webview.postMessage({
			type: "addMessage",
			role: "system",
			text,
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "chat.js"));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "chat.css"));
		const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "toolkit.js"));

		return `<!DOCTYPE html>
			<html lang="${this.localization.getCurrentLanguage() === "tr" ? "tr" : "en"}">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<script type="module" src="${toolkitUri}"></script>
				<title>${this.t("AccessiMind Chat", "AccessiMind Sohbet")}</title>
			</head>
			<body>
				<div class="chat-wrapper">
					<div class="chat-header">
						<div class="header-left">
							<button id="history-btn" class="header-btn" title="${this.t("Chat History", "Sohbet Geçmiþi")}" aria-label="${this.t("Open or close chat history", "Sohbet geçmiþini aç veya kapat")}">
								<span class="icon">${this.t("History", "Geçmiþ")}</span>
							</button>
							<span class="header-title">${this.t("AccessiMind Chat", "AccessiMind Sohbet")}</span>
						</div>
						<div class="header-right">
							<button id="new-chat-btn" class="header-btn" title="${this.t("New Chat", "Yeni Sohbet")}" aria-label="${this.t("Start new chat", "Yeni sohbet baþlat")}">
								<span class="icon">+</span> ${this.t("New", "Yeni")}
							</button>
							<button id="close-btn" class="header-btn close" title="${this.t("Close Chat", "Sohbeti Kapat")}" aria-label="${this.t("Close chat panel", "Sohbet panelini kapat")}">
								<span class="icon">x</span>
							</button>
						</div>
					</div>

					<div id="active-file-info" class="active-file-info" role="status" aria-live="polite">
						<span class="file-icon">${this.t("File", "Dosya")}</span>
						<span id="active-file-name">${this.t("No file open", "Açýk dosya yok")}</span>
					</div>

					<div id="history-panel" class="history-panel" aria-hidden="true">
						<div class="history-header">
							<span>${this.t("Chat History", "Sohbet Geçmiþi")}</span>
							<button id="close-history-btn" class="header-btn" aria-label="${this.t("Close history", "Geçmiþi kapat")}">x</button>
						</div>
						<div id="history-list" class="history-list">
							<div class="history-empty">${this.t("No saved chats yet", "Henüz kaydedilmiþ sohbet yok")}</div>
						</div>
					</div>

					<div class="chat-container">
						<div id="messages" class="messages" role="log" aria-label="${this.t("Chat messages", "Sohbet mesajlarý")}">
							<div class="message system">
								<div class="content">${this.t("Hello. Ask for accessibility guidance or request a fix for the active file.", "Merhaba. Eriþilebilirlik konusunda yönlendirme isteyebilir veya aktif dosya için düzeltme talep edebilirsiniz.")}</div>
							</div>
						</div>
						<div class="input-area">
							<textarea id="chat-input" placeholder="${this.t("Type a message... (Enter to send)", "Mesaj yazýn... (Göndermek için Enter)")}" rows="2" aria-label="${this.t("Chat input", "Sohbet giriþi")}"></textarea>
							<button id="send-btn" aria-label="${this.t("Send message", "Mesaj gönder")}">${this.t("Send", "Gönder")}</button>
						</div>
					</div>
				</div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}




