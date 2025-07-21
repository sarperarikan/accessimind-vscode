"use strict";
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
exports.TabbedMainViewProvider = void 0;
class TabbedMainViewProvider {
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
        webviewView.webview.onDidReceiveMessage((data) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (data.type === "tabChanged") {
                (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({ type: "tabContent", tab: data.tab });
            }
        }));
    }
    _getHtmlForWebview(webview) {
        return `
<!DOCTYPE html>
<html lang="tr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; frame-src 'none';">
	<title>AI Accessibility Enhancer</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			margin: 0;
			padding: 0;
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			height: 100vh;
			display: flex;
			flex-direction: column;
		}
		.header {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 16px 20px 8px 20px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		.header .info-icon {
			margin-left: 8px;
			font-size: 18px;
			color: var(--vscode-descriptionForeground);
			vertical-align: middle;
		}
		.tabs {
			display: flex;
			gap: 0;
			border-bottom: 1px solid var(--vscode-panel-border);
			background: var(--vscode-editor-background);
		}
		.tab {
			padding: 10px 24px;
			background: none;
			border: none;
			border-bottom: 2px solid transparent;
			color: var(--vscode-editor-foreground);
			font-size: 15px;
			font-weight: 500;
			cursor: pointer;
			outline: none;
			transition: border-color 0.2s, background 0.2s;
		}
		.tab[aria-selected="true"] {
			border-bottom: 2px solid var(--vscode-button-background);
			background: var(--vscode-list-hoverBackground);
			color: var(--vscode-button-foreground);
		}
		.tab:focus {
			box-shadow: 0 0 0 2px var(--vscode-focusBorder);
			z-index: 1;
		}
		.tab-content {
			flex: 1;
			padding: 0;
			overflow-y: auto;
		}
	</style>
</head>
<body>
	<div class="header" role="banner">
		<span style="font-size:20px;font-weight:600;">AI Accessibility Enhancer</span>
		<span class="info-icon" aria-label="Bilgi" title="AI Accessibility Enhancer hakkında bilgi">ℹ️</span>
	</div>
	<nav class="tabs" role="tablist" aria-label="AccessiMind Sekmeleri">
		<button class="tab" id="tab-chat" role="tab" aria-selected="true" tabindex="0" aria-controls="tabpanel-chat">Chat</button>
		<button class="tab" id="tab-stats" role="tab" aria-selected="false" tabindex="-1" aria-controls="tabpanel-stats">İstatistik</button>
		<button class="tab" id="tab-settings" role="tab" aria-selected="false" tabindex="-1" aria-controls="tabpanel-settings">Settings</button>
	</nav>
	<main class="tab-content" id="tabpanel-chat" role="tabpanel" aria-labelledby="tab-chat">
		<!-- Chat içeriği buraya yüklenecek -->
	</main>
	<main class="tab-content" id="tabpanel-stats" role="tabpanel" aria-labelledby="tab-stats" hidden>
		<!-- İstatistik içeriği buraya yüklenecek -->
	</main>
	<main class="tab-content" id="tabpanel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden>
		<!-- Settings içeriği buraya yüklenecek -->
	</main>
	<script>
		const tabs = Array.from(document.querySelectorAll('.tab'))
		const panels = [
			document.getElementById('tabpanel-chat'),
			document.getElementById('tabpanel-stats'),
			document.getElementById('tabpanel-settings')
		]
		function activateTab(idx) {
			tabs.forEach((tab, i) => {
				tab.setAttribute('aria-selected', i === idx ? 'true' : 'false')
				tab.tabIndex = i === idx ? 0 : -1
				panels[i].hidden = i !== idx
			})
			window.parent.postMessage({ type: 'tabChanged', tab: tabs[idx].id.replace('tab-', '') }, '*')
		}
		tabs.forEach((tab, i) => {
			tab.addEventListener('click', () => activateTab(i))
			tab.addEventListener('keydown', e => {
				if (e.key === 'ArrowRight') activateTab((i + 1) % tabs.length)
				if (e.key === 'ArrowLeft') activateTab((i + tabs.length - 1) % tabs.length)
			})
		})
		activateTab(0)
	</script>
</body>
</html>
`;
    }
}
exports.TabbedMainViewProvider = TabbedMainViewProvider;
TabbedMainViewProvider.viewType = "wcagEnhancer.tabbedMainView";
