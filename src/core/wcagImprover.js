"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WcagImprover = void 0;
const geminiApi_1 = require("../utils/geminiApi");
const logger_1 = require("../utils/logger");
class WcagImprover {
    constructor() {
        this.geminiApi = geminiApi_1.GeminiAPI.getInstance();
    }
    improveCode(code, language, fileName, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info(`WCAG iyileştirme başlıyor: ${fileName} (${language})`);
                const { includeComments = true, wcagLevel = "AA", isSelection = false } = options;
                // Build comprehensive prompt for AI
                const prompt = this.buildImprovementPrompt(code, language, fileName, wcagLevel, includeComments, isSelection);
                // Get AI improvement
                const response = yield this.geminiApi.improveCode({
                    code,
                    fileType: fileName.split(".").pop() || "unknown",
                    language,
                    mode: "edit",
                    wcagLevel,
                    includeComments
                });
                if (response.success && response.content) {
                    // Extract WCAG criteria from the improved code comments
                    const wcagCriteria = this.extractWcagCriteriaFromCode(response.content);
                    const improvementsSummary = this.generateImprovementsSummary(code, response.content, language);
                    logger_1.logger.info(`WCAG iyileştirme tamamlandı: ${wcagCriteria.length} kriter uygulandı`);
                    return {
                        success: true,
                        improvedCode: response.content,
                        wcagCriteria,
                        tokensUsed: response.tokensUsed,
                        improvementsSummary
                    };
                }
                else {
                    throw new Error(response.error || "AI iyileştirme başarısız");
                }
            }
            catch (error) {
                logger_1.logger.error("WCAG iyileştirme hatası:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Bilinmeyen hata"
                };
            }
        });
    }
    addSpecificImprovement(code, language, improvementType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info(`Spesifik WCAG iyileştirmesi: ${improvementType} (${language})`);
                let prompt = "";
                let wcagCriteria = [];
                switch (improvementType) {
                    case "aria-labels":
                        prompt = this.buildAriaLabelsPrompt(code, language);
                        wcagCriteria = ["1.3.1", "4.1.2"];
                        break;
                    case "color-contrast":
                        prompt = this.buildColorContrastPrompt(code, language);
                        wcagCriteria = ["1.4.3", "1.4.6"];
                        break;
                    case "keyboard-navigation":
                        prompt = this.buildKeyboardNavigationPrompt(code, language);
                        wcagCriteria = ["2.1.1", "2.1.2", "2.4.3"];
                        break;
                }
                const response = yield this.geminiApi.improveCode({
                    code: prompt,
                    fileType: "improvement",
                    language: "text",
                    mode: "edit"
                });
                if (response.success && response.content) {
                    // Extract the improved code from AI response
                    const improvedCode = this.extractCodeFromResponse(response.content, language);
                    return {
                        success: true,
                        improvedCode: improvedCode || response.content,
                        wcagCriteria,
                        tokensUsed: response.tokensUsed,
                        improvementsSummary: [`${improvementType} iyileştirmeleri uygulandı`]
                    };
                }
                else {
                    throw new Error(response.error || `${improvementType} iyileştirme başarısız`);
                }
            }
            catch (error) {
                logger_1.logger.error(`${improvementType} iyileştirme hatası:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Bilinmeyen hata"
                };
            }
        });
    }
    buildImprovementPrompt(code, language, fileName, wcagLevel, includeComments, isSelection) {
        const contextType = isSelection ? "seçili kod parçası" : "dosya";
        return `Sen bir WCAG 2.2 erişilebilirlik uzmanısın. Aşağıdaki ${contextType}yı WCAG ${wcagLevel} seviyesinde iyileştir.

Dosya: ${fileName}
Dil: ${language}
WCAG Seviyesi: ${wcagLevel}
${includeComments ? "Yorumlar dahil edilsin: Evet" : "Yorumlar dahil edilsin: Hayır"}

Mevcut Kod:
\`\`\`${language}
${code}
\`\`\`

Lütfen şu WCAG kriterlerine odaklan:

**1. Algılanabilirlik (Perceivable)**
- 1.1.1: Metin Alternatifleri (alt metinler)
- 1.3.1: Bilgi ve İlişkiler (semantik markup)
- 1.4.3: Kontrast (Minimum) - AA seviyesi için 4.5:1
- 1.4.4: Metni Yeniden Boyutlandırma

**2. İşletilebilirlik (Operable)**
- 2.1.1: Klavye Erişimi
- 2.1.2: Klavye Tuzağı Yok
- 2.4.1: Blokları Atlama
- 2.4.3: Odak Sırası
- 2.4.4: Bağlantı Amacı (Bağlam İçinde)

**3. Anlaşılabilirlik (Understandable)**
- 3.1.1: Sayfanın Dili
- 3.2.1: Odakta Bağlam Değişikliği
- 3.3.1: Hata Tanımlama
- 3.3.2: Etiketler veya Talimatlar

**4. Sağlamlık (Robust)**
- 4.1.1: Ayrıştırma
- 4.1.2: Ad, Rol, Değer (ARIA)

${includeComments ? `
Yapılan her iyileştirme için açıklayıcı yorumlar ekle:
- /* WCAG 1.1.1: Alt metin eklendi */
- <!-- WCAG 2.1.1: Klavye navigasyonu için tabindex eklendi -->
- // WCAG 4.1.2: ARIA etiketleri eklendi
` : ""}

Sadece iyileştirilmiş kodu döndür. Ek açıklama yapma.

${isSelection ? "Bu bir kod seçimi olduğu için sadece seçili kısmı iyileştir." : "Tüm dosyayı iyileştir."}`;
    }
    buildAriaLabelsPrompt(code, language) {
        return `Sen bir WCAG erişilebilirlik uzmanısın. Aşağıdaki koda ARIA etiketleri ekle.

Kod:
\`\`\`${language}
${code}
\`\`\`

Şu ARIA özelliklerini ekle:
- aria-label: Kısa açıklayıcı etiket
- aria-labelledby: Başka bir elementle etiketleme
- aria-describedby: Ek açıklama referansı
- aria-hidden: Dekoratif elementler için
- aria-expanded: Genişletilebilir elementler için
- aria-current: Mevcut sayfa/durum için
- role: Semantik rol tanımlaması

Sadece iyileştirilmiş kodu döndür.`;
    }
    buildColorContrastPrompt(code, language) {
        return `Sen bir WCAG erişilebilirlik uzmanısın. Aşağıdaki kodda renk kontrastını iyileştir.

Kod:
\`\`\`${language}
${code}
\`\`\`

WCAG AA seviyesi için:
- Normal metin: En az 4.5:1 kontrast oranı
- Büyük metin (18pt+ veya 14pt+ kalın): En az 3:1 kontrast oranı

Şunları yap:
- Düşük kontrastlı renkleri değiştir
- Yüksek kontrastlı renk kombinasyonları kullan
- Renk körü dostu renkler seç
- Sadece renkle bilgi verme, ek göstergeler ekle

Sadece iyileştirilmiş kodu döndür.`;
    }
    buildKeyboardNavigationPrompt(code, language) {
        return `Sen bir WCAG erişilebilirlik uzmanısın. Aşağıdaki koda klavye navigasyonu desteği ekle.

Kod:
\`\`\`${language}
${code}
\`\`\`

Şunları ekle:
- tabindex özelliği (0, -1 veya pozitif değerler)
- Klavye olay dinleyicileri (keydown, keyup, keypress)
- Enter ve Space tuşu desteği
- Escape tuşu ile kapatma
- Arrow tuşları ile navigasyon
- Focus yönetimi
- Skip links (ana içeriğe atla)

Sadece iyileştirilmiş kodu döndür.`;
    }
    extractWcagCriteriaFromCode(code) {
        const criteria = new Set();
        // Look for WCAG comments in the code
        const wcagRegex = /WCAG\s+(\d+\.\d+\.\d+)/gi;
        let match;
        while ((match = wcagRegex.exec(code)) !== null) {
            criteria.add(match[1]);
        }
        // If no criteria found in comments, infer from code improvements
        if (criteria.size === 0) {
            if (code.includes("alt=") || code.includes("aria-label")) {
                criteria.add("1.1.1");
            }
            if (code.includes("aria-") || code.includes("role=")) {
                criteria.add("4.1.2");
            }
            if (code.includes("tabindex") || code.includes("onkeydown")) {
                criteria.add("2.1.1");
            }
            if (code.includes("label") && code.includes("input")) {
                criteria.add("1.3.1");
            }
        }
        return Array.from(criteria).sort();
    }
    generateImprovementsSummary(originalCode, improvedCode, language) {
        const summary = [];
        // Count improvements
        const originalAltCount = (originalCode.match(/alt=/g) || []).length;
        const improvedAltCount = (improvedCode.match(/alt=/g) || []).length;
        if (improvedAltCount > originalAltCount) {
            summary.push(`🖼️ ${improvedAltCount - originalAltCount} alt metni eklendi`);
        }
        const originalAriaCount = (originalCode.match(/aria-/g) || []).length;
        const improvedAriaCount = (improvedCode.match(/aria-/g) || []).length;
        if (improvedAriaCount > originalAriaCount) {
            summary.push(`🏷️ ${improvedAriaCount - originalAriaCount} ARIA özelliği eklendi`);
        }
        const originalTabindexCount = (originalCode.match(/tabindex/g) || []).length;
        const improvedTabindexCount = (improvedCode.match(/tabindex/g) || []).length;
        if (improvedTabindexCount > originalTabindexCount) {
            summary.push(`⌨️ ${improvedTabindexCount - originalTabindexCount} klavye navigasyonu eklendi`);
        }
        const originalLabelCount = (originalCode.match(/<label/g) || []).length;
        const improvedLabelCount = (improvedCode.match(/<label/g) || []).length;
        if (improvedLabelCount > originalLabelCount) {
            summary.push(`🏷️ ${improvedLabelCount - originalLabelCount} form etiketi eklendi`);
        }
        const originalRoleCount = (originalCode.match(/role=/g) || []).length;
        const improvedRoleCount = (improvedCode.match(/role=/g) || []).length;
        if (improvedRoleCount > originalRoleCount) {
            summary.push(`🎭 ${improvedRoleCount - originalRoleCount} semantik rol eklendi`);
        }
        // Check for semantic improvements
        const semanticElements = ["header", "nav", "main", "section", "article", "aside", "footer"];
        semanticElements.forEach(element => {
            const originalCount = (originalCode.match(new RegExp(`<${element}`, "g")) || []).length;
            const improvedCount = (improvedCode.match(new RegExp(`<${element}`, "g")) || []).length;
            if (improvedCount > originalCount) {
                summary.push(`📝 ${improvedCount - originalCount} ${element} elementi eklendi`);
            }
        });
        if (summary.length === 0) {
            summary.push("✨ Kod WCAG standartlarına uygun hale getirildi");
        }
        return summary;
    }
    extractCodeFromResponse(response, language) {
        // Try to extract code block from markdown
        const codeBlockRegex = new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``, "i");
        const match = response.match(codeBlockRegex);
        if (match) {
            return match[1].trim();
        }
        // Try generic code block
        const genericCodeBlock = response.match(/```[\s\S]*?```/);
        if (genericCodeBlock) {
            return genericCodeBlock[0].replace(/```\w*\n?/g, "").replace(/```$/g, "").trim();
        }
        // If no code block found, return the response as is
        return null;
    }
}
exports.WcagImprover = WcagImprover;
