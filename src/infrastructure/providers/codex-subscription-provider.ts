/**
 * codex-subscription-provider.ts
 * Experimental provider that routes AccessiMind analysis through Codex CLI.
 *
 * This is the supported subscription-backed path exposed by OpenAI docs:
 * Codex CLI can sign in with ChatGPT for subscription access. It is not a
 * generic ChatGPT web-session API adapter.
 */
import * as vscode from "vscode";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { RequestCache } from "../../utils/requestCache";
import { getNormalizedSelectedModel } from "../../utils/configurationUtils";
import { getConfiguredCodexPath, getConfiguredCodexTimeoutMs } from "../../utils/codexAccountAuth";
import { logger } from "../../utils/logger";
import { AIModelDescriptor, AIProvider, AIResponse, WCAGRequest } from "./ai-provider.types";

interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

export class CodexSubscriptionProvider extends AIProvider {
	private readonly cache: RequestCache<AIResponse>;

	constructor() {
		super();
		this.cache = RequestCache.getInstance<AIResponse>("codex-subscription");
	}

	getDisplayName(): string {
		return "Codex Subscription (ChatGPT)";
	}

	async isAvailable(): Promise<boolean> {
		const configuredPath = this.getCodexPath();
		if (configuredPath !== "codex") {
			return true;
		}

		try {
			const result = await this.runCommand("where.exe", ["codex"], "", 5000);
			return result.exitCode === 0 && result.stdout.toLowerCase().includes("codex");
		} catch {
			return false;
		}
	}

	async getAvailableModels(): Promise<AIModelDescriptor[]> {
		return [
			{
				id: "gpt-5.5",
				name: "GPT-5.5 via Codex",
				description: "Newest frontier Codex model; uses ChatGPT/Codex subscription auth when signed in.",
				vendor: "OpenAI",
				family: "Codex",
				recommended: true,
			},
			{
				id: "gpt-5.4",
				name: "GPT-5.4 via Codex",
				description: "Frontier coding and reasoning model through Codex CLI.",
				vendor: "OpenAI",
				family: "Codex",
			},
			{
				id: "gpt-5.4-mini",
				name: "GPT-5.4 Mini via Codex",
				description: "Faster lower-cost Codex model for lighter analysis tasks.",
				vendor: "OpenAI",
				family: "Codex",
			},
			{
				id: "gpt-5.3-codex-spark",
				name: "GPT-5.3 Codex Spark via Codex",
				description: "Research preview for near-instant coding iteration; availability depends on ChatGPT plan.",
				vendor: "OpenAI",
				family: "Codex",
			},
		];
	}

	async chat(message: string): Promise<AIResponse> {
		return this.runCodex(message, "chat");
	}

	async analyzeCode(request: WCAGRequest): Promise<AIResponse> {
		return this.runCodex(this.buildWCAGAnalysisPrompt(request), "analyze");
	}

	async improveCode(request: WCAGRequest): Promise<AIResponse> {
		const model = this.getModel();
		const prompt = this.buildCodexImprovementPrompt(request);
		const cacheKey = this.cache.generateKey(model, prompt);

		if (!request.forceRefresh) {
			const cached = this.cache.get(cacheKey);
			if (cached) {
				return cached;
			}
		}

		let response = await this.runCodex(prompt, "improve");
		if (response.success && this.isInvalidImprovementContent(response.content || "", request)) {
			response = await this.runCodex(this.buildCodexRetryPrompt(prompt, request), "improve");
		}

		if (response.success && this.isInvalidImprovementContent(response.content || "", request)) {
			response = {
				success: false,
				error: "Codex returned an invalid code response. The response was too short or did not look like code, so AccessiMind refused to apply it.",
				provider: "codex-subscription",
				model,
			};
		}

		if (response.success) {
			this.cache.set(cacheKey, response);
		}
		return response;
	}

	private async runCodex(prompt: string, mode: "chat" | "analyze" | "improve"): Promise<AIResponse> {
		const startTime = Date.now();
		const model = this.getModel();
		const outputPath = this.createOutputPath(mode);
		const args = [
			"exec",
			"--model",
			model,
			"--sandbox",
			"read-only",
			"--skip-git-repo-check",
			"--color",
			"never",
			"--output-last-message",
			outputPath,
			"-",
		];

		try {
			const result = await this.runCommand(this.getCodexPath(), args, prompt, this.getTimeoutMs());
			if (result.exitCode !== 0) {
				return {
					success: false,
					error: this.formatCodexError(result.stderr || result.stdout),
					provider: "codex-subscription",
					model,
				};
			}

			const content = this.readAndDeleteOutput(outputPath) || this.extractLastUsefulLine(result.stdout);
			if (!content) {
				return {
					success: false,
					error: this.formatCodexError(result.stderr || result.stdout || "Codex returned an empty response."),
					provider: "codex-subscription",
					model,
				};
			}

			return {
				success: true,
				content,
				improvedCode: mode === "improve" ? content : undefined,
				summary: mode === "analyze" ? "Codex analysis completed" : "Codex response completed",
				wcagCriteria: this.extractWCAGCriteria(content),
				responseTime: Date.now() - startTime,
				model,
				provider: "codex-subscription",
			};
		} catch (error) {
			this.deleteOutput(outputPath);
			return {
				success: false,
				error: this.formatCodexError(error instanceof Error ? error.message : String(error)),
				provider: "codex-subscription",
				model,
			};
		}
	}

	private getModel(): string {
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const selected = getNormalizedSelectedModel(config, "gpt-5.5");
		return selected.startsWith("gpt-") ? selected : "gpt-5.5";
	}

	private buildCodexImprovementPrompt(request: WCAGRequest): string {
		return `${this.buildWCAGPrompt(request)}

CODEX FINAL ANSWER CONTRACT:
- Your final answer MUST be only the complete improved code for the requested scope.
- If no accessibility changes are needed, return the original code exactly.
- Do not answer with ".", "OK", a summary, a plan, or a refusal.
- Do not include markdown fences unless the original response format requires them.
- The final answer will be inserted into the user's editor; any non-code answer is invalid.`;
	}

	private buildCodexRetryPrompt(originalPrompt: string, request: WCAGRequest): string {
		const originalCode = request.selectedText || request.code;
		return `${originalPrompt}

Your previous final answer was invalid for editor insertion.
Return ONLY valid code now.
The output must be at least the same requested scope as this original code:
\`\`\`${request.language}
${originalCode}
\`\`\`

If you cannot improve it, return that exact original code.`;
	}

	private isInvalidImprovementContent(content: string, request: WCAGRequest): boolean {
		const trimmed = content.trim();
		if (!trimmed) {
			return true;
		}

		if (/^[.\s]+$/.test(trimmed) || /^(ok|done|no changes|unchanged)$/i.test(trimmed)) {
			return true;
		}

		const original = (request.selectedText || request.code || "").trim();
		if (original.length >= 80 && trimmed.length < Math.max(24, original.length * 0.2)) {
			return true;
		}

		if (this.looksLikePlainExplanation(trimmed) && !this.looksLikeCode(trimmed, request.language)) {
			return true;
		}

		return false;
	}

	private looksLikePlainExplanation(content: string): boolean {
		return /^[A-Z][^<>{};=\n]+[.!?]$/i.test(content) || /\b(can't|cannot|sorry|unable|yapamam|uzgunum|ozur)\b/i.test(content);
	}

	private looksLikeCode(content: string, language: string): boolean {
		const lowerLanguage = language.toLowerCase();
		if (/^(html|htm)$/.test(lowerLanguage)) {
			return /<\/?[a-z][\s\S]*>/i.test(content);
		}
		if (/css/.test(lowerLanguage)) {
			return /[.#]?[a-z0-9_-]+\s*\{[\s\S]*\}/i.test(content);
		}
		if (/(javascript|typescript|jsx|tsx)/.test(lowerLanguage)) {
			return /(?:const|let|var|function|=>|import|export|class|document\.|return\b)/.test(content);
		}

		return /[<>{};=]/.test(content) || content.includes("\n");
	}

	private getCodexPath(): string {
		return getConfiguredCodexPath();
	}

	private getTimeoutMs(): number {
		return getConfiguredCodexTimeoutMs();
	}

	private runCommand(command: string, args: string[], input: string, timeoutMs: number): Promise<CommandResult> {
		return new Promise((resolve, reject) => {
			const child = spawn(command, args, {
				cwd: this.getWorkingDirectory(),
				shell: false,
				windowsHide: true,
			});

			let stdout = "";
			let stderr = "";
			const timer = setTimeout(() => {
				child.kill();
				reject(new Error(`Codex command timed out after ${timeoutMs}ms`));
			}, timeoutMs);

			child.stdout.on("data", (chunk) => {
				stdout += chunk.toString();
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk.toString();
			});
			child.on("error", (error) => {
				clearTimeout(timer);
				reject(error);
			});
			child.on("close", (exitCode) => {
				clearTimeout(timer);
				resolve({ stdout, stderr, exitCode });
			});

			if (input) {
				child.stdin.write(input);
			}
			child.stdin.end();
		});
	}

	private createOutputPath(mode: string): string {
		const safeMode = mode.replace(/[^a-z0-9_-]/gi, "_");
		return path.join(os.tmpdir(), `accessimind-codex-${safeMode}-${process.pid}-${Date.now()}.txt`);
	}

	private getWorkingDirectory(): string {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
	}

	private readAndDeleteOutput(outputPath: string): string | undefined {
		if (!fs.existsSync(outputPath)) {
			return undefined;
		}

		const content = fs.readFileSync(outputPath, "utf8").trim();
		this.deleteOutput(outputPath);
		return content || undefined;
	}

	private deleteOutput(outputPath: string): void {
		if (fs.existsSync(outputPath)) {
			fs.rmSync(outputPath, { force: true });
		}
	}

	private extractLastUsefulLine(stdout: string): string {
		return stdout
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("Reading additional input from stdin"))
			.at(-1) || "";
	}

	private formatCodexError(message: string): string {
		logger.warn("Codex subscription provider error:", message);
		return [
			"Codex subscription provider failed.",
			"Make sure Codex CLI is installed and signed in with ChatGPT (`codex login`).",
			"If the Windows app alias is blocked, set wcagEnhancer.ai.codexPath to the executable path.",
			message.trim(),
		].filter(Boolean).join(" ");
	}
}
