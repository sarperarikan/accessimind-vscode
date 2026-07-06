/**
 * ai-provider-factory.ts
 * Abstract Factory — decouples provider instantiation from the manager.
 * OCP: New providers can be registered without modifying existing code.
 */
import { AIProvider } from "./ai-provider.types";
import { GeminiProvider } from "./gemini-provider";
import { VSCodeCopilotProvider } from "./copilot-provider";
import { OllamaProvider } from "./ollama-provider";
import { CodexSubscriptionProvider } from "./codex-subscription-provider";

// ---------------------------------------------------------------------------
// Factory interface (ISP: clients depend only on what they use)
// ---------------------------------------------------------------------------

export interface IAIProviderFactory {
    createProvider(providerId: string): AIProvider;
    getRegisteredIds(): string[];
}

// ---------------------------------------------------------------------------
// Concrete factory
// ---------------------------------------------------------------------------

type ProviderConstructor = new () => AIProvider;

export class AIProviderFactory implements IAIProviderFactory {
    private readonly registry = new Map<string, ProviderConstructor>();

    constructor() {
        this.registerDefaults();
    }

    /** Register a custom provider at runtime (Open/Closed Principle). */
    register(id: string, ctor: ProviderConstructor): void {
        this.registry.set(id, ctor);
    }

    createProvider(providerId: string): AIProvider {
        const Ctor = this.registry.get(providerId);
        if (!Ctor) {
            throw new Error(
                `Unknown provider id: "${providerId}". Registered ids: ${[...this.registry.keys()].join(", ")}`
            );
        }
        return new Ctor();
    }

    getRegisteredIds(): string[] {
        return [...this.registry.keys()];
    }

    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------

    private registerDefaults(): void {
        this.registry.set("gemini", GeminiProvider);
        this.registry.set("vscode-copilot", VSCodeCopilotProvider);
        this.registry.set("ollama", OllamaProvider);
        this.registry.set("codex-subscription", CodexSubscriptionProvider);
    }
}
