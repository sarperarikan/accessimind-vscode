import * as vscode from "vscode";

import { AIProviderManager } from "../utils/aiProvider";
import { BrowserIntegrationConfig } from "../utils/browserIntegrationUtils";
import { normalizeGeneratedCode } from "../utils/codeGenerationUtils";
import { LiveChromeBridge, LiveChromeSelectionPayload } from "../utils/liveChromeBridge";
import { LocalizationManager } from "../utils/localizationManager";
import { logger } from "../utils/logger";
import { StatisticsManager } from "../utils/statisticsManager";

interface BrowserInspectorOptions {
    aiProviderManager: AIProviderManager;
    localization: LocalizationManager;
    statisticsManager: StatisticsManager;
}

interface BrowserInspectorSource {
    documentUri?: vscode.Uri;
    targetUrl: string;
    browserConfig: BrowserIntegrationConfig;
}

interface AnalysisState {
    originalSnippet: string;
    improvedCode: string;
}

const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const localize = (localization: LocalizationManager, en: string, tr: string): string =>
    localization.getCurrentLanguage() === "tr" ? tr : en;

export class BrowserInspectorPanel {
    public static currentPanel: BrowserInspectorPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly aiProviderManager: AIProviderManager;
    private readonly localization: LocalizationManager;
    private readonly statisticsManager: StatisticsManager;
    private readonly chromeBridge = new LiveChromeBridge();
    private source: BrowserInspectorSource;
    private lastAnalysis: AnalysisState | undefined;
    private currentPageUrl: string;

    public static createOrShow(
        context: vscode.ExtensionContext,
        source: BrowserInspectorSource,
        options: BrowserInspectorOptions
    ): void {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (BrowserInspectorPanel.currentPanel) {
            BrowserInspectorPanel.currentPanel.source = source;
            BrowserInspectorPanel.currentPanel.currentPageUrl = source.targetUrl;
            BrowserInspectorPanel.currentPanel.lastAnalysis = undefined;
            BrowserInspectorPanel.currentPanel.panel.reveal(column);
            void BrowserInspectorPanel.currentPanel.launchChrome();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "accessimindBrowserInspector",
            "AccessiMind Browser Inspector",
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        BrowserInspectorPanel.currentPanel = new BrowserInspectorPanel(panel, context, source, options);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        _context: vscode.ExtensionContext,
        source: BrowserInspectorSource,
        options: BrowserInspectorOptions
    ) {
        this.panel = panel;
        this.source = source;
        this.currentPageUrl = source.targetUrl;
        this.aiProviderManager = options.aiProviderManager;
        this.localization = options.localization;
        this.statisticsManager = options.statisticsManager;

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => void this.handleMessage(message), null, this.disposables);
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration("wcagEnhancer.language")) {
                return;
            }
            this.localization.detectLanguage();
            this.renderShell();
        }, null, this.disposables);

        this.chromeBridge.on("status", (message) => {
            void this.panel.webview.postMessage({ command: "status", message });
        });
        this.chromeBridge.on("error", (message) => {
            void this.panel.webview.postMessage({ command: "analysisError", message });
        });
        this.chromeBridge.on("urlChanged", (url) => {
            this.currentPageUrl = url;
            void this.panel.webview.postMessage({ command: "urlChanged", url });
        });
        this.chromeBridge.on("selection", (payload) => {
            void this.handleSelection(payload);
        });

        this.renderShell();
        void this.launchChrome();
    }

    private renderShell(): void {
        this.panel.title = localize(this.localization, "AccessiMind Browser Inspector", "AccessiMind Tarayici Denetleyici");
        this.panel.webview.html = this.getHtml();
    }

    private async launchChrome(): Promise<void> {
        try {
            void this.panel.webview.postMessage({ command: "status", message: localize(this.localization, "Launching live Chrome session...", "Canli Chrome oturumu baslatiliyor...") });
            await this.chromeBridge.launchOrAttach(this.source.targetUrl, this.source.browserConfig);
        } catch (error) {
            logger.error("Failed to launch Chrome bridge:", error);
            void this.panel.webview.postMessage({
                command: "analysisError",
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case "loadUrl":
                await this.loadUrl(String(message.url || ""));
                return;
            case "togglePickMode":
                await this.chromeBridge.setPickMode(!!message.enabled);
                return;
            case "focusChrome":
                await this.chromeBridge.bringToFront();
                return;
            case "openAnalysisInEditor":
                await this.openAnalysisInEditor();
                return;
            case "applyAnalysisToDocument":
                await this.applyAnalysisToDocument();
                return;
            default:
                return;
        }
    }

    private async loadUrl(rawUrl: string): Promise<void> {
        const trimmed = rawUrl.trim();
        if (!trimmed) {
            return;
        }
        const targetUrl = /^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        this.source = { ...this.source, targetUrl };
        this.currentPageUrl = targetUrl;
        this.lastAnalysis = undefined;
        void this.panel.webview.postMessage({ command: "status", message: localize(this.localization, "Opening URL in Chrome...", "URL Chrome'da aciliyor...") });
        await this.chromeBridge.navigate(targetUrl);
    }

    private async handleSelection(payload: LiveChromeSelectionPayload): Promise<void> {
        try {
            void this.panel.webview.postMessage({
                command: "selectionCaptured",
                selector: payload.selector,
                originalCode: payload.outerHTML
            });

            const provider = await this.aiProviderManager.getCurrentProviderInstance();
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const response = await provider.improveCode({
                code: [
                    `Selector: ${payload.selector}`,
                    `Tag: ${payload.tagName}`,
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
                canApply: !!this.source.documentUri && payload.pageUrl.startsWith("file:"),
                summary: response.summary || localize(
                    this.localization,
                    "Element analysis completed. Review the suggested accessible replacement below.",
                    "Element analizi tamamlandi. Asagidaki erisilebilir oneriyi inceleyin."
                )
            });
        } catch (error) {
            logger.error("Chrome selection analysis failed:", error);
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

    private async applyAnalysisToDocument(): Promise<void> {
        if (!this.lastAnalysis || !this.source.documentUri) {
            return;
        }
        const document = await vscode.workspace.openTextDocument(this.source.documentUri);
        const source = document.getText();
        const start = source.indexOf(this.lastAnalysis.originalSnippet);
        if (start === -1) {
            vscode.window.showWarningMessage(
                localize(
                    this.localization,
                    "The selected element could not be matched exactly in the source. Open the suggestion in the editor and apply it manually.",
                    "Secilen element kaynakta birebir eslestirilemedi. Oneriyi editor'de acip manuel uygulayin."
                )
            );
            return;
        }
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            this.source.documentUri,
            new vscode.Range(document.positionAt(start), document.positionAt(start + this.lastAnalysis.originalSnippet.length)),
            this.lastAnalysis.improvedCode
        );
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(
            localize(this.localization, "Improved element applied to the current document.", "Iyilestirilmis element aktif belgeye uygulandi.")
        );
        this.lastAnalysis = undefined;
    }

    private getHtml(): string {
        const strings = {
            title: localize(this.localization, "Live Chrome Inspector", "Canli Chrome Denetleyici"),
            subtitle: localize(
                this.localization,
                "This uses a real Chrome window. Enter a URL, click Bring Chrome Forward, then enable pick mode and right-click any element in Chrome.",
                "Bu, gercek bir Chrome penceresi kullanir. URL girin, Chrome'u one getirin, sonra secim modunu acip Chrome icinde bir elemente sag tiklayin."
            ),
            url: localize(this.localization, "URL", "URL"),
            openUrl: localize(this.localization, "Open URL", "URL Ac"),
            focusChrome: localize(this.localization, "Bring Chrome Forward", "Chrome'u One Getir"),
            enablePick: localize(this.localization, "Enable Pick Mode", "Secim Modunu Ac"),
            disablePick: localize(this.localization, "Disable Pick Mode", "Secim Modunu Kapat"),
            waiting: localize(
                this.localization,
                "No element selected yet. Use the live Chrome window to right-click an element.",
                "Henuz bir element secilmedi. Canli Chrome penceresinde bir elemente sag tiklayin."
            ),
            status: localize(this.localization, "Status", "Durum"),
            selector: localize(this.localization, "Selected element", "Secilen element"),
            summary: localize(this.localization, "Summary", "Ozet"),
            original: localize(this.localization, "Original snippet", "Orijinal parca"),
            improved: localize(this.localization, "Improved snippet", "Iyilestirilmis parca"),
            openEditor: localize(this.localization, "Open in editor", "Editor'de ac"),
            apply: localize(this.localization, "Apply exact replacement", "Birebir degisikligi uygula"),
            applyDisabled: localize(this.localization, "Apply works only for local HTML files opened through file://.", "Uygulama sadece file:// ile acilan yerel HTML dosyalarinda calisir.")
        };

        const stringsJson = escapeHtml(JSON.stringify(strings));
        const currentUrl = escapeHtml(this.currentPageUrl);

        return `<!DOCTYPE html>
<html lang="${this.localization.getCurrentLanguage() === "tr" ? "tr" : "en"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(strings.title)}</title>
<style>
body{margin:0;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
.shell{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(0,1.1fr);height:100vh}
.left,.right{padding:16px;overflow:auto}
.left{border-right:1px solid var(--vscode-panel-border)}
.card{border:1px solid var(--vscode-panel-border);border-radius:12px;background:var(--vscode-sideBar-background);padding:14px;margin-bottom:14px}
.card h2{margin:0 0 8px;font-size:14px}
.card p{margin:0;line-height:1.5;color:var(--vscode-descriptionForeground)}
.row{display:flex;gap:8px;flex-wrap:wrap}
input{flex:1;padding:10px;border:1px solid var(--vscode-panel-border);border-radius:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground)}
button{border:1px solid var(--vscode-panel-border);background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:10px 12px;border-radius:8px;cursor:pointer}
button.secondary{background:transparent;color:var(--vscode-foreground)}
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
<div class="card">
<h2>${escapeHtml(strings.url)}</h2>
<div class="row">
<input id="url-input" type="text" value="${currentUrl}" aria-label="${escapeHtml(strings.url)}">
<button id="open-url" type="button">${escapeHtml(strings.openUrl)}</button>
</div>
<div class="row" style="margin-top:10px">
<button id="focus-chrome" class="secondary" type="button">${escapeHtml(strings.focusChrome)}</button>
<button id="toggle-pick" type="button">${escapeHtml(strings.enablePick)}</button>
</div>
</div>
<div class="card"><h2>${escapeHtml(strings.status)}</h2><div id="status" class="status">${escapeHtml(strings.waiting)}</div></div>
<div class="card"><h2>${escapeHtml(strings.selector)}</h2><p id="selector">${escapeHtml(strings.waiting)}</p></div>
</section>
<section class="right">
<div class="card"><h2>${escapeHtml(strings.summary)}</h2><p id="summary">${escapeHtml(strings.waiting)}</p></div>
<div class="card"><h2>${escapeHtml(strings.original)}</h2><pre id="original">${escapeHtml(strings.waiting)}</pre></div>
<div class="card"><h2>${escapeHtml(strings.improved)}</h2><pre id="improved">${escapeHtml(strings.waiting)}</pre><div id="warnings" class="warning" style="display:none;margin-top:10px;"></div></div>
<div class="card"><div class="row"><button id="open-editor" type="button" disabled>${escapeHtml(strings.openEditor)}</button><button id="apply" type="button" disabled>${escapeHtml(strings.apply)}</button></div><p style="margin-top:10px;">${escapeHtml(strings.applyDisabled)}</p></div>
</section>
</div>
<script>
const vscode=acquireVsCodeApi();
const strings=JSON.parse('${stringsJson}');
const statusEl=document.getElementById('status');
const selectorEl=document.getElementById('selector');
const summaryEl=document.getElementById('summary');
const originalEl=document.getElementById('original');
const improvedEl=document.getElementById('improved');
const warningsEl=document.getElementById('warnings');
const applyBtn=document.getElementById('apply');
const openEditorBtn=document.getElementById('open-editor');
const togglePickBtn=document.getElementById('toggle-pick');
let pickMode=false;
document.getElementById('open-url').addEventListener('click',()=>vscode.postMessage({command:'loadUrl',url:document.getElementById('url-input').value}));
document.getElementById('focus-chrome').addEventListener('click',()=>vscode.postMessage({command:'focusChrome'}));
togglePickBtn.addEventListener('click',()=>{pickMode=!pickMode;togglePickBtn.textContent=pickMode?strings.disablePick:strings.enablePick;vscode.postMessage({command:'togglePickMode',enabled:pickMode});});
openEditorBtn.addEventListener('click',()=>vscode.postMessage({command:'openAnalysisInEditor'}));
applyBtn.addEventListener('click',()=>vscode.postMessage({command:'applyAnalysisToDocument'}));
window.addEventListener('message',(event)=>{const message=event.data;if(!message?.command)return;
if(message.command==='status'){statusEl.textContent=message.message;return;}
if(message.command==='urlChanged'){document.getElementById('url-input').value=message.url;statusEl.textContent=message.url;return;}
if(message.command==='selectionCaptured'){selectorEl.textContent=message.selector;summaryEl.textContent=strings.waiting;originalEl.textContent=message.originalCode;improvedEl.textContent='';warningsEl.style.display='none';return;}
if(message.command==='analysisResult'){selectorEl.textContent=message.selector;summaryEl.textContent=message.summary;originalEl.textContent=message.originalCode;improvedEl.textContent=message.improvedCode;openEditorBtn.disabled=false;applyBtn.disabled=!message.canApply;if(message.warnings&&message.warnings.length){warningsEl.style.display='block';warningsEl.textContent=message.warnings.join(' ');}else{warningsEl.style.display='none';warningsEl.textContent='';}return;}
if(message.command==='analysisError'){statusEl.textContent=message.message;summaryEl.textContent=message.message;warningsEl.style.display='block';warningsEl.textContent=message.message;}}
);
</script>
</body>
</html>`;
    }

    public async dispose(): Promise<void> {
        BrowserInspectorPanel.currentPanel = undefined;
        await this.chromeBridge.close();
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }
}
