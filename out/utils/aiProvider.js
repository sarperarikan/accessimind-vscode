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
const geminiApi_1 = require("./geminiApi");
const logger_1 = require("./logger");
class AIProvider {
    /**
     * Generates a conversational AI response for chat-based interactions.
     * @param message User's chat message
     * @returns AIResponse with the chat reply
     */
    async chat(message) {
        throw new Error("Chat not implemented for this provider.");
    }
}
exports.AIProvider = AIProvider;
class GeminiProvider extends AIProvider {
    constructor() {
        super();
        this.geminiApi = geminiApi_1.GeminiAPI.getInstance();
    }
    /**
     * Generates a conversational AI response for chat-based interactions using Gemini API.
     * @param message User's chat message
     * @returns AIResponse with the chat reply
     */
    async chat(message) {
        const response = await this.geminiApi.chat(message);
        return {
            success: true,
            content: response.content,
            provider: "gemini"
        };
    }
    async improveCode(request) {
        const geminiRequest = {
            code: request.code,
            fileType: request.fileType,
            language: request.language,
            selectedText: request.selectedText,
            mode: "edit",
            wcagLevel: request.wcagLevel,
            includeComments: request.includeComments
        };
        const response = await this.geminiApi.improveCode(geminiRequest);
        // WCAG kriterlerini response'dan extract et
        const wcagCriteria = this.extractWCAGCriteria(response.content || "");
        return {
            success: response.success,
            content: response.content,
            improvedCode: response.content, // Gemini'de content improved code'dur
            summary: "WCAG improvements applied",
            wcagCriteria: wcagCriteria,
            error: response.error,
            tokensUsed: response.tokensUsed,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            responseTime: response.responseTime,
            model: response.model,
            provider: "gemini",
            usageMetadata: response.usageMetadata
        };
    }
    async analyzeCode(request) {
        // Create analysis request using the same structure as improvement
        const geminiRequest = {
            code: request.code,
            fileType: request.fileType,
            language: request.language,
            selectedText: request.selectedText,
            mode: "ask", // Use ask mode for analysis
            wcagLevel: request.wcagLevel,
            includeComments: request.includeComments
        };
        const response = await this.geminiApi.improveCode(geminiRequest);
        // WCAG kriterlerini response'dan extract et
        const wcagCriteria = this.extractWCAGCriteria(response.content || "");
        // Parse the analysis result to extract structured data
        const analysisData = this.parseAnalysisResult(response.content || "");
        return {
            success: response.success,
            content: response.content,
            summary: analysisData.summary,
            wcagCriteria: wcagCriteria.length > 0 ? wcagCriteria : analysisData.issues,
            error: response.error,
            tokensUsed: response.tokensUsed,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            responseTime: response.responseTime,
            model: response.model,
            provider: "gemini",
            usageMetadata: response.usageMetadata
        };
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
        const strings = langMap[responseLanguage];
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
    async isAvailable() {
        return this.geminiApi.isApiKeyConfigured();
    }
    getDisplayName() {
        return "Google Gemini";
    }
}
exports.GeminiProvider = GeminiProvider;
class VSCodeCopilotProvider extends AIProvider {
    constructor() {
        super();
        this.availableModels = [];
        this.initialized = false;
    }
    async initializeModels() {
        try {
            // GitHub Copilot durumunu kontrol et
            const copilotStatus = await this.checkCopilotStatus();
            if (copilotStatus.available) {
                // Dinamik olarak mevcut modelleri çek
                await this.fetchAvailableModels();
                // Eğer hiç model bulunamazsa, özel seçimler dene
                if (this.availableModels.length === 0) {
                    await this.fallbackModelSelection();
                }
            }
            else {
                logger_1.logger.warn("GitHub Copilot not available:", copilotStatus.reason);
                this.availableModels = [];
            }
            // Seçilen modeli al ve eşleştir
            await this.selectCurrentModel();
            this.initialized = true;
            logger_1.logger.info(`Copilot models initialized: ${this.availableModels.length} models found`, {
                models: this.availableModels.map(m => ({
                    name: m.name,
                    family: m.family,
                    vendor: m.vendor,
                    maxTokens: m.maxInputTokens
                }))
            });
        }
        catch (error) {
            logger_1.logger.error("VS Code Language Models initialization error:", error);
            this.availableModels = [];
        }
    }
    async fetchAvailableModels() {
        const modelSources = [
            // Tüm mevcut modeller
            () => vscode.lm.selectChatModels(),
            // Copilot vendor modelleri
            () => vscode.lm.selectChatModels({ vendor: "copilot" }),
            // OpenAI family modelleri
            () => vscode.lm.selectChatModels({ family: "gpt-4o" }),
            () => vscode.lm.selectChatModels({ family: "gpt-4" }),
            () => vscode.lm.selectChatModels({ family: "gpt-3.5-turbo" }),
            // Claude family modelleri
            () => vscode.lm.selectChatModels({ family: "claude-3-5-sonnet" }),
            () => vscode.lm.selectChatModels({ family: "claude-3-sonnet" }),
            () => vscode.lm.selectChatModels({ family: "claude-3-haiku" }),
            // ID bazlı seçimler
            () => vscode.lm.selectChatModels({ id: "copilot-gpt-4o" }),
            () => vscode.lm.selectChatModels({ id: "copilot-gpt-4" }),
            () => vscode.lm.selectChatModels({ id: "copilot-claude-3.5-sonnet" })
        ];
        const allModels = new Map();
        for (const getModels of modelSources) {
            try {
                const models = await getModels();
                models.forEach(model => {
                    const key = `${model.vendor}-${model.family}-${model.name}`;
                    if (!allModels.has(key)) {
                        allModels.set(key, model);
                    }
                });
            }
            catch (error) {
                // Sessizce geç, bazı seçimler başarısız olabilir
                logger_1.logger.debug("Model source failed:", error);
            }
        }
        this.availableModels = Array.from(allModels.values());
        // Modelleri kalite/öncelik sırasına göre sırala
        this.availableModels.sort((a, b) => {
            const getPriority = (model) => {
                const family = model.family.toLowerCase();
                if (family.includes("gpt-4o"))
                    return 1;
                if (family.includes("claude-3.5"))
                    return 2;
                if (family.includes("gpt-4"))
                    return 3;
                if (family.includes("claude-3"))
                    return 4;
                if (family.includes("gpt-3.5"))
                    return 5;
                return 10;
            };
            return getPriority(a) - getPriority(b);
        });
    }
    async fallbackModelSelection() {
        logger_1.logger.info("No models found, trying fallback methods...");
        const fallbackMethods = [
            // Tüm mevcut modelleri al (filtre olmadan)
            async () => {
                const allModels = await vscode.lm.selectChatModels();
                return allModels;
            },
            // Sadece Copilot uzantısından modelleri al
            async () => {
                try {
                    const copilotExt = vscode.extensions.getExtension("GitHub.copilot");
                    if (copilotExt?.isActive) {
                        return await vscode.lm.selectChatModels();
                    }
                }
                catch (error) {
                    logger_1.logger.debug("Copilot extension check failed:", error);
                }
                return [];
            }
        ];
        for (const method of fallbackMethods) {
            try {
                const models = await method();
                if (models.length > 0) {
                    this.availableModels = models;
                    logger_1.logger.info(`Fallback successful: ${models.length} models found`);
                    break;
                }
            }
            catch (error) {
                logger_1.logger.debug("Fallback method failed:", error);
            }
        }
    }
    async refreshModels() {
        // Cache'yi temizle
        this.availableModels = [];
        this.initialized = false;
        // Modelleri yeniden yükle
        await this.initializeModels();
        logger_1.logger.info("Copilot models refreshed successfully");
    }
    async checkCopilotStatus() {
        try {
            // GitHub Copilot uzantısının yüklü ve aktif olup olmadığını kontrol et
            const copilotExtension = vscode.extensions.getExtension("GitHub.copilot");
            if (!copilotExtension) {
                return { available: false, reason: "GitHub Copilot extension not installed" };
            }
            if (!copilotExtension.isActive) {
                try {
                    await copilotExtension.activate();
                }
                catch (error) {
                    return { available: false, reason: "Failed to activate GitHub Copilot extension" };
                }
            }
            // GitHub Copilot Chat uzantısını da kontrol et
            const copilotChatExtension = vscode.extensions.getExtension("GitHub.copilot-chat");
            if (copilotChatExtension && !copilotChatExtension.isActive) {
                try {
                    await copilotChatExtension.activate();
                }
                catch (error) {
                    logger_1.logger.warn("Failed to activate GitHub Copilot Chat extension:", error);
                }
            }
            // Language Models API erişimini test et
            try {
                const testModels = await vscode.lm.selectChatModels();
                if (testModels.length > 0) {
                    return { available: true };
                }
                else {
                    return { available: false, reason: "No language models available - subscription may be inactive" };
                }
            }
            catch (error) {
                return { available: false, reason: "Cannot access language models - authentication may be required" };
            }
        }
        catch (error) {
            logger_1.logger.error("Copilot status check error:", error);
            return { available: false, reason: `Error checking Copilot status: ${error}` };
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
            return {
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
            return {
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
        const strings = langMap[responseLanguage];
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