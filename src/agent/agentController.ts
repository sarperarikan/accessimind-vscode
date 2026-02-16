// agentController.ts
import * as vscode from "vscode";
import { generateAccessibleCode } from "./agentUtils";
import { validateUserInput } from "../utils/validationUtils";
import { logger } from "../utils/logger";
import { AIProviderManager } from "../utils/aiProvider";
// import { StatisticsManager } from "../utils/statisticsManager"; // Future use

export class AgentController {
	constructor() { }

	public async startAgentMode() {
		try {
			// Timeout koruması
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error("İşlem zaman aşımına uğradı (30 saniye)")), 30000);
			});

			const aiProviderManager = AIProviderManager.getInstance();
			const provider = await aiProviderManager.getCurrentProviderInstance();
			const isConnected = await provider.isAvailable();
			if (!isConnected) {
				const openSettings = "Ayarları Aç";
				const action = await vscode.window.showWarningMessage(
					"Gemini API bağlantısı başarısız. Kod üretimi için ayarlardan API anahtarınızı kontrol edin.",
					openSettings
				);
				if (action === openSettings) {
					await vscode.commands.executeCommand("wcagEnhancer.showSettings");
				}
				return;
			}

			// Kullanıcıdan talimat al
			const userPrompt = await vscode.window.showInputBox({
				prompt: "WCAG 2.2 uyumlu kod üretimi için talimatınızı girin:",
				placeHolder: "Örnek: \"Bu formu erişilebilir hale getir\" veya \"Bu butona ARIA etiketleri ekle\"",
				validateInput: validateUserInput
			});

			if (!userPrompt) {
				vscode.window.showWarningMessage("Talimat girilmedi.");
				return;
			}

			// Progress göster
			await Promise.race([
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: "WCAG 2.2 Uyumlu Kod Üretiliyor...",
					cancellable: false
				}, async (progress) => {
					progress.report({ increment: 0 });

					// Mevcut seçili metni al
					const editor = vscode.window.activeTextEditor;
					const selection = editor?.selection;
					const selectedText = editor?.document.getText(selection) || "";
					const _fileType = editor?.document.languageId || "unknown";

					progress.report({ increment: 50 });

					// Erişilebilir kod üret
					const generatedCode = await generateAccessibleCode(userPrompt, selectedText);

					progress.report({ increment: 100 });

					// İstatistik kaydet
					try {
						// Statistics recording - to be updated with new system
					} catch (error) {
						console.error("Stats recording error:", error);
					}

					// Sonucu göster ve uygula
					await this.showGeneratedCode(generatedCode, editor, selection);
				}),
				timeoutPromise
			]);

		} catch (error) {
			logger.error("Agent mode error:", error);
			const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";

			// Hata istatistiği kaydet
			try {
				const editor = vscode.window.activeTextEditor;
				const _fileType = editor?.document.languageId || "unknown";
				// Error recording - to be updated with new system
			} catch (statsError) {
				console.error("Stats recording error:", statsError);
			}

			vscode.window.showErrorMessage(`Hata oluştu: ${errorMessage}`);
		}
	}

	public async analyzeCurrentFile() {
		// Analyze current file implementation
		vscode.window.showInformationMessage("Agent analyze mode - coming soon!");
	}

	public async improveCurrentFile() {
		// Improve current file implementation
		vscode.window.showInformationMessage("Agent improve mode - coming soon!");
	}

	private async showGeneratedCode(
		generatedCode: string,
		editor: vscode.TextEditor | undefined,
		selection: vscode.Selection | undefined
	) {
		const options = ["Kodu Uygula", "Yeni Dosya Oluştur", "Kopyala", "İptal"];
		const action = await vscode.window.showInformationMessage(
			"WCAG 2.2 uyumlu kod üretildi!",
			...options
		);

		switch (action) {
			case "Kodu Uygula":
				if (editor && selection) {
					await editor.edit(editBuilder => {
						editBuilder.replace(selection, generatedCode);
					});
					vscode.window.showInformationMessage("Kod başarıyla uygulandı!");
				} else {
					// Yeni dosya oluştur
					const document = await vscode.workspace.openTextDocument({
						content: generatedCode,
						language: "html"
					});
					await vscode.window.showTextDocument(document);
				}
				break;

			case "Yeni Dosya Oluştur":
				await this.createNewFile(generatedCode);
				break;

			case "Kopyala":
				await vscode.env.clipboard.writeText(generatedCode);
				vscode.window.showInformationMessage("Kod panoya kopyalandı!");
				break;

			default:
				break;
		}
	}

	private async createNewFile(content: string): Promise<void> {
		try {
			// Dizin seçimi
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage("Çalışma alanı bulunamadı.");
				return;
			}

			const defaultUri = workspaceFolders[0].uri;
			const uri = await vscode.window.showSaveDialog({
				defaultUri: defaultUri,
				filters: {
					"HTML Files": ["html"],
					"All Files": ["*"]
				},
				saveLabel: "WCAG Kod Dosyası Oluştur"
			});

			if (uri) {
				const wsedit = new vscode.WorkspaceEdit();
				wsedit.createFile(uri, { overwrite: true });
				wsedit.insert(uri, new vscode.Position(0, 0), content);
				await vscode.workspace.applyEdit(wsedit);

				// Dosyayı aç
				const document = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(document);

				vscode.window.showInformationMessage(`WCAG uyumlu kod dosyası oluşturuldu: ${uri.fsPath}`);
			}
		} catch (error) {
			logger.error("Create file error:", error);
			vscode.window.showErrorMessage("Dosya oluşturma hatası!");
		}
	}
}

// Export function for extension.ts
export async function agentController() {
	const controller = new AgentController();
	await controller.startAgentMode();
}

// Legacy function for backward compatibility
export async function activateAgentMode(_context: vscode.ExtensionContext) {
	const controller = new AgentController();
	await controller.startAgentMode();
}