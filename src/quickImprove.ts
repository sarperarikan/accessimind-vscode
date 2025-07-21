// quickImprove.ts
import * as vscode from "vscode";

export class QuickImprove {
	constructor() {}

	public async improveCurrentFile() {
		vscode.window.showInformationMessage("Quick improve file - coming soon!");
	}

	public async improveSelection() {
		vscode.window.showInformationMessage("Quick improve selection - coming soon!");
	}
}

// Legacy function for backward compatibility
export async function quickImproveCode() {
	const quickImprove = new QuickImprove();
	await quickImprove.improveCurrentFile();
} 