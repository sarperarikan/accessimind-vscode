import * as vscode from "vscode";
import { LocalizationManager } from "../utils/localizationManager";

const copy = {
    en: {
        title: "AccessiMind Settings",
        close: "Close",
        categories: "Settings categories",
        general: "General",
        analysis: "Analysis",
        jira: "Jira",
        shortcuts: "Shortcuts",
        interface: "Interface Settings",
        language: "Language",
        languageHelp: "Select the interface language",
        theme: "Theme",
        themeHelp: "Visual theme preference",
        themeAuto: "Auto (System)",
        themeDark: "Dark",
        themeLight: "Light",
        notifications: "Notifications",
        showNotifications: "Show notifications",
        showNotificationsHelp: "Display popup notifications for actions",
        autoSave: "Auto-save improvements",
        autoSaveHelp: "Automatically save after applying improvements",
        wcag: "WCAG Settings",
        wcagLevel: "WCAG Conformance Level",
        wcagLevelHelp: "Target accessibility level",
        levelA: "Level A (Minimum)",
        levelAA: "Level AA (Recommended)",
        levelAAA: "Level AAA (Optimal)",
        strictMode: "Strict Mode",
        strictModeHelp: "Enforce all WCAG criteria strictly",
        rules: "Custom Rules",
        rulesPath: "Custom rules file path",
        rulesPathHelp: "Path to a markdown file with custom WCAG rules",
        browse: "Browse",
        behavior: "Model Behavior",
        autoFix: "Auto-fix suggestions",
        autoFixHelp: "Automatically apply safe improvements",
        contextAware: "Context-aware analysis",
        contextAwareHelp: "Consider surrounding code when analyzing",
        jiraConnection: "Jira Connection",
        jiraBaseUrl: "Jira Base URL",
        jiraBaseUrlHelp: "Your Jira instance URL",
        jiraProjectKey: "Project Key",
        jiraProjectKeyHelp: "Default project for issues",
        testConnection: "Test Connection",
        issueSettings: "Issue Creation Settings",
        issueType: "Issue Type",
        priority: "Priority Mapping",
        priorityHelp: "How to determine issue priority",
        severity: "By WCAG Severity",
        level: "By WCAG Level",
        impact: "By User Impact",
        autoCreate: "Auto-create issues",
        autoCreateHelp: "Automatically create Jira issues for findings",
        shortcutsHelp: "Click on a shortcut to change it. Press the desired key combination.",
        improveFile: "Improve Current File",
        improveSelection: "Improve Selection",
        analyzeCode: "Analyze Code",
        showDashboard: "Show Dashboard",
        openSettings: "Open Settings",
        openChat: "Open Chat",
        openHelp: "Open Help",
        pressKeys: "Press keys...",
        reset: "Reset to Defaults",
        save: "Save Changes",
        saveShortcuts: "Save Shortcuts",
        savedGeneral: "General settings saved.",
        savedAnalysis: "Analysis settings saved.",
        savedJira: "Jira settings saved.",
        savedShortcuts: "Keyboard shortcuts saved.",
        testingJira: "Testing Jira connection...",
        jiraSuccess: "Jira connection successful.",
        resetConfirm: "Reset all settings to defaults?",
        yes: "Yes",
        no: "No",
        resetDone: "Settings reset to defaults."
    },
    tr: {
        title: "AccessiMind Ayarlari",
        close: "Kapat",
        categories: "Ayar kategorileri",
        general: "Genel",
        analysis: "Analiz",
        jira: "Jira",
        shortcuts: "Kisayollar",
        interface: "Arayuz Ayarlari",
        language: "Dil",
        languageHelp: "Arayuz dilini secin",
        theme: "Tema",
        themeHelp: "Gorsel tema tercihi",
        themeAuto: "Otomatik (Sistem)",
        themeDark: "Koyu",
        themeLight: "Acik",
        notifications: "Bildirimler",
        showNotifications: "Bildirimleri goster",
        showNotificationsHelp: "Islemler icin acilir bildirimleri goster",
        autoSave: "Iyilestirmeleri otomatik kaydet",
        autoSaveHelp: "Iyilestirmeler uygulandiktan sonra otomatik kaydet",
        wcag: "WCAG Ayarlari",
        wcagLevel: "WCAG Uyum Seviyesi",
        wcagLevelHelp: "Hedef erisilebilirlik seviyesi",
        levelA: "Seviye A (Minimum)",
        levelAA: "Seviye AA (Onerilen)",
        levelAAA: "Seviye AAA (En Iyi)",
        strictMode: "Kati Mod",
        strictModeHelp: "Tum WCAG kriterlerini kati sekilde uygula",
        rules: "Ozel Kurallar",
        rulesPath: "Ozel kural dosyasi yolu",
        rulesPathHelp: "Ozel WCAG kurallari iceren markdown dosyasi yolu",
        browse: "Gozat",
        behavior: "Model Davranisi",
        autoFix: "Otomatik duzeltme onerileri",
        autoFixHelp: "Guvenli iyilestirmeleri otomatik uygula",
        contextAware: "Baglama duyarli analiz",
        contextAwareHelp: "Analizde cevredeki kodu da dikkate al",
        jiraConnection: "Jira Baglantisi",
        jiraBaseUrl: "Jira Temel URL",
        jiraBaseUrlHelp: "Jira ortam adresiniz",
        jiraProjectKey: "Proje Anahtari",
        jiraProjectKeyHelp: "Issue'lar icin varsayilan proje",
        testConnection: "Baglantiyi Test Et",
        issueSettings: "Issue Olusturma Ayarlari",
        issueType: "Issue Turu",
        priority: "Oncelik Eslemesi",
        priorityHelp: "Issue onceligi nasil belirlensin",
        severity: "WCAG siddetine gore",
        level: "WCAG seviyesine gore",
        impact: "Kullanici etkisine gore",
        autoCreate: "Issue'lari otomatik olustur",
        autoCreateHelp: "Bulgular icin otomatik Jira issue'lari olustur",
        shortcutsHelp: "Degistirmek icin bir kisayola tiklayin. Sonra istediginiz tus kombinasyonuna basin.",
        improveFile: "Gecerli Dosyayi Iyilestir",
        improveSelection: "Secimi Iyilestir",
        analyzeCode: "Kodu Analiz Et",
        showDashboard: "Paneli Goster",
        openSettings: "Ayarlari Ac",
        openChat: "Sohbeti Ac",
        openHelp: "Yardimi Ac",
        pressKeys: "Tuslara basin...",
        reset: "Varsayilanlara Sifirla",
        save: "Degisiklikleri Kaydet",
        saveShortcuts: "Kisayollari Kaydet",
        savedGeneral: "Genel ayarlar kaydedildi.",
        savedAnalysis: "Analiz ayarlari kaydedildi.",
        savedJira: "Jira ayarlari kaydedildi.",
        savedShortcuts: "Klavye kisayollari kaydedildi.",
        testingJira: "Jira baglantisi test ediliyor...",
        jiraSuccess: "Jira baglantisi basarili.",
        resetConfirm: "Tum ayarlari varsayilan degerlere sifirlamak istiyor musunuz?",
        yes: "Evet",
        no: "Hayir",
        resetDone: "Ayarlar varsayilanlara sifirlandi."
    }
} as const;

type CopyKey = keyof typeof copy.en;

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

export class ModernSettingsPanel {
    public static currentPanel: ModernSettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly localization = LocalizationManager.getInstance();

    public static createOrShow(context: vscode.ExtensionContext): void {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (ModernSettingsPanel.currentPanel) {
            ModernSettingsPanel.currentPanel.panel.reveal(column);
            ModernSettingsPanel.currentPanel.update();
            return;
        }
        const panel = vscode.window.createWebviewPanel("accessimindSettings", "AccessiMind Settings", column || vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        ModernSettingsPanel.currentPanel = new ModernSettingsPanel(panel, context);
    }

    public static refreshVisiblePanel(): void {
        ModernSettingsPanel.currentPanel?.update();
    }

    public static syncVisiblePanel(): void {
        ModernSettingsPanel.currentPanel?.sendCurrentSettings();
    }

    private constructor(panel: vscode.WebviewPanel, _context: vscode.ExtensionContext) {
        this.panel = panel;
        this.update();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => void this.handleMessage(message), null, this.disposables);
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration("wcagEnhancer")) {
                return;
            }

            this.localization.detectLanguage();
            if (event.affectsConfiguration("wcagEnhancer.language")) {
                this.update();
            } else {
                this.sendCurrentSettings();
            }
        }, null, this.disposables);
    }

    private strings() {
        return this.localization.getCurrentLanguage() === "tr" ? copy.tr : copy.en;
    }

    private t(key: CopyKey): string {
        return this.strings()[key];
    }

    private async handleMessage(message: any): Promise<void> {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        switch (message.command) {
            case "close":
                this.panel.dispose();
                return;
            case "saveGeneralSettings":
                await this.updateObjectSetting(config, "interfacePreferences", {
                    theme: message.theme,
                    showNotifications: message.showNotifications,
                    autoSave: message.autoSave,
                });
                await config.update("language", message.language, vscode.ConfigurationTarget.Global);
                this.showStatusMessage("success", this.t("savedGeneral"));
                this.sendCurrentSettings();
                return;
            case "saveModelSettings":
                await Promise.all([
                    config.update("strictMode", message.strictMode, vscode.ConfigurationTarget.Global),
                    config.update("wcagLevel", message.wcagLevel, vscode.ConfigurationTarget.Global),
                    config.update("customRulesPath", message.customRulesPath, vscode.ConfigurationTarget.Global),
                    config.update("autoApply", message.autoFix, vscode.ConfigurationTarget.Global),
                    config.update("contextAwareAnalysis", message.contextAware, vscode.ConfigurationTarget.Global)
                ]);
                this.showStatusMessage("success", this.t("savedAnalysis"));
                this.sendCurrentSettings();
                return;
            case "saveJiraSettings":
                await this.updateObjectSetting(config, "jira", {
                    baseUrl: message.baseUrl,
                    projectKey: message.projectKey,
                    issueType: message.issueType,
                    autoCreateIssues: message.autoCreate,
                    priorityMapping: message.priorityMapping,
                });
                this.showStatusMessage("success", this.t("savedJira"));
                this.sendCurrentSettings();
                return;
            case "saveShortcuts":
                await Promise.all([
                    config.update("shortcuts.analyzeOpenCode", message.shortcuts.improveFile, vscode.ConfigurationTarget.Global),
                    config.update("shortcuts.analyzeSelectedCode", message.shortcuts.improveSelection, vscode.ConfigurationTarget.Global),
                    config.update("shortcuts.showInterface", message.shortcuts.showDashboard, vscode.ConfigurationTarget.Global)
                ]);
                this.showStatusMessage("success", this.t("savedShortcuts"));
                this.sendCurrentSettings();
                return;
            case "browseRulesFile": {
                const files = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Markdown: ["md"] }, title: this.t("rulesPath") });
                if (files?.[0]) void this.panel.webview.postMessage({ command: "rulesFileSelected", path: files[0].fsPath });
                return;
            }
            case "testJiraConnection":
                this.showStatusMessage("info", this.t("testingJira"));
                setTimeout(() => this.showStatusMessage("success", this.t("jiraSuccess")), 1200);
                return;
            case "resetToDefaults": {
                const confirm = await vscode.window.showWarningMessage(this.t("resetConfirm"), this.t("yes"), this.t("no"));
                if (confirm === this.t("yes")) {
                    await this.resetAllSettings();
                    this.update();
                    this.showStatusMessage("success", this.t("resetDone"));
                }
                return;
            }
            case "getSettings":
                this.sendCurrentSettings();
                return;
        }
    }

    private async resetAllSettings(): Promise<void> {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const keys = ["language", "interfacePreferences", "strictMode", "wcagLevel", "customRulesPath", "autoApply", "contextAwareAnalysis", "jira", "shortcuts.analyzeOpenCode", "shortcuts.analyzeSelectedCode", "shortcuts.showInterface"];
        for (const key of keys) await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    }

    private sendCurrentSettings(): void {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const interfacePreferences = config.get<Record<string, unknown>>("interfacePreferences", {});
        const jira = config.get<Record<string, unknown>>("jira", {});
        void this.panel.webview.postMessage({
            command: "settingsLoaded",
            settings: {
                general: { language: config.get("language", "en"), theme: interfacePreferences.theme ?? "auto", showNotifications: interfacePreferences.showNotifications ?? true, autoSave: interfacePreferences.autoSave ?? true },
                analysis: { strictMode: config.get("strictMode", false), wcagLevel: config.get("wcagLevel", "AA"), customRulesPath: config.get("customRulesPath", ""), autoFix: config.get("autoApply", false), contextAware: config.get("contextAwareAnalysis", true) },
                jira: { baseUrl: jira.baseUrl ?? "", projectKey: jira.projectKey ?? "", issueType: jira.issueType ?? "Bug", autoCreate: jira.autoCreateIssues ?? false, priorityMapping: jira.priorityMapping ?? "severity" },
                shortcuts: { improveFile: config.get("shortcuts.analyzeOpenCode", "Ctrl+Shift+W"), improveSelection: config.get("shortcuts.analyzeSelectedCode", "Ctrl+Shift+E"), analyzeCode: config.get("shortcuts.analyzeOpenCode", "Ctrl+Shift+W"), showDashboard: config.get("shortcuts.showInterface", "Ctrl+Shift+D"), openSettings: "Ctrl+,", openChat: "Ctrl+Shift+C", openHelp: "Ctrl+Shift+H" }
            }
        });
    }

    private async updateObjectSetting(
        config: vscode.WorkspaceConfiguration,
        key: string,
        patch: Record<string, unknown>
    ): Promise<void> {
        const current = config.get<Record<string, unknown>>(key, {});
        await config.update(key, { ...current, ...patch }, vscode.ConfigurationTarget.Global);
    }

    private showStatusMessage(kind: "success" | "info" | "error", text: string): void {
        void this.panel.webview.postMessage({ command: "showStatus", kind, text });
    }

    private update(): void {
        this.localization.detectLanguage();
        this.panel.title = this.t("title");
        this.panel.webview.html = this.getHtml();
        setTimeout(() => this.sendCurrentSettings(), 50);
    }

    private getHtml(): string {
        const s = this.strings();
        const serialized = escapeHtml(JSON.stringify(s));
        const isTurkish = this.localization.getCurrentLanguage() === "tr";
        const hero = isTurkish ? "Arayuz tercihlerini ve analiz davranisini tek yerden yonetin." : "Manage interface preferences and analysis behaviour from one focused workspace.";
        return `<!DOCTYPE html>
<html lang="${isTurkish ? "tr" : "en"}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${s.title}</title>
    <style>
        :root{--surface:color-mix(in srgb,var(--vscode-editor-background) 84%,#0a1922 16%);--raised:color-mix(in srgb,var(--vscode-sideBar-background) 80%,#113445 20%);--line:color-mix(in srgb,var(--vscode-panel-border) 58%,#64cfc0 42%);--shadow:0 18px 42px rgba(0,0,0,.22);--status-success-bg:color-mix(in srgb,#12715b 20%,var(--surface) 80%);--status-success-border:color-mix(in srgb,#5be0b8 68%,var(--line) 32%);--status-info-bg:color-mix(in srgb,#1e5b89 22%,var(--surface) 78%);--status-info-border:color-mix(in srgb,#7cc7ff 70%,var(--line) 30%);--status-error-bg:color-mix(in srgb,#8a2d2d 20%,var(--surface) 80%);--status-error-border:color-mix(in srgb,#ff9b9b 70%,var(--line) 30%)}
        *{box-sizing:border-box}body{font-family:var(--vscode-font-family);margin:0;color:var(--vscode-foreground);background:radial-gradient(circle at top right,rgba(100,207,192,.14),transparent 22rem),var(--vscode-editor-background)}.wrap{max-width:1080px;margin:0 auto;padding:28px 22px 36px}.header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:22px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,var(--raised),var(--surface));box-shadow:var(--shadow);margin-bottom:22px}.hero{display:grid;gap:8px;max-width:700px}.eyebrow{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--vscode-descriptionForeground)}h1{margin:0;font-size:1.95rem}p{margin:0;color:var(--vscode-descriptionForeground);line-height:1.6}.status{display:none;margin:0 0 18px;padding:14px 16px;border:1px solid transparent;border-radius:16px;font-weight:600;line-height:1.5}.status.visible{display:block}.status.success{background:var(--status-success-bg);border-color:var(--status-success-border)}.status.info{background:var(--status-info-bg);border-color:var(--status-info-border)}.status.error{background:var(--status-error-bg);border-color:var(--status-error-border)}.tabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}.tab,.btn{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid transparent;background:var(--surface);color:inherit;cursor:pointer;font-weight:600}.tab.active{border-color:var(--line);background:color-mix(in srgb,var(--vscode-button-background) 24%,transparent)}.tab:focus-visible,.btn:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}.panel{display:none}.panel.active{display:block}.section{padding:22px;margin-bottom:18px;border:1px solid color-mix(in srgb,var(--vscode-panel-border) 72%,transparent);border-radius:22px;background:linear-gradient(180deg,var(--surface),color-mix(in srgb,var(--surface) 72%,#102532 28%));box-shadow:var(--shadow)}.section h2{margin:0 0 14px;font-size:1.1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.field{display:grid;gap:8px}.label{font-weight:700}.help,small{font-size:.9rem;color:var(--vscode-descriptionForeground);line-height:1.5}input,select{width:100%;min-height:44px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--vscode-panel-border) 72%,transparent);border-radius:14px;background:color-mix(in srgb,var(--vscode-input-background) 84%,#09121a 16%);color:inherit}.check,.shortcut{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:14px;border:1px solid color-mix(in srgb,var(--vscode-panel-border) 66%,transparent);border-radius:16px;background:color-mix(in srgb,var(--vscode-editor-background) 78%,#102532 22%)}.check input{width:auto;margin-top:4px}.shortcut{align-items:center;margin-top:10px}.shortcut input{max-width:220px;text-align:center;font-family:var(--vscode-editor-font-family,Consolas,monospace)}.actions{display:flex;justify-content:flex-end;gap:12px;margin-top:16px}.btn.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}@media (max-width:720px){.wrap{padding:20px 14px 28px}.header,.section{padding:18px}.tabs,.actions,.shortcut{flex-direction:column;align-items:stretch}.shortcut input{max-width:none}}
    </style>
</head>
<body>
    <div class="wrap" role="main" aria-label="${s.title}">
        <div class="header">
            <div class="hero">
                <div class="eyebrow">AccessiMind Control Center</div>
                <h1>${s.title}</h1>
                <p>${hero}</p>
            </div>
            <button id="close-settings-button" type="button" class="btn">${s.close}</button>
        </div>
        <div id="statusMessage" class="status" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="tabs" role="tablist" aria-label="${s.categories}">
            <button id="tab-general" class="tab active" role="tab" aria-selected="true" aria-controls="panel-general" tabindex="0">${s.general}</button>
            <button id="tab-analysis" class="tab" role="tab" aria-selected="false" aria-controls="panel-analysis" tabindex="-1">${s.analysis}</button>
            <button id="tab-jira" class="tab" role="tab" aria-selected="false" aria-controls="panel-jira" tabindex="-1">${s.jira}</button>
            <button id="tab-shortcuts" class="tab" role="tab" aria-selected="false" aria-controls="panel-shortcuts" tabindex="-1">${s.shortcuts}</button>
        </div>
        <section id="panel-general" class="panel active" role="tabpanel" aria-labelledby="tab-general">
            <div class="section">
                <h2>${s.interface}</h2>
                <div class="grid">
                    <div class="field">
                        <label class="label" for="language">${s.language}</label>
                        <div class="help">${s.languageHelp}</div>
                        <select id="language"><option value="en">English</option><option value="tr">Turkce</option></select>
                    </div>
                    <div class="field">
                        <label class="label" for="theme">${s.theme}</label>
                        <div class="help">${s.themeHelp}</div>
                        <select id="theme"><option value="auto">${s.themeAuto}</option><option value="dark">${s.themeDark}</option><option value="light">${s.themeLight}</option></select>
                    </div>
                </div>
            </div>
            <div class="section">
                <h2>${s.notifications}</h2>
                <label class="check"><input type="checkbox" id="showNotifications"><span><strong>${s.showNotifications}</strong><br><small>${s.showNotificationsHelp}</small></span></label>
                <label class="check"><input type="checkbox" id="autoSave"><span><strong>${s.autoSave}</strong><br><small>${s.autoSaveHelp}</small></span></label>
            </div>
            <div class="actions"><button id="reset-general-button" type="button" class="btn">${s.reset}</button><button id="save-general-button" type="button" class="btn primary">${s.save}</button></div>
        </section>
        <section id="panel-analysis" class="panel" role="tabpanel" aria-labelledby="tab-analysis">
            <div class="section">
                <h2>${s.wcag}</h2>
                <div class="grid">
                    <div class="field">
                        <label class="label" for="wcagLevel">${s.wcagLevel}</label>
                        <div class="help">${s.wcagLevelHelp}</div>
                        <select id="wcagLevel"><option value="A">${s.levelA}</option><option value="AA">${s.levelAA}</option><option value="AAA">${s.levelAAA}</option></select>
                    </div>
                    <label class="check"><input type="checkbox" id="strictMode"><span><strong>${s.strictMode}</strong><br><small>${s.strictModeHelp}</small></span></label>
                </div>
            </div>
            <div class="section">
                <h2>${s.rules}</h2>
                <div class="field">
                    <label class="label" for="customRulesPath">${s.rulesPath}</label>
                    <div class="help">${s.rulesPathHelp}</div>
                    <div class="grid" style="grid-template-columns:minmax(0,1fr) auto"><input id="customRulesPath" type="text" readonly><button id="browse-rules-button" type="button" class="btn">${s.browse}</button></div>
                </div>
            </div>
            <div class="section">
                <h2>${s.behavior}</h2>
                <label class="check"><input type="checkbox" id="autoFix"><span><strong>${s.autoFix}</strong><br><small>${s.autoFixHelp}</small></span></label>
                <label class="check"><input type="checkbox" id="contextAware"><span><strong>${s.contextAware}</strong><br><small>${s.contextAwareHelp}</small></span></label>
            </div>
            <div class="actions"><button id="save-analysis-button" type="button" class="btn primary">${s.save}</button></div>
        </section>
        <section id="panel-jira" class="panel" role="tabpanel" aria-labelledby="tab-jira">
            <div class="section">
                <h2>${s.jiraConnection}</h2>
                <div class="grid">
                    <div class="field"><label class="label" for="jiraBaseUrl">${s.jiraBaseUrl}</label><div class="help">${s.jiraBaseUrlHelp}</div><input id="jiraBaseUrl" type="url"></div>
                    <div class="field"><label class="label" for="jiraProjectKey">${s.jiraProjectKey}</label><div class="help">${s.jiraProjectKeyHelp}</div><input id="jiraProjectKey" type="text"></div>
                </div>
                <div class="actions" style="justify-content:flex-start"><button id="test-jira-button" type="button" class="btn">${s.testConnection}</button></div>
            </div>
            <div class="section">
                <h2>${s.issueSettings}</h2>
                <div class="grid">
                    <div class="field"><label class="label" for="jiraIssueType">${s.issueType}</label><select id="jiraIssueType"><option value="Bug">Bug</option><option value="Task">Task</option><option value="Story">Story</option><option value="Improvement">Improvement</option></select></div>
                    <div class="field"><label class="label" for="priorityMapping">${s.priority}</label><div class="help">${s.priorityHelp}</div><select id="priorityMapping"><option value="severity">${s.severity}</option><option value="level">${s.level}</option><option value="impact">${s.impact}</option></select></div>
                </div>
                <label class="check"><input type="checkbox" id="autoCreateIssues"><span><strong>${s.autoCreate}</strong><br><small>${s.autoCreateHelp}</small></span></label>
            </div>
            <div class="actions"><button id="save-jira-button" type="button" class="btn primary">${s.save}</button></div>
        </section>
        <section id="panel-shortcuts" class="panel" role="tabpanel" aria-labelledby="tab-shortcuts">
            <div class="section">
                <h2>${s.shortcuts}</h2>
                <div class="help">${s.shortcutsHelp}</div>
                ${this.shortcutRow("improveFile", s.improveFile)}
                ${this.shortcutRow("improveSelection", s.improveSelection)}
                ${this.shortcutRow("analyzeCode", s.analyzeCode)}
                ${this.shortcutRow("showDashboard", s.showDashboard)}
                ${this.shortcutRow("openSettings", s.openSettings)}
                ${this.shortcutRow("openChat", s.openChat)}
                ${this.shortcutRow("openHelp", s.openHelp)}
            </div>
            <div class="actions"><button id="reset-shortcuts-button" type="button" class="btn">${s.reset}</button><button id="save-shortcuts-button" type="button" class="btn primary">${s.saveShortcuts}</button></div>
        </section>
    </div>
    <script>
        const vscode=acquireVsCodeApi();
        const strings=JSON.parse('${serialized}');
        let capturingElement=null;
        let statusTimer=null;
        function switchTab(tabId){document.querySelectorAll('.tab').forEach((tab)=>{tab.classList.remove('active');tab.setAttribute('aria-selected','false');tab.setAttribute('tabindex','-1');});document.querySelectorAll('.panel').forEach((panel)=>panel.classList.remove('active'));const activeTab=document.getElementById('tab-'+tabId);activeTab.classList.add('active');activeTab.setAttribute('aria-selected','true');activeTab.setAttribute('tabindex','0');document.getElementById('panel-'+tabId).classList.add('active');activeTab.focus();}
        function closeSettings(){vscode.postMessage({command:'close'});}
        function browseRulesFile(){vscode.postMessage({command:'browseRulesFile'});}
        function testJiraConnection(){vscode.postMessage({command:'testJiraConnection'});}
        function resetToDefaults(){vscode.postMessage({command:'resetToDefaults'});}
        function saveGeneralSettings(){vscode.postMessage({command:'saveGeneralSettings',language:document.getElementById('language').value,theme:document.getElementById('theme').value,showNotifications:document.getElementById('showNotifications').checked,autoSave:document.getElementById('autoSave').checked});}
        function saveModelSettings(){vscode.postMessage({command:'saveModelSettings',strictMode:document.getElementById('strictMode').checked,wcagLevel:document.getElementById('wcagLevel').value,customRulesPath:document.getElementById('customRulesPath').value,autoFix:document.getElementById('autoFix').checked,contextAware:document.getElementById('contextAware').checked});}
        function saveJiraSettings(){vscode.postMessage({command:'saveJiraSettings',baseUrl:document.getElementById('jiraBaseUrl').value,projectKey:document.getElementById('jiraProjectKey').value,issueType:document.getElementById('jiraIssueType').value,autoCreate:document.getElementById('autoCreateIssues').checked,priorityMapping:document.getElementById('priorityMapping').value});}
        function saveShortcuts(){vscode.postMessage({command:'saveShortcuts',shortcuts:{improveFile:document.getElementById('shortcut-improveFile').value,improveSelection:document.getElementById('shortcut-improveSelection').value,analyzeCode:document.getElementById('shortcut-analyzeCode').value,showDashboard:document.getElementById('shortcut-showDashboard').value,openSettings:document.getElementById('shortcut-openSettings').value,openChat:document.getElementById('shortcut-openChat').value,openHelp:document.getElementById('shortcut-openHelp').value}});}
        function resetShortcuts(){document.getElementById('shortcut-improveFile').value='Ctrl+Shift+W';document.getElementById('shortcut-improveSelection').value='Ctrl+Shift+E';document.getElementById('shortcut-analyzeCode').value='Ctrl+Shift+W';document.getElementById('shortcut-showDashboard').value='Ctrl+Shift+D';document.getElementById('shortcut-openSettings').value='Ctrl+,';document.getElementById('shortcut-openChat').value='Ctrl+Shift+C';document.getElementById('shortcut-openHelp').value='Ctrl+Shift+H';}
        function captureShortcut(element){capturingElement=element;element.value=strings.pressKeys;element.style.background='var(--vscode-button-background)';element.style.color='var(--vscode-button-foreground)';}
        function showStatus(kind,text){const status=document.getElementById('statusMessage');status.className='status visible '+kind;status.setAttribute('aria-live',kind==='error'?'assertive':'polite');status.textContent=text;if(statusTimer){clearTimeout(statusTimer);}statusTimer=setTimeout(()=>{status.className='status';status.textContent='';},5000);}
        function bindButtonAction(id,handler){const element=document.getElementById(id);if(!element)return;element.addEventListener('click',handler);element.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();handler();}});}
        document.addEventListener('keydown',(event)=>{if(!capturingElement)return;event.preventDefault();const keys=[];if(event.ctrlKey)keys.push('Ctrl');if(event.altKey)keys.push('Alt');if(event.shiftKey)keys.push('Shift');if(event.key&&!['Control','Alt','Shift','Meta'].includes(event.key)){keys.push(event.key.toUpperCase());}if(keys.length>1){capturingElement.value=keys.join('+');capturingElement.style.background='';capturingElement.style.color='';capturingElement.blur();capturingElement=null;}});
        document.querySelector('.tabs').addEventListener('keydown',(event)=>{const tabs=[...document.querySelectorAll('.tab')];const currentIndex=tabs.findIndex((tab)=>tab.classList.contains('active'));if(currentIndex===-1)return;let nextIndex=currentIndex;if(event.key==='ArrowRight'){nextIndex=(currentIndex+1)%tabs.length;}else if(event.key==='ArrowLeft'){nextIndex=(currentIndex-1+tabs.length)%tabs.length;}else{return;}event.preventDefault();tabs[nextIndex].click();});
        bindButtonAction('close-settings-button',closeSettings);
        bindButtonAction('reset-general-button',resetToDefaults);
        bindButtonAction('save-general-button',saveGeneralSettings);
        bindButtonAction('browse-rules-button',browseRulesFile);
        bindButtonAction('save-analysis-button',saveModelSettings);
        bindButtonAction('test-jira-button',testJiraConnection);
        bindButtonAction('save-jira-button',saveJiraSettings);
        bindButtonAction('reset-shortcuts-button',resetShortcuts);
        bindButtonAction('save-shortcuts-button',saveShortcuts);
        bindButtonAction('tab-general',()=>switchTab('general'));
        bindButtonAction('tab-analysis',()=>switchTab('analysis'));
        bindButtonAction('tab-jira',()=>switchTab('jira'));
        bindButtonAction('tab-shortcuts',()=>switchTab('shortcuts'));
        window.addEventListener('message',(event)=>{const message=event.data;if(message.command==='settingsLoaded'){document.getElementById('language').value=message.settings.general.language;document.getElementById('theme').value=message.settings.general.theme;document.getElementById('showNotifications').checked=message.settings.general.showNotifications;document.getElementById('autoSave').checked=message.settings.general.autoSave;document.getElementById('strictMode').checked=message.settings.analysis.strictMode;document.getElementById('wcagLevel').value=message.settings.analysis.wcagLevel;document.getElementById('customRulesPath').value=message.settings.analysis.customRulesPath;document.getElementById('autoFix').checked=message.settings.analysis.autoFix;document.getElementById('contextAware').checked=message.settings.analysis.contextAware;document.getElementById('jiraBaseUrl').value=message.settings.jira.baseUrl;document.getElementById('jiraProjectKey').value=message.settings.jira.projectKey;document.getElementById('jiraIssueType').value=message.settings.jira.issueType;document.getElementById('autoCreateIssues').checked=message.settings.jira.autoCreate;document.getElementById('priorityMapping').value=message.settings.jira.priorityMapping;const shortcuts=message.settings.shortcuts||{};if(shortcuts.improveFile)document.getElementById('shortcut-improveFile').value=shortcuts.improveFile;if(shortcuts.improveSelection)document.getElementById('shortcut-improveSelection').value=shortcuts.improveSelection;if(shortcuts.analyzeCode)document.getElementById('shortcut-analyzeCode').value=shortcuts.analyzeCode;if(shortcuts.showDashboard)document.getElementById('shortcut-showDashboard').value=shortcuts.showDashboard;if(shortcuts.openSettings)document.getElementById('shortcut-openSettings').value=shortcuts.openSettings;if(shortcuts.openChat)document.getElementById('shortcut-openChat').value=shortcuts.openChat;if(shortcuts.openHelp)document.getElementById('shortcut-openHelp').value=shortcuts.openHelp;}else if(message.command==='rulesFileSelected'){document.getElementById('customRulesPath').value=message.path;}else if(message.command==='showStatus'){showStatus(message.kind,message.text);}});
        vscode.postMessage({command:'getSettings'});
    </script>
</body>
</html>`;
    }

    private shortcutRow(id: string, label: string): string {
        return `<div class="shortcut"><span>${label}</span><input id="shortcut-${id}" type="text" readonly onclick="captureShortcut(this)" aria-label="${label}"></div>`;
    }

    public dispose(): void {
        ModernSettingsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) this.disposables.pop()?.dispose();
    }
}
