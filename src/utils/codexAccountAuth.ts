import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { getAiConfig, getNormalizedSelectedModel } from "./configurationUtils";
import { logger } from "./logger";

interface CodexCommandResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

export interface CodexAccountTestResult {
	success: boolean;
	message: string;
	model: string;
	responseTime: number;
	error?: string;
}

export function getConfiguredCodexPath(): string {
	const aiConfig = getAiConfig();
	if (typeof aiConfig.codexPath === "string" && aiConfig.codexPath.trim()) {
		return aiConfig.codexPath.trim();
	}

	return findNpmNativeCodexExecutable() || "codex";
}

export function getConfiguredCodexTimeoutMs(): number {
	const aiConfig = getAiConfig();
	return typeof aiConfig.codexTimeoutMs === "number" ? aiConfig.codexTimeoutMs : 180000;
}

export function getSelectedCodexModel(): string {
	const selected = getNormalizedSelectedModel(vscode.workspace.getConfiguration("wcagEnhancer"), "gpt-5.5");
	return selected.startsWith("gpt-") ? selected : "gpt-5.5";
}

export async function selectCodexSubscriptionProvider(): Promise<void> {
	const config = vscode.workspace.getConfiguration("wcagEnhancer");
	const aiConfig = getAiConfig(config);
	aiConfig.provider = "codex-subscription";
	aiConfig.selectedModel = getSelectedCodexModel();
	await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
}

export async function openCodexAccountLoginTerminal(): Promise<void> {
	await selectCodexSubscriptionProvider();
	const terminal = vscode.window.createTerminal("AccessiMind Codex Login");
	terminal.show(true);
	terminal.sendText(`${quotePowerShellArg(getConfiguredCodexPath())} login`);
}

export async function testCodexAccountConnection(): Promise<CodexAccountTestResult> {
	const startTime = Date.now();
	const model = getSelectedCodexModel();
	const prompt = "Reply exactly with ACCESSIMIND_CODEX_OK. Do not add anything else.";

	try {
		const result = await runCodexCommand(
			getConfiguredCodexPath(),
			[
				"exec",
				"--model",
				model,
				"--sandbox",
				"read-only",
				"--skip-git-repo-check",
				"--color",
				"never",
				"--output-last-message",
				getCodexOutputPath("account-test"),
				"-",
			],
			getConfiguredCodexTimeoutMs(),
			prompt
		);

		const responseTime = Date.now() - startTime;
		const output = readAndDeleteCodexOutput("account-test") || result.stdout.trim();
		if (result.exitCode === 0 && output.includes("ACCESSIMIND_CODEX_OK")) {
			return {
				success: true,
				message: `Codex account connection succeeded with ${model}.`,
				model,
				responseTime,
			};
		}

		const error = (result.stderr || result.stdout || `codex exited with code ${result.exitCode}`).trim();
		return {
			success: false,
			message: "Codex account connection failed.",
			model,
			responseTime,
			error: formatCodexAccountError(error),
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.warn("Codex account test failed:", errorMessage);
		return {
			success: false,
			message: "Codex account connection failed.",
			model,
			responseTime: Date.now() - startTime,
			error: formatCodexAccountError(errorMessage),
		};
	}
}

function runCodexCommand(command: string, args: string[], timeoutMs: number, input?: string): Promise<CodexCommandResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: getCodexWorkingDirectory(),
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

function quotePowerShellArg(value: string): string {
	if (/^[A-Za-z0-9_.:-]+$/.test(value)) {
		return value;
	}

	return `& '${value.replace(/'/g, "''")}'`;
}

function findNpmNativeCodexExecutable(): string | undefined {
	if (process.platform !== "win32") {
		return undefined;
	}

	const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
	const packageRoot = path.join(appData, "npm", "node_modules", "@openai", "codex", "node_modules", "@openai");
	if (!fs.existsSync(packageRoot)) {
		return undefined;
	}

	const nativePackages = fs.readdirSync(packageRoot)
		.filter((entry) => entry.startsWith("codex-win32-"))
		.sort();

	for (const packageName of nativePackages) {
		const vendorRoot = path.join(packageRoot, packageName, "vendor");
		if (!fs.existsSync(vendorRoot)) {
			continue;
		}

		for (const vendorName of fs.readdirSync(vendorRoot)) {
			const candidate = path.join(vendorRoot, vendorName, "bin", "codex.exe");
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}
	}

	return undefined;
}

function getCodexOutputPath(name: string): string {
	return path.join(os.tmpdir(), `accessimind-codex-${name}-${process.pid}.txt`);
}

function getCodexWorkingDirectory(): string {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
}

function readAndDeleteCodexOutput(name: string): string | undefined {
	const outputPath = getCodexOutputPath(name);
	if (!fs.existsSync(outputPath)) {
		return undefined;
	}

	const content = fs.readFileSync(outputPath, "utf8").trim();
	fs.rmSync(outputPath, { force: true });
	return content || undefined;
}

function formatCodexAccountError(message: string): string {
	return [
		"Codex hesabina ulasilamadi.",
		"AccessiMind API anahtari kullanmaz; ChatGPT/Codex hesabini kullanmak icin Codex CLI oturumuna ihtiyac vardir.",
		"Komut Paleti > AccessiMind: Connect Codex Account calistirin veya terminalde codex login kullanin.",
		"Windows app alias erisimi engellenirse wcagEnhancer.ai.codexPath alanina codex.exe yolunu girin.",
		message,
	].filter(Boolean).join(" ");
}
