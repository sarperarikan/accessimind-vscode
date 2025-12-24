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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderManager = exports.VSCodeCopilotProvider = exports.GeminiProvider = exports.AIProvider = void 0;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const zlib = __importStar(require("zlib"));
const requestCache_1 = require("./requestCache");
const logger_1 = require("./logger");
const apiOptimizer_1 = require("./apiOptimizer");
class AIProvider {
    async chat(message) {
        throw new Error("Chat not implemented for this provider.");
    }
    buildWCAGPrompt(request) {
        const { code, fileType, language, selectedText, wcagLevel = "AA", includeComments = true, responseLanguage = "en" } = request;
        const langMap = {
            en: {
                title: "You are a WCAG 2.2 accessibility expert.",
                fileType: "File Type",
                language: "Language",
                wcagLevel: "WCAG Level",
                selectedCode: "Selected Code",
                currentCode: "Current Code",
                instructions: "Please improve this code to meet WCAG 2.2 accessibility standards.",
                format: "Response format:\n- Return improved code\n- Explain each change\n- Specify WCAG criteria applied",
                criteria: "Focus on WCAG 2.2 criteria:\n- Perceivable (1.x): Contrast, text alternatives, color usage\n- Operable (2.x): Keyboard access, navigation, timing\n- Understandable (3.x): Readability, predictability, error identification\n- Robust (4.x): Compatibility, ARIA usage, semantic HTML"
            },
            tr: {
                title: "Sen bir WCAG 2.2 erişilebilirlik uzmanısın.",
                fileType: "Dosya Türü",
                language: "Dil",
                wcagLevel: "WCAG Seviyesi",
                selectedCode: "Seçili Kod",
                currentCode: "Mevcut Kod",
                instructions: "Lütfen bu kodu WCAG 2.2 erişilebilirlik standartlarını karşılayacak şekilde iyileştir.",
                format: "Yanıt formatı:\n- İyileştirilmiş kodu döndür\n- Her değişikliği açıkla\n- Uygulanan WCAG kriterlerini belirt",
                criteria: "WCAG 2.2 kriterlerine odaklan:\n- Algılanabilir (1.x): Kontrast, metin alternatifleri, renk kullanımı\n- İşletilebilir (2.x): Klavye erişimi, navigasyon, zamanlama\n- Anlaşılabilir (3.x): Okunabilirlik, öngörülebilirlik, hata tanımlama\n- Sağlam (4.x): Uyumluluk, ARIA kullanımı, semantik HTML"
            }
        };
        const strings = langMap[responseLanguage || "en"];
        let prompt = `${strings.title} ${strings.instructions}

${strings.fileType}: ${fileType}
${strings.language}: ${language}
${strings.wcagLevel}: ${wcagLevel}

${selectedText ? `${strings.selectedCode}:\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\n` : ""}

${strings.currentCode}:
\`\`\`${language}
${code}
\`\`\`

${includeComments ? "Please include explanatory comments about the improvements made." : ""}

${strings.format}

${strings.criteria}`;
        return prompt;
    }
    buildWCAGAnalysisPrompt(request) {
        const { code, fileType, language, wcagLevel = "AA", responseLanguage = "en" } = request;
        const basePrompt = responseLanguage === "tr" ?
            `Lütfen aşağıdaki ${language} kodunu WCAG ${wcagLevel} standartlarına göre analiz edin:` :
            `Please analyze the following ${language} code according to WCAG ${wcagLevel} standards:`;
        const analysisInstructions = responseLanguage === "tr" ? `
Analiz sonucunda şunları sağlayın:
1. Genel erişilebilirlik skoru (0-100)
2. Tespit edilen erişilebilirlik sorunları
3. Her sorun için öneriler
4. WCAG uygunluk seviyesi (A, AA, AAA)
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
4. WCAG compliance level (A, AA, AAA)
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
    extractWCAGCriteria(content) {
        const criteria = [];
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
exports.AIProvider = AIProvider;
class GeminiProvider extends AIProvider {
    constructor() {
        super();
        this.apiKey = "";
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
        this.cache = requestCache_1.RequestCache.getInstance("gemini");
        this.loadApiKey();
    }
    async loadApiKey() {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiConfig = config.get("ai");
            this.apiKey = aiConfig?.apiKey || "";
        }
        catch (error) {
            logger_1.logger.error("Error loading API key:", error);
        }
    }
    async isApiKeyConfigured() {
        await this.loadApiKey();
        return this.apiKey.length > 0;
    }
    async testConnection() {
        await this.loadApiKey();
        if (!this.apiKey) {
            return { success: false, message: "API key not configured" };
        }
        try {
            const model = await this.getDefaultModel();
            await this.makeApiCall(model, "Test connection", "test");
            return { success: true, message: "Connection successful", model };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
    async getAvailableModels() {
        await this.loadApiKey();
        if (!this.apiKey) {
            logger_1.logger.warn("No API key configured, returning default models");
            return this.getDefaultModels();
        }
        try {
            // Fetch models from Gemini API
            const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            const response = await new Promise((resolve, reject) => {
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
                        }
                        catch (error) {
                            reject(error);
                        }
                    });
                });
                req.on("error", reject);
                req.end();
            });
            if (response.models && Array.isArray(response.models)) {
                // Filter to only generative models that support generateContent
                const generativeModels = response.models.filter((model) => model.supportedGenerationMethods?.includes("generateContent") &&
                    model.name?.includes("gemini"));
                // Sort by preference (newer/faster models first)
                const sortedModels = generativeModels.sort((a, b) => {
                    const aName = a.name?.toLowerCase() || "";
                    const bName = b.name?.toLowerCase() || "";
                    // Prioritize 2.5 > 2.0 > 1.5
                    if (aName.includes("2.5") && !bName.includes("2.5"))
                        return -1;
                    if (!aName.includes("2.5") && bName.includes("2.5"))
                        return 1;
                    if (aName.includes("2.0") && !bName.includes("2.0"))
                        return -1;
                    if (!aName.includes("2.0") && bName.includes("2.0"))
                        return 1;
                    // Prioritize flash over pro for speed
                    if (aName.includes("flash") && !bName.includes("flash"))
                        return -1;
                    if (!aName.includes("flash") && bName.includes("flash"))
                        return 1;
                    return 0;
                });
                logger_1.logger.info(`Fetched ${sortedModels.length} Gemini models from API`);
                return sortedModels.map((model, index) => {
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
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch Gemini models from API:", error);
            return this.getDefaultModels();
        }
    }
    getDefaultModels() {
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
    formatModelName(modelId) {
        return modelId
            .replace("gemini-", "Gemini ")
            .replace(/-/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    async chat(message) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                provider: "gemini"
            };
        }
    }
    async improveCode(request) {
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
                    logger_1.logger.info(`Cache Hit: ${model}`);
                    return cachedResponse;
                }
            }
            const response = await this.makeApiCall(model, prompt, "improve");
            const responseTime = Date.now() - startTime;
            // Extract WCAG criteria
            const wcagCriteria = this.extractWCAGCriteria(response.content || "");
            const aiResponse = {
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
        }
        catch (error) {
            logger_1.logger.error("Gemini improveCode error:", error);
            return {
                success: false,
                error: `Gemini error: ${error.message}`,
                provider: "gemini"
            };
        }
    }
    async analyzeCode(request) {
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
                    logger_1.logger.info(`Cache Hit: ${model}`);
                    return cachedResponse;
                }
            }
            const response = await this.makeApiCall(model, prompt, "analyze");
            const responseTime = Date.now() - startTime;
            const wcagCriteria = this.extractWCAGCriteria(response.content || "");
            const analysisData = this.parseAnalysisResult(response.content || "");
            const aiResponse = {
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
        }
        catch (error) {
            return {
                success: false,
                error: `Gemini analysis error: ${error.message}`,
                provider: "gemini"
            };
        }
    }
    async isAvailable() {
        await this.loadApiKey();
        return this.apiKey.length > 0;
    }
    getDisplayName() {
        return "Google Gemini";
    }
    // --- Helper Methods ---
    async getDefaultModel() {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiModelConfig = config.get("aiModels");
            return aiModelConfig?.selectedModel || "gemini-2.5-flash";
        }
        catch {
            return "gemini-2.5-flash";
        }
    }
    parseAnalysisResult(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) { }
        return { summary: "Analysis completed", issues: [] };
    }
    async makeApiCall(model, prompt, mode) {
        const startTime = Date.now();
        const metrics = apiOptimizer_1.ApiMetricsCollector.getInstance();
        const httpAgent = apiOptimizer_1.OptimizedHttpAgent.getInstance();
        // Get configuration
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai");
        const maxTokens = aiConfig?.maxTokens || 4096;
        const temperature = aiConfig?.temperature || 0.7;
        const timeout = aiConfig?.timeout || 60000;
        const retryCount = aiConfig?.retryCount || 2;
        // Optimize prompt if too long
        const optimizedPrompt = apiOptimizer_1.PromptOptimizer.truncateCode(prompt, 12000);
        const estimatedTokens = apiOptimizer_1.PromptOptimizer.estimateTokens(optimizedPrompt);
        logger_1.logger.info(`API call - Model: ${model}, Mode: ${mode}, Est. tokens: ${estimatedTokens}`);
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
        const baseOptions = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData)
            }
        };
        const options = (0, apiOptimizer_1.createOptimizedRequestOptions)(baseOptions, {
            timeout: timeout,
            enableCompression: true
        });
        // Use retry with backoff for reliability
        const executeRequest = async () => {
            return new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    const chunks = [];
                    res.on("data", (chunk) => chunks.push(chunk));
                    res.on("end", () => {
                        try {
                            let data;
                            const buffer = Buffer.concat(chunks);
                            // Handle gzip compression
                            const encoding = res.headers['content-encoding'];
                            if (encoding === 'gzip') {
                                data = zlib.gunzipSync(buffer).toString('utf-8');
                            }
                            else if (encoding === 'deflate') {
                                data = zlib.inflateSync(buffer).toString('utf-8');
                            }
                            else {
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
                            logger_1.logger.info(`API response received in ${responseTime}ms, tokens: ${usage.totalTokenCount || 'N/A'}`);
                            resolve({
                                content,
                                tokensUsed: usage.totalTokenCount,
                                inputTokens: usage.promptTokenCount,
                                outputTokens: usage.candidatesTokenCount,
                                usageMetadata: usage,
                                responseTime
                            });
                        }
                        catch (error) {
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
exports.GeminiProvider = GeminiProvider;
// ... existing imports ...
class VSCodeCopilotProvider extends AIProvider {
    constructor() {
        super();
        this.availableModels = [];
        this.initialized = false;
        this.modelChangeDisposable = null;
        this.cache = requestCache_1.RequestCache.getInstance("vscode-copilot");
        // Model değişikliklerini dinle - yeni modeller eklendiğinde veya kaldırıldığında
        this.modelChangeDisposable = vscode.lm.onDidChangeChatModels(() => {
            logger_1.logger.info("📢 VS Code Language Models değişti, cache sıfırlanıyor...");
            this.initialized = false;
            this.availableModels = [];
            // Lazy loading ile sonraki kullanımda yeniden yüklenecek
        });
    }
    // ... existing methodology ...
    async initializeModels() {
        try {
            logger_1.logger.info("🔄 Copilot modelleri başlatılıyor...");
            // GitHub Copilot durumunu kontrol et
            const copilotStatus = await this.checkCopilotStatus();
            if (copilotStatus.available) {
                // Dinamik olarak mevcut modelleri çek
                await this.fetchAvailableModels();
            }
            else {
                logger_1.logger.warn("⚠️ GitHub Copilot kullanılamıyor:", copilotStatus.reason);
                this.availableModels = [];
            }
            // Seçilen modeli al ve eşleştir
            await this.selectCurrentModel();
            this.initialized = true;
            if (this.availableModels.length > 0) {
                logger_1.logger.info(`✅ Copilot başlatıldı: ${this.availableModels.length} model mevcut`);
            }
            else {
                logger_1.logger.warn("⚠️ Copilot başlatıldı ancak model bulunamadı");
            }
        }
        catch (error) {
            logger_1.logger.error("❌ VS Code Language Models başlatma hatası:", error);
            this.availableModels = [];
            this.initialized = true; // Hata olsa bile başlatıldı olarak işaretle
        }
    }
    async fetchAvailableModels() {
        try {
            // Tek bir çağrıda tüm mevcut modelleri al - en güvenilir yöntem
            const allModels = await vscode.lm.selectChatModels();
            if (allModels.length === 0) {
                logger_1.logger.warn("⚠️ VS Code Language Model API: Hiç model bulunamadı");
                logger_1.logger.info("💡 İpucu: GitHub Copilot aboneliğinizin aktif olduğundan emin olun");
                this.availableModels = [];
                return;
            }
            logger_1.logger.info(`✅ Toplam ${allModels.length} language model bulundu`);
            // Her modelin detaylarını logla (debug için önemli)
            allModels.forEach((model, index) => {
                logger_1.logger.info(`  [${index + 1}] Model: ${model.name}`);
                logger_1.logger.info(`      Family: ${model.family}`);
                logger_1.logger.info(`      Vendor: ${model.vendor}`);
                logger_1.logger.info(`      ID: ${model.id}`);
                logger_1.logger.info(`      MaxInputTokens: ${model.maxInputTokens || 'unknown'}`);
            });
            // Modelleri kalite/öncelik sırasına göre sırala
            this.availableModels = allModels.sort((a, b) => {
                return this.getModelPriority(a) - this.getModelPriority(b);
            });
            logger_1.logger.info(`🏆 En iyi model seçildi: ${this.availableModels[0]?.name || 'N/A'}`);
        }
        catch (error) {
            logger_1.logger.error("❌ Model keşfi hatası:", error);
            this.availableModels = [];
        }
    }
    /**
     * Modelleri kalite sırasına göre sıralar (düşük değer = daha iyi)
     */
    getModelPriority(model) {
        const family = model.family.toLowerCase();
        const name = model.name.toLowerCase();
        // En yeni/iyi modeller önce
        if (family.includes("gpt-4o") || name.includes("gpt-4o"))
            return 1;
        if (family.includes("claude-3.5") || family.includes("claude-3-5") || name.includes("claude-3.5"))
            return 2;
        if (family.includes("o1") || name.includes("o1"))
            return 3;
        if (family.includes("gpt-4") || name.includes("gpt-4"))
            return 4;
        if (family.includes("claude-3") || name.includes("claude-3"))
            return 5;
        if (family.includes("gemini") || name.includes("gemini"))
            return 6;
        if (family.includes("gpt-3.5") || name.includes("gpt-3.5"))
            return 7;
        return 10;
    }
    async refreshModels() {
        // Cache'yi temizle
        this.availableModels = [];
        this.initialized = false;
        // Modelleri yeniden yükle
        await this.initializeModels();
        logger_1.logger.info("✅ Copilot models refreshed successfully");
    }
    /**
     * Test Copilot connection with a real API call
     * Returns detailed diagnostics for troubleshooting
     */
    async testConnection() {
        try {
            logger_1.logger.info("🧪 Copilot bağlantı testi başlıyor...");
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
            logger_1.logger.info(`🧪 Test modeli: ${testModel.name}`);
            const testMessage = [
                vscode.LanguageModelChatMessage.User("Respond with exactly: 'AccessiMind connection test successful'")
            ];
            try {
                const response = await testModel.sendRequest(testMessage, {}, new vscode.CancellationTokenSource().token);
                let responseText = "";
                for await (const fragment of response.text) {
                    responseText += fragment;
                    if (responseText.length > 100)
                        break; // Kısa test için yeterli
                }
                logger_1.logger.info(`✅ Test yanıtı alındı: "${responseText.substring(0, 50)}..."`);
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
            }
            catch (requestError) {
                const errorMsg = requestError?.message || String(requestError);
                logger_1.logger.error("❌ Test isteği başarısız:", errorMsg);
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
        }
        catch (error) {
            logger_1.logger.error("❌ Bağlantı testi hatası:", error);
            return {
                success: false,
                message: `Bağlantı testi hatası: ${error?.message || error}`,
                details: { error: error?.message || String(error) }
            };
        }
    }
    async checkCopilotStatus() {
        try {
            logger_1.logger.info("🔍 GitHub Copilot durum kontrolü başlıyor...");
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
            logger_1.logger.info(`  📦 Copilot uzantısı: ${copilotExtension ? 'Yüklü' : 'Yüklü değil'}`);
            logger_1.logger.info(`  📦 Copilot Chat uzantısı: ${copilotChatExtension ? 'Yüklü' : 'Yüklü değil'}`);
            // 2. Uzantıları aktifleştir
            if (copilotExtension && !copilotExtension.isActive) {
                try {
                    logger_1.logger.info("  ⏳ Copilot uzantısı aktifleştiriliyor...");
                    await copilotExtension.activate();
                    logger_1.logger.info("  ✅ Copilot uzantısı aktifleştirildi");
                }
                catch (activationError) {
                    logger_1.logger.warn("  ⚠️ Copilot aktivasyon hatası:", activationError);
                }
            }
            if (copilotChatExtension && !copilotChatExtension.isActive) {
                try {
                    logger_1.logger.info("  ⏳ Copilot Chat uzantısı aktifleştiriliyor...");
                    await copilotChatExtension.activate();
                    logger_1.logger.info("  ✅ Copilot Chat uzantısı aktifleştirildi");
                }
                catch (activationError) {
                    logger_1.logger.warn("  ⚠️ Copilot Chat aktivasyon hatası:", activationError);
                }
            }
            // 3. Kısa bekle - uzantıların modelleri kaydetmesi için
            await new Promise(resolve => setTimeout(resolve, 500));
            // 4. Language Models API erişimini test et
            try {
                const testModels = await vscode.lm.selectChatModels();
                if (testModels.length > 0) {
                    logger_1.logger.info(`  ✅ ${testModels.length} language model erişilebilir`);
                    return {
                        available: true,
                        details: {
                            modelCount: testModels.length,
                            models: testModels.map(m => ({ name: m.name, family: m.family, vendor: m.vendor }))
                        }
                    };
                }
                else {
                    logger_1.logger.warn("  ⚠️ Hiç model bulunamadı");
                    return {
                        available: false,
                        reason: "Language Model bulunamadı. GitHub Copilot aboneliğinizin aktif olduğundan ve VS Code'a giriş yaptığınızdan emin olun.",
                        details: {
                            copilotInstalled: !!copilotExtension,
                            copilotChatInstalled: !!copilotChatExtension,
                            copilotActive: copilotExtension?.isActive,
                            copilotChatActive: copilotChatExtension?.isActive
                        }
                    };
                }
            }
            catch (modelError) {
                logger_1.logger.error("  ❌ Model erişim hatası:", modelError);
                return {
                    available: false,
                    reason: `Language Model API erişim hatası: ${modelError.message}. VS Code'u yeniden başlatmayı deneyin.`,
                    details: { error: modelError.message }
                };
            }
        }
        catch (error) {
            logger_1.logger.error("❌ Copilot durum kontrolü hatası:", error);
            return {
                available: false,
                reason: `Beklenmeyen hata: ${error}`
            };
        }
    }
    async selectCurrentModel() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai");
        const selectedModelId = aiConfig?.selectedModel || "";
        if (this.availableModels.length === 0) {
            return;
        }
        // Seçilen modeli bul
        let selectedModel = this.availableModels.find(model => model.id === selectedModelId ||
            model.family === selectedModelId ||
            model.name.toLowerCase().includes(selectedModelId.toLowerCase()));
        // Eğer seçilen model bulunamazsa, en iyi modeli seç
        if (!selectedModel) {
            selectedModel = this.getBestAvailableModel();
        }
        // En iyi modeli listesin başına taşı
        if (selectedModel) {
            this.availableModels = [selectedModel, ...this.availableModels.filter(m => m !== selectedModel)];
        }
    }
    getBestAvailableModel() {
        if (this.availableModels.length === 0)
            return undefined;
        // Öncelik sırası: GPT-4o > GPT-4 > Claude 3.5 > Claude 3 > Diğerleri
        const priorityModels = [
            "gpt-4o",
            "gpt-4",
            "claude-3.5",
            "claude-3",
            "gpt-3.5"
        ];
        for (const priorityModel of priorityModels) {
            const found = this.availableModels.find(model => model.name.toLowerCase().includes(priorityModel) ||
                model.family.toLowerCase().includes(priorityModel));
            if (found)
                return found;
        }
        // Hiçbiri bulunamazsa ilk modeli döndür
        return this.availableModels[0];
    }
    async getAvailableModels() {
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
        }
        catch (error) {
            logger_1.logger.error("Error getting available models:", error);
            return [];
        }
    }
    async improveCode(request) {
        const startTime = Date.now();
        try {
            // Model seçimini yenile
            if (!this.initialized) {
                await this.initializeModels();
            }
            logger_1.logger.info(`VSCodeCopilotProvider: Improving code - Available models: ${this.availableModels.length}`);
            if (this.availableModels.length === 0) {
                return {
                    success: false,
                    error: "No language models available. Please ensure GitHub Copilot is enabled and you have an active subscription.",
                    provider: "vscode-copilot"
                };
            }
            const model = this.availableModels[0];
            logger_1.logger.info(`VSCodeCopilotProvider: Using model: ${model.name} (${model.family})`);
            const prompt = this.buildWCAGPrompt(request);
            // Cache Check
            const cacheKey = this.cache.generateKey(model.name, prompt);
            if (!request.forceRefresh) {
                const cachedResponse = this.cache.get(cacheKey);
                if (cachedResponse) {
                    logger_1.logger.info(`Cache Hit (Copilot): ${model.name}`);
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
                if (chatResponse && chatResponse.usage) {
                    const usage = chatResponse.usage;
                    inputTokens = usage.promptTokens || usage.inputTokens || 0;
                    outputTokens = usage.completionTokens || usage.outputTokens || 0;
                    tokensUsed = usage.totalTokens || (inputTokens + outputTokens);
                }
                else {
                    // Fallback: estimate tokens based on content length
                    const estimate = this.estimateTokensFromContent(prompt, content.trim());
                    inputTokens = estimate.input;
                    outputTokens = estimate.output;
                    tokensUsed = estimate.total;
                }
            }
            catch (error) {
                // Fallback estimation if API doesn't provide usage data
                const estimate = this.estimateTokensFromContent(prompt, content.trim());
                inputTokens = estimate.input;
                outputTokens = estimate.output;
                tokensUsed = estimate.total;
            }
            // WCAG kriterlerini response'dan extract et
            const wcagCriteria = this.extractWCAGCriteria(content.trim());
            const response = {
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
        }
        catch (error) {
            logger_1.logger.error("❌ VS Code Copilot API error:", error);
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
    async chat(message) {
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
            logger_1.logger.info(`VSCodeCopilotProvider Chat: Using model: ${model.name} (${model.family})`);
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
        }
        catch (error) {
            logger_1.logger.error("VS Code Copilot Chat error:", error);
            return {
                success: false,
                error: `VS Code Copilot Chat error: ${error instanceof Error ? error.message : "Unknown error"}`,
                provider: "vscode-copilot"
            };
        }
    }
    async analyzeCode(request) {
        const startTime = Date.now();
        try {
            // Model seçimini yenile
            if (!this.initialized) {
                await this.initializeModels();
            }
            logger_1.logger.info(`VSCodeCopilotProvider: Analyzing code - Available models: ${this.availableModels.length}`);
            if (this.availableModels.length === 0) {
                return {
                    success: false,
                    error: "No language models available. Please ensure GitHub Copilot is enabled and you have an active subscription.",
                    provider: "vscode-copilot"
                };
            }
            const model = this.availableModels[0];
            logger_1.logger.info(`VSCodeCopilotProvider: Using model: ${model.name} (${model.family})`);
            const prompt = this.buildWCAGAnalysisPrompt(request);
            // Cache Check
            const cacheKey = this.cache.generateKey(model.name, prompt);
            if (!request.forceRefresh) {
                const cachedResponse = this.cache.get(cacheKey);
                if (cachedResponse) {
                    logger_1.logger.info(`Cache Hit (Copilot Analysis): ${model.name}`);
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
                if (chatResponse && chatResponse.usage) {
                    const usage = chatResponse.usage;
                    inputTokens = usage.promptTokens || usage.inputTokens || 0;
                    outputTokens = usage.completionTokens || usage.outputTokens || 0;
                    tokensUsed = usage.totalTokens || (inputTokens + outputTokens);
                }
                else {
                    // Fallback: estimate tokens based on content length
                    const estimate = this.estimateTokensFromContent(prompt, content.trim());
                    inputTokens = estimate.input;
                    outputTokens = estimate.output;
                    tokensUsed = estimate.total;
                }
            }
            catch (error) {
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
            const response = {
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
        }
        catch (error) {
            logger_1.logger.error("VS Code Copilot API error:", error);
            return {
                success: false,
                error: `VS Code Copilot error: ${error instanceof Error ? error.message : "Unknown error"}`,
                provider: "vscode-copilot"
            };
        }
    }
    parseAnalysisResult(content) {
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
        }
        catch (error) {
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
    async isAvailable() {
        try {
            if (!this.initialized) {
                await this.initializeModels();
            }
            logger_1.logger.info(`VSCodeCopilotProvider: Availability check - Initialized: ${this.initialized}, Available models: ${this.availableModels.length}`);
            return this.availableModels.length > 0;
        }
        catch (error) {
            logger_1.logger.error("VSCodeCopilotProvider: Error checking availability:", error);
            return false;
        }
    }
    getDisplayName() {
        return "VS Code Copilot";
    }
    estimateTokensFromContent(input, output) {
        // Advanced token estimation for VS Code Copilot
        // Based on OpenAI tokenizer patterns (GPT models)
        const estimateTokensSimple = (text) => {
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
exports.VSCodeCopilotProvider = VSCodeCopilotProvider;
class AIProviderManager {
    constructor() {
        this.providers = new Map();
        this.currentProvider = "gemini";
        this.updateStatusBarCallback = null;
        this.initializeProviders();
    }
    static getInstance() {
        if (!AIProviderManager.instance) {
            AIProviderManager.instance = new AIProviderManager();
        }
        return AIProviderManager.instance;
    }
    setStatusBarCallback(callback) {
        this.updateStatusBarCallback = callback;
    }
    initializeProviders() {
        this.providers.set("gemini", new GeminiProvider());
        this.providers.set("vscode-copilot", new VSCodeCopilotProvider());
        // Load current provider from settings
        this.loadCurrentProvider();
    }
    async loadCurrentProvider() {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiConfig = config.get("ai");
            const newProvider = aiConfig?.provider || "gemini";
            // Provider değiştiyse model seçimini güncelle
            if (this.currentProvider !== newProvider) {
                this.currentProvider = newProvider;
                await this.updateModelSelection();
            }
            else {
                this.currentProvider = newProvider;
            }
        }
        catch (error) {
            logger_1.logger.error("Provider loading error:", error);
            this.currentProvider = "gemini";
        }
    }
    async updateModelSelection() {
        if (this.currentProvider === "vscode-copilot") {
            const copilotProvider = this.providers.get("vscode-copilot");
            if (copilotProvider) {
                await copilotProvider.initializeModels();
            }
        }
        // Status bar'ı güncelle
        if (this.updateStatusBarCallback) {
            this.updateStatusBarCallback();
        }
    }
    async getCurrentProviderInstance() {
        await this.loadCurrentProvider();
        const provider = this.providers.get(this.currentProvider);
        if (!provider) {
            logger_1.logger.warn(`Provider ${this.currentProvider} not found, falling back to Gemini`);
            return this.providers.get("gemini");
        }
        return provider;
    }
    async setProvider(providerName) {
        if (!this.providers.has(providerName)) {
            return false;
        }
        const provider = this.providers.get(providerName);
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
            throw new Error(`Provider ${provider.getDisplayName()} is not available`);
        }
        this.currentProvider = providerName;
        // Save to settings using new structure
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        aiConfig.provider = providerName;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
        // Model seçimini güncelle
        await this.updateModelSelection();
        return true;
    }
    getCurrentProviderName() {
        return this.currentProvider;
    }
    getCurrentProvider() {
        return this.currentProvider;
    }
    async switchProvider(providerName) {
        const success = await this.setProvider(providerName);
        if (success) {
            logger_1.logger.info(`Provider switched to: ${providerName}`);
        }
        else {
            throw new Error(`Failed to switch to provider: ${providerName}`);
        }
    }
    getAvailableProviders() {
        const result = [];
        for (const [id, provider] of this.providers) {
            result.push({
                id,
                name: provider.getDisplayName(),
                available: false // Will be checked async when needed
            });
        }
        return result;
    }
    async improveCode(request) {
        const provider = await this.getCurrentProviderInstance();
        if (!(await provider.isAvailable())) {
            throw new Error(`Current provider ${provider.getDisplayName()} is not available`);
        }
        return await provider.improveCode(request);
    }
    async getAvailableCopilotModels() {
        const copilotProvider = this.providers.get("vscode-copilot");
        if (copilotProvider) {
            return copilotProvider.getAvailableModels();
        }
        return [];
    }
    async refreshCopilotModels() {
        const copilotProvider = this.providers.get("vscode-copilot");
        if (copilotProvider) {
            // Cache'yi temizle ve yeniden başlat
            await copilotProvider.refreshModels();
        }
    }
    async setModel(modelId) {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiModelConfig = config.get("aiModels") || {};
            aiModelConfig.selectedModel = modelId;
            await config.update("aiModels", aiModelConfig, vscode.ConfigurationTarget.Global);
            // Eğer Copilot provider ise, model seçimini güncelle
            if (this.currentProvider === "vscode-copilot") {
                const copilotProvider = this.providers.get("vscode-copilot");
                if (copilotProvider) {
                    await copilotProvider.initializeModels();
                }
            }
            // Status bar'ı güncelle
            if (this.updateStatusBarCallback) {
                this.updateStatusBarCallback();
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error("Model ayarlama hatası:", error);
            return false;
        }
    }
}
exports.AIProviderManager = AIProviderManager;
//# sourceMappingURL=aiProvider.js.map