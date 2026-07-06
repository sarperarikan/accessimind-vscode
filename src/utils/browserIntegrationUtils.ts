import * as vscode from "vscode";

export type BrowserLaunchMode = "new-isolated-window" | "attach-existing-debug-session";

export interface BrowserIntegrationConfig {
    enabled: boolean;
    browserPath: string;
    launchMode: BrowserLaunchMode;
}

const DEFAULT_BROWSER_CONFIG: BrowserIntegrationConfig = {
    enabled: false,
    browserPath: "",
    launchMode: "new-isolated-window"
};

export function getBrowserIntegrationConfig(
    config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer")
): BrowserIntegrationConfig {
    const raw = (config.get("browserIntegration") as Partial<BrowserIntegrationConfig> | undefined) || {};

    return {
        enabled: raw.enabled ?? DEFAULT_BROWSER_CONFIG.enabled,
        browserPath: raw.browserPath ?? DEFAULT_BROWSER_CONFIG.browserPath,
        launchMode: raw.launchMode ?? DEFAULT_BROWSER_CONFIG.launchMode
    };
}

export async function updateBrowserIntegrationConfig(
    partial: Partial<BrowserIntegrationConfig>,
    config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wcagEnhancer")
): Promise<void> {
    const current = getBrowserIntegrationConfig(config);
    await config.update(
        "browserIntegration",
        {
            ...current,
            ...partial
        },
        vscode.ConfigurationTarget.Global
    );
}
