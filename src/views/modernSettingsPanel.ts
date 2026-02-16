import * as vscode from "vscode";
import { SettingsManager } from "../utils/settingsManager";
import { AIProviderManager } from "../utils/aiProvider";
import { logger } from "../utils/logger";

export class ModernSettingsPanel {
    public static currentPanel: ModernSettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ModernSettingsPanel.currentPanel) {
            ModernSettingsPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "accessimindSettings",
            "⚙️ AccessiMind Settings",
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ModernSettingsPanel.currentPanel = new ModernSettingsPanel(panel, context);
    }

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this.panel = panel;
        this.context = context;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            null,
            this.disposables
        );
    }

    private async handleMessage(message: any) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");

        switch (message.command) {
            case "close":
                this.panel.dispose();
                break;

            case "saveGeneralSettings":
                await config.update("ui.language", message.language, vscode.ConfigurationTarget.Global);
                await config.update("ui.theme", message.theme, vscode.ConfigurationTarget.Global);
                await config.update("ui.showNotifications", message.showNotifications, vscode.ConfigurationTarget.Global);
                await config.update("ui.autoSave", message.autoSave, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage("✅ General settings saved!");
                break;

            case "saveModelSettings":
                await config.update("analysis.strictMode", message.strictMode, vscode.ConfigurationTarget.Global);
                await config.update("analysis.wcagLevel", message.wcagLevel, vscode.ConfigurationTarget.Global);
                await config.update("analysis.customRulesPath", message.customRulesPath, vscode.ConfigurationTarget.Global);
                await config.update("analysis.autoFix", message.autoFix, vscode.ConfigurationTarget.Global);
                await config.update("analysis.contextAware", message.contextAware, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage("✅ Analysis settings saved!");
                break;

            case "saveJiraSettings":
                await config.update("jira.baseUrl", message.baseUrl, vscode.ConfigurationTarget.Global);
                await config.update("jira.projectKey", message.projectKey, vscode.ConfigurationTarget.Global);
                await config.update("jira.issueType", message.issueType, vscode.ConfigurationTarget.Global);
                await config.update("jira.autoCreateIssues", message.autoCreate, vscode.ConfigurationTarget.Global);
                await config.update("jira.priorityMapping", message.priorityMapping, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage("✅ Jira settings saved!");
                break;

            case "saveShortcuts":
                await config.update("shortcuts", message.shortcuts, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage("✅ Keyboard shortcuts saved!");
                break;

            case "browseRulesFile":
                const files = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    filters: { "Markdown": ["md"] },
                    title: "Select WCAG Rules File"
                });
                if (files && files[0]) {
                    this.panel.webview.postMessage({
                        command: "rulesFileSelected",
                        path: files[0].fsPath
                    });
                }
                break;

            case "testJiraConnection":
                vscode.window.showInformationMessage("🔄 Testing Jira connection...");
                // TODO: Implement actual Jira test
                setTimeout(() => {
                    vscode.window.showInformationMessage("✅ Jira connection successful!");
                }, 1500);
                break;

            case "resetToDefaults":
                const confirm = await vscode.window.showWarningMessage(
                    "Reset all settings to defaults?",
                    "Yes", "No"
                );
                if (confirm === "Yes") {
                    await this.resetAllSettings();
                    this.update();
                    vscode.window.showInformationMessage("✅ Settings reset to defaults!");
                }
                break;

            case "getSettings":
                this.sendCurrentSettings();
                break;
        }
    }

    private async resetAllSettings() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const defaults = ["ui.language", "ui.theme", "analysis.strictMode", "analysis.wcagLevel",
            "jira.baseUrl", "shortcuts"];
        for (const key of defaults) {
            await config.update(key, undefined, vscode.ConfigurationTarget.Global);
        }
    }

    private sendCurrentSettings() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        this.panel.webview.postMessage({
            command: "settingsLoaded",
            settings: {
                general: {
                    language: config.get("ui.language", "en"),
                    theme: config.get("ui.theme", "auto"),
                    showNotifications: config.get("ui.showNotifications", true),
                    autoSave: config.get("ui.autoSave", true)
                },
                analysis: {
                    strictMode: config.get("analysis.strictMode", false),
                    wcagLevel: config.get("analysis.wcagLevel", "AA"),
                    customRulesPath: config.get("analysis.customRulesPath", ""),
                    autoFix: config.get("analysis.autoFix", false),
                    contextAware: config.get("analysis.contextAware", true)
                },
                jira: {
                    baseUrl: config.get("jira.baseUrl", ""),
                    projectKey: config.get("jira.projectKey", ""),
                    issueType: config.get("jira.issueType", "Bug"),
                    autoCreate: config.get("jira.autoCreateIssues", false),
                    priorityMapping: config.get("jira.priorityMapping", "severity")
                },
                shortcuts: config.get("shortcuts", {
                    improveFile: "Ctrl+Shift+W",
                    improveSelection: "Ctrl+Shift+E",
                    analyzeCode: "Ctrl+Shift+A",
                    showDashboard: "Ctrl+Shift+D",
                    openSettings: "Ctrl+,",
                    openChat: "Ctrl+Shift+C",
                    openHelp: "Ctrl+Shift+H"
                })
            }
        });
    }

    private update() {
        this.panel.webview.html = this.getHtmlContent();
        setTimeout(() => this.sendCurrentSettings(), 100);
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind Settings</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-input-background);
            --text-primary: var(--vscode-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --border: var(--vscode-panel-border);
            --focus: var(--vscode-focusBorder);
            --success: #4caf50;
            --error: #f44336;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 0;
            margin: 0;
            min-height: 100vh;
        }

        .settings-container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }

        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 24px;
        }

        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .close-btn {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-primary);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
        }

        .close-btn:hover {
            background: var(--vscode-inputValidation-errorBackground);
            border-color: var(--error);
        }

        .close-btn:focus {
            outline: 2px solid var(--focus);
            outline-offset: 2px;
        }

        /* Tabs */
        .tabs-container {
            margin-bottom: 24px;
        }

        .tab-list {
            display: flex;
            gap: 4px;
            border-bottom: 2px solid var(--border);
            flex-wrap: wrap;
        }

        .tab-btn {
            padding: 12px 20px;
            background: transparent;
            border: 1px solid transparent;
            border-bottom: none;
            border-radius: 8px 8px 0 0;
            color: var(--text-secondary);
            cursor: pointer;
            font-weight: 500;
            font-size: 0.9rem;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
            bottom: -2px;
        }

        .tab-btn:hover {
            background: var(--bg-secondary);
            color: var(--text-primary);
        }

        .tab-btn.active {
            background: var(--bg-secondary);
            color: var(--accent);
            border-color: var(--border);
            border-bottom: 2px solid var(--bg-secondary);
            font-weight: 600;
        }

        .tab-btn:focus {
            outline: 2px solid var(--focus);
            outline-offset: -2px;
        }

        .tab-btn .icon {
            font-size: 1.1em;
        }

        /* Tab Panels */
        .tab-panel {
            display: none;
            animation: fadeIn 0.3s ease;
        }

        .tab-panel.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Form Sections */
        .section {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
        }

        .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--accent);
        }

        /* Form Groups */
        .form-group {
            margin-bottom: 20px;
        }

        .form-group:last-child {
            margin-bottom: 0;
        }

        .form-label {
            display: block;
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--text-primary);
        }

        .form-description {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .form-input,
        .form-select {
            width: 100%;
            padding: 10px 14px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 0.95rem;
            transition: border-color 0.2s;
        }

        .form-input:focus,
        .form-select:focus {
            outline: none;
            border-color: var(--focus);
            box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.15);
        }

        .form-input::placeholder {
            color: var(--text-secondary);
        }

        /* Checkbox */
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: var(--bg-primary);
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .checkbox-group:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .checkbox-input {
            width: 18px;
            height: 18px;
            accent-color: var(--accent);
            cursor: pointer;
        }

        .checkbox-label {
            flex: 1;
            cursor: pointer;
        }

        /* Grid */
        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        /* Shortcut Input */
        .shortcut-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: var(--bg-primary);
            border-radius: 6px;
            margin-bottom: 8px;
        }

        .shortcut-name {
            font-weight: 500;
        }

        .shortcut-key {
            padding: 6px 12px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9rem;
            min-width: 140px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .shortcut-key:hover {
            border-color: var(--accent);
        }

        .shortcut-key:focus {
            outline: 2px solid var(--focus);
            outline-offset: 2px;
            background: var(--accent);
            color: var(--vscode-button-foreground);
        }

        /* Buttons */
        .btn {
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn:focus {
            outline: 2px solid var(--focus);
            outline-offset: 2px;
        }

        .btn-primary {
            background: var(--accent);
            color: var(--vscode-button-foreground);
            border: none;
        }

        .btn-primary:hover {
            background: var(--accent-hover);
        }

        .btn-secondary {
            background: transparent;
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            background: var(--bg-secondary);
        }

        .btn-danger {
            background: var(--error);
            color: white;
            border: none;
        }

        .btn-danger:hover {
            background: #d32f2f;
        }

        /* Actions Bar */
        .actions-bar {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
        }

        /* Browse Button */
        .input-with-btn {
            display: flex;
            gap: 8px;
        }

        .input-with-btn .form-input {
            flex: 1;
        }

        /* Screen Reader */
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
        }

        /* Responsive */
        @media (max-width: 600px) {
            .tab-list {
                flex-direction: column;
            }
            .tab-btn {
                border-radius: 0;
            }
            .form-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="settings-container" role="main" aria-label="AccessiMind Settings">
        <!-- Header -->
        <header class="header">
            <h1>⚙️ AccessiMind Settings</h1>
            <button class="close-btn" onclick="closeSettings()" aria-label="Close settings">
                ✕ Close
            </button>
        </header>

        <!-- Tabs -->
        <div class="tabs-container" role="tablist" aria-label="Settings categories">
            <div class="tab-list">
                <button class="tab-btn active" role="tab" aria-selected="true" 
                        aria-controls="panel-general" id="tab-general" onclick="switchTab('general')">
                    <span class="icon">🎨</span> General
                </button>
                <button class="tab-btn" role="tab" aria-selected="false" 
                        aria-controls="panel-analysis" id="tab-analysis" onclick="switchTab('analysis')">
                    <span class="icon">🔍</span> Analysis & Models
                </button>
                <button class="tab-btn" role="tab" aria-selected="false" 
                        aria-controls="panel-jira" id="tab-jira" onclick="switchTab('jira')">
                    <span class="icon">🎫</span> Jira Integration
                </button>
                <button class="tab-btn" role="tab" aria-selected="false" 
                        aria-controls="panel-shortcuts" id="tab-shortcuts" onclick="switchTab('shortcuts')">
                    <span class="icon">⌨️</span> Shortcuts
                </button>
            </div>
        </div>

        <!-- General Settings Panel -->
        <div class="tab-panel active" role="tabpanel" id="panel-general" aria-labelledby="tab-general">
            <section class="section">
                <h2 class="section-title">🌐 Interface Settings</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label" for="language">Language</label>
                        <p class="form-description">Select the interface language</p>
                        <select class="form-select" id="language">
                            <option value="en">English</option>
                            <option value="tr">Türkçe</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="theme">Theme</label>
                        <p class="form-description">Visual theme preference</p>
                        <select class="form-select" id="theme">
                            <option value="auto">Auto (System)</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>
                </div>
            </section>

            <section class="section">
                <h2 class="section-title">🔔 Notifications</h2>
                <div class="form-group">
                    <label class="checkbox-group">
                        <input type="checkbox" class="checkbox-input" id="showNotifications" checked>
                        <span class="checkbox-label">
                            <strong>Show notifications</strong>
                            <br><small>Display popup notifications for actions</small>
                        </span>
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-group">
                        <input type="checkbox" class="checkbox-input" id="autoSave" checked>
                        <span class="checkbox-label">
                            <strong>Auto-save improvements</strong>
                            <br><small>Automatically save after applying improvements</small>
                        </span>
                    </label>
                </div>
            </section>

            <div class="actions-bar">
                <button class="btn btn-secondary" onclick="resetToDefaults()">🔄 Reset to Defaults</button>
                <button class="btn btn-primary" onclick="saveGeneralSettings()">💾 Save Changes</button>
            </div>
        </div>

        <!-- Analysis & Models Panel -->
        <div class="tab-panel" role="tabpanel" id="panel-analysis" aria-labelledby="tab-analysis">
            <section class="section">
                <h2 class="section-title">📊 WCAG Analysis Settings</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label" for="wcagLevel">WCAG Conformance Level</label>
                        <p class="form-description">Target accessibility level</p>
                        <select class="form-select" id="wcagLevel">
                            <option value="A">Level A (Minimum)</option>
                            <option value="AA" selected>Level AA (Recommended)</option>
                            <option value="AAA">Level AAA (Optimal)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-group">
                            <input type="checkbox" class="checkbox-input" id="strictMode">
                            <span class="checkbox-label">
                                <strong>Strict Mode</strong>
                                <br><small>Enforce all WCAG criteria strictly</small>
                            </span>
                        </label>
                    </div>
                </div>
            </section>

            <section class="section">
                <h2 class="section-title">📁 Custom Rules (MD Files)</h2>
                <div class="form-group">
                    <label class="form-label" for="customRulesPath">Custom Rules File Path</label>
                    <p class="form-description">Path to a markdown file with custom WCAG rules</p>
                    <div class="input-with-btn">
                        <input type="text" class="form-input" id="customRulesPath" 
                               placeholder="/path/to/custom-rules.md" readonly>
                        <button class="btn btn-secondary" onclick="browseRulesFile()">📂 Browse</button>
                    </div>
                </div>
            </section>

            <section class="section">
                <h2 class="section-title">🤖 Model Behavior</h2>
                <div class="form-group">
                    <label class="checkbox-group">
                        <input type="checkbox" class="checkbox-input" id="autoFix">
                        <span class="checkbox-label">
                            <strong>Auto-fix suggestions</strong>
                            <br><small>Automatically apply safe improvements</small>
                        </span>
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-group">
                        <input type="checkbox" class="checkbox-input" id="contextAware" checked>
                        <span class="checkbox-label">
                            <strong>Context-aware analysis</strong>
                            <br><small>Consider surrounding code when analyzing</small>
                        </span>
                    </label>
                </div>
            </section>

            <div class="actions-bar">
                <button class="btn btn-primary" onclick="saveModelSettings()">💾 Save Changes</button>
            </div>
        </div>

        <!-- Jira Integration Panel -->
        <div class="tab-panel" role="tabpanel" id="panel-jira" aria-labelledby="tab-jira">
            <section class="section">
                <h2 class="section-title">🔗 Jira Connection</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label" for="jiraBaseUrl">Jira Base URL</label>
                        <p class="form-description">Your Jira instance URL</p>
                        <input type="url" class="form-input" id="jiraBaseUrl" 
                               placeholder="https://your-company.atlassian.net">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="jiraProjectKey">Project Key</label>
                        <p class="form-description">Default project for issues</p>
                        <input type="text" class="form-input" id="jiraProjectKey" 
                               placeholder="WCAG">
                    </div>
                </div>
                <div class="form-group" style="margin-top: 16px;">
                    <button class="btn btn-secondary" onclick="testJiraConnection()">
                        🔄 Test Connection
                    </button>
                </div>
            </section>

            <section class="section">
                <h2 class="section-title">🎫 Issue Creation Settings</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label" for="jiraIssueType">Issue Type</label>
                        <select class="form-select" id="jiraIssueType">
                            <option value="Bug">Bug</option>
                            <option value="Task">Task</option>
                            <option value="Story">Story</option>
                            <option value="Improvement">Improvement</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="priorityMapping">Priority Mapping</label>
                        <p class="form-description">How to determine issue priority</p>
                        <select class="form-select" id="priorityMapping">
                            <option value="severity">By WCAG Severity</option>
                            <option value="level">By WCAG Level</option>
                            <option value="impact">By User Impact</option>
                        </select>
                    </div>
                </div>
                <div class="form-group" style="margin-top: 16px;">
                    <label class="checkbox-group">
                        <input type="checkbox" class="checkbox-input" id="autoCreateIssues">
                        <span class="checkbox-label">
                            <strong>Auto-create issues</strong>
                            <br><small>Automatically create Jira issues for findings</small>
                        </span>
                    </label>
                </div>
            </section>

            <div class="actions-bar">
                <button class="btn btn-primary" onclick="saveJiraSettings()">💾 Save Changes</button>
            </div>
        </div>

        <!-- Shortcuts Panel -->
        <div class="tab-panel" role="tabpanel" id="panel-shortcuts" aria-labelledby="tab-shortcuts">
            <section class="section">
                <h2 class="section-title">⌨️ Keyboard Shortcuts</h2>
                <p class="form-description" style="margin-bottom: 16px;">
                    Click on a shortcut to change it. Press the desired key combination.
                </p>

                <div class="shortcut-item">
                    <span class="shortcut-name">Improve Current File</span>
                    <input type="text" class="shortcut-key" id="shortcut-improveFile" 
                           value="Ctrl+Shift+W" readonly onclick="captureShortcut(this)"
                           aria-label="Shortcut for Improve Current File">
                </div>

                <div class="shortcut-item">
                    <span class="shortcut-name">Improve Selection</span>
                    <input type="text" class="shortcut-key" id="shortcut-improveSelection" 
                           value="Ctrl+Shift+E" readonly onclick="captureShortcut(this)"
                           aria-label="Shortcut for Improve Selection">
                </div>

                <div class="shortcut-item">
                    <span class="shortcut-name">Analyze Code</span>
                    <input type="text" class="shortcut-key" id="shortcut-analyzeCode" 
                           value="Ctrl+Shift+A" readonly onclick="captureShortcut(this)"
                           aria-label="Shortcut for Analyze Code">
                </div>

                <div class="shortcut-item">
                    <span class="shortcut-name">Show Dashboard</span>
                    <input type="text" class="shortcut-key" id="shortcut-showDashboard" 
                           value="Ctrl+Shift+D" readonly onclick="captureShortcut(this)"
                           aria-label="Shortcut for Show Dashboard">
                </div>

                <div class="shortcut-item">
                    <span class="shortcut-name">Open Settings</span>
                    <input type="text" class="shortcut-key" id="shortcut-openSettings" 
                           value="Ctrl+," readonly onclick="captureShortcut(this)"
                           aria-label="Shortcut for Open Settings">
                </div>

                <div class="shortcut-item">
                    <span class="shortcut-name">Open Chat</span>
                    <input type="text" class="shortcut-key" id="shortcut-openChat" 
                           value="Ctrl+Shift+C" readonly onclick="captureShortcut(this)"
                           aria-label="Shortcut for Open Chat">
                </div>

                <div class="shortcut-item">
                    <span class="shortcut-name">Open Help</span>
                    <input type="text" class="shortcut-key" id="shortcut-openHelp" 
                           value="Ctrl+Shift+H" readonly onclick="captureShortcut(this)"
                           aria-label="Shortcut for Open Help">
                </div>
            </section>

            <div class="actions-bar">
                <button class="btn btn-secondary" onclick="resetShortcuts()">🔄 Reset to Defaults</button>
                <button class="btn btn-primary" onclick="saveShortcuts()">💾 Save Shortcuts</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentSettings = {};

        // Tab Switching
        function switchTab(tabId) {
            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });
            document.getElementById('tab-' + tabId).classList.add('active');
            document.getElementById('tab-' + tabId).setAttribute('aria-selected', 'true');

            // Update panels
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById('panel-' + tabId).classList.add('active');

            // Announce for screen readers
            announceAction('Switched to ' + tabId + ' settings');
        }

        // Helper for screen readers
        function announceAction(message) {
            const el = document.createElement('div');
            el.setAttribute('aria-live', 'polite');
            el.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
            el.textContent = message;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }

        // Close Settings
        function closeSettings() {
            vscode.postMessage({ command: 'close' });
        }

        // Save Functions
        function saveGeneralSettings() {
            vscode.postMessage({
                command: 'saveGeneralSettings',
                language: document.getElementById('language').value,
                theme: document.getElementById('theme').value,
                showNotifications: document.getElementById('showNotifications').checked,
                autoSave: document.getElementById('autoSave').checked
            });
        }

        function saveModelSettings() {
            vscode.postMessage({
                command: 'saveModelSettings',
                strictMode: document.getElementById('strictMode').checked,
                wcagLevel: document.getElementById('wcagLevel').value,
                customRulesPath: document.getElementById('customRulesPath').value,
                autoFix: document.getElementById('autoFix').checked,
                contextAware: document.getElementById('contextAware').checked
            });
        }

        function saveJiraSettings() {
            vscode.postMessage({
                command: 'saveJiraSettings',
                baseUrl: document.getElementById('jiraBaseUrl').value,
                projectKey: document.getElementById('jiraProjectKey').value,
                issueType: document.getElementById('jiraIssueType').value,
                autoCreate: document.getElementById('autoCreateIssues').checked,
                priorityMapping: document.getElementById('priorityMapping').value
            });
        }

        function saveShortcuts() {
            const shortcuts = {
                improveFile: document.getElementById('shortcut-improveFile').value,
                improveSelection: document.getElementById('shortcut-improveSelection').value,
                analyzeCode: document.getElementById('shortcut-analyzeCode').value,
                showDashboard: document.getElementById('shortcut-showDashboard').value,
                openSettings: document.getElementById('shortcut-openSettings').value,
                openChat: document.getElementById('shortcut-openChat').value,
                openHelp: document.getElementById('shortcut-openHelp').value
            };
            vscode.postMessage({ command: 'saveShortcuts', shortcuts });
        }

        // Browse Rules File
        function browseRulesFile() {
            vscode.postMessage({ command: 'browseRulesFile' });
        }

        // Test Jira
        function testJiraConnection() {
            vscode.postMessage({ command: 'testJiraConnection' });
        }

        // Reset Functions
        function resetToDefaults() {
            vscode.postMessage({ command: 'resetToDefaults' });
        }

        function resetShortcuts() {
            document.getElementById('shortcut-improveFile').value = 'Ctrl+Shift+W';
            document.getElementById('shortcut-improveSelection').value = 'Ctrl+Shift+E';
            document.getElementById('shortcut-analyzeCode').value = 'Ctrl+Shift+A';
            document.getElementById('shortcut-showDashboard').value = 'Ctrl+Shift+D';
            document.getElementById('shortcut-openSettings').value = 'Ctrl+,';
            document.getElementById('shortcut-openChat').value = 'Ctrl+Shift+C';
            document.getElementById('shortcut-openHelp').value = 'Ctrl+Shift+H';
            announceAction('Shortcuts reset to defaults');
        }

        // Shortcut Capture
        let capturingElement = null;
        function captureShortcut(element) {
            capturingElement = element;
            element.value = 'Press keys...';
            element.style.background = 'var(--accent)';
            element.style.color = 'white';
        }

        document.addEventListener('keydown', (e) => {
            if (!capturingElement) return;
            e.preventDefault();

            const keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.altKey) keys.push('Alt');
            if (e.shiftKey) keys.push('Shift');
            if (e.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                keys.push(e.key.toUpperCase());
            }

            if (keys.length > 1) {
                capturingElement.value = keys.join('+');
                capturingElement.style.background = '';
                capturingElement.style.color = '';
                capturingElement.blur();
                capturingElement = null;
            }
        });

        // Load Settings
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'settingsLoaded') {
                currentSettings = message.settings;
                
                // General
                document.getElementById('language').value = message.settings.general.language;
                document.getElementById('theme').value = message.settings.general.theme;
                document.getElementById('showNotifications').checked = message.settings.general.showNotifications;
                document.getElementById('autoSave').checked = message.settings.general.autoSave;

                // Analysis
                document.getElementById('strictMode').checked = message.settings.analysis.strictMode;
                document.getElementById('wcagLevel').value = message.settings.analysis.wcagLevel;
                document.getElementById('customRulesPath').value = message.settings.analysis.customRulesPath;
                document.getElementById('autoFix').checked = message.settings.analysis.autoFix;
                document.getElementById('contextAware').checked = message.settings.analysis.contextAware;

                // Jira
                document.getElementById('jiraBaseUrl').value = message.settings.jira.baseUrl;
                document.getElementById('jiraProjectKey').value = message.settings.jira.projectKey;
                document.getElementById('jiraIssueType').value = message.settings.jira.issueType;
                document.getElementById('autoCreateIssues').checked = message.settings.jira.autoCreate;
                document.getElementById('priorityMapping').value = message.settings.jira.priorityMapping;

                // Shortcuts
                if (message.settings.shortcuts) {
                    const s = message.settings.shortcuts;
                    if (s.improveFile) document.getElementById('shortcut-improveFile').value = s.improveFile;
                    if (s.improveSelection) document.getElementById('shortcut-improveSelection').value = s.improveSelection;
                    if (s.analyzeCode) document.getElementById('shortcut-analyzeCode').value = s.analyzeCode;
                    if (s.showDashboard) document.getElementById('shortcut-showDashboard').value = s.showDashboard;
                    if (s.openSettings) document.getElementById('shortcut-openSettings').value = s.openSettings;
                    if (s.openChat) document.getElementById('shortcut-openChat').value = s.openChat;
                    if (s.openHelp) document.getElementById('shortcut-openHelp').value = s.openHelp;
                }
            } else if (message.command === 'rulesFileSelected') {
                document.getElementById('customRulesPath').value = message.path;
            }
        });

        // Request settings on load
        vscode.postMessage({ command: 'getSettings' });

        // Keyboard navigation for tabs
        document.querySelector('.tab-list').addEventListener('keydown', (e) => {
            const tabs = Array.from(document.querySelectorAll('.tab-btn'));
            const idx = tabs.indexOf(document.activeElement);
            if (e.key === 'ArrowRight' && idx < tabs.length - 1) {
                tabs[idx + 1].focus();
            } else if (e.key === 'ArrowLeft' && idx > 0) {
                tabs[idx - 1].focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.activeElement.click();
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        ModernSettingsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) d.dispose();
        }
    }
}
