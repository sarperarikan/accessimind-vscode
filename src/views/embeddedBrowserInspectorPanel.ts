import * as vscode from "vscode";

import { AIProviderManager } from "../utils/aiProvider";
import { normalizeGeneratedCode } from "../utils/codeGenerationUtils";
import { LocalizationManager } from "../utils/localizationManager";
import { logger } from "../utils/logger";
import { StatisticsManager } from "../utils/statisticsManager";

interface EmbeddedBrowserInspectorOptions {
    aiProviderManager: AIProviderManager;
    localization: LocalizationManager;
    statisticsManager: StatisticsManager;
}

interface EmbeddedBrowserSource {
    documentUri?: vscode.Uri;
    htmlContent?: string;
    targetUrl: string;
}

interface EmbeddedSelectionPayload {
    outerHTML: string;
    selector: string;
    tagName: string;
    textPreview: string;
    parentChain: string[];
    contextHtml: string;
    pageUrl: string;
}

interface AnalysisState {
    originalSnippet: string;
    improvedCode: string;
}

const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const localize = (localization: LocalizationManager, en: string, tr: string): string =>
    localization.getCurrentLanguage() === "tr" ? tr : en;

const EMBEDDED_SELECTION_SCRIPT = `
(() => {
  if (window.__accessimindEmbeddedInstalled) return;
  window.__accessimindEmbeddedInstalled = true;
  let pickMode = false;
  let hovered = null;
  const ignored = new Set(["HTML","BODY","HEAD","META","LINK","SCRIPT","STYLE"]);

  function isInspectable(node) {
    return !!node && node.tagName && !ignored.has(node.tagName);
  }

  function selectorFor(element) {
    if (element.id) return "#" + element.id;
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        part += "." + Array.from(node.classList).slice(0, 2).join(".");
      }
      if (node.parentElement) {
        const siblings = Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName);
        const index = siblings.indexOf(node);
        if (index >= 0) {
          part += ":nth-of-type(" + (index + 1) + ")";
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function parentChainFor(element) {
    const chain = [];
    let current = element;
    while (current && current.nodeType === 1 && chain.length < 6) {
      chain.unshift(current.tagName.toLowerCase());
      current = current.parentElement;
    }
    return chain;
  }

  function clearHover() {
    if (!hovered) return;
    hovered.style.outline = hovered.dataset.accessimindOutline || "";
    delete hovered.dataset.accessimindOutline;
    hovered = null;
  }

  document.addEventListener("mouseover", (event) => {
    if (!pickMode) return;
    const element = event.target && event.target.closest ? event.target.closest("*") : null;
    if (!isInspectable(element) || element === hovered) return;
    clearHover();
    hovered = element;
    hovered.dataset.accessimindOutline = hovered.style.outline || "";
    hovered.style.outline = "2px solid #f97316";
  }, true);

  document.addEventListener("mouseout", (event) => {
    if (!hovered || !event.relatedTarget || hovered.contains(event.relatedTarget)) return;
    clearHover();
  }, true);

  document.addEventListener("click", (event) => {
    if (!pickMode) return;
    const element = event.target && event.target.closest ? event.target.closest("*") : null;
    if (!isInspectable(element)) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = {
      outerHTML: element.outerHTML,
      selector: selectorFor(element),
      tagName: element.tagName.toLowerCase(),
      textPreview: (element.textContent || "").trim().slice(0, 160),
      parentChain: parentChainFor(element),
      contextHtml: (element.parentElement ? element.parentElement.outerHTML : element.outerHTML).slice(0, 6000),
      pageUrl: location.href
    };
    window.parent.postMessage({ type: "accessimind-selection", payload }, "*");
  }, true);

  window.__accessimindSetPickMode = function(enabled) {
    pickMode = !!enabled;
    if (!pickMode) clearHover();
    return pickMode;
  };
})();
`;

export class EmbeddedBrowserInspectorPanel {
    public static currentPanel: EmbeddedBrowserInspectorPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly aiProviderManager: AIProviderManager;
    private readonly localization: LocalizationManager;
    private readonly statisticsManager: StatisticsManager;
    private source: EmbeddedBrowserSource;
    private currentRenderedHtml = "";
    private lastAnalysis: AnalysisState | undefined;

    public static createOrShow(
        source: EmbeddedBrowserSource,
        options: EmbeddedBrowserInspectorOptions
    ): void {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (EmbeddedBrowserInspectorPanel.currentPanel) {
            EmbeddedBrowserInspectorPanel.currentPanel.source = source;
            EmbeddedBrowserInspectorPanel.currentPanel.lastAnalysis = undefined;
            EmbeddedBrowserInspectorPanel.currentPanel.panel.reveal(column);
            void EmbeddedBrowserInspectorPanel.currentPanel.loadSource();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "accessimindEmbeddedBrowserInspector",
            "AccessiMind Browser Inspector",
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        EmbeddedBrowserInspectorPanel.currentPanel = new EmbeddedBrowserInspectorPanel(panel, source, options);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        source: EmbeddedBrowserSource,
        options: EmbeddedBrowserInspectorOptions
    ) {
        this.panel = panel;
        this.source = source;
        this.aiProviderManager = options.aiProviderManager;
        this.localization = options.localization;
        this.statisticsManager = options.statisticsManager;

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => void this.handleMessage(message), null, this.disposables);
        this.renderShell();
        void this.loadSource();
    }

    private renderShell(): void {
        const strings = {
            title: localize(this.localization, "Embedded Browser Inspector", "Gomulu Tarayici Denetleyici"),
            subtitle: localize(
                this.localization,
                "Load a URL or the current HTML file, enable Select Element, then click an element inside the preview.",
                "Bir URL veya mevcut HTML dosyasini yukleyin, Element Sec modunu acin ve onizleme icinde bir elemente tiklayin."
            ),
            status: localize(this.localization, "Status", "Durum"),
            openUrl: localize(this.localization, "Open URL", "URL Ac"),
            selectElement: localize(this.localization, "Select Element", "Element Sec"),
            stopSelecting: localize(this.localization, "Stop Selecting", "Secimi Durdur"),
            waiting: localize(this.localization, "Waiting for page content...", "Sayfa icerigi bekleniyor..."),
            selector: localize(this.localization, "Selected element", "Secilen element"),
            summary: localize(this.localization, "Summary", "Ozet"),
            original: localize(this.localization, "Original snippet", "Orijinal parca"),
            improved: localize(this.localization, "Improved snippet", "Iyilestirilmis parca"),
            openEditor: localize(this.localization, "Open in editor", "Editor'de ac"),
            apply: localize(this.localization, "Apply exact replacement", "Birebir degisikligi uygula"),
            applyDisabled: localize(
                this.localization,
                "Apply works only when the source is the current local HTML document and the original snippet matches exactly.",
                "Uygulama sadece kaynak mevcut yerel HTML belgeyse ve orijinal parca birebir eslesiyorsa calisir."
            )
        };

        const stringsJson = escapeHtml(JSON.stringify(strings));
        const currentUrl = escapeHtml(this.source.targetUrl);

        this.panel.title = strings.title;
        this.panel.webview.html = `<!DOCTYPE html>
<html lang="${this.localization.getCurrentLanguage() === "tr" ? "tr" : "en"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(strings.title)}</title>
<style>
body{margin:0;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
.shell{display:grid;grid-template-columns:minmax(340px,1.1fr) minmax(320px,.9fr);height:100vh}
.preview,.analysis{padding:16px;overflow:auto}
.analysis{border-left:1px solid var(--vscode-panel-border)}
.card{border:1px solid var(--vscode-panel-border);border-radius:12px;background:var(--vscode-sideBar-background);padding:14px;margin-bottom:14px}
.card h2{margin:0 0 8px;font-size:14px}
.card p{margin:0;line-height:1.5;color:var(--vscode-descriptionForeground)}
.row{display:flex;gap:8px;flex-wrap:wrap}
input{flex:1;padding:10px;border:1px solid var(--vscode-panel-border);border-radius:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground)}
button{border:1px solid var(--vscode-panel-border);background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:10px 12px;border-radius:8px;cursor:pointer}
iframe{width:100%;height:calc(100vh - 200px);border:1px solid var(--vscode-panel-border);border-radius:12px;background:#fff}
pre{white-space:pre-wrap;font-family:Consolas,monospace;font-size:12px;background:rgba(15,23,42,.82);color:#e2e8f0;padding:12px;border-radius:10px;overflow:auto;max-height:280px}
.status{padding:10px;border-radius:8px;background:rgba(59,130,246,.14);color:#bfdbfe}
.warning{padding:10px;border-radius:8px;background:rgba(245,158,11,.15);color:#fbbf24}
@media (max-width:1100px){.shell{grid-template-columns:1fr}.analysis{border-left:none;border-top:1px solid var(--vscode-panel-border)}iframe{height:420px}}
</style>
</head>
<body>
<div class="shell">
<section class="preview">
<div class="card">
<h2>${escapeHtml(strings.title)}</h2>
<p>${escapeHtml(strings.subtitle)}</p>
<div class="row" style="margin-top:10px">
<input id="url-input" type="text" value="${currentUrl}" aria-label="URL">
<button id="open-url" type="button">${escapeHtml(strings.openUrl)}</button>
<button id="toggle-pick" type="button">${escapeHtml(strings.selectElement)}</button>
</div>
</div>
<div class="card"><h2>${escapeHtml(strings.status)}</h2><div id="status" class="status">${escapeHtml(strings.waiting)}</div></div>
<iframe id="preview-frame" sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups"></iframe>
</section>
<section class="analysis">
<div class="card"><h2>${escapeHtml(strings.selector)}</h2><p id="selector">${escapeHtml(strings.waiting)}</p></div>
<div class="card"><h2>${escapeHtml(strings.summary)}</h2><p id="summary">${escapeHtml(strings.waiting)}</p></div>
<div class="card"><h2>${escapeHtml(strings.original)}</h2><pre id="original">${escapeHtml(strings.waiting)}</pre></div>
<div class="card"><h2>${escapeHtml(strings.improved)}</h2><pre id="improved">${escapeHtml(strings.waiting)}</pre><div id="warnings" class="warning" style="display:none;margin-top:10px;"></div></div>
<div class="card"><div class="row"><button id="open-editor" type="button" disabled>${escapeHtml(strings.openEditor)}</button><button id="apply" type="button" disabled>${escapeHtml(strings.apply)}</button></div><p style="margin-top:10px;">${escapeHtml(strings.applyDisabled)}</p></div>
</section>
</div>
<script>
const vscode = acquireVsCodeApi();
const strings = JSON.parse('${stringsJson}');
const frame = document.getElementById('preview-frame');
const statusEl = document.getElementById('status');
const selectorEl = document.getElementById('selector');
const summaryEl = document.getElementById('summary');
const originalEl = document.getElementById('original');
const improvedEl = document.getElementById('improved');
const warningsEl = document.getElementById('warnings');
const openEditorBtn = document.getElementById('open-editor');
const applyBtn = document.getElementById('apply');
const togglePickBtn = document.getElementById('toggle-pick');
let pickMode = false;

document.getElementById('open-url').addEventListener('click', () => {
  vscode.postMessage({ command: 'loadUrl', url: document.getElementById('url-input').value });
});
togglePickBtn.addEventListener('click', () => {
  pickMode = !pickMode;
  togglePickBtn.textContent = pickMode ? strings.stopSelecting : strings.selectElement;
  if (frame.contentWindow) {
    frame.contentWindow.postMessage({ type: 'accessimind-toggle-pick', enabled: pickMode }, '*');
  }
});
openEditorBtn.addEventListener('click', () => vscode.postMessage({ command: 'openAnalysisInEditor' }));
applyBtn.addEventListener('click', () => vscode.postMessage({ command: 'applyAnalysisToDocument' }));
window.addEventListener('message', (event) => {
  if (event.data?.type === 'accessimind-selection') {
    vscode.postMessage({ command: 'analyzeSelection', payload: event.data.payload });
    pickMode = false;
    togglePickBtn.textContent = strings.selectElement;
    return;
  }
  const message = event.data;
  if (!message?.command) return;
  if (message.command === 'renderHtml') {
    frame.srcdoc = message.html;
    statusEl.textContent = message.url || strings.waiting;
    document.getElementById('url-input').value = message.url || '';
    return;
  }
  if (message.command === 'status') { statusEl.textContent = message.message; return; }
  if (message.command === 'selectionCaptured') {
    selectorEl.textContent = message.selector;
    summaryEl.textContent = strings.waiting;
    originalEl.textContent = message.originalCode;
    improvedEl.textContent = '';
    warningsEl.style.display = 'none';
    return;
  }
  if (message.command === 'analysisResult') {
    selectorEl.textContent = message.selector;
    summaryEl.textContent = message.summary;
    originalEl.textContent = message.originalCode;
    improvedEl.textContent = message.improvedCode;
    openEditorBtn.disabled = false;
    applyBtn.disabled = !message.canApply;
    if (message.warnings && message.warnings.length) {
      warningsEl.style.display = 'block';
      warningsEl.textContent = message.warnings.join(' ');
    } else {
      warningsEl.style.display = 'none';
      warningsEl.textContent = '';
    }
    return;
  }
  if (message.command === 'analysisError') {
    statusEl.textContent = message.message;
    summaryEl.textContent = message.message;
    warningsEl.style.display = 'block';
    warningsEl.textContent = message.message;
  }
});
</script>
</body>
</html>`;
    }

    private async loadSource(): Promise<void> {
        try {
            const html = await this.resolveHtml(this.source);
            this.currentRenderedHtml = html;
            void this.panel.webview.postMessage({
                command: "renderHtml",
                html,
                url: this.source.targetUrl
            });
        } catch (error) {
            logger.error("Embedded browser load failed:", error);
            void this.panel.webview.postMessage({
                command: "analysisError",
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async resolveHtml(source: EmbeddedBrowserSource): Promise<string> {
        const rawHtml = source.htmlContent ?? await this.fetchRemoteHtml(source.targetUrl);
        const baseHref = escapeHtml(source.targetUrl);
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<base href="${baseHref}">
</head>
<body>
${rawHtml}
<script>
${EMBEDDED_SELECTION_SCRIPT}
window.addEventListener('message', (event) => {
  if (event.data?.type === 'accessimind-toggle-pick' && window.__accessimindSetPickMode) {
    window.__accessimindSetPickMode(!!event.data.enabled);
  }
});
</script>
</body>
</html>`;
    }

    private async fetchRemoteHtml(targetUrl: string): Promise<string> {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "AccessiMind Embedded Inspector"
            }
        });

        if (!response.ok) {
            throw new Error(`Unable to load URL: ${response.status} ${response.statusText}`);
        }

        return await response.text();
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case "loadUrl":
                await this.loadUrl(String(message.url || ""));
                return;
            case "analyzeSelection":
                await this.handleSelection(message.payload as EmbeddedSelectionPayload);
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

        this.source = {
            targetUrl: /^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
        };
        this.lastAnalysis = undefined;
        await this.loadSource();
    }

    private async handleSelection(payload: EmbeddedSelectionPayload): Promise<void> {
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
            logger.error("Embedded browser selection analysis failed:", error);
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
        const sourceText = document.getText();
        const start = sourceText.indexOf(this.lastAnalysis.originalSnippet);
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
    }

    public dispose(): void {
        EmbeddedBrowserInspectorPanel.currentPanel = undefined;
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }
}
