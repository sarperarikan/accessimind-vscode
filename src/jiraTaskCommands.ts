import * as vscode from "vscode";
import { AIProviderManager } from "./utils/aiProvider";
import { StatisticsManager } from "./utils/statisticsManager";
import { logger } from "./utils/logger";

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
				taskDetails
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
				
				// Show the generated Jira task content
				await showJiraTaskContent(jiraTaskContent.content!, fileName);
				
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
	customPrompt?: string;
} | null> {
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
		customPrompt?: string;
	}
): Promise<{
	success: boolean;
	content?: string;
	wcagCriteria?: string[];
	error?: string;
	tokensUsed?: number;
	model?: string;
}> {
	const basePrompt = `
You are a WCAG accessibility expert. Analyze the provided code and create a comprehensive Jira task for accessibility improvements.

**Code Analysis Context:**
- File: ${fileName}
- Language: ${language}
- Component Area: ${taskDetails.component}
- Priority: ${taskDetails.priority}

**Requirements:**
1. Analyze the code for WCAG 2.2 Level AA compliance issues
2. Identify specific ARIA techniques that should be implemented
3. Create a detailed Jira task with clear acceptance criteria
4. Include specific code examples and recommendations
5. Reference relevant WCAG success criteria numbers

**Jira Task Format:**
## Summary
[Brief, actionable title]

## Description
[Detailed description of accessibility issues found]

## Acceptance Criteria
- [ ] [Specific, testable criteria]
- [ ] [Include WCAG success criteria references]
- [ ] [ARIA implementation requirements]

## Technical Details
[Code-specific recommendations and examples]

## Testing Steps
[How to verify the fix works]

## WCAG Success Criteria
[List relevant WCAG 2.2 criteria with numbers]

## Priority Justification
[Why this priority level was chosen]

${taskDetails.customPrompt ? `\n**Additional Context:**\n${taskDetails.customPrompt}` : ''}

**Code to Analyze:**
\`\`\`${language}
${code}
\`\`\`

Please provide a professional, actionable Jira task that helps developers understand and implement the required accessibility improvements.
`;

	try {
		const result = await provider.improveCode({
			code: basePrompt,
			fileType: "markdown",
			language: "markdown",
			wcagLevel: "AA" as const,
			includeComments: true,
			responseLanguage: "en" as const
		});

		if (result.success && result.improvedCode) {
			// Extract WCAG criteria from the response
			const wcagCriteria = extractWcagCriteriaFromJiraContent(result.improvedCode);
			
			return {
				success: true,
				content: result.improvedCode,
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

async function showJiraTaskContent(content: string, fileName: string): Promise<void> {
	const jiraUri = vscode.Uri.parse(`untitled:${fileName}_jira_task.md`);
	
	const doc = await vscode.workspace.openTextDocument(jiraUri);
	const edit = new vscode.WorkspaceEdit();
	edit.insert(jiraUri, new vscode.Position(0, 0), content);
	await vscode.workspace.applyEdit(edit);
	
	await vscode.window.showTextDocument(doc, {
		preview: false,
		viewColumn: vscode.ViewColumn.Beside
	});
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