/**
 * ollama-provider.ts
 * Ollama local LLM provider implementation.
 * SRP: Only responsible for Ollama HTTP communication.
 */
import * as https from "https";
import * as http from "http";
import { RequestCache } from "../../utils/requestCache";
import { logger } from "../../utils/logger";
import * as vscode from "vscode";
import { AIProvider, AIResponse, WCAGRequest } from "./ai-provider.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OllamaModelDescriptor {
    id: string;
    name: string;
    description: string;
    speed: "fast";
    quality: "medium";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class OllamaProvider extends AIProvider {
    private readonly cache: RequestCache<AIResponse>;

    constructor() {
        super();
        this.cache = RequestCache.getInstance<AIResponse>("ollama");
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    async isAvailable(): Promise<boolean> {
        try {
            const url = new URL(`${this.getBaseUrl()}/api/tags`);
            const response = await this.makeGetRequest(url);
            return !!response;
        } catch {
            return false;
        }
    }

    getDisplayName(): string {
        return "Ollama (Local)";
    }

    async getAvailableModels(): Promise<OllamaModelDescriptor[]> {
        try {
            const url = new URL(`${this.getBaseUrl()}/api/tags`);
            const response = await this.makeGetRequest(url);
            if (response?.models && Array.isArray(response.models)) {
                return (response.models as Array<Record<string, unknown>>).map(
                    (m) => ({
                        id: m.name as string,
                        name: m.name as string,
                        description: `${(m.details as Record<string, unknown>)?.family || "Ollama"
                            } - ${this.formatSize(m.size as number)}`,
                        speed: "fast" as const,
                        quality: "medium" as const,
                    })
                );
            }
        } catch (error) {
            logger.error("Error fetching Ollama models:", error);
        }
        return [];
    }

    async improveCode(request: WCAGRequest): Promise<AIResponse> {
        const startTime = Date.now();
        const model = this.getModel();
        const prompt = this.buildWCAGPrompt(request);
        const cacheKey = this.cache.generateKey(model, prompt);

        if (!request.forceRefresh) {
            const cached = this.cache.get(cacheKey);
            if (cached) return cached;
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
                provider: "ollama",
            };

            this.cache.set(cacheKey, aiResponse);
            return aiResponse;
        } catch (error) {
            return {
                success: false,
                error: `Ollama error: ${error instanceof Error ? error.message : String(error)}`,
                provider: "ollama",
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
                provider: "ollama",
            };
        } catch (error) {
            return {
                success: false,
                error: `Ollama analysis error: ${error instanceof Error ? error.message : String(error)}`,
                provider: "ollama",
            };
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private getBaseUrl(): string {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiConfig = config.get("ai") as Record<string, unknown>;
            return (aiConfig?.ollamaUrl as string) || "http://localhost:11434";
        } catch {
            return "http://localhost:11434";
        }
    }

    private getModel(): string {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiModelConfig = config.get("aiModels") as Record<string, unknown>;
            return (aiModelConfig?.selectedModel as string) || "llama3";
        } catch {
            return "llama3";
        }
    }

    private formatSize(bytes: number): string {
        if (!bytes) return "Unknown size";
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb < 1) {
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
        return `${gb.toFixed(1)} GB`;
    }

    private makeGetRequest(url: URL): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const lib = url.protocol === "https:" ? https : http;
            lib
                .get(url as unknown as string, (res) => {
                    let data = "";
                    res.on("data", (chunk) => (data += chunk));
                    res.on("end", () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    });
                })
                .on("error", reject);
        });
    }

    private makeApiCall(model: string, prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const baseUrl = this.getBaseUrl();
            const url = new URL(`${baseUrl}/api/generate`);
            const lib = url.protocol === "https:" ? https : http;

            const postData = JSON.stringify({ model, prompt, stream: false });

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === "https:" ? 443 : 80),
                path: url.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                },
            };

            const req = lib.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(
                                new Error(`Ollama API Error: ${res.statusCode} - ${data}`)
                            );
                            return;
                        }
                        const response = JSON.parse(data);
                        resolve((response.response as string) || "");
                    } catch {
                        reject(new Error(`Failed to parse Ollama response: ${data}`));
                    }
                });
            });

            req.on("error", reject);
            req.write(postData);
            req.end();
        });
    }
}
