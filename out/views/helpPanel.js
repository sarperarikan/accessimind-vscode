"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelpPanel = void 0;
const vscode = __importStar(require("vscode"));
class HelpPanel {
    static createOrShow() {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (HelpPanel.currentPanel) {
            HelpPanel.currentPanel.panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel("accessimindHelp", "📚 AccessiMind Help", column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        HelpPanel.currentPanel = new HelpPanel(panel);
    }
    constructor(panel) {
        this.disposables = [];
        this.panel = panel;
        this.panel.webview.html = this.getHtmlContent();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case "close":
                    this.panel.dispose();
                    break;
                case "openSettings":
                    vscode.commands.executeCommand("wcagEnhancer.openSettings");
                    break;
                case "openWizard":
                    vscode.commands.executeCommand("wcagEnhancer.openSetupWizard");
                    break;
                case "openChat":
                    vscode.commands.executeCommand("wcagEnhancer.openChat");
                    break;
                case "openExternal":
                    vscode.env.openExternal(vscode.Uri.parse(message.url));
                    break;
            }
        }, null, this.disposables);
    }
    getHtmlContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind Help</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-input-background);
            --bg-tertiary: var(--vscode-sideBar-background);
            --text-primary: var(--vscode-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --border: var(--vscode-panel-border);
            --focus: var(--vscode-focusBorder);
            --link: var(--vscode-textLink-foreground);
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
            line-height: 1.7;
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar - Table of Contents */
        .sidebar {
            width: 280px;
            background: var(--bg-tertiary);
            border-right: 1px solid var(--border);
            padding: 20px;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
        }

        .sidebar-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }

        .sidebar-header h1 {
            font-size: 1.2rem;
            font-weight: 600;
        }

        .toc-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }

        .toc-list {
            list-style: none;
        }

        .toc-item {
            margin-bottom: 4px;
        }

        .toc-link {
            display: block;
            padding: 8px 12px;
            color: var(--text-primary);
            text-decoration: none;
            border-radius: 6px;
            font-size: 0.9rem;
            transition: all 0.2s;
        }

        .toc-link:hover {
            background: var(--bg-secondary);
            color: var(--accent);
        }

        .toc-link:focus {
            outline: 2px solid var(--focus);
            outline-offset: -2px;
        }

        .toc-link.active {
            background: var(--accent);
            color: var(--vscode-button-foreground);
        }

        .toc-link .icon {
            margin-right: 8px;
        }

        .toc-sublist {
            list-style: none;
            margin-left: 24px;
            margin-top: 4px;
        }

        .toc-subitem .toc-link {
            font-size: 0.85rem;
            padding: 6px 12px;
        }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 280px;
            padding: 40px;
            max-width: 900px;
        }

        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
        }

        .header h1 {
            font-size: 2rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
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
            border-color: #f44336;
        }

        .close-btn:focus {
            outline: 2px solid var(--focus);
            outline-offset: 2px;
        }

        /* Sections */
        .section {
            margin-bottom: 48px;
            scroll-margin-top: 20px;
        }

        .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--accent);
        }

        .section-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
        }

        /* Text Styles */
        p {
            margin-bottom: 16px;
        }

        h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-top: 24px;
            margin-bottom: 12px;
        }

        ul, ol {
            margin-left: 24px;
            margin-bottom: 16px;
        }

        li {
            margin-bottom: 8px;
        }

        /* Code */
        code {
            background: var(--bg-primary);
            padding: 2px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
        }

        .code-block {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            overflow-x: auto;
            margin: 16px 0;
            font-family: monospace;
            font-size: 0.85rem;
            line-height: 1.5;
        }

        /* Keyboard Shortcuts Table */
        .shortcuts-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
        }

        .shortcuts-table th,
        .shortcuts-table td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }

        .shortcuts-table th {
            background: var(--bg-primary);
            font-weight: 600;
            font-size: 0.9rem;
        }

        .shortcuts-table tr:hover {
            background: var(--bg-primary);
        }

        .kbd {
            display: inline-block;
            padding: 4px 8px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.85rem;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        /* Feature Cards */
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }

        .feature-card {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            transition: all 0.2s;
        }

        .feature-card:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
        }

        .feature-card h4 {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .feature-card p {
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-bottom: 0;
        }

        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
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

        .btn-group {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 16px;
        }

        /* Links */
        a {
            color: var(--link);
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        a:focus {
            outline: 2px solid var(--focus);
            outline-offset: 2px;
        }

        /* Callout */
        .callout {
            background: var(--bg-primary);
            border-left: 4px solid var(--accent);
            padding: 16px 20px;
            border-radius: 0 8px 8px 0;
            margin: 16px 0;
        }

        .callout-title {
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .callout p {
            margin-bottom: 0;
        }

        /* Badge */
        .badge {
            display: inline-block;
            padding: 2px 8px;
            background: var(--accent);
            color: var(--vscode-button-foreground);
            border-radius: 10px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 8px;
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
        @media (max-width: 900px) {
            .sidebar {
                display: none;
            }
            .main-content {
                margin-left: 0;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Sidebar - Table of Contents -->
    <nav class="sidebar" role="navigation" aria-label="Documentation navigation">
        <div class="sidebar-header">
            <span style="font-size: 1.5rem;">♿</span>
            <h1>AccessiMind</h1>
        </div>
        
        <p class="toc-title">Contents</p>
        <ul class="toc-list" role="list">
            <li class="toc-item">
                <a href="#getting-started" class="toc-link active" onclick="scrollToSection('getting-started')">
                    <span class="icon">🚀</span>Getting Started
                </a>
            </li>
            <li class="toc-item">
                <a href="#features" class="toc-link" onclick="scrollToSection('features')">
                    <span class="icon">✨</span>Features
                </a>
                <ul class="toc-sublist" role="list">
                    <li class="toc-subitem">
                        <a href="#wcag-analysis" class="toc-link" onclick="scrollToSection('wcag-analysis')">WCAG Analysis</a>
                    </li>
                    <li class="toc-subitem">
                        <a href="#ai-chat" class="toc-link" onclick="scrollToSection('ai-chat')">AI Chat</a>
                    </li>
                    <li class="toc-subitem">
                        <a href="#jira-integration" class="toc-link" onclick="scrollToSection('jira-integration')">Jira Integration</a>
                    </li>
                </ul>
            </li>
            <li class="toc-item">
                <a href="#shortcuts" class="toc-link" onclick="scrollToSection('shortcuts')">
                    <span class="icon">⌨️</span>Keyboard Shortcuts
                </a>
            </li>
            <li class="toc-item">
                <a href="#ai-providers" class="toc-link" onclick="scrollToSection('ai-providers')">
                    <span class="icon">🤖</span>AI Providers
                </a>
                <ul class="toc-sublist" role="list">
                    <li class="toc-subitem">
                        <a href="#gemini-setup" class="toc-link" onclick="scrollToSection('gemini-setup')">Google Gemini</a>
                    </li>
                    <li class="toc-subitem">
                        <a href="#copilot-setup" class="toc-link" onclick="scrollToSection('copilot-setup')">GitHub Copilot</a>
                    </li>
                </ul>
            </li>
            <li class="toc-item">
                <a href="#configuration" class="toc-link" onclick="scrollToSection('configuration')">
                    <span class="icon">⚙️</span>Configuration
                </a>
            </li>
            <li class="toc-item">
                <a href="#wcag-reference" class="toc-link" onclick="scrollToSection('wcag-reference')">
                    <span class="icon">📖</span>WCAG Reference
                </a>
            </li>
            <li class="toc-item">
                <a href="#troubleshooting" class="toc-link" onclick="scrollToSection('troubleshooting')">
                    <span class="icon">🔧</span>Troubleshooting
                </a>
            </li>
            <li class="toc-item">
                <a href="#about" class="toc-link" onclick="scrollToSection('about')">
                    <span class="icon">ℹ️</span>About
                </a>
            </li>
        </ul>
    </nav>

    <!-- Main Content -->
    <main class="main-content" role="main">
        <header class="header">
            <h1>📚 AccessiMind Documentation</h1>
            <button class="close-btn" onclick="closePanel()" aria-label="Close help panel">
                ✕ Close
            </button>
        </header>

        <!-- Getting Started -->
        <section id="getting-started" class="section" aria-labelledby="gs-title">
            <h2 class="section-title" id="gs-title">🚀 Getting Started</h2>
            <div class="section-content">
                <p>
                    Welcome to <strong>AccessiMind</strong> - your AI-powered WCAG accessibility assistant for VS Code!
                    This extension helps you improve the accessibility of your web applications by analyzing your code
                    and suggesting improvements based on WCAG 2.2 guidelines.
                </p>

                <h3>Quick Setup</h3>
                <ol>
                    <li>Open the Command Palette (<kbd class="kbd">Ctrl+Shift+P</kbd>)</li>
                    <li>Run <code>AccessiMind: Open Setup Wizard</code></li>
                    <li>Select your AI provider (Gemini or VS Code Copilot)</li>
                    <li>Configure your API key (for Gemini)</li>
                    <li>Start analyzing your code!</li>
                </ol>

                <div class="callout">
                    <div class="callout-title">💡 Tip</div>
                    <p>For the best experience, ensure you have either Google Gemini API access or GitHub Copilot installed.</p>
                </div>

                <div class="btn-group">
                    <button class="btn btn-primary" onclick="openWizard()">
                        🧙‍♂️ Open Setup Wizard
                    </button>
                    <button class="btn btn-secondary" onclick="openSettings()">
                        ⚙️ Open Settings
                    </button>
                </div>
            </div>
        </section>

        <!-- Features -->
        <section id="features" class="section" aria-labelledby="feat-title">
            <h2 class="section-title" id="feat-title">✨ Features</h2>
            <div class="section-content">
                <p>AccessiMind provides a comprehensive set of tools for accessibility improvement:</p>

                <div class="feature-grid">
                    <div class="feature-card">
                        <h4>🔍 Code Analysis</h4>
                        <p>Automatically analyze your HTML, JSX, and TSX code for WCAG compliance issues.</p>
                    </div>
                    <div class="feature-card">
                        <h4>🤖 AI-Powered Fixes</h4>
                        <p>Get intelligent suggestions and auto-fixes powered by Gemini or Copilot.</p>
                    </div>
                    <div class="feature-card">
                        <h4>💬 Accessibility Chat</h4>
                        <p>Ask questions about accessibility and get expert answers in real-time.</p>
                    </div>
                    <div class="feature-card">
                        <h4>🎫 Jira Integration</h4>
                        <p>Export accessibility findings directly to Jira-compatible JSON format.</p>
                    </div>
                    <div class="feature-card">
                        <h4>📊 Statistics</h4>
                        <p>Track your accessibility improvements over time with detailed analytics.</p>
                    </div>
                    <div class="feature-card">
                        <h4>🌐 Multi-Language</h4>
                        <p>Support for English and Turkish interface and AI responses.</p>
                    </div>
                </div>

                <!-- WCAG Analysis -->
                <h3 id="wcag-analysis">WCAG Analysis</h3>
                <p>
                    AccessiMind analyzes your code against WCAG 2.2 guidelines at three conformance levels:
                </p>
                <ul>
                    <li><strong>Level A</strong> - Minimum accessibility requirements</li>
                    <li><strong>Level AA</strong> - Recommended for most websites (default)</li>
                    <li><strong>Level AAA</strong> - Highest level of accessibility</li>
                </ul>

                <!-- AI Chat -->
                <h3 id="ai-chat">AI Chat</h3>
                <p>
                    The AccessiMind Chat panel provides an interactive way to:
                </p>
                <ul>
                    <li>Ask accessibility questions about your code</li>
                    <li>Get WCAG compliance recommendations</li>
                    <li>Learn about ARIA best practices</li>
                    <li>Request code improvements with context awareness</li>
                </ul>

                <div class="btn-group">
                    <button class="btn btn-primary" onclick="openChat()">
                        💬 Open Chat
                    </button>
                </div>

                <!-- Jira Integration -->
                <h3 id="jira-integration">Jira Integration</h3>
                <p>
                    Create comprehensive Jira tasks from accessibility findings:
                </p>
                <ul>
                    <li>Analyze selected code or entire file</li>
                    <li>Generate detailed task descriptions</li>
                    <li>Include WCAG criteria references</li>
                    <li>Export as Jira-compatible JSON</li>
                    <li>Automatic priority mapping based on severity</li>
                </ul>
            </div>
        </section>

        <!-- Keyboard Shortcuts -->
        <section id="shortcuts" class="section" aria-labelledby="short-title">
            <h2 class="section-title" id="short-title">⌨️ Keyboard Shortcuts</h2>
            <div class="section-content">
                <p>Use these keyboard shortcuts to quickly access AccessiMind features:</p>

                <table class="shortcuts-table" role="table" aria-label="Keyboard shortcuts">
                    <thead>
                        <tr>
                            <th scope="col">Action</th>
                            <th scope="col">Shortcut</th>
                            <th scope="col">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Improve Current File</td>
                            <td><kbd class="kbd">Ctrl+Shift+W</kbd></td>
                            <td>Analyze and improve the entire file</td>
                        </tr>
                        <tr>
                            <td>Improve Selection</td>
                            <td><kbd class="kbd">Ctrl+Shift+E</kbd></td>
                            <td>Analyze and improve selected code</td>
                        </tr>
                        <tr>
                            <td>Open Chat</td>
                            <td><kbd class="kbd">Ctrl+Shift+C</kbd></td>
                            <td>Open the AI accessibility chat</td>
                        </tr>
                        <tr>
                            <td>Create Jira Task</td>
                            <td><kbd class="kbd">Ctrl+Shift+J</kbd></td>
                            <td>Generate Jira task from findings</td>
                        </tr>
                        <tr>
                            <td>Show Statistics</td>
                            <td><kbd class="kbd">Ctrl+Shift+S</kbd></td>
                            <td>View accessibility statistics</td>
                        </tr>
                        <tr>
                            <td>Command Palette</td>
                            <td><kbd class="kbd">Ctrl+Shift+P</kbd></td>
                            <td>Access all AccessiMind commands</td>
                        </tr>
                    </tbody>
                </table>

                <div class="callout">
                    <div class="callout-title">🔧 Customize Shortcuts</div>
                    <p>You can customize these shortcuts in Settings → Shortcuts tab.</p>
                </div>
            </div>
        </section>

        <!-- AI Providers -->
        <section id="ai-providers" class="section" aria-labelledby="ai-title">
            <h2 class="section-title" id="ai-title">🤖 AI Providers</h2>
            <div class="section-content">
                <p>
                    AccessiMind supports two powerful AI providers for code analysis and accessibility improvements.
                    Choose the one that best fits your workflow:
                </p>

                <div class="feature-grid">
                    <div class="feature-card">
                        <h4>🌟 Google Gemini</h4>
                        <p>Powerful AI with free tier. Requires API key but offers excellent code analysis.</p>
                    </div>
                    <div class="feature-card">
                        <h4>🤖 GitHub Copilot</h4>
                        <p>Seamless VS Code integration. Uses your existing Copilot subscription.</p>
                    </div>
                </div>

                <!-- Gemini Setup -->
                <h3 id="gemini-setup">Google Gemini Setup</h3>
                <p>Google Gemini provides powerful AI capabilities with a generous free tier:</p>
                <ol>
                    <li>Visit <a href="#" onclick="openExternal('https://makersuite.google.com/app/apikey'); return false;">Google AI Studio</a></li>
                    <li>Click "Create API Key" to generate your key</li>
                    <li>Open AccessiMind Settings → Setup Wizard</li>
                    <li>Select "Google Gemini" as your provider</li>
                    <li>Paste your API key and click "Test Connection"</li>
                </ol>

                <div class="callout">
                    <div class="callout-title">💡 Recommended Models</div>
                    <p>
                        <strong>Gemini 2.0 Flash</strong> - Best for speed and efficiency<br>
                        <strong>Gemini 1.5 Pro</strong> - Best for complex code analysis
                    </p>
                </div>

                <!-- Copilot Setup -->
                <h3 id="copilot-setup">GitHub Copilot Integration</h3>
                <p>
                    AccessiMind integrates seamlessly with GitHub Copilot through VS Code's Language Model API:
                </p>
                <ol>
                    <li>Ensure you have an active <a href="#" onclick="openExternal('https://github.com/features/copilot'); return false;">GitHub Copilot subscription</a></li>
                    <li>Install the <strong>GitHub Copilot</strong> extension in VS Code</li>
                    <li>Sign in to your GitHub account in VS Code</li>
                    <li>Open AccessiMind Settings → Setup Wizard</li>
                    <li>Select "VS Code Copilot" as your provider</li>
                    <li>Available models will be auto-detected</li>
                </ol>

                <div class="callout">
                    <div class="callout-title">🔧 Copilot Models</div>
                    <p>
                        AccessiMind automatically detects available Copilot models including:<br>
                        <strong>GPT-4o</strong>, <strong>GPT-4</strong>, <strong>Claude 3.5 Sonnet</strong>, and more.
                    </p>
                </div>

                <h3>Comparison</h3>
                <table class="shortcuts-table" role="table" aria-label="AI Provider comparison">
                    <thead>
                        <tr>
                            <th scope="col">Feature</th>
                            <th scope="col">Google Gemini</th>
                            <th scope="col">GitHub Copilot</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Cost</td>
                            <td>Free tier available</td>
                            <td>Subscription required</td>
                        </tr>
                        <tr>
                            <td>Setup</td>
                            <td>Requires API key</td>
                            <td>Auto-detected</td>
                        </tr>
                        <tr>
                            <td>Models</td>
                            <td>Gemini 2.0/1.5 Flash/Pro</td>
                            <td>GPT-4o, Claude, etc.</td>
                        </tr>
                        <tr>
                            <td>Speed</td>
                            <td>Very Fast</td>
                            <td>Fast</td>
                        </tr>
                        <tr>
                            <td>Best For</td>
                            <td>Independent usage</td>
                            <td>Copilot users</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Configuration -->
        <section id="configuration" class="section" aria-labelledby="config-title">
            <h2 class="section-title" id="config-title">⚙️ Configuration</h2>
            <div class="section-content">
                <p>Configure AccessiMind through the Settings panel:</p>

                <h3>General Settings</h3>
                <ul>
                    <li><strong>Language</strong> - Interface language (English/Turkish)</li>
                    <li><strong>Theme</strong> - Visual theme preference</li>
                    <li><strong>Notifications</strong> - Enable/disable popup notifications</li>
                    <li><strong>Auto-save</strong> - Automatically save after improvements</li>
                </ul>

                <h3>Analysis Settings</h3>
                <ul>
                    <li><strong>WCAG Level</strong> - Target conformance level (A/AA/AAA)</li>
                    <li><strong>Strict Mode</strong> - Enforce all criteria strictly</li>
                    <li><strong>Custom Rules</strong> - Path to custom MD rules file</li>
                    <li><strong>Context Aware</strong> - Consider surrounding code</li>
                </ul>

                <h3>AI Provider Settings</h3>
                <ul>
                    <li><strong>Provider</strong> - Gemini or VS Code Copilot</li>
                    <li><strong>API Key</strong> - Your Gemini API key</li>
                    <li><strong>Model</strong> - Preferred AI model</li>
                </ul>

                <div class="btn-group">
                    <button class="btn btn-primary" onclick="openSettings()">
                        ⚙️ Open Settings
                    </button>
                </div>
            </div>
        </section>

        <!-- WCAG Reference -->
        <section id="wcag-reference" class="section" aria-labelledby="wcag-title">
            <h2 class="section-title" id="wcag-title">📖 WCAG Reference</h2>
            <div class="section-content">
                <p>
                    AccessiMind follows the Web Content Accessibility Guidelines (WCAG) 2.2.
                    Here are the key principles:
                </p>

                <div class="feature-grid">
                    <div class="feature-card">
                        <h4>👁️ Perceivable</h4>
                        <p>Information must be presentable in ways users can perceive (alt text, captions, etc.)</p>
                    </div>
                    <div class="feature-card">
                        <h4>🎮 Operable</h4>
                        <p>Interface components must be operable (keyboard access, timing, navigation)</p>
                    </div>
                    <div class="feature-card">
                        <h4>💡 Understandable</h4>
                        <p>Information and UI operation must be understandable (readable, predictable)</p>
                    </div>
                    <div class="feature-card">
                        <h4>🔧 Robust</h4>
                        <p>Content must be robust enough for various technologies (valid code, ARIA)</p>
                    </div>
                </div>

                <h3>Common WCAG Criteria</h3>
                <ul>
                    <li><strong>1.1.1</strong> - Non-text Content (alt text for images)</li>
                    <li><strong>1.4.3</strong> - Contrast Minimum (4.5:1 ratio)</li>
                    <li><strong>2.1.1</strong> - Keyboard (all functionality via keyboard)</li>
                    <li><strong>2.4.4</strong> - Link Purpose (clear link text)</li>
                    <li><strong>3.3.2</strong> - Labels or Instructions (form labels)</li>
                    <li><strong>4.1.2</strong> - Name, Role, Value (ARIA attributes)</li>
                </ul>

                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="openExternal('https://www.w3.org/WAI/WCAG22/quickref/')">
                        🔗 WCAG 2.2 Quick Reference
                    </button>
                    <button class="btn btn-secondary" onclick="openExternal('https://www.w3.org/WAI/ARIA/apg/')">
                        🔗 ARIA Authoring Practices
                    </button>
                </div>
            </div>
        </section>

        <!-- Troubleshooting -->
        <section id="troubleshooting" class="section" aria-labelledby="trouble-title">
            <h2 class="section-title" id="trouble-title">🔧 Troubleshooting</h2>
            <div class="section-content">
                <h3>AI Provider Not Working</h3>
                <ul>
                    <li>Verify your API key is correctly entered</li>
                    <li>Check your internet connection</li>
                    <li>For Copilot: Ensure GitHub Copilot extension is installed and active</li>
                    <li>Try running <code>AccessiMind: Test AI Connection</code></li>
                </ul>

                <h3>Extension Not Activating</h3>
                <ul>
                    <li>Reload VS Code window (<kbd class="kbd">Ctrl+Shift+P</kbd> → "Reload Window")</li>
                    <li>Check the Output panel for errors (View → Output → AccessiMind)</li>
                    <li>Ensure VS Code version is 1.93.0 or higher</li>
                </ul>

                <h3>Analysis Not Running</h3>
                <ul>
                    <li>Ensure you have a file open in the editor</li>
                    <li>Check if the file type is supported (HTML, JSX, TSX, Vue, etc.)</li>
                    <li>Verify AI provider is configured correctly</li>
                </ul>

                <div class="callout">
                    <div class="callout-title">🆘 Need More Help?</div>
                    <p>
                        If you're still having issues, please 
                        <a href="#" onclick="openExternal('https://github.com/sarperarikan/wcag-enhancer/issues')">open an issue</a>
                        on our GitHub repository.
                    </p>
                </div>
            </div>
        </section>

        <!-- About -->
        <section id="about" class="section" aria-labelledby="about-title">
            <h2 class="section-title" id="about-title">ℹ️ About AccessiMind</h2>
            <div class="section-content">
                <p>
                    <strong>AccessiMind</strong> is developed by Sarper Arıkan to help developers
                    create more accessible web applications. Our mission is to make accessibility
                    a natural part of the development workflow.
                </p>

                <h3>Version</h3>
                <p>Version 1.0.1 <span class="badge">Latest</span></p>

                <h3>Links</h3>
                <ul>
                    <li><a href="#" onclick="openExternal('https://github.com/sarperarikan/wcag-enhancer')">GitHub Repository</a></li>
                    <li><a href="#" onclick="openExternal('https://marketplace.visualstudio.com/items?itemName=sarperarikan.accessimind')">VS Code Marketplace</a></li>
                    <li><a href="#" onclick="openExternal('https://github.com/sarperarikan/wcag-enhancer/issues')">Report Issues</a></li>
                </ul>

                <h3>License</h3>
                <p>MIT License - Free to use and modify.</p>

                <div class="callout">
                    <div class="callout-title">❤️ Support the Project</div>
                    <p>If AccessiMind helps you, consider starring the repository on GitHub!</p>
                </div>
            </div>
        </section>
    </main>

    <script>
        const vscode = acquireVsCodeApi();

        function closePanel() {
            vscode.postMessage({ command: 'close' });
        }

        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }

        function openWizard() {
            vscode.postMessage({ command: 'openWizard' });
        }

        function openChat() {
            vscode.postMessage({ command: 'openChat' });
        }

        function openExternal(url) {
            vscode.postMessage({ command: 'openExternal', url: url });
        }

        function scrollToSection(id) {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Update active state
                document.querySelectorAll('.toc-link').forEach(link => link.classList.remove('active'));
                event.target.classList.add('active');
            }
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closePanel();
            }
        });

        // Highlight current section on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    document.querySelectorAll('.toc-link').forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === '#' + id || 
                            link.getAttribute('onclick')?.includes(id)) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, { threshold: 0.3 });

        document.querySelectorAll('.section').forEach(section => {
            observer.observe(section);
        });
    </script>
</body>
</html>`;
    }
    dispose() {
        HelpPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d)
                d.dispose();
        }
    }
}
exports.HelpPanel = HelpPanel;
//# sourceMappingURL=helpPanel.js.map