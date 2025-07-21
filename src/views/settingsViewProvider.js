"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettingsTabHtml = void 0;
function getSettingsTabHtml() {
    return `
	<div class="settings-tab-content" role="region" aria-label="Ayarlar Bölümü">
		<div class="settings-header">
			<h2>⚙️ WCAG AI Ayarları</h2>
			<div class="settings-controls">
				<button class="save-button" onclick="saveAllSettings()" aria-label="Tüm ayarları kaydet">
					💾 Kaydet
				</button>
				<button class="reset-button" onclick="resetToDefaults()" aria-label="Varsayılan ayarlara dön">
					🔄 Varsayılan
				</button>
			</div>
		</div>

		<div class="settings-sections">
			<div class="settings-section">
				<h3>🤖 AI Model Ayarları</h3>
				<div class="setting-group">
					<div class="setting-item">
						<label for="defaultModel">Varsayılan Model:</label>
						<select id="defaultModel" class="setting-input">
							<option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Hızlı) - En hızlı yanıt</option>
							<option value="gemini-2.0-flash">Gemini 2.0 Flash (Standart) - Dengeli performans</option>
							<option value="gemini-1.5-flash">Gemini 1.5 Flash - En yüksek kalite</option>
						</select>
						<div class="setting-description">WCAG iyileştirmeleri için kullanılacak varsayılan AI modeli</div>
					</div>

					<div class="setting-item">
						<label for="apiKey">Gemini API Anahtarı:</label>
						<input type="password" id="apiKey" class="setting-input" placeholder="API anahtarınızı girin">
						<div class="setting-description">Gemini API'ye erişim için gerekli API anahtarı</div>
					</div>

					<div class="setting-item">
						<label for="maxTokens">Maksimum Token:</label>
						<input type="number" id="maxTokens" class="setting-input" min="100" max="8192" value="4096">
						<div class="setting-description">AI yanıtları için maksimum token sayısı (100-8192)</div>
					</div>

					<div class="setting-item">
						<label for="temperature">Sıcaklık:</label>
						<input type="range" id="temperature" class="setting-slider" min="0" max="2" step="0.1" value="0.7">
						<span class="slider-value" id="temperatureValue">0.7</span>
						<div class="setting-description">AI yaratıcılık seviyesi (0: Tutarlı, 2: Yaratıcı)</div>
					</div>
				</div>
			</div>

			<div class="settings-section">
				<h3>🎯 WCAG İyileştirme Ayarları</h3>
				<div class="setting-group">
					<div class="setting-item">
						<label for="wcagLevel">WCAG Seviyesi:</label>
						<select id="wcagLevel" class="setting-input">
							<option value="A">Seviye A - Temel erişilebilirlik</option>
							<option value="AA" selected>Seviye AA - Standart erişilebilirlik (Önerilen)</option>
							<option value="AAA">Seviye AAA - Yüksek erişilebilirlik</option>
						</select>
						<div class="setting-description">Hedeflenen WCAG uyumluluk seviyesi</div>
					</div>

					<div class="setting-item">
						<label for="autoApply">Otomatik Uygulama:</label>
						<div class="toggle-container">
							<input type="checkbox" id="autoApply" class="toggle-input">
							<label for="autoApply" class="toggle-label"></label>
						</div>
						<div class="setting-description">AI önerilerini otomatik olarak koda uygula</div>
					</div>

					<div class="setting-item">
						<label for="includeComments">Açıklama Ekle:</label>
						<div class="toggle-container">
							<input type="checkbox" id="includeComments" class="toggle-input" checked>
							<label for="includeComments" class="toggle-label"></label>
						</div>
						<div class="setting-description">WCAG iyileştirmelerine açıklayıcı yorumlar ekle</div>
					</div>

					<div class="setting-item">
						<label for="preferredLanguage">Tercih Edilen Dil:</label>
						<select id="preferredLanguage" class="setting-input">
							<option value="tr" selected>Türkçe</option>
							<option value="en">İngilizce</option>
							<option value="auto">Otomatik Algıla</option>
						</select>
						<div class="setting-description">AI yanıtları için tercih edilen dil</div>
					</div>
				</div>
			</div>

			<div class="settings-section">
				<h3>🔧 Gelişmiş Ayarlar</h3>
				<div class="setting-group">
					<div class="setting-item">
						<label for="timeout">Zaman Aşımı (saniye):</label>
						<input type="number" id="timeout" class="setting-input" min="10" max="300" value="60">
						<div class="setting-description">API istekleri için zaman aşımı süresi</div>
					</div>

					<div class="setting-item">
						<label for="retryAttempts">Yeniden Deneme:</label>
						<input type="number" id="retryAttempts" class="setting-input" min="0" max="5" value="2">
						<div class="setting-description">Başarısız istekler için yeniden deneme sayısı</div>
					</div>

					<div class="setting-item">
						<label for="enableLogging">Detaylı Loglama:</label>
						<div class="toggle-container">
							<input type="checkbox" id="enableLogging" class="toggle-input">
							<label for="enableLogging" class="toggle-label"></label>
						</div>
						<div class="setting-description">Hata ayıklama için detaylı log kayıtları</div>
					</div>

					<div class="setting-item">
						<label for="autoSave">Otomatik Kaydet:</label>
						<div class="toggle-container">
							<input type="checkbox" id="autoSave" class="toggle-input" checked>
							<label for="autoSave" class="toggle-label"></label>
						</div>
						<div class="setting-description">Ayarları otomatik olarak kaydet</div>
					</div>
				</div>
			</div>

			<div class="settings-section">
				<h3>📊 İstatistik ve Analiz</h3>
				<div class="setting-group">
					<div class="setting-item">
						<label for="trackUsage">Kullanım İstatistikleri:</label>
						<div class="toggle-container">
							<input type="checkbox" id="trackUsage" class="toggle-input" checked>
							<label for="trackUsage" class="toggle-label"></label>
						</div>
						<div class="setting-description">AI kullanım istatistiklerini topla ve göster</div>
					</div>

					<div class="setting-item">
						<label for="performanceMetrics">Performans Metrikleri:</label>
						<div class="toggle-container">
							<input type="checkbox" id="performanceMetrics" class="toggle-input" checked>
							<label for="performanceMetrics" class="toggle-label"></label>
						</div>
						<div class="setting-description">Yanıt süreleri ve token kullanımını takip et</div>
					</div>

					<div class="setting-item">
						<label for="wcagTracking">WCAG Kriter Takibi:</label>
						<div class="toggle-container">
							<input type="checkbox" id="wcagTracking" class="toggle-input" checked>
							<label for="wcagTracking" class="toggle-label"></label>
						</div>
						<div class="setting-description">Hangi WCAG kriterlerinin kullanıldığını takip et</div>
					</div>
				</div>
			</div>

			<div class="settings-section">
				<h3>🎨 Görünüm Ayarları</h3>
				<div class="setting-group">
					<div class="setting-item">
						<label for="theme">Tema:</label>
						<select id="theme" class="setting-input">
							<option value="auto" selected>VS Code Temasına Uy</option>
							<option value="light">Açık Tema</option>
							<option value="dark">Koyu Tema</option>
						</select>
						<div class="setting-description">Chat arayüzü için tema seçimi</div>
					</div>

					<div class="setting-item">
						<label for="fontSize">Yazı Boyutu:</label>
						<select id="fontSize" class="setting-input">
							<option value="small">Küçük</option>
							<option value="medium" selected>Orta</option>
							<option value="large">Büyük</option>
						</select>
						<div class="setting-description">Chat arayüzü yazı boyutu</div>
					</div>

					<div class="setting-item">
						<label for="compactMode">Kompakt Mod:</label>
						<div class="toggle-container">
							<input type="checkbox" id="compactMode" class="toggle-input">
							<label for="compactMode" class="toggle-label"></label>
						</div>
						<div class="setting-description">Daha az yer kaplayan kompakt görünüm</div>
					</div>
				</div>
			</div>
		</div>

		<div class="settings-footer">
			<div class="settings-info">
				<p><strong>💡 İpucu:</strong> Ayarları değiştirdikten sonra "Kaydet" butonuna tıklayın.</p>
				<p><strong>🔗 API Anahtarı:</strong> Gemini API anahtarınızı <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a>'dan alabilirsiniz.</p>
			</div>
		</div>

		<style>
			.settings-tab-content {
				padding: 16px;
				height: 100%;
				overflow-y: auto;
			}
			.settings-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 24px;
				padding-bottom: 16px;
				border-bottom: 1px solid var(--vscode-panel-border);
			}
			.settings-header h2 {
				margin: 0;
				font-size: 18px;
				font-weight: 600;
			}
			.settings-controls {
				display: flex;
				gap: 8px;
			}
			.settings-controls button {
				padding: 8px 16px;
				border: none;
				border-radius: 6px;
				font-size: 12px;
				cursor: pointer;
				transition: all 0.2s ease;
				display: flex;
				align-items: center;
				gap: 6px;
			}
			.save-button {
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
			}
			.save-button:hover {
				background-color: var(--vscode-button-hoverBackground);
			}
			.reset-button {
				background-color: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
				border: 1px solid var(--vscode-button-border);
			}
			.reset-button:hover {
				background-color: var(--vscode-button-secondaryHoverBackground);
			}
			.settings-sections {
				display: flex;
				flex-direction: column;
				gap: 24px;
			}
			.settings-section {
				background-color: var(--vscode-editor-background);
				border: 1px solid var(--vscode-panel-border);
				border-radius: 8px;
				padding: 20px;
			}
			.settings-section h3 {
				margin: 0 0 16px 0;
				font-size: 16px;
				font-weight: 600;
				color: var(--vscode-editor-foreground);
			}
			.setting-group {
				display: flex;
				flex-direction: column;
				gap: 20px;
			}
			.setting-item {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.setting-item label {
				font-size: 13px;
				font-weight: 500;
				color: var(--vscode-editor-foreground);
			}
			.setting-input {
				padding: 8px 12px;
				border: 1px solid var(--vscode-panel-border);
				border-radius: 6px;
				background-color: var(--vscode-input-background);
				color: var(--vscode-input-foreground);
				font-size: 13px;
				font-family: inherit;
			}
			.setting-input:focus {
				outline: none;
				border-color: var(--vscode-focusBorder);
			}
			.setting-slider {
				width: 100%;
				height: 6px;
				border-radius: 3px;
				background: var(--vscode-panel-border);
				outline: none;
				-webkit-appearance: none;
			}
			.setting-slider::-webkit-slider-thumb {
				-webkit-appearance: none;
				appearance: none;
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background: var(--vscode-button-background);
				cursor: pointer;
			}
			.setting-slider::-moz-range-thumb {
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background: var(--vscode-button-background);
				cursor: pointer;
				border: none;
			}
			.slider-value {
				font-size: 12px;
				font-weight: 600;
				color: var(--vscode-editor-foreground);
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				padding: 2px 8px;
				border-radius: 12px;
				display: inline-block;
				min-width: 30px;
				text-align: center;
			}
			.setting-description {
				font-size: 11px;
				color: var(--vscode-descriptionForeground);
				line-height: 1.4;
			}
			.toggle-container {
				position: relative;
				display: inline-block;
			}
			.toggle-input {
				opacity: 0;
				width: 0;
				height: 0;
			}
			.toggle-label {
				display: inline-block;
				width: 44px;
				height: 24px;
				background-color: var(--vscode-panel-border);
				border-radius: 12px;
				position: relative;
				cursor: pointer;
				transition: background-color 0.3s ease;
			}
			.toggle-label:before {
				content: '';
				position: absolute;
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background-color: white;
				top: 3px;
				left: 3px;
				transition: transform 0.3s ease;
			}
			.toggle-input:checked + .toggle-label {
				background-color: var(--vscode-button-background);
			}
			.toggle-input:checked + .toggle-label:before {
				transform: translateX(20px);
			}
			.settings-footer {
				margin-top: 32px;
				padding: 16px;
				background-color: var(--vscode-list-hoverBackground);
				border-radius: 8px;
			}
			.settings-info {
				font-size: 12px;
				color: var(--vscode-descriptionForeground);
				line-height: 1.5;
			}
			.settings-info p {
				margin: 0 0 8px 0;
			}
			.settings-info a {
				color: var(--vscode-textLink-foreground);
				text-decoration: none;
			}
			.settings-info a:hover {
				text-decoration: underline;
			}
		</style>
	</div>
	`;
}
exports.getSettingsTabHtml = getSettingsTabHtml;
