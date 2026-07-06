import * as vscode from "vscode";

import { AIProviderManager } from "../utils/aiProvider";
import { BrowserSelectionPayload, BrowserSelectionServer } from "../utils/browserSelectionServer";
import { normalizeGeneratedCode } from "../utils/codeGenerationUtils";
import { LocalizationManager } from "../utils/localizationManager";
import { logger } from "../utils/logger";
import { StatisticsManager } from "../utils/statisticsManager";

interface BrowserSessionPanelOptions {
    context: vscode.ExtensionContext;
    aiProviderManager: AIProviderManager;
    localization: LocalizationManager;
    statisticsManager: StatisticsManager;
    initialTargetUrl?: string;
}

interface AnalysisState {
    originalSnippet: string;
    improvedCode: string;
}

const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const localize = (localization: LocalizationManager, en: string, tr: string): string =>
    localization.getCurrentLanguage() === "tr" ? tr : en;

export class BrowserSessionPanel {
    public static currentPanel: BrowserSessionPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private readonly aiProviderManager: AIProviderManager;
    private readonly localization: LocalizationManager;
    private readonly statisticsManager: StatisticsManager;
    private readonly server = new BrowserSelectionServer();
    private readonly disposables: vscode.Disposable[] = [];
    private lastAnalysis: AnalysisState | undefined;
    private endpointUrl = "";
    private sessionToken = "";
    private currentTargetUrl = "";

    public static createOrShow(options: BrowserSessionPanelOptions): void {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (BrowserSessionPanel.currentPanel) {
            BrowserSessionPanel.currentPanel.currentTargetUrl = options.initialTargetUrl || "";
            BrowserSessionPanel.currentPanel.panel.reveal(column);
            void BrowserSessionPanel.currentPanel.initialize();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "accessimindBrowserSession",
            "AccessiMind Browser Session",
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        BrowserSessionPanel.currentPanel = new BrowserSessionPanel(panel, options);
    }

    private constructor(panel: vscode.WebviewPanel, options: BrowserSessionPanelOptions) {
        this.panel = panel;
        this.context = options.context;
        this.aiProviderManager = options.aiProviderManager;
        this.localization = options.localization;
        this.statisticsManager = options.statisticsManager;
        this.currentTargetUrl = options.initialTargetUrl || "";

        this.panel.onDidDispose(() => void this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => void this.handleMessage(message), null, this.disposables);
        this.server.on("selection", (payload) => {
            void this.handleSelection(payload);
        });
        this.server.on("status", (message) => {
            void this.panel.webview.postMessage({ command: "status", message });
        });
        this.server.on("error", (message) => {
            void this.panel.webview.postMessage({ command: "analysisError", message });
        });

        this.renderShell();
        void this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            const session = await this.server.start();
            this.endpointUrl = session.endpointUrl;
            this.sessionToken = session.sessionToken;
            void this.panel.webview.postMessage({
                command: "sessionReady",
                endpointUrl: this.endpointUrl,
                sessionToken: this.sessionToken,
                targetUrl: this.currentTargetUrl
            });
        } catch (error) {
            logger.error("Browser session server failed to start:", error);
            void this.panel.webview.postMessage({
                command: "analysisError",
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private renderShell(): void {
        const strings = {
            title: localize(this.localization, "AccessiMind Browser Session", "AccessiMind Tarayici Oturumu"),
            subtitle: localize(
                this.localization,
                "Install the AccessiMind companion Chrome extension, paste the endpoint and token once, then right-click any page element and choose Inspect for AccessiMind.",
                "AccessiMind companion Chrome eklentisini kurun, endpoint ve token bilgisini bir kez yapistirin, sonra sayfadaki bir elemente sag tiklayip Inspect for AccessiMind secin."
            ),
            sessionEndpoint: localize(this.localization, "Session endpoint", "Oturum endpoint'i"),
            sessionToken: localize(this.localization, "Session token", "Oturum token'i"),
            targetUrl: localize(this.localization, "Target URL", "Hedef URL"),
            copyEndpoint: localize(this.localization, "Copy endpoint", "Endpoint'i kopyala"),
            copyToken: localize(this.localization, "Copy token", "Token'i kopyala"),
            openChrome: localize(this.localization, "Open target URL", "Hedef URL'yi ac"),
            openCompanionFolder: localize(this.localization, "Open companion folder", "Companion klasorunu ac"),
            waiting: localize(
                this.localization,
                "Waiting for a right-click selection from the Chrome companion extension.",
                "Chrome companion eklentisinden sag tik secimi bekleniyor."
            ),
            status: localize(this.localization, "Status", "Durum"),
            selector: localize(this.localization, "Selected element", "Secilen element"),
            summary: localize(this.localization, "Summary", "Ozet"),
            original: localize(this.localization, "Original snippet", "Orijinal parca"),
            improved: localize(this.localization, "Improved snippet", "Iyilestirilmis parca"),
            openEditor: localize(this.localization, "Open in editor", "Editor'de ac"),
            installHint: localize(
                this.localization,
                "Companion extension source is included in this VSIX under browser-extension/accessimind-companion. Load it as an unpacked extension in Chrome once.",
                "Companion eklenti kaynagi bu VSIX icinde browser-extension/accessimind-companion altinda gelir. Chrome'da bir kez unpacked extension olarak yukleyin."
            )
        };

        const stringsJson = escapeHtml(JSON.stringify(strings));
        this.panel.title = strings.title;
        this.panel.webview.html = `<!DOCTYPE html>
<html lang="${this.localization.getCurrentLanguage() === "tr" ? "tr" : "en"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(strings.title)}</title>
<style>
body{margin:0;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
.shell{display:grid;grid-template-columns:minmax(320px,.95fr) minmax(0,1.05fr);height:100vh}
.left,.right{padding:16px;overflow:auto}
.left{border-right:1px solid var(--vscode-panel-border)}
.card{border:1px solid var(--vscode-panel-border);border-radius:12px;background:var(--vscode-sideBar-background);padding:14px;margin-bottom:14px}
.card h2{margin:0 0 8px;font-size:14px}
.card p{margin:0;line-height:1.5;color:var(--vscode-descriptionForeground)}
.stack{display:grid;gap:10px}
.field{display:grid;gap:6px}
input{width:100%;padding:10px;border:1px solid var(--vscode-panel-border);border-radius:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground)}
.row{display:flex;gap:8px;flex-wrap:wrap}
button{border:1px solid var(--vscode-panel-border);background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:10px 12px;border-radius:8px;cursor:pointer}
pre{white-space:pre-wrap;font-family:Consolas,monospace;font-size:12px;background:rgba(15,23,42,.82);color:#e2e8f0;padding:12px;border-radius:10px;overflow:auto;max-height:280px}
.status{padding:10px;border-radius:8px;background:rgba(59,130,246,.14);color:#bfdbfe}
.warning{padding:10px;border-radius:8px;background:rgba(245,158,11,.15);color:#fbbf24}
@media (max-width:960px){.shell{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="shell">
<section class="left">
<div class="card"><h2>${escapeHtml(strings.title)}</h2><p>${escapeHtml(strings.subtitle)}</p></div>
<div class="card stack">
<div class="field"><label for="endpoint">${escapeHtml(strings.sessionEndpoint)}</label><input id="endpoint" readonly></div>
<div class="field"><label for="token">${escapeHtml(strings.sessionToken)}</label><input id="token" readonly></div>
<div class="field"><label for="target-url">${escapeHtml(strings.targetUrl)}</label><input id="target-url" readonly></div>
<div class="row">
<button id="copy-endpoint" type="button">${escapeHtml(strings.copyEndpoint)}</button>
<button id="copy-token" type="button">${escapeHtml(strings.copyToken)}</button>
</div>
<div class="row">
<button id="open-url" type="button">${escapeHtml(strings.openChrome)}</button>
<button id="open-folder" type="button">${escapeHtml(strings.openCompanionFolder)}</button>
</div>
</div>
<div class="card"><h2>${escapeHtml(strings.status)}</h2><div id="status" class="status">${escapeHtml(strings.waiting)}</div></div>
<div class="card"><h2>${escapeHtml(strings.selector)}</h2><p id="selector">${escapeHtml(strings.waiting)}</p></div>
<div class="card"><p>${escapeHtml(strings.installHint)}</p></div>
</section>
<section class="right">
<div class="card"><h2>${escapeHtml(strings.summary)}</h2><p id="summary">${escapeHtml(strings.waiting)}</p></div>
<div class="card"><h2>${escapeHtml(strings.original)}</h2><pre id="original">${escapeHtml(strings.waiting)}</pre></div>
<div class="card"><h2>${escapeHtml(strings.improved)}</h2><pre id="improved">${escapeHtml(strings.waiting)}</pre><div id="warnings" class="warning" style="display:none;margin-top:10px;"></div></div>
<div class="card"><div class="row"><button id="open-editor" type="button" disabled>${escapeHtml(strings.openEditor)}</button></div></div>
</section>
</div>
<script>
const vscode=acquireVsCodeApi();
const strings=JSON.parse('${stringsJson}');
const endpointEl=document.getElementById('endpoint');
const tokenEl=document.getElementById('token');
const targetUrlEl=document.getElementById('target-url');
const statusEl=document.getElementById('status');
const selectorEl=document.getElementById('selector');
const summaryEl=document.getElementById('summary');
const originalEl=document.getElementById('original');
const improvedEl=document.getElementById('improved');
const warningsEl=document.getElementById('warnings');
const openEditorBtn=document.getElementById('open-editor');
document.getElementById('copy-endpoint').addEventListener('click',()=>vscode.postMessage({command:'copyEndpoint'}));
document.getElementById('copy-token').addEventListener('click',()=>vscode.postMessage({command:'copyToken'}));
document.getElementById('open-folder').addEventListener('click',()=>vscode.postMessage({command:'openCompanionFolder'}));
document.getElementById('open-url').addEventListener('click',()=>vscode.postMessage({command:'openTargetUrl'}));
openEditorBtn.addEventListener('click',()=>vscode.postMessage({command:'openAnalysisInEditor'}));
window.addEventListener('message',(event)=>{const message=event.data;if(!message?.command)return;
if(message.command==='sessionReady'){endpointEl.value=message.endpointUrl||'';tokenEl.value=message.sessionToken||'';targetUrlEl.value=message.targetUrl||'';statusEl.textContent=strings.waiting;return;}
if(message.command==='status'){statusEl.textContent=message.message;return;}
if(message.command==='selectionCaptured'){selectorEl.textContent=message.selector;summaryEl.textContent=strings.waiting;originalEl.textContent=message.originalCode;improvedEl.textContent='';warningsEl.style.display='none';statusEl.textContent=message.pageUrl;return;}
if(message.command==='analysisResult'){selectorEl.textContent=message.selector;summaryEl.textContent=message.summary;originalEl.textContent=message.originalCode;improvedEl.textContent=message.improvedCode;openEditorBtn.disabled=false;if(message.warnings&&message.warnings.length){warningsEl.style.display='block';warningsEl.textContent=message.warnings.join(' ');}else{warningsEl.style.display='none';warningsEl.textContent='';}return;}
if(message.command==='analysisError'){statusEl.textContent=message.message;summaryEl.textContent=message.message;warningsEl.style.display='block';warningsEl.textContent=message.message;}}
);
</script>
</body>
</html>`;
    }

    private async handleMessage(message: { command?: string }): Promise<void> {
        switch (message.command) {
            case "copyEndpoint":
                await vscode.env.clipboard.writeText(this.endpointUrl);
                return;
            case "copyToken":
                await vscode.env.clipboard.writeText(this.sessionToken);
                return;
            case "openCompanionFolder":
                await this.openCompanionFolder();
                return;
            case "openTargetUrl":
                await this.openTargetUrl();
                return;
            case "openAnalysisInEditor":
                await this.openAnalysisInEditor();
                return;
            default:
                return;
        }
    }

    private async openCompanionFolder(): Promise<void> {
        const folderUri = vscode.Uri.joinPath(this.context.extensionUri, "browser-extension", "accessimind-companion");
        await vscode.env.openExternal(folderUri);
    }

    private async openTargetUrl(): Promise<void> {
        if (!this.currentTargetUrl) {
            return;
        }
        await vscode.env.openExternal(vscode.Uri.parse(this.currentTargetUrl));
    }

    private async handleSelection(payload: BrowserSelectionPayload): Promise<void> {
        try {
            this.currentTargetUrl = payload.pageUrl;
            void this.panel.webview.postMessage({
                command: "selectionCaptured",
                selector: payload.selector,
                originalCode: payload.outerHTML,
                pageUrl: payload.pageUrl
            });

            const provider = await this.aiProviderManager.getCurrentProviderInstance();
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const response = await provider.improveCode({
                code: [
                    `Selector: ${payload.selector}`,
                    `Tag: ${payload.tagName}`,
                    payload.pageTitle ? `Page title: ${payload.pageTitle}` : "",
                    `Parent chain: ${payload.parentChain.join(" > ")}`,
                    payload.textPreview ? `Text preview: ${payload.textPreview}` : "",
                    `Page URL: ${payload.pageUrl}`,
                    "",
                    "Context excerpt:",
                    payload.contextHtml
                ].filter(Boolean).join("\n"),
                selectedText: payload.outerHTML,
                fileType: "html",
                language: "html",
                mode: "edit",
                wcagLevel: (config.get("wcagLevel") as "A" | "AA" | "AAA") || "AA",
                includeComments: config.get("includeComments") !== false,
                responseLanguage: this.localization.getCurrentLanguage() as "en" | "tr"
            });

            if (!response.success || !response.content) {
                throw new Error(response.error || localize(this.localization, "AI returned an empty result.", "AI bos bir sonuc dondurdu."));
            }

            const normalized = normalizeGeneratedCode({
                originalCode: payload.outerHTML,
                generatedContent: response.content,
                language: "html",
                mode: "selection"
            });

            this.lastAnalysis = {
                originalSnippet: payload.outerHTML,
                improvedCode: normalized.code
            };

            this.statisticsManager.recordImprovement({
                type: "inline-chat",
                language: "html",
                fileName: payload.pageUrl,
                linesImproved: normalized.code.split("\n").length,
                wcagCriteria: response.wcagCriteria || [],
                processingTime: response.responseTime || 0,
                tokensUsed: response.tokensUsed || 0,
                provider: this.aiProviderManager.getCurrentProviderName() as "gemini" | "vscode-copilot" | "ollama",
                model: response.model || "current"
            });

            void this.panel.webview.postMessage({
                command: "analysisResult",
                selector: payload.selector,
                originalCode: payload.outerHTML,
                improvedCode: normalized.code,
                warnings: normalized.warnings,
                summary: response.summary || localize(
                    this.localization,
                    "Element analysis completed. Review the suggested accessible replacement below.",
                    "Element analizi tamamlandi. Asagidaki erisilebilir oneriyi inceleyin."
                )
            });
        } catch (error) {
            logger.error("Browser session selection analysis failed:", error);
            void this.panel.webview.postMessage({
                command: "analysisError",
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async openAnalysisInEditor(): Promise<void> {
        if (!this.lastAnalysis) {
            return;
        }

        const document = await vscode.workspace.openTextDocument({
            language: "html",
            content: this.lastAnalysis.improvedCode
        });
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
    }

    public async dispose(): Promise<void> {
        BrowserSessionPanel.currentPanel = undefined;
        await this.server.dispose();
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }
}
