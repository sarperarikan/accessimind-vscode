import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import * as zlib from "zlib";
import { RequestCache, CacheEntry } from "./requestCache";
import { logger } from "./logger";
import { SettingsManager } from "./settingsManager";
import {
	OptimizedHttpAgent,
	createOptimizedRequestOptions,
	PromptOptimizer,
	ApiMetricsCollector
} from "./apiOptimizer";

export interface AIResponse {
	success: boolean
	content?: string
	improvedCode?: string
	summary?: string
	wcagCriteria?: string[]
	error?: string
	tokensUsed?: number
	inputTokens?: number
	outputTokens?: number
	responseTime?: number
	model?: string
	provider: "gemini" | "vscode-copilot" | "ollama"
	usageMetadata?: any
	cached?: boolean
}

export interface WCAGRequest {
	code: string
	fileType: string
	language: string
	selectedText?: string
	wcagLevel?: "A" | "AA" | "AAA"
	includeComments?: boolean
	responseLanguage?: "en" | "tr"
	forceRefresh?: boolean
	mode?: "ask" | "agent" | "edit"
}

export abstract class AIProvider {
	abstract improveCode(request: WCAGRequest): Promise<AIResponse>
	abstract analyzeCode(request: WCAGRequest): Promise<AIResponse>
	abstract isAvailable(): Promise<boolean>
	abstract getDisplayName(): string

	async chat(message: string): Promise<AIResponse> {
		throw new Error("Chat not implemented for this provider.");
	}

	protected buildWCAGPrompt(request: WCAGRequest): string {
		const { code, fileType, language, selectedText, wcagLevel = "AA", includeComments = true, responseLanguage = "en" } = request;
		const perf = vscode.workspace.getConfiguration("wcagEnhancer").get("performance") as any || {};
		const fastMode = perf?.fastMode !== false;
		const maxChars = typeof perf?.promptMaxChars === "number" ? perf.promptMaxChars : 8000;
		const codeForPrompt = fastMode ? PromptOptimizer.truncateCode(PromptOptimizer.compressCode(code), maxChars) : code;
		const selectedForPrompt = selectedText ? (fastMode ? PromptOptimizer.truncateCode(PromptOptimizer.compressCode(selectedText), Math.min(maxChars, 4000)) : selectedText) : undefined;

		const langMap = {
			en: {
				title: "You are a WCAG 2.2 accessibility expert.",
				primaryDirective: "YOUR PRIMARY DIRECTIVE: PRESERVE the existing code structure COMPLETELY. You must ONLY add accessibility improvements to the EXISTING elements. DO NOT rewrite, restructure, or recreate the code.",
				fileType: "File Type",
				language: "Language",
				wcagLevel: "WCAG Level",
				selectedCode: "Selected Code",
				currentCode: "Current Code",
				forbidden: `FORBIDDEN ACTIONS (violations will be rejected):
- DO NOT delete, rearrange, or replace existing elements
- DO NOT add new HTML sections, components, or visual elements
- DO NOT change class names, IDs, or existing attributes (unless fixing accessibility)
- DO NOT change the visual layout, styling, or design
- DO NOT remove or replace existing code logic
- DO NOT add new CSS styling beyond accessibility fixes (e.g. focus styles, contrast)
- DO NOT restructure the DOM hierarchy or code organization`,
				allowed: `ALLOWED ACTIONS (apply ONLY these):
- Add ARIA attributes (aria-label, aria-describedby, aria-live, etc.) to existing elements
- Add alt text to images that lack it
- Add lang attributes where missing
- Fix heading hierarchy (h1→h6) without changing content
- Add tabindex for keyboard navigation to interactive elements
- Add role attributes to existing elements
- Add form labels (associate existing labels or add aria-label)
- Add skip navigation links (minimal DOM addition)
- Add CSS :focus styles for keyboard visibility
- Fix color contrast values in existing CSS properties
- Add screen reader only text (.sr-only) where needed`,
				fullStack: `FULL-STACK WCAG IMPLEMENTATION (Based on selected WCAG %LEVEL% level):
Your improvements MUST produce a FULLY FUNCTIONAL accessibility implementation across ALL layers:

**HTML Layer:**
- Add semantic elements, ARIA attributes, roles, labels, and landmarks
- Ensure proper form associations (label[for], fieldset/legend)
- Add skip navigation links with matching anchor targets
- Ensure all interactive elements have accessible names

**CSS Layer:**
- Add :focus and :focus-visible styles with visible outlines for ALL interactive elements
- Add .sr-only utility class if used in HTML (position:absolute; clip; etc.)
- Fix color contrast ratios to meet WCAG %LEVEL% minimums (AA: 4.5:1 text, 3:1 large text; AAA: 7:1 text, 4.5:1 large text)
- Ensure text uses scalable units (rem/em instead of px)
- Add prefers-reduced-motion media query for animations
- Add prefers-contrast media query for high contrast mode support
- Ensure focus indicators are not hidden (no outline:none without replacement)

**JavaScript Layer:**
- Add keyboard event handlers (keydown/keyup) alongside click handlers
- Implement focus trapping for modals/dialogs (Tab and Shift+Tab cycling)
- Add aria-live region updates for dynamic content changes
- Implement Escape key handler to close overlays/modals
- Add proper focus management: move focus to new content, restore on close
- Ensure custom widgets follow WAI-ARIA Authoring Practices patterns

CRITICAL: Every HTML attribute you add (e.g. aria-describedby, .sr-only spans, skip links) MUST have its corresponding CSS and JS counterparts. Do NOT add attributes that reference non-existent styles or scripts.`,
				format: `Response format:
- Return ONLY the improved code, no explanations outside code
- Preserve ALL original formatting and indentation style
- Keep ALL existing class names, IDs, and attributes intact
- Specify applied WCAG criteria in inline comments`,
				criteria: `Focus on WCAG 2.2 Level %LEVEL% criteria:
- Perceivable (1.x): Text alternatives, contrast, adaptable content
- Operable (2.x): Keyboard access, focus management, navigation
- Understandable (3.x): Readability, predictability, input assistance
- Robust (4.x): ARIA compatibility, name/role/value, status messages`,
				comments: `MANDATORY DETAILED COMMENTS (in English):
For EVERY accessibility change, add a detailed inline comment that includes:
1. The exact WCAG criterion number (e.g. 1.1.1, 2.4.7, 4.1.2)
2. The criterion name (e.g. "Non-text Content", "Focus Visible", "Name, Role, Value")
3. The conformance level (A, AA, or AAA)
4. What was changed and WHY
5. The expected accessibility benefit

Comment format examples:
- HTML: <!-- WCAG 1.1.1 (Level A) Non-text Content: Added alt attribute to describe the hero image for screen readers -->
- CSS: /* WCAG 1.4.3 (Level AA) Contrast Minimum: Changed text color from #999 to #595959 to meet 4.5:1 contrast ratio against white background */
- JS: // WCAG 2.1.1 (Level A) Keyboard: Added keydown handler so Enter and Space keys activate this button, matching click behavior

Each comment MUST be inside the code. NEVER place explanations outside the code block.`,
				noComments: "Do NOT add explanatory comments. Only add the accessibility attributes silently.",
				zeroDefect: `ZERO-DEFECT MANDATE (Non-Negotiable):
- Output MUST render/compile without ANY errors in a clean environment
- Every aria-describedby, aria-labelledby, aria-controls MUST reference an existing element ID
- Every .sr-only class usage MUST have a corresponding CSS definition in the output
- Every skip-link href MUST have a matching anchor target in the document
- Every id attribute MUST be unique within the document
- No orphaned CSS selectors referencing non-existent classes or IDs
- No undefined JS variables, functions, or DOM references
- No broken event listeners referencing elements that do not exist
- If you add an aria-live region in HTML, you MUST add the JS code that updates it
- Self-validate: before returning, mentally verify every cross-reference is intact`,
				cleanCode: `CLEAN CODE PRINCIPLES (Mandatory):
- Match the original code's indentation style exactly (tabs vs spaces, indent width)
- No duplicate event handlers or redundant ARIA attributes
- DRY: if a pattern repeats 3+ times, extract into a reusable function
- Use descriptive, self-documenting variable and function names
- No dead code, no unused variables, no empty blocks
- Group related accessibility additions together (e.g., all ARIA attrs on one element adjacent)
- Keep function bodies focused and short — one responsibility per function`,
				completeness: `COMPLETENESS GUARANTEE (Critical):
- Return the COMPLETE file content from first line to last line
- Include ALL original code PLUS all accessibility improvements
- NEVER truncate, abbreviate, or omit any part of the code
- NEVER use placeholders like "...", "// rest of code", "/* remaining code */", or "// (same as before)"
- NEVER say "continue from here" or "no changes needed for this section"
- Even if code is long, return EVERY SINGLE LINE
- The output must be a drop-in replacement for the original file`
			},
			tr: {
				title: "Sen bir WCAG 2.2 erişilebilirlik uzmanısın.",
				primaryDirective: "BİRİNCİL DİREKTİFİN: Mevcut kod yapısını TAMAMEN KORU. SADECE mevcut elementlere erişilebilirlik iyileştirmeleri ekle. Kodu yeniden yazma, yapılandırma veya yeniden oluşturma.",
				fileType: "Dosya Türü",
				language: "Dil",
				wcagLevel: "WCAG Seviyesi",
				selectedCode: "Seçili Kod",
				currentCode: "Mevcut Kod",
				forbidden: `YASAK İŞLEMLER (ihlaller reddedilecektir):
- Mevcut elementleri SİLME, yeniden düzenleme veya değiştirme
- Yeni HTML bölümleri, bileşenler veya görsel elemanlar EKLEME
- Sınıf adlarını, ID'leri veya mevcut nitelikleri DEĞİŞTİRME (erişilebilirlik düzeltmesi hariç)
- Görsel düzeni, stili veya tasarımı DEĞİŞTİRME
- Mevcut kod mantığını kaldırma veya değiştirme
- Erişilebilirlik düzeltmeleri dışında yeni CSS stili EKLEME
- DOM hiyerarşisini veya kod organizasyonunu yeniden yapılandırma`,
				allowed: `İZİN VERİLEN İŞLEMLER (SADECE bunları uygula):
- Mevcut elementlere ARIA nitelikleri (aria-label, aria-describedby, aria-live, vb.) ekle
- Alt metni olmayan resimlere alt text ekle
- Eksik lang niteliklerini ekle
- İçeriği değiştirmeden başlık hiyerarşisini düzelt (h1→h6)
- Etkileşimli elementlere tabindex ekle
- Mevcut elementlere role nitelikleri ekle
- Form etiketleri ekle (mevcut etiketleri ilişkilendir veya aria-label ekle)
- Atlama bağlantıları ekle (minimum DOM eklentisi)
- Klavye görünürlüğü için CSS :focus stilleri ekle
- Mevcut CSS özelliklerinde renk kontrastı değerlerini düzelt
- Gerekli yerlerde ekran okuyucu metni (.sr-only) ekle`,
				fullStack: `TAM KATMANLI WCAG UYGULAMASI (Seçilen WCAG %LEVEL% seviyesine göre):
İyileştirmeleriniz TÜM katmanlarda TAM İŞLEVSEL bir erişilebilirlik uygulaması üretmelidir:

**HTML Katmanı:**
- Semantik elementler, ARIA nitelikleri, roller, etiketler ve landmark'lar ekle
- Form ilişkilendirmelerini düzelt (label[for], fieldset/legend)
- Eşleşen hedeflerle atlama bağlantıları ekle
- Tüm etkileşimli elementlerin erişilebilir adları olsun

**CSS Katmanı:**
- TÜM etkileşimli elementlere görünür :focus ve :focus-visible stilleri ekle
- HTML'de kullanılan .sr-only sınıfı için CSS tanımı ekle (position:absolute; clip; vb.)
- Renk kontrastını WCAG %LEVEL% minimumlarına getir (AA: 4.5:1 metin, 3:1 büyük metin; AAA: 7:1 metin, 4.5:1 büyük metin)
- Metin ölçeklenebilir birimler kullansın (px yerine rem/em)
- Animasyonlar için prefers-reduced-motion media query ekle
- Yüksek kontrast modu için prefers-contrast media query ekle
- Odak göstergeleri gizlenmesin (yerine koyulmadan outline:none kullanma)

**JavaScript Katmanı:**
- Click handler'ların yanına klavye event handler'ları (keydown/keyup) ekle
- Modal/dialog'lar için focus trapping uygula (Tab ve Shift+Tab döngüsü)
- Dinamik içerik değişiklikleri için aria-live bölge güncellemeleri ekle
- Overlay/modal kapatmak için Escape tuşu handler'ı ekle
- Odak yönetimi uygula: yeni içeriğe odakla, kapanınca geri yükle
- Özel widget'lar WAI-ARIA Authoring Practices kalıplarını takip etsin

KRİTİK: Eklediğin her HTML niteliğinin (ör: aria-describedby, .sr-only span'lar, atlama bağlantıları) karşılık gelen CSS ve JS tarafı da OLMALIDIR. Var olmayan stil veya script'lere referans veren nitelikler EKLEME.`,
				format: `Yanıt formatı:
- SADECE iyileştirilmiş kodu döndür, kod dışında açıklama yapma
- TÜM orijinal biçimlendirmeyi ve girinti stilini koru
- TÜM mevcut sınıf adlarını, ID'leri ve nitelikleri olduğu gibi bırak
- Uygulanan WCAG kriterlerini satır içi yorumlarda belirt`,
				criteria: `WCAG 2.2 Seviye %LEVEL% kriterlerine odaklan:
- Algılanabilir (1.x): Metin alternatifleri, kontrast, uyarlanabilir içerik
- İşletilebilir (2.x): Klavye erişimi, odak yönetimi, navigasyon
- Anlaşılabilir (3.x): Okunabilirlik, öngörülebilirlik, girdi yardımı
- Sağlam (4.x): ARIA uyumu, ad/rol/değer, durum mesajları`,
				comments: `ZORUNLU DETAYLI YORUMLAR (Türkçe olarak):
Yaptığın HER erişilebilirlik değişikliği için aşağıdakileri içeren detaylı bir satır içi yorum ekle:
1. Tam WCAG kriter numarası (ör: 1.1.1, 2.4.7, 4.1.2)
2. Kriter adı (ör: "Metin Dışı İçerik", "Odak Görünür", "Ad, Rol, Değer")
3. Uygunluk seviyesi (A, AA veya AAA)
4. Ne değiştirildi ve NEDEN
5. Beklenen erişilebilirlik faydası

Yorum format örnekleri:
- HTML: <!-- WCAG 1.1.1 (Seviye A) Metin Dışı İçerik: Hero resmi için ekran okuyuculara açıklama sağlamak üzere alt niteliği eklendi -->
- CSS: /* WCAG 1.4.3 (Seviye AA) Minimum Kontrast: Beyaz arka plana karşı 4.5:1 kontrast oranını sağlamak için metin rengi #999'dan #595959'a değiştirildi */
- JS: // WCAG 2.1.1 (Seviye A) Klavye: Enter ve Space tuşlarının bu butonu tıklama davranışıyla aynı şekilde etkinleştirmesi için keydown handler eklendi

Her yorum kodun İÇİNDE olmalıdır. Açıklamaları ASLA kod bloğunun dışına KOYMA.`,
				noComments: "Açıklayıcı yorum EKLEME. Sadece erişilebilirlik niteliklerini sessizce ekle.",
				zeroDefect: `SIFIR HATA ZORUNLULUĞU (Pazarlık Edilemez):
- Çıktı temiz bir ortamda HİÇBİR hata olmadan render/derlenmeli
- Her aria-describedby, aria-labelledby, aria-controls mevcut bir element ID'sine referans vermeli
- Her .sr-only sınıf kullanımının çıktıda karşılık gelen CSS tanımı OLMALI
- Her skip-link href'inin dokümanda eşleşen bir hedef çapası OLMALI
- Her id niteliği dokümanda benzersiz OLMALI
- Var olmayan sınıf veya ID'lere referans veren yetim CSS seçiciler OLMAMALI
- Tanımsız JS değişkenleri, fonksiyonları veya DOM referansları OLMAMALI
- Var olmayan elementlere referans veren kırık olay dinleyicileri OLMAMALI
- HTML'de aria-live bölge eklersen, onu güncelleyen JS kodunu da EKLEMELISIN
- Öz-doğrulama: döndürmeden önce her çapraz referansın sağlam olduğunu zihinsel olarak doğrula`,
				cleanCode: `TEMİZ KOD İLKELERİ (Zorunlu):
- Orijinal kodun girinti stilini tam olarak eşle (tab vs boşluk, girinti genişliği)
- Tekrarlanan olay işleyicileri veya gereksiz ARIA nitelikleri OLMAMALI
- DRY: bir kalıp 3+ kez tekrarlanıyorsa yeniden kullanılabilir bir fonksiyona çıkar
- Açıklayıcı, kendi kendini belgeleyen değişken ve fonksiyon adları kullan
- Ölü kod, kullanılmayan değişkenler, boş bloklar OLMAMALI
- İlişkili erişilebilirlik eklemelerini bir arada grupla
- Fonksiyon gövdelerini odaklı ve kısa tut — fonksiyon başına tek sorumluluk`,
				completeness: `BÜTÜNLÜK GARANTİSİ (Kritik):
- Dosya içeriğini ilk satırdan son satıra kadar TAMAMEN döndür
- TÜM orijinal kodu ARTI tüm erişilebilirlik iyileştirmelerini dahil et
- Kodun hiçbir bölümünü ASLA kısaltma, özetleme veya çıkarma
- ASLA "...", "// kodun geri kalanı", "/* kalan kod */" veya "// (öncekiyle aynı)" gibi yer tutucular KULLANMA
- ASLA "buradan devam et" veya "bu bölüm için değişiklik gerekmiyor" DEME
- Kod uzun olsa bile HER TEK SATIRI döndür
- Çıktı orijinal dosyanın birebir yerine geçebilecek olmalı`
			}
		};

		const strings = langMap[responseLanguage || "en"];
		const criteriaWithLevel = strings.criteria.replace(/%LEVEL%/g, wcagLevel);

		let prompt = `${strings.title}

${strings.primaryDirective}

${strings.fileType}: ${fileType}
${strings.language}: ${language}
${strings.wcagLevel}: ${wcagLevel}

${strings.forbidden}

${strings.allowed}

${selectedForPrompt ? `${strings.selectedCode}:\n\`\`\`${language}\n${selectedForPrompt}\n\`\`\`\n\n` : ""}${strings.currentCode}:
\`\`\`${language}
${codeForPrompt}
\`\`\`

${includeComments ? strings.comments : strings.noComments}

${strings.format}

${strings.fullStack.replace(/%LEVEL%/g, wcagLevel)}

${strings.zeroDefect}

${strings.cleanCode}

${strings.completeness}

${criteriaWithLevel}`;

		return prompt;
	}

	protected buildWCAGAnalysisPrompt(request: WCAGRequest): string {
		const { code, fileType, language, wcagLevel = "AA", responseLanguage = "en" } = request;

		const basePrompt = responseLanguage === "tr" ?
			`Lütfen aşağıdaki ${language} kodunu WCAG ${wcagLevel} standartlarına göre analiz edin:` :
			`Please analyze the following ${language} code according to WCAG ${wcagLevel} standards:`;

		const analysisInstructions = responseLanguage === "tr" ? `
Analiz sonucunda şunları sağlayın:
1. Genel erişilebilirlik skoru (0-100)
2. Tespit edilen erişilebilirlik sorunları
3. Her sorun için öneriler
4. WCAG uyum seviyesi (A, AA, AAA)
5. Kod kalitesi değerlendirmesi

Format: JSON formatında yanıt verin:
{
  "score": sayısal_skor,
  "level": "A|AA|AAA|Non-compliant",
  "issues": ["sorun1", "sorun2"],
  "suggestions": ["öneri1", "öneri2"],
  "summary": "kısa_özet"
}
` : `
Please provide:
1. Overall accessibility score (0-100)
2. Identified accessibility issues
3. Recommendations for each issue
4. WCAG conformance level (A, AA, AAA)
5. Code quality assessment

Format: Respond in JSON format:
{
  "score": numeric_score,
  "level": "A|AA|AAA|Non-compliant", 
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "summary": "brief_summary"
}
`;

		return `${basePrompt}

${analysisInstructions}

\`\`\`${language}
${code}
\`\`\``;
	}

	protected extractWCAGCriteria(content: string): string[] {
		const criteria: string[] = [];

		// WCAG kriterlerini regex ile tespit et
		const wcagPattern = /(?:WCAG|1\.\d+\.\d+|2\.\d+\.\d+|3\.\d+\.\d+|4\.\d+\.\d+)/gi;
		const matches = content.match(wcagPattern);

		if (matches) {
			criteria.push(...matches.map(match => match.toUpperCase()));
		}

		// Erişilebilirlik özelliklerini tespit et
		const accessibilityFeatures = [
			"aria-label", "aria-describedby", "aria-labelledby", "aria-hidden",
			"alt", "title", "role", "tabindex", "focus", "keyboard",
			"contrast", "color", "semantic", "heading", "landmark"
		];

		accessibilityFeatures.forEach(feature => {
			if (content.toLowerCase().includes(feature)) {
				criteria.push(feature.toUpperCase());
			}
		});

		return [...new Set(criteria)]; // Remove duplicates
	}
}

export class GeminiProvider extends AIProvider {
	private apiKey: string = "";
	private baseUrl: string = "https://generativelanguage.googleapis.com/v1beta/models";
	private cache: RequestCache<AIResponse>;

	constructor() {
		super();
		this.cache = RequestCache.getInstance<AIResponse>("gemini");
		this.loadApiKey();
	}

	private async loadApiKey(): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = config.get("ai") as any;
			this.apiKey = aiConfig?.apiKey || "";
		} catch (error) {
			logger.error("Error loading API key:", error);
		}
	}

	async isApiKeyConfigured(): Promise<boolean> {
		await this.loadApiKey();
		return this.apiKey.length > 0;
	}

	async testConnection(): Promise<{ success: boolean; message?: string; model?: string }> {
		await this.loadApiKey();
		if (!this.apiKey) {
			return { success: false, message: "API key not configured" };
		}

		try {
			const model = await this.getDefaultModel();
			await this.makeApiCall(model, "Test connection", "test");
			return { success: true, message: "Connection successful", model };
		} catch (error) {
			return { success: false, message: (error as Error).message };
		}
	}

	async getAvailableModels(): Promise<any[]> {
		await this.loadApiKey();

		if (!this.apiKey) {
			logger.warn("No API key configured, returning default models");
			return this.getDefaultModels();
		}

		try {
			// Fetch models from Gemini API
			const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);

			const response = await new Promise<any>((resolve, reject) => {
				const req = https.request({
					hostname: url.hostname,
					port: 443,
					path: url.pathname + url.search,
					method: "GET",
					headers: {
						"Content-Type": "application/json"
					}
				}, (res) => {
					let data = "";
					res.on("data", (chunk) => data += chunk);
					res.on("end", () => {
						try {
							if (res.statusCode && res.statusCode >= 400) {
								reject(new Error(`API Error ${res.statusCode}`));
								return;
							}
							resolve(JSON.parse(data));
						} catch (error) {
							reject(error);
						}
					});
				});
				req.on("error", reject);
				req.end();
			});

			if (response.models && Array.isArray(response.models)) {
				// Filter to only generative models that support generateContent
				const generativeModels = response.models.filter((model: any) =>
					model.supportedGenerationMethods?.includes("generateContent") &&
					model.name?.includes("gemini")
				);

				// Sort by preference (newer/faster models first)
				const sortedModels = generativeModels.sort((a: any, b: any) => {
					const aName = a.name?.toLowerCase() || "";
					const bName = b.name?.toLowerCase() || "";

					// Prioritize 3 > 2.5 > 2.0 > 1.5
					if (aName.includes("3") && !bName.includes("3")) return -1;
					if (!aName.includes("3") && bName.includes("3")) return 1;
					if (aName.includes("2.5") && !bName.includes("2.5")) return -1;
					if (!aName.includes("2.5") && bName.includes("2.5")) return 1;
					if (aName.includes("2.0") && !bName.includes("2.0")) return -1;
					if (!aName.includes("2.0") && bName.includes("2.0")) return 1;

					// Prioritize flash over pro for speed
					if (aName.includes("flash") && !bName.includes("flash")) return -1;
					if (!aName.includes("flash") && bName.includes("flash")) return 1;

					return 0;
				});

				logger.info(`Fetched ${sortedModels.length} Gemini models from API`);

				return sortedModels.map((model: any, index: number) => {
					const modelId = model.name?.replace("models/", "") || model.name;
					const displayName = model.displayName || this.formatModelName(modelId);

					return {
						id: modelId,
						name: displayName,
						description: model.description || `${displayName} - ${model.inputTokenLimit || "Unknown"} input tokens`,
						speed: modelId.includes("flash") ? "fast" : "medium",
						quality: modelId.includes("pro") || modelId.includes("2.5") ? "very-high" : "high",
						recommended: index === 0, // First model is recommended
						inputTokenLimit: model.inputTokenLimit,
						outputTokenLimit: model.outputTokenLimit
					};
				});
			}

			return this.getDefaultModels();
		} catch (error) {
			logger.error("Failed to fetch Gemini models from API:", error);
			return this.getDefaultModels();
		}
	}

	private getDefaultModels(): any[] {
		return [
			// Gemini 3 Series (Latest)
			{
				id: "gemini-3-flash",
				name: "Gemini 3 Flash",
				description: "Next-gen speed - Ultra fast responses",
				speed: "fast",
				quality: "very-high",
				recommended: true
			},
			{
				id: "gemini-3-pro",
				name: "Gemini 3 Pro",
				description: "Next-gen intelligence - Breakthrough capabilities",
				speed: "medium",
				quality: "very-high"
			},
			// Gemini 2.5 Series
			{
				id: "gemini-2.5-flash",
				name: "Gemini 2.5 Flash",
				description: "Latest & fastest - Best for quick improvements",
				speed: "fast",
				quality: "very-high"
			},
			{
				id: "gemini-2.5-pro",
				name: "Gemini 2.5 Pro",
				description: "Most capable - Best for complex analysis",
				speed: "medium",
				quality: "very-high"
			},
			// Gemini 2.0 Series
			{
				id: "gemini-2.0-flash",
				name: "Gemini 2.0 Flash",
				description: "Fast and reliable - Good balance",
				speed: "fast",
				quality: "high"
			},
			// Gemini 1.5 Series
			{
				id: "gemini-1.5-flash",
				name: "Gemini 1.5 Flash",
				description: "Stable performance",
				speed: "fast",
				quality: "high"
			},
			{
				id: "gemini-1.5-pro",
				name: "Gemini 1.5 Pro",
				description: "High quality for complex tasks",
				speed: "medium",
				quality: "very-high"
			}
		];
	}

	private formatModelName(modelId: string): string {
		return modelId
			.replace("gemini-", "Gemini ")
			.replace(/-/g, " ")
			.replace(/\b\w/g, l => l.toUpperCase());
	}

	async chat(message: string): Promise<AIResponse> {
		await this.loadApiKey();
		const model = await this.getDefaultModel();

		try {
			const response = await this.makeApiCall(model, message, "chat");
			return {
				success: true,
				content: response.content,
				provider: "gemini",
				model: model
			};
		} catch (error) {
			return {
				success: false,
				error: (error as Error).message,
				provider: "gemini"
			};
		}

	}

	async improveCode(request: WCAGRequest): Promise<AIResponse> {
		await this.loadApiKey();
		const startTime = Date.now();

		try {
			if (!this.apiKey) {
				return {
					success: false,
					error: "Gemini API key not found. Please configure it in settings.",
					provider: "gemini"
				};
			}

			const model = await this.getDefaultModel();
			const prompt = this.buildWCAGPrompt(request);

			// Cache Check
			const cacheKey = this.cache.generateKey(model, prompt);
			if (!request.forceRefresh) {
				const cachedResponse = this.cache.get(cacheKey);
				if (cachedResponse) {
					logger.info(`Cache Hit: ${model}`);
					return cachedResponse;
				}
			}

			const response = await this.makeApiCall(model, prompt, "improve");

			const responseTime = Date.now() - startTime;

			// Extract WCAG criteria
			const wcagCriteria = this.extractWCAGCriteria(response.content || "");

			const aiResponse: AIResponse = {
				success: true,
				content: response.content,
				improvedCode: response.content,
				summary: "WCAG improvements applied",
				wcagCriteria: wcagCriteria,
				tokensUsed: response.tokensUsed,
				inputTokens: response.inputTokens,
				outputTokens: response.outputTokens,
				responseTime: responseTime,
				model: model,
				provider: "gemini",
				usageMetadata: response.usageMetadata
			};

			// Cache Store
			this.cache.set(cacheKey, aiResponse);

			return aiResponse;

		} catch (error) {
			logger.error("Gemini improveCode error:", error);
			return {
				success: false,
				error: `Gemini error: ${(error as Error).message}`,
				provider: "gemini"
			};
		}
	}

	async analyzeCode(request: WCAGRequest): Promise<AIResponse> {
		await this.loadApiKey();
		const startTime = Date.now();

		try {
			const model = await this.getDefaultModel();
			const prompt = this.buildWCAGAnalysisPrompt(request);

			// Cache Check
			const cacheKey = this.cache.generateKey(model, prompt);
			if (!request.forceRefresh) {
				const cachedResponse = this.cache.get(cacheKey);
				if (cachedResponse) {
					logger.info(`Cache Hit: ${model}`);
					return cachedResponse;
				}
			}

			const response = await this.makeApiCall(model, prompt, "analyze");
			const responseTime = Date.now() - startTime;

			const wcagCriteria = this.extractWCAGCriteria(response.content || "");
			const analysisData = this.parseAnalysisResult(response.content || "");

			const aiResponse: AIResponse = {
				success: true,
				content: response.content,
				summary: analysisData.summary,
				wcagCriteria: wcagCriteria.length > 0 ? wcagCriteria : analysisData.issues,
				tokensUsed: response.tokensUsed,
				inputTokens: response.inputTokens,
				outputTokens: response.outputTokens,
				responseTime: responseTime,
				model: model,
				provider: "gemini",
				usageMetadata: response.usageMetadata
			};

			// Cache Store
			this.cache.set(cacheKey, aiResponse);

			return aiResponse;

		} catch (error) {
			return {
				success: false,
				error: `Gemini analysis error: ${(error as Error).message}`,
				provider: "gemini"
			};
		}
	}

	async isAvailable(): Promise<boolean> {
		await this.loadApiKey();
		return this.apiKey.length > 0;
	}

	getDisplayName(): string {
		return "Google Gemini";
	}

	// --- Helper Methods ---

	private async getDefaultModel(): Promise<string> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiModelConfig = config.get("aiModels") as any;
			return aiModelConfig?.selectedModel || "gemini-2.5-flash";
		} catch {
			return "gemini-2.5-flash";
		}
	}

	private parseAnalysisResult(content: string): any {
		try {
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return JSON.parse(jsonMatch[0]);
			}
		} catch (error) { }
		return { summary: "Analysis completed", issues: [] };
	}

	private async makeApiCall(model: string, prompt: string, mode: string): Promise<any> {
		const startTime = Date.now();
		const metrics = ApiMetricsCollector.getInstance();
		const httpAgent = OptimizedHttpAgent.getInstance();

		// Get configuration
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any;
		const maxTokens = aiConfig?.maxTokens || 4096;
		const temperature = aiConfig?.temperature || 0.7;
		const timeout = aiConfig?.timeout || 60000;
		const retryCount = aiConfig?.retryCount || 2;

		// Optimize prompt if too long
		const optimizedPrompt = PromptOptimizer.truncateCode(prompt, 12000);
		const estimatedTokens = PromptOptimizer.estimateTokens(optimizedPrompt);
		logger.info(`API call - Model: ${model}, Mode: ${mode}, Est. tokens: ${estimatedTokens}`);

		const requestBody = {
			contents: [{ parts: [{ text: optimizedPrompt }] }],
			generationConfig: {
				maxOutputTokens: maxTokens,
				temperature: temperature,
				topP: 0.8,
				topK: 40
			}
		};

		const postData = JSON.stringify(requestBody);
		const url = new URL(`${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`);

		// Create optimized request options with connection pooling
		const baseOptions: https.RequestOptions = {
			hostname: url.hostname,
			port: 443,
			path: url.pathname + url.search,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(postData)
			}
		};

		const options = createOptimizedRequestOptions(baseOptions, {
			timeout: timeout,
			enableCompression: true
		});

		// Use retry with backoff for reliability
		const executeRequest = async (): Promise<any> => {
			return new Promise((resolve, reject) => {
				const req = https.request(options, (res) => {
					const chunks: Buffer[] = [];

					res.on("data", (chunk: Buffer) => chunks.push(chunk));
					res.on("end", () => {
						try {
							let data: string;
							const buffer = Buffer.concat(chunks);

							// Handle gzip compression
							const encoding = res.headers['content-encoding'];
							if (encoding === 'gzip') {
								data = zlib.gunzipSync(buffer).toString('utf-8');
							} else if (encoding === 'deflate') {
								data = zlib.inflateSync(buffer).toString('utf-8');
							} else {
								data = buffer.toString('utf-8');
							}

							// Check for HTTP errors
							if (res.statusCode && res.statusCode >= 400) {
								const errorBody = JSON.parse(data);
								const errorMsg = errorBody?.error?.message || `API Error ${res.statusCode}`;

								// Rate limit handling
								if (res.statusCode === 429) {
									reject(new Error(`Rate limit exceeded. Please wait and try again.`));
									return;
								}

								reject(new Error(errorMsg));
								return;
							}

							const responseData = JSON.parse(data);

							// Check for valid response
							if (!responseData.candidates?.[0]?.content) {
								const blockReason = responseData.promptFeedback?.blockReason;
								if (blockReason) {
									reject(new Error(`Content blocked: ${blockReason}`));
									return;
								}
								reject(new Error("Invalid API response - no content returned"));
								return;
							}

							const content = responseData.candidates[0].content.parts[0].text;
							const usage = responseData.usageMetadata || {};
							const responseTime = Date.now() - startTime;

							// Record metrics
							metrics.recordRequest(responseTime, usage.totalTokenCount || 0, false);
							logger.info(`API response received in ${responseTime}ms, tokens: ${usage.totalTokenCount || 'N/A'}`);

							resolve({
								content,
								tokensUsed: usage.totalTokenCount,
								inputTokens: usage.promptTokenCount,
								outputTokens: usage.candidatesTokenCount,
								usageMetadata: usage,
								responseTime
							});
						} catch (error) {
							metrics.recordError();
							reject(error);
						}
					});
				});

				// Set timeout
				req.setTimeout(timeout, () => {
					req.destroy();
					reject(new Error(`Request timeout after ${timeout}ms`));
				});

				req.on("error", (error) => {
					metrics.recordError();
					reject(error);
				});

				req.write(postData);
				req.end();
			});
		};

		// Execute with retry logic
		return httpAgent.retryWithBackoff(executeRequest, retryCount, 1000);
	}
}



// ... existing imports ...

export class VSCodeCopilotProvider extends AIProvider {
	private availableModels: vscode.LanguageModelChat[] = [];
	private initialized: boolean = false;
	private cache: RequestCache<AIResponse>;
	private modelChangeDisposable: vscode.Disposable | null = null;

	constructor() {
		super();
		this.cache = RequestCache.getInstance<AIResponse>("vscode-copilot");

		// Model değişikliklerini dinle - yeni modeller eklendiğinde veya kaldırıldığında
		this.modelChangeDisposable = vscode.lm.onDidChangeChatModels(() => {
			logger.info("📢 VS Code Language Models değişti, cache sıfırlanıyor...");
			this.initialized = false;
			this.availableModels = [];
			// Lazy loading ile sonraki kullanımda yeniden yüklenecek
		});
	}

	// ... existing methodology ...

	public async initializeModels() {
		try {
			logger.info("🔄 Copilot modelleri başlatılıyor...");

			// GitHub Copilot durumunu kontrol et
			const copilotStatus = await this.checkCopilotStatus();

			if (copilotStatus.available) {
				// Dinamik olarak mevcut modelleri çek
				await this.fetchAvailableModels();
			} else {
				logger.warn("⚠️ GitHub Copilot kullanılamıyor:", copilotStatus.reason);
				this.availableModels = [];
			}

			// Seçilen modeli al ve eşleştir
			await this.selectCurrentModel();
			this.initialized = true;

			if (this.availableModels.length > 0) {
				logger.info(`✅ Copilot başlatıldı: ${this.availableModels.length} model mevcut`);
			} else {
				logger.warn("⚠️ Copilot başlatıldı ancak model bulunamadı");
			}
		} catch (error) {
			logger.error("❌ VS Code Language Models başlatma hatası:", error);
			this.availableModels = [];
			this.initialized = true; // Hata olsa bile başlatıldı olarak işaretle
		}
	}

	private async fetchAvailableModels(): Promise<void> {
		try {
			logger.info("🔍 Copilot modelleri keşfediliyor...");

			// Strateji 1: Sadece Copilot vendor'u olanları al
			let allModels = await vscode.lm.selectChatModels({ vendor: "copilot" });

			// Strateji 2: Eğer hiç bulunamadıysa, tüm modelleri al ve filtrele
			if (allModels.length === 0) {
				logger.info("⚠️ Vendor:copilot ile model bulunamadı, tüm modeller taranıyor...");
				const generalModels = await vscode.lm.selectChatModels();
				allModels = generalModels.filter(model =>
					(model.vendor && model.vendor.toLowerCase().includes("copilot")) ||
					(model.id && model.id.toLowerCase().includes("copilot")) ||
					(model.family && (model.family.toLowerCase().includes("gpt") || model.family.toLowerCase().includes("claude")))
				);
			}

			if (allModels.length === 0) {
				logger.warn("⚠️ VS Code Language Model API: Hiç uygun model bulunamadı");
				logger.info("💡 İpucu: GitHub Copilot aboneliğinizin aktif olduğundan ve giriş yaptığınızdan emin olun");
				this.availableModels = [];
				return;
			}

			logger.info(`✅ Toplam ${allModels.length} language model bulundu`);

			// Her modelin detaylarını logla (debug için önemli)
			allModels.forEach((model, index) => {
				logger.info(`  [${index + 1}] Model: ${model.name}`);
				logger.info(`      Family: ${model.family}`);
				logger.info(`      Vendor: ${model.vendor}`);
				logger.info(`      ID: ${model.id}`);
				logger.info(`      MaxInputTokens: ${model.maxInputTokens || 'unknown'}`);
			});

			// Modelleri kalite/öncelik sırasına göre sırala
			this.availableModels = allModels.sort((a, b) => {
				return this.getModelPriority(a) - this.getModelPriority(b);
			});

			logger.info(`🏆 En iyi model seçildi: ${this.availableModels[0]?.name || 'N/A'}`);

		} catch (error) {
			logger.error("❌ Model keşfi hatası:", error);
			this.availableModels = [];
		}
	}

	/**
	 * Modelleri kalite sırasına göre sıralar (düşük değer = daha iyi)
	 */
	private getModelPriority(model: vscode.LanguageModelChat): number {
		try {
			const family = (model.family || "").toLowerCase();
			const name = (model.name || "").toLowerCase();

			// En yeni/iyi modeller önce (düşük değer daha yüksek öncelik)
			if (family.includes("gpt-5.2-codex") || name.includes("gpt-5.2-codex")) return 0;
			if (family.includes("gpt-5.2") || name.includes("gpt-5.2")) return 0;
			if (family.includes("gpt-5.1-codex") || name.includes("gpt-5.1-codex")) return 1;
			if (family.includes("gpt-5") || name.includes("gpt-5")) return 1;
			if (family.includes("gpt-4.1") || name.includes("gpt-4.1")) return 1;
			if (family.includes("gpt-4o") || name.includes("gpt-4o")) return 2;
			if (family.includes("claude sonnet 4.5") || name.includes("claude sonnet 4.5")) return 2;
			if (family.includes("claude sonnet 4") || name.includes("claude sonnet 4")) return 3;
			if (family.includes("claude opus 4.5") || name.includes("claude opus 4.5")) return 3;
			if (family.includes("claude opus 4") || name.includes("claude opus 4")) return 3;
			if (family.includes("gemini 3") || name.includes("gemini 3")) return 3;
			if (family.includes("o4") || name.includes("o4")) return 3;
			if (family.includes("o3") || name.includes("o3")) return 4;
			if (family.includes("claude-3.7") || name.includes("claude sonnet 3.7")) return 4;
			if (family.includes("claude-3.5") || family.includes("claude-3-5") || name.includes("claude-3.5") || name.includes("claude sonnet 3.5")) return 5;
			if (family.includes("gpt-4") || name.includes("gpt-4")) return 6;
			if (family.includes("gemini 2.5") || name.includes("gemini 2.5")) return 6;
			if (family.includes("gemini 2.0") || name.includes("gemini 2.0")) return 7;
			if (family.includes("gemini") || name.includes("gemini")) return 8;
			if (family.includes("gpt-3.5") || name.includes("gpt-3.5")) return 9;
			return 10;
		} catch (e) {
			return 20; // Hata durumunda en düşük öncelik
		}
	}

	public async refreshModels(): Promise<void> {
		// Cache'yi temizle
		this.availableModels = [];
		this.initialized = false;

		// Modelleri yeniden yükle
		await this.initializeModels();

		logger.info("✅ Copilot models refreshed successfully");
	}

	/**
	 * Test Copilot connection with a real API call
	 * Returns detailed diagnostics for troubleshooting
	 */
	public async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
		try {
			logger.info("🧪 Copilot bağlantı testi başlıyor...");

			// 1. Önce durum kontrolü
			const status = await this.checkCopilotStatus();

			if (!status.available) {
				return {
					success: false,
					message: status.reason || "Copilot bağlantısı başarısız",
					details: status.details
				};
			}

			// 2. Modelleri yükle
			if (!this.initialized || this.availableModels.length === 0) {
				await this.initializeModels();
			}

			if (this.availableModels.length === 0) {
				return {
					success: false,
					message: "Hiç model bulunamadı. GitHub Copilot aboneliğiniz aktif mi?",
					details: { initialized: this.initialized }
				};
			}

			// 3. Basit bir test isteği gönder
			const testModel = this.availableModels[0];
			logger.info(`🧪 Test modeli: ${testModel.name}`);

			const testMessage = [
				vscode.LanguageModelChatMessage.User("Respond with exactly: 'AccessiMind connection test successful'")
			];

			try {
				const response = await testModel.sendRequest(testMessage, {}, new vscode.CancellationTokenSource().token);

				let responseText = "";
				for await (const fragment of response.text) {
					responseText += fragment;
					if (responseText.length > 100) break; // Kısa test için yeterli
				}

				logger.info(`✅ Test yanıtı alındı: "${responseText.substring(0, 50)}..."`);

				return {
					success: true,
					message: `Bağlantı başarılı! Model: ${testModel.name}`,
					details: {
						model: testModel.name,
						family: testModel.family,
						vendor: testModel.vendor,
						availableModels: this.availableModels.length,
						responsePreview: responseText.substring(0, 100)
					}
				};

			} catch (requestError: any) {
				const errorMsg = requestError?.message || String(requestError);
				logger.error("❌ Test isteği başarısız:", errorMsg);

				// İzin hatası
				if (errorMsg.includes("consent") || errorMsg.includes("permission")) {
					return {
						success: false,
						message: "Copilot kullanım izni verilmedi. Lütfen VS Code'da bir Copilot Chat penceresi açın ve izin isteğini kabul edin.",
						details: { model: testModel.name, error: "consent_required", originalError: errorMsg }
					};
				}

				return {
					success: false,
					message: `Test isteği başarısız: ${errorMsg}`,
					details: { model: testModel.name, error: errorMsg }
				};
			}

		} catch (error: any) {
			logger.error("❌ Bağlantı testi hatası:", error);
			return {
				success: false,
				message: `Bağlantı testi hatası: ${error?.message || error}`,
				details: { error: error?.message || String(error) }
			};
		}
	}

	private async checkCopilotStatus(): Promise<{ available: boolean, reason?: string, details?: any }> {
		try {
			logger.info("🔍 GitHub Copilot durum kontrolü başlıyor...");

			// 1. GitHub Copilot uzantı kontrolü
			const copilotExtension = vscode.extensions.getExtension("GitHub.copilot");
			const copilotChatExtension = vscode.extensions.getExtension("GitHub.copilot-chat");

			if (!copilotExtension && !copilotChatExtension) {
				return {
					available: false,
					reason: "GitHub Copilot veya Copilot Chat uzantısı yüklü değil. VS Code Marketplace'den yükleyin.",
					details: { copilotInstalled: false, copilotChatInstalled: false }
				};
			}

			logger.info(`  📦 Copilot uzantısı: ${copilotExtension ? 'Yüklü' : 'Yüklü değil'}`);
			logger.info(`  📦 Copilot Chat uzantısı: ${copilotChatExtension ? 'Yüklü' : 'Yüklü değil'}`);

			// 2. Uzantıları aktifleştir
			if (copilotExtension && !copilotExtension.isActive) {
				try {
					logger.info("  ⏳ Copilot uzantısı aktifleştiriliyor...");
					await copilotExtension.activate();
					logger.info("  ✅ Copilot uzantısı aktifleştirildi");
				} catch (activationError) {
					logger.warn("  ⚠️ Copilot aktivasyon hatası:", activationError);
				}
			}

			if (copilotChatExtension && !copilotChatExtension.isActive) {
				try {
					logger.info("  ⏳ Copilot Chat uzantısı aktifleştiriliyor...");
					await copilotChatExtension.activate();
					logger.info("  ✅ Copilot Chat uzantısı aktifleştirildi");
				} catch (activationError) {
					logger.warn("  ⚠️ Copilot Chat aktivasyon hatası:", activationError);
				}
			}

			// 3. Kısa bekle - uzantıların modelleri kaydetmesi için
			await new Promise(resolve => setTimeout(resolve, 500));

			// 4. Language Models API erişimini test et
			// Sadece Copilot modellerini kontrol et
			try {
				const testModels = await vscode.lm.selectChatModels({ vendor: "copilot" });

				if (testModels.length > 0) {
					logger.info(`  ✅ ${testModels.length} language model erişilebilir`);
					return {
						available: true,
						details: {
							modelCount: testModels.length,
							models: testModels.map(m => ({ name: m.name, family: m.family, vendor: m.vendor }))
						}
					};
				} else {
					logger.warn("  ⚠️ Hiç model bulunamadı");
					return {
						available: false,
						reason: "Language Model bulunamadı. GitHub Copilot aboneliğiniz aktif olduğundan ve VS Code'a giriş yaptığınızdan emin olun.",
						details: {
							copilotInstalled: !!copilotExtension,
							copilotChatInstalled: !!copilotChatExtension,
							copilotActive: copilotExtension?.isActive,
							copilotChatActive: copilotChatExtension?.isActive
						}
					};
				}
			} catch (modelError: any) {
				logger.error("  ❌ Model erişim hatası:", modelError);
				return {
					available: false,
					reason: `Language Model API erişim hatası: ${modelError.message}. VS Code'u yeniden başlatmayı deneyin.`,
					details: { error: modelError.message }
				};
			}
		} catch (error: any) {
			logger.error("❌ Copilot durum kontrolü hatası:", error);
			return {
				available: false,
				reason: `Beklenmeyen hata: ${error}`
			};
		}
	}

	private async selectCurrentModel(): Promise<void> {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any;
		const selectedModelId = aiConfig?.selectedModel || "";

		if (this.availableModels.length === 0) {
			return;
		}

		// Seçilen modeli bul
		let selectedModel = this.availableModels.find(model =>
			model.id === selectedModelId ||
			model.family === selectedModelId ||
			model.name.toLowerCase().includes(selectedModelId.toLowerCase())
		);

		// Eğer seçilen model bulunamazsa, en iyi modeli seç
		if (!selectedModel) {
			selectedModel = this.getBestAvailableModel();
		}

		// En iyi modeli listesin başına taşı
		if (selectedModel) {
			this.availableModels = [selectedModel, ...this.availableModels.filter(m => m !== selectedModel)];
		}
	}

	private getBestAvailableModel(): vscode.LanguageModelChat | undefined {
		if (this.availableModels.length === 0) return undefined;

		// Öncelik sırası: GPT-5.2/Codex > GPT-5.1/Codex > GPT-5 > GPT-4.1 > GPT-4o > Claude 4.5/4 > Gemini 3 > o4/o3 > Claude 3.7/3.5 > GPT-4 > Gemini 2.x
		const priorityModels = [
			"gpt-5.2-codex",
			"gpt-5.2",
			"gpt-5.1-codex",
			"gpt-5",
			"gpt-4.1",
			"gpt-4o",
			"claude sonnet 4.5",
			"claude sonnet 4",
			"claude opus 4.5",
			"claude opus 4",
			"gemini 3",
			"o4",
			"o3",
			"claude-3.7",
			"claude sonnet 3.7",
			"claude-3.5",
			"gpt-4",
			"gemini 2.5",
			"gemini 2.0",
			"gpt-3.5"
		];

		for (const priorityModel of priorityModels) {
			const found = this.availableModels.find(model =>
				model.name.toLowerCase().includes(priorityModel) ||
				model.family.toLowerCase().includes(priorityModel)
			);
			if (found) return found;
		}

		// Hiçbiri bulunamazsa ilk modeli döndür
		return this.availableModels[0];
	}

	async getAvailableModels(): Promise<Array<{ id: string, name: string, family: string, description?: string, vendor?: string }>> {
		try {
			if (this.availableModels.length === 0) {
				await this.initializeModels();
			}

			return this.availableModels.map(model => ({
				id: model.id || model.family || model.name,
				name: model.name,
				family: model.family,
				vendor: model.vendor,
				description: `${model.vendor} - ${model.family} (Max tokens: ${model.maxInputTokens || "Unknown"})`
			}));
		} catch (error) {
			logger.error("Error getting available models:", error);
			return [];
		}
	}

	async improveCode(request: WCAGRequest): Promise<AIResponse> {
		const startTime = Date.now();

		try {
			// Model seçimini yenile
			if (!this.initialized) {
				await this.initializeModels();
			}

			logger.info(`VSCodeCopilotProvider: Improving code - Available models: ${this.availableModels.length}`);

			if (this.availableModels.length === 0) {
				return {
					success: false,
					error: "No language models available. Please ensure GitHub Copilot is enabled and you have an active subscription.",
					provider: "vscode-copilot"
				};
			}

			const model = this.availableModels[0];
			logger.info(`VSCodeCopilotProvider: Using model: ${model.name} (${model.family})`);
			const prompt = this.buildWCAGPrompt(request);

			// Cache Check
			const cacheKey = this.cache.generateKey(model.name, prompt);
			if (!request.forceRefresh) {
				const cachedResponse = this.cache.get(cacheKey);
				if (cachedResponse) {
					logger.info(`Cache Hit (Copilot): ${model.name}`);
					return cachedResponse;
				}
			}

			const messages = [
				vscode.LanguageModelChatMessage.User(prompt)
			];

			const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

			let content = "";
			for await (const fragment of chatResponse.text) {
				content += fragment;
			}

			const responseTime = Date.now() - startTime;

			// Extract token usage information from VS Code Copilot response
			let tokensUsed = 0;
			let inputTokens = 0;
			let outputTokens = 0;

			// Try to get usage metadata if available
			try {
				// VS Code Language Model API may provide usage information
				if (chatResponse && (chatResponse as any).usage) {
					const usage = (chatResponse as any).usage;
					inputTokens = usage.promptTokens || usage.inputTokens || 0;
					outputTokens = usage.completionTokens || usage.outputTokens || 0;
					tokensUsed = usage.totalTokens || (inputTokens + outputTokens);
				} else {
					// Fallback: estimate tokens based on content length
					const estimate = this.estimateTokensFromContent(prompt, content.trim());
					inputTokens = estimate.input;
					outputTokens = estimate.output;
					tokensUsed = estimate.total;
				}
			} catch (error) {
				// Fallback estimation if API doesn't provide usage data
				const estimate = this.estimateTokensFromContent(prompt, content.trim());
				inputTokens = estimate.input;
				outputTokens = estimate.output;
				tokensUsed = estimate.total;
			}

			// WCAG kriterlerini response'dan extract et
			const wcagCriteria = this.extractWCAGCriteria(content.trim());

			const response: AIResponse = {
				success: true,
				content: content.trim(),
				improvedCode: content.trim(),
				summary: "WCAG improvements applied via VS Code Copilot",
				wcagCriteria: wcagCriteria,
				tokensUsed,
				inputTokens,
				outputTokens,
				responseTime,
				model: model.name,
				provider: "vscode-copilot",
				usageMetadata: {
					estimatedTokens: tokensUsed > 0 ? false : true,
					model: model.name,
					family: model.family
				}
			};

			this.cache.set(cacheKey, response);
			return response;

		} catch (error: any) {
			logger.error("❌ VS Code Copilot API error:", error);

			// Özel hata mesajları
			const errorMessage = error?.message || String(error);

			if (errorMessage.includes("consent") || errorMessage.includes("permission") || errorMessage.includes("denied")) {
				return {
					success: false,
					error: "Copilot kullanım izni gerekiyor. VS Code'da bir Copilot Chat penceresi açıp izin verdikten sonra tekrar deneyin.",
					provider: "vscode-copilot"
				};
			}

			if (errorMessage.includes("rate limit") || errorMessage.includes("429") || errorMessage.includes("too many")) {
				return {
					success: false,
					error: "Copilot hız limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.",
					provider: "vscode-copilot"
				};
			}

			if (errorMessage.includes("not authenticated") || errorMessage.includes("sign in") || errorMessage.includes("unauthorized")) {
				return {
					success: false,
					error: "GitHub hesabınızla VS Code'a giriş yapmanız gerekiyor. Sol alt köşedeki hesap ikonuna tıklayın.",
					provider: "vscode-copilot"
				};
			}

			if (errorMessage.includes("network") || errorMessage.includes("connection") || errorMessage.includes("timeout")) {
				return {
					success: false,
					error: "Ağ bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.",
					provider: "vscode-copilot"
				};
			}

			return {
				success: false,
				error: `VS Code Copilot hatası: ${errorMessage}`,
				provider: "vscode-copilot"
			};
		}
	}

	async chat(message: string): Promise<AIResponse> {
		try {
			// Model seçimini yenile
			if (!this.initialized) {
				await this.initializeModels();
			}

			if (this.availableModels.length === 0) {
				return {
					success: false,
					error: "No language models available. Please ensure GitHub Copilot is enabled and you have an active subscription.",
					provider: "vscode-copilot"
				};
			}

			const model = this.availableModels[0];
			logger.info(`VSCodeCopilotProvider Chat: Using model: ${model.name} (${model.family})`);

			const chatPrompt = `You are AccessiMind, an AI assistant specializing in web accessibility and WCAG 2.2 standards. 
Help the user with their accessibility-related questions. Be helpful, concise, and provide practical advice.

User message: ${message}`;

			const messages = [
				vscode.LanguageModelChatMessage.User(chatPrompt)
			];

			const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

			let content = "";
			for await (const fragment of chatResponse.text) {
				content += fragment;
			}

			return {
				success: true,
				content: content.trim(),
				provider: "vscode-copilot",
				model: model.name
			};

		} catch (error) {
			logger.error("VS Code Copilot Chat error:", error);
			return {
				success: false,
				error: `VS Code Copilot Chat error: ${error instanceof Error ? error.message : "Unknown error"}`,
				provider: "vscode-copilot"
			};
		}
	}

	async analyzeCode(request: WCAGRequest): Promise<AIResponse> {
		const startTime = Date.now();

		try {
			// Model seçimini yenile
			if (!this.initialized) {
				await this.initializeModels();
			}

			logger.info(`VSCodeCopilotProvider: Analyzing code - Available models: ${this.availableModels.length}`);

			if (this.availableModels.length === 0) {
				return {
					success: false,
					error: "No language models available. Please ensure GitHub Copilot is enabled and you have an active subscription.",
					provider: "vscode-copilot"
				};
			}

			const model = this.availableModels[0];
			logger.info(`VSCodeCopilotProvider: Using model: ${model.name} (${model.family})`);
			const prompt = this.buildWCAGAnalysisPrompt(request);

			// Cache Check
			const cacheKey = this.cache.generateKey(model.name, prompt);
			if (!request.forceRefresh) {
				const cachedResponse = this.cache.get(cacheKey);
				if (cachedResponse) {
					logger.info(`Cache Hit (Copilot Analysis): ${model.name}`);
					return cachedResponse;
				}
			}

			const messages = [
				vscode.LanguageModelChatMessage.User(prompt)
			];

			const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

			let content = "";
			for await (const fragment of chatResponse.text) {
				content += fragment;
			}

			const responseTime = Date.now() - startTime;

			// Extract token usage information from VS Code Copilot response
			let tokensUsed = 0;
			let inputTokens = 0;
			let outputTokens = 0;

			// Try to get usage metadata if available
			try {
				// VS Code Language Model API may provide usage information
				if (chatResponse && (chatResponse as any).usage) {
					const usage = (chatResponse as any).usage;
					inputTokens = usage.promptTokens || usage.inputTokens || 0;
					outputTokens = usage.completionTokens || usage.outputTokens || 0;
					tokensUsed = usage.totalTokens || (inputTokens + outputTokens);
				} else {
					// Fallback: estimate tokens based on content length
					const estimate = this.estimateTokensFromContent(prompt, content.trim());
					inputTokens = estimate.input;
					outputTokens = estimate.output;
					tokensUsed = estimate.total;
				}
			} catch (error) {
				// Fallback estimation if API doesn't provide usage data
				const estimate = this.estimateTokensFromContent(prompt, content.trim());
				inputTokens = estimate.input;
				outputTokens = estimate.output;
				tokensUsed = estimate.total;
			}

			// WCAG kriterlerini response'dan extract et
			const wcagCriteria = this.extractWCAGCriteria(content.trim());

			// Parse the analysis result to extract structured data
			const analysisData = this.parseAnalysisResult(content.trim());

			const response: AIResponse = {
				success: true,
				content: content.trim(),
				summary: analysisData.summary,
				wcagCriteria: wcagCriteria,
				tokensUsed,
				inputTokens,
				outputTokens,
				responseTime,
				model: model.name,
				provider: "vscode-copilot",
				usageMetadata: {
					estimatedTokens: tokensUsed > 0 ? false : true,
					model: model.name,
					family: model.family
				}
			};

			this.cache.set(cacheKey, response);
			return response;
		} catch (error) {
			logger.error("VS Code Copilot API error:", error);
			return {
				success: false,
				error: `VS Code Copilot error: ${error instanceof Error ? error.message : "Unknown error"}`,
				provider: "vscode-copilot"
			};
		}
	}



	private parseAnalysisResult(content: string): any {
		try {
			// Try to extract JSON from the response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]);
				return {
					summary: parsed.summary || "Analysis completed",
					score: parsed.score || 0,
					level: parsed.level || "Unknown",
					issues: parsed.issues || [],
					suggestions: parsed.suggestions || []
				};
			}
		} catch (error) {
			// Fallback to simple text parsing
		}

		return {
			summary: "AI analysis completed",
			score: 75,
			level: "AA",
			issues: ["Manual review required"],
			suggestions: ["Please review the AI analysis manually"]
		};
	}

	async isAvailable(): Promise<boolean> {
		try {
			if (!this.initialized) {
				await this.initializeModels();
			}
			logger.info(`VSCodeCopilotProvider: Availability check - Initialized: ${this.initialized}, Available models: ${this.availableModels.length}`);
			return this.availableModels.length > 0;
		} catch (error) {
			logger.error("VSCodeCopilotProvider: Error checking availability:", error);
			return false;
		}
	}

	getDisplayName(): string {
		return "VS Code Copilot";
	}



	private estimateTokensFromContent(input: string, output: string): { input: number; output: number; total: number } {
		// Advanced token estimation for VS Code Copilot
		// Based on OpenAI tokenizer patterns (GPT models)

		const estimateTokensSimple = (text: string): number => {
			// Rough estimation: ~4 characters per token for GPT models
			const charCount = text.length;
			const wordCount = text.split(/\s+/).length;
			const lineCount = text.split('\n').length;

			// Enhanced estimation considering code structure
			const baseTokens = Math.ceil(charCount / 4);
			const structuralTokens = Math.ceil(wordCount * 0.1); // Keywords, operators
			const newlineTokens = Math.ceil(lineCount * 0.5); // Line breaks

			return baseTokens + structuralTokens + newlineTokens;
		};

		const inputTokens = estimateTokensSimple(input);
		const outputTokens = estimateTokensSimple(output);

		return {
			input: inputTokens,
			output: outputTokens,
			total: inputTokens + outputTokens
		};
	}
}
export class OllamaProvider extends AIProvider {
	private cache: RequestCache<AIResponse>;

	constructor() {
		super();
		this.cache = RequestCache.getInstance<AIResponse>("ollama");
	}

	private getBaseUrl(): string {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = config.get("ai") as any;
			return aiConfig?.ollamaUrl || "http://localhost:11434";
		} catch {
			return "http://localhost:11434";
		}
	}

	private getModel(): string {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiModelConfig = config.get("aiModels") as any;
			return aiModelConfig?.selectedModel || "llama3";
		} catch {
			return "llama3";
		}
	}

	async isAvailable(): Promise<boolean> {
		try {
			const baseUrl = this.getBaseUrl();
			const url = new URL(`${baseUrl}/api/tags`);
			const response = await this.makeSimpleGetRequest(url);
			return !!response;
		} catch {
			return false;
		}
	}

	getDisplayName(): string {
		return "Ollama (Local)";
	}

	async getAvailableModels(): Promise<any[]> {
		try {
			const baseUrl = this.getBaseUrl();
			const url = new URL(`${baseUrl}/api/tags`);
			const response = await this.makeSimpleGetRequest(url);
			if (response && response.models) {
				return response.models.map((m: any) => ({
					id: m.name,
					name: m.name,
					description: `${m.details?.family || 'Ollama'} - ${this.formatSize(m.size)}`,
					speed: "fast",
					quality: "medium"
				}));
			}
		} catch (error) {
			logger.error("Error fetching Ollama models:", error);
		}
		return [];
	}

	private formatSize(bytes: number): string {
		if (!bytes) return "Unknown size";
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb < 1) {
			const mb = bytes / (1024 * 1024);
			return `${mb.toFixed(1)} MB`;
		}
		return `${gb.toFixed(1)} GB`;
	}

	async improveCode(request: WCAGRequest): Promise<AIResponse> {
		const startTime = Date.now();
		const model = this.getModel();
		const prompt = this.buildWCAGPrompt(request);

		// Cache check
		const cacheKey = this.cache.generateKey(model, prompt);
		if (!request.forceRefresh) {
			const cachedResponse = this.cache.get(cacheKey);
			if (cachedResponse) return cachedResponse;
		}

		try {
			const result = await this.makeApiCall(model, prompt);
			const responseTime = Date.now() - startTime;
			const wcagCriteria = this.extractWCAGCriteria(result);

			const aiResponse: AIResponse = {
				success: true,
				content: result,
				improvedCode: result,
				summary: "WCAG improvements applied via Ollama",
				wcagCriteria,
				responseTime,
				model,
				provider: "ollama"
			};

			this.cache.set(cacheKey, aiResponse);
			return aiResponse;
		} catch (error) {
			return {
				success: false,
				error: `Ollama error: ${error instanceof Error ? error.message : String(error)}`,
				provider: "ollama"
			};
		}
	}

	async analyzeCode(request: WCAGRequest): Promise<AIResponse> {
		const startTime = Date.now();
		const model = this.getModel();
		const prompt = this.buildWCAGAnalysisPrompt(request);

		try {
			const result = await this.makeApiCall(model, prompt);
			const responseTime = Date.now() - startTime;
			const wcagCriteria = this.extractWCAGCriteria(result);

			return {
				success: true,
				content: result,
				summary: "WCAG analysis completed via Ollama",
				wcagCriteria,
				responseTime,
				model,
				provider: "ollama"
			};
		} catch (error) {
			return {
				success: false,
				error: `Ollama analysis error: ${error instanceof Error ? error.message : String(error)}`,
				provider: "ollama"
			};
		}
	}

	private async makeSimpleGetRequest(url: URL): Promise<any> {
		return new Promise((resolve, reject) => {
			const lib = url.protocol === "https:" ? https : http;
			lib.get(url, (res: any) => {
				let data = "";
				res.on("data", (chunk: any) => data += chunk);
				res.on("end", () => {
					try {
						resolve(JSON.parse(data));
					} catch (e) {
						reject(e);
					}
				});
			}).on("error", (err: any) => reject(err));
		});
	}

	private async makeApiCall(model: string, prompt: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const baseUrl = this.getBaseUrl();
			const url = new URL(`${baseUrl}/api/generate`);
			const lib = url.protocol === "https:" ? https : http;

			const postData = JSON.stringify({
				model,
				prompt,
				stream: false
			});

			const options = {
				hostname: url.hostname,
				port: url.port || (url.protocol === "https:" ? 443 : 80),
				path: url.pathname,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(postData)
				}
			};

			const req = lib.request(options, (res: any) => {
				let data = "";
				res.on("data", (chunk: any) => data += chunk);
				res.on("end", () => {
					try {
						if (res.statusCode && res.statusCode >= 400) {
							reject(new Error(`Ollama API Error: ${res.statusCode} - ${data}`));
							return;
						}
						const response = JSON.parse(data);
						resolve(response.response || "");
					} catch (e) {
						reject(new Error(`Failed to parse Ollama response: ${data}`));
					}
				});
			});

			req.on("error", (err: any) => reject(err));
			req.write(postData);
			req.end();
		});
	}
}


export class AIProviderManager {
	private static instance: AIProviderManager;
	private providers: Map<string, AIProvider> = new Map();
	private currentProvider: string = "gemini";
	private updateStatusBarCallback: (() => void) | null = null;

	private constructor() {
		this.initializeProviders();
	}

	public static getInstance(): AIProviderManager {
		if (!AIProviderManager.instance) {
			AIProviderManager.instance = new AIProviderManager();
		}
		return AIProviderManager.instance;
	}

	public setStatusBarCallback(callback: () => void): void {
		this.updateStatusBarCallback = callback;
	}

	private initializeProviders() {
		this.providers.set("gemini", new GeminiProvider());
		this.providers.set("vscode-copilot", new VSCodeCopilotProvider());
		this.providers.set("ollama", new OllamaProvider());

		// Load current provider from settings
		this.loadCurrentProvider();
	}

	public async loadCurrentProvider() {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = config.get("ai") as any;
			const newProvider = aiConfig?.provider || "gemini";

			// Provider değiştiyse model seçimini güncelle
			if (this.currentProvider !== newProvider) {
				this.currentProvider = newProvider;
				await this.updateModelSelection();
			} else {
				this.currentProvider = newProvider;
			}
		} catch (error) {
			logger.error("Provider loading error:", error);
			this.currentProvider = "gemini";
		}
	}

	private async updateModelSelection(): Promise<void> {
		if (this.currentProvider === "vscode-copilot") {
			const copilotProvider = this.providers.get("vscode-copilot") as unknown as VSCodeCopilotProvider;
			if (copilotProvider) {
				await copilotProvider.initializeModels();
			}
		}

		if (this.currentProvider === "ollama") {
			const ollamaProvider = this.providers.get("ollama") as unknown as OllamaProvider;
			if (ollamaProvider) {
				// Refresh Ollama models if needed (this might be handled by wizard too)
				await ollamaProvider.getAvailableModels();
			}
		}

		// Status bar'ı güncelle
		if (this.updateStatusBarCallback) {
			this.updateStatusBarCallback();
		}
	}

	public async getCurrentProviderInstance(): Promise<AIProvider> {
		await this.loadCurrentProvider();
		const provider = this.providers.get(this.currentProvider);
		if (!provider) {
			logger.warn(`Provider ${this.currentProvider} not found, falling back to Gemini`);
			return this.providers.get("gemini")!;
		}
		return provider;
	}

	public async setProvider(providerName: string): Promise<boolean> {
		if (!this.providers.has(providerName)) {
			return false;
		}

		const provider = this.providers.get(providerName)!;
		const isAvailable = await provider.isAvailable();

		if (!isAvailable) {
			throw new Error(`Provider ${provider.getDisplayName()} is not available`);
		}

		this.currentProvider = providerName;

		// Save to settings using new structure
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const aiConfig = config.get("ai") as any || {};
		aiConfig.provider = providerName;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

		// Model seçimini güncelle
		await this.updateModelSelection();

		return true;
	}

	public getCurrentProviderName(): string {
		return this.currentProvider;
	}

	public getCurrentProvider(): string {
		return this.currentProvider;
	}

	public async switchProvider(providerName: string): Promise<void> {
		const success = await this.setProvider(providerName);
		if (success) {
			logger.info(`Provider switched to: ${providerName}`);
		} else {
			throw new Error(`Failed to switch to provider: ${providerName}`);
		}
	}

	public getAvailableProviders(): Array<{ id: string; name: string; available: boolean }> {
		const result: Array<{ id: string; name: string; available: boolean }> = [];

		for (const [id, provider] of this.providers) {
			result.push({
				id,
				name: provider.getDisplayName(),
				available: false // Will be checked async when needed
			});
		}

		return result;
	}

	public async improveCode(request: WCAGRequest): Promise<AIResponse> {
		const provider = await this.getCurrentProviderInstance();

		if (!(await provider.isAvailable())) {
			throw new Error(`Current provider ${provider.getDisplayName()} is not available`);
		}

		return await provider.improveCode(request);
	}

	public async getAvailableCopilotModels(): Promise<Array<{ id: string, name: string, family: string, description?: string, vendor?: string }>> {
		const copilotProvider = this.providers.get("vscode-copilot") as unknown as VSCodeCopilotProvider;
		if (copilotProvider) {
			return copilotProvider.getAvailableModels();
		}
		return [];
	}

	public async refreshCopilotModels(): Promise<void> {
		const copilotProvider = this.providers.get("vscode-copilot") as unknown as VSCodeCopilotProvider;
		if (copilotProvider) {
			// Cache'yi temizle ve yeniden başlat
			await copilotProvider.refreshModels();
		}
	}

	public async setModel(modelId: string): Promise<boolean> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiModelConfig = config.get("aiModels") as any || {};
			aiModelConfig.selectedModel = modelId;
			await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);

			// Eğer Copilot provider ise, model seçimini güncelle
			if (this.currentProvider === "vscode-copilot") {
				const copilotProvider = this.providers.get("vscode-copilot") as unknown as VSCodeCopilotProvider;
				if (copilotProvider) {
					await copilotProvider.initializeModels();
				}
			}

			// Status bar'ı güncelle
			if (this.updateStatusBarCallback) {
				this.updateStatusBarCallback();
			}

			return true;
		} catch (error) {
			logger.error("Model ayarlama hatası:", error);
			return false;
		}
	}

	public getCurrentModelName(): string {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiModelConfig = config.get("aiModels") as any;
			const modelId = aiModelConfig?.selectedModel || "unknown";

			// Format model ID for display if possible
			if (modelId === "unknown") return "Default Model";

			// Simple formatting: gemini-1.5-flash -> Gemini 1.5 Flash
			return modelId
				.replace(/-/g, " ")
				.replace(/\b\w/g, (l: string) => l.toUpperCase());
		} catch {
			return "AI Model";
		}
	}
}
// End of file
