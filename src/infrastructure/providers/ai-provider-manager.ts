/**
 * ai-provider-manager.ts
 * Singleton orchestrator for AI provider selection and model management.
 * Uses AIProviderFactory (DIP: depends on abstraction, not concretions).
 */
import * as vscode from "vscode";
import { logger } from "../../utils/logger";
import { AIProvider, AIResponse, WCAGRequest } from "./ai-provider.types";
import { AIProviderFactory } from "./ai-provider-factory";
import { VSCodeCopilotProvider } from "./copilot-provider";
import { OllamaProvider } from "./ollama-provider";

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class AIProviderManager {
    private static instance: AIProviderManager;
    private readonly factory: AIProviderFactory;
    private readonly providers = new Map<string, AIProvider>();
    private currentProvider = "gemini";
    private statusBarCallback: (() => void) | null = null;

    private constructor() {
        this.factory = new AIProviderFactory();
        this.initializeProviders();
    }

    static getInstance(): AIProviderManager {
        if (!AIProviderManager.instance) {
            AIProviderManager.instance = new AIProviderManager();
        }
        return AIProviderManager.instance;
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    setStatusBarCallback(callback: () => void): void {
        this.statusBarCallback = callback;
    }

    // -----------------------------------------------------------------------
    // Provider access
    // -----------------------------------------------------------------------

    async getCurrentProviderInstance(): Promise<AIProvider> {
        await this.loadCurrentProvider();
        const provider = this.providers.get(this.currentProvider);
        if (!provider) {
            logger.warn(
                `Provider "${this.currentProvider}" not found, falling back to Gemini`
            );
            return this.providers.get("gemini")!;
        }
        return provider;
    }

    getCurrentProviderName(): string {
        return this.currentProvider;
    }

    /** @deprecated Use getCurrentProviderName() */
    getCurrentProvider(): string {
        return this.currentProvider;
    }

    getAvailableProviders(): Array<{ id: string; name: string; available: boolean }> {
        return [...this.providers.entries()].map(([id, p]) => ({
            id,
            name: p.getDisplayName(),
            available: false, // checked async on demand
        }));
    }

    // -----------------------------------------------------------------------
    // Provider switching
    // -----------------------------------------------------------------------

    async setProvider(providerName: string): Promise<boolean> {
        if (!this.providers.has(providerName)) {
            return false;
        }

        const provider = this.providers.get(providerName)!;
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
            throw new Error(
                `Provider ${provider.getDisplayName()} is not available`
            );
        }

        this.currentProvider = providerName;

        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = (config.get("ai") as Record<string, unknown>) || {};
        aiConfig.provider = providerName;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);

        await this.updateModelSelection();
        return true;
    }

    async switchProvider(providerName: string): Promise<void> {
        const success = await this.setProvider(providerName);
        if (!success) {
            throw new Error(`Failed to switch to provider: ${providerName}`);
        }
        logger.info(`Provider switched to: ${providerName}`);
    }

    // -----------------------------------------------------------------------
    // Model management
    // -----------------------------------------------------------------------

    async setModel(modelId: string): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiModelConfig =
                (config.get("aiModels") as Record<string, unknown>) || {};
            aiModelConfig.selectedModel = modelId;
            await config.update(
                "aiModels",
                aiModelConfig,
                vscode.ConfigurationTarget.Global
            );

            if (this.currentProvider === "vscode-copilot") {
                const copilot = this.providers.get(
                    "vscode-copilot"
                ) as VSCodeCopilotProvider;
                await copilot?.initializeModels();
            }

            this.statusBarCallback?.();
            return true;
        } catch (error) {
            logger.error("Model set error:", error);
            return false;
        }
    }

    getCurrentModelName(): string {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiModelConfig = config.get("aiModels") as Record<string, unknown>;
            const modelId = (aiModelConfig?.selectedModel as string) || "unknown";
            if (modelId === "unknown") return "Default Model";
            return modelId
                .replace(/-/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());
        } catch {
            return "AI Model";
        }
    }

    // -----------------------------------------------------------------------
    // Copilot-specific helpers (used by wizard / settings panel)
    // -----------------------------------------------------------------------

    async getAvailableCopilotModels(): Promise<
        Array<{
            id: string;
            name: string;
            family: string;
            description?: string;
            vendor?: string;
        }>
    > {
        const copilot = this.providers.get(
            "vscode-copilot"
        ) as VSCodeCopilotProvider;
        return copilot ? copilot.getAvailableModels() : [];
    }

    async refreshCopilotModels(): Promise<void> {
        const copilot = this.providers.get(
            "vscode-copilot"
        ) as VSCodeCopilotProvider;
        await copilot?.refreshModels();
    }

    // -----------------------------------------------------------------------
    // Convenience delegation
    // -----------------------------------------------------------------------

    async improveCode(request: WCAGRequest): Promise<AIResponse> {
        const provider = await this.getCurrentProviderInstance();
        if (!(await provider.isAvailable())) {
            throw new Error(
                `Current provider ${provider.getDisplayName()} is not available`
            );
        }
        return provider.improveCode(request);
    }

    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------

    private initializeProviders(): void {
        for (const id of this.factory.getRegisteredIds()) {
            this.providers.set(id, this.factory.createProvider(id));
        }
        this.loadCurrentProvider();
    }

    async loadCurrentProvider(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            const aiConfig = config.get("ai") as Record<string, unknown>;
            const newProvider = (aiConfig?.provider as string) || "gemini";

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
            const copilot = this.providers.get(
                "vscode-copilot"
            ) as VSCodeCopilotProvider;
            await copilot?.initializeModels();
        }

        if (this.currentProvider === "ollama") {
            const ollama = this.providers.get("ollama") as OllamaProvider;
            await ollama?.getAvailableModels();
        }

        this.statusBarCallback?.();
    }
}
