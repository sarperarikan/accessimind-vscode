/**
 * aiProvider.ts — Backward-compatibility shim.
 * All implementations have been moved to src/infrastructure/providers/.
 * This file re-exports everything so existing imports continue to work.
 *
 * @deprecated Import directly from "../infrastructure/providers" in new code.
 */
export type { AIResponse, WCAGRequest } from "../infrastructure/providers";
export {
	AIProvider,
	GeminiProvider,
	VSCodeCopilotProvider,
	OllamaProvider,
	CodexSubscriptionProvider,
	AIProviderFactory,
	AIProviderManager,
} from "../infrastructure/providers";
