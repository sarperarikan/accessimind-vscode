/**
 * copilot-provider.ts
 * VS Code Language Model API (GitHub Copilot) provider implementation.
 * SRP: Only responsible for Copilot-specific model discovery and request handling.
 */
import * as vscode from "vscode";
import { RequestCache } from "../../utils/requestCache";
import { logger } from "../../utils/logger";
import { AIProvider, AIResponse, WCAGRequest } from "./ai-provider.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CopilotStatus {
    available: boolean;
    reason?: string;
    details?: Record<string, unknown>;
}

interface TokenEstimate {
    input: number;
    output: number;
    total: number;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class VSCodeCopilotProvider extends AIProvider {
    private availableModels: vscode.LanguageModelChat[] = [];
    private initialized = false;
    private readonly cache: RequestCache<AIResponse>;
    private readonly modelChangeDisposable: vscode.Disposable;

    constructor() {
        super();
        this.cache = RequestCache.getInstance<AIResponse>("vscode-copilot");
        this.modelChangeDisposable = vscode.lm.onDidChangeChatModels(() => {
            logger.info("📢 VS Code Language Models changed, resetting cache...");
            this.initialized = false;
            this.availableModels = [];
        });
    }

    dispose(): void {
        this.modelChangeDisposable.dispose();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    async isAvailable(): Promise<boolean> {
        try {
            if (!this.initialized) {
                await this.initializeModels();
            }
            logger.info(
                `VSCodeCopilotProvider: Availability check - models: ${this.availableModels.length}`
            );
            return this.availableModels.length > 0;
        } catch (error) {
            logger.error("VSCodeCopilotProvider: Error checking availability:", error);
            return false;
        }
    }

    getDisplayName(): string {
        return "VS Code Copilot";
    }

    async initializeModels(): Promise<void> {
        try {
            logger.info("🔄 Initializing Copilot models...");
            const status = await this.checkCopilotStatus();
            if (status.available) {
                await this.fetchAvailableModels();
            } else {
                logger.warn("⚠️ GitHub Copilot unavailable:", status.reason);
                this.availableModels = [];
            }
            await this.selectCurrentModel();
            this.initialized = true;
            logger.info(
                this.availableModels.length > 0
                    ? `✅ Copilot initialized: ${this.availableModels.length} models`
                    : "⚠️ Copilot initialized but no models found"
            );
        } catch (error) {
            logger.error("❌ VS Code Language Models init error:", error);
            this.availableModels = [];
            this.initialized = true;
        }
    }

    async refreshModels(): Promise<void> {
        this.availableModels = [];
        this.initialized = false;
        await this.initializeModels();
        logger.info("✅ Copilot models refreshed");
    }

    async testConnection(): Promise<{
        success: boolean;
        message: string;
        details?: Record<string, unknown>;
    }> {
        try {
            logger.info("🧪 Copilot connection test starting...");
            const status = await this.checkCopilotStatus();
            if (!status.available) {
                return {
                    success: false,
                    message: status.reason || "Copilot connection failed",
                    details: status.details,
                };
            }

            if (!this.initialized || this.availableModels.length === 0) {
                await this.initializeModels();
            }

            if (this.availableModels.length === 0) {
                return {
                    success: false,
                    message: "No models found. Is your GitHub Copilot subscription active?",
                    details: { initialized: this.initialized },
                };
            }

            const testModel = this.availableModels[0];
            const testMessage = [
                vscode.LanguageModelChatMessage.User(
                    "Respond with exactly: 'AccessiMind connection test successful'"
                ),
            ];

            try {
                const response = await testModel.sendRequest(
                    testMessage,
                    {},
                    new vscode.CancellationTokenSource().token
                );
                let responseText = "";
                for await (const fragment of response.text) {
                    responseText += fragment;
                    if (responseText.length > 100) break;
                }
                return {
                    success: true,
                    message: `Connection successful! Model: ${testModel.name}`,
                    details: {
                        model: testModel.name,
                        family: testModel.family,
                        vendor: testModel.vendor,
                        availableModels: this.availableModels.length,
                        responsePreview: responseText.substring(0, 100),
                    },
                };
            } catch (requestError: unknown) {
                const errorMsg =
                    (requestError as Error)?.message || String(requestError);
                if (
                    errorMsg.includes("consent") ||
                    errorMsg.includes("permission")
                ) {
                    return {
                        success: false,
                        message:
                            "Copilot usage permission denied. Please open a Copilot Chat window in VS Code and accept the permission request.",
                        details: {
                            model: testModel.name,
                            error: "consent_required",
                            originalError: errorMsg,
                        },
                    };
                }
                return {
                    success: false,
                    message: `Test request failed: ${errorMsg}`,
                    details: { model: testModel.name, error: errorMsg },
                };
            }
        } catch (error: unknown) {
            logger.error("❌ Connection test error:", error);
            return {
                success: false,
                message: `Connection test error: ${(error as Error)?.message || error}`,
                details: { error: (error as Error)?.message || String(error) },
            };
        }
    }

    async getAvailableModels(): Promise<
        Array<{
            id: string;
            name: string;
            family: string;
            description?: string;
            vendor?: string;
        }>
    > {
        try {
            if (this.availableModels.length === 0) {
                await this.initializeModels();
            }
            return this.availableModels.map((m) => ({
                id: m.id || m.family || m.name,
                name: m.name,
                family: m.family,
                vendor: m.vendor,
                description: `${m.vendor} - ${m.family} (Max tokens: ${m.maxInputTokens || "Unknown"})`,
            }));
        } catch (error) {
            logger.error("Error getting available models:", error);
            return [];
        }
    }

    async improveCode(request: WCAGRequest): Promise<AIResponse> {
        const startTime = Date.now();
        if (!this.initialized) {
            await this.initializeModels();
        }

        if (this.availableModels.length === 0) {
            return {
                success: false,
                error: "No language models available. Please ensure GitHub Copilot is enabled and you have an active subscription.",
                provider: "vscode-copilot",
            };
        }

        const model = this.availableModels[0];
        logger.info(
            `VSCodeCopilotProvider: Using model: ${model.name} (${model.family})`
        );
        const prompt = this.buildWCAGPrompt(request);
        const cacheKey = this.cache.generateKey(model.name, prompt);

        if (!request.forceRefresh) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.info(`Cache Hit (Copilot): ${model.name}`);
                return cached;
            }
        }

        try {
            const content = await this.sendRequest(model, prompt);
            const responseTime = Date.now() - startTime;
            const estimate = this.estimateTokens(prompt, content);
            const wcagCriteria = this.extractWCAGCriteria(content);

            const response: AIResponse = {
                success: true,
                content,
                improvedCode: content,
                summary: "WCAG improvements applied via VS Code Copilot",
                wcagCriteria,
                tokensUsed: estimate.total,
                inputTokens: estimate.input,
                outputTokens: estimate.output,
                responseTime,
                model: model.name,
                provider: "vscode-copilot",
                usageMetadata: {
                    estimatedTokens: true,
                    model: model.name,
                    family: model.family,
                },
            };

            this.cache.set(cacheKey, response);
            return response;
        } catch (error: unknown) {
            return this.handleCopilotError(error);
        }
    }

    async analyzeCode(request: WCAGRequest): Promise<AIResponse> {
        const startTime = Date.now();
        if (!this.initialized) {
            await this.initializeModels();
        }

        if (this.availableModels.length === 0) {
            return {
                success: false,
                error: "No language models available. Please ensure GitHub Copilot is enabled.",
                provider: "vscode-copilot",
            };
        }

        const model = this.availableModels[0];
        const prompt = this.buildWCAGAnalysisPrompt(request);
        const cacheKey = this.cache.generateKey(model.name, prompt);

        if (!request.forceRefresh) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.info(`Cache Hit (Copilot Analysis): ${model.name}`);
                return cached;
            }
        }

        try {
            const content = await this.sendRequest(model, prompt);
            const responseTime = Date.now() - startTime;
            const estimate = this.estimateTokens(prompt, content);
            const wcagCriteria = this.extractWCAGCriteria(content);
            const analysisData = this.parseAnalysisResult(content);

            const response: AIResponse = {
                success: true,
                content,
                summary: analysisData.summary,
                wcagCriteria,
                tokensUsed: estimate.total,
                inputTokens: estimate.input,
                outputTokens: estimate.output,
                responseTime,
                model: model.name,
                provider: "vscode-copilot",
                usageMetadata: {
                    estimatedTokens: true,
                    model: model.name,
                    family: model.family,
                },
            };

            this.cache.set(cacheKey, response);
            return response;
        } catch (error) {
            logger.error("VS Code Copilot API error:", error);
            return {
                success: false,
                error: `VS Code Copilot error: ${error instanceof Error ? error.message : "Unknown error"}`,
                provider: "vscode-copilot",
            };
        }
    }

    async chat(message: string): Promise<AIResponse> {
        if (!this.initialized) {
            await this.initializeModels();
        }
        if (this.availableModels.length === 0) {
            return {
                success: false,
                error: "No language models available.",
                provider: "vscode-copilot",
            };
        }

        const model = this.availableModels[0];
        const chatPrompt = `You are AccessiMind, an AI assistant specializing in web accessibility and WCAG 2.2 standards. Help the user with their accessibility-related questions. Be helpful, concise, and provide practical advice.\n\nUser message: ${message}`;

        try {
            const content = await this.sendRequest(model, chatPrompt);
            return { success: true, content, provider: "vscode-copilot", model: model.name };
        } catch (error) {
            logger.error("VS Code Copilot Chat error:", error);
            return {
                success: false,
                error: `VS Code Copilot Chat error: ${error instanceof Error ? error.message : "Unknown error"}`,
                provider: "vscode-copilot",
            };
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private async sendRequest(
        model: vscode.LanguageModelChat,
        prompt: string
    ): Promise<string> {
        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        const chatResponse = await model.sendRequest(
            messages,
            {},
            new vscode.CancellationTokenSource().token
        );
        let content = "";
        for await (const fragment of chatResponse.text) {
            content += fragment;
        }
        return content.trim();
    }

    private handleCopilotError(error: unknown): AIResponse {
        logger.error("❌ VS Code Copilot API error:", error);
        const msg = (error as Error)?.message || String(error);

        if (msg.includes("consent") || msg.includes("permission") || msg.includes("denied")) {
            return {
                success: false,
                error: "Copilot usage permission required. Open a Copilot Chat window in VS Code and accept the permission request.",
                provider: "vscode-copilot",
            };
        }
        if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many")) {
            return {
                success: false,
                error: "Copilot rate limit exceeded. Please wait a few minutes and try again.",
                provider: "vscode-copilot",
            };
        }
        if (msg.includes("not authenticated") || msg.includes("sign in") || msg.includes("unauthorized")) {
            return {
                success: false,
                error: "Please sign in to VS Code with your GitHub account. Click the account icon in the bottom left corner.",
                provider: "vscode-copilot",
            };
        }
        if (msg.includes("network") || msg.includes("connection") || msg.includes("timeout")) {
            return {
                success: false,
                error: "Network connection error. Please check your internet connection and try again.",
                provider: "vscode-copilot",
            };
        }
        return {
            success: false,
            error: `VS Code Copilot error: ${msg}`,
            provider: "vscode-copilot",
        };
    }

    private async fetchAvailableModels(): Promise<void> {
        try {
            logger.info("🔍 Discovering Copilot models...");
            let allModels = await vscode.lm.selectChatModels({ vendor: "copilot" });

            if (allModels.length === 0) {
                logger.info("⚠️ No models with vendor:copilot, scanning all models...");
                const general = await vscode.lm.selectChatModels();
                allModels = general.filter(
                    (m) =>
                        m.vendor?.toLowerCase().includes("copilot") ||
                        m.id?.toLowerCase().includes("copilot") ||
                        m.family?.toLowerCase().includes("gpt") ||
                        m.family?.toLowerCase().includes("claude")
                );
            }

            if (allModels.length === 0) {
                logger.warn("⚠️ No suitable models found");
                this.availableModels = [];
                return;
            }

            logger.info(`✅ Found ${allModels.length} language models`);
            allModels.forEach((m, i) => {
                logger.info(`  [${i + 1}] ${m.name} | family:${m.family} | vendor:${m.vendor} | id:${m.id}`);
            });

            this.availableModels = allModels.sort(
                (a, b) => this.getModelPriority(a) - this.getModelPriority(b)
            );
            logger.info(`🏆 Best model: ${this.availableModels[0]?.name || "N/A"}`);
        } catch (error) {
            logger.error("❌ Model discovery error:", error);
            this.availableModels = [];
        }
    }

    /** Lower value = higher priority */
    private getModelPriority(model: vscode.LanguageModelChat): number {
        try {
            const family = (model.family || "").toLowerCase();
            const name = (model.name || "").toLowerCase();
            const check = (s: string) => family.includes(s) || name.includes(s);

            if (check("gpt-5.2-codex")) return 0;
            if (check("gpt-5.2")) return 0;
            if (check("gpt-5.1-codex")) return 1;
            if (check("gpt-5")) return 1;
            if (check("gpt-4.1")) return 1;
            if (check("gpt-4o")) return 2;
            if (check("claude sonnet 4.5")) return 2;
            if (check("claude sonnet 4")) return 3;
            if (check("claude opus 4")) return 3;
            if (check("gemini 3")) return 3;
            if (check("o4")) return 3;
            if (check("o3")) return 4;
            if (check("claude-3.7") || check("claude sonnet 3.7")) return 4;
            if (check("claude-3.5") || check("claude sonnet 3.5")) return 5;
            if (check("gpt-4")) return 6;
            if (check("gemini 2.5")) return 6;
            if (check("gemini 2.0")) return 7;
            if (check("gemini")) return 8;
            if (check("gpt-3.5")) return 9;
            return 10;
        } catch {
            return 20;
        }
    }

    private async selectCurrentModel(): Promise<void> {
        if (this.availableModels.length === 0) return;
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") as Record<string, unknown>;
        const selectedModelId = (aiConfig?.selectedModel as string) || "";

        let selected = this.availableModels.find(
            (m) =>
                m.id === selectedModelId ||
                m.family === selectedModelId ||
                m.name.toLowerCase().includes(selectedModelId.toLowerCase())
        );

        if (!selected) {
            selected = this.availableModels[0];
        }

        if (selected) {
            this.availableModels = [
                selected,
                ...this.availableModels.filter((m) => m !== selected),
            ];
        }
    }

    private async checkCopilotStatus(): Promise<CopilotStatus> {
        try {
            logger.info("🔍 Checking GitHub Copilot status...");
            const copilot = vscode.extensions.getExtension("GitHub.copilot");
            const copilotChat = vscode.extensions.getExtension("GitHub.copilot-chat");

            if (!copilot && !copilotChat) {
                return {
                    available: false,
                    reason: "GitHub Copilot or Copilot Chat extension is not installed. Install it from VS Code Marketplace.",
                    details: { copilotInstalled: false, copilotChatInstalled: false },
                };
            }

            if (copilot && !copilot.isActive) {
                try {
                    await copilot.activate();
                } catch (e) {
                    logger.warn("⚠️ Copilot activation error:", e);
                }
            }
            if (copilotChat && !copilotChat.isActive) {
                try {
                    await copilotChat.activate();
                } catch (e) {
                    logger.warn("⚠️ Copilot Chat activation error:", e);
                }
            }

            await new Promise((r) => setTimeout(r, 500));

            try {
                const testModels = await vscode.lm.selectChatModels({ vendor: "copilot" });
                if (testModels.length > 0) {
                    return {
                        available: true,
                        details: {
                            modelCount: testModels.length,
                            models: testModels.map((m) => ({
                                name: m.name,
                                family: m.family,
                                vendor: m.vendor,
                            })),
                        },
                    };
                }
                return {
                    available: false,
                    reason: "No language models found. Ensure your Copilot subscription is active and you are signed in.",
                    details: {
                        copilotInstalled: !!copilot,
                        copilotChatInstalled: !!copilotChat,
                        copilotActive: copilot?.isActive,
                        copilotChatActive: copilotChat?.isActive,
                    },
                };
            } catch (modelError: unknown) {
                return {
                    available: false,
                    reason: `Language Model API access error: ${(modelError as Error).message}. Try restarting VS Code.`,
                    details: { error: (modelError as Error).message },
                };
            }
        } catch (error: unknown) {
            logger.error("❌ Copilot status check error:", error);
            return {
                available: false,
                reason: `Unexpected error: ${error}`,
            };
        }
    }

    private parseAnalysisResult(content: string): { summary: string } {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return { summary: parsed.summary || "Analysis completed" };
            }
        } catch {
            // fall through
        }
        return { summary: "AI analysis completed" };
    }

    private estimateTokens(input: string, output: string): TokenEstimate {
        const estimate = (text: string): number => {
            const chars = text.length;
            const words = text.split(/\s+/).length;
            const lines = text.split("\n").length;
            return Math.ceil(chars / 4) + Math.ceil(words * 0.1) + Math.ceil(lines * 0.5);
        };
        const inputTokens = estimate(input);
        const outputTokens = estimate(output);
        return { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens };
    }
}
