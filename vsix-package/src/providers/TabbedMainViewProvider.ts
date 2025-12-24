import * as vscode from 'vscode';
import { SettingsManager } from '../settings/SettingsManager';

export class TabbedMainViewProvider implements vscode.WebviewViewProvider {
    private webview?: vscode.Webview;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly settingsManager: SettingsManager
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.webview = webviewView.webview;

        this.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        this.webview.html = this.getWebviewContent();

        // Webview mesajlarını dinle
        this.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        });

        // Ayarlar değiştiğinde view'ı güncelle
        this.refreshView();
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'refreshData':
                await this.refreshView();
                break;
            
            case 'openWizard':
                vscode.commands.executeCommand('wcagEnhancer.showWizard');
                break;
            
            case 'exportSettings':
                await this.exportSettings();
                break;
                
            case 'viewDiagnostics':
                await this.showDiagnostics();
                break;
        }
    }

    private async refreshView(): Promise<void> {
        if (!this.webview) return;

        const aiSettings = await this.settingsManager.getAIProviderSettings();
        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        const stats = await this.settingsManager.getUsageStats();
        const isFirstTime = await this.settingsManager.isFirstTimeSetup();

        this.webview.postMessage({
            type: 'dataRefreshed',
            data: {
                aiSettings,
                accessibilitySettings,
                stats,
                isFirstTime,
                hasValidAI: await this.settingsManager.hasValidAISettings()
            }
        });
    }

    private async exportSettings(): Promise<void> {
        try {
            const exportData = await this.settingsManager.exportSettings();
            
            // Clipboard'a kopyala
            await vscode.env.clipboard.writeText(exportData);
            
            vscode.window.showInformationMessage(
                '📋 Ayarlar panoya kopyalandı (API anahtarı hariç)',
                'Dosyaya Kaydet'
            ).then(async (selection) => {
                if (selection === 'Dosyaya Kaydet') {
                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file('accessimind-settings.json'),
                        filters: {
                            'JSON': ['json']
                        }
                    });
                    
                    if (uri) {
                        await vscode.workspace.fs.writeFile(uri, Buffer.from(exportData, 'utf8'));
                        vscode.window.showInformationMessage('✅ Ayarlar dosyaya kaydedildi');
                    }
                }
            });
            
        } catch (error) {
            vscode.window.showErrorMessage('Ayarlar dışa aktarılırken hata oluştu: ' + error);
        }
    }

    private async showDiagnostics(): Promise<void> {
        const diagnostics = await this.settingsManager.getDiagnosticInfo();
        
        const panel = vscode.window.createWebviewPanel(
            'wcagEnhancer.diagnostics',
            'AccessiMind Diagnostics',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getDiagnosticsHTML(diagnostics);
    }

    private getDiagnosticsHTML(diagnostics: any): string {
        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind Diagnostics</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        
        .diagnostic-item {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background-color: var(--vscode-editor-background);
        }
        
        .diagnostic-item h3 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }
        
        .status-ok { color: var(--vscode-testing-iconPassed); }
        .status-warning { color: var(--vscode-testing-iconQueued); }
        .status-error { color: var(--vscode-testing-iconFailed); }
        
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <h1>🔍 AccessiMind Diagnostics</h1>
    
    <div class="diagnostic-item">
        <h3>🤖 AI Settings Status</h3>
        <p class="${diagnostics.hasAISettings ? 'status-ok' : 'status-error'}">
            ${diagnostics.hasAISettings ? '✅ AI ayarları yapılandırılmış' : '❌ AI ayarları eksik'}
        </p>
    </div>
    
    <div class="diagnostic-item">
        <h3>🚀 Setup Status</h3>
        <p class="${!diagnostics.isFirstTime ? 'status-ok' : 'status-warning'}">
            ${!diagnostics.isFirstTime ? '✅ İlk kurulum tamamlanmış' : '⚠️ İlk kurulum bekliyor'}
        </p>
    </div>
    
    <div class="diagnostic-item">
        <h3>♿ Accessibility Settings</h3>
        <pre>${JSON.stringify(diagnostics.accessibilitySettings, null, 2)}</pre>
    </div>
    
    <div class="diagnostic-item">
        <h3>📊 Usage Statistics</h3>
        <pre>${JSON.stringify(diagnostics.stats, null, 2)}</pre>
    </div>
    
    <div class="diagnostic-item">
        <h3>🗂️ Storage Keys</h3>
        <pre>${JSON.stringify(diagnostics.storageKeys, null, 2)}</pre>
    </div>
    
    <div class="diagnostic-item">
        <h3>ℹ️ Extension Info</h3>
        <p><strong>Version:</strong> ${diagnostics.extensionVersion}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString('tr-TR')}</p>
    </div>
</body>
</html>
        `;
    }

    private getWebviewContent(): string {
        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 15px;
            margin: 0;
            line-height: 1.6;
        }
        
        .header {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .header h2 {
            margin: 0;
            color: var(--vscode-textLink-foreground);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .status-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .status-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .status-row:last-child {
            margin-bottom: 0;
        }
        
        .status-label {
            font-weight: bold;
            flex: 1;
        }
        
        .status-value {
            color: var(--vscode-descriptionForeground);
            text-align: right;
        }
        
        .status-ok { color: var(--vscode-testing-iconPassed); }
        .status-warning { color: var(--vscode-testing-iconQueued); }
        .status-error { color: var(--vscode-testing-iconFailed); }
        
        .btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .loading {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .quick-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .stat-box {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            display: block;
        }
        
        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .welcome-message {
            background-color: var(--vscode-inputValidation-infoBackground);
            border-left: 4px solid var(--vscode-inputValidation-infoBorder);
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin: 20px 0 10px 0;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--vscode-panel-border);
            color: var(--vscode-textLink-foreground);
        }
        
        /* Accessibility enhancements */
        .btn:focus {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }
        
        @media (prefers-contrast: high) {
            .btn {
                border: 2px solid var(--vscode-contrastBorder);
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h2><span>♿</span> AccessiMind</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--vscode-descriptionForeground);">
            WCAG 2.2 Erişilebilirlik Geliştirici
        </p>
    </div>
    
    <div id="content">
        <div class="loading">
            <p>⏳ Veriler yükleniyor...</p>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        let currentData = null;
        
        function refreshData() {
            vscode.postMessage({ type: 'refreshData' });
        }
        
        function openWizard() {
            vscode.postMessage({ type: 'openWizard' });
        }
        
        function exportSettings() {
            vscode.postMessage({ type: 'exportSettings' });
        }
        
        function viewDiagnostics() {
            vscode.postMessage({ type: 'viewDiagnostics' });
        }
        
        function renderContent(data) {
            currentData = data;
            const content = document.getElementById('content');
            
            if (data.isFirstTime && !data.hasValidAI) {
                content.innerHTML = \`
                    <div class="welcome-message">
                        <h3 style="margin-top: 0;">🎉 AccessiMind'e Hoş Geldiniz!</h3>
                        <p>WCAG 2.2 erişilebilirlik geliştirmeleri için AI destekli VS Code eklentiniz kurulmaya hazır.</p>
                        <p><strong>Başlamak için kurulum sihirbazını çalıştırın.</strong></p>
                    </div>
                    
                    <button class="btn btn-primary" onclick="openWizard()">
                        🚀 Kurulum Sihirbazını Başlat
                    </button>
                \`;
                return;
            }
            
            const aiStatus = data.hasValidAI ? 
                '<span class="status-ok">✅ Yapılandırılmış</span>' : 
                '<span class="status-error">❌ Eksik</span>';
                
            const lastUsed = data.stats?.lastUsed ? 
                new Date(data.stats.lastUsed).toLocaleDateString('tr-TR') : 
                'Henüz kullanılmadı';
            
            content.innerHTML = \`
                <div class="quick-stats">
                    <div class="stat-box">
                        <span class="stat-number">\${data.stats?.totalAnalyzes || 0}</span>
                        <div class="stat-label">Analiz</div>
                    </div>
                    <div class="stat-box">
                        <span class="stat-number">\${data.stats?.totalImprovements || 0}</span>
                        <div class="stat-label">İyileştirme</div>
                    </div>
                </div>
                
                <div class="status-card">
                    <div class="section-title">📊 Durum Özeti</div>
                    
                    <div class="status-row">
                        <span class="status-label">🤖 AI Sağlayıcısı:</span>
                        <span class="status-value">\${aiStatus}</span>
                    </div>
                    
                    <div class="status-row">
                        <span class="status-label">♿ WCAG Seviyesi:</span>
                        <span class="status-value">\${data.accessibilitySettings?.wcagLevel || 'AA'}</span>
                    </div>
                    
                    <div class="status-row">
                        <span class="status-label">🔊 Sesli Bildirim:</span>
                        <span class="status-value">\${data.accessibilitySettings?.enableVoiceAnnouncements ? 'Açık' : 'Kapalı'}</span>
                    </div>
                    
                    <div class="status-row">
                        <span class="status-label">📅 Son Kullanım:</span>
                        <span class="status-value">\${lastUsed}</span>
                    </div>
                </div>
                
                <div class="section-title">⚙️ Ayarlar</div>
                
                <button class="btn btn-primary" onclick="openWizard()">
                    🔧 Ayarları Değiştir
                </button>
                
                <button class="btn btn-secondary" onclick="exportSettings()">
                    📤 Ayarları Dışa Aktar
                </button>
                
                <button class="btn btn-secondary" onclick="viewDiagnostics()">
                    🔍 Sistem Bilgisi
                </button>
                
                <button class="btn btn-secondary" onclick="refreshData()">
                    🔄 Yenile
                </button>
            \`;
        }
        
        // Extension'dan gelen mesajları dinle
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'dataRefreshed':
                    renderContent(message.data);
                    break;
            }
        });
        
        // Klavye erişilebilirliği
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName === 'BUTTON') {
                e.target.click();
            }
        });
        
        // İlk yükleme
        refreshData();
    </script>
</body>
</html>
        `;
    }
}