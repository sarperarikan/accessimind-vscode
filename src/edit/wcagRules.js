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
exports.applyWcagImprovements = void 0;
function applyWcagImprovements(code, improvements) {
    return __awaiter(this, void 0, void 0, function* () {
        let improvedCode = code;
        const improvementRules = getWcagImprovementRules();
        for (const improvementType of improvements) {
            const rule = improvementRules.find(rule => rule.name === improvementType);
            if (rule) {
                improvedCode = rule.apply(improvedCode);
            }
        }
        return improvedCode;
    });
}
exports.applyWcagImprovements = applyWcagImprovements;
function getWcagImprovementRules() {
    return [
        {
            name: "form-accessibility",
            description: "Form elementleri için erişilebilirlik iyileştirmeleri",
            apply: (code) => improveFormAccessibility(code)
        },
        {
            name: "aria-labels",
            description: "ARIA etiketleri ve açıklamaları ekle",
            apply: (code) => addAriaLabels(code)
        },
        {
            name: "keyboard-navigation",
            description: "Klavye navigasyonu için tabindex ve event handler'lar ekle",
            apply: (code) => addKeyboardNavigation(code)
        },
        {
            name: "color-contrast",
            description: "WCAG 2.2 AA kontrast oranları için CSS ekle",
            apply: (code) => addColorContrast(code)
        },
        {
            name: "image-alt-text",
            description: "Resimler için alt text ve açıklamalar ekle",
            apply: (code) => addImageAltText(code)
        },
        {
            name: "table-accessibility",
            description: "Tablolar için başlık hücreleri ve açıklamalar ekle",
            apply: (code) => improveTableAccessibility(code)
        },
        {
            name: "error-messages",
            description: "Hata mesajları için ARIA live regions ekle",
            apply: (code) => addErrorMessages(code)
        }
    ];
}
function improveFormAccessibility(code) {
    let improvedCode = code;
    // Input elementleri için label ekleme
    improvedCode = improvedCode.replace(/<input([^>]*?)>/g, (match, attributes) => {
        const idMatch = attributes.match(/id="([^"]*)"/);
        const nameMatch = attributes.match(/name="([^"]*)"/);
        const typeMatch = attributes.match(/type="([^"]*)"/);
        const id = idMatch ? idMatch[1] : nameMatch ? nameMatch[1] : "input";
        const name = nameMatch ? nameMatch[1] : id;
        const type = typeMatch ? typeMatch[1] : "text";
        const labelText = getLabelText(name, type);
        // Eğer zaten label varsa, sadece input'u iyileştir
        if (improvedCode.includes(`for="${id}"`)) {
            return `<input${attributes} aria-describedby="${id}-error">`;
        }
        return `<label for="${id}">${labelText}</label>\n<input${attributes} aria-describedby="${id}-error">`;
    });
    // Form elementleri için role ve aria-labelledby ekleme
    if (improvedCode.includes("<form") && !improvedCode.includes("role=\"form\"")) {
        improvedCode = improvedCode.replace(/<form([^>]*?)>/g, "<form$1 role=\"form\" aria-labelledby=\"form-title\">");
    }
    // Required field'lar için aria-required ekleme
    improvedCode = improvedCode.replace(/<input([^>]*?)>/g, (match, attributes) => {
        if (attributes.includes("required") && !attributes.includes("aria-required")) {
            return `<input${attributes} aria-required="true">`;
        }
        return match;
    });
    return improvedCode;
}
function addAriaLabels(code) {
    let improvedCode = code;
    // Butonlar için aria-label ekleme
    improvedCode = improvedCode.replace(/<button([^>]*?)>([^<]*)<\/button>/g, (match, attributes, text) => {
        if (attributes.includes("aria-label"))
            return match;
        const ariaLabel = text.trim() || "Buton";
        return `<button${attributes} aria-label="${ariaLabel}">${text}</button>`;
    });
    // Linkler için aria-label ekleme
    improvedCode = improvedCode.replace(/<a([^>]*?)>([^<]*)<\/a>/g, (match, attributes, text) => {
        if (attributes.includes("aria-label"))
            return match;
        const ariaLabel = text.trim() || "Link";
        return `<a${attributes} aria-label="${ariaLabel}">${text}</a>`;
    });
    // Navigasyon için aria-label ekleme
    if (improvedCode.includes("<nav") && !improvedCode.includes("aria-label")) {
        improvedCode = improvedCode.replace(/<nav([^>]*?)>/g, "<nav$1 aria-label=\"Ana navigasyon\">");
    }
    return improvedCode;
}
function addKeyboardNavigation(code) {
    let improvedCode = code;
    // Butonlar için tabindex ve keyboard event'leri ekleme
    improvedCode = improvedCode.replace(/<button([^>]*?)>/g, (match, attributes) => {
        if (attributes.includes("tabindex"))
            return match;
        return `<button${attributes} tabindex="0" onkeydown="handleKeyDown(event)">`;
    });
    // Linkler için tabindex ekleme
    improvedCode = improvedCode.replace(/<a([^>]*?)>/g, (match, attributes) => {
        if (attributes.includes("tabindex"))
            return match;
        return `<a${attributes} tabindex="0">`;
    });
    // Focus styles ekleme
    if (!improvedCode.includes("focus")) {
        const focusStyles = `
<style>
	button:focus, a:focus, input:focus, select:focus, textarea:focus {
		outline: 2px solid #2563eb;
		outline-offset: 2px;
	}
	
	button:focus-visible, a:focus-visible {
		box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #2563eb;
	}
</style>`;
        improvedCode = focusStyles + "\n" + improvedCode;
    }
    return improvedCode;
}
function addColorContrast(code) {
    let improvedCode = code;
    // WCAG 2.2 AA kontrast oranları için CSS değişkenleri
    const contrastStyles = `
<style>
	/* WCAG 2.2 AA kontrast oranları */
	:root {
		--primary-color: #2563eb;
		--primary-text: #ffffff;
		--secondary-color: #64748b;
		--secondary-text: #ffffff;
		--error-color: #dc2626;
		--success-color: #16a34a;
		--warning-color: #ca8a04;
		--background-color: #ffffff;
		--text-color: #1f2937;
	}
	
	body {
		background-color: var(--background-color);
		color: var(--text-color);
	}
	
	button, input[type="submit"], input[type="button"] {
		background-color: var(--primary-color);
		color: var(--primary-text);
		border: 2px solid var(--primary-color);
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
	}
	
	button:hover, input[type="submit"]:hover, input[type="button"]:hover {
		background-color: #1d4ed8;
		border-color: #1d4ed8;
	}
	
	input, select, textarea {
		border: 2px solid var(--secondary-color);
		color: var(--text-color);
		background-color: var(--background-color);
		padding: 8px;
		border-radius: 4px;
	}
	
	.error-message {
		color: var(--error-color);
		font-weight: bold;
	}
	
	.success-message {
		color: var(--success-color);
		font-weight: bold;
	}
	
	.warning-message {
		color: var(--warning-color);
		font-weight: bold;
	}
	
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
</style>`;
    // Eğer style tag'i yoksa ekle
    if (!improvedCode.includes("<style>")) {
        improvedCode = contrastStyles + "\n" + improvedCode;
    }
    else {
        // Mevcut style tag'ine ekle
        improvedCode = improvedCode.replace(/<\/style>/g, `${contrastStyles.replace("<style>", "").replace("</style>", "")}\n</style>`);
    }
    return improvedCode;
}
function addImageAltText(code) {
    let improvedCode = code;
    // Resimler için alt text ekleme
    improvedCode = improvedCode.replace(/<img([^>]*?)>/g, (match, attributes) => {
        var _a;
        if (attributes.includes("alt="))
            return match;
        const srcMatch = attributes.match(/src="([^"]*)"/);
        const src = srcMatch ? srcMatch[1] : "resim";
        // Dosya adından alt text oluştur
        const fileName = ((_a = src.split("/").pop()) === null || _a === void 0 ? void 0 : _a.split(".")[0]) || "resim";
        const altText = fileName.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        return `<img${attributes} alt="${altText}">`;
    });
    // Dekoratif resimler için aria-hidden ekleme
    improvedCode = improvedCode.replace(/<img([^>]*?)alt="([^"]*)"([^>]*?)>/g, (match, beforeAlt, altText, afterAlt) => {
        if (altText.toLowerCase().includes("dekoratif") || altText === "") {
            return `<img${beforeAlt}alt=""${afterAlt} aria-hidden="true">`;
        }
        return match;
    });
    return improvedCode;
}
function improveTableAccessibility(code) {
    let improvedCode = code;
    // Tablolar için caption ekleme
    improvedCode = improvedCode.replace(/<table([^>]*?)>/g, (match, attributes) => {
        if (improvedCode.includes("<caption>"))
            return match;
        return `<table${attributes}>\n<caption>Tablo Başlığı</caption>`;
    });
    // Tablo başlık hücreleri için scope ekleme
    improvedCode = improvedCode.replace(/<th([^>]*?)>/g, (match, attributes) => {
        if (attributes.includes("scope="))
            return match;
        return `<th${attributes} scope="col">`;
    });
    // Tablo satır başlıkları için scope ekleme
    improvedCode = improvedCode.replace(/<tr[^>]*?>\s*<th([^>]*?)>/g, (match, attributes) => {
        if (attributes.includes("scope="))
            return match;
        return match.replace("<th", "<th scope=\"row\"");
    });
    return improvedCode;
}
function addErrorMessages(code) {
    let improvedCode = code;
    // Form elementleri için error message container'ları ekleme
    improvedCode = improvedCode.replace(/<input([^>]*?)>/g, (match, attributes) => {
        const idMatch = attributes.match(/id="([^"]*)"/);
        const nameMatch = attributes.match(/name="([^"]*)"/);
        const id = idMatch ? idMatch[1] : nameMatch ? nameMatch[1] : "input";
        // Eğer zaten error container varsa ekleme
        if (improvedCode.includes(`${id}-error`))
            return match;
        return `<input${attributes}>\n<div id="${id}-error" class="error-message" role="alert" aria-live="polite"></div>`;
    });
    // Form submit butonları için help text ekleme
    improvedCode = improvedCode.replace(/<button([^>]*?)type="submit"([^>]*?)>([^<]*)<\/button>/g, (match, beforeType, afterType, text) => {
        return `<button${beforeType}type="submit"${afterType} aria-describedby="submit-help">${text}</button>\n<div id="submit-help" class="sr-only">Formu göndermek için Enter tuşuna basın</div>`;
    });
    return improvedCode;
}
function getLabelText(name, type) {
    const labelMap = {
        "name": "Ad Soyad",
        "email": "E-posta",
        "password": "Şifre",
        "phone": "Telefon",
        "address": "Adres",
        "city": "Şehir",
        "country": "Ülke",
        "zip": "Posta Kodu",
        "username": "Kullanıcı Adı",
        "search": "Arama",
        "comment": "Yorum",
        "message": "Mesaj",
        "subject": "Konu"
    };
    return labelMap[name] || name.charAt(0).toUpperCase() + name.slice(1);
}
