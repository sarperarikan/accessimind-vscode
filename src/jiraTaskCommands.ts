import * as vscode from "vscode";
import { AIProviderManager } from "./utils/aiProvider";
import { StatisticsManager } from "./utils/statisticsManager";
import { logger } from "./utils/logger";
import { buildJiraSystemPrompt } from "./prompts/jiraSystemPrompt";
import { LocalizationManager } from "./utils/localizationManager";

// WCAG 2.2 Criteria Reference - Title and URL mapping
const WCAG_CRITERIA_MAP: { [key: string]: { title: string; level: string } } = {
	// Principle 1: Perceivable
	"1.1.1": { title: "Non-text Content", level: "A" },
	"1.2.1": { title: "Audio-only and Video-only (Prerecorded)", level: "A" },
	"1.2.2": { title: "Captions (Prerecorded)", level: "A" },
	"1.2.3": { title: "Audio Description or Media Alternative", level: "A" },
	"1.2.4": { title: "Captions (Live)", level: "AA" },
	"1.2.5": { title: "Audio Description (Prerecorded)", level: "AA" },
	"1.3.1": { title: "Info and Relationships", level: "A" },
	"1.3.2": { title: "Meaningful Sequence", level: "A" },
	"1.3.3": { title: "Sensory Characteristics", level: "A" },
	"1.3.4": { title: "Orientation", level: "AA" },
	"1.3.5": { title: "Identify Input Purpose", level: "AA" },
	"1.4.1": { title: "Use of Color", level: "A" },
	"1.4.2": { title: "Audio Control", level: "A" },
	"1.4.3": { title: "Contrast (Minimum)", level: "AA" },
	"1.4.4": { title: "Resize Text", level: "AA" },
	"1.4.5": { title: "Images of Text", level: "AA" },
	"1.4.10": { title: "Reflow", level: "AA" },
	"1.4.11": { title: "Non-text Contrast", level: "AA" },
	"1.4.12": { title: "Text Spacing", level: "AA" },
	"1.4.13": { title: "Content on Hover or Focus", level: "AA" },
	// Principle 2: Operable
	"2.1.1": { title: "Keyboard", level: "A" },
	"2.1.2": { title: "No Keyboard Trap", level: "A" },
	"2.1.4": { title: "Character Key Shortcuts", level: "A" },
	"2.2.1": { title: "Timing Adjustable", level: "A" },
	"2.2.2": { title: "Pause, Stop, Hide", level: "A" },
	"2.3.1": { title: "Three Flashes or Below Threshold", level: "A" },
	"2.4.1": { title: "Bypass Blocks", level: "A" },
	"2.4.2": { title: "Page Titled", level: "A" },
	"2.4.3": { title: "Focus Order", level: "A" },
	"2.4.4": { title: "Link Purpose (In Context)", level: "A" },
	"2.4.5": { title: "Multiple Ways", level: "AA" },
	"2.4.6": { title: "Headings and Labels", level: "AA" },
	"2.4.7": { title: "Focus Visible", level: "AA" },
	"2.4.11": { title: "Focus Not Obscured (Minimum)", level: "AA" },
	"2.5.1": { title: "Pointer Gestures", level: "A" },
	"2.5.2": { title: "Pointer Cancellation", level: "A" },
	"2.5.3": { title: "Label in Name", level: "A" },
	"2.5.4": { title: "Motion Actuation", level: "A" },
	"2.5.7": { title: "Dragging Movements", level: "AA" },
	"2.5.8": { title: "Target Size (Minimum)", level: "AA" },
	// Principle 3: Understandable
	"3.1.1": { title: "Language of Page", level: "A" },
	"3.1.2": { title: "Language of Parts", level: "AA" },
	"3.2.1": { title: "On Focus", level: "A" },
	"3.2.2": { title: "On Input", level: "A" },
	"3.2.3": { title: "Consistent Navigation", level: "AA" },
	"3.2.4": { title: "Consistent Identification", level: "AA" },
	"3.2.6": { title: "Consistent Help", level: "A" },
	"3.3.1": { title: "Error Identification", level: "A" },
	"3.3.2": { title: "Labels or Instructions", level: "A" },
	"3.3.3": { title: "Error Suggestion", level: "AA" },
	"3.3.4": { title: "Error Prevention (Legal, Financial, Data)", level: "AA" },
	"3.3.7": { title: "Redundant Entry", level: "A" },
	"3.3.8": { title: "Accessible Authentication (Minimum)", level: "AA" },
	// Principle 4: Robust
	"4.1.1": { title: "Parsing", level: "A" },
	"4.1.2": { title: "Name, Role, Value", level: "A" },
	"4.1.3": { title: "Status Messages", level: "AA" }
};

function getWcagCriteriaInfo(criteriaNumber: string): { title: string; level: string; url: string } {
	const cleanNumber = criteriaNumber.replace(/^WCAG\s*/i, '').trim();
	const info = WCAG_CRITERIA_MAP[cleanNumber];
	const url = `https://www.w3.org/WAI/WCAG22/Understanding/${cleanNumber.replace(/\./g, '')}`;

	if (info) {
		return { ...info, url };
	}

	return {
		title: "WCAG Criterion",
		level: "A",
		url: `https://www.w3.org/WAI/WCAG22/quickref/#${cleanNumber.replace(/\./g, '')}`
	};
}

// Shared dependencies
let aiProviderManager: AIProviderManager;
let statisticsManager: StatisticsManager;

export function initializeJiraTaskCommands(
	aiProvider: AIProviderManager,
	statsManager: StatisticsManager
): void {
	aiProviderManager = aiProvider;
	statisticsManager = statsManager;
}

export async function createJiraTask(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("❌ Active editor not found. Please open a file to analyze.");
		return;
	}

	const document = editor.document;
	const selection = editor.selection;
	const codeToAnalyze = selection.isEmpty ? document.getText() : document.getText(selection);
	const fileName = document.fileName;
	const language = document.languageId;

	if (!codeToAnalyze.trim()) {
		vscode.window.showErrorMessage("❌ No code to analyze for Jira task creation.");
		return;
	}

	try {
		// Get user preferences
		const config = vscode.workspace.getConfiguration("wcagEnhancer");
		const customPrompt = config.get("jira.customPrompt") as string || "";
		const includeCustomPrompt = config.get("jira.useCustomPrompt") as boolean || false;

		// Determine user's preferred response language
		const localization = LocalizationManager.getInstance();
		const responseLanguage = (config.get("language") as string || localization.getCurrentLanguage() || "en") as "en" | "tr";

		// Ask for task details
		const taskDetails = await getJiraTaskDetails(customPrompt, includeCustomPrompt);
		if (!taskDetails) {
			return; // User cancelled
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "🎫 Creating WCAG Jira Task...",
			cancellable: false
		}, async (progress) => {
			const startTime = Date.now();

			progress.report({ increment: 0, message: "Analyzing code for accessibility issues..." });

			const provider = await aiProviderManager.getCurrentProviderInstance();
			const providerName = aiProviderManager.getCurrentProviderName();

			progress.report({ increment: 20, message: "Generating WCAG analysis..." });

			const jiraTaskContent = await generateJiraTaskContent(
				provider,
				codeToAnalyze,
				language,
				fileName,
				taskDetails,
				responseLanguage
			);

			const processingTime = Date.now() - startTime;

			progress.report({ increment: 80, message: "Preparing Jira task content..." });

			if (jiraTaskContent.success) {
				// Record statistics
				statisticsManager.recordImprovement({
					type: selection.isEmpty ? "file" : "selection",
					language,
					fileName,
					linesImproved: 0, // No code modification
					wcagCriteria: jiraTaskContent.wcagCriteria || [],
					processingTime,
					tokensUsed: jiraTaskContent.tokensUsed || 0,
					provider: providerName as "gemini" | "vscode-copilot",
					model: jiraTaskContent.model || "unknown"
				});

				progress.report({ increment: 100, message: "Task content ready!" });

				// Show the generated Jira task content in webview
				await showJiraTaskContent(jiraTaskContent.content!, fileName, jiraTaskContent.wcagCriteria, taskDetails.issueType);

				vscode.window.showInformationMessage(
					`✅ Jira task created successfully! Found ${jiraTaskContent.wcagCriteria?.length || 0} WCAG criteria to address.`,
					"Copy to Clipboard",
					"Save to File"
				).then(action => {
					if (action === "Copy to Clipboard") {
						vscode.env.clipboard.writeText(jiraTaskContent.content!);
						vscode.window.showInformationMessage("📋 Jira task content copied to clipboard!");
					} else if (action === "Save to File") {
						saveJiraTaskToFile(jiraTaskContent.content!, fileName);
					}
				});
			} else {
				// Record error
				statisticsManager.recordError("jira_task_creation_failed", jiraTaskContent.error || "Unknown error");

				vscode.window.showErrorMessage(
					`❌ Jira task creation failed: ${jiraTaskContent.error || "Unknown error"}`
				);
			}
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		statisticsManager.recordError("jira_task_exception", errorMessage);

		vscode.window.showErrorMessage(`❌ Jira task creation error: ${errorMessage}`);
		logger.error("Jira task creation error:", error);
	}
}

async function getJiraTaskDetails(customPrompt: string, includeCustomPrompt: boolean): Promise<{
	priority: string;
	component: string;
	issueType: string;
	customPrompt?: string;
} | null> {
	// Get issue type first
	const issueType = await vscode.window.showQuickPick([
		{ label: "🐛 Bug", value: "Bug", description: "Accessibility defect that needs to be fixed" },
		{ label: "📖 Story", value: "Story", description: "User story for accessibility improvement" },
		{ label: "📋 Task", value: "Task", description: "Technical task for accessibility enhancement" },
		{ label: "✨ Improvement", value: "Improvement", description: "Enhancement to existing accessibility" }
	], {
		title: "Select Issue Type",
		placeHolder: "Choose the Jira issue type for this WCAG task"
	});

	if (!issueType) return null;

	// Get task priority
	const priority = await vscode.window.showQuickPick([
		{ label: "🔴 Critical", value: "Critical", description: "Blocks accessibility for many users" },
		{ label: "🟠 High", value: "High", description: "Significant accessibility barrier" },
		{ label: "🟡 Medium", value: "Medium", description: "Important accessibility improvement" },
		{ label: "🟢 Low", value: "Low", description: "Nice-to-have accessibility enhancement" }
	], {
		title: "Select Task Priority",
		placeHolder: "Choose the priority level for this WCAG task"
	});

	if (!priority) return null;

	// Get component/area
	const component = await vscode.window.showQuickPick([
		{ label: "🖼️ Images & Media", value: "images", description: "Alt text, captions, audio descriptions" },
		{ label: "🔗 Navigation & Links", value: "navigation", description: "Link text, skip links, breadcrumbs" },
		{ label: "📝 Forms & Input", value: "forms", description: "Labels, validation, instructions" },
		{ label: "🎨 Color & Contrast", value: "color", description: "Color contrast, color-only information" },
		{ label: "⌨️ Keyboard Access", value: "keyboard", description: "Tab order, focus management" },
		{ label: "🏗️ Structure & Semantics", value: "structure", description: "Headings, landmarks, ARIA" },
		{ label: "📱 Responsive & Mobile", value: "responsive", description: "Mobile accessibility, touch targets" },
		{ label: "🔊 Audio & Video", value: "media", description: "Captions, transcripts, controls" },
		{ label: "🌐 Other", value: "other", description: "General accessibility improvements" }
	], {
		title: "Select Component/Area",
		placeHolder: "Choose the main accessibility area to focus on"
	});

	if (!component) return null;

	let finalCustomPrompt = customPrompt;

	// Ask for custom prompt if configured or if user wants to provide one
	if (includeCustomPrompt || !customPrompt) {
		const promptInput = await vscode.window.showInputBox({
			title: "Custom AI Prompt (Optional)",
			prompt: "Enter additional context or specific requirements for the Jira task",
			value: customPrompt,
			placeHolder: "e.g., Focus on screen reader compatibility, include testing steps...",
			ignoreFocusOut: true
		});

		if (promptInput !== undefined) {
			finalCustomPrompt = promptInput;
		}
	}

	return {
		priority: priority.value,
		component: component.value,
		issueType: issueType.value,
		customPrompt: finalCustomPrompt
	};
}

async function generateJiraTaskContent(
	provider: any,
	code: string,
	language: string,
	fileName: string,
	taskDetails: {
		priority: string;
		component: string;
		issueType: string;
		customPrompt?: string;
	},
	responseLanguage: "en" | "tr" = "en"
): Promise<{
	success: boolean;
	content?: string;
	wcagCriteria?: string[];
	error?: string;
	tokensUsed?: number;
	model?: string;
}> {
	// Build the system prompt from the dedicated prompt module
	const basePrompt = buildJiraSystemPrompt({
		code,
		language,
		fileName,
		issueType: taskDetails.issueType,
		component: taskDetails.component,
		priority: taskDetails.priority,
		responseLanguage,
		customPrompt: taskDetails.customPrompt
	});

	try {
		// Use chat() instead of improveCode() to send the Jira prompt directly to the AI
		// without wrapping it in the WCAG code-improvement system prompt (buildWCAGPrompt)
		const result = await provider.chat(basePrompt);

		if (result.success && result.content) {
			// Extract WCAG criteria from the response
			const wcagCriteria = extractWcagCriteriaFromJiraContent(result.content);

			return {
				success: true,
				content: result.content,
				wcagCriteria,
				tokensUsed: result.tokensUsed,
				model: result.model
			};
		} else {
			return {
				success: false,
				error: result.error || "Failed to generate Jira task content"
			};
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		};
	}
}


function extractWcagCriteriaFromJiraContent(content: string): string[] {
	const wcagPattern = /(\d+\.\d+\.\d+)/g;
	const matches = content.match(wcagPattern) || [];
	return [...new Set(matches)]; // Remove duplicates
}

async function showJiraTaskContent(content: string, fileName: string, wcagCriteria?: string[], issueType?: string): Promise<void> {
	const panel = vscode.window.createWebviewPanel(
		"accessimindJiraTask",
		"🎫 Jira Task - WCAG Analysis",
		vscode.ViewColumn.Beside,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	const summary = extractSummary(content);
	const priority = extractPriority(content);
	const description = extractDescription(content);

	// Prepare JSON export data with Summary first
	const jiraJson = {
		summary: summary,
		description: description,
		issueType: issueType || "Task",
		priority: priority,
		labels: ["accessibility", "wcag", ...wcagCriteria?.map(c => `wcag-${c}`) || []],
		wcagCriteria: wcagCriteria || [],
		fileName: fileName,
		createdAt: new Date().toISOString()
	};

	panel.webview.html = getJiraTaskWebviewContent(content, fileName, jiraJson, wcagCriteria || [], summary, description);

	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case "close":
				panel.dispose();
				break;
			case "copyToClipboard":
				await vscode.env.clipboard.writeText(content);
				vscode.window.showInformationMessage("📋 Content copied to clipboard!");
				break;
			case "exportJson":
				await exportJiraJson(jiraJson, fileName);
				break;
			case "exportMarkdown":
				await saveJiraTaskToFile(content, fileName);
				break;
			case "openExternal":
				if (message.url) {
					vscode.env.openExternal(vscode.Uri.parse(message.url));
				}
				break;
		}
	});
}

function extractSummary(content: string): string {
	const summaryMatch = content.match(/##\s*Summary\s*\n([^\n]+)/i);
	return summaryMatch ? summaryMatch[1].trim() : "WCAG Accessibility Improvement";
}

function extractPriority(content: string): string {
	const priorityMatch = content.match(/Priority[:\s]+(Critical|High|Medium|Low)/i);
	return priorityMatch ? priorityMatch[1] : "Medium";
}

function extractDescription(content: string): string {
	const descMatch = content.match(/##\s*Description\s*\n([\s\S]*?)(?=##|$)/i);
	if (descMatch) {
		return descMatch[1].trim();
	}
	// Fallback: remove summary and use rest as description
	return content.replace(/##\s*Summary\s*\n[^\n]+\n?/i, '').trim();
}

async function exportJiraJson(jiraJson: any, fileName: string): Promise<void> {
	const defaultName = `${fileName.split('.')[0]}_jira_${new Date().toISOString().split('T')[0]}.json`;

	const uri = await vscode.window.showSaveDialog({
		defaultUri: vscode.Uri.file(defaultName),
		filters: { "JSON": ["json"] },
		saveLabel: "Export Jira JSON"
	});

	if (uri) {
		await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(jiraJson, null, 2), 'utf8'));
		vscode.window.showInformationMessage(`💾 Jira JSON exported to: ${uri.fsPath}`);
	}
}

async function saveJiraTaskToFile(content: string, fileName: string): Promise<void> {
	const defaultFileName = `${fileName.split('.')[0]}_jira_task_${new Date().toISOString().split('T')[0]}.md`;

	const uri = await vscode.window.showSaveDialog({
		defaultUri: vscode.Uri.file(defaultFileName),
		filters: {
			'Markdown': ['md'],
			'Text': ['txt'],
			'All Files': ['*']
		},
		saveLabel: "Save Jira Task"
	});

	if (uri) {
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
		vscode.window.showInformationMessage(`💾 Jira task saved to: ${uri.fsPath}`);
	}
}

function getJiraTaskWebviewContent(content: string, fileName: string, jiraJson: any, wcagCriteria: string[], summary: string, description: string): string {
	const escapedContent = content
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');

	const escapedSummary = summary
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	const escapedDesc = description.substring(0, 500)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Jira Task - WCAG Analysis</title>
	<style>
		:root {
			--bg-primary: var(--vscode-editor-background);
			--bg-secondary: var(--vscode-input-background);
			--text-primary: var(--vscode-foreground);
			--text-secondary: var(--vscode-descriptionForeground);
			--accent: var(--vscode-button-background);
			--accent-hover: var(--vscode-button-hoverBackground);
			--border: var(--vscode-panel-border);
			--focus: var(--vscode-focusBorder);
			--success: #4caf50;
			--warning: #ff9800;
			--error: #f44336;
		}

		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: var(--vscode-font-family);
			background: var(--bg-primary);
			color: var(--text-primary);
			line-height: 1.6;
			padding: 0;
			margin: 0;
		}

		.container {
			max-width: 900px;
			margin: 0 auto;
			padding: 20px;
		}

		/* Header */
		.header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			padding-bottom: 16px;
			border-bottom: 1px solid var(--border);
			margin-bottom: 20px;
			gap: 16px;
			flex-wrap: wrap;
		}

		.header-info h1 {
			font-size: 1.4rem;
			font-weight: 600;
			display: flex;
			align-items: center;
			gap: 10px;
			margin-bottom: 8px;
		}

		.header-meta {
			font-size: 0.85rem;
			color: var(--text-secondary);
		}

		.header-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}

		/* Buttons */
		.btn {
			padding: 8px 16px;
			border-radius: 6px;
			font-weight: 500;
			font-size: 0.85rem;
			cursor: pointer;
			transition: all 0.2s;
			display: inline-flex;
			align-items: center;
			gap: 6px;
			min-height: 36px;
		}

		.btn:focus {
			outline: 2px solid var(--focus);
			outline-offset: 2px;
		}

		.btn-primary {
			background: var(--accent);
			color: var(--vscode-button-foreground);
			border: none;
		}

		.btn-primary:hover {
			background: var(--accent-hover);
		}

		.btn-secondary {
			background: transparent;
			color: var(--text-primary);
			border: 1px solid var(--border);
		}

		.btn-secondary:hover {
			background: var(--bg-secondary);
		}

		.btn-close {
			background: transparent;
			color: var(--text-primary);
			border: 1px solid var(--border);
		}

		.btn-close:hover {
			background: var(--error);
			color: white;
			border-color: var(--error);
		}

		/* WCAG Tags */
		.wcag-tags {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			margin-bottom: 20px;
		}

		.wcag-tag {
			background: var(--accent);
			color: var(--vscode-button-foreground);
			padding: 4px 10px;
			border-radius: 12px;
			font-size: 0.8rem;
			font-weight: 500;
		}

		/* WCAG Criteria List - Linked Items */
		.wcag-criteria-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.wcag-criteria-item {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 12px 16px;
			background: var(--bg-primary);
			border: 1px solid var(--border);
			border-radius: 8px;
			text-decoration: none;
			color: var(--text-primary);
			transition: all 0.2s ease;
			cursor: pointer;
		}

		.wcag-criteria-item:hover {
			border-color: var(--accent);
			background: var(--bg-secondary);
			transform: translateX(4px);
		}

		.wcag-criteria-item:focus {
			outline: 2px solid var(--focus);
			outline-offset: 2px;
		}

		.wcag-number {
			font-family: monospace;
			font-weight: 600;
			color: var(--accent);
			min-width: 90px;
		}

		.wcag-title {
			flex: 1;
			font-weight: 500;
		}

		.wcag-level {
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 0.75rem;
			font-weight: 600;
		}

		.badge-a {
			background: #4caf50;
			color: white;
		}

		.badge-aa {
			background: #2196f3;
			color: white;
		}

		.badge-aaa {
			background: #9c27b0;
			color: white;
		}

		.wcag-link-icon {
			color: var(--text-secondary);
			font-size: 0.9rem;
			transition: transform 0.2s;
		}

		.wcag-criteria-item:hover .wcag-link-icon {
			transform: translate(2px, -2px);
			color: var(--accent);
		}

		/* Content */
		.content-section {
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: 12px;
			padding: 20px;
			margin-bottom: 20px;
		}

		.section-title {
			font-size: 1rem;
			font-weight: 600;
			margin-bottom: 12px;
			display: flex;
			align-items: center;
			gap: 8px;
			color: var(--accent);
		}

		.markdown-content {
			white-space: pre-wrap;
			font-size: 0.9rem;
			line-height: 1.7;
		}

		.markdown-content h2 {
			color: var(--accent);
			margin-top: 20px;
			margin-bottom: 10px;
			font-size: 1.1rem;
		}

		.markdown-content h3 {
			margin-top: 16px;
			margin-bottom: 8px;
			font-size: 1rem;
		}

		.markdown-content ul, .markdown-content ol {
			margin-left: 20px;
			margin-bottom: 12px;
		}

		.markdown-content li {
			margin-bottom: 4px;
		}

		.markdown-content code {
			background: var(--bg-primary);
			padding: 2px 6px;
			border-radius: 4px;
			font-family: monospace;
			font-size: 0.85em;
		}

		.markdown-content pre {
			background: var(--bg-primary);
			padding: 12px;
			border-radius: 6px;
			overflow-x: auto;
			margin: 12px 0;
		}

		/* JSON Preview */
		.json-preview {
			background: var(--bg-primary);
			border: 1px solid var(--border);
			border-radius: 8px;
			padding: 12px;
			font-family: monospace;
			font-size: 0.8rem;
			overflow-x: auto;
			max-height: 300px;
			overflow-y: auto;
		}

		/* Actions Bar */
		.actions-bar {
			display: flex;
			gap: 12px;
			justify-content: flex-end;
			padding-top: 20px;
			border-top: 1px solid var(--border);
			flex-wrap: wrap;
		}

		/* Screen Reader */
		.sr-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			border: 0;
		}

		/* Live Region */
		[aria-live] {
			position: absolute;
			left: -10000px;
			width: 1px;
			height: 1px;
			overflow: hidden;
		}

		@media (max-width: 600px) {
			.header {
				flex-direction: column;
			}
			.header-actions {
				width: 100%;
				justify-content: flex-end;
			}
		}
	</style>
</head>
<body>
	<div class="container" role="main" aria-label="Jira Task WCAG Analysis Results">
		<div aria-live="polite" aria-atomic="true" id="announcer" class="sr-only"></div>
		
		<!-- Skip to main content link for screen readers -->
		<a href="#summary-section" class="sr-only" style="position:absolute;left:-10000px;">Skip to Summary</a>
		
		<!-- Header with accessible close button -->
		<header class="header" role="banner">
			<div class="header-info">
				<h1 id="page-title">🎫 Jira ${jiraJson.issueType} Generated</h1>
				<p class="header-meta">
					📄 File: <strong>${fileName}</strong> | 
					🕐 Created: ${new Date().toLocaleString()}
				</p>
			</div>
			<div class="header-actions">
				<button 
					class="btn btn-close" 
					onclick="closePanel()" 
					aria-label="Close Jira task panel"
					title="Close panel (Escape key)"
					type="button"
					tabindex="0">
					<span aria-hidden="true">✕</span>
					<span>Close</span>
				</button>
			</div>
		</header>

		<!-- Summary Section - Most Important, First -->
		<section id="summary-section" class="content-section" aria-labelledby="summary-title" style="border-left: 4px solid var(--accent);">
			<h2 class="section-title" id="summary-title">📋 Summary</h2>
			<p style="font-size: 1.1rem; font-weight: 500; line-height: 1.5;" role="text">
				${escapedSummary}
			</p>
		</section>

		<!-- Issue Type and Priority Info -->
		<section class="content-section" aria-labelledby="meta-title">
			<h2 class="section-title" id="meta-title">📌 Issue Information</h2>
			<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
				<div>
					<strong>Issue Type:</strong>
					<span class="wcag-tag" style="margin-left: 8px;">${jiraJson.issueType}</span>
				</div>
				<div>
					<strong>Priority:</strong>
					<span class="wcag-tag" style="margin-left: 8px;">${jiraJson.priority}</span>
				</div>
			</div>
		</section>

		<!-- Description Section -->
		<section class="content-section" aria-labelledby="desc-title">
			<h2 class="section-title" id="desc-title">📝 Description</h2>
			<div class="markdown-content" role="article" tabindex="0">
				${escapedDesc}${description.length > 500 ? '...' : ''}
			</div>
		</section>

		<!-- WCAG Criteria Section -->
		${wcagCriteria.length > 0 ? `
		<section class="content-section" aria-labelledby="wcag-criteria-title">
			<h2 class="section-title" id="wcag-criteria-title">📋 Related WCAG Criteria</h2>
			<div class="wcag-criteria-list" role="list" aria-label="WCAG criteria affected">
				${wcagCriteria.map(c => {
		const info = getWcagCriteriaInfo(c);
		return `
					<a href="${info.url}" 
					   class="wcag-criteria-item" 
					   role="listitem"
					   target="_blank"
					   rel="noopener noreferrer"
					   title="Open WCAG ${c} documentation"
					   onclick="openExternalLink('${info.url}'); return false;">
						<span class="wcag-number">WCAG ${c}</span>
						<span class="wcag-title">${info.title}</span>
						<span class="wcag-level badge-${info.level.toLowerCase()}">${info.level}</span>
						<span class="wcag-link-icon" aria-hidden="true">↗</span>
					</a>`;
	}).join('')}
			</div>
		</section>
		` : ''}

		<!-- Content Section -->
		<section class="content-section" aria-labelledby="content-title">
			<h2 class="section-title" id="content-title">📝 Task Details</h2>
			<div class="markdown-content" role="article">
				${formatMarkdown(escapedContent)}
			</div>
		</section>

		<!-- JSON Preview -->
		<section class="content-section" aria-labelledby="json-title">
			<h2 class="section-title" id="json-title">📦 Jira JSON Export Preview</h2>
			<pre class="json-preview" role="code" tabindex="0">${JSON.stringify(jiraJson, null, 2)}</pre>
		</section>

		<!-- Actions -->
		<div class="actions-bar">
			<button class="btn btn-primary" onclick="exportJson()" aria-label="Export as Jira compatible JSON">
				📤 Export Jira JSON
			</button>
			<button class="btn btn-secondary" onclick="exportMarkdown()" aria-label="Export as Markdown file">
				📄 Export MD
			</button>
			<button class="btn btn-secondary" onclick="copyToClipboard()" aria-label="Copy task content to clipboard">
				📋 Copy Content
			</button>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		function announce(message) {
			document.getElementById('announcer').textContent = message;
		}

		function closePanel() {
			announce('Closing Jira task panel');
			vscode.postMessage({ command: 'close' });
		}

		function copyToClipboard() {
			announce('Copying content to clipboard');
			vscode.postMessage({ command: 'copyToClipboard' });
		}

		function openExternalLink(url) {
			announce('Opening WCAG documentation');
			vscode.postMessage({ command: 'openExternal', url: url });
		}

		function exportJson() {
			announce('Opening JSON export dialog');
			vscode.postMessage({ command: 'exportJson' });
		}

		function exportMarkdown() {
			announce('Opening Markdown export dialog');
			vscode.postMessage({ command: 'exportMarkdown' });
		}

		// Keyboard accessibility
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				closePanel();
			}
		});
	</script>
</body>
</html>`;
}

function formatMarkdown(text: string): string {
	return text
		.replace(/^## (.+)$/gm, '<h2>$1</h2>')
		.replace(/^### (.+)$/gm, '<h3>$1</h3>')
		.replace(/^- \[ \] (.+)$/gm, '<li>☐ $1</li>')
		.replace(/^- \[x\] (.+)$/gm, '<li>☑ $1</li>')
		.replace(/^- (.+)$/gm, '<li>$1</li>')
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\n/g, '<br>');
} 