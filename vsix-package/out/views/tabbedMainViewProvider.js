"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabbedMainViewProvider = void 0;
const vscode = require("vscode");

class TabbedMainViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    
    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }
    
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
            <html>
            <head>
                <title>AccessiMind</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .tab-content {
                        margin-top: 20px;
                    }
                    .stats-summary {
                        background-color: var(--vscode-textBlockQuote-background);
                        padding: 15px;
                        border-radius: 4px;
                        border-left: 4px solid var(--vscode-textBlockQuote-border);
                    }
                </style>
            </head>
            <body>
                <h2>♿ AccessiMind</h2>
                <div class="tab-content">
                    <div class="stats-summary">
                        <h3>📊 İstatistikler</h3>
                        <p>WCAG uyumluluk geliştirmeleri ve kullanım istatistikleri burada görüntülenir.</p>
                    </div>
                </div>
            </body>
            </html>`;
    }
}
exports.TabbedMainViewProvider = TabbedMainViewProvider;
TabbedMainViewProvider.viewType = "wcagEnhancer.tabbedMainView"; 