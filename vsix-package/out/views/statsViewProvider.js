"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsViewProvider = void 0;
const vscode = require("vscode");

class StatsViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }
    
    updateStatistics(stats) {
        if (this._view) {
            this._view.webview.postMessage({
                type: "updateStats",
                stats
            });
        }
    }
    
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
            <html>
            <head>
                <title>Statistics</title>
            </head>
            <body>
                <h2>WCAG Statistics</h2>
                <div id="stats-content">Loading...</div>
            </body>
            </html>`;
    }
}
exports.StatsViewProvider = StatsViewProvider;
StatsViewProvider.viewType = "wcagEnhancer.statsView"; 