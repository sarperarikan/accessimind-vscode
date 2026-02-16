import * as vscode from "vscode";
import { AIProviderManager } from "../utils/aiProvider";

export interface CodeGenerationResult {
	code: string
	explanation: string
	wcagConformance: string[]
}

export async function generateAccessibleCode(
	prompt: string,
	existingCode: string = ""
): Promise<string> {
	// Önce AI Provider bağlantısını kontrol et
	const aiProviderManager = AIProviderManager.getInstance();
	const provider = await aiProviderManager.getCurrentProviderInstance();
	const isConnected = await provider.isAvailable();

	if (isConnected) {
		try {
			const codeContext = existingCode ? `\n\n**Mevcut Kod:**\n\`\`\`\n${existingCode}\n\`\`\`` : "";

			const enhancedPrompt = `Sen bir WCAG 2.2 erişilebilirlik uzmanısın. Aşağıdaki talimatı takip ederek erişilebilir kod üret.

**Talimat:** ${prompt}${codeContext}

Lütfen WCAG 2.2 standartlarına uyumlu, erişilebilir kod üret. Kod şu özelliklere sahip olmalı:
- Uygun ARIA etiketleri
- Semantik HTML yapısı
- Klavye navigasyonu desteği
- Yüksek kontrast renkler
- Açıklayıcı yorumlar

Sadece üretilen kodu döndür, açıklama ekleme.`;

			const response = await provider.improveCode({
				code: existingCode,
				fileType: "html",
				language: "html",
				selectedText: existingCode,
				mode: "edit"
			});

			if (response.success && response.content) {
				return response.content;
			} else {
				throw new Error(response.error || "Kod üretimi başarısız");
			}
		} catch (err) {
			vscode.window.showWarningMessage("Gemini API ile kod üretimi başarısız oldu, yerel şablonlar kullanılacak.");
		}
	}

	// API bağlantısı yoksa veya hata olursa local şablonları kullan
	const templates = getWcagTemplates();
	const analysis = analyzePrompt(prompt);
	const template = selectTemplate(analysis, templates);
	const generatedCode = await generateCodeFromTemplate(template, analysis, existingCode);
	return generatedCode;
}

function analyzePrompt(prompt: string) {
	const lowerPrompt = prompt.toLowerCase();

	return {
		isForm: lowerPrompt.includes("form") || lowerPrompt.includes("formu"),
		isButton: lowerPrompt.includes("button") || lowerPrompt.includes("buton"),
		isNavigation: lowerPrompt.includes("nav") || lowerPrompt.includes("menü"),
		isImage: lowerPrompt.includes("image") || lowerPrompt.includes("resim"),
		isTable: lowerPrompt.includes("table") || lowerPrompt.includes("tablo"),
		isModal: lowerPrompt.includes("modal") || lowerPrompt.includes("dialog"),
		needsAria: lowerPrompt.includes("aria") || lowerPrompt.includes("etiket"),
		needsKeyboard: lowerPrompt.includes("klavye") || lowerPrompt.includes("keyboard"),
		needsContrast: lowerPrompt.includes("kontrast") || lowerPrompt.includes("renk")
	};
}

function getWcagTemplates() {
	return {
		form: {
			name: "Erişilebilir Form",
			template: `
<form role="form" aria-labelledby="form-title">
	<h2 id="form-title">Form Başlığı</h2>
	
	<div class="form-group">
		<label for="name-input" id="name-label">Ad Soyad:</label>
		<input 
			type="text" 
			id="name-input" 
			name="name" 
			aria-labelledby="name-label"
			aria-required="true"
			aria-describedby="name-error"
			required
		/>
		<div id="name-error" class="error-message" role="alert" aria-live="polite"></div>
	</div>
	
	<div class="form-group">
		<label for="email-input" id="email-label">E-posta:</label>
		<input 
			type="email" 
			id="email-input" 
			name="email" 
			aria-labelledby="email-label"
			aria-required="true"
			aria-describedby="email-error"
			required
		/>
		<div id="email-error" class="error-message" role="alert" aria-live="polite"></div>
	</div>
	
	<button type="submit" aria-describedby="submit-help">
		Gönder
	</button>
	<div id="submit-help" class="sr-only">
		Formu göndermek için Enter tuşuna basın
	</div>
</form>`
		},

		button: {
			name: "Erişilebilir Buton",
			template: `
<button 
	type="button" 
	aria-label="Açıklayıcı buton metni"
	aria-describedby="button-help"
	onclick="handleClick()"
	onkeydown="handleKeyDown(event)"
>
	Buton Metni
</button>
<div id="button-help" class="sr-only">
	Bu buton için ek açıklama
</div>`
		},

		navigation: {
			name: "Erişilebilir Navigasyon",
			template: `
<nav role="navigation" aria-label="Ana navigasyon">
	<ul>
		<li><a href="#home" aria-current="page">Ana Sayfa</a></li>
		<li><a href="#about">Hakkımızda</a></li>
		<li><a href="#contact">İletişim</a></li>
	</ul>
</nav>`
		},

		image: {
			name: "Erişilebilir Resim",
			template: `
<img 
	src="image.jpg" 
	alt="Resmin detaylı açıklaması"
	aria-describedby="image-description"
/>
<div id="image-description" class="sr-only">
	Resim hakkında ek bilgiler
</div>`
		},

		table: {
			name: "Erişilebilir Tablo",
			template: `
<table role="table" aria-labelledby="table-title">
	<caption id="table-title">Tablo Başlığı</caption>
	<thead>
		<tr>
			<th scope="col">Başlık 1</th>
			<th scope="col">Başlık 2</th>
			<th scope="col">Başlık 3</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<th scope="row">Satır 1</th>
			<td>Veri 1</td>
			<td>Veri 2</td>
		</tr>
	</tbody>
</table>`
		},

		modal: {
			name: "Erişilebilir Modal",
			template: `
<div 
	role="dialog" 
	aria-modal="true" 
	aria-labelledby="modal-title"
	aria-describedby="modal-description"
>
	<div class="modal-header">
		<h2 id="modal-title">Modal Başlığı</h2>
		<button 
			type="button" 
			aria-label="Modal'ı kapat"
			onclick="closeModal()"
		>
			×
		</button>
	</div>
	<div id="modal-description">
		Modal içeriği buraya gelecek
	</div>
</div>`
		}
	};
}

function selectTemplate(analysis: any, templates: any) {
	if (analysis.isForm) return templates.form;
	if (analysis.isButton) return templates.button;
	if (analysis.isNavigation) return templates.navigation;
	if (analysis.isImage) return templates.image;
	if (analysis.isTable) return templates.table;
	if (analysis.isModal) return templates.modal;

	// Varsayılan olarak form template'i döndür
	return templates.form;
}

async function generateCodeFromTemplate(
	template: any,
	analysis: any,
	existingCode: string
): Promise<string> {
	let code = template.template;

	// Mevcut kod varsa, onu analiz et ve uyarla
	if (existingCode.trim()) {
		code = adaptExistingCode(existingCode, template.template);
	}

	// WCAG 2.2 uyumu için ek özellikler ekle
	code = addWcagEnhancements(code, analysis);

	return code;
}

function adaptExistingCode(existingCode: string, template: string): string {
	// Basit HTML parsing ve uyarlama
	const lines = existingCode.split("\n");
	let adaptedCode = existingCode;

	// Form elementleri için label ekleme
	if (existingCode.includes("<input") && !existingCode.includes("<label")) {
		adaptedCode = addLabelsToInputs(adaptedCode);
	}

	// Butonlar için aria-label ekleme
	if (existingCode.includes("<button") && !existingCode.includes("aria-label")) {
		adaptedCode = addAriaLabelsToButtons(adaptedCode);
	}

	return adaptedCode;
}

function addLabelsToInputs(code: string): string {
	return code.replace(
		/<input([^>]*?)>/g,
		(match, attributes) => {
			const idMatch = attributes.match(/id="([^"]*)"/);
			const nameMatch = attributes.match(/name="([^"]*)"/);
			const typeMatch = attributes.match(/type="([^"]*)"/);

			const id = idMatch ? idMatch[1] : nameMatch ? nameMatch[1] : "input";
			const name = nameMatch ? nameMatch[1] : id;
			const type = typeMatch ? typeMatch[1] : "text";

			const labelText = getLabelText(name, type);

			return `<label for="${id}">${labelText}</label>\n<input${attributes}>`;
		}
	);
}

function addAriaLabelsToButtons(code: string): string {
	return code.replace(
		/<button([^>]*?)>([^<]*)<\/button>/g,
		(match, attributes, text) => {
			if (attributes.includes("aria-label")) return match;

			const ariaLabel = text.trim() || "Buton";
			return `<button${attributes} aria-label="${ariaLabel}">${text}</button>`;
		}
	);
}

function getLabelText(name: string, type: string): string {
	const labelMap: { [key: string]: string } = {
		"name": "Ad Soyad",
		"email": "E-posta",
		"password": "Şifre",
		"phone": "Telefon",
		"address": "Adres",
		"city": "Şehir",
		"country": "Ülke",
		"zip": "Posta Kodu",
		"username": "Kullanıcı Adı",
		"search": "Arama"
	};

	return labelMap[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

function addWcagEnhancements(code: string, analysis: any): string {
	let enhancedCode = code;

	// Klavye navigasyonu için
	if (analysis.needsKeyboard) {
		enhancedCode = addKeyboardNavigation(enhancedCode);
	}

	// Renk kontrastı için
	if (analysis.needsContrast) {
		enhancedCode = addContrastStyles(enhancedCode);
	}

	// ARIA etiketleri için
	if (analysis.needsAria) {
		enhancedCode = addAriaAttributes(enhancedCode);
	}

	return enhancedCode;
}

function addKeyboardNavigation(code: string): string {
	// Tabindex ve keyboard event'leri ekle
	return code.replace(
		/<button([^>]*?)>/g,
		"<button$1 tabindex=\"0\" onkeydown=\"handleKeyDown(event)\">"
	);
}

function addContrastStyles(code: string): string {
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
	}
	
	button, input, select, textarea {
		border: 2px solid var(--secondary-color);
		color: var(--secondary-text);
		background-color: var(--secondary-color);
	}
	
	button:hover, input:focus, select:focus, textarea:focus {
		border-color: var(--primary-color);
		outline: 2px solid var(--primary-color);
		outline-offset: 2px;
	}
	
	.error-message {
		color: var(--error-color);
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

	return contrastStyles + "\n" + code;
}

function addAriaAttributes(code: string): string {
	// Form elementleri için aria-required ekle
	code = code.replace(
		/<input([^>]*?)>/g,
		(match, attributes) => {
			if (attributes.includes("required") && !attributes.includes("aria-required")) {
				return `<input${attributes} aria-required="true">`;
			}
			return match;
		}
	);

	// Error mesajları için aria-describedby ekle
	code = code.replace(
		/<input([^>]*?)>/g,
		(match, attributes) => {
			const idMatch = attributes.match(/id="([^"]*)"/);
			if (idMatch && !attributes.includes("aria-describedby")) {
				const id = idMatch[1];
				return `<input${attributes} aria-describedby="${id}-error">`;
			}
			return match;
		}
	);

	return code;
} 