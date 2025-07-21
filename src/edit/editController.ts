// editController.ts
import * as vscode from "vscode";
import { applyWcagImprovements } from "./wcagRules";
import { validateHtmlCode } from "../utils/validationUtils";
import { logger } from "../utils/logger";
import { GeminiAPI } from "../utils/geminiApi";
import { StatisticsManager } from "../utils/statisticsManager";

export class EditController {
	constructor() {}

	public async startEditMode() {
		vscode.window.showInformationMessage("Edit mode - coming soon!");
	}

	public async analyzeCurrentFile() {
		vscode.window.showInformationMessage("Edit analyze mode - coming soon!");
	}

	public async improveCurrentFile() {
		vscode.window.showInformationMessage("Edit improve mode - coming soon!");
	}
}

// Export function for extension.ts
export async function editController() {
	const controller = new EditController();
	await controller.startEditMode();
}

// Legacy function for backward compatibility
export async function activateEditMode(context: vscode.ExtensionContext) {
	const controller = new EditController();
	await controller.startEditMode();
}

async function showImprovementOptions(): Promise<string[]> {
	const options = [
		{ label: "Form Erişilebilirliği", value: "form-accessibility" },
		{ label: "ARIA Etiketleri", value: "aria-labels" },
		{ label: "Klavye Navigasyonu", value: "keyboard-navigation" },
		{ label: "Renk Kontrastı", value: "color-contrast" },
		{ label: "Resim Alt Metinleri", value: "image-alt-text" },
		{ label: "Tablo Erişilebilirliği", value: "table-accessibility" },
		{ label: "Hata Mesajları", value: "error-messages" },
		{ label: "Tüm İyileştirmeler", value: "all" }
	];

	const selected = await vscode.window.showQuickPick(options, {
		placeHolder: "Uygulamak istediğiniz iyileştirmeleri seçin",
		canPickMany: true
	});

	if (!selected) return [];

	// "Tüm İyileştirmeler" seçilirse tümünü döndür
	if (selected.some(item => item.value === "all")) {
		return options.filter(item => item.value !== "all").map(item => item.value);
	}

	return selected.map(item => item.value);
}

async function applyImprovedCode(
	improvedCode: string,
	editor: vscode.TextEditor,
	selection: vscode.Selection,
	document: vscode.TextDocument
) {
	const options = ["Kodu Uygula", "Önizleme", "Kopyala", "İptal"];
	const action = await vscode.window.showInformationMessage(
		"WCAG 2.2 iyileştirmeleri tamamlandı!",
		...options
	);

	switch (action) {
		case "Kodu Uygula":
			await editor.edit(editBuilder => {
				if (selection.isEmpty) {
					// Tüm dosyayı değiştir
					const fullRange = new vscode.Range(
						document.positionAt(0),
						document.positionAt(document.getText().length)
					);
					editBuilder.replace(fullRange, improvedCode);
				} else {
					// Sadece seçili kısmı değiştir
					editBuilder.replace(selection, improvedCode);
				}
			});
			vscode.window.showInformationMessage("İyileştirmeler başarıyla uygulandı!");
			break;

		case "Önizleme":
			await showPreview(improvedCode);
			break;

		case "Kopyala":
			await vscode.env.clipboard.writeText(improvedCode);
			vscode.window.showInformationMessage("İyileştirilmiş kod panoya kopyalandı!");
			break;

		default:
			break;
	}
}

async function showPreview(code: string) {
	const document = await vscode.workspace.openTextDocument({
		content: code,
		language: "html"
	});
	
	const previewEditor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
	
	// Preview'ı sadece okunabilir yap
	await vscode.commands.executeCommand("workbench.action.files.setReadonlyInEditor");
}