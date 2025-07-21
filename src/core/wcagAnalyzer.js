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
exports.WcagAnalyzer = void 0;
const geminiApi_1 = require("../utils/geminiApi");
const logger_1 = require("../utils/logger");
class WcagAnalyzer {
    constructor() {
        this.geminiApi = geminiApi_1.GeminiAPI.getInstance();
    }
    analyzeCode(code, language, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info(`WCAG analizi başlıyor: ${fileName} (${language})`);
                // First, perform local static analysis
                const staticIssues = this.performStaticAnalysis(code, language);
                // Then, use AI for deeper analysis
                const aiAnalysis = yield this.performAiAnalysis(code, language, fileName);
                // Combine results
                const allIssues = [...staticIssues, ...aiAnalysis.issues];
                const summary = this.generateSummary(allIssues);
                const recommendations = this.generateRecommendations(allIssues);
                const wcagCriteria = this.extractWcagCriteria(allIssues);
                logger_1.logger.info(`WCAG analizi tamamlandı: ${allIssues.length} sorun bulundu`);
                return {
                    issues: allIssues,
                    summary,
                    recommendations,
                    wcagCriteria
                };
            }
            catch (error) {
                logger_1.logger.error("WCAG analizi hatası:", error);
                throw new Error(`WCAG analizi başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
            }
        });
    }
    generateDetailedReport(code, language, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const analysisResult = yield this.analyzeCode(code, language, fileName);
            // Add additional details for report
            analysisResult.recommendations.push("📋 Düzenli WCAG testleri yapın", "🔧 Otomatik erişilebilirlik testleri entegre edin", "👥 Kullanıcı testleri gerçekleştirin", "📚 WCAG 2.2 dokümantasyonunu inceleyin");
            return analysisResult;
        });
    }
    performStaticAnalysis(code, language) {
        const issues = [];
        if (["html", "htm", "jsx", "tsx", "vue", "svelte"].includes(language)) {
            // HTML-based analysis
            issues.push(...this.analyzeHtmlAccessibility(code));
        }
        if (["css", "scss", "sass", "less"].includes(language)) {
            // CSS-based analysis
            issues.push(...this.analyzeCssAccessibility(code));
        }
        if (["js", "ts", "jsx", "tsx"].includes(language)) {
            // JavaScript-based analysis
            issues.push(...this.analyzeJsAccessibility(code));
        }
        return issues;
    }
    analyzeHtmlAccessibility(code) {
        const issues = [];
        // Check for missing alt attributes
        const imgWithoutAlt = code.match(/<img(?![^>]*alt=)[^>]*>/gi);
        if (imgWithoutAlt) {
            issues.push({
                id: "img-alt-missing",
                severity: "critical",
                description: "Resim elementlerinde alt özelliği eksik",
                wcagCriterion: "1.1.1",
                suggestion: "Tüm img elementlerine anlamlı alt özelliği ekleyin"
            });
        }
        // Check for missing form labels
        const inputWithoutLabel = code.match(/<input(?![^>]*aria-label)(?![^>]*aria-labelledby)[^>]*>/gi);
        if (inputWithoutLabel) {
            issues.push({
                id: "input-label-missing",
                severity: "critical",
                description: "Form elementlerinde etiket eksik",
                wcagCriterion: "1.3.1",
                suggestion: "Tüm form elementlerine label veya aria-label ekleyin"
            });
        }
        // Check for missing heading hierarchy
        const headings = code.match(/<h[1-6][^>]*>/gi);
        if (headings) {
            const headingLevels = headings.map(h => { var _a; return parseInt(((_a = h.match(/h([1-6])/)) === null || _a === void 0 ? void 0 : _a[1]) || "1"); });
            if (headingLevels.length > 1) {
                for (let i = 1; i < headingLevels.length; i++) {
                    if (headingLevels[i] - headingLevels[i - 1] > 1) {
                        issues.push({
                            id: "heading-hierarchy",
                            severity: "major",
                            description: "Başlık hiyerarşisi düzensiz",
                            wcagCriterion: "1.3.1",
                            suggestion: "Başlık seviyelerini sıralı kullanın (h1, h2, h3...)"
                        });
                        break;
                    }
                }
            }
        }
        // Check for missing button accessibility
        const buttonsWithoutText = code.match(/<button[^>]*>[\s]*<\/button>/gi);
        if (buttonsWithoutText) {
            issues.push({
                id: "button-empty",
                severity: "critical",
                description: "Boş buton elementleri",
                wcagCriterion: "2.4.4",
                suggestion: "Butonlara anlamlı metin veya aria-label ekleyin"
            });
        }
        // Check for missing table headers
        const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
        const tables = code.match(tableRegex);
        if (tables) {
            const tablesWithoutHeaders = tables.filter(table => !table.includes("<th"));
            if (tablesWithoutHeaders.length > 0) {
                issues.push({
                    id: "table-headers-missing",
                    severity: "major",
                    description: "Tablo başlıkları eksik",
                    wcagCriterion: "1.3.1",
                    suggestion: "Tablolara th elementleri ve scope özelliği ekleyin"
                });
            }
        }
        return issues;
    }
    analyzeCssAccessibility(code) {
        const issues = [];
        // Check for low contrast colors (basic check)
        const colorProperties = code.match(/color\s*:\s*#[0-9a-f]{3,6}/gi);
        const backgroundProperties = code.match(/background-color\s*:\s*#[0-9a-f]{3,6}/gi);
        if (colorProperties && backgroundProperties) {
            // This is a simplified check - in production, you'd want proper contrast calculation
            issues.push({
                id: "color-contrast-check",
                severity: "minor",
                description: "Renk kontrastı kontrolü gerekli",
                wcagCriterion: "1.4.3",
                suggestion: "Renk kontrastının en az 4.5:1 oranında olduğunu doğrulayın"
            });
        }
        // Check for fixed font sizes
        const fixedFontSizes = code.match(/font-size\s*:\s*\d+px/gi);
        if (fixedFontSizes) {
            issues.push({
                id: "fixed-font-size",
                severity: "minor",
                description: "Sabit font boyutları kullanılıyor",
                wcagCriterion: "1.4.4",
                suggestion: "Ölçeklenebilir font boyutları (rem, em) kullanın"
            });
        }
        return issues;
    }
    analyzeJsAccessibility(code) {
        const issues = [];
        // Check for click-only event handlers
        const clickOnlyEvents = code.match(/onclick\s*=/gi);
        const keyboardEvents = code.match(/onkey(down|up|press)\s*=/gi);
        if (clickOnlyEvents && !keyboardEvents) {
            issues.push({
                id: "keyboard-navigation",
                severity: "major",
                description: "Klavye navigasyonu eksik",
                wcagCriterion: "2.1.1",
                suggestion: "Click olaylarına ek olarak klavye olayları da ekleyin"
            });
        }
        // Check for missing focus management
        const focusManagement = code.match(/(focus\(\)|blur\(\)|tabindex)/gi);
        if (!focusManagement && code.includes("addEventListener")) {
            issues.push({
                id: "focus-management",
                severity: "minor",
                description: "Odak yönetimi eksik olabilir",
                wcagCriterion: "2.4.3",
                suggestion: "Dinamik içerik değişikliklerinde odak yönetimi ekleyin"
            });
        }
        return issues;
    }
    performAiAnalysis(code, language, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const prompt = `Sen bir WCAG 2.2 erişilebilirlik uzmanısın. Aşağıdaki kodu analiz et ve WCAG sorunlarını tespit et.

Kod:
\`\`\`${language}
${code}
\`\`\`

Dosya: ${fileName}
Dil: ${language}

Lütfen şu formatta JSON yanıt ver:
{
  "issues": [
    {
      "id": "unique-id",
      "severity": "critical|major|minor",
      "description": "Sorun açıklaması",
      "wcagCriterion": "1.1.1",
      "suggestion": "Çözüm önerisi"
    }
  ]
}

Sadece gerçek WCAG sorunlarını raporla. Özellikle şunlara odaklan:
- Erişilebilirlik API'leri (ARIA)
- Klavye navigasyonu
- Renk kontrastı
- Semantik HTML
- Form erişilebilirliği
- Resim alt metinleri`;
                const response = yield this.geminiApi.improveCode({
                    code: prompt,
                    fileType: "analysis",
                    language: "text",
                    mode: "ask"
                });
                if (response.success && response.content) {
                    try {
                        // Try to parse JSON response
                        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const analysisData = JSON.parse(jsonMatch[0]);
                            return { issues: analysisData.issues || [] };
                        }
                    }
                    catch (parseError) {
                        logger_1.logger.warn("AI yanıtı JSON formatında değil, metin analizi yapılıyor");
                        // Fallback to text analysis
                        return this.parseTextAnalysis(response.content);
                    }
                }
                return { issues: [] };
            }
            catch (error) {
                logger_1.logger.error("AI analizi hatası:", error);
                return { issues: [] };
            }
        });
    }
    parseTextAnalysis(text) {
        const issues = [];
        // Simple text parsing for common WCAG issues mentioned in AI response
        if (text.toLowerCase().includes("alt")) {
            issues.push({
                id: "ai-alt-text",
                severity: "major",
                description: "AI alt metin önerisi",
                wcagCriterion: "1.1.1",
                suggestion: "Resim alt metinlerini kontrol edin"
            });
        }
        if (text.toLowerCase().includes("aria")) {
            issues.push({
                id: "ai-aria",
                severity: "major",
                description: "AI ARIA önerisi",
                wcagCriterion: "4.1.2",
                suggestion: "ARIA etiketlerini kontrol edin"
            });
        }
        return { issues };
    }
    generateSummary(issues) {
        const criticalIssues = issues.filter(i => i.severity === "critical").length;
        const majorIssues = issues.filter(i => i.severity === "major").length;
        const minorIssues = issues.filter(i => i.severity === "minor").length;
        let complianceLevel = "AAA";
        if (criticalIssues > 0) {
            complianceLevel = "Non-compliant";
        }
        else if (majorIssues > 0) {
            complianceLevel = "A";
        }
        else if (minorIssues > 0) {
            complianceLevel = "AA";
        }
        return {
            totalIssues: issues.length,
            criticalIssues,
            majorIssues,
            minorIssues,
            complianceLevel
        };
    }
    generateRecommendations(issues) {
        const recommendations = [];
        if (issues.some(i => i.id.includes("alt"))) {
            recommendations.push("🖼️ Tüm resimlere anlamlı alt metinleri ekleyin");
        }
        if (issues.some(i => i.id.includes("label"))) {
            recommendations.push("🏷️ Form elementlerine uygun etiketler ekleyin");
        }
        if (issues.some(i => i.id.includes("heading"))) {
            recommendations.push("📝 Başlık hiyerarşisini düzenleyin");
        }
        if (issues.some(i => i.id.includes("keyboard"))) {
            recommendations.push("⌨️ Klavye navigasyonu desteği ekleyin");
        }
        if (issues.some(i => i.id.includes("contrast"))) {
            recommendations.push("🎨 Renk kontrastını artırın");
        }
        if (recommendations.length === 0) {
            recommendations.push("✅ Kod WCAG standartlarına uygun görünüyor");
        }
        return recommendations;
    }
    extractWcagCriteria(issues) {
        const criteria = new Set();
        issues.forEach(issue => {
            if (issue.wcagCriterion) {
                criteria.add(issue.wcagCriterion);
            }
        });
        return Array.from(criteria).sort();
    }
}
exports.WcagAnalyzer = WcagAnalyzer;
