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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localization = exports.LocalizationManager = void 0;
const vscode = __importStar(require("vscode"));
class LocalizationManager {
    constructor() {
        this.currentLanguage = "tr";
        this.strings = {
            // Genel mesajlar
            "extension.activated": {
                en: "AccessiMind is now active!",
                tr: "AccessiMind aktif!"
            },
            "extension.deactivated": {
                en: "AccessiMind has been deactivated.",
                tr: "AccessiMind devre dışı bırakıldı."
            },
            "welcome.message": {
                en: "AccessiMind is active! Access from the AccessiMind menu.",
                tr: "AccessiMind aktif! AccessiMind menüsünden erişebilirsiniz."
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
            "ui.chat.welcome": {
                en: "Welcome to WCAG AI Chat!",
                tr: "WCAG AI Chat'e Hoş Geldiniz!"
            },
            "ui.chat.placeholder": {
                en: "Ask about WCAG accessibility...",
                tr: "WCAG erişilebilirlik hakkında soru sorun..."
            },
            "ui.chat.tip": {
                en: "💡 Tip: Try commands like \"Make this form accessible\" or \"Add ARIA labels\"",
                tr: "💡 İpucu: \"Bu formu erişilebilir hale getir\" veya \"ARIA etiketleri ekle\" gibi komutlar deneyin"
            },
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
            }
        };
        this.detectLanguage();
    }
    static getInstance() {
        if (!LocalizationManager.instance) {
            LocalizationManager.instance = new LocalizationManager();
        }
        return LocalizationManager.instance;
    }
    detectLanguage() {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const language = config.get("language", "auto");
            if (language === "auto") {
                // VS Code'un dil ayarını algıla
                const vscodeLanguage = vscode.env.language;
                this.currentLanguage = vscodeLanguage.startsWith("tr") ? "tr" : "en";
            }
            else {
                this.currentLanguage = language;
            }
        }
        catch (error) {
            console.error("Language detection error:", error);
            this.currentLanguage = "tr"; // Varsayılan olarak Türkçe
        }
    }
    getString(key) {
        const stringData = this.strings[key];
        if (!stringData) {
            console.warn(`Localization key not found: ${key}`);
            return key;
        }
        return stringData[this.currentLanguage] || stringData.en;
    }
    setLanguage(language) {
        this.currentLanguage = language;
    }
    getCurrentLanguage() {
        return this.currentLanguage;
    }
    getSupportedLanguages() {
        return ["en", "tr"];
    }
}
exports.LocalizationManager = LocalizationManager;
exports.localization = LocalizationManager.getInstance();
