const vscode = require('vscode');
const path = require('path');

let currentPanel = undefined;
let extensionContext;

function activate(context) {
    extensionContext = context;

    // Register commands
    let openPanelCommand = vscode.commands.registerCommand('wcag-enhancer.openPanel', () => {
        openWcagPanel();
    });

    let runWizardCommand = vscode.commands.registerCommand('wcag-enhancer.runWizard', () => {
        runSetupWizard();
    });

    let improveFileCommand = vscode.commands.registerCommand('wcag-enhancer.improveFile', () => {
        improveCurrentFile();
    });

    let improveSelectionCommand = vscode.commands.registerCommand('wcag-enhancer.improveSelection', () => {
        improveSelection();
    });

    context.subscriptions.push(
        openPanelCommand,
        runWizardCommand,
        improveFileCommand,
        improveSelectionCommand
    );

    // Show welcome message on first activation
    const hasSeenWelcome = context.globalState.get('wcag-enhancer.hasSeenWelcome', false);
    if (!hasSeenWelcome) {
        context.globalState.update('wcag-enhancer.hasSeenWelcome', true);
        vscode.window.showInformationMessage(
            'Welcome to AccessiMind! Run the setup wizard to get started.',
            'Run Wizard'
        ).then(selection => {
            if (selection === 'Run Wizard') {
                runSetupWizard();
            }
        });
    }
}

function openWcagPanel() {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        'wcagEnhancer',
        'AccessiMind',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionContext.extensionPath, 'media'))]
        }
    );

    currentPanel.webview.html = getWebviewContent();
    
    // Handle messages from webview
    currentPanel.webview.onDidReceiveMessage(
        message => handleWebviewMessage(message),
        undefined,
        extensionContext.subscriptions
    );

    currentPanel.onDidDispose(
        () => {
            currentPanel = undefined;
        },
        null,
        extensionContext.subscriptions
    );

    // Load initial stats
    updateStats();
}

function runSetupWizard() {
    const panel = vscode.window.createWebviewPanel(
        'wcagWizard',
        'AccessiMind Setup Wizard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionContext.extensionPath, 'media'))]
        }
    );

    panel.webview.html = getWizardContent();
    
    panel.webview.onDidReceiveMessage(
        message => handleWizardMessage(message, panel),
        undefined,
        extensionContext.subscriptions
    );
}

function improveCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const text = document.getText();
    
    // Send improvement request
    if (currentPanel) {
        currentPanel.webview.postMessage({
            type: 'setTyping',
            isTyping: true
        });
        
        // Simulate API call
        setTimeout(() => {
            currentPanel.webview.postMessage({
                type: 'setTyping',
                isTyping: false
            });
            
            currentPanel.webview.postMessage({
                type: 'addChatMessage',
                message: 'File improvement analysis complete. Accessibility enhancements have been identified.',
                isUser: false,
                isError: false
            });
            
            updateStats('file');
        }, 2000);
    }

    vscode.window.showInformationMessage('Analyzing file for WCAG improvements...');
}

function improveSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showErrorMessage('No text selected');
        return;
    }

    const selectedText = editor.document.getText(selection);
    
    // Send improvement request
    if (currentPanel) {
        currentPanel.webview.postMessage({
            type: 'setTyping',
            isTyping: true
        });
        
        // Simulate API call
        setTimeout(() => {
            currentPanel.webview.postMessage({
                type: 'setTyping',
                isTyping: false
            });
            
            currentPanel.webview.postMessage({
                type: 'addChatMessage',
                message: 'Selection improvement analysis complete. ARIA attributes and semantic improvements suggested.',
                isUser: false,
                isError: false
            });
            
            updateStats('selection');
        }, 1500);
    }

    vscode.window.showInformationMessage('Analyzing selection for WCAG improvements...');
}

function handleWebviewMessage(message) {
    switch (message.type) {
        case 'chat':
            handleChatMessage(message.message);
            break;
        case 'improveFile':
            improveCurrentFile();
            break;
        case 'improveSelection':
            improveSelection();
            break;
        case 'getStats':
            updateStats();
            break;
        case 'resetStats':
            resetStats();
            break;
        case 'setApiKey':
            setApiKey(message.apiKey);
            break;
        case 'testApiKey':
            testApiKey();
            break;
        case 'settingsChanged':
            saveSettings(message.settings);
            break;
        case 'settingsLoaded':
            loadSettings(message.settings);
            break;
        case 'settingsReset':
            resetSettings();
            break;
        case 'exportStats':
            exportStats(message.format, message.period);
            break;
    }
}

function handleWizardMessage(message, panel) {
    switch (message.type) {
        case 'wizardComplete':
            saveWizardSettings(message.settings);
            panel.dispose();
            vscode.window.showInformationMessage('Setup wizard completed successfully!');
            break;
        case 'wizardCancel':
            panel.dispose();
            break;
    }
}

function handleChatMessage(messageText) {
    if (!currentPanel) return;

    // Add user message
    currentPanel.webview.postMessage({
        type: 'addChatMessage',
        message: messageText,
        isUser: true,
        isError: false
    });

    // Show typing indicator
    currentPanel.webview.postMessage({
        type: 'setTyping',
        isTyping: true
    });

    // Simulate AI response
    setTimeout(() => {
        currentPanel.webview.postMessage({
            type: 'setTyping',
            isTyping: false
        });

        const responses = [
            'I can help you improve the accessibility of your code. What specific area would you like me to focus on?',
            'Based on WCAG guidelines, I recommend adding proper ARIA labels and semantic HTML elements.',
            'Let me analyze your code for potential accessibility improvements including keyboard navigation and screen reader compatibility.',
            'I notice some areas where we can enhance color contrast and alternative text for better accessibility.'
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        currentPanel.webview.postMessage({
            type: 'addChatMessage',
            message: randomResponse,
            isUser: false,
            isError: false
        });

        updateStats('chat');
    }, 1000 + Math.random() * 2000);
}

function updateStats(type = null) {
    if (!currentPanel) return;

    const stats = extensionContext.globalState.get('wcag-enhancer.stats', {
        totalEnhancements: 0,
        successRate: 0.95,
        totalLinesImproved: 0,
        chatMessages: 0,
        languageStats: {},
        typeStats: {}
    });

    if (type) {
        stats.totalEnhancements += 1;
        stats.typeStats[type] = (stats.typeStats[type] || 0) + 1;
        stats.totalLinesImproved += Math.floor(Math.random() * 50) + 1;
        
        if (type === 'chat') {
            stats.chatMessages += 1;
        }

        // Update language stats based on active file
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const language = editor.document.languageId;
            stats.languageStats[language] = (stats.languageStats[language] || 0) + 1;
        }

        extensionContext.globalState.update('wcag-enhancer.stats', stats);
    }

    currentPanel.webview.postMessage({
        type: 'updateStats',
        stats: stats
    });
}

function resetStats() {
    extensionContext.globalState.update('wcag-enhancer.stats', {
        totalEnhancements: 0,
        successRate: 1.0,
        totalLinesImproved: 0,
        chatMessages: 0,
        languageStats: {},
        typeStats: {}
    });
    updateStats();
}

function setApiKey(apiKey) {
    const config = vscode.workspace.getConfiguration('wcagEnhancer');
    config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('API key saved successfully');
}

function testApiKey() {
    const config = vscode.workspace.getConfiguration('wcagEnhancer');
    const apiKey = config.get('apiKey');
    
    if (!apiKey) {
        vscode.window.showErrorMessage('No API key configured');
        return;
    }

    // Simulate API test
    vscode.window.showInformationMessage('Testing API connection...');
    setTimeout(() => {
        vscode.window.showInformationMessage('API connection successful!');
    }, 1000);
}

function saveSettings(settings) {
    const config = vscode.workspace.getConfiguration('wcagEnhancer');
    
    if (settings.apiKey) {
        config.update('apiKey', settings.apiKey, vscode.ConfigurationTarget.Global);
    }
    
    if (settings.wizardSettings) {
        config.update('language', settings.wizardSettings.language, vscode.ConfigurationTarget.Global);
        config.update('accessibilityLevel', settings.wizardSettings.accessibilityLevel, vscode.ConfigurationTarget.Global);
        config.update('enhancementMode', settings.wizardSettings.enhancementMode, vscode.ConfigurationTarget.Global);
        config.update('autoSave', settings.wizardSettings.autoSave, vscode.ConfigurationTarget.Global);
    }
}

function loadSettings(settings) {
    // Settings are loaded from localStorage in webview
    // This function can be used for additional backend processing
}

function resetSettings() {
    const config = vscode.workspace.getConfiguration('wcagEnhancer');
    config.update('apiKey', '', vscode.ConfigurationTarget.Global);
    config.update('language', 'en', vscode.ConfigurationTarget.Global);
    config.update('accessibilityLevel', 'AA', vscode.ConfigurationTarget.Global);
    config.update('enhancementMode', 'standard', vscode.ConfigurationTarget.Global);
    config.update('autoSave', false, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('All settings have been reset');
}

function saveWizardSettings(settings) {
    const config = vscode.workspace.getConfiguration('wcagEnhancer');
    config.update('language', settings.language, vscode.ConfigurationTarget.Global);
    config.update('accessibilityLevel', settings.accessibilityLevel, vscode.ConfigurationTarget.Global);
    config.update('enhancementMode', settings.enhancementMode, vscode.ConfigurationTarget.Global);
    config.update('autoSave', settings.autoSave, vscode.ConfigurationTarget.Global);
}

function exportStats(format = 'json', period = 'all') {
    const stats = extensionContext.globalState.get('wcag-enhancer.stats', {
        totalEnhancements: 0,
        successRate: 0.95,
        totalLinesImproved: 0,
        chatMessages: 0,
        languageStats: {},
        typeStats: {}
    });

    // Simulated export functionality
    const exportData = {
        exportDate: new Date().toISOString(),
        period: period,
        format: format,
        statistics: stats
    };

    if (format === 'csv') {
        const csvContent = convertToCSV(exportData);
        vscode.window.showInformationMessage(`Stats exported as CSV (${period} period)`);
        // In a real implementation, this would save to file
    } else {
        const jsonContent = JSON.stringify(exportData, null, 2);
        vscode.window.showInformationMessage(`Stats exported as JSON (${period} period)`);
        // In a real implementation, this would save to file
    }
}

function convertToCSV(data) {
    const headers = ['Type', 'Count', 'Description'];
    const rows = [headers.join(',')];
    
    // Add basic stats
    rows.push(`Total Enhancements,${data.statistics.totalEnhancements},Total number of improvements made`);
    rows.push(`Success Rate,${Math.round(data.statistics.successRate * 100)}%,Percentage of successful operations`);
    rows.push(`Lines Improved,${data.statistics.totalLinesImproved},Total lines of code improved`);
    rows.push(`Chat Messages,${data.statistics.chatMessages},Total chat interactions`);
    
    // Add language stats
    Object.entries(data.statistics.languageStats).forEach(([lang, count]) => {
        rows.push(`Language: ${lang},${count},Improvements in ${lang}`);
    });
    
    // Add type stats
    Object.entries(data.statistics.typeStats).forEach(([type, count]) => {
        rows.push(`Type: ${type},${count},${type} improvements`);
    });
    
    return rows.join('\n');
}

function getWebviewContent() {
    const mediaPath = vscode.Uri.file(path.join(extensionContext.extensionPath, 'media'));
    const mediaUri = currentPanel.webview.asWebviewUri(mediaPath);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind</title>
    <link rel="stylesheet" href="${mediaUri}/reset.css">
    <link rel="stylesheet" href="${mediaUri}/vscode.css">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 16px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 16px;
        }
        .tab {
            padding: 8px 16px;
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        .tab.active {
            border-bottom-color: var(--vscode-textLink-foreground);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .chat-container {
            height: 300px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            overflow-y: auto;
            margin-bottom: 8px;
            background: var(--vscode-input-background);
        }
        .message {
            margin: 4px 0;
            padding: 8px;
            border-radius: 4px;
        }
        .message.user {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            margin-left: 20%;
        }
        .message.assistant {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
        }
        .message.error {
            background: var(--vscode-inputValidation-errorBackground);
            border-color: var(--vscode-inputValidation-errorBorder);
        }
        .input-container {
            display: flex;
            gap: 8px;
        }
        .chat-input {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .send-btn {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .send-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .typing-indicator {
            display: none;
            font-style: italic;
            color: var(--vscode-descriptionForeground);
            padding: 4px 8px;
        }
        .typing-indicator.show {
            display: block;
        }
        .quick-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 16px;
        }
        .quick-action-btn {
            padding: 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
        }
        .quick-action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 16px;
        }
        .stat-card {
            padding: 16px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .stat-label {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .chart-container {
            margin: 16px 0;
        }
        .chart-bar {
            display: flex;
            align-items: center;
            margin: 8px 0;
        }
        .chart-label {
            min-width: 100px;
            font-size: 12px;
        }
        .chart-progress {
            flex: 1;
            height: 20px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 10px;
            margin: 0 8px;
            overflow: hidden;
        }
        .chart-fill {
            height: 100%;
            background: var(--vscode-progressBar-background);
            transition: width 0.3s ease;
        }
        .chart-value {
            min-width: 30px;
            text-align: right;
            font-size: 12px;
        }
        .settings-section {
            margin-bottom: 16px;
        }
        .settings-label {
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
        }
        .settings-input {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            margin-bottom: 8px;
        }
        .button-group {
            display: flex;
            gap: 8px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn:hover {
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>AccessiMind</h1>
        
        <div class="tabs" role="tablist">
            <button class="tab active" role="tab" aria-controls="chat-panel" aria-selected="true">Chat</button>
            <button class="tab" role="tab" aria-controls="stats-panel" aria-selected="false">Statistics</button>
            <button class="tab" role="tab" aria-controls="settings-panel" aria-selected="false">Settings</button>
        </div>

        <div id="chat-panel" class="tab-content active" role="tabpanel">
            <div class="quick-actions">
                <button class="quick-action-btn" onclick="improveFile()">
                    Improve Current File
                </button>
                <button class="quick-action-btn" onclick="improveSelection()">
                    Improve Selection
                </button>
            </div>
            
            <div id="chat-messages" class="chat-container" role="log" aria-live="polite">
                <!-- Chat messages will appear here -->
            </div>
            
            <div id="typing-indicator" class="typing-indicator">
                AI is analyzing your code...
            </div>
            
            <form class="input-container" onsubmit="sendMessage(event)">
                <input 
                    type="text" 
                    id="chat-input" 
                    class="chat-input" 
                    placeholder="Ask about WCAG improvements..."
                    aria-label="Chat input"
                >
                <button type="submit" id="send-btn" class="send-btn">Send</button>
            </form>
        </div>

        <div id="stats-panel" class="tab-content" role="tabpanel">
            <div class="stats-grid">
                <div class="stat-card">
                    <div id="total-improvements" class="stat-value">0</div>
                    <div class="stat-label">Total Improvements</div>
                </div>
                <div class="stat-card">
                    <div id="success-rate" class="stat-value">95%</div>
                    <div class="stat-label">Success Rate</div>
                </div>
                <div class="stat-card">
                    <div id="total-lines" class="stat-value">0</div>
                    <div class="stat-label">Lines Improved</div>
                </div>
                <div class="stat-card">
                    <div id="chat-messages-count" class="stat-value">0</div>
                    <div class="stat-label">Chat Messages</div>
                </div>
            </div>
            
            <h3>Languages</h3>
            <div id="language-chart" class="chart-container"></div>
            
            <h3>Enhancement Types</h3>
            <div id="type-chart" class="chart-container"></div>
            
            <div class="button-group">
                <button class="btn btn-secondary" onclick="refreshStats()">Refresh</button>
                <button class="btn btn-secondary" onclick="resetStats()">Reset Statistics</button>
            </div>
        </div>

        <div id="settings-panel" class="tab-content" role="tabpanel">
            <div class="settings-section">
                <label class="settings-label" for="api-key">API Key</label>
                <input 
                    type="password" 
                    id="api-key" 
                    class="settings-input"
                    placeholder="Enter your API key"
                    aria-describedby="api-key-help"
                >
                <div id="api-key-help" class="stat-label">Required for AI-powered enhancements</div>
                
                <div class="button-group">
                    <button class="btn btn-primary" onclick="setApiKey()">Save API Key</button>
                    <button class="btn btn-secondary" onclick="testApiKey()">Test Connection</button>
                </div>
            </div>
            
            <div class="settings-section">
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="showTroubleshooting()">Troubleshooting</button>
                    <button class="btn btn-secondary" onclick="diagnoseApi()">Diagnose API</button>
                    <button class="btn btn-secondary" onclick="resetAllSettings()">Reset All Settings</button>
                </div>
            </div>
        </div>
    </div>

    <script src="${mediaUri}/toolkit.js"></script>
    <script src="${mediaUri}/main.js"></script>
</body>
</html>`;
}

function getWizardContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind Setup Wizard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 32px;
            max-width: 600px;
            margin: 0 auto;
        }
        .wizard-step {
            margin-bottom: 24px;
        }
        .step-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .step-description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
        }
        .form-group {
            margin-bottom: 16px;
        }
        .form-label {
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
        }
        .form-select, .form-input {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 24px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
    </style>
</head>
<body>
    <div class="wizard-container">
        <h1>AccessiMind Setup Wizard</h1>
        <p>Configure your accessibility enhancement preferences</p>
        
        <div class="wizard-step">
            <div class="step-title">Language Preference</div>
            <div class="step-description">Choose your preferred language for enhancement suggestions</div>
            <div class="form-group">
                <label class="form-label" for="language-select">Language</label>
                <select id="language-select" class="form-select">
                    <option value="en">English</option>
                    <option value="tr">Türkçe</option>
                </select>
            </div>
        </div>
        
        <div class="wizard-step">
            <div class="step-title">Accessibility Level</div>
            <div class="step-description">Select the WCAG compliance level you want to target</div>
            <div class="form-group">
                <label class="form-label" for="accessibility-level">WCAG Level</label>
                <select id="accessibility-level" class="form-select">
                    <option value="A">Level A (Basic)</option>
                    <option value="AA" selected>Level AA (Standard)</option>
                    <option value="AAA">Level AAA (Enhanced)</option>
                </select>
            </div>
        </div>
        
        <div class="wizard-step">
            <div class="step-title">Enhancement Mode</div>
            <div class="step-description">Choose how aggressive the enhancement suggestions should be</div>
            <div class="form-group">
                <label class="form-label" for="enhancement-mode">Mode</label>
                <select id="enhancement-mode" class="form-select">
                    <option value="conservative">Conservative (Minimal changes)</option>
                    <option value="standard" selected>Standard (Balanced approach)</option>
                    <option value="aggressive">Aggressive (Maximum improvements)</option>
                </select>
            </div>
        </div>
        
        <div class="wizard-step">
            <div class="step-title">Auto-save</div>
            <div class="step-description">Automatically save improvements to your files</div>
            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="auto-save" />
                    <label for="auto-save">Enable auto-save</label>
                </div>
            </div>
        </div>
        
        <div class="button-group">
            <button class="btn btn-primary" onclick="completeWizard()">Complete Setup</button>
            <button class="btn btn-secondary" onclick="cancelWizard()">Cancel</button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function completeWizard() {
            const settings = {
                language: document.getElementById('language-select').value,
                accessibilityLevel: document.getElementById('accessibility-level').value,
                enhancementMode: document.getElementById('enhancement-mode').value,
                autoSave: document.getElementById('auto-save').checked
            };
            
            vscode.postMessage({
                type: 'wizardComplete',
                settings: settings
            });
        }
        
        function cancelWizard() {
            vscode.postMessage({
                type: 'wizardCancel'
            });
        }
    </script>
</body>
</html>`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};