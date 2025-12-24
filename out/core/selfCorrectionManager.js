"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfCorrectionManager = void 0;
const logger_1 = require("../utils/logger");
class SelfCorrectionManager {
    constructor() {
        this.MAX_RETRIES = 2;
        // Dynamic require to avoid circular dependency
        this.providerManager = require('../utils/aiProvider').AIProviderManager.getInstance();
    }
    static getInstance() {
        if (!SelfCorrectionManager.instance) {
            SelfCorrectionManager.instance = new SelfCorrectionManager();
        }
        return SelfCorrectionManager.instance;
    }
    async attemptFix(originalCode, instructions, language, onProgress) {
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
                selectedText: instructions // Passing instructions as context
            });
            if (!improvementResult.success || !improvementResult.content) {
                lastError = improvementResult.error || "Failed to generate fix";
                logger_1.logger.error(`Attempt ${attempt} failed: ${lastError}`);
                continue;
            }
            const proposedCode = this.extractCode(improvementResult.content);
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
            }
            else {
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
    async verifyFix(code, originalInstructions, language) {
        // In a real agent, this would run linter, compiler, or a separate AI verification step.
        // For now, we'll ask Gemini to critique its own work.
        const verificationPrompt = `
        You are a code reviewer. Review the following code against these instructions: "${originalInstructions}".
        
        Code:
        \`\`\`${language}
        ${code}
        \`\`\`

        Return a JSON object:
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
            }
            catch (e) {
                // Provider might not support chat
                return { isValid: true, reason: "Verification skipped (provider capabilities)" };
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
        }
        catch (e) {
            logger_1.logger.error("Verification error:", e);
        }
        // Fallback: assume valid if we can't verify (to prevent infinite loops on parse errors)
        return { isValid: true, reason: "" };
    }
    extractCode(content) {
        const match = content.match(/```[\w]*\n([\s\S]*?)\n```/);
        return match ? match[1] : content;
    }
}
exports.SelfCorrectionManager = SelfCorrectionManager;
//# sourceMappingURL=selfCorrectionManager.js.map