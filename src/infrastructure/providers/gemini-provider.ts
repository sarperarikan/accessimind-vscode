/**
 * gemini-provider.ts
 * Google Gemini REST API provider implementation.
 * SRP: Only responsible for Gemini-specific HTTP communication.
 */
import * as vscode from "vscode";
import * as https from "https";
import * as zlib from "zlib";
import { RequestCache } from "../../utils/requestCache";
import { logger } from "../../utils/logger";
import {
    OptimizedHttpAgent,
    createOptimizedRequestOptions,
    PromptOptimizer,
    ApiMetricsCollector,
} from "../../utils/apiOptimizer";
import { AIProvider, AIResponse, WCAGRequest } from "./ai-provider.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeminiModelDescriptor {
    id: string;
    name: string;
    description: string;
    speed: "fast" | "medium";
    quality: "high" | "very-high";
    recommended?: boolean;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
}

interface GeminiRawCallResult {
    content: string;
    tokensUsed?: number;
    inputTokens?: number;
    outputTokens?: number;
    usageMetadata?: Record<string, unknown>;
    responseTime: number;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class GeminiProvider extends AIProvider {
    private apiKey: string = "";
    private readonly baseUrl =
        "https://generativelanguage.googleapis.com/v1beta/models";
    private readonly cache: RequestCache<AIResponse>;

    constructor() {
        super();
        this.cache = RequestCache.getInstance<AIResponse>("gemini");
        this.loadApiKey();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    async isAvailable(): Promise<boolean> {
        await this.loadApiKey();
        return this.apiKey.length > 0;
    }

    getDisplayName(): string {
        return "Google Gemini";
    }

    async isApiKeyConfigured(): Promise<boolean> {
        await this.loadApiKey();
        return this.apiKey.length > 0;
    }

    async testConnection(): Promise<{
        success: boolean;
        message?: string;
        model?: string;
    }> {
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

    async getAvailableModels(): Promise<GeminiModelDescriptor[]> {
        await this.loadApiKey();
        if (!this.apiKey) {
            logger.warn("No API key configured, returning default models");
            return this.getDefaultModels();
        }
        try {
            return await this.fetchModelsFromApi();
        } catch (error) {
            logger.error("Failed to fetch Gemini models from API:", error);
            return this.getDefaultModels();
        }
    }

    async chat(message: string): Promise<AIResponse> {
        await this.loadApiKey();
        const model = await this.getDefaultModel();
        try {
            const result = await this.makeApiCall(model, message, "chat");
            return {
                success: true,
                content: result.content,
                provider: "gemini",
                model,
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message,
                provider: "gemini",
            };
        }
    }

    async improveCode(request: WCAGRequest): Promise<AIResponse> {
        await this.loadApiKey();
        const startTime = Date.now();

        if (!this.apiKey) {
            return {
                success: false,
                error: "Gemini API key not found. Please configure it in settings.",
                provider: "gemini",
            };
        }

        const model = await this.getDefaultModel();
        const prompt = this.buildWCAGPrompt(request);
        const cacheKey = this.cache.generateKey(model, prompt);

        if (!request.forceRefresh) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.info(`Cache Hit: ${model}`);
                return cached;
            }
        }

        try {
            const result = await this.makeApiCall(model, prompt, "improve");
            const responseTime = Date.now() - startTime;
            const wcagCriteria = this.extractWCAGCriteria(result.content);

            const aiResponse: AIResponse = {
                success: true,
                content: result.content,
                improvedCode: result.content,
                summary: "WCAG improvements applied",
                wcagCriteria,
                tokensUsed: result.tokensUsed,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                responseTime,
                model,
                provider: "gemini",
                usageMetadata: result.usageMetadata,
            };

            this.cache.set(cacheKey, aiResponse);
            return aiResponse;
        } catch (error) {
            logger.error("Gemini improveCode error:", error);
            return {
                success: false,
                error: `Gemini error: ${(error as Error).message}`,
                provider: "gemini",
            };
        }
    }

    async analyzeCode(request: WCAGRequest): Promise<AIResponse> {
        await this.loadApiKey();
        const startTime = Date.now();
        const model = await this.getDefaultModel();
        const prompt = this.buildWCAGAnalysisPrompt(request);
        const cacheKey = this.cache.generateKey(model, prompt);

        if (!request.forceRefresh) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.info(`Cache Hit: ${model}`);
                return cached;
            }
        }

        try {
            const result = await this.makeApiCall(model, prompt, "analyze");
            const responseTime = Date.now() - startTime;
            const wcagCriteria = this.extractWCAGCriteria(result.content);
            const analysisData = this.parseAnalysisResult(result.content);

            const aiResponse: AIResponse = {
                success: true,
                content: result.content,
                summary: analysisData.summary,
                wcagCriteria:
                    wcagCriteria.length > 0 ? wcagCriteria : analysisData.issues,
                tokensUsed: result.tokensUsed,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                responseTime,
                model,
                provider: "gemini",
                usageMetadata: result.usageMetadata,
            };

            this.cache.set(cacheKey, aiResponse);
            return aiResponse;
        } catch (error) {
            return {
                success: false,
                error: `Gemini analysis error: ${(error as Error).message}`,
                provider: "gemini",
            };
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private async loadApiKey(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiConfig = config.get("ai") as Record<string, unknown>;
            this.apiKey = (aiConfig?.apiKey as string) || "";
        } catch (error) {
            logger.error("Error loading API key:", error);
        }
    }

    private async getDefaultModel(): Promise<string> {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiModelConfig = config.get("aiModels") as Record<string, unknown>;
            return (aiModelConfig?.selectedModel as string) || "gemini-2.5-flash";
        } catch {
            return "gemini-2.5-flash";
        }
    }

    private parseAnalysisResult(content: string): {
        summary: string;
        issues: string[];
    } {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    summary: parsed.summary || "Analysis completed",
                    issues: parsed.issues || [],
                };
            }
        } catch {
            // fall through
        }
        return { summary: "Analysis completed", issues: [] };
    }

    private formatModelName(modelId: string): string {
        return modelId
            .replace("gemini-", "Gemini ")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
    }

    private async fetchModelsFromApi(): Promise<GeminiModelDescriptor[]> {
        const url = new URL(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
        );

        const response = await new Promise<Record<string, unknown>>(
            (resolve, reject) => {
                const req = https.request(
                    {
                        hostname: url.hostname,
                        port: 443,
                        path: url.pathname + url.search,
                        method: "GET",
                        headers: { "Content-Type": "application/json" },
                    },
                    (res) => {
                        let data = "";
                        res.on("data", (chunk) => (data += chunk));
                        res.on("end", () => {
                            try {
                                if (res.statusCode && res.statusCode >= 400) {
                                    reject(new Error(`API Error ${res.statusCode}`));
                                    return;
                                }
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    }
                );
                req.on("error", reject);
                req.end();
            }
        );

        const models = response.models as Array<Record<string, unknown>>;
        if (!Array.isArray(models)) {
            return this.getDefaultModels();
        }

        const generative = models
            .filter(
                (m) =>
                    (m.supportedGenerationMethods as string[])?.includes(
                        "generateContent"
                    ) && (m.name as string)?.includes("gemini")
            )
            .sort((a, b) => {
                const an = ((a.name as string) || "").toLowerCase();
                const bn = ((b.name as string) || "").toLowerCase();
                if (an.includes("2.5") && !bn.includes("2.5")) return -1;
                if (!an.includes("2.5") && bn.includes("2.5")) return 1;
                if (an.includes("2.0") && !bn.includes("2.0")) return -1;
                if (!an.includes("2.0") && bn.includes("2.0")) return 1;
                if (an.includes("flash") && !bn.includes("flash")) return -1;
                if (!an.includes("flash") && bn.includes("flash")) return 1;
                return 0;
            });

        logger.info(`Fetched ${generative.length} Gemini models from API`);

        return generative.map((m, idx) => {
            const modelId = ((m.name as string) || "").replace("models/", "");
            const displayName =
                (m.displayName as string) || this.formatModelName(modelId);
            return {
                id: modelId,
                name: displayName,
                description:
                    (m.description as string) ||
                    `${displayName} - ${m.inputTokenLimit || "Unknown"} input tokens`,
                speed: modelId.includes("flash") ? "fast" : "medium",
                quality:
                    modelId.includes("pro") || modelId.includes("2.5")
                        ? "very-high"
                        : "high",
                recommended: idx === 0,
                inputTokenLimit: m.inputTokenLimit as number,
                outputTokenLimit: m.outputTokenLimit as number,
            };
        });
    }

    private getDefaultModels(): GeminiModelDescriptor[] {
        return [
            {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
                description: "Latest & fastest - Best for quick improvements",
                speed: "fast",
                quality: "very-high",
                recommended: true,
            },
            {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                description: "Most capable - Best for complex analysis",
                speed: "medium",
                quality: "very-high",
            },
            {
                id: "gemini-2.0-flash",
                name: "Gemini 2.0 Flash",
                description: "Fast and reliable - Good balance",
                speed: "fast",
                quality: "high",
            },
            {
                id: "gemini-1.5-flash",
                name: "Gemini 1.5 Flash",
                description: "Stable performance",
                speed: "fast",
                quality: "high",
            },
            {
                id: "gemini-1.5-pro",
                name: "Gemini 1.5 Pro",
                description: "High quality for complex tasks",
                speed: "medium",
                quality: "very-high",
            },
        ];
    }

    /**
     * Core HTTP call to the Gemini generateContent endpoint.
     * Handles gzip decompression, rate-limit errors, and MAX_TOKENS detection.
     */
    private async makeApiCall(
        model: string,
        prompt: string,
        mode: string
    ): Promise<GeminiRawCallResult> {
        const startTime = Date.now();
        const metrics = ApiMetricsCollector.getInstance();
        const httpAgent = OptimizedHttpAgent.getInstance();

        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") as Record<string, unknown>;
        // 65536 default: Gemini 2.0/2.5 supports up to 65536 output tokens.
        // Previous default of 8192 caused truncated output on large files.
        const maxTokens = (aiConfig?.maxTokens as number) || 65536;
        const temperature = (aiConfig?.temperature as number) || 0.7;
        const timeout = (aiConfig?.timeout as number) || 120000;
        const retryCount = (aiConfig?.retryCount as number) || 2;

        const optimizedPrompt = PromptOptimizer.truncateCode(prompt, 200000);
        const estimatedTokens = PromptOptimizer.estimateTokens(optimizedPrompt);
        logger.info(
            `API call - Model: ${model}, Mode: ${mode}, Est. tokens: ${estimatedTokens}`
        );

        const requestBody = {
            contents: [{ parts: [{ text: optimizedPrompt }] }],
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
                topP: 0.8,
                topK: 40,
            },
        };

        const postData = JSON.stringify(requestBody);
        const url = new URL(
            `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`
        );

        const baseOptions: https.RequestOptions = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
            },
        };

        const options = createOptimizedRequestOptions(baseOptions, {
            timeout,
            enableCompression: true,
        });

        const executeRequest = async (): Promise<GeminiRawCallResult> =>
            new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    const chunks: Buffer[] = [];
                    res.on("data", (chunk: Buffer) => chunks.push(chunk));
                    res.on("end", () => {
                        try {
                            const buffer = Buffer.concat(chunks);
                            const encoding = res.headers["content-encoding"];
                            let data: string;
                            if (encoding === "gzip") {
                                data = zlib.gunzipSync(buffer).toString("utf-8");
                            } else if (encoding === "deflate") {
                                data = zlib.inflateSync(buffer).toString("utf-8");
                            } else {
                                data = buffer.toString("utf-8");
                            }

                            if (res.statusCode && res.statusCode >= 400) {
                                const errorBody = JSON.parse(data);
                                const errorMsg =
                                    (errorBody?.error?.message as string) ||
                                    `API Error ${res.statusCode}`;
                                if (res.statusCode === 429) {
                                    reject(
                                        new Error("Rate limit exceeded. Please wait and try again.")
                                    );
                                    return;
                                }
                                reject(new Error(errorMsg));
                                return;
                            }

                            const responseData = JSON.parse(data);

                            if (!responseData.candidates?.[0]?.content) {
                                const blockReason =
                                    responseData.promptFeedback?.blockReason;
                                if (blockReason) {
                                    reject(new Error(`Content blocked: ${blockReason}`));
                                    return;
                                }
                                reject(
                                    new Error("Invalid API response - no content returned")
                                );
                                return;
                            }

                            // Detect truncated output
                            const finishReason =
                                responseData.candidates[0].finishReason as string;
                            if (finishReason === "MAX_TOKENS") {
                                logger.warn(
                                    `⚠️ Gemini output truncated: finishReason=MAX_TOKENS (maxOutputTokens=${maxTokens}).`
                                );
                                reject(
                                    new Error(
                                        `Gemini output was truncated because the response exceeded the maximum token limit (${maxTokens} tokens). ` +
                                        `Please try with a smaller file or selected text only.`
                                    )
                                );
                                return;
                            }

                            const content = (
                                responseData.candidates[0].content.parts as Array<{
                                    text?: string;
                                }>
                            )
                                .map((p) => p.text || "")
                                .join("");

                            const usage =
                                (responseData.usageMetadata as Record<string, unknown>) || {};
                            const responseTime = Date.now() - startTime;

                            metrics.recordRequest(
                                responseTime,
                                (usage.totalTokenCount as number) || 0,
                                false
                            );
                            logger.info(
                                `API response received in ${responseTime}ms, tokens: ${usage.totalTokenCount || "N/A"}, finishReason: ${finishReason}`
                            );

                            resolve({
                                content,
                                tokensUsed: usage.totalTokenCount as number,
                                inputTokens: usage.promptTokenCount as number,
                                outputTokens: usage.candidatesTokenCount as number,
                                usageMetadata: usage,
                                responseTime,
                            });
                        } catch (error) {
                            metrics.recordError();
                            reject(error);
                        }
                    });
                });

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

        return httpAgent.retryWithBackoff(executeRequest, retryCount, 1000);
    }
}
