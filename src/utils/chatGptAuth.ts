import * as vscode from "vscode";

export interface ChatGptIntegrationConfig {
	enabled?: boolean;
	appUrl?: string;
	mcpServerUrl?: string;
	authNotes?: string;
}

export function getChatGptIntegrationConfig(
	config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer")
): ChatGptIntegrationConfig {
	const value = config.get("chatGptIntegration");
	return value && typeof value === "object" ? { ...(value as ChatGptIntegrationConfig) } : {};
}

export function isChatGptIntegrationConfigured(config = getChatGptIntegrationConfig()): boolean {
	return Boolean(config.enabled && (config.appUrl || config.mcpServerUrl));
}

export function buildChatGptIntegrationUrl(
	prompt: string,
	config = getChatGptIntegrationConfig()
): string {
	const base = config.appUrl || "https://chatgpt.com/";
	const url = new URL(base);
	url.searchParams.set("q", prompt.slice(0, 6000));
	if (config.mcpServerUrl) {
		url.searchParams.set("accessimind_mcp", config.mcpServerUrl);
	}
	return url.toString();
}

export async function configureChatGptAuth(): Promise<void> {
	const workspaceConfig = vscode.workspace.getConfiguration("wcagEnhancer");
	const current = getChatGptIntegrationConfig(workspaceConfig);

	const appUrl = await vscode.window.showInputBox({
		title: "AccessiMind: ChatGPT App URL",
		prompt: "Enter the ChatGPT app or connection URL used after publishing/testing the AccessiMind MCP app.",
		placeHolder: "https://chatgpt.com/g/...",
		value: current.appUrl || "",
		ignoreFocusOut: true,
	});
	if (appUrl === undefined) {
		return;
	}

	const mcpServerUrl = await vscode.window.showInputBox({
		title: "AccessiMind: MCP Server URL",
		prompt: "Enter the remote MCP server URL exposed to ChatGPT for OAuth-authorized AccessiMind tools.",
		placeHolder: "https://your-domain.example/mcp",
		value: current.mcpServerUrl || "",
		ignoreFocusOut: true,
	});
	if (mcpServerUrl === undefined) {
		return;
	}

	const next: ChatGptIntegrationConfig = {
		...current,
		enabled: Boolean(appUrl || mcpServerUrl),
		appUrl: appUrl.trim(),
		mcpServerUrl: mcpServerUrl.trim(),
		authNotes:
			"ChatGPT account-connected analysis requires an Apps SDK/MCP app with OAuth authorization. AccessiMind stores only app/server URLs, not ChatGPT cookies or session tokens.",
	};

	await workspaceConfig.update("chatGptIntegration", next, vscode.ConfigurationTarget.Global);
	vscode.window.showInformationMessage(
		next.enabled
			? "AccessiMind ChatGPT auth bridge configured. Use Open in ChatGPT for account-authorized analysis handoff."
			: "AccessiMind ChatGPT auth bridge disabled."
	);
}

export async function openChatGptAuthGuide(): Promise<void> {
	const config = getChatGptIntegrationConfig();
	const doc = await vscode.workspace.openTextDocument({
		language: "markdown",
		content: `# AccessiMind ChatGPT Auth Integration

AccessiMind cannot safely borrow a user's ChatGPT browser session or cookies for automated analysis.

For account-connected ChatGPT analysis, publish AccessiMind capabilities as a ChatGPT Apps SDK app backed by a remote MCP server:

1. Expose tools such as analyze_accessibility, improve_code, and create_wcag_report from the MCP server.
2. Protect private workspace actions with OAuth authorization-code + PKCE.
3. Connect the app from ChatGPT so ChatGPT launches the OAuth consent flow and attaches bearer tokens to MCP requests.
4. Paste or open AccessiMind analysis prompts through the configured ChatGPT app URL.

Current local configuration:

- Enabled: ${Boolean(config.enabled)}
- ChatGPT app URL: ${config.appUrl || "(not set)"}
- MCP server URL: ${config.mcpServerUrl || "(not set)"}

Official docs:

- Apps SDK authentication: https://developers.openai.com/apps-sdk/build/auth
- MCP authorization for ChatGPT/API integrations: https://developers.openai.com/api/docs/mcp
`,
	});
	await vscode.window.showTextDocument(doc, { preview: false });
}
