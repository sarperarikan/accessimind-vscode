import { GeminiAPI } from "../utils/geminiApi";
import { logger } from "../utils/logger";

export interface WcagImprovementOptions {
	includeComments?: boolean;
	wcagLevel?: "A" | "AA" | "AAA";
	autoSave?: boolean;
	isSelection?: boolean;
	language?: "en" | "tr";
}

export interface WcagImprovementResult {
	success: boolean;
	improvedCode?: string;
	error?: string;
	wcagCriteria?: string[];
	tokensUsed?: number;
	improvementsSummary?: string[];
	summary?: string;
}

export class WcagImprover {
	private geminiApi: GeminiAPI;

	constructor() {
		this.geminiApi = GeminiAPI.getInstance();
	}

	async improveCode(
		code: string, 
		language: string, 
		fileName: string, 
		options: WcagImprovementOptions = {}
	): Promise<WcagImprovementResult> {
		try {
			logger.info(`WCAG iyileştirme başlıyor: ${fileName} (${language})`);

			const {
				includeComments = true,
				wcagLevel = "AA",
				isSelection = false,
				language: userLanguage = "en"
			} = options;

			// Build comprehensive prompt for AI
			const prompt = this.buildImprovementPrompt(code, language, fileName, wcagLevel, includeComments, isSelection, userLanguage);

			// Get AI improvement
			const response = await this.geminiApi.improveCode({
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

				logger.info(`WCAG iyileştirme tamamlandı: ${wcagCriteria.length} kriter uygulandı`);

				const summary = improvementsSummary.length > 0 
					? `Applied ${wcagCriteria.length} WCAG criteria: ${improvementsSummary.slice(0, 3).join(", ")}${improvementsSummary.length > 3 ? "..." : ""}`
					: `Applied ${wcagCriteria.length} WCAG improvements`;

				return {
					success: true,
					improvedCode: response.content,
					wcagCriteria,
					tokensUsed: response.tokensUsed,
					improvementsSummary,
					summary
				};
			} else {
				throw new Error(response.error || "AI iyileştirme başarısız");
			}

		} catch (error) {
			logger.error("WCAG iyileştirme hatası:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Bilinmeyen hata"
			};
		}
	}

	async addSpecificImprovement(
		code: string,
		language: string,
		improvementType: "aria-labels" | "color-contrast" | "keyboard-navigation"
	): Promise<WcagImprovementResult> {
		try {
			logger.info(`Spesifik WCAG iyileştirmesi: ${improvementType} (${language})`);

			let prompt = "";
			let wcagCriteria: string[] = [];

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

			const response = await this.geminiApi.improveCode({
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
			} else {
				throw new Error(response.error || `${improvementType} iyileştirme başarısız`);
			}

		} catch (error) {
			logger.error(`${improvementType} iyileştirme hatası:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Bilinmeyen hata"
			};
		}
	}

	private buildImprovementPrompt(
		code: string,
		language: string,
		fileName: string,
		wcagLevel: string,
		includeComments: boolean,
		isSelection: boolean,
		userLanguage: "en" | "tr" = "en"
	): string {
		if (userLanguage === "tr") {
			return this.buildTurkishPrompt(code, language, fileName, wcagLevel, includeComments, isSelection);
		}
		
		const contextType = isSelection ? "selected code snippet" : "file";
		
		return `You are a WCAG 2.2 accessibility expert. Improve the following ${contextType} to WCAG ${wcagLevel} level compliance.

File: ${fileName}
Language: ${language}
WCAG Level: ${wcagLevel}
Include Comments: ${includeComments ? "Yes" : "No"}

IMPORTANT RULES:
- ONLY improve the existing code structure - DO NOT add new HTML elements
- ONLY enhance what is already present with WCAG/ARIA attributes
- PRESERVE the original structure and styling completely
- Focus on semantic improvements, ARIA labels, and accessibility attributes
- Do not change the visual layout or add new content

Current Code:
\`\`\`${language}
${code}
\`\`\`

Focus on these WCAG criteria for EXISTING elements:

**1. Perceivable**
- 1.1.1: Non-text Content (alt attributes, ARIA labels)
- 1.3.1: Info and Relationships (semantic markup, proper headings)
- 1.3.2: Meaningful Sequence (logical tab order)
- 1.4.3: Contrast (Minimum) - 4.5:1 ratio for AA level
- 1.4.4: Resize Text (scalable units)
- 1.4.10: Reflow (responsive design)

**2. Operable**
- 2.1.1: Keyboard accessible (tabindex, focus management)
- 2.1.2: No Keyboard Trap (proper focus flow)
- 2.1.4: Character Key Shortcuts (avoid conflicts)
- 2.4.1: Bypass Blocks (skip links)
- 2.4.3: Focus Order (logical navigation)
- 2.4.4: Link Purpose (descriptive link text)
- 2.4.6: Headings and Labels (descriptive)
- 2.4.7: Focus Visible (clear focus indicators)

**3. Understandable**
- 3.1.1: Language of Page (lang attribute)
- 3.2.1: On Focus (no unexpected context changes)
- 3.2.2: On Input (no unexpected form changes)
- 3.3.1: Error Identification (clear error messages)
- 3.3.2: Labels or Instructions (form labels)

**4. Robust**
- 4.1.1: Parsing (valid HTML)
- 4.1.2: Name, Role, Value (proper ARIA implementation)
- 4.1.3: Status Messages (ARIA live regions)

${includeComments ? `
CRITICAL: Add explanatory comments WITHIN the code for each improvement:
- For HTML: Use <!-- WCAG X.X.X: Explanation --> comments
- For CSS: Use /* WCAG X.X.X: Explanation */ comments
- For JavaScript/TypeScript: Use // WCAG X.X.X: Explanation comments
- Place comments directly above or next to the improved elements
- Examples:
  <!-- WCAG 1.1.1: Added alt text for screen readers -->
  <img src="logo.png" alt="Company logo" />
  
  /* WCAG 1.4.3: Improved color contrast for accessibility */
  .button { color: #000; background: #fff; }
  
  // WCAG 2.1.1: Added keyboard navigation support
  element.addEventListener('keydown', handleKeyPress);

NEVER provide explanations outside the code block - ALL explanations must be inline comments.
` : ""}

Return ONLY the improved code. No additional explanations.

${isSelection ? "This is a code selection, so only improve the selected part." : "Improve the entire file."}

Requirements:
- Use semantic HTML elements where appropriate
- Add proper ARIA attributes
- Ensure keyboard navigation works
- Maintain color contrast ratios
- Use descriptive text for links and buttons
- Provide alternative text for images
- Use proper form labels and validation
- Implement proper heading hierarchy
- Add skip links for navigation
- Ensure responsive design principles`;
	}

	private buildTurkishPrompt(
		code: string,
		language: string,
		fileName: string,
		wcagLevel: string,
		includeComments: boolean,
		isSelection: boolean
	): string {
		const contextType = isSelection ? "seçili kod parçası" : "dosya";
		
		return `Sen bir WCAG 2.2 erişilebilirlik uzmanısın. Aşağıdaki ${contextType}yı WCAG ${wcagLevel} seviyesinde iyileştir.

Dosya: ${fileName}
Dil: ${language}
WCAG Seviyesi: ${wcagLevel}
${includeComments ? "Yorumlar dahil edilsin: Evet" : "Yorumlar dahil edilsin: Hayır"}

ÖNEMLİ KURALLAR:
- SADECE mevcut kod yapısını iyileştir - YENİ HTML elementleri EKLEME
- SADECE var olanları WCAG/ARIA özellikleriyle geliştir
- Orijinal yapıyı ve stil düzenini tamamen KORU
- Semantik iyileştirmeler, ARIA etiketleri ve erişilebilirlik özelliklerine odaklan
- Görsel düzeni değiştirme veya yeni içerik ekleme

Mevcut Kod:
\`\`\`${language}
${code}
\`\`\`

MEVCUT elementler için şu WCAG kriterlerine odaklan:

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
ÖNEMLİ: Yapılan her iyileştirme için kodun İÇİNDE açıklayıcı yorumlar ekle:
- HTML için: <!-- WCAG X.X.X: Açıklama --> yorumlarını kullan
- CSS için: /* WCAG X.X.X: Açıklama */ yorumlarını kullan
- JavaScript/TypeScript için: // WCAG X.X.X: Açıklama yorumlarını kullan
- Yorumları iyileştirilen elementlerin hemen üstüne veya yanına yerleştir
- Örnekler:
  <!-- WCAG 1.1.1: Ekran okuyucular için alt metin eklendi -->
  <img src="logo.png" alt="Şirket logosu" />
  
  /* WCAG 1.4.3: Erişilebilirlik için renk kontrastı iyileştirildi */
  .button { color: #000; background: #fff; }
  
  // WCAG 2.1.1: Klavye navigasyon desteği eklendi
  element.addEventListener('keydown', handleKeyPress);

ASLÁ kod bloğunun dışında açıklama yapma - TÜM açıklamalar satır içi yorumlar olmalı.
` : ""}

Sadece iyileştirilmiş kodu döndür. Ek açıklama yapma.

${isSelection ? "Bu bir kod seçimi olduğu için sadece seçili kısmı iyileştir." : "Tüm dosyayı iyileştir."}`;
	}

	private buildAriaLabelsPrompt(code: string, language: string): string {
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

	private buildColorContrastPrompt(code: string, language: string): string {
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

	private buildKeyboardNavigationPrompt(code: string, language: string): string {
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

	private extractWcagCriteriaFromCode(code: string): string[] {
		const criteria = new Set<string>();
		
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

	private generateImprovementsSummary(originalCode: string, improvedCode: string, language: string): string[] {
		const summary: string[] = [];

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

	private extractCodeFromResponse(response: string, language: string): string | null {
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