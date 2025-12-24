"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsViewProvider = void 0;
const vscode = require("vscode");
class StatsViewProvider {
    constructor(extensionUri, settingsManager) {
        this.extensionUri = extensionUri;
        this.settingsManager = settingsManager;
    }
    resolveWebviewView(webviewView) {
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
        // İlk yükleme
        this.refreshStats();
    }
    async handleMessage(message) {
        switch (message.type) {
            case 'refreshStats':
                await this.refreshStats();
                break;
            case 'resetStats':
                await this.resetStats();
                break;
            case 'exportStats':
                await this.exportStats();
                break;
        }
    }
    async refreshStats() {
        if (!this.webview)
            return;
        const stats = await this.settingsManager.getUsageStats();
        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        const hasValidAI = await this.settingsManager.hasValidAISettings();
        // Kullanım yoğunluğu hesapla
        const totalUsage = stats.totalAnalyzes + stats.totalImprovements;
        const daysSinceInstall = Math.max(1, Math.ceil((Date.now() - stats.installDate.getTime()) / (1000 * 60 * 60 * 24)));
        const avgUsagePerDay = (totalUsage / daysSinceInstall).toFixed(1);
        // Son kullanım zamanını hesapla
        const daysSinceLastUse = Math.ceil((Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24));
        this.webview.postMessage({
            type: 'statsRefreshed',
            data: {
                stats,
                accessibilitySettings,
                hasValidAI,
                totalUsage,
                avgUsagePerDay,
                daysSinceLastUse,
                daysSinceInstall
            }
        });
    }
    async resetStats() {
        const result = await vscode.window.showWarningMessage('İstatistikleri sıfırlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.', 'Sıfırla', 'İptal');
        if (result === 'Sıfırla') {
            // Sadece istatistikleri sıfırla, ayarları değil
            const defaultStats = {
                totalAnalyzes: 0,
                totalImprovements: 0,
                lastUsed: new Date(),
                installDate: new Date()
            };
            await this.settingsManager.context.globalState.update('wcagEnhancer.stats', defaultStats);
            vscode.window.showInformationMessage('📊 İstatistikler sıfırlandı');
            await this.refreshStats();
        }
    }
    async exportStats() {
        try {
            const stats = await this.settingsManager.getUsageStats();
            const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
            const exportData = {
                stats,
                accessibilitySettings,
                exportDate: new Date().toISOString(),
                version: '0.3.2'
            };
            const exportJson = JSON.stringify(exportData, null, 2);
            // Clipboard'a kopyala
            await vscode.env.clipboard.writeText(exportJson);
            vscode.window.showInformationMessage('📋 İstatistikler panoya kopyalandı', 'Dosyaya Kaydet').then(async (selection) => {
                if (selection === 'Dosyaya Kaydet') {
                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file('accessimind-stats.json'),
                        filters: {
                            'JSON': ['json']
                        }
                    });
                    if (uri) {
                        await vscode.workspace.fs.writeFile(uri, Buffer.from(exportJson, 'utf8'));
                        vscode.window.showInformationMessage('✅ İstatistikler dosyaya kaydedildi');
                    }
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage('İstatistikler dışa aktarılırken hata oluştu: ' + error);
        }
    }
    getWebviewContent() {
        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind Statistics</title>
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
        
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
        }
        
        .stat-card {
            background-color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-panel-border);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .stat-card:hover {
            border-color: var(--vscode-textLink-foreground);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            display: block;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }
        
        .progress-section {
            margin-bottom: 25px;
        }
        
        .progress-item {
            margin-bottom: 15px;
        }
        
        .progress-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 14px;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background-color: var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-textLink-foreground);
            border-radius: 4px;
            transition: width 0.5s ease;
        }
        
        .info-section {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .info-row:last-child {
            margin-bottom: 0;
            border-bottom: none;
        }
        
        .info-label {
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .info-value {
            color: var(--vscode-descriptionForeground);
            text-align: right;
        }
        
        .btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 6px;
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
        
        .btn-danger {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }
        
        .achievement {
            background-color: var(--vscode-inputValidation-infoBackground);
            border-left: 4px solid var(--vscode-inputValidation-infoBorder);
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 4px;
        }
        
        .achievement-title {
            font-weight: bold;
            color: var(--vscode-inputValidation-infoForeground);
            margin-bottom: 5px;
        }
        
        .achievement-desc {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }
        
        .no-data {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 40px 20px;
        }
        
        .loading {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
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
            
            .stat-card {
                border: 2px solid var(--vscode-contrastBorder);
            }
        }
        
        /* Responsive design */
        @media (max-width: 300px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h2><span>📊</span> İstatistikler</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--vscode-descriptionForeground);">
            Kullanım verileriniz ve ilerlemeniz
        </p>
    </div>
    
    <div id="content">
        <div class="loading">
            <p>⏳ İstatistikler yükleniyor...</p>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function refreshStats() {
            vscode.postMessage({ type: 'refreshStats' });
        }
        
        function resetStats() {
            vscode.postMessage({ type: 'resetStats' });
        }
        
        function exportStats() {
            vscode.postMessage({ type: 'exportStats' });
        }
        
        function renderStats(data) {
            const content = document.getElementById('content');
            
            if (!data.hasValidAI && data.totalUsage === 0) {
                content.innerHTML = \`
                    <div class="no-data">
                        <h3>📈 Henüz veri yok</h3>
                        <p>AccessiMind'i kullanmaya başladığınızda istatistikleriniz burada görünecek.</p>
                        <p><strong>İpucu:</strong> Önce AI sağlayıcısını yapılandırın, sonra kod analizi yapın.</p>
                    </div>
                    
                    <button class="btn btn-primary" onclick="refreshStats()">
                        🔄 Yenile
                    </button>
                \`;
                return;
            }
            
            // Achievement kontrolü
            let achievements = [];
            
            if (data.stats.totalAnalyzes >= 1) {
                achievements.push({
                    title: '🏆 İlk Analiz',
                    desc: 'İlk kod analizinizi tamamladınız!'
                });
            }
            
            if (data.stats.totalImprovements >= 1) {
                achievements.push({
                    title: '✨ İyileştirme Uzmanı',
                    desc: 'İlk kod iyileştirmenizi aldınız!'
                });
            }
            
            if (data.totalUsage >= 10) {
                achievements.push({
                    title: '🚀 Aktif Kullanıcı',
                    desc: '10+ işlem tamamladınız!'
                });
            }
            
            if (data.daysSinceInstall >= 7 && data.totalUsage > 0) {
                achievements.push({
                    title: '⭐ Sadık Kullanıcı',
                    desc: 'Bir haftadır AccessiMind kullanıyorsunuz!'
                });
            }
            
            const achievementsHtml = achievements.length > 0 ? \`
                <div class="section-title">🏅 Başarımlar</div>
                \${achievements.map(achievement => \`
                    <div class="achievement">
                        <div class="achievement-title">\${achievement.title}</div>
                        <div class="achievement-desc">\${achievement.desc}</div>
                    </div>
                \`).join('')}
            \` : '';
            
            const analysisPercentage = data.totalUsage > 0 ? (data.stats.totalAnalyzes / data.totalUsage * 100).toFixed(0) : 0;
            const improvementPercentage = data.totalUsage > 0 ? (data.stats.totalImprovements / data.totalUsage * 100).toFixed(0) : 0;
            
            content.innerHTML = \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-number">\${data.stats.totalAnalyzes}</span>
                        <div class="stat-label">Kod Analizi</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">\${data.stats.totalImprovements}</span>
                        <div class="stat-label">İyileştirme</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">\${data.totalUsage}</span>
                        <div class="stat-label">Toplam Kullanım</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">\${data.avgUsagePerDay}</span>
                        <div class="stat-label">Günlük Ortalama</div>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="section-title">📈 Kullanım Dağılımı</div>
                    
                    <div class="progress-item">
                        <div class="progress-label">
                            <span>🔍 Analiz</span>
                            <span>\${analysisPercentage}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: \${analysisPercentage}%"></div>
                        </div>
                    </div>
                    
                    <div class="progress-item">
                        <div class="progress-label">
                            <span>✨ İyileştirme</span>
                            <span>\${improvementPercentage}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: \${improvementPercentage}%"></div>
                        </div>
                    </div>
                </div>
                
                <div class="info-section">
                    <div class="section-title">ℹ️ Detay Bilgileri</div>
                    
                    <div class="info-row">
                        <span class="info-label">📅 Kurulum Tarihi:</span>
                        <span class="info-value">\${new Date(data.stats.installDate).toLocaleDateString('tr-TR')}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">🕒 Son Kullanım:</span>
                        <span class="info-value">\${data.daysSinceLastUse === 0 ? 'Bugün' : data.daysSinceLastUse + ' gün önce'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">♿ WCAG Seviyesi:</span>
                        <span class="info-value">\${data.accessibilitySettings.wcagLevel}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">🔊 Sesli Bildirim:</span>
                        <span class="info-value">\${data.accessibilitySettings.enableVoiceAnnouncements ? 'Açık' : 'Kapalı'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">⌨️ Klavye Kısayolları:</span>
                        <span class="info-value">\${data.accessibilitySettings.enableKeyboardShortcuts ? 'Açık' : 'Kapalı'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">📊 Kullanım Süresi:</span>
                        <span class="info-value">\${data.daysSinceInstall} gün</span>
                    </div>
                </div>
                
                \${achievementsHtml}
                
                <div class="section-title">⚙️ İşlemler</div>
                
                <button class="btn btn-primary" onclick="refreshStats()">
                    🔄 İstatistikleri Yenile
                </button>
                
                <button class="btn btn-secondary" onclick="exportStats()">
                    📤 İstatistikleri Dışa Aktar
                </button>
                
                <button class="btn btn-danger" onclick="resetStats()">
                    🗑️ İstatistikleri Sıfırla
                </button>
            \`;
        }
        
        // Extension'dan gelen mesajları dinle
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'statsRefreshed':
                    renderStats(message.data);
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
        refreshStats();
        
        // Düzenli güncelleme (30 saniyede bir)
        setInterval(refreshStats, 30000);
    </script>
</body>
</html>
        `;
    }
}
exports.StatsViewProvider = StatsViewProvider;
//# sourceMappingURL=StatsViewProvider.js.map