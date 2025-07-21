	import * as vscode from "vscode";
import * as https from "https";
import { SettingsManager } from "./settingsManager";
import { logger } from "./logger";

export interface GeminiResponse {
	success: boolean
	content?: string
	error?: string
	tokensUsed?: number
	inputTokens?: number
	outputTokens?: number
	responseTime?: number
	model?: string
	usageMetadata?: {
		promptTokenCount?: number
		candidatesTokenCount?: number
		totalTokenCount?: number
	}
}

export interface WCAGImprovementRequest {
	code: string
	fileType: string
	language: string
	selectedText?: string
	mode: "ask" | "agent" | "edit"
	model?: string
	wcagLevel?: "A" | "AA" | "AAA"
	includeComments?: boolean
}

export class GeminiAPI {
	private static instance: GeminiAPI;
	private apiKey: string = "";
	private baseUrl: string = "https://generativelanguage.googleapis.com/v1beta/models";

	private constructor() {
		this.loadApiKey();
	}

	public static getInstance(): GeminiAPI {
		if (!GeminiAPI.instance) {
			GeminiAPI.instance = new GeminiAPI();
		}
		return GeminiAPI.instance;
	}

	/**
	 * Sends a chat message to the Gemini API and returns the AI response.
	 * @param message User's chat message
	 * @returns GeminiResponse with the chat reply
	 */
	public async chat(message: string): Promise<GeminiResponse> {
		await this.loadApiKey();
		const model = "gemini-2.5-flash"; // veya ayarlardan dinamik alınabilir
		const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;
		const body = JSON.stringify({
			contents: [{ parts: [{ text: message }] }]
		});
		return new Promise<GeminiResponse>((resolve) => {
			const req = https.request(
				url,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					}
				},
				(res) => {
					let data = "";
					res.on("data", (chunk) => (data += chunk));
					res.on("end", () => {
						try {
							const json = JSON.parse(data);
							const content = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
							resolve({
								success: true,
								content
							});
						} catch (err) {
							resolve({
								success: false,
								error: "Gemini yanıtı ayrıştırılamadı"
							});
						}
					});
				}
			);
			req.on("error", (err) => {
				resolve({
					success: false,
					error: "Gemini API isteği başarısız: " + err.message
				});
			});
			req.write(body);
			req.end();
		});
	}

	private async loadApiKey(): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = config.get("ai") as any;
			this.apiKey = aiConfig?.apiKey || "";
		} catch (error) {
			logger.error("API key yüklenirken hata:", error);
		}
	}

	public async setApiKey(apiKey: string): Promise<void> {
		this.apiKey = apiKey;
		await SettingsManager.getInstance().updateApiKey(apiKey);
	}

	public async improveCode(request: WCAGImprovementRequest): Promise<GeminiResponse> {
		const startTime = Date.now();
		
		try {
			if (!this.apiKey) {
				return {
					success: false,
					error: "Gemini API anahtarı bulunamadı. Lütfen ayarlardan API anahtarınızı girin."
				};
			}

			const model = request.model || await this.getDefaultModel();
			if (!model || typeof model !== "string" || !model.startsWith("gemini-")) {
				return {
					success: false,
					error: "Error: Invalid Gemini model name. Please check your model settings."
				};
			}
			const wcagLevel = request.wcagLevel || "AA";
			const includeComments = request.includeComments !== false;

			const prompt = this.buildWCAGPrompt(request, wcagLevel, includeComments);
			if (!prompt || prompt.length < 20) {
				return {
					success: false,
					error: "Error: Prompt is too short or empty. Please provide valid code for analysis."
				};
			}
			if (prompt.length > 12000) {
				return {
					success: false,
					error: "Error: Prompt is too long for Gemini API. Please reduce the code size."
				};
			}
			
			const response = await this.makeApiCall(model, prompt, request.mode);
			
			const responseTime = Date.now() - startTime;
			
			// İstatistikleri güncelle
			await this.updateStatistics(response, responseTime, model, request.mode, wcagLevel);
			
			return {
				success: response.success,
				content: response.content,
				error: response.error,
				tokensUsed: response.tokensUsed,
				responseTime,
				model
			};
		} catch (error) {
			logger.error("Kod iyileştirme hatası:", error);
			return {
				success: false,
				error: `Error during code improvement: ${error instanceof Error ? error.message : "Unknown error"}`
			};
		}
	}

	private async getDefaultModel(): Promise<string> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiModelConfig = config.get("aiModels") as any;
			return aiModelConfig?.selectedModel || "gemini-2.5-flash";
		} catch {
			return "gemini-2.5-flash";
		}
	}

	private buildWCAGPrompt(request: WCAGImprovementRequest, wcagLevel: string, includeComments: boolean): string {
		const { code, fileType, language, selectedText, mode } = request;
		
		// Dil ayarını al - sihirbazda seçilen dili kullan
		const responseLanguage = this.getResponseLanguage();
		const isEnglish = responseLanguage === "en";
		
		let prompt = isEnglish ?
			`You are a WCAG 2.2 accessibility expert. Make ${wcagLevel} level accessibility improvements with detailed inline comments.

File Type: ${fileType}
Language: ${language}
WCAG Level: ${wcagLevel}
Mode: ${mode}

${mode === "ask" ? "Provide detailed analysis and specific recommendations for WCAG compliance." : ""}
${mode === "agent" ? "Analyze the code thoroughly and provide comprehensive WCAG improvement recommendations with specific implementation details." : ""}
${mode === "edit" ? "CRITICALLY IMPORTANT: Return the complete improved code with detailed inline comments explaining every WCAG change made. Each comment must specify the exact WCAG criterion applied." : ""}

${selectedText ? `Selected Code:\n\`\`\`${language}\n${selectedText}\n\`\`\`` : ""}

Current Code:
\`\`\`${language}
${code}
\`\`\`

MANDATORY REQUIREMENTS FOR COMMENTS:
- Add detailed inline comments for EVERY accessibility change
- Each comment must include the specific WCAG criterion (e.g., "WCAG 2.2 Success Criterion 1.1.1 Non-text Content")
- Explain WHY each change improves accessibility
- Include the accessibility principle (Perceivable, Operable, Understandable, Robust)
- Use ${isEnglish ? "English" : "Turkish"} for all comments

Comment Format Example:
/* WCAG 2.2 SC 1.3.1 Info and Relationships (Perceivable):
	  Added semantic <main> element to provide proper document structure
	  and improve screen reader navigation */

Response format for ${mode} mode:
${mode === "edit" ? `
MUST INCLUDE:
1. Complete improved code with inline comments for every change
2. Summary of all WCAG criteria applied
3. Before/after comparison highlighting improvements
4. Accessibility testing recommendations` : `
MUST INCLUDE:
1. Detailed WCAG 2.2 compliance analysis
2. Specific improvement recommendations with code examples
3. Priority ranking of fixes (Critical, High, Medium, Low)
4. Implementation guidance for each recommendation`}

Focus on WCAG 2.2 Success Criteria:

PERCEIVABLE (1.x):
- 1.1.1 Non-text Content: Alt text, captions, labels
- 1.3.1 Info and Relationships: Semantic markup, proper headings
- 1.4.3 Contrast (Minimum): 4.5:1 for normal text, 3:1 for large text
- 1.4.11 Non-text Contrast: 3:1 for UI components and graphics

OPERABLE (2.x):
- 2.1.1 Keyboard: All functionality available from keyboard
- 2.4.3 Focus Order: Logical and intuitive focus sequence
- 2.4.6 Headings and Labels: Descriptive headings and labels
- 2.4.7 Focus Visible: Visible focus indicator

UNDERSTANDABLE (3.x):
- 3.1.1 Language of Page: lang attribute on html element
- 3.2.1 On Focus: No context changes on focus
- 3.3.1 Error Identification: Clear error messages
- 3.3.2 Labels or Instructions: Form fields have labels

ROBUST (4.x):
- 4.1.1 Parsing: Valid HTML markup
- 4.1.2 Name, Role, Value: Proper ARIA implementation
- 4.1.3 Status Messages: Screen reader notifications

Advanced ARIA Implementation:
- aria-labelledby, aria-describedby for complex relationships
- Landmark roles: banner, main, navigation, complementary, contentinfo
- Live regions: aria-live="polite|assertive", aria-atomic, aria-relevant
- Interactive elements: aria-expanded, aria-controls, aria-selected
- Form validation: aria-required, aria-invalid, aria-errormessage
- Focus management: aria-activedescendant, tabindex management
- Hide decorative content: aria-hidden="true"
- Custom components: proper role, state, and property management

Provide comprehensive accessibility improvements with detailed explanations in English.` :
			
			`Sen bir WCAG 2.2 erişilebilirlik uzmanısın. ${wcagLevel} seviyesinde detaylı satır içi yorumlarla erişilebilirlik iyileştirmeleri yap.

Dosya Türü: ${fileType}
Dil: ${language}
WCAG Seviyesi: ${wcagLevel}
Mod: ${mode}

${mode === "ask" ? "Detaylı analiz ve WCAG uyumluluğu için spesifik öneriler sağla." : ""}
${mode === "agent" ? "Kodu kapsamlı şekilde analiz et ve spesifik uygulama detaylarıyla WCAG iyileştirme önerileri sun." : ""}
${mode === "edit" ? "KRİTİK ÖNEM: Yapılan her WCAG değişikliğini açıklayan detaylı satır içi yorumlarla birlikte tamamlanmış iyileştirilmiş kodu döndür. Her yorum uygulanan kesin WCAG kriterini belirtmeli." : ""}

${selectedText ? `Seçili Kod:\n\`\`\`${language}\n${selectedText}\n\`\`\`` : ""}

Mevcut Kod:
\`\`\`${language}
${code}
\`\`\`

YORUMLAR İÇİN ZORUNLU GEREKSINIMLER:
- Her erişilebilirlik değişikliği için detaylı satır içi yorumlar ekle
- Her yorum spesifik WCAG kriterini içermeli (örn: "WCAG 2.2 Başarı Kriteri 1.1.1 Metin Olmayan İçerik")
- Her değişikliğin erişilebilirliği neden iyileştirdiğini açıkla
- Erişilebilirlik ilkesini dahil et (Algılanabilir, İşletilebilir, Anlaşılabilir, Sağlam)
- Tüm yorumlar için Türkçe kullan

Yorum Formatı Örneği:
/* WCAG 2.2 BK 1.3.1 Bilgi ve İlişkiler (Algılanabilir):
	  Uygun belge yapısı sağlamak ve ekran okuyucu navigasyonunu
	  iyileştirmek için semantik <main> elementi eklendi */

${mode} modu için yanıt formatı:
${mode === "edit" ? `
MUTLAKA İÇERMELİ:
1. Her değişiklik için satır içi yorumlarla tamamlanmış iyileştirilmiş kod
2. Uygulanan tüm WCAG kriterlerinin özeti
3. İyileştirmeleri vurgulayan önce/sonra karşılaştırması
4. Erişilebilirlik test önerileri` : `
MUTLAKA İÇERMELİ:
1. Detaylı WCAG 2.2 uyumluluk analizi
2. Kod örnekleriyle spesifik iyileştirme önerileri
3. Düzeltmelerin öncelik sıralaması (Kritik, Yüksek, Orta, Düşük)
4. Her öneri için uygulama rehberliği`}

WCAG 2.2 Başarı Kriterlerine odaklan:

ALGILANABİLİR (1.x):
- 1.1.1 Metin Olmayan İçerik: Alt metin, altyazı, etiketler
- 1.3.1 Bilgi ve İlişkiler: Semantik işaretleme, uygun başlıklar
- 1.4.3 Kontrast (Minimum): Normal metin için 4.5:1, büyük metin için 3:1
- 1.4.11 Metin Olmayan Kontrast: UI bileşenleri ve grafikler için 3:1

İŞLETİLEBİLİR (2.x):
- 2.1.1 Klavye: Tüm işlevsellik klavyeden erişilebilir
- 2.4.3 Odak Sırası: Mantıklı ve sezgisel odak dizisi
- 2.4.6 Başlıklar ve Etiketler: Açıklayıcı başlık ve etiketler
- 2.4.7 Görünür Odak: Görünür odak göstergesi

ANLAŞILABİLİR (3.x):
- 3.1.1 Sayfanın Dili: html elementinde lang özniteliği
- 3.2.1 Odakta: Odakta bağlam değişiklikleri yok
- 3.3.1 Hata Tanımlama: Net hata mesajları
- 3.3.2 Etiketler veya Talimatlar: Form alanları etiketlere sahip

SAĞLAM (4.x):
- 4.1.1 Ayrıştırma: Geçerli HTML işaretlemesi
- 4.1.2 Ad, Rol, Değer: Uygun ARIA uygulaması
- 4.1.3 Durum Mesajları: Ekran okuyucu bildirimleri

Gelişmiş ARIA Uygulaması:
- Karmaşık ilişkiler için aria-labelledby, aria-describedby
- Landmark rolleri: banner, main, navigation, complementary, contentinfo
- Canlı bölgeler: aria-live="polite|assertive", aria-atomic, aria-relevant
- Etkileşimli öğeler: aria-expanded, aria-controls, aria-selected
- Form doğrulama: aria-required, aria-invalid, aria-errormessage
- Odak yönetimi: aria-activedescendant, tabindex yönetimi
- Dekoratif içeriği gizle: aria-hidden="true"
- Özel bileşenler: uygun rol, durum ve özellik yönetimi

Türkçe detaylı açıklamalarla kapsamlı erişilebilirlik iyileştirmeleri sağla.`;

		return prompt;
	}

	private getResponseLanguage(): string {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const language = config.get<string>("language", "en");
			
			if (language === "auto") {
				const vscodeLanguage = vscode.env.language;
				return vscodeLanguage.startsWith("tr") ? "tr" : "en";
			}
			
			return language;
		} catch (error) {
			logger.error("Dil ayarı alınırken hata:", error);
			return "en"; // Varsayılan olarak İngilizce
		}
	}

	private async makeApiCall(model: string, prompt: string, mode: string): Promise<GeminiResponse> {
		try {
			const maxTokens = await this.getMaxTokens();
			const temperature = await this.getTemperature();
			
			const requestBody = {
				contents: [{
					parts: [{
						text: prompt
					}]
				}],
				generationConfig: {
					maxOutputTokens: maxTokens,
					temperature: temperature,
					topP: 0.8,
					topK: 40
				},
				safetySettings: [
					{
						category: "HARM_CATEGORY_HARASSMENT",
						threshold: "BLOCK_MEDIUM_AND_ABOVE"
					},
					{
						category: "HARM_CATEGORY_HATE_SPEECH",
						threshold: "BLOCK_MEDIUM_AND_ABOVE"
					},
					{
						category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
						threshold: "BLOCK_MEDIUM_AND_ABOVE"
					},
					{
						category: "HARM_CATEGORY_DANGEROUS_CONTENT",
						threshold: "BLOCK_MEDIUM_AND_ABOVE"
					}
				]
			};

			const postData = JSON.stringify(requestBody);
			const url = new URL(`${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`);
			
			const options: https.RequestOptions = {
				hostname: url.hostname,
				port: 443,
				path: url.pathname + url.search,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(postData)
				}
			};

			return new Promise((resolve, reject) => {
				const req = https.request(options, (res) => {
					let data = "";

					res.on("data", (chunk) => {
						data += chunk;
					});

					res.on("end", () => {
						try {
							if (res.statusCode && res.statusCode >= 400) {
								const errorData = JSON.parse(data);
								reject(new Error(`API Error: ${res.statusCode} - ${errorData.error?.message || res.statusMessage}`));
								return;
							}

							const responseData = JSON.parse(data);
							
							if (!responseData.candidates || !responseData.candidates[0] || !responseData.candidates[0].content) {
								reject(new Error("Geçersiz API yanıtı"));
								return;
							}

							const content = responseData.candidates[0].content.parts[0].text;
							const usageMetadata = responseData.usageMetadata || {};
							const inputTokens = usageMetadata.promptTokenCount || 0;
							const outputTokens = usageMetadata.candidatesTokenCount || 0;
							const tokensUsed = usageMetadata.totalTokenCount || (inputTokens + outputTokens);

							resolve({
								success: true,
								content: content,
								tokensUsed,
								inputTokens,
								outputTokens,
								usageMetadata
							});
						} catch (error) {
							reject(new Error(`Yanıt işlenirken hata: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`));
						}
					});
				});

				req.on("error", (error) => {
					reject(new Error(`İstek hatası: ${error.message}`));
				});

				req.write(postData);
				req.end();
			});

		} catch (error) {
			logger.error("API çağrısı hatası:", error);
			throw error;
		}
	}

	private async getMaxTokens(): Promise<number> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = config.get("ai") as any;
			return aiConfig?.maxTokens || 2048;
		} catch {
			return 2048;
		}
	}

	private async getTemperature(): Promise<number> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			const aiConfig = config.get("ai") as any;
			return aiConfig?.temperature || 0.7;
		} catch {
			return 0.7;
		}
	}

	private async updateStatistics(
		response: GeminiResponse, 
		responseTime: number, 
		model: string, 
		mode: string, 
		wcagLevel: string
	): Promise<void> {
		try {
			// WCAG kriterlerini içerikten tespit et
			const wcagCriteria = this.extractWCAGCriteria(response.content || "");
			
			// İstatistik güncellemesi StatisticsManager tarafından extension.ts'de yapılacak
			logger.info(`API yanıtı: ${response.success ? "Başarılı" : "Başarısız"}, Süre: ${responseTime}ms, Model: ${model}`);
		} catch (error) {
			logger.error("İstatistik güncelleme hatası:", error);
		}
	}

	private extractWCAGCriteria(content: string): string[] {
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

	public async isApiKeyConfigured(): Promise<boolean> {
		await this.loadApiKey();
		return this.apiKey.length > 0;
	}

	public async testConnection(): Promise<{ success: boolean; message: string; model?: string }> {
		try {
			if (!this.apiKey) {
				return {
					success: false,
					message: "API anahtarı yapılandırılmamış"
				};
			}

			const testPrompt = "Bu bir bağlantı testidir. Lütfen \"Test başarılı\" yanıtını verin.";
			const model = await this.getDefaultModel();
			
			const response = await this.makeApiCall(model, testPrompt, "ask");
			
			if (response.success) {
				return {
					success: true,
					message: `Bağlantı başarılı! Model: ${model}`,
					model: model
				};
			} else {
				return {
					success: false,
					message: response.error || "Bağlantı testi başarısız"
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Bağlantı hatası: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`
			};
		}
	}

	public async getAvailableModels(): Promise<Array<{id: string, name: string, description: string}>> {
		try {
			if (!this.apiKey) {
				// API anahtarı yoksa varsayılan modelleri döndür
				return this.getDefaultStaticModels();
			}

			// API'den mevcut modelleri çek
			const response = await this.fetchModelsFromAPI();
			if (response.success && response.models) {
				return response.models.map((model: any) => ({
					id: model.name?.replace("models/", "") || model.id,
					name: this.formatModelName(model.name || model.id),
					description: model.description || this.getModelDescription(model.name || model.id)
				}));
			}
		} catch (error) {
			logger.warn("API'den modeller alınamadı, varsayılan modeller kullanılıyor:", error);
		}

		// Hata durumunda varsayılan modelleri döndür
		return this.getDefaultStaticModels();
	}

	private getDefaultStaticModels(): Array<{id: string, name: string, description: string}> {
		return [
			{
				id: "gemini-2.0-flash-exp",
				name: "Gemini 2.0 Flash (Experimental)",
				description: "En hızlı yanıt süresi - Deneysel model"
			},
			{
				id: "gemini-1.5-flash",
				name: "Gemini 1.5 Flash",
				description: "Hızlı ve verimli - Çoğu görev için ideal"
			},
			{
				id: "gemini-1.5-pro",
				name: "Gemini 1.5 Pro",
				description: "En kaliteli model - Karmaşık görevler için"
			}
		];
	}

	private async fetchModelsFromAPI(): Promise<{success: boolean, models?: any[]}> {
		return new Promise((resolve) => {
			const url = `${this.baseUrl}?key=${this.apiKey}`;
			
			https.get(url, {
				timeout: 10000
			}, (res) => {
				let data = "";
				
				res.on("data", (chunk) => {
					data += chunk;
				});
				
				res.on("end", () => {
					try {
						const response = JSON.parse(data);
						if (response.models && Array.isArray(response.models)) {
							// Sadece generateContent destekleyen modelleri filtrele
							const supportedModels = response.models.filter((model: any) =>
								model.supportedGenerationMethods?.includes("generateContent")
							);
							resolve({ success: true, models: supportedModels });
						} else {
							resolve({ success: false });
						}
					} catch (parseError) {
						logger.error("Model listesi parse hatası:", parseError);
						resolve({ success: false });
					}
				});
				
			}).on("error", (error) => {
				logger.error("Model listesi API hatası:", error);
				resolve({ success: false });
			}).on("timeout", () => {
				logger.warn("Model listesi API zaman aşımı");
				resolve({ success: false });
			});
		});
	}

	private formatModelName(modelId: string): string {
		// models/gemini-1.5-flash -> Gemini 1.5 Flash
		return modelId
			.replace("models/", "")
			.replace("gemini-", "Gemini ")
			.replace(/-/g, " ")
			.replace(/\b\w/g, l => l.toUpperCase());
	}

	private getModelDescription(modelId: string): string {
		const descriptions: {[key: string]: string} = {
			"gemini-2.0-flash-exp": "En hızlı yanıt süresi - Deneysel model",
			"gemini-1.5-flash": "Hızlı ve verimli - Çoğu görev için ideal",
			"gemini-1.5-pro": "En kaliteli model - Karmaşık görevler için",
			"gemini-1.0-pro": "Stabil ve güvenilir - Genel amaçlı kullanım"
		};
		
		const cleanId = modelId.replace("models/", "");
		return descriptions[cleanId] || "Google Gemini modeli";
	}

	// Eski metodu korumak için sync wrapper
	public getAvailableModelsSync(): Array<{id: string, name: string, description: string}> {
		return this.getDefaultStaticModels();
	}
}