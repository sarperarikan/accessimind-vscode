import * as vscode from "vscode";
import { normalizeDisabilityFocusGroups } from "./disabilityFocus";

export interface RuntimeSettings {
	showNotifications: boolean;
	autoSave: boolean;
	strictMode: boolean;
	customRulesPath: string;
	contextAwareAnalysis: boolean;
	disabilityFocusGroups: string[];
	jira: {
		baseUrl: string;
		projectKey: string;
		issueType: string;
		autoCreateIssues: boolean;
		priorityMapping: string;
	};
}

export function getRuntimeSettings(): RuntimeSettings {
	const config = vscode.workspace.getConfiguration("wcagEnhancer");
	const interfacePreferences = config.get<Record<string, unknown>>("interfacePreferences", {});
	const jira = config.get<Record<string, unknown>>("jira", {});

	return {
		showNotifications: interfacePreferences.showNotifications !== false,
		autoSave: interfacePreferences.autoSave === true,
		strictMode: config.get("strictMode", false),
		customRulesPath: String(config.get("customRulesPath", "") || ""),
		contextAwareAnalysis: config.get("contextAwareAnalysis", true),
		disabilityFocusGroups: normalizeDisabilityFocusGroups(config.get("analysisDisabilityFocus", [])),
		jira: {
			baseUrl: String(jira.baseUrl || ""),
			projectKey: String(jira.projectKey || ""),
			issueType: String(jira.issueType || "Bug"),
			autoCreateIssues: jira.autoCreateIssues === true,
			priorityMapping: String(jira.priorityMapping || "severity"),
		},
	};
}

export async function readCustomRules(): Promise<string> {
	const settings = getRuntimeSettings();
	if (!settings.customRulesPath.trim()) {
		return "";
	}

	try {
		const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(settings.customRulesPath));
		return Buffer.from(bytes).toString("utf8").trim();
	} catch {
		return "";
	}
}
