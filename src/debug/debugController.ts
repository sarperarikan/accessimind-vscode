// debugController.ts
import * as vscode from "vscode";
import { analyzeWcagCompliance } from "./debugUtils";
import { validateWcagCompliance } from "../utils/validationUtils";
import { logger } from "../utils/logger";
import { StatisticsManager } from "../utils/statisticsManager";

export class DebugController {
	constructor() {}

	public async startDebugMode() {
		vscode.window.showInformationMessage("Debug mode - coming soon!");
	}

	public async analyzeCurrentFile() {
		vscode.window.showInformationMessage("Debug analyze mode - coming soon!");
	}

	public async fixCurrentFile() {
		vscode.window.showInformationMessage("Debug fix mode - coming soon!");
	}
}

// Export function for extension.ts
export async function debugController() {
	const controller = new DebugController();
	await controller.startDebugMode();
}

// Legacy function for backward compatibility
export async function activateDebugMode(context: vscode.ExtensionContext) {
	const controller = new DebugController();
	await controller.startDebugMode();
}

async function showAnalysisResults(
	compliance: { compliant: boolean; issues: string[] },
	detailedAnalysis: any,
	editor: vscode.TextEditor,
	selection: vscode.Selection,
	context: vscode.ExtensionContext
) {
	// Sonuç paneli oluştur
	const panel = vscode.window.createWebviewPanel(
		"wcagAnalysis",
		"WCAG 2.2 Uyumluluk Analizi",
		vscode.ViewColumn.Beside,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	// HTML içeriği oluştur
	const htmlContent = generateAnalysisHtml(compliance, detailedAnalysis);
	panel.webview.html = htmlContent;

	// Mesaj handler'ı
	panel.webview.onDidReceiveMessage(
		message => {
			switch (message.command) {
				case "fixIssue":
					fixIssue(message.issue, editor, selection);
					break;
				case "showDetails":
					showIssueDetails(message.issue);
					break;
			}
		},
		undefined,
		context.subscriptions
	);

	// Sonuç özeti göster
	const summary = generateSummary(compliance, detailedAnalysis);
	vscode.window.showInformationMessage(summary);
}

function generateAnalysisHtml(compliance: any, detailedAnalysis: any): string {
	const issues = compliance.issues;
	const hasIssues = issues.length > 0;
	
	return `
<!DOCTYPE html>
<html lang="tr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>WCAG 2.2 Analiz Sonuçları</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			margin: 0;
			padding: 20px;
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
		}
		
		.header {
			background-color: var(--vscode-editor-background);
			padding: 20px;
			border-bottom: 1px solid var(--vscode-panel-border);
			margin-bottom: 20px;
		}
		
		.status {
			display: inline-block;
			padding: 8px 16px;
			border-radius: 4px;
			font-weight: bold;
			margin-bottom: 10px;
		}
		
		.status.compliant {
			background-color: #16a34a;
			color: white;
		}
		
		.status.non-compliant {
			background-color: #dc2626;
			color: white;
		}
		
		.issue-list {
			list-style: none;
			padding: 0;
		}
		
		.issue-item {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			margin-bottom: 10px;
			padding: 15px;
		}
		
		.issue-title {
			font-weight: bold;
			margin-bottom: 5px;
			color: var(--vscode-errorForeground);
		}
		
		.issue-description {
			margin-bottom: 10px;
			color: var(--vscode-descriptionForeground);
		}
		
		.issue-actions {
			display: flex;
			gap: 10px;
		}
		
		.btn {
			padding: 6px 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
		}
		
		.btn-primary {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		
		.btn-secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		
		.stats {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 15px;
			margin-bottom: 20px;
		}
		
		.stat-card {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 15px;
			text-align: center;
		}
		
		.stat-number {
			font-size: 24px;
			font-weight: bold;
			margin-bottom: 5px;
		}
		
		.stat-label {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>WCAG 2.2 Uyumluluk Analizi</h1>
		<div class="status ${hasIssues ? "non-compliant" : "compliant"}">
			${hasIssues ? "Uyumluluk Sorunları Tespit Edildi" : "WCAG 2.2 Uyumlu"}
		</div>
	</div>
	
	<div class="stats">
		<div class="stat-card">
			<div class="stat-number">${issues.length}</div>
			<div class="stat-label">Tespit Edilen Sorun</div>
		</div>
		<div class="stat-card">
			<div class="stat-number">${detailedAnalysis.totalElements || 0}</div>
			<div class="stat-label">Toplam Element</div>
		</div>
		<div class="stat-card">
			<div class="stat-number">${detailedAnalysis.accessibleElements || 0}</div>
			<div class="stat-label">Erişilebilir Element</div>
		</div>
	</div>
	
	${hasIssues ? `
		<h2>Tespit Edilen Sorunlar</h2>
		<ul class="issue-list">
			${issues.map((issue: string, index: number) => `
				<li class="issue-item">
					<div class="issue-title">Sorun ${index + 1}</div>
					<div class="issue-description">${issue}</div>
					<div class="issue-actions">
						<button class="btn btn-primary" onclick="fixIssue('${issue}')">
							Otomatik Düzelt
						</button>
						<button class="btn btn-secondary" onclick="showDetails('${issue}')">
							Detaylar
						</button>
					</div>
				</li>
			`).join("")}
		</ul>
	` : `
		<div style="text-align: center; padding: 40px;">
			<h2>🎉 Tebrikler!</h2>
			<p>Kodunuz WCAG 2.2 standartlarına uygun görünüyor.</p>
		</div>
	`}
	
	<script>
		const vscode = acquireVsCodeApi();
		
		function fixIssue(issue) {
			vscode.postMessage({
				command: 'fixIssue',
				issue: issue
			});
		}
		
		function showDetails(issue) {
			vscode.postMessage({
				command: 'showDetails',
				issue: issue
			});
		}
	</script>
</body>
</html>`;
}

function generateSummary(compliance: any, detailedAnalysis: any): string {
	const issues = compliance.issues;
	
	if (issues.length === 0) {
		return "✅ Kod WCAG 2.2 standartlarına uygun!";
	}
	
	return `⚠️ ${issues.length} WCAG 2.2 uyumluluk sorunu tespit edildi. Detaylar için paneli kontrol edin.`;
}

async function fixIssue(issue: string, editor: vscode.TextEditor, selection: vscode.Selection) {
	try {
		// Basit otomatik düzeltmeler
		let fixedCode = editor.document.getText(selection);
		
		if (issue.includes("Form elementleri için label eksik")) {
			fixedCode = addMissingLabels(fixedCode);
		} else if (issue.includes("Butonlar için ARIA etiketleri eksik")) {
			fixedCode = addMissingAriaLabels(fixedCode);
		} else if (issue.includes("Resimler için alt text eksik")) {
			fixedCode = addMissingAltText(fixedCode);
		} else if (issue.includes("Tablolar için başlık hücreleri eksik")) {
			fixedCode = addMissingTableHeaders(fixedCode);
		}
		
		// Düzeltilmiş kodu uygula
		await editor.edit(editBuilder => {
			editBuilder.replace(selection, fixedCode);
		});
		
		vscode.window.showInformationMessage("Sorun otomatik olarak düzeltildi!");
		
	} catch (error) {
		logger.error("Fix issue error:", error);
		vscode.window.showErrorMessage("Otomatik düzeltme başarısız oldu.");
	}
}

function addMissingLabels(code: string): string {
	return code.replace(
		/<input([^>]*?)>/g,
		(match, attributes) => {
			const idMatch = attributes.match(/id="([^"]*)"/);
			const nameMatch = attributes.match(/name="([^"]*)"/);
			const typeMatch = attributes.match(/type="([^"]*)"/);
			
			const id = idMatch ? idMatch[1] : nameMatch ? nameMatch[1] : "input";
			const name = nameMatch ? nameMatch[1] : id;
			const type = typeMatch ? typeMatch[1] : "text";
			
			const labelText = getLabelText(name, type);
			
			return `<label for="${id}">${labelText}</label>\n<input${attributes}>`;
		}
	);
}

function addMissingAriaLabels(code: string): string {
	return code.replace(
		/<button([^>]*?)>([^<]*)<\/button>/g,
		(match, attributes, text) => {
			if (attributes.includes("aria-label")) return match;
			
			const ariaLabel = text.trim() || "Buton";
			return `<button${attributes} aria-label="${ariaLabel}">${text}</button>`;
		}
	);
}

function addMissingAltText(code: string): string {
	return code.replace(
		/<img([^>]*?)>/g,
		(match, attributes) => {
			if (attributes.includes("alt=")) return match;
			
			const srcMatch = attributes.match(/src="([^"]*)"/);
			const src = srcMatch ? srcMatch[1] : "resim";
			const fileName = src.split("/").pop()?.split(".")[0] || "resim";
			const altText = fileName.replace(/[-_]/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
			
			return `<img${attributes} alt="${altText}">`;
		}
	);
}

function addMissingTableHeaders(code: string): string {
	let fixedCode = code;
	
	// Tablo başlık hücreleri için scope ekleme
	fixedCode = fixedCode.replace(
		/<th([^>]*?)>/g,
		(match, attributes) => {
			if (attributes.includes("scope=")) return match;
			return `<th${attributes} scope="col">`;
		}
	);
	
	return fixedCode;
}

function getLabelText(name: string, type: string): string {
	const labelMap: { [key: string]: string } = {
		"name": "Ad Soyad",
		"email": "E-posta",
		"password": "Şifre",
		"phone": "Telefon",
		"address": "Adres",
		"city": "Şehir",
		"country": "Ülke",
		"zip": "Posta Kodu",
		"username": "Kullanıcı Adı",
		"search": "Arama"
	};
	
	return labelMap[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

async function showIssueDetails(issue: string) {
	const details = getIssueDetails(issue);
	
	await vscode.window.showInformationMessage(
		`Sorun Detayları: ${details}`,
		"Anladım"
	);
}

function getIssueDetails(issue: string): string {
	const detailsMap: { [key: string]: string } = {
		"Form elementleri için label eksik": "Form elementleri için açıklayıcı etiketler eklenmelidir.",
		"Butonlar için ARIA etiketleri eksik": "Butonlar için screen reader uyumlu açıklamalar eklenmelidir.",
		"Resimler için alt text eksik": "Resimler için alternatif metin açıklamaları eklenmelidir.",
		"Tablolar için başlık hücreleri eksik": "Tablolar için başlık hücreleri ve scope tanımları eklenmelidir."
	};
	
	return detailsMap[issue] || "Bu sorun hakkında detaylı bilgi için WCAG 2.2 dokümantasyonunu inceleyin.";
}