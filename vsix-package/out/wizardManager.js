"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wizardManager = exports.WizardManager = void 0;
const vscode = require("vscode");

class WizardManager {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    
    static getInstance(extensionUri) {
        if (!WizardManager.instance) {
            WizardManager.instance = new WizardManager(extensionUri);
        }
        return WizardManager.instance;
    }
    
    async showWizard() {
        const panel = vscode.window.createWebviewPanel(
            "wcagWizard",
            "AccessiMind Setup Wizard",
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        panel.webview.html = this._getHtmlForWebview(panel.webview);
    }
    
    async handleStepCompleted(step, data) {
        console.log("Wizard step completed:", step, data);
    }
    
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
            <html>
            <head>
                <title>AccessiMind Setup Wizard</title>
            </head>
            <body>
                <h1>Welcome to AccessiMind</h1>
                <p>Setup wizard content will be here</p>
            </body>
            </html>`;
    }
}
exports.WizardManager = WizardManager;
exports.wizardManager = WizardManager; 