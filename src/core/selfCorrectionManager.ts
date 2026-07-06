import * as vscode from 'vscode';

import { AIProviderManager } from '../infrastructure/providers';
import { normalizeGeneratedCode } from '../utils/codeGenerationUtils';
import { LocalizationManager } from '../utils/localizationManager';
import { logger } from '../utils/logger';

export interface CorrectionResult {
    success: boolean;
    code?: string;
    iterations: number;
    error?: string;
}

export class SelfCorrectionManager {
    private static instance: SelfCorrectionManager;
    private providerManager: any; // AIProviderManager type
    private readonly MAX_RETRIES = 2;
    private readonly localization = LocalizationManager.getInstance();

    private constructor() {
        this.providerManager = AIProviderManager.getInstance();
    }

    public static getInstance(): SelfCorrectionManager {
        if (!SelfCorrectionManager.instance) {
            SelfCorrectionManager.instance = new SelfCorrectionManager();
        }
        return SelfCorrectionManager.instance;
    }

    public async attemptFix(
        originalCode: string,
        instructions: string,
        language: string,
        onProgress?: (message: string) => void
    ): Promise<CorrectionResult> {
        let currentCode = originalCode;
        let attempt = 0;
        let lastError = "";

        const provider = await this.providerManager.getCurrentProviderInstance();

        while (attempt <= this.MAX_RETRIES) {
            attempt++;
            onProgress?.(`Attempt ${attempt}/${this.MAX_RETRIES + 1}: Generating fix...`);

            // 1. Generate Fix
            const improvementResult = await provider.improveCode({
                code: currentCode,
                fileType: 'unknown', // context needed
                language: language,
                mode: 'agent',
                selectedText: instructions, // Passing instructions as context
                responseLanguage: this.localization.getCurrentLanguage() as "en" | "tr"
            });

            if (!improvementResult.success || !improvementResult.content) {
                lastError = improvementResult.error || "Failed to generate fix";
                logger.error(`Attempt ${attempt} failed: ${lastError}`);
                continue;
            }

            let proposedCode: string;
            try {
                proposedCode = normalizeGeneratedCode({
                    originalCode: currentCode,
                    generatedContent: improvementResult.content,
                    language,
                    mode: "file"
                }).code;
            } catch (error) {
                lastError = error instanceof Error ? error.message : "Provider returned invalid code";
                logger.error(`Attempt ${attempt} failed: ${lastError}`);
                continue;
            }
            if (!proposedCode.trim()) {
                lastError = "Provider returned an empty fix";
                logger.error(`Attempt ${attempt} failed: ${lastError}`);
                continue;
            }

            // 2. Verify Fix (Self-Correction)
            onProgress?.(`Attempt ${attempt}: Verifying fix...`);
            const verificationResult = await this.verifyFix(proposedCode, instructions, language);

            if (verificationResult.isValid) {
                onProgress?.(`Fix verified successfully on attempt ${attempt}!`);
                return {
                    success: true,
                    code: proposedCode,
                    iterations: attempt
                };
            } else {
                onProgress?.(`Verification failed: ${verificationResult.reason}. Retrying...`);
                // Add the failure reason to the next prompt context (simplified here)
                instructions += `\n\nPrevious attempt failed because: ${verificationResult.reason}. Please fix this.`;
                lastError = verificationResult.reason;
            }
        }

        return {
            success: false,
            iterations: attempt,
            error: `Failed after ${attempt} attempts. Last error: ${lastError}`
        };
    }

    private async verifyFix(code: string, originalInstructions: string, language: string): Promise<{ isValid: boolean; reason: string }> {
        // In a real agent, this would run linter, compiler, or a separate AI verification step.
        // For now, we'll ask Gemini to critique its own work.

        const verificationPrompt = this.localization.getCurrentLanguage() === "tr"
            ? `
        Bir kod gözden geçiricisisin. Aşağıdaki kodu şu talimatlara göre değerlendir: "${originalInstructions}".

        Kod:
        \`\`\`${language}
        ${code}
        \`\`\`

        Yalnızca şu JSON nesnesini döndür:
        {
            "isValid": boolean,
            "reason": "string (geçerli değilse neden)"
        }
        `
            : `
        You are a code reviewer. Review the following code against these instructions: "${originalInstructions}".

        Code:
        \`\`\`${language}
        ${code}
        \`\`\`

        Return only this JSON object:
        {
            "isValid": boolean,
            "reason": "string (if not valid)"
        }
        `;

        try {
            const provider = await this.providerManager.getCurrentProviderInstance();
            // Try to use chat if available, otherwise skip verification or use primitive check
            let response;
            try {
                response = await provider.chat(verificationPrompt);
            } catch (e) {
                // Provider might not support chat
                return { isValid: false, reason: "Verification could not be completed by the current provider" };
            }

            if (response.success && response.content) {
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);
                    return {
                        isValid: result.isValid,
                        reason: result.reason || "Unknown verification failure"
                    };
                }
            }
        } catch (e) {
            logger.error("Verification error:", e);
        }

        return { isValid: false, reason: "Verification response could not be parsed" };
    }
}
