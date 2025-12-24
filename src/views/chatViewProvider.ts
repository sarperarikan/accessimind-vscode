import * as vscode from 'vscode';

import { logger } from '../utils/logger';
import { SelfCorrectionManager } from '../core/selfCorrectionManager';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'wcagEnhancer.chatView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Send initial active file info
        this.sendActiveFileInfo();

        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.sendActiveFileInfo();
        });

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleUserMessage(data.text);
                    break;
                case 'insertToEditor':
                    await this.handleInsertToEditor(data.text);
                    break;
                case 'shareMessage':
                    await this.handleShareMessage(data.text, data.messageId);
                    break;
                case 'closeChat':
                    // Hide the chat view
                    vscode.commands.executeCommand('workbench.action.closeSidebar');
                    break;
                case 'newChat':
                    // Clear messages and start fresh
                    this._view?.webview.postMessage({ type: 'clearMessages' });
                    this.sendSystemMessage('New chat started. How can I help you?');
                    break;
                case 'getActiveFile':
                    this.sendActiveFileInfo();
                    break;
                case 'saveHistory':
                    // Save current chat to history
                    await this.saveChatHistory(data.messages);
                    break;
                case 'loadHistory':
                    // Load chat history
                    await this.loadChatHistory();
                    break;
            }
        });
    }

    private sendActiveFileInfo() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const fileName = editor.document.fileName.split(/[/\\]/).pop() || 'Unknown';
            const language = editor.document.languageId;
            this._view?.webview.postMessage({
                type: 'activeFileChanged',
                fileName: fileName,
                language: language,
                fullPath: editor.document.fileName
            });
        } else {
            this._view?.webview.postMessage({
                type: 'activeFileChanged',
                fileName: 'No file open',
                language: '',
                fullPath: ''
            });
        }
    }

    private async saveChatHistory(messages: any[]) {
        // Save to extension state or local storage
        // For now, just acknowledge
        this._view?.webview.postMessage({
            type: 'historySaved',
            success: true
        });
    }

    private async loadChatHistory() {
        // Load from extension state
        // For now, send empty list
        this._view?.webview.postMessage({
            type: 'historyLoaded',
            history: []
        });
    }

    private async handleInsertToEditor(text: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor to insert text into.');
            return;
        }

        try {
            await editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, text);
                } else {
                    editBuilder.replace(editor.selection, text);
                }
            });
            vscode.window.showInformationMessage('Text inserted into editor.');
        } catch (error) {
            logger.error('Failed to insert text:', error);
            vscode.window.showErrorMessage('Failed to insert text into editor.');
        }
    }

    private async handleShareMessage(text: string, messageId: string) {
        try {
            await vscode.env.clipboard.writeText(text);
            this._view?.webview.postMessage({
                type: 'shareSuccess',
                message: 'Copied to clipboard!',
                messageId: messageId
            });
            vscode.window.showInformationMessage('Message copied to clipboard.');
        } catch (error) {
            logger.error('Failed to share message:', error);
            vscode.window.showErrorMessage('Failed to copy to clipboard.');
        }
    }

    private async handleUserMessage(text: string) {
        if (!this._view) { return; }

        try {
            // Show "Thinking..." state
            this._view.webview.postMessage({ type: 'setLoading', value: true });

            // Check if user is asking for a fix
            const isFixRequest = text.toLowerCase().includes('fix') || text.toLowerCase().includes('düzelt');

            if (isFixRequest) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    this.sendSystemMessage('Please open a file to fix.');
                    return;
                }

                const document = editor.document;
                const code = document.getText();
                const language = document.languageId;

                this.sendAgentMessage('Starting autonomous fix process...');

                const manager = SelfCorrectionManager.getInstance();

                // Progress callback to update chat
                const onProgress = (msg: string) => {
                    this.sendAgentMessage(`🔄 ${msg}`);
                };

                const result = await manager.attemptFix(code, text, language, onProgress);

                if (result.success && result.code) {
                    // Apply changes
                    const fullRange = new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(code.length)
                    );

                    await editor.edit(editBuilder => {
                        editBuilder.replace(fullRange, result.code!);
                    });

                    this.sendAgentMessage(`✅ Fixed successfully after ${result.iterations} iterations!`);
                } else {
                    this.sendAgentMessage(`❌ Failed to fix: ${result.error}`);
                }

            } else {
                // Normal Chat
                // Normal Chat
                const providerManager = require('../utils/aiProvider').AIProviderManager.getInstance();
                const provider = await providerManager.getCurrentProviderInstance();

                // Fallback to Gemini for chat if current provider is not suitable or fails
                let response;
                try {
                    response = await provider.chat(text);
                } catch (error) {
                    // unexpected error or not implemented
                    response = { success: false, error: String(error) };
                }

                if (response.success && response.content) {
                    this.sendAgentMessage(response.content);
                } else {
                    this.sendSystemMessage(`Error: ${response.error || 'Unknown error occurred.'}`);
                }
            }

        } catch (error) {
            logger.error('Chat error:', error);
            this.sendSystemMessage('An internal error occurred.');
        } finally {
            this._view.webview.postMessage({ type: 'setLoading', value: false });
        }
    }

    private sendAgentMessage(text: string) {
        this._view?.webview.postMessage({
            type: 'addMessage',
            role: 'agent',
            text: text
        });
    }

    private sendSystemMessage(text: string) {
        this._view?.webview.postMessage({
            type: 'addMessage',
            role: 'system',
            text: text
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.css'));
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'toolkit.js'));

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<script type="module" src="${toolkitUri}"></script>
				<title>AccessiMind Chat</title>
			</head>
			<body>
				<div class="chat-wrapper">
					<!-- Chat Header -->
					<div class="chat-header">
						<div class="header-left">
							<button id="history-btn" class="header-btn" title="Chat History" aria-label="Toggle chat history">
								<span class="icon">📜</span>
							</button>
							<span class="header-title">AccessiMind Chat</span>
						</div>
						<div class="header-right">
							<button id="new-chat-btn" class="header-btn" title="New Chat" aria-label="Start new chat">
								<span class="icon">➕</span> New
							</button>
							<button id="close-btn" class="header-btn close" title="Close Chat" aria-label="Close chat panel">
								<span class="icon">✕</span>
							</button>
						</div>
					</div>

					<!-- Active File Info -->
					<div id="active-file-info" class="active-file-info" role="status" aria-live="polite">
						<span class="file-icon">📄</span>
						<span id="active-file-name">No file open</span>
					</div>

					<!-- History Panel (Hidden by default) -->
					<div id="history-panel" class="history-panel" aria-hidden="true">
						<div class="history-header">
							<span>Chat History</span>
							<button id="close-history-btn" class="header-btn" aria-label="Close history">✕</button>
						</div>
						<div id="history-list" class="history-list">
							<div class="history-empty">No saved chats yet</div>
						</div>
					</div>

					<!-- Main Chat Area -->
					<div class="chat-container">
						<div id="messages" class="messages" role="log" aria-label="Chat messages">
							<div class="message system">
								<div class="content">Hello! I am AccessiMind Agent. How can I help you improve accessibility today?</div>
							</div>
						</div>
						<div class="input-area">
							<textarea id="chat-input" placeholder="Type a message... (Enter to send)" rows="2" aria-label="Chat input"></textarea>
							<button id="send-btn" aria-label="Send message">Send</button>
						</div>
					</div>
				</div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
