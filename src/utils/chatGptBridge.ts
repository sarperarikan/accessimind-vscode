import * as vscode from "vscode";
import {
	buildChatGptIntegrationUrl,
	configureChatGptAuth,
	getChatGptIntegrationConfig,
	isChatGptIntegrationConfigured,
	openChatGptAuthGuide,
} from "./chatGptAuth";

export interface ChatGptBridgePayload {
    prompt: string;
    url: string;
    authenticatedUrl?: string;
}

export function buildChatGptPrompt(context: {
    instruction: string;
    fileName?: string;
    language?: string;
    code?: string;
}): string {
    return [
        "You are AccessiMind, helping with WCAG 2.2 accessibility engineering.",
        "Review the context below and respond with production-ready guidance or code.",
        "Preserve the existing product behavior and visual design unless explicitly requested.",
        "",
        `Instruction: ${context.instruction}`,
        context.fileName ? `File: ${context.fileName}` : "",
        context.language ? `Language: ${context.language}` : "",
        context.code ? `Code:\n\`\`\`${context.language || ""}\n${context.code.slice(0, 14000)}\n\`\`\`` : "",
    ].filter(Boolean).join("\n");
}

export function buildChatGptUrl(prompt: string): string {
    const url = new URL("https://chatgpt.com/");
    url.searchParams.set("q", prompt.slice(0, 6000));
    return url.toString();
}

export async function createChatGptBridgePayload(): Promise<ChatGptBridgePayload | undefined> {
    const editor = vscode.window.activeTextEditor;
    const instruction = await vscode.window.showInputBox({
        title: "AccessiMind: Send to ChatGPT",
        prompt: "Describe what ChatGPT should do with the current context.",
        placeHolder: "Review this file for WCAG 2.2 production risks",
        ignoreFocusOut: true,
    });

    if (!instruction) {
        return undefined;
    }

    const code = editor
        ? editor.selection.isEmpty
            ? editor.document.getText()
            : editor.document.getText(editor.selection)
        : undefined;

    const prompt = buildChatGptPrompt({
        instruction,
        fileName: editor?.document.fileName,
        language: editor?.document.languageId,
        code,
    });

    return {
        prompt,
        url: buildChatGptUrl(prompt),
        authenticatedUrl: isChatGptIntegrationConfigured()
            ? buildChatGptIntegrationUrl(prompt)
            : undefined,
    };
}

export async function openChatGptBridge(): Promise<void> {
    const payload = await createChatGptBridgePayload();
    if (!payload) {
        return;
    }

    await vscode.env.clipboard.writeText(payload.prompt);
    const chatGptConfig = getChatGptIntegrationConfig();
    const authConfigured = isChatGptIntegrationConfigured(chatGptConfig);
    const action = await vscode.window.showInformationMessage(
        authConfigured
            ? "AccessiMind prompt copied. You can open the configured ChatGPT app for account-authorized analysis."
            : "AccessiMind prompt copied. Configure ChatGPT auth to route analysis through a ChatGPT Apps SDK/MCP app.",
        authConfigured ? "Open Auth ChatGPT" : "Open ChatGPT",
        "Copy URL",
        "Configure Auth",
        "Auth Guide"
    );

    if (action === "Copy URL") {
        await vscode.env.clipboard.writeText(payload.authenticatedUrl || payload.url);
        return;
    }

    if (action === "Configure Auth") {
        await configureChatGptAuth();
        return;
    }

    if (action === "Auth Guide") {
        await openChatGptAuthGuide();
        return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(payload.authenticatedUrl || payload.url));
}

export { configureChatGptAuth, openChatGptAuthGuide };
