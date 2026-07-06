/**
 * index.ts — Barrel export for the AI provider infrastructure layer.
 * Consumers import from this single entry point.
 */
export type { AIResponse, WCAGRequest } from "./ai-provider.types";
export { AIProvider } from "./ai-provider.types";
export { GeminiProvider } from "./gemini-provider";
export { VSCodeCopilotProvider } from "./copilot-provider";
export { OllamaProvider } from "./ollama-provider";
export { CodexSubscriptionProvider } from "./codex-subscription-provider";
export type { IAIProviderFactory } from "./ai-provider-factory";
export { AIProviderFactory } from "./ai-provider-factory";
export { AIProviderManager } from "./ai-provider-manager";
