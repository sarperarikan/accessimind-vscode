"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUserInput = validateUserInput;
exports.validateHtmlCode = validateHtmlCode;
exports.validateWcagConformance = validateWcagConformance;
function validateUserInput(input) {
    if (!input || input.trim().length === 0) {
        return "Talimat boş olamaz.";
    }
    if (input.trim().length < 5) {
        return "Talimat en az 5 karakter olmalıdır.";
    }
    if (input.trim().length > 500) {
        return "Talimat en fazla 500 karakter olabilir.";
    }
    // Zararlı karakterleri kontrol et
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
        /alert\s*\(/i
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(input)) {
            return "Talimat güvenlik nedeniyle reddedildi.";
        }
    }
    return undefined; // Geçerli
}
function validateHtmlCode(code) {
    const errors = [];
    // Temel HTML yapısı kontrolü
    if (!code.includes("<") || !code.includes(">")) {
        errors.push("Geçerli HTML kodu değil.");
    }
    // Açık/kapalı tag kontrolü
    const openTags = (code.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (code.match(/<\/[^>]*>/g) || []).length;
    if (Math.abs(openTags - closeTags) > 2) {
        errors.push("HTML tag'leri dengesiz görünüyor.");
    }
    // Zararlı içerik kontrolü
    const dangerousContent = [
        "<script",
        "javascript:",
        "onclick=",
        "onload=",
        "eval(",
        "alert("
    ];
    for (const dangerous of dangerousContent) {
        if (code.toLowerCase().includes(dangerous)) {
            errors.push(`Güvenlik riski: ${dangerous}`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function validateWcagConformance(code) {
    const issues = [];
    // WCAG 2.2 kontrolleri
    const checks = [
        {
            name: "Form Labels",
            pattern: /<input[^>]*>/g,
            required: /<label[^>]*>/g,
            message: "Form elementleri için label eksik"
        },
        {
            name: "Button Accessibility",
            pattern: /<button[^>]*>/g,
            required: /aria-label|aria-labelledby/g,
            message: "Butonlar için ARIA etiketleri eksik"
        },
        {
            name: "Image Alt Text",
            pattern: /<img[^>]*>/g,
            required: /alt=/g,
            message: "Resimler için alt text eksik"
        },
        {
            name: "Table Headers",
            pattern: /<table[^>]*>/g,
            required: /<th[^>]*>/g,
            message: "Tablolar için başlık hücreleri eksik"
        }
    ];
    for (const check of checks) {
        const elements = code.match(check.pattern) || [];
        const requiredElements = code.match(check.required) || [];
        if (elements.length > 0 && requiredElements.length < elements.length) {
            issues.push(check.message);
        }
    }
    // Kontrast kontrolü (basit)
    if (code.includes("color:") && !code.includes("background-color:")) {
        issues.push("Renk kontrastı için background-color tanımlanmamış");
    }
    // Klavye navigasyonu kontrolü
    if (code.includes("<button") && !code.includes("tabindex")) {
        issues.push("Butonlar için klavye navigasyonu eksik");
    }
    return {
        conformant: issues.length === 0,
        issues
    };
}
//# sourceMappingURL=validationUtils.js.map