"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicPanelProvider = void 0;
const vscode = require("vscode");
class DynamicPanelProvider {
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
    }
    async handleMessage(message) {
        switch (message.type) {
            case 'analyzeCode':
                await this.analyzeCode();
                break;
            case 'improveCode':
                await this.improveCode();
                break;
            case 'openWizard':
                vscode.commands.executeCommand('wcagEnhancer.showWizard');
                break;
            case 'checkSettings':
                await this.checkAndUpdateSettings();
                break;
        }
    }
    async analyzeCode() {
        // AI ayarlarını kontrol et
        const hasValidSettings = await this.settingsManager.hasValidAISettings();
        if (!hasValidSettings) {
            this.webview?.postMessage({
                type: 'showError',
                message: 'AI sağlayıcısı ayarları eksik. Lütfen önce ayarları yapılandırın.'
            });
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.webview?.postMessage({
                type: 'showError',
                message: 'Analiz edilecek aktif bir dosya bulunamadı. Lütfen bir dosya açın.'
            });
            return;
        }
        // Dosya türünü kontrol et
        const supportedLanguages = ['html', 'css', 'javascript', 'typescript', 'jsx', 'tsx', 'vue', 'svelte'];
        if (!supportedLanguages.includes(editor.document.languageId)) {
            this.webview?.postMessage({
                type: 'showWarning',
                message: `Bu dosya türü (${editor.document.languageId}) desteklenmiyor. HTML, CSS, JS, TS dosyalarını kullanın.`
            });
            return;
        }
        // Analiz başlat
        this.webview?.postMessage({
            type: 'analysisStarted',
            message: 'Kod erişilebilirlik analizi başlatılıyor...'
        });
        try {
            // Screen reader announcement
            const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
            if (accessibilitySettings.enableVoiceAnnouncements) {
                vscode.window.showInformationMessage('🔊 Kod analizi başlatıldı');
            }
            // TODO: Gerçek AI analizi burada yapılacak
            // Şimdilik simüle ediyoruz
            await this.simulateAnalysis();
            // İstatistikleri güncelle
            await this.settingsManager.incrementUsageStats('analyze');
            this.webview?.postMessage({
                type: 'analysisCompleted',
                message: 'Kod analizi tamamlandı! Sonuçlar output paneline yazdırıldı.'
            });
        }
        catch (error) {
            this.webview?.postMessage({
                type: 'showError',
                message: 'Analiz sırasında hata oluştu: ' + error
            });
        }
    }
    async improveCode() {
        // AI ayarlarını kontrol et
        const hasValidSettings = await this.settingsManager.hasValidAISettings();
        if (!hasValidSettings) {
            this.webview?.postMessage({
                type: 'showError',
                message: 'AI sağlayıcısı ayarları eksik. Lütfen önce ayarları yapılandırın.'
            });
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.webview?.postMessage({
                type: 'showError',
                message: 'İyileştirilecek aktif bir dosya bulunamadı. Lütfen bir dosya açın.'
            });
            return;
        }
        // İyileştirme başlat
        this.webview?.postMessage({
            type: 'improvementStarted',
            message: 'Kod erişilebilirlik iyileştirmeleri hazırlanıyor...'
        });
        try {
            // Screen reader announcement
            const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
            if (accessibilitySettings.enableVoiceAnnouncements) {
                vscode.window.showInformationMessage('🔊 Kod iyileştirme başlatıldı');
            }
            // TODO: Gerçek AI iyileştirme burada yapılacak
            // Şimdilik simüle ediyoruz
            await this.simulateImprovement();
            // İstatistikleri güncelle
            await this.settingsManager.incrementUsageStats('improve');
            this.webview?.postMessage({
                type: 'improvementCompleted',
                message: 'Kod iyileştirme önerileri hazırlandı! Sonuçlar output paneline yazdırıldı.'
            });
        }
        catch (error) {
            this.webview?.postMessage({
                type: 'showError',
                message: 'İyileştirme sırasında hata oluştu: ' + error
            });
        }
    }
    async simulateAnalysis() {
        // Simülasyon için bekleme
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Output channel'a örnek analiz sonucu yaz
        const outputChannel = vscode.window.createOutputChannel('AccessiMind Analysis');
        outputChannel.clear();
        outputChannel.appendLine('=== WCAG 2.2 Erişilebilirlik Analizi ===');
        outputChannel.appendLine('');
        outputChannel.appendLine('📅 Analiz Tarihi: ' + new Date().toLocaleString('tr-TR'));
        outputChannel.appendLine('📄 Dosya: ' + (vscode.window.activeTextEditor?.document.fileName || 'Bilinmeyen'));
        outputChannel.appendLine('');
        outputChannel.appendLine('🔍 Tespit Edilen Sorunlar:');
        outputChannel.appendLine('');
        outputChannel.appendLine('1. ❌ WCAG 1.1.1 (Non-text Content)');
        outputChannel.appendLine('   - img etiketlerinde alt özniteliği eksik');
        outputChannel.appendLine('   - Konum: Satır 15, 23');
        outputChannel.appendLine('');
        outputChannel.appendLine('2. ⚠️ WCAG 1.4.3 (Contrast Minimum)');
        outputChannel.appendLine('   - Renk kontrastı AA seviyesinin altında');
        outputChannel.appendLine('   - Mevcut: 3.2:1, Gerekli: 4.5:1');
        outputChannel.appendLine('');
        outputChannel.appendLine('3. ❌ WCAG 2.1.1 (Keyboard)');
        outputChannel.appendLine('   - Etkileşimli elementlere klavye erişimi yok');
        outputChannel.appendLine('   - tabindex özniteliği eksik');
        outputChannel.appendLine('');
        outputChannel.appendLine('✅ Uyumlu Alanlar:');
        outputChannel.appendLine('- Başlık hiyerarşisi doğru (h1, h2, h3)');
        outputChannel.appendLine('- Form etiketleri mevcut');
        outputChannel.appendLine('');
        outputChannel.appendLine('📊 Skor: 7/10 (İyileştirme önerilir)');
        outputChannel.show();
    }
    async simulateImprovement() {
        // Simülasyon için bekleme
        await new Promise(resolve => setTimeout(resolve, 2500));
        // Output channel'a örnek iyileştirme önerisi yaz
        const outputChannel = vscode.window.createOutputChannel('AccessiMind Improvements');
        outputChannel.clear();
        outputChannel.appendLine('=== WCAG 2.2 İyileştirme Önerileri ===');
        outputChannel.appendLine('');
        outputChannel.appendLine('📅 Öneri Tarihi: ' + new Date().toLocaleString('tr-TR'));
        outputChannel.appendLine('📄 Dosya: ' + (vscode.window.activeTextEditor?.document.fileName || 'Bilinmeyen'));
        outputChannel.appendLine('');
        outputChannel.appendLine('🔧 Önerilen İyileştirmeler:');
        outputChannel.appendLine('');
        outputChannel.appendLine('1. 🖼️ Görsel Erişilebilirlik');
        outputChannel.appendLine('   Değiştir:');
        outputChannel.appendLine('   <img src="logo.png">');
        outputChannel.appendLine('   →');
        outputChannel.appendLine('   <img src="logo.png" alt="Şirket logosu">');
        outputChannel.appendLine('');
        outputChannel.appendLine('2. 🎨 Renk Kontrastı');
        outputChannel.appendLine('   Değiştir:');
        outputChannel.appendLine('   color: #999999; /* 3.2:1 kontrast */');
        outputChannel.appendLine('   →');
        outputChannel.appendLine('   color: #666666; /* 4.8:1 kontrast */');
        outputChannel.appendLine('');
        outputChannel.appendLine('3. ⌨️ Klavye Erişimi');
        outputChannel.appendLine('   Ekle:');
        outputChannel.appendLine('   <div onclick="...">');
        outputChannel.appendLine('   →');
        outputChannel.appendLine('   <button type="button" onclick="...">');
        outputChannel.appendLine('   veya');
        outputChannel.appendLine('   <div tabindex="0" role="button" onclick="..." onkeydown="handleKeyDown(event)">');
        outputChannel.appendLine('');
        outputChannel.appendLine('4. 🏷️ ARIA Etiketi');
        outputChannel.appendLine('   Ekle:');
        outputChannel.appendLine('   <button>X</button>');
        outputChannel.appendLine('   →');
        outputChannel.appendLine('   <button aria-label="Kapat">X</button>');
        outputChannel.appendLine('');
        outputChannel.appendLine('📋 JavaScript İyileştirmeleri:');
        outputChannel.appendLine('');
        outputChannel.appendLine('// Klavye event handler');
        outputChannel.appendLine('function handleKeyDown(event) {');
        outputChannel.appendLine('  if (event.key === "Enter" || event.key === " ") {');
        outputChannel.appendLine('    event.preventDefault();');
        outputChannel.appendLine('    // Action burada');
        outputChannel.appendLine('  }');
        outputChannel.appendLine('}');
        outputChannel.appendLine('');
        outputChannel.appendLine('// Focus management');
        outputChannel.appendLine('element.addEventListener("focus", () => {');
        outputChannel.appendLine('  element.style.outline = "2px solid #007ACC";');
        outputChannel.appendLine('});');
        outputChannel.appendLine('');
        outputChannel.appendLine('💡 Genel İpuçları:');
        outputChannel.appendLine('- Her sayfada sadece bir h1 kullanın');
        outputChannel.appendLine('- Form inputları için label kullanın');
        outputChannel.appendLine('- Error mesajları için aria-describedby kullanın');
        outputChannel.appendLine('- Loading durumları için aria-live kullanın');
        outputChannel.appendLine('');
        outputChannel.appendLine('🎯 Bu iyileştirmelerle WCAG AA uyumluluğuna ulaşabilirsiniz!');
        outputChannel.show();
    }
    async checkAndUpdateSettings() {
        const hasValidAI = await this.settingsManager.hasValidAISettings();
        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        this.webview?.postMessage({
            type: 'settingsUpdated',
            data: {
                hasValidAI,
                accessibilitySettings
            }
        });
    }
    getWebviewContent() {
        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccessiMind Actions</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 15px;
            margin: 0;
            line-height: 1.6;
        }
        
        .action-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .action-btn {
            width: 100%;
            padding: 20px 15px;
            border: 2px solid var(--vscode-button-background);
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s ease;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .action-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .action-btn:active {
            transform: translateY(0);
        }
        
        .action-btn.disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .action-btn.disabled:hover {
            transform: none;
            box-shadow: none;
        }
        
        .action-icon {
            font-size: 32px;
            margin-bottom: 5px;
        }
        
        .action-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .action-description {
            font-size: 12px;
            opacity: 0.8;
            line-height: 1.4;
        }
        
        .status-indicator {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: var(--vscode-testing-iconFailed);
        }
        
        .status-indicator.ready {
            background-color: var(--vscode-testing-iconPassed);
        }
        
        .status-indicator.warning {
            background-color: var(--vscode-testing-iconQueued);
        }
        
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.1);
            display: none;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
        }
        
        .loading-overlay.active {
            display: flex;
        }
        
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid var(--vscode-foreground);
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .alert {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            border-left: 4px solid;
            font-size: 13px;
        }
        
        .alert-success {
            background-color: var(--vscode-inputValidation-infoBackground);
            border-color: var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
        }
        
        .alert-error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border-color: var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
        }
        
        .alert-warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            border-color: var(--vscode-inputValidation-warningBorder);
            color: var(--vscode-inputValidation-warningForeground);
        }
        
        .settings-btn {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--vscode-button-secondaryBackground);
            border-radius: 4px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
            transition: all 0.3s ease;
        }
        
        .settings-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        /* Accessibility enhancements */
        .action-btn:focus, .settings-btn:focus {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }
        
        @media (prefers-contrast: high) {
            .action-btn, .settings-btn {
                border: 2px solid var(--vscode-contrastBorder);
            }
        }
        
        /* Screen reader için gizli metin */
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
        
        .keyboard-hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <div id="alerts" aria-live="polite" aria-atomic="true"></div>
    
    <div class="action-container">
        <button class="action-btn" id="analyzeBtn" onclick="analyzeCode()" 
                aria-describedby="analyze-description">
            <div class="status-indicator" id="analyzeStatus"></div>
            <div class="action-icon">🔍</div>
            <div class="action-title">Mevcut Kodu Analiz Et</div>
            <div class="action-description" id="analyze-description">
                Açık dosyada WCAG 2.2 erişilebilirlik sorunlarını tespit eder
            </div>
            <div class="loading-overlay" id="analyzeLoading">
                <div class="spinner"></div>
            </div>
            <span class="sr-only">Analiz butonu - Enter tuşu ile etkinleştirin</span>
        </button>
        
        <button class="action-btn" id="improveBtn" onclick="improveCode()"
                aria-describedby="improve-description">
            <div class="status-indicator" id="improveStatus"></div>
            <div class="action-icon">✨</div>
            <div class="action-title">Mevcut Kodu İyileştir</div>
            <div class="action-description" id="improve-description">
                AI destekli erişilebilirlik iyileştirme önerileri sunar
            </div>
            <div class="loading-overlay" id="improveLoading">
                <div class="spinner"></div>
            </div>
            <span class="sr-only">İyileştirme butonu - Enter tuşu ile etkinleştirin</span>
        </button>
    </div>
    
    <button class="settings-btn" onclick="openWizard()">
        ⚙️ Ayarları Yapılandır
    </button>
    
    <div class="keyboard-hint">
        💡 İpucu: Tab ile navigasyon, Enter ile etkinleştirme
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        let isAnalyzing = false;
        let isImproving = false;
        let hasValidAI = false;
        
        function analyzeCode() {
            if (isAnalyzing) return;
            
            const analyzeBtn = document.getElementById('analyzeBtn');
            const analyzeLoading = document.getElementById('analyzeLoading');
            
            isAnalyzing = true;
            analyzeBtn.classList.add('disabled');
            analyzeLoading.classList.add('active');
            
            // Screen reader announcement
            announceToScreenReader('Kod analizi başlatılıyor');
            
            vscode.postMessage({ type: 'analyzeCode' });
        }
        
        function improveCode() {
            if (isImproving) return;
            
            const improveBtn = document.getElementById('improveBtn');
            const improveLoading = document.getElementById('improveLoading');
            
            isImproving = true;
            improveBtn.classList.add('disabled');
            improveLoading.classList.add('active');
            
            // Screen reader announcement
            announceToScreenReader('Kod iyileştirme başlatılıyor');
            
            vscode.postMessage({ type: 'improveCode' });
        }
        
        function openWizard() {
            announceToScreenReader('Ayar sihirbazı açılıyor');
            vscode.postMessage({ type: 'openWizard' });
        }
        
        function showAlert(message, type = 'success') {
            const alertsContainer = document.getElementById('alerts');
            const alertClass = 'alert-' + type;
            
            alertsContainer.innerHTML = \`
                <div class="alert \${alertClass}" role="alert">
                    \${message}
                </div>
            \`;
            
            // Screen reader için announce
            announceToScreenReader(message);
            
            // 5 saniye sonra alert'i kaldır
            setTimeout(() => {
                alertsContainer.innerHTML = '';
            }, 5000);
        }
        
        function announceToScreenReader(message) {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'assertive');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.textContent = message;
            announcement.style.position = 'absolute';
            announcement.style.left = '-10000px';
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        }
        
        function updateButtonStates() {
            const analyzeBtn = document.getElementById('analyzeBtn');
            const improveBtn = document.getElementById('improveBtn');
            const analyzeStatus = document.getElementById('analyzeStatus');
            const improveStatus = document.getElementById('improveStatus');
            
            if (hasValidAI) {
                analyzeBtn.classList.remove('disabled');
                improveBtn.classList.remove('disabled');
                analyzeStatus.classList.add('ready');
                improveStatus.classList.add('ready');
                analyzeStatus.title = 'AI ayarları yapılandırılmış - Kullanıma hazır';
                improveStatus.title = 'AI ayarları yapılandırılmış - Kullanıma hazır';
            } else {
                analyzeBtn.classList.add('disabled');
                improveBtn.classList.add('disabled');
                analyzeStatus.classList.remove('ready');
                improveStatus.classList.remove('ready');
                analyzeStatus.title = 'AI ayarları eksik - Önce ayarları yapılandırın';
                improveStatus.title = 'AI ayarları eksik - Önce ayarları yapılandırın';
            }
        }
        
        function resetLoadingStates() {
            const analyzeBtn = document.getElementById('analyzeBtn');
            const improveBtn = document.getElementById('improveBtn');
            const analyzeLoading = document.getElementById('analyzeLoading');
            const improveLoading = document.getElementById('improveLoading');
            
            isAnalyzing = false;
            isImproving = false;
            
            analyzeLoading.classList.remove('active');
            improveLoading.classList.remove('active');
            
            updateButtonStates();
        }
        
        // Extension'dan gelen mesajları dinle
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'analysisStarted':
                    showAlert(message.message, 'success');
                    break;
                    
                case 'analysisCompleted':
                    resetLoadingStates();
                    showAlert(message.message, 'success');
                    break;
                    
                case 'improvementStarted':
                    showAlert(message.message, 'success');
                    break;
                    
                case 'improvementCompleted':
                    resetLoadingStates();
                    showAlert(message.message, 'success');
                    break;
                    
                case 'showError':
                    resetLoadingStates();
                    showAlert(message.message, 'error');
                    break;
                    
                case 'showWarning':
                    resetLoadingStates();
                    showAlert(message.message, 'warning');
                    break;
                    
                case 'settingsUpdated':
                    hasValidAI = message.data.hasValidAI;
                    updateButtonStates();
                    break;
            }
        });
        
        // Klavye erişilebilirliği
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName === 'BUTTON') {
                e.target.click();
            }
        });
        
        // İlk yükleme - ayar durumunu kontrol et
        vscode.postMessage({ type: 'checkSettings' });
        
        // Düzenli olarak ayar durumunu kontrol et
        setInterval(() => {
            vscode.postMessage({ type: 'checkSettings' });
        }, 10000); // 10 saniyede bir
    </script>
</body>
</html>
        `;
    }
}
exports.DynamicPanelProvider = DynamicPanelProvider;
//# sourceMappingURL=DynamicPanelProvider.js.map