import * as vscode from "vscode";

export interface LocalizationStrings {
	[key: string]: {
		en: string
		tr: string
	}
}

export class LocalizationManager {
	private static instance: LocalizationManager;
	private currentLanguage: string = "en";
	private strings: LocalizationStrings = {
		// Genel mesajlar
		"extension.activated": {
			en: "AccessiMind is now active!",
			tr: "AccessiMind aktif!"
		},
		"extension.deactivated": {
			en: "AccessiMind has been deactivated.",
			tr: "AccessiMind devre dışı bırakıldı."
		},

		// Hata mesajları
		"error.no.active.editor": {
			en: "No active editor found",
			tr: "Aktif editör bulunamadı"
		},
		"error.no.selection": {
			en: "No text selected",
			tr: "Metin seçilmedi"
		},
		"error.unsupported.file.type": {
			en: "This file type is not supported!",
			tr: "Bu dosya türü desteklenmiyor!"
		},
		"error.api.key.not.found": {
			en: "Gemini API key not found. Please enter it in settings.",
			tr: "Gemini API anahtarı bulunamadı. Lütfen ayarlardan girin."
		},
		"error.timeout": {
			en: "Request timed out. Please try with smaller code sections or check your internet connection.",
			tr: "İstek zaman aşımına uğradı. Lütfen daha küçük kod parçaları ile deneyin veya internet bağlantınızı kontrol edin."
		},
		"error.api.key.invalid": {
			en: "API key error:",
			tr: "API anahtarı hatası:"
		},
		"error.unknown": {
			en: "Unknown error",
			tr: "Bilinmeyen hata"
		},
		"error.api.key.missing": {
			en: "API key not found. Please enter your API key in settings.",
			tr: "API anahtarı bulunamadı. Lütfen ayarlardan API anahtarınızı girin."
		},
		"error.api.timeout": {
			en: "API request timed out. Please try again.",
			tr: "API isteği zaman aşımına uğradı. Lütfen tekrar deneyin."
		},
		"error.api.failed": {
			en: "API request failed. Please check your connection and try again.",
			tr: "API isteği başarısız oldu. Bağlantınızı kontrol edin ve tekrar deneyin."
		},
		"error.api.invalid.response": {
			en: "API response is invalid or empty. Please check your API key and model settings.",
			tr: "API yanıtı geçersiz veya boş. Lütfen API anahtarınızı ve model ayarlarınızı kontrol edin."
		},
		"error.api.rate.limited": {
			en: "API rate limit exceeded. Please wait a few minutes and try again.",
			tr: "API rate limit aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin."
		},
		"error.api.server.error": {
			en: "API server error. Please try again later.",
			tr: "API sunucu hatası. Lütfen daha sonra tekrar deneyin."
		},
		"error.api.key.format": {
			en: "API key format is invalid. Please enter a valid Gemini API key.",
			tr: "API anahtarı formatı geçersiz. Lütfen geçerli bir Gemini API anahtarı girin."
		},
		"error.empty.code": {
			en: "❌ Code to improve is empty",
			tr: "❌ İyileştirilecek kod boş"
		},
		"error.improvement.failed.detail": {
			en: "❌ Improvement failed: %ERROR%",
			tr: "❌ İyileştirme başarısız: %ERROR%"
		},
		"error.improvement.exception.detail": {
			en: "❌ WCAG improvement error: %ERROR%",
			tr: "❌ WCAG iyileştirme hatası: %ERROR%"
		},
		"settings.updated": {
			en: "AI settings updated successfully",
			tr: "AI ayarları başarıyla güncellendi"
		},
		"settings.error.config.missing": {
			en: "AI configuration is missing",
			tr: "AI yapılandırması eksik"
		},
		"settings.error.provider.missing": {
			en: "AI provider not selected",
			tr: "AI sağlayıcısı seçilmemiş"
		},
		"settings.error.apikey.missing": {
			en: "Gemini API key is required for this provider",
			tr: "Bu sağlayıcı için Gemini API anahtarı gerekli"
		},
		"settings.valid": {
			en: "Settings are valid",
			tr: "Ayarlar geçerli"
		},
		"settings.test.failed": {
			en: "AI connection test failed",
			tr: "AI bağlantı testi başarısız"
		},
		"settings.info.copilot.selected": {
			en: "GitHub Copilot provider selected",
			tr: "GitHub Copilot sağlayıcısı seçildi"
		},
		"settings.warn.gemini.key.missing": {
			en: "Gemini API key is missing or empty",
			tr: "Gemini API anahtarı eksik veya boş"
		},
		"persistent.settings.restored": {
			en: "✅ AccessiMind settings successfully restored!",
			tr: "✅ AccessiMind ayarları başarıyla geri yüklendi!"
		},
		"persistent.settings.cleared": {
			en: "🗑️ AccessiMind persistent settings cleared",
			tr: "🗑️ AccessiMind kalıcı ayarları temizlendi"
		},
		"persistent.settings.exported": {
			en: "✅ AccessiMind settings successfully exported!",
			tr: "✅ AccessiMind ayarları başarıyla dışa aktarıldı!"
		},
		"persistent.settings.imported": {
			en: "✅ AccessiMind settings successfully imported and applied!",
			tr: "✅ AccessiMind ayarları başarıyla içe aktarıldı ve uygulandı!"
		},
		"persistent.settings.no.data": {
			en: "⚠️ No persistent settings found to export",
			tr: "⚠️ Dışa aktarılacak kalıcı ayar bulunamadı"
		},
		"persistent.settings.error.restore": {
			en: "❌ Settings restore error: %ERROR%",
			tr: "❌ Ayarları geri yükleme hatası: %ERROR%"
		},
		"persistent.settings.error.export": {
			en: "❌ Settings export error: %ERROR%",
			tr: "❌ Ayarları dışa aktarma hatası: %ERROR%"
		},
		"persistent.settings.error.import": {
			en: "❌ Settings import error: %ERROR%",
			tr: "❌ Ayarları içe aktarma hatası: %ERROR%"
		},
		"json.settings.applied": {
			en: "✅ AccessiMind settings have been applied!",
			tr: "✅ AccessiMind ayarları uygulandı!"
		},
		"json.settings.apply.error": {
			en: "❌ Error applying settings: %ERROR%",
			tr: "❌ Ayarları uygularken hata oluştu: %ERROR%"
		},
		"json.file.deleted": {
			en: "⚠️ AccessiMind setting file deleted!",
			tr: "⚠️ AccessiMind ayar dosyası silindi!"
		},
		"json.file.corrupted": {
			en: "⚠️ AccessiMind setting file was corrupted and recreated. Old file backed up to: %PATH%",
			tr: "⚠️ AccessiMind ayar dosyası bozuktu ve yeniden oluşturuldu. Eski dosya şu konuma yedeklendi: %PATH%"
		},
		"json.file.fallback": {
			en: "⚠️ AccessiMind setting file could not be created in workspace. Using fallback location: %PATH%",
			tr: "⚠️ AccessiMind ayar dosyası workspace'de oluşturulamadı. Geçici konum kullanılıyor: %PATH%"
		},
		"json.file.read.error": {
			en: "⚠️ AccessiMind settings file could not be read. Temporary settings will be used in this session.",
			tr: "⚠️ AccessiMind ayar dosyası okunamadı. Bu oturumda geçici ayarlar kullanılacak."
		},
		"json.file.repaired": {
			en: "🔧 AccessiMind JSON file repaired!",
			tr: "🔧 AccessiMind JSON dosyası onarıldı!"
		},

		// Başarı mesajları
		"success.file.improved": {
			en: "File successfully improved!",
			tr: "Dosya başarıyla iyileştirildi!"
		},
		"success.code.improved": {
			en: "Code improved successfully",
			tr: "Kod başarıyla iyileştirildi"
		},
		"success.api.key.saved": {
			en: "API key successfully saved!",
			tr: "API anahtarı başarıyla kaydedildi!"
		},
		"success.api.key.working": {
			en: "Gemini API key is working successfully.",
			tr: "Gemini API anahtarı başarılı şekilde çalışıyor."
		},
		"success.alt.text.added": {
			en: "Alt text successfully added!",
			tr: "Alt text başarıyla eklendi!"
		},
		"success.aria.labels.added": {
			en: "ARIA labels successfully added!",
			tr: "ARIA etiketleri başarıyla eklendi!"
		},
		"success.semantics.optimized": {
			en: "Semantic structure successfully optimized!",
			tr: "Semantik yapı başarıyla optimize edildi!"
		},
		"success.form.generated": {
			en: "Accessible form generated!",
			tr: "Erişilebilir form oluşturuldu!"
		},
		"success.suggestions.ready": {
			en: "WCAG suggestions ready!",
			tr: "WCAG önerileri hazırlandı!"
		},
		"success.validation.ready": {
			en: "Accessibility validation report ready!",
			tr: "Erişilebilirlik doğrulama raporu hazırlandı!"
		},
		"success.stats.reset": {
			en: "Statistics reset!",
			tr: "İstatistikler sıfırlandı!"
		},
		"success.analysis.complete": {
			en: "Analysis completed successfully",
			tr: "Analiz başarıyla tamamlandı"
		},
		"success.stats.updated": {
			en: "Statistics updated",
			tr: "İstatistikler güncellendi"
		},
		"success.api.diagnostics.complete": {
			en: "API diagnostics completed successfully",
			tr: "API tanılama başarıyla tamamlandı"
		},
		"success.api.connection.test": {
			en: "API connection test successful",
			tr: "API bağlantı testi başarılı"
		},

		// İşlem mesajları
		"progress.improving.file": {
			en: "Improving file...",
			tr: "Dosya iyileştiriliyor..."
		},
		"progress.improving.code": {
			en: "Improving selected code...",
			tr: "Seçili kod iyileştiriliyor..."
		},
		"progress.analyzing.code": {
			en: "Analyzing code...",
			tr: "Kod analiz ediliyor..."
		},
		"progress.ai.analysis": {
			en: "AI is analyzing your code...",
			tr: "AI kodunuzu analiz ediyor..."
		},
		"progress.ai.improving": {
			en: "AI is improving your code...",
			tr: "AI kodunuzu iyileştiriyor..."
		},
		"progress.preparing.suggestions": {
			en: "Preparing suggestions...",
			tr: "Öneriler hazırlanıyor..."
		},
		"progress.preparing.report": {
			en: "Preparing report...",
			tr: "Rapor hazırlanıyor..."
		},
		"progress.generating.alt.text": {
			en: "Generating alt text...",
			tr: "Alt text oluşturuluyor..."
		},
		"progress.optimizing.semantics": {
			en: "Optimizing semantic structure...",
			tr: "Semantik yapı optimize ediliyor..."
		},
		"progress.adding.aria.labels": {
			en: "Adding ARIA labels...",
			tr: "ARIA etiketleri ekleniyor..."
		},
		"progress.validating.accessibility": {
			en: "Validating accessibility...",
			tr: "Erişilebilirlik doğrulanıyor..."
		},
		"progress.generating.form": {
			en: "Generating accessible form...",
			tr: "Erişilebilir form oluşturuluyor..."
		},
		"progress.saving": {
			en: "Saving changes...",
			tr: "Değişiklikler kaydediliyor..."
		},
		"progress.improving.selection": {
			en: "Improving selected code...",
			tr: "Seçili kod iyileştiriliyor..."
		},
		"progress.applying.improvements": {
			en: "Applying improvements...",
			tr: "İyileştirmeler uygulanıyor..."
		},
		"progress.complete": {
			en: "Complete!",
			tr: "Tamamlandı!"
		},
		"progress.improving.with": {
			en: "Improving %TYPE% with %PROVIDER% (%MODEL%)...",
			tr: "%TYPE% %PROVIDER% (%MODEL%) ile iyileştiriliyor..."
		},
		"progress.preparing.provider": {
			en: "Preparing AI provider...",
			tr: "AI sağlayıcısı hazırlanıyor..."
		},
		"progress.applying.rules": {
			en: "Applying WCAG rules...",
			tr: "WCAG kuralları uygulanıyor..."
		},
		"progress.preparing.results": {
			en: "Preparing results...",
			tr: "Sonuçlar hazırlanıyor..."
		},
		"progress.type.file": {
			en: "file",
			tr: "dosya"
		},
		"progress.type.selection": {
			en: "selected code",
			tr: "seçili kod"
		},

		// Button labels
		"button.configure.api.key": {
			en: "Configure API Key",
			tr: "API Anahtarını Yapılandır"
		},
		"button.show.interface": {
			en: "Show Interface",
			tr: "Arayüzü Göster"
		},
		"button.apply.changes": {
			en: "Apply Changes",
			tr: "Değişiklikleri Uygula"
		},
		"button.preview.changes": {
			en: "Preview Changes",
			tr: "Değişiklikleri Önizle"
		},

		// Success messages
		"success.improvements.ready": {
			en: "WCAG improvements are ready!",
			tr: "WCAG iyileştirmeleri hazır!"
		},
		"success.selection.improved": {
			en: "Selected code improved successfully!",
			tr: "Seçili kod başarıyla iyileştirildi!"
		},
		"success.auto.applied.detail": {
			en: "✅ %LINES% lines improved and auto-applied! (%CRITERIA% WCAG criteria) - %PROVIDER% (%MODEL%)",
			tr: "✅ %LINES% satır iyileştirildi ve otomatik olarak uygulandı! (%CRITERIA% WCAG kriteri) - %PROVIDER% (%MODEL%)"
		},
		"success.improved.detail": {
			en: "✅ %LINES% lines improved! (%CRITERIA% WCAG criteria) - %PROVIDER% (%MODEL%)",
			tr: "✅ %LINES% satır iyileştirildi! (%CRITERIA% WCAG kriteri) - %PROVIDER% (%MODEL%)"
		},
		"success.selection.auto.applied.detail": {
			en: "✅ Selected %LINES% lines improved and auto-applied! (%CRITERIA% WCAG criteria) - %PROVIDER% (%MODEL%)",
			tr: "✅ Seçili %LINES% satır iyileştirildi ve otomatik olarak uygulandı! (%CRITERIA% WCAG kriteri) - %PROVIDER% (%MODEL%)"
		},
		"success.selection.improved.detail": {
			en: "Selected code successfully improved using %PROVIDER% (%MODEL%)! %LINES% lines updated, %CRITERIA% WCAG criteria applied.",
			tr: "Seçili kod %PROVIDER% (%MODEL%) kullanılarak başarıyla iyileştirildi! %LINES% satır güncellendi, %CRITERIA% WCAG kriteri uygulandı."
		},
		"success.analysis.completed.detail": {
			en: "✅ WCAG analysis completed with %PROVIDER%! %LINES% lines improved (%TIME%ms)",
			tr: "✅ WCAG analizi %PROVIDER% ile tamamlandı! %LINES% satır iyileştirildi (%TIME%ms)"
		},
		"success.provider.improved.detail": {
			en: "✅ %LINES% lines improved with %PROVIDER%! (%CRITERIA% WCAG criteria)",
			tr: "✅ %LINES% satır %PROVIDER% ile iyileştirildi! (%CRITERIA% WCAG kriteri)"
		},
		"success.provider.selection.improved.detail": {
			en: "✅ Selected code improved with %PROVIDER%! %LINES% lines, %CRITERIA% WCAG criteria",
			tr: "✅ Seçili kod %PROVIDER% ile iyileştirildi! %LINES% satır, %CRITERIA% WCAG kriteri"
		},
		"success.preview.opened": {
			en: "✅ Preview opened in your default browser!",
			tr: "✅ Önizleme varsayılan tarayıcınızda açıldı!"
		},

		// Error fallback messages
		"error.unknown.occurred": {
			en: "Unknown error occurred",
			tr: "Bilinmeyen hata oluştu"
		},
		"error.analysis.failed.detail": {
			en: "❌ WCAG analysis failed: %ERROR%",
			tr: "❌ WCAG analizi başarısız: %ERROR%"
		},
		"error.analysis.exception.detail": {
			en: "❌ WCAG analysis error: %ERROR%",
			tr: "❌ WCAG analiz hatası: %ERROR%"
		},
		"error.provider.improvement.failed": {
			en: "❌ %PROVIDER% improvement failed: %ERROR%",
			tr: "❌ %PROVIDER% iyileştirmesi başarısız: %ERROR%"
		},
		"error.provider.improvement.exception": {
			en: "❌ %PROVIDER% improvement error: %ERROR%",
			tr: "❌ %PROVIDER% iyileştirme hatası: %ERROR%"
		},
		"error.empty.file": {
			en: "❌ File is empty",
			tr: "❌ Dosya boş"
		},
		"error.no.code.selected": {
			en: "❌ Please select code to analyze",
			tr: "❌ Lütfen analiz edilecek kodu seçin"
		},
		"error.settings.save.failed": {
			en: "An error occurred while saving settings. Please check settings manually.",
			tr: "Ayar kaydetme sırasında hata oluştu. Lütfen ayarları manuel olarak kontrol edin."
		},

		// API key prompts
		"prompt.api.key.required": {
			en: "API key configuration required. Would you like to go to settings?",
			tr: "API anahtarı yapılandırması gerekli. Ayarlar sayfasına gitmek ister misiniz?"
		},
		"button.go.to.settings": {
			en: "Go to Settings",
			tr: "Ayarlara Git"
		},

		// Provider progress messages
		"progress.switching.provider": {
			en: "Switching AI provider...",
			tr: "AI sağlayıcısı değiştiriliyor..."
		},
		"progress.provider.improving": {
			en: "🔄 WCAG improvement with %PROVIDER%...",
			tr: "🔄 %PROVIDER% ile WCAG iyileştirmesi..."
		},
		"progress.provider.improving.selection": {
			en: "🔄 Improving selected code with %PROVIDER%...",
			tr: "🔄 %PROVIDER% ile seçili kod iyileştiriliyor..."
		},
		"progress.provider.diff.title": {
			en: "%FILENAME% - %PROVIDER% WCAG Improvement",
			tr: "%FILENAME% - %PROVIDER% WCAG İyileştirmesi"
		},
		"progress.provider.selection.diff.title": {
			en: "%PROVIDER% - Selected Code WCAG Improvement",
			tr: "%PROVIDER% - Seçili Kod WCAG İyileştirmesi"
		},
		"button.show.preview": {
			en: "Show Preview",
			tr: "Önizleme Göster"
		},

		// WCAG Analyzer - Static analysis issues
		"analyzer.img.alt.missing.desc": {
			en: "Image elements are missing the alt attribute",
			tr: "Resim elementlerinde alt özelliği eksik"
		},
		"analyzer.img.alt.missing.suggestion": {
			en: "Add meaningful alt attributes to all img elements",
			tr: "Tüm img elementlerine anlamlı alt özelliği ekleyin"
		},
		"analyzer.input.label.missing.desc": {
			en: "Form elements are missing labels",
			tr: "Form elementlerinde etiket eksik"
		},
		"analyzer.input.label.missing.suggestion": {
			en: "Add label or aria-label to all form elements",
			tr: "Tüm form elementlerine label veya aria-label ekleyin"
		},
		"analyzer.heading.hierarchy.desc": {
			en: "Heading hierarchy is irregular",
			tr: "Başlık hiyerarşisi düzensiz"
		},
		"analyzer.heading.hierarchy.suggestion": {
			en: "Use heading levels sequentially (h1, h2, h3...)",
			tr: "Başlık seviyelerini sıralı kullanın (h1, h2, h3...)"
		},
		"analyzer.button.empty.desc": {
			en: "Empty button elements",
			tr: "Boş buton elementleri"
		},
		"analyzer.button.empty.suggestion": {
			en: "Add meaningful text or aria-label to buttons",
			tr: "Butonlara anlamlı metin veya aria-label ekleyin"
		},
		"analyzer.table.headers.missing.desc": {
			en: "Table headers are missing",
			tr: "Tablo başlıkları eksik"
		},
		"analyzer.table.headers.missing.suggestion": {
			en: "Add th elements and scope attributes to tables",
			tr: "Tablolara th elementleri ve scope özelliği ekleyin"
		},
		"analyzer.color.contrast.desc": {
			en: "Color contrast check required",
			tr: "Renk kontrastı kontrolü gerekli"
		},
		"analyzer.color.contrast.suggestion": {
			en: "Verify that color contrast is at least 4.5:1 ratio",
			tr: "Renk kontrastının en az 4.5:1 oranında olduğunu doğrulayın"
		},
		"analyzer.fixed.font.desc": {
			en: "Fixed font sizes are being used",
			tr: "Sabit font boyutları kullanılıyor"
		},
		"analyzer.fixed.font.suggestion": {
			en: "Use scalable font sizes (rem, em)",
			tr: "Ölçeklenebilir font boyutları (rem, em) kullanın"
		},
		"analyzer.keyboard.nav.desc": {
			en: "Keyboard navigation is missing",
			tr: "Klavye navigasyonu eksik"
		},
		"analyzer.keyboard.nav.suggestion": {
			en: "Add keyboard events in addition to click events",
			tr: "Click olaylarına ek olarak klavye olayları da ekleyin"
		},
		"analyzer.focus.management.desc": {
			en: "Focus management may be missing",
			tr: "Odak yönetimi eksik olabilir"
		},
		"analyzer.focus.management.suggestion": {
			en: "Add focus management for dynamic content changes",
			tr: "Dinamik içerik değişikliklerinde odak yönetimi ekleyin"
		},
		"analyzer.ai.alt.text.desc": {
			en: "AI alt text suggestion",
			tr: "AI alt metin önerisi"
		},
		"analyzer.ai.alt.text.suggestion": {
			en: "Check image alt texts",
			tr: "Resim alt metinlerini kontrol edin"
		},
		"analyzer.ai.aria.desc": {
			en: "AI ARIA suggestion",
			tr: "AI ARIA önerisi"
		},
		"analyzer.ai.aria.suggestion": {
			en: "Check ARIA attributes",
			tr: "ARIA etiketlerini kontrol edin"
		},

		// WCAG Analyzer - Recommendations
		"analyzer.recommend.alt": {
			en: "🖼️ Add meaningful alt text to all images",
			tr: "🖼️ Tüm resimlere anlamlı alt metinleri ekleyin"
		},
		"analyzer.recommend.labels": {
			en: "🏷️ Add proper labels to form elements",
			tr: "🏷️ Form elementlerine uygun etiketler ekleyin"
		},
		"analyzer.recommend.headings": {
			en: "📝 Fix the heading hierarchy",
			tr: "📝 Başlık hiyerarşisini düzenleyin"
		},
		"analyzer.recommend.keyboard": {
			en: "⌨️ Add keyboard navigation support",
			tr: "⌨️ Klavye navigasyonu desteği ekleyin"
		},
		"analyzer.recommend.contrast": {
			en: "🎨 Increase color contrast",
			tr: "🎨 Renk kontrastını artırın"
		},
		"analyzer.recommend.conformant": {
			en: "✅ Code appears to conform to WCAG standards",
			tr: "✅ Kod WCAG standartlarına uygun görünüyor"
		},
		"analyzer.report.regular.tests": {
			en: "📋 Perform regular WCAG tests",
			tr: "📋 Düzenli WCAG testleri yapın"
		},
		"analyzer.report.automated.tests": {
			en: "🔧 Integrate automated accessibility tests",
			tr: "🔧 Otomatik erişilebilirlik testleri entegre edin"
		},
		"analyzer.report.user.tests": {
			en: "👥 Conduct user testing",
			tr: "👥 Kullanıcı testleri gerçekleştirin"
		},
		"analyzer.report.review.docs": {
			en: "📚 Review WCAG 2.2 documentation",
			tr: "📚 WCAG 2.2 dokümantasyonunu inceleyin"
		},

		// WCAG Analyzer - Errors and log messages
		"analyzer.error.provider.not.configured": {
			en: "AI provider not configured: %MESSAGE%, performing static analysis only",
			tr: "AI sağlayıcısı yapılandırılmamış: %MESSAGE%, sadece statik analiz yapılıyor"
		},
		"analyzer.error.ai.failed.fallback": {
			en: "AI analysis failed, using static analysis results",
			tr: "AI analizi başarısız, statik analiz sonuçları kullanılıyor"
		},
		"analyzer.error.provider.config.missing": {
			en: "AI provider configuration missing: %MESSAGE%",
			tr: "AI sağlayıcısı yapılandırması eksik: %MESSAGE%"
		},
		"analyzer.error.ai.analysis.failed": {
			en: "AI analysis failed (%PROVIDER%)",
			tr: "AI analizi başarısız oldu (%PROVIDER%)"
		},
		"analyzer.error.response.not.json": {
			en: "AI response is not in JSON format (%PROVIDER%), performing text analysis",
			tr: "AI yanıtı JSON formatında değil (%PROVIDER%), metin analizi yapılıyor"
		},
		"analyzer.error.provider": {
			en: "AI provider error: ",
			tr: "AI sağlayıcısı hatası: "
		},
		"analyzer.error.api.key": {
			en: "API key error: ",
			tr: "API anahtarı hatası: "
		},
		"analyzer.error.during.analysis": {
			en: "Error during WCAG analysis: ",
			tr: "WCAG analizi sırasında hata: "
		},
		"analyzer.error.unknown": {
			en: "Unknown WCAG analysis error",
			tr: "Bilinmeyen WCAG analizi hatası"
		},
		"analyzer.code.conformant": {
			en: "Code has been made conformant to WCAG standards",
			tr: "Kod WCAG standartlarına uygun hale getirildi"
		},

		// Info messages
		"info.no.improvements.needed": {
			en: "No improvements needed for this code.",
			tr: "Bu kod için iyileştirme gerekmez."
		},
		"info.interface.opened": {
			en: "AccessiMind interface opened.",
			tr: "AccessiMind arayüzü açıldı."
		},

		// Error messages
		"error.improvement.failed": {
			en: "Improvement failed",
			tr: "İyileştirme başarısız oldu"
		},
		"error.interface.failed": {
			en: "Failed to open interface.",
			tr: "Arayüz açılamadı."
		},

		// Stats
		"stats.lines.improved": {
			en: "lines improved",
			tr: "satır iyileştirildi"
		},

		// Prompt mesajları
		"prompt.enter.api.key": {
			en: "Enter your Gemini API key:",
			tr: "Gemini API anahtarınızı girin:"
		},
		"prompt.generated.alt.text": {
			en: "Generated alt text:",
			tr: "Oluşturulan alt text:"
		},
		"prompt.enter.alt.text": {
			en: "Enter alt text...",
			tr: "Alt text girin..."
		},

		// Uyarı mesajları
		"warning.no.instruction": {
			en: "No instruction entered.",
			tr: "Talimat girilmedi."
		},
		"warning.api.key.not.set": {
			en: "API key not set.",
			tr: "API anahtarı ayarlanmamış."
		},
		"warning.select.img.tag": {
			en: "Please select an img tag!",
			tr: "Lütfen bir img etiketi seçin!"
		},
		"warning.accessibility.not.supported": {
			en: "Accessibility validation is not supported for this file type!",
			tr: "Bu dosya türü için erişilebilirlik doğrulaması desteklenmiyor!"
		},
		"warning.semantics.not.supported": {
			en: "Semantic optimization is not supported for this file type!",
			tr: "Bu dosya türü için semantik optimizasyon desteklenmiyor!"
		},
		"warning.aria.not.supported": {
			en: "ARIA labels are not supported for this file type!",
			tr: "Bu dosya türü için ARIA etiketleri desteklenmiyor!"
		},

		// UI mesajları

		// Button labels
		"button.get.current.code": {
			en: "📄 Current File",
			tr: "📄 Mevcut Dosya"
		},
		"button.get.selected.code": {
			en: "📋 Selected Code",
			tr: "📋 Seçili Kod"
		},
		"button.analyze.file": {
			en: "🔍 Analyze File",
			tr: "🔍 Dosyayı Analiz Et"
		},
		"button.improve.file": {
			en: "✨ Improve File",
			tr: "✨ Dosyayı İyileştir"
		},
		"button.apply.to.file": {
			en: "📄 Apply to File",
			tr: "📄 Dosyaya Uygula"
		},
		"button.apply.to.selection": {
			en: "📋 Apply to Selection",
			tr: "📋 Seçime Uygula"
		},
		"button.copy.code": {
			en: "📋 Copy",
			tr: "📋 Kopyala"
		},
		"button.send": {
			en: "Send",
			tr: "Gönder"
		},
		"button.show.stats": {
			en: "Show Statistics",
			tr: "İstatistikleri Görüntüle"
		},
		"view.diff.title.file": {
			en: "%FILENAME% - WCAG Improvement",
			tr: "%FILENAME% - WCAG İyileştirmesi"
		},
		"view.diff.title.selection": {
			en: "Selected Code - WCAG Improvement",
			tr: "Seçili Kod - WCAG İyileştirmesi"
		},
		"view.diff.title.preview": {
			en: "Preview: %FILENAME%",
			tr: "Önizleme: %FILENAME%"
		},
		"view.diff.title.preview.selection": {
			en: "Preview: Selected Code",
			tr: "Önizleme: Seçili Kod"
		},

		// Statistics mesajları
		"stats.title": {
			en: "WCAG Statistics",
			tr: "WCAG İstatistikleri"
		},
		"stats.summary": {
			en: "Summary",
			tr: "Özet"
		},
		"stats.daily": {
			en: "Daily Statistics",
			tr: "Günlük İstatistikler"
		},
		"stats.monthly": {
			en: "Monthly Statistics",
			tr: "Aylık İstatistikler"
		},
		"stats.yearly": {
			en: "Yearly Statistics",
			tr: "Yıllık İstatistikler"
		},
		"stats.total.improvements": {
			en: "Total Improvements",
			tr: "Toplam İyileştirme"
		},
		"stats.lines.improved.total": {
			en: "Total Lines Improved",
			tr: "Toplam İyileştirilen Satır"
		},
		"stats.success.rate": {
			en: "Success Rate",
			tr: "Başarı Oranı"
		},
		"stats.avg.processing.time": {
			en: "Average Processing Time",
			tr: "Ortalama İşlem Süresi"
		},
		"stats.top.language": {
			en: "Most Used Language",
			tr: "En Çok Kullanılan Dil"
		},
		"stats.by.language": {
			en: "By Language",
			tr: "Dile Göre"
		},
		"stats.wcag.criteria": {
			en: "WCAG Criteria Applied",
			tr: "Uygulanan WCAG Kriterleri"
		},
		"stats.recent.improvements": {
			en: "Recent Improvements",
			tr: "Son İyileştirmeler"
		},
		"stats.errors": {
			en: "Errors",
			tr: "Hatalar"
		},
		"stats.export": {
			en: "Export Statistics",
			tr: "İstatistikleri Dışa Aktar"
		},
		"stats.reset": {
			en: "Reset Statistics",
			tr: "İstatistikleri Sıfırla"
		},
		"stats.no.data": {
			en: "No data available",
			tr: "Veri bulunmuyor"
		},
		"stats.today": {
			en: "Today",
			tr: "Bugün"
		},
		"stats.this.month": {
			en: "This Month",
			tr: "Bu Ay"
		},
		"stats.this.year": {
			en: "This Year",
			tr: "Bu Yıl"
		},
		"stats.improvements.count": {
			en: "improvements",
			tr: "iyileştirme"
		},
		"stats.lines.count": {
			en: "lines",
			tr: "satır"
		},
		"stats.ms": {
			en: "ms",
			tr: "ms"
		},
		"stats.times": {
			en: "times",
			tr: "kez"
		},

		// Progress dinamik mesajları
		"progress.step.1": {
			en: "Initializing analysis...",
			tr: "Analiz başlatılıyor..."
		},
		"progress.step.2": {
			en: "Connecting to Gemini API...",
			tr: "Gemini API'ye bağlanıyor..."
		},
		"progress.step.3": {
			en: "Reading code structure...",
			tr: "Kod yapısı okunuyor..."
		},
		"progress.step.4": {
			en: "Applying WCAG analysis...",
			tr: "WCAG analizi uygulanıyor..."
		},
		"progress.step.5": {
			en: "Generating improvements...",
			tr: "İyileştirmeler oluşturuluyor..."
		},
		"progress.step.6": {
			en: "Finalizing changes...",
			tr: "Değişiklikler sonlandırılıyor..."
		},

		// Command titles
		"command.improve.file": {
			en: "WCAG: Improve Current File",
			tr: "WCAG: Mevcut Dosyayı İyileştir"
		},
		"command.improve.selection": {
			en: "WCAG: Improve Selection",
			tr: "WCAG: Seçimi İyileştir"
		},
		"command.improve.current.selected": {
			en: "WCAG: Improve Current Selected",
			tr: "WCAG: Seçili Mevcut İyileştir"
		},
		"command.show.interface": {
			en: "WCAG: Show Interface",
			tr: "WCAG: Arayüzü Göster"
		},
		"command.set.api.key": {
			en: "WCAG: Set Gemini API Key",
			tr: "WCAG: Gemini API Anahtarını Ayarla"
		},
		"command.test.ai.connection": {
			en: "WCAG: Test AI Connection",
			tr: "WCAG: AI Bağlantısını Test Et"
		},
		"command.show.welcome": {
			en: "AccessiMind: Show Welcome Guide",
			tr: "AccessiMind: Hoş Geldin Rehberini Göster"
		},
		"command.show.statistics.panel": {
			en: "WCAG: Show Statistics Panel",
			tr: "WCAG: İstatistik Panelini Göster"
		},
		"command.show.detailed.statistics": {
			en: "WCAG: Show Detailed Statistics",
			tr: "WCAG: Detaylı İstatistikleri Göster"
		},
		"command.export.statistics": {
			en: "WCAG: Export Statistics",
			tr: "WCAG: İstatistikleri Dışa Aktar"
		},
		"command.reset.statistics": {
			en: "WCAG: Reset Statistics",
			tr: "WCAG: İstatistikleri Sıfırla"
		},
		"command.show.wizard": {
			en: "WCAG: Show Setup Wizard",
			tr: "WCAG: Kurulum Sihirbazını Göster"
		},

		// AI Provider seçimi
		"provider.select.title": {
			en: "Select AI Provider",
			tr: "AI Sağlayıcısı Seçin"
		},
		"provider.gemini.name": {
			en: "Google Gemini",
			tr: "Google Gemini"
		},
		"provider.vscode-copilot.name": {
			en: "VS Code Copilot",
			tr: "VS Code Copilot"
		},
		"provider.gemini.description": {
			en: "Use Google Gemini API (requires API key)",
			tr: "Google Gemini API kullan (API anahtarı gerekir)"
		},
		"provider.vscode-copilot.description": {
			en: "Use VS Code Copilot (requires GitHub Copilot subscription)",
			tr: "VS Code Copilot kullan (GitHub Copilot aboneliği gerekir)"
		},

		// GitHub Copilot model seçimi
		"copilot.model.select.title": {
			en: "Select GitHub Copilot Model",
			tr: "GitHub Copilot Modeli Seçin"
		},
		"copilot.model.gpt-4o.name": {
			en: "GPT-4o",
			tr: "GPT-4o"
		},
		"copilot.model.gpt-4o.description": {
			en: "Latest OpenAI model with excellent code understanding",
			tr: "Mükemmel kod anlayışına sahip en son OpenAI modeli"
		},
		"copilot.model.gpt-4-turbo.name": {
			en: "GPT-4 Turbo",
			tr: "GPT-4 Turbo"
		},
		"copilot.model.gpt-4-turbo.description": {
			en: "Fast and efficient for code improvements",
			tr: "Kod iyileştirmeleri için hızlı ve verimli"
		},
		"copilot.model.gpt-3.5-turbo.name": {
			en: "GPT-3.5 Turbo",
			tr: "GPT-3.5 Turbo"
		},
		"copilot.model.gpt-3.5-turbo.description": {
			en: "Balanced performance for most use cases",
			tr: "Çoğu kullanım durumu için dengeli performans"
		},
		"copilot.model.claude-3-5-sonnet.name": {
			en: "Claude 3.5 Sonnet",
			tr: "Claude 3.5 Sonnet"
		},
		"copilot.model.claude-3-5-sonnet.description": {
			en: "Advanced reasoning for complex accessibility issues",
			tr: "Karmaşık erişilebilirlik sorunları için gelişmiş muhakeme"
		},

		// Gemini model seçimi
		"gemini.model.select.title": {
			en: "Select Gemini Model",
			tr: "Gemini Modeli Seçin"
		},
		"gemini.model.2.0-flash-exp.name": {
			en: "Gemini 2.0 Flash (Experimental)",
			tr: "Gemini 2.0 Flash (Deneysel)"
		},
		"gemini.model.2.0-flash-exp.description": {
			en: "Fastest response time",
			tr: "En hızlı yanıt süresi"
		},
		"gemini.model.2.0-flash.name": {
			en: "Gemini 2.0 Flash",
			tr: "Gemini 2.0 Flash"
		},
		"gemini.model.2.0-flash.description": {
			en: "Balanced performance and quality",
			tr: "Dengeli performans ve kalite"
		},
		"gemini.model.1.5-flash.name": {
			en: "Gemini 1.5 Flash",
			tr: "Gemini 1.5 Flash"
		},
		"gemini.model.1.5-flash.description": {
			en: "Highest quality for complex improvements",
			tr: "Karmaşık iyileştirmeler için en yüksek kalite"
		},

		// Welcome ekranı
		"welcome.message": {
			en: "Welcome to AccessiMind! 🎉\n\nYour AI-powered accessibility improvement tool is ready to use.",
			tr: "AccessiMind'e Hoş Geldiniz! 🎉\n\nAI destekli erişilebilirlik iyileştirme aracınız kullanıma hazır."
		},
		"welcome.title": {
			en: "♿ Welcome to AccessiMind!",
			tr: "♿ AccessiMind'e Hoş Geldiniz!"
		},
		"welcome.subtitle": {
			en: "Your AI-powered accessibility improvement tool",
			tr: "AI destekli erişilebilirlik iyileştirme aracınız"
		},
		"welcome.intro": {
			en: "AccessiMind helps you automatically improve your code for better web accessibility using advanced AI models.",
			tr: "AccessiMind, gelişmiş AI modelleri kullanarak kodunuzu daha iyi web erişilebilirliği için otomatik olarak iyileştirmenize yardımcı olur."
		},
		"welcome.features.title": {
			en: "🚀 Key Features",
			tr: "🚀 Ana Özellikler"
		},
		"welcome.features.file": {
			en: "📄 **Improve Entire File** - Analyze and improve whole files for WCAG conformance",
			tr: "📄 **Dosyanın Tamamını İyileştir** - WCAG uyumu için tüm dosyaları analiz edin ve iyileştirin"
		},
		"welcome.features.selection": {
			en: "📋 **Improve Code Selection** - Target specific code blocks for focused improvements",
			tr: "📋 **Kod Seçimini İyileştir** - Odaklanmış iyileştirmeler için belirli kod bloklarını hedefleyin"
		},
		"welcome.features.smart": {
			en: "🎯 **Smart Improvement** - Automatically detects selection or improves entire file",
			tr: "🎯 **Akıllı İyileştirme** - Seçimi otomatik algılar veya tüm dosyayı iyileştirir"
		},
		"welcome.features.stats": {
			en: "📊 **Detailed Statistics** - Track your improvements with comprehensive analytics",
			tr: "📊 **Detaylı İstatistikler** - Kapsamlı analizlerle iyileştirmelerinizi takip edin"
		},
		"welcome.features.multi": {
			en: "🤖 **Multi-AI Support** - Choose between Google Gemini and GitHub Copilot",
			tr: "🤖 **Çoklu AI Desteği** - Google Gemini ve GitHub Copilot arasında seçim yapın"
		},
		"welcome.commands.title": {
			en: "⌨️ Quick Commands",
			tr: "⌨️ Hızlı Komutlar"
		},
		"welcome.commands.improve.file": {
			en: "**Ctrl+Alt+W** - Improve Current File",
			tr: "**Ctrl+Alt+W** - Mevcut Dosyayı İyileştir"
		},
		"welcome.commands.improve.selection": {
			en: "**Ctrl+Alt+Shift+W** - Improve Selection",
			tr: "**Ctrl+Alt+Shift+W** - Seçimi İyileştir"
		},
		"welcome.commands.improve.smart": {
			en: "**Ctrl+Alt+Q** - Smart Improvement",
			tr: "**Ctrl+Alt+Q** - Akıllı İyileştirme"
		},
		"welcome.commands.show.stats": {
			en: "**Ctrl+Alt+U** - Show Statistics",
			tr: "**Ctrl+Alt+U** - İstatistikleri Göster"
		},
		"welcome.setup.title": {
			en: "⚙️ Quick Setup",
			tr: "⚙️ Hızlı Kurulum"
		},
		"welcome.setup.step1": {
			en: "1. Choose your AI provider (Google Gemini or GitHub Copilot)",
			tr: "1. AI sağlayıcınızı seçin (Google Gemini veya GitHub Copilot)"
		},
		"welcome.setup.step2": {
			en: "2. Configure API settings and select your preferred model",
			tr: "2. API ayarlarını yapılandırın ve tercih ettiğiniz modeli seçin"
		},
		"welcome.setup.step3": {
			en: "3. Start improving your code for better accessibility!",
			tr: "3. Daha iyi erişilebilirlik için kodunuzu iyileştirmeye başlayın!"
		},
		"welcome.supported.title": {
			en: "🔧 Supported File Types",
			tr: "🔧 Desteklenen Dosya Türleri"
		},
		"welcome.supported.list": {
			en: "HTML, CSS, JavaScript, TypeScript, React (JSX/TSX), Vue, Angular, SCSS, LESS",
			tr: "HTML, CSS, JavaScript, TypeScript, React (JSX/TSX), Vue, Angular, SCSS, LESS"
		},
		"welcome.wcag.title": {
			en: "♿ WCAG Conformance Levels",
			tr: "♿ WCAG Uyum Seviyeleri"
		},
		"welcome.wcag.level.a": {
			en: "**Level A** - Basic accessibility requirements",
			tr: "**Seviye A** - Temel erişilebilirlik gereksinimleri"
		},
		"welcome.wcag.level.aa": {
			en: "**Level AA** - Standard accessibility (Recommended)",
			tr: "**Seviye AA** - Standart erişilebilirlik (Önerilen)"
		},
		"welcome.wcag.level.aaa": {
			en: "**Level AAA** - Enhanced accessibility for critical applications",
			tr: "**Seviye AAA** - Kritik uygulamalar için gelişmiş erişilebilirlik"
		},
		"welcome.tips.title": {
			en: "💡 Pro Tips",
			tr: "💡 Profesyonel İpuçları"
		},
		"welcome.tips.tip1": {
			en: "• Use **VS Code Settings** to customize WCAG level and response language",
			tr: "• WCAG seviyesi ve yanıt dilini özelleştirmek için **VS Code Ayarları**nı kullanın"
		},
		"welcome.tips.tip2": {
			en: "• Enable **auto-apply** mode for faster workflow",
			tr: "• Daha hızlı iş akışı için **otomatik uygulama** modunu etkinleştirin"
		},
		"welcome.tips.tip3": {
			en: "• Check the **Statistics** panel to track your accessibility improvements",
			tr: "• Erişilebilirlik iyileştirmelerinizi takip etmek için **İstatistikler** panelini kontrol edin"
		},
		"welcome.buttons.setup": {
			en: "🚀 Setup API Provider",
			tr: "🚀 API Sağlayıcısını Kur"
		},
		"welcome.buttons.settings": {
			en: "⚙️ Open Settings",
			tr: "⚙️ Ayarları Aç"
		},
		"welcome.buttons.docs": {
			en: "📖 View Documentation",
			tr: "📖 Dokümantasyonu Görüntüle"
		},
		"welcome.buttons.close": {
			en: "✨ Start Using AccessiMind",
			tr: "✨ AccessiMind'ı Kullanmaya Başla"
		},

		// Keyboard shortcuts
		"shortcuts.title": {
			en: "Keyboard Shortcuts",
			tr: "Klavye Kısayolları"
		},
		"shortcuts.improve.file": {
			en: "Improve Current File",
			tr: "Mevcut Dosyayı İyileştir"
		},
		"shortcuts.improve.selection": {
			en: "Improve Selected Code",
			tr: "Seçili Kodu İyileştir"
		},
		"shortcuts.improve.smart": {
			en: "Smart Improvement",
			tr: "Akıllı İyileştirme"
		},
		"shortcuts.show.interface": {
			en: "Show Statistics Interface",
			tr: "İstatistik Arayüzünü Göster"
		},
		"shortcuts.updated": {
			en: "⌨️ Keyboard shortcuts updated! Please reload VS Code for changes to take effect.",
			tr: "⌨️ Klavye kısayolları güncellendi! Değişikliklerin etkili olması için VS Code'u yeniden başlatın."
		},
		"shortcuts.reload": {
			en: "Reload Now",
			tr: "Şimdi Yeniden Başlat"
		},
		"shortcuts.customization.title": {
			en: "Customize Keyboard Shortcuts",
			tr: "Klavye Kısayollarını Özelleştir"
		},
		"shortcuts.customization.description": {
			en: "You can customize keyboard shortcuts in VS Code Settings under \"AccessiMind > Shortcuts\"",
			tr: "Klavye kısayollarını VS Code Ayarları altında \"AccessiMind > Shortcuts\" bölümünden özelleştirebilirsiniz"
		},

		// Model açıklamaları
		"model.gpt4o.description": {
			en: "Latest OpenAI model - Most capable",
			tr: "En yeni OpenAI modeli - En yetenekli"
		},
		"model.gpt4o-mini.description": {
			en: "Fast and efficient - Good balance",
			tr: "Hızlı ve verimli - İyi denge"
		},
		"model.claude35.description": {
			en: "Advanced reasoning - High quality",
			tr: "Gelişmiş mantık yürütme - Yüksek kalite"
		},
		"model.claude3haiku.description": {
			en: "Fast and efficient - Quick responses",
			tr: "Hızlı ve verimli - Hızlı yanıtlar"
		},

		// Sihirbaz metinleri
		"wizard.title": {
			en: "AccessiMind Setup Wizard",
			tr: "AccessiMind Kurulum Sihirbazı"
		},
		"wizard.welcome.title": {
			en: "Welcome to AccessiMind",
			tr: "AccessiMind'a Hoş Geldiniz"
		},
		"wizard.welcome.description": {
			en: "Let's set up your accessibility improvement assistant",
			tr: "Erişilebilirlik iyileştirme asistanınızı kuralım"
		},
		"wizard.provider.title": {
			en: "Choose AI Provider",
			tr: "AI Sağlayıcı Seçin"
		},
		"wizard.provider.description": {
			en: "Select the AI service you want to use for accessibility improvements",
			tr: "Erişilebilirlik iyileştirmeleri için kullanmak istediğiniz AI hizmetini seçin"
		},
		"wizard.model.title": {
			en: "Select AI Model",
			tr: "AI Model Seçin"
		},
		"wizard.model.description": {
			en: "Choose the AI model that best fits your needs",
			tr: "İhtiyaçlarınıza en uygun AI modelini seçin"
		},
		"wizard.apikey.title": {
			en: "API Key Configuration",
			tr: "API Anahtarı Yapılandırması"
		},
		"wizard.apikey.description": {
			en: "Enter your API key to connect to the AI service",
			tr: "AI hizmetine bağlanmak için API anahtarınızı girin"
		},
		"wizard.copilot.unavailable": {
			en: "GitHub Copilot is not available. Please ensure you have an active subscription and the extension is installed.",
			tr: "GitHub Copilot kullanılamıyor. Aktif aboneliğiniz olduğundan ve uzantının yüklü olduğundan emin olun."
		},
		"wizard.copilot.authentication": {
			en: "GitHub Copilot requires authentication. Please sign in to your GitHub account.",
			tr: "GitHub Copilot kimlik doğrulaması gerektirir. Lütfen GitHub hesabınızla oturum açın."
		},
		"wizard.setup.title": {
			en: "♿ AccessiMind Setup",
			tr: "♿ AccessiMind Kurulumu"
		},
		"wizard.setup.step.title": {
			en: "♿ AccessiMind Setup - Step %STEP%/5: %TITLE%",
			tr: "♿ AccessiMind Kurulum - Adım %STEP%/5: %TITLE%"
		},
		"wizard.provider.placeholder": {
			en: "Choose your AI provider for WCAG improvements",
			tr: "WCAG iyileştirmeleri için AI sağlayıcınızı seçin"
		},
		"wizard.provider.gemini.description": {
			en: "Google's advanced AI model",
			tr: "Google'ın gelişmiş AI modeli"
		},
		"wizard.provider.gemini.detail": {
			en: "Requires API key. Recommended for best results.",
			tr: "API anahtarı gerektirir. En iyi sonuçlar için önerilir."
		},
		"wizard.provider.copilot.description": {
			en: "GitHub Copilot integration",
			tr: "GitHub Copilot entegrasyonu"
		},
		"wizard.provider.copilot.detail": {
			en: "No API key required. Uses VS Code Copilot.",
			tr: "API anahtarı gerekmez. VS Code Copilot kullanır."
		},
		"wizard.provider.ollama.description": {
			en: "Run open-source models locally",
			tr: "Açık kaynaklı modelleri yerel olarak çalıştırın"
		},
		"wizard.provider.ollama.detail": {
			en: "Free. Requires Ollama installed locally.",
			tr: "Ücretsiz. Yerel olarak Ollama kurulumu gerektirir."
		},
		"wizard.apikey.prompt": {
			en: "Enter your Google Gemini API key",
			tr: "Google Gemini API anahtarınızı girin"
		},
		"wizard.apikey.placeholder": {
			en: "Paste your API key here...",
			tr: "API anahtarınızı buraya yapıştırın..."
		},
		"wizard.apikey.required": {
			en: "API key is required",
			tr: "API anahtarı gerekli"
		},
		"wizard.apiKey.invalid": {
			en: "Invalid API key. Please try again.",
			tr: "Geçersiz API anahtarı. Lütfen tekrar deneyin."
		},
		"wizard.ollama.url.prompt": {
			en: "Enter your Ollama server URL",
			tr: "Ollama sunucu URL'nizi girin"
		},
		"wizard.model.placeholder": {
			en: "Choose an AI model",
			tr: "Bir AI modeli seçin"
		},
		"wizard.model.speed": {
			en: "Speed: %SPEED% | Quality: %QUALITY%",
			tr: "Hız: %SPEED% | Kalite: %QUALITY%"
		},
		"wizard.wcag.level.a.description": {
			en: "Minimum accessibility",
			tr: "Minimum erişilebilirlik"
		},
		"wizard.wcag.level.a.detail": {
			en: "Basic requirements for web accessibility",
			tr: "Web erişilebilirliği için temel gereksinimler"
		},
		"wizard.wcag.level.aa.description": {
			en: "Recommended",
			tr: "Önerilen"
		},
		"wizard.wcag.level.aa.detail": {
			en: "Standard level for most websites and apps",
			tr: "Çoğu web sitesi ve uygulama için standart seviye"
		},
		"wizard.wcag.level.aaa.description": {
			en: "Maximum accessibility",
			tr: "Maksimum erişilebilirlik"
		},
		"wizard.wcag.level.aaa.detail": {
			en: "Highest level of accessibility conformance",
			tr: "En yüksek erişilebilirlik uyumluluk seviyesi"
		},
		"wizard.wcag.placeholder": {
			en: "Choose target WCAG conformance level",
			tr: "Hedef WCAG uyumluluk seviyesini seçin"
		},
		"wizard.language.english.label": {
			en: "🇬🇧 English",
			tr: "🇬🇧 English"
		},
		"wizard.language.english.description": {
			en: "English language",
			tr: "İngilizce"
		},
		"wizard.language.english.detail": {
			en: "Use English for all AI outputs and interface",
			tr: "Tüm AI çıktıları ve arayüz için İngilizce kullanın"
		},
		"wizard.language.turkish.label": {
			en: "🇹🇷 Türkçe",
			tr: "🇹🇷 Türkçe"
		},
		"wizard.language.turkish.description": {
			en: "Turkish language",
			tr: "Türkçe"
		},
		"wizard.language.turkish.detail": {
			en: "Use Turkish for all AI outputs and interface",
			tr: "Tüm AI çıktıları ve arayüz için Türkçe kullanın"
		},
		"wizard.language.placeholder": {
			en: "Choose your preferred language",
			tr: "Tercih ettiğiniz dili seçin"
		},
		"wizard.complete.test.prompt": {
			en: "♿ Setup complete! Would you like to test the AI connection?",
			tr: "♿ Kurulum tamamlandı! AI bağlantısını test etmek ister misiniz?"
		},
		"wizard.test.connection.button": {
			en: "Test Connection",
			tr: "Bağlantıyı Test Et"
		},
		"wizard.button.finish.short": {
			en: "Finish",
			tr: "Bitir"
		},
		"wizard.test.progress.title": {
			en: "Testing AI connection...",
			tr: "AI bağlantısı test ediliyor..."
		},
		"wizard.test.success.detail": {
			en: "✅ Connection successful! %MESSAGE%",
			tr: "✅ Bağlantı başarılı! %MESSAGE%"
		},
		"wizard.test.failed.detail": {
			en: "❌ Connection failed: %MESSAGE%",
			tr: "❌ Bağlantı başarısız: %MESSAGE%"
		},
		"wizard.finish.success": {
			en: "🎉 AccessiMind setup complete! You can now analyze your code for WCAG accessibility.",
			tr: "🎉 AccessiMind kurulumu tamamlandı! Artık kodunuzu WCAG erişilebilirliği için analiz edebilirsiniz."
		},

		// Sihirbaz buton metinleri
		"wizard.button.continue": {
			en: "Continue",
			tr: "Devam Et"
		},
		"wizard.button.back": {
			en: "Back",
			tr: "Geri"
		},
		"wizard.button.finish": {
			en: "Finish Setup",
			tr: "Kurulumu Tamamla"
		},
		"wizard.button.test": {
			en: "Test Connection",
			tr: "Bağlantıyı Test Et"
		},
		"wizard.button.retry": {
			en: "Retry Test",
			tr: "Testi Tekrarla"
		},

		// Sihirbaz adım başlıkları
		"wizard.steps.title": {
			en: "Setup Steps",
			tr: "Kurulum Adımları"
		},
		"wizard.step1.title": {
			en: "Step 1: AI Provider Selection",
			tr: "1. Adım: AI Sağlayıcı Seçimi"
		},
		"wizard.step2.title": {
			en: "Step 2: Model Selection",
			tr: "2. Adım: Model Seçimi"
		},
		"wizard.step3.title": {
			en: "Step 3: API Configuration",
			tr: "3. Adım: API Yapılandırması"
		},
		"wizard.step4.title": {
			en: "Step 4: WCAG Settings",
			tr: "4. Adım: WCAG Ayarları"
		},
		"wizard.step5.title": {
			en: "Step 5: Test and Complete",
			tr: "5. Adım: Test ve Tamamlama"
		},

		// Sağlayıcı seçimi
		"wizard.provider.gemini.select": {
			en: "Select Google Gemini API",
			tr: "Google Gemini API'yi seç"
		},
		"wizard.provider.copilot.select": {
			en: "Select GitHub Copilot",
			tr: "GitHub Copilot'u seç"
		},

		// Model seçimi
		"wizard.model.select.aria": {
			en: "Select %MODEL% model",
			tr: "%MODEL% modelini seç"
		},
		"wizard.model.unavailable": {
			en: "Unavailable",
			tr: "Kullanılamıyor"
		},
		"wizard.model.speed.fast": {
			en: "Fast",
			tr: "Hızlı"
		},
		"wizard.model.speed.medium": {
			en: "Medium",
			tr: "Orta"
		},
		"wizard.model.speed.slow": {
			en: "Slow",
			tr: "Yavaş"
		},
		"wizard.model.quality.high": {
			en: "High",
			tr: "Yüksek"
		},
		"wizard.model.quality.very-high": {
			en: "Very High",
			tr: "Çok Yüksek"
		},
		"wizard.model.quality.medium": {
			en: "Medium",
			tr: "Orta"
		},

		// API yapılandırması
		"wizard.api.config.title": {
			en: "API Configuration",
			tr: "API Yapılandırması"
		},
		"wizard.api.config.description": {
			en: "Complete the necessary configuration for your selected AI provider",
			tr: "Seçtiğiniz AI sağlayıcısı için gerekli yapılandırmayı tamamlayın"
		},
		"wizard.api.key.label": {
			en: "API Key",
			tr: "API Anahtarı"
		},
		"wizard.api.key.placeholder": {
			en: "Enter your API key here",
			tr: "API anahtarınızı buraya girin"
		},
		"wizard.api.key.help": {
			en: "Your API key will be stored securely",
			tr: "API anahtarınız güvenli bir şekilde saklanacaktır"
		},
		"wizard.api.key.get": {
			en: "Get API Key",
			tr: "API Anahtarı Al"
		},

		// WCAG ayarları
		"wizard.wcag.settings.title": {
			en: "WCAG Settings",
			tr: "WCAG Ayarları"
		},
		"wizard.wcag.settings.description": {
			en: "Configure settings according to your accessibility requirements",
			tr: "Erişilebilirlik gereksinimlerinize göre ayarları yapılandırın"
		},
		"wizard.wcag.level.label": {
			en: "WCAG Conformance Level",
			tr: "WCAG Uyum Seviyesi"
		},
		"wizard.wcag.level.help": {
			en: "Level AA is sufficient for most legal requirements",
			tr: "Çoğu yasal gereklilik için Level AA yeterlidir"
		},
		"wizard.language.label": {
			en: "Response Language",
			tr: "Yanıt Dili"
		},
		"wizard.language.auto": {
			en: "Auto (Based on VS Code language)",
			tr: "Otomatik (VS Code diline göre)"
		},

		// Test ve tamamlama
		"wizard.test.title": {
			en: "Test and Complete",
			tr: "Test ve Tamamlama"
		},
		"wizard.test.description": {
			en: "Test your configuration and complete the setup",
			tr: "Yapılandırmanızı test edin ve kurulumu tamamlayın"
		},
		"wizard.test.success": {
			en: "Great! Your configuration is almost complete.",
			tr: "Harika! Yapılandırmanız neredeyse tamamlandı."
		},
		"wizard.test.connection": {
			en: "Test AI Connection",
			tr: "AI Bağlantısını Test Et"
		},
		"wizard.test.testing": {
			en: "Testing...",
			tr: "Test ediliyor..."
		},
		"wizard.quickstart.title": {
			en: "Quick Start",
			tr: "Hızlı Başlangıç"
		},
		"wizard.quickstart.try": {
			en: "Try Quick Improvement",
			tr: "Hızlı İyileştirme Dene"
		},
		"wizard.quickstart.settings": {
			en: "Open Settings",
			tr: "Ayarları Aç"
		},
		"wizard.quickstart.guide": {
			en: "WCAG 2.2 Guide",
			tr: "WCAG 2.2 Rehberi"
		},
		"wizard.quickstart.api": {
			en: "Gemini API Studio",
			tr: "Gemini API Studio"
		},

		// API uyarıları ve başarı mesajları
		"wizard.api.warning.title": {
			en: "Note",
			tr: "Dikkat"
		},
		"wizard.api.warning.gemini": {
			en: "You can get a free API key from Google AI Studio.",
			tr: "Google AI Studio'dan ücretsiz bir API anahtarı alabilirsiniz."
		},
		"wizard.api.success.title": {
			en: "Perfect",
			tr: "Mükemmel"
		},
		"wizard.api.success.copilot": {
			en: "You are ready if you have a GitHub Copilot subscription.",
			tr: "GitHub Copilot aboneliğiniz varsa hazırsınız."
		},
		"wizard.api.copilot.info": {
			en: "GitHub Copilot is automatically configured in VS Code. No additional setup required.",
			tr: "GitHub Copilot, VS Code'da otomatik olarak yapılandırılır. Herhangi bir ek ayar gerekmez."
		},
		"wizard.api.key.validation": {
			en: "Please enter a valid API key.",
			tr: "Lütfen geçerli bir API anahtarı girin."
		},
		"wizard.api.key.save.failed": {
			en: "API key could not be saved. Please try again.",
			tr: "API anahtarı kaydedilemedi. Lütfen tekrar deneyin."
		},
		"wizard.test.success.title": {
			en: "Great",
			tr: "Harika"
		},

		// Model kartları için ekstra stringler
		"wizard.model.recommended": {
			en: "Recommended",
			tr: "Önerilen"
		},
		"wizard.model.unavailable.message": {
			en: "This model is not available. Please check your subscription or try another model.",
			tr: "Bu model kullanılamıyor. Lütfen aboneliğinizi kontrol edin veya başka bir model deneyin."
		},

		// Model yenileme
		"wizard.model.refresh": {
			en: "Refresh Models",
			tr: "Modelleri Yenile"
		},
		"wizard.model.refreshing": {
			en: "Refreshing...",
			tr: "Yenileniyor..."
		},
		"wizard.model.refresh.help": {
			en: "Click to reload available models from API",
			tr: "API'den mevcut modelleri yeniden yüklemek için tıklayın"
		},
		"wizard.model.refresh.success": {
			en: "Models refreshed successfully!",
			tr: "Modeller başarıyla yenilendi!"
		},
		"wizard.model.refresh.failed": {
			en: "Failed to refresh models. Please try again.",
			tr: "Modeller yenilenemedi. Lütfen tekrar deneyin."
		},


		"provider.ollama.name": {
			en: "Ollama (Local)",
			tr: "Ollama (Yerel)"
		},
		"provider.ollama.description": {
			en: "Use local AI models running on your machine.",
			tr: "Kendi makinenizde çalışan yerel YZ modellerini kullanın."
		},
		"summary.ollama.applied": {
			en: "WCAG improvements applied via Ollama",
			tr: "Ollama aracılığıyla WCAG iyileştirmeleri uygulandı"
		},
		"summary.ollama.analyzed": {
			en: "WCAG analysis completed via Ollama",
			tr: "Ollama aracılığıyla WCAG analizi tamamlandı"
		}
	};

	private constructor() {
		this.detectLanguage();
	}

	public static getInstance(): LocalizationManager {
		if (!LocalizationManager.instance) {
			LocalizationManager.instance = new LocalizationManager();
		}
		return LocalizationManager.instance;
	}

	public detectLanguage(): void {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const language = config.get<string>("language", "auto");

			if (language === "auto") {
				// Global project: default to English.
				// Turkish is available when the user explicitly selects it from settings or wizard.
				this.currentLanguage = "en";
			} else if (language === "tr" || language === "en") {
				this.currentLanguage = language;
			} else {
				this.currentLanguage = "en"; // Default to English for unknown languages
			}
		} catch (error) {
			// console.error("Language detection error:", error);
			this.currentLanguage = "en"; // Default to English
		}
	}

	public getString(key: string): string {
		const stringData = this.strings[key];
		if (!stringData) {
			// console.warn(`Localization key not found: ${key}`);
			return key;
		}
		return stringData[this.currentLanguage as keyof typeof stringData] || stringData.en;
	}

	public getStringWithParams(key: string, params: { [key: string]: string | number }): string {
		let text = this.getString(key);
		Object.keys(params).forEach(param => {
			text = text.replace(`%${param.toUpperCase()}%`, String(params[param]));
		});
		return text;
	}

	public setLanguage(language: "en" | "tr"): void {
		this.currentLanguage = language;
	}

	public getCurrentLanguage(): string {
		return this.currentLanguage;
	}

	public getSupportedLanguages(): string[] {
		return ["en", "tr"];
	}
}

export const localization = LocalizationManager.getInstance(); 