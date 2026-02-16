import * as vscode from "vscode";

// Global variables that will be set by extension.ts
export let aiProviderManager: any;
export let statisticsManager: any;
export let localization: any;
export let statsViewProvider: any;
export let modernStatsViewProvider: any;
export let updateStatusBar: () => void;

export function initializeCommonUtils(
	aiProvider: any,
	statsManager: any,
	localizationManager: any,
	statsProvider: any,
	modernStatsProvider: any,
	statusBarUpdater: () => void
) {
	aiProviderManager = aiProvider;
	statisticsManager = statsManager;
	localization = localizationManager;
	statsViewProvider = statsProvider;
	modernStatsViewProvider = modernStatsProvider;
	updateStatusBar = statusBarUpdater;
}

// Utility functions
export function isSupportedFileType(language: string): boolean {
	return ["html", "htm", "jsx", "tsx", "vue", "svelte", "php"].includes(language.toLowerCase());
}

export function countLinesChanged(original: string, improved: string): number {
	const originalLines = original.split("\n").length;
	const improvedLines = improved.split("\n").length;
	return Math.abs(improvedLines - originalLines);
}

export function getConfiguration(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration("wcagEnhancer");
}

export function showError(message: string): void {
	vscode.window.showErrorMessage(message);
}

export function showSuccess(message: string): void {
	vscode.window.showInformationMessage(message);
}

export function showInfo(message: string): void {
	vscode.window.showInformationMessage(message);
}

export async function setApiKey(): Promise<void> {
	const config = vscode.workspace.getConfiguration("wcagEnhancer");
	const aiConfig = config.get("ai") as any || {};
	const currentKey = aiConfig.apiKey || "";
	
	const apiKey = await vscode.window.showInputBox({
		title: "🔑 Gemini API Key Configuration",
		prompt: "Enter your Google Gemini API key from Google AI Studio",
		placeHolder: "AIzaSy... (Your API key)",
		password: true,
		value: currentKey,
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return "❌ API key cannot be empty";
			}
			if (value.length < 20) {
				return "⚠️ API key seems too short (minimum 20 characters)";
			}
			if (!value.startsWith("AIza")) {
				return "⚠️ Gemini API keys typically start with \"AIza\"";
			}
			return null;
		}
	});
	
	if (apiKey !== undefined) {
		aiConfig.apiKey = apiKey;
		await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
		
		vscode.window.showInformationMessage(
			"✅ Gemini API key updated successfully!",
			"Test Connection"
		).then(action => {
			if (action === "Test Connection") {
				testAIConnection();
			}
		});
	}
}

export async function testAIConnection(): Promise<void> {
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "🧪 Testing AI connection...",
			cancellable: false
		}, async (progress) => {
			progress.report({ increment: 0, message: "Validating configuration..." });
			await new Promise(resolve => setTimeout(resolve, 500));
			
			progress.report({ increment: 50, message: "Testing AI provider..." });
			
			// Import AITestUtils dynamically to avoid circular dependencies
			const { AITestUtils } = await import("./aiTestUtils");
			const aiTestUtils = AITestUtils.getInstance();
			const result = await aiTestUtils.testAIProvider();
			
			progress.report({ increment: 100, message: "Showing results..." });
			await aiTestUtils.showTestResult(result);
		});
	} catch (error) {
		vscode.window.showErrorMessage(`❌ AI test failed: ${error}`);
	}
}

export async function recordImprovementStats(
	startTime: number,
	originalCode: string,
	improvedCode: string,
	type: "file" | "selection",
	language: string,
	fileName: string,
	result: any
): Promise<void> {
	const processingTime = Date.now() - startTime;
	const linesImproved = countLinesChanged(originalCode, improvedCode);
	
	statisticsManager.recordImprovement({
		type,
		language,
		fileName,
		linesImproved,
		wcagCriteria: result.wcagCriteria || [],
		processingTime,
		tokensUsed: result.tokensUsed || 0,
		inputTokens: result.inputTokens,
		outputTokens: result.outputTokens,
		provider: result.provider || "gemini",
		model: result.model || "unknown"
	});

	// Update stats view and status bar
	statsViewProvider.updateStatistics(statisticsManager.getDetailedStatistics());
	updateStatusBar();
}

export async function handleImprovementResult(
	editor: vscode.TextEditor,
	originalCode: string,
	improvedCode: string,
	result: any,
	startTime: number,
	type: "file" | "selection",
	language: string,
	fileName: string
): Promise<boolean> {
	if (result.success && improvedCode && improvedCode !== originalCode) {
		const autoApply = getConfiguration().get<boolean>("autoApply", false);
		let shouldApply = autoApply;

		if (!autoApply) {
			const action = await vscode.window.showInformationMessage(
				localization.getString("success.improvements.ready"),
				{ modal: true, detail: result.summary },
				localization.getString("button.apply.changes"),
				localization.getString("button.preview.changes")
			);
			shouldApply = action === localization.getString("button.apply.changes");
		}

		if (shouldApply) {
			if (type === "file") {
				const document = editor.document;
				await editor.edit(editBuilder => {
					const fullRange = new vscode.Range(
						document.positionAt(0),
						document.positionAt(originalCode.length)
					);
					editBuilder.replace(fullRange, improvedCode);
				});
			} else {
				await editor.edit(editBuilder => {
					editBuilder.replace(editor.selection, improvedCode);
				});
			}

			// Record statistics
			await recordImprovementStats(startTime, originalCode, improvedCode, type, language, fileName, result);

			const linesImproved = countLinesChanged(originalCode, improvedCode);
			showSuccess(
				localization.getString(`success.${type}.improved`) + 
				` (${linesImproved} ${localization.getString("stats.lines.improved")})`
			);
			return true;
		}
	} else {
		showInfo(localization.getString("info.no.improvements.needed"));
	}
	return false;
}

export function getProgressSteps(): Array<{increment: number, message: string}> {
	return [
		{ increment: 0, message: localization.getString("progress.step.1") },
		{ increment: 15, message: localization.getString("progress.step.2") },
		{ increment: 30, message: localization.getString("progress.step.3") },
		{ increment: 50, message: localization.getString("progress.step.4") },
		{ increment: 75, message: localization.getString("progress.step.5") },
		{ increment: 90, message: localization.getString("progress.step.6") }
	];
}

export async function runProgressSteps(progress: vscode.Progress<{increment?: number, message?: string}>): Promise<void> {
	const steps = getProgressSteps();
	for (let i = 0; i < steps.length - 1; i++) {
		progress.report(steps[i]);
		await new Promise(resolve => setTimeout(resolve, 500));
	}
} 