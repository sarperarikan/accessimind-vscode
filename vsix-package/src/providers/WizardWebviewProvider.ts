import * as vscode from 'vscode';
import { SettingsManager, AIProviderSettings, AccessibilitySettings } from '../settings/SettingsManager';

export class WizardWebviewProvider implements vscode.WebviewViewProvider {
    private webview?: vscode.Webview;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly settingsManager: SettingsManager
    ) {}

    async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): Promise<void> {
        this.webview = webviewView.webview;

        this.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        this.webview.html = await this.getWebviewContent();

        // Listen to webview messages
        this.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        });
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'saveAISettings':
                await this.saveAISettings(message.data);
                break;
            
            case 'saveAccessibilitySettings':
                await this.saveAccessibilitySettings(message.data);
                break;
            
            case 'testConnection':
                await this.testAIConnection(message.data);
                break;
            
            case 'skipSetup':
                await this.skipSetup();
                break;
            
            case 'loadCurrentSettings':
                await this.loadCurrentSettings();
                break;
            
            case 'resetSettings':
                await this.resetAllSettings();
                break;
                
            case 'changeLanguage':
                await this.changeLanguage(message.data.language);
                break;
        }
    }

    private async saveAISettings(data: any): Promise<void> {
        try {
            const aiSettings: AIProviderSettings = {
                provider: data.provider,
                apiKey: data.apiKey || '',
                model: data.model,
                endpoint: data.endpoint
            };

            await this.settingsManager.setAIProviderSettings(aiSettings);
            
            const currentSettings = await this.settingsManager.getAccessibilitySettings();
            const message = currentSettings.language === 'en' 
                ? 'AI provider settings saved successfully!'
                : 'AI sağlayıcısı ayarları başarıyla kaydedildi!';
            
            this.webview?.postMessage({
                type: 'aiSettingsSaved',
                success: true,
                message: message
            });

            // Screen reader announcement
            const announcement = currentSettings.language === 'en'
                ? '🔊 AI provider settings saved'
                : '🔊 AI sağlayıcısı ayarları kaydedildi';
            vscode.window.showInformationMessage(announcement);

        } catch (error) {
            const currentSettings = await this.settingsManager.getAccessibilitySettings();
            const errorMessage = currentSettings.language === 'en'
                ? 'Error saving settings: ' + error
                : 'Ayarlar kaydedilirken hata oluştu: ' + error;
            
            this.webview?.postMessage({
                type: 'aiSettingsSaved',
                success: false,
                message: errorMessage
            });
        }
    }

    private async saveAccessibilitySettings(data: any): Promise<void> {
        try {
            const accessibilitySettings: AccessibilitySettings = {
                wcagLevel: data.wcagLevel || 'AA',
                enableScreenReader: data.enableScreenReader !== false,
                enableVoiceAnnouncements: data.enableVoiceAnnouncements !== false,
                enableKeyboardShortcuts: data.enableKeyboardShortcuts !== false,
                highContrastMode: data.highContrastMode === true,
                detailLevel: data.detailLevel || 'detailed',
                autoDetectIssues: data.autoDetectIssues !== false,
                language: data.language || 'en'
            };

            await this.settingsManager.setAccessibilitySettings(accessibilitySettings);
            
            const message = accessibilitySettings.language === 'en' 
                ? 'Accessibility settings saved successfully!'
                : 'Erişilebilirlik ayarları başarıyla kaydedildi!';
            
            this.webview?.postMessage({
                type: 'accessibilitySettingsSaved',
                success: true,
                message: message
            });

        } catch (error) {
            const currentSettings = await this.settingsManager.getAccessibilitySettings();
            const errorMessage = currentSettings.language === 'en'
                ? 'Error saving settings: ' + error
                : 'Ayarlar kaydedilirken hata oluştu: ' + error;
            
            this.webview?.postMessage({
                type: 'accessibilitySettingsSaved',
                success: false,
                message: errorMessage
            });
        }
    }

    private async testAIConnection(data: any): Promise<void> {
        try {
            const currentSettings = await this.settingsManager.getAccessibilitySettings();
            
            // Import and use AI service manager for real testing
            const { AIServiceManager } = await import('../services/AIServiceManager');
            const aiServiceManager = new AIServiceManager(this.settingsManager);
            
            const testResult = await aiServiceManager.testConnection();
            
            const message = currentSettings.language === 'en'
                ? (testResult ? 'Connection test successful!' : 'Connection test failed!')
                : (testResult ? 'Bağlantı testi başarılı!' : 'Bağlantı testi başarısız!');
            
            this.webview?.postMessage({
                type: 'connectionTested',
                success: testResult,
                message: message
            });
        } catch (error) {
            const currentSettings = await this.settingsManager.getAccessibilitySettings();
            const errorMessage = currentSettings.language === 'en'
                ? 'Connection test failed: ' + error
                : 'Bağlantı testi başarısız: ' + error;
            
            this.webview?.postMessage({
                type: 'connectionTested',
                success: false,
                message: errorMessage
            });
        }
    }

    private async skipSetup(): Promise<void> {
        await this.settingsManager.setFirstTimeSetupComplete();
        
        const currentSettings = await this.settingsManager.getAccessibilitySettings();
        const message = currentSettings.language === 'en'
            ? 'Setup skipped. You can configure settings later.'
            : 'Kurulum atlandı. Daha sonra ayarları yapabilirsiniz.';
        
        this.webview?.postMessage({
            type: 'setupCompleted',
            message: message
        });
    }

    private async loadCurrentSettings(): Promise<void> {
        const aiSettings = await this.settingsManager.getAIProviderSettings();
        const accessibilitySettings = await this.settingsManager.getAccessibilitySettings();
        const isFirstTime = await this.settingsManager.isFirstTimeSetup();

        this.webview?.postMessage({
            type: 'currentSettingsLoaded',
            data: {
                aiSettings,
                accessibilitySettings,
                isFirstTime
            }
        });
    }

    private async resetAllSettings(): Promise<void> {
        const currentSettings = await this.settingsManager.getAccessibilitySettings();
        await this.settingsManager.resetAllSettings();
        
        const message = currentSettings.language === 'en'
            ? 'All settings have been reset.'
            : 'Tüm ayarlar sıfırlandı.';
        
        this.webview?.postMessage({
            type: 'settingsReset',
            message: message
        });
    }

    private async changeLanguage(language: string): Promise<void> {
        const currentSettings = await this.settingsManager.getAccessibilitySettings();
        const newSettings = { ...currentSettings, language: language as 'en' | 'tr' };
        await this.settingsManager.setAccessibilitySettings(newSettings);
        
        // Refresh the webview content
        if (this.webview) {
            this.webview.html = await this.getWebviewContent();
        }
    }

    private async getWebviewContent(): Promise<string> {
        const settings = await this.settingsManager.getAccessibilitySettings();
        const isEnglish = settings.language === 'en';
        
        return `
<!DOCTYPE html>
<html lang="${isEnglish ? 'en' : 'tr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isEnglish ? 'AccessiMind Setup Wizard' : 'AccessiMind Kurulum Sihirbazı'}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        
        .wizard-container {
            max-width: 600px;
            margin: 0 auto;
        }
        
        .step {
            display: none;
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background-color: var(--vscode-editor-background);
        }
        
        .step.active {
            display: block;
        }
        
        .step h2 {
            color: var(--vscode-textLink-foreground);
            margin-top: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .form-group input, .form-group select, .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
            outline: 2px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin: 0;
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            justify-content: space-between;
            margin-top: 30px;
        }
        
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s ease;
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
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 4px;
            margin-bottom: 30px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-background);
            transition: width 0.3s ease;
            border-radius: 4px;
        }
        
        .alert {
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid;
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
        
        .icon {
            font-size: 24px;
        }
        
        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        
        .hidden {
            display: none !important;
        }
        
        /* Accessibility for high contrast mode */
        @media (prefers-contrast: high) {
            .btn {
                border: 2px solid var(--vscode-contrastBorder);
            }
            
            .form-group input, .form-group select, .form-group textarea {
                border: 2px solid var(--vscode-contrastBorder);
            }
        }
        
        /* Screen reader skip link */
        .skip-link {
            position: absolute;
            top: -40px;
            left: 6px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 1000;
        }
        
        .skip-link:focus {
            top: 6px;
        }
    </style>
</head>
<body>
    <a href="#main-content" class="skip-link">${isEnglish ? 'Skip to main content' : 'Ana içeriğe atla'}</a>
    
    <div class="wizard-container" id="main-content" role="main">
        <h1>♿ ${isEnglish ? 'AccessiMind Setup Wizard' : 'AccessiMind Kurulum Sihirbazı'}</h1>
        <p>${isEnglish 
            ? 'Configure your AI-powered VS Code extension for WCAG 2.2 accessibility improvements with Gemini & Copilot integration.'
            : 'WCAG 2.2 erişilebilirlik geliştirmeleri için AI destekli VS Code eklentinizi ayarlayın.'}</p>
        
        <!-- Language Selection -->
        <div class="form-group" style="margin-bottom: 30px; text-align: center;">
            <label for="languageSelect">${isEnglish ? 'Interface Language:' : 'Arayüz Dili:'}</label>
            <select id="languageSelect" onchange="changeLanguage()" style="width: auto; margin: 0 auto;">
                <option value="en" ${isEnglish ? 'selected' : ''}>English</option>
                <option value="tr" ${!isEnglish ? 'selected' : ''}>Türkçe</option>
            </select>
        </div>
        
        <div class="progress-bar" role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="3">
            <div class="progress-fill" id="progressFill" style="width: 33%"></div>
        </div>
        
        <div id="alerts" aria-live="polite" aria-atomic="true"></div>
        
        <!-- Step 1: AI Provider -->
        <div class="step active" id="step1">
            <h2><span class="icon">🤖</span> ${isEnglish ? 'AI Provider Settings' : 'AI Sağlayıcısı Ayarları'}</h2>
            
            <div class="form-group">
                <label for="aiProvider">${isEnglish ? 'AI Provider:' : 'AI Sağlayıcısı:'}</label>
                <select id="aiProvider" required aria-describedby="aiProvider-help" onchange="onProviderChange()">
                    <option value="">${isEnglish ? 'Please select...' : 'Seçiniz...'}</option>
                    <option value="gemini">${isEnglish ? 'Google Gemini 2.0 Flash (Recommended)' : 'Google Gemini 2.0 Flash (Önerilen)'}</option>
                    <option value="copilot">${isEnglish ? 'VS Code Copilot Integration' : 'VS Code Copilot Entegrasyonu'}</option>
                </select>
                <div id="aiProvider-help" class="help-text">${isEnglish ? 'Select the AI model to use for WCAG analysis' : 'WCAG analizi için kullanılacak AI modelini seçin'}</div>
            </div>
            
            <div class="form-group" id="apiKeyGroup">
                <label for="apiKey">${isEnglish ? 'API Key:' : 'API Anahtarı:'}</label>
                <input type="password" id="apiKey" aria-describedby="apiKey-help">
                <div id="apiKey-help" class="help-text">${isEnglish ? 'Your API key will be stored securely locally (not required for Copilot)' : 'API anahtarınız güvenli şekilde yerel olarak saklanacak (Copilot için gerekli değil)'}</div>
            </div>
            
            <div class="form-group" id="modelGroup" style="display: none;">
                <label for="model">${isEnglish ? 'Model (Optional):' : 'Model (Opsiyonel):'}</label>
                <input type="text" id="model" aria-describedby="model-help">
                <div id="model-help" class="help-text">${isEnglish ? 'Custom model name (uses default if empty)' : 'Özel model adı (boş bırakılırsa varsayılan kullanılır)'}</div>
            </div>
            
            <div class="button-group">
                <button type="button" class="btn btn-secondary" onclick="testConnection()">🔍 ${isEnglish ? 'Test Connection' : 'Bağlantıyı Test Et'}</button>
                <button type="button" class="btn btn-primary" onclick="nextStep()">${isEnglish ? 'Next →' : 'İleri →'}</button>
            </div>
        </div>
        
        <!-- Step 2: Accessibility Settings -->
        <div class="step" id="step2">
            <h2><span class="icon">♿</span> ${isEnglish ? 'Accessibility Preferences' : 'Erişilebilirlik Tercihleri'}</h2>
            
            <div class="form-group">
                <label for="wcagLevel">${isEnglish ? 'WCAG Level:' : 'WCAG Seviyesi:'}</label>
                <select id="wcagLevel" aria-describedby="wcagLevel-help">
                    <option value="A">${isEnglish ? 'WCAG A (Basic)' : 'WCAG A (Temel)'}</option>
                    <option value="AA" selected>${isEnglish ? 'WCAG AA (Standard - Recommended)' : 'WCAG AA (Standart - Önerilen)'}</option>
                    <option value="AAA">${isEnglish ? 'WCAG AAA (Advanced)' : 'WCAG AAA (Gelişmiş)'}</option>
                </select>
                <div id="wcagLevel-help" class="help-text">${isEnglish ? 'Higher levels include stricter accessibility rules' : 'Daha yüksek seviyeler daha sıkı erişilebilirlik kuralları içerir'}</div>
            </div>
            
            <div class="form-group">
                <label for="detailLevel">${isEnglish ? 'Analysis Detail Level:' : 'Analiz Detay Seviyesi:'}</label>
                <select id="detailLevel" aria-describedby="detailLevel-help">
                    <option value="basic">${isEnglish ? 'Basic - Essential issues only' : 'Temel - Sadece önemli sorunlar'}</option>
                    <option value="detailed" selected>${isEnglish ? 'Detailed - Comprehensive analysis' : 'Detaylı - Kapsamlı analiz'}</option>
                    <option value="comprehensive">${isEnglish ? 'Comprehensive - In-depth with examples' : 'Kapsamlı - Örneklerle derinlemesine'}</option>
                </select>
                <div id="detailLevel-help" class="help-text">${isEnglish ? 'Controls how detailed the accessibility analysis will be' : 'Erişilebilirlik analizinin ne kadar detaylı olacağını kontrol eder'}</div>
            </div>
            
            <div class="checkbox-group">
                <input type="checkbox" id="autoDetectIssues" checked>
                <label for="autoDetectIssues">${isEnglish ? 'Auto-detect WCAG Issues' : 'WCAG Sorunlarını Otomatik Tespit Et'}</label>
            </div>
            
            <div class="checkbox-group">
                <input type="checkbox" id="enableScreenReader" checked>
                <label for="enableScreenReader">${isEnglish ? 'Screen Reader Support Enabled' : 'Screen Reader Desteği Etkin'}</label>
            </div>
            
            <div class="checkbox-group">
                <input type="checkbox" id="enableVoiceAnnouncements" checked>
                <label for="enableVoiceAnnouncements">${isEnglish ? 'Voice Announcements Enabled' : 'Sesli Bildirimler Etkin'}</label>
            </div>
            
            <div class="checkbox-group">
                <input type="checkbox" id="enableKeyboardShortcuts" checked>
                <label for="enableKeyboardShortcuts">${isEnglish ? 'Keyboard Shortcuts Enabled' : 'Klavye Kısayolları Etkin'}</label>
            </div>
            
            <div class="checkbox-group">
                <input type="checkbox" id="highContrastMode">
                <label for="highContrastMode">${isEnglish ? 'High Contrast Mode' : 'Yüksek Kontrast Modu'}</label>
            </div>
            
            <div class="button-group">
                <button type="button" class="btn btn-secondary" onclick="prevStep()">${isEnglish ? '← Back' : '← Geri'}</button>
                <button type="button" class="btn btn-primary" onclick="nextStep()">${isEnglish ? 'Next →' : 'İleri →'}</button>
            </div>
        </div>
        
        <!-- Step 3: Completion -->
        <div class="step" id="step3">
            <h2><span class="icon">✅</span> ${isEnglish ? 'Setup Complete' : 'Kurulum Tamamlandı'}</h2>
            <p>${isEnglish 
                ? 'AccessiMind has been successfully configured! You can now start improving your code accessibility with AI-powered assistance.'
                : 'AccessiMind başarıyla yapılandırıldı! Artık AI destekli yardımla kod erişilebilirliğinizi geliştirmeye başlayabilirsiniz.'}</p>
            
            <div class="alert alert-success">
                <strong>🎉 ${isEnglish ? 'Congratulations!' : 'Tebrikler!'}</strong> ${isEnglish 
                    ? 'Your extension is ready to use. Start from the AccessiMind panel in the activity bar.'
                    : 'Extension\'ınız kullanıma hazır. Activity bar\'daki AccessiMind panelinden başlayabilirsiniz.'}
            </div>
            
            <h3>${isEnglish ? 'Usage Tips:' : 'Kullanım İpuçları:'}</h3>
            <ul>
                <li><strong>Ctrl+Shift+A</strong> - ${isEnglish ? 'Analyze current code' : 'Mevcut kodu analiz et'}</li>
                <li><strong>Ctrl+Shift+I</strong> - ${isEnglish ? 'Improve current code' : 'Mevcut kodu iyileştir'}</li>
                <li><strong>Ctrl+Shift+D</strong> - ${isEnglish ? 'Auto-detect WCAG issues' : 'WCAG sorunlarını otomatik tespit et'}</li>
                <li>${isEnglish ? 'Click the ♿ icon in the activity bar' : 'Activity bar\'daki ♿ simgesine tıklayın'}</li>
                <li>${isEnglish ? 'Right-click in any HTML/CSS/JS file → "AccessiMind"' : 'Herhangi bir HTML/CSS/JS dosyasında sağ tık → "AccessiMind"'}</li>
                <li>${isEnglish ? 'Run this wizard again to change settings' : 'Ayarları değiştirmek için bu sihirbazı tekrar çalıştırın'}</li>
            </ul>
            
            <div class="button-group">
                <button type="button" class="btn btn-secondary" onclick="prevStep()">${isEnglish ? '← Back' : '← Geri'}</button>
                <button type="button" class="btn btn-primary" onclick="completeSetup()">🚀 ${isEnglish ? 'Let\'s Start!' : 'Başlayalım!'}</button>
            </div>
        </div>
        
        <!-- Current settings and reset buttons -->
        <div style="text-align: center; margin-top: 30px;">
            <button type="button" class="btn btn-secondary" onclick="loadCurrentSettings()">📋 ${isEnglish ? 'Load Current Settings' : 'Mevcut Ayarları Yükle'}</button>
            <button type="button" class="btn btn-secondary" onclick="resetSettings()">🗑️ ${isEnglish ? 'Reset Settings' : 'Ayarları Sıfırla'}</button>
        </div>
    </div>
    
    <script>
        let currentStep = 1;
        const totalSteps = 3;
        
        // Webview API
        const vscode = acquireVsCodeApi();
        
        function changeLanguage() {
            const languageSelect = document.getElementById('languageSelect');
            const selectedLanguage = languageSelect.value;
            
            vscode.postMessage({
                type: 'changeLanguage',
                data: { language: selectedLanguage }
            });
        }
        
        function onProviderChange() {
            const provider = document.getElementById('aiProvider').value;
            const apiKeyGroup = document.getElementById('apiKeyGroup');
            const modelGroup = document.getElementById('modelGroup');
            const apiKeyInput = document.getElementById('apiKey');
            
            if (provider === 'copilot') {
                apiKeyGroup.style.display = 'none';
                apiKeyInput.required = false;
                modelGroup.style.display = 'none';
            } else if (provider === 'gemini') {
                apiKeyGroup.style.display = 'block';
                apiKeyInput.required = true;
                modelGroup.style.display = 'block';
            } else {
                apiKeyGroup.style.display = 'block';
                apiKeyInput.required = true;
                modelGroup.style.display = 'none';
            }
        }
        
        function showAlert(message, type = 'success') {
            const alertsContainer = document.getElementById('alerts');
            const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
            
            alertsContainer.innerHTML = \`
                <div class="alert \${alertClass}" role="alert">
                    \${message}
                </div>
            \`;
            
            // Screen reader announcement
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
            
            // Remove alert after 5 seconds
            setTimeout(() => {
                alertsContainer.innerHTML = '';
            }, 5000);
        }
        
        function updateProgress() {
            const progressFill = document.getElementById('progressFill');
            const progressBar = progressFill.parentElement;
            const percentage = (currentStep / totalSteps) * 100;
            
            progressFill.style.width = percentage + '%';
            progressBar.setAttribute('aria-valuenow', currentStep);
        }
        
        function showStep(stepNumber) {
            // Hide all steps
            for (let i = 1; i <= totalSteps; i++) {
                document.getElementById('step' + i).classList.remove('active');
            }
            
            // Show current step
            document.getElementById('step' + stepNumber).classList.add('active');
            currentStep = stepNumber;
            updateProgress();
            
            // Focus first input
            const activeStep = document.getElementById('step' + stepNumber);
            const firstInput = activeStep.querySelector('input, select, button');
            if (firstInput) {
                firstInput.focus();
            }
        }
        
        function nextStep() {
            if (currentStep === 1) {
                // Validate and save AI settings
                const provider = document.getElementById('aiProvider').value;
                const apiKey = document.getElementById('apiKey').value;
                const model = document.getElementById('model').value;
                
                if (!provider) {
                    showAlert('Please select an AI provider.', 'error');
                    return;
                }
                
                if (provider === 'gemini' && !apiKey) {
                    showAlert('Please enter your Gemini API key.', 'error');
                    return;
                }
                
                vscode.postMessage({
                    type: 'saveAISettings',
                    data: {
                        provider,
                        apiKey,
                        model: model || undefined
                    }
                });
                
            } else if (currentStep === 2) {
                // Save accessibility settings
                const wcagLevel = document.getElementById('wcagLevel').value;
                const detailLevel = document.getElementById('detailLevel').value;
                const autoDetectIssues = document.getElementById('autoDetectIssues').checked;
                const enableScreenReader = document.getElementById('enableScreenReader').checked;
                const enableVoiceAnnouncements = document.getElementById('enableVoiceAnnouncements').checked;
                const enableKeyboardShortcuts = document.getElementById('enableKeyboardShortcuts').checked;
                const highContrastMode = document.getElementById('highContrastMode').checked;
                const language = document.getElementById('languageSelect').value;
                
                vscode.postMessage({
                    type: 'saveAccessibilitySettings',
                    data: {
                        wcagLevel,
                        detailLevel,
                        autoDetectIssues,
                        enableScreenReader,
                        enableVoiceAnnouncements,
                        enableKeyboardShortcuts,
                        highContrastMode,
                        language
                    }
                });
            }
            
            if (currentStep < totalSteps) {
                showStep(currentStep + 1);
            }
        }
        
        function prevStep() {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        }
        
        function testConnection() {
            const provider = document.getElementById('aiProvider').value;
            const apiKey = document.getElementById('apiKey').value;
            
            if (!provider) {
                showAlert('Please select an AI provider first.', 'error');
                return;
            }
            
            if (provider === 'gemini' && !apiKey) {
                showAlert('Please enter your API key first.', 'error');
                return;
            }
            
            showAlert('Testing connection...', 'success');
            
            vscode.postMessage({
                type: 'testConnection',
                data: { provider, apiKey }
            });
        }
        
        function completeSetup() {
            showAlert('🎉 Setup completed! AccessiMind is ready to use.', 'success');
            
            // Close panel after a delay
            setTimeout(() => {
                vscode.postMessage({ type: 'setupCompleted' });
            }, 2000);
        }
        
        function loadCurrentSettings() {
            vscode.postMessage({ type: 'loadCurrentSettings' });
        }
        
        function resetSettings() {
            if (confirm('Are you sure you want to reset all settings?')) {
                vscode.postMessage({ type: 'resetSettings' });
            }
        }
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'aiSettingsSaved':
                    if (message.success) {
                        showAlert(message.message, 'success');
                        if (currentStep === 1) {
                            setTimeout(() => showStep(2), 1000);
                        }
                    } else {
                        showAlert(message.message, 'error');
                    }
                    break;
                    
                case 'accessibilitySettingsSaved':
                    if (message.success) {
                        showAlert(message.message, 'success');
                        if (currentStep === 2) {
                            setTimeout(() => showStep(3), 1000);
                        }
                    } else {
                        showAlert(message.message, 'error');
                    }
                    break;
                    
                case 'connectionTested':
                    if (message.success) {
                        showAlert('✅ ' + message.message, 'success');
                    } else {
                        showAlert('❌ ' + message.message, 'error');
                    }
                    break;
                    
                case 'currentSettingsLoaded':
                    const { aiSettings, accessibilitySettings, isFirstTime } = message.data;
                    
                    if (aiSettings) {
                        document.getElementById('aiProvider').value = aiSettings.provider || '';
                        document.getElementById('apiKey').value = aiSettings.apiKey || '';
                        document.getElementById('model').value = aiSettings.model || '';
                        onProviderChange();
                    }
                    
                    if (accessibilitySettings) {
                        document.getElementById('wcagLevel').value = accessibilitySettings.wcagLevel || 'AA';
                        document.getElementById('detailLevel').value = accessibilitySettings.detailLevel || 'detailed';
                        document.getElementById('autoDetectIssues').checked = accessibilitySettings.autoDetectIssues !== false;
                        document.getElementById('enableScreenReader').checked = accessibilitySettings.enableScreenReader !== false;
                        document.getElementById('enableVoiceAnnouncements').checked = accessibilitySettings.enableVoiceAnnouncements !== false;
                        document.getElementById('enableKeyboardShortcuts').checked = accessibilitySettings.enableKeyboardShortcuts !== false;
                        document.getElementById('highContrastMode').checked = accessibilitySettings.highContrastMode === true;
                        document.getElementById('languageSelect').value = accessibilitySettings.language || 'en';
                    }
                    
                    showAlert('Current settings loaded.', 'success');
                    break;
                    
                case 'settingsReset':
                    showAlert(message.message, 'success');
                    // Reset form
                    document.querySelectorAll('input, select').forEach(input => {
                        if (input.type === 'checkbox') {
                            input.checked = input.id === 'autoDetectIssues' ||
                                          input.id === 'enableScreenReader' || 
                                          input.id === 'enableVoiceAnnouncements' || 
                                          input.id === 'enableKeyboardShortcuts';
                        } else if (input.id === 'wcagLevel') {
                            input.value = 'AA';
                        } else if (input.id === 'detailLevel') {
                            input.value = 'detailed';
                        } else if (input.id === 'languageSelect') {
                            input.value = 'en';
                        } else {
                            input.value = '';
                        }
                    });
                    showStep(1);
                    break;
            }
        });
        
        // Keyboard accessibility
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName === 'BUTTON') {
                e.target.click();
            }
        });
        
        // Initialize
        onProviderChange();
        loadCurrentSettings();
    </script>
</body>
</html>
        `;
    }
}