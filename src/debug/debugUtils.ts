export interface WcagAnalysisResult {
	totalElements: number
	accessibleElements: number
	formElements: number
	buttonElements: number
	imageElements: number
	tableElements: number
	missingLabels: number
	missingAriaLabels: number
	missingAltText: number
	missingTableHeaders: number
	contrastIssues: number
	keyboardIssues: number
}

export async function analyzeWcagConformance(code: string): Promise<WcagAnalysisResult> {
	const result: WcagAnalysisResult = {
		totalElements: 0,
		accessibleElements: 0,
		formElements: 0,
		buttonElements: 0,
		imageElements: 0,
		tableElements: 0,
		missingLabels: 0,
		missingAriaLabels: 0,
		missingAltText: 0,
		missingTableHeaders: 0,
		contrastIssues: 0,
		keyboardIssues: 0
	};

	// Toplam element sayısı
	const allElements = code.match(/<[^/][^>]*>/g) || [];
	result.totalElements = allElements.length;

	// Form elementleri
	const formElements = code.match(/<form[^>]*>/g) || [];
	result.formElements = formElements.length;

	// Input elementleri
	const inputElements = code.match(/<input[^>]*>/g) || [];
	const labelElements = code.match(/<label[^>]*>/g) || [];
	result.missingLabels = Math.max(0, inputElements.length - labelElements.length);

	// Buton elementleri
	const buttonElements = code.match(/<button[^>]*>/g) || [];
	result.buttonElements = buttonElements.length;

	// ARIA etiketleri eksik olan butonlar
	const buttonsWithAria = code.match(/<button[^>]*aria-label[^>]*>/g) || [];
	result.missingAriaLabels = Math.max(0, buttonElements.length - buttonsWithAria.length);

	// Resim elementleri
	const imageElements = code.match(/<img[^>]*>/g) || [];
	result.imageElements = imageElements.length;

	// Alt text eksik olan resimler
	const imagesWithAlt = code.match(/<img[^>]*alt=[^>]*>/g) || [];
	result.missingAltText = Math.max(0, imageElements.length - imagesWithAlt.length);

	// Tablo elementleri
	const tableElements = code.match(/<table[^>]*>/g) || [];
	result.tableElements = tableElements.length;

	// Tablo başlık hücreleri
	const tableHeaders = code.match(/<th[^>]*>/g) || [];
	result.missingTableHeaders = Math.max(0, tableElements.length - tableHeaders.length);

	// Renk kontrastı sorunları
	if (code.includes("color:") && !code.includes("background-color:")) {
		result.contrastIssues = 1;
	}

	// Klavye navigasyonu sorunları
	if (code.includes("<button") && !code.includes("tabindex")) {
		result.keyboardIssues = 1;
	}

	// Erişilebilir element sayısı
	result.accessibleElements = result.totalElements -
		result.missingLabels -
		result.missingAriaLabels -
		result.missingAltText -
		result.missingTableHeaders -
		result.contrastIssues -
		result.keyboardIssues;

	return result;
}

export function getWcagScore(analysis: WcagAnalysisResult): number {
	if (analysis.totalElements === 0) return 100;

	const totalIssues = analysis.missingLabels +
		analysis.missingAriaLabels +
		analysis.missingAltText +
		analysis.missingTableHeaders +
		analysis.contrastIssues +
		analysis.keyboardIssues;

	const score = Math.max(0, 100 - (totalIssues / analysis.totalElements) * 100);
	return Math.round(score);
}

export function getWcagLevel(score: number): string {
	if (score >= 95) return "AAA";
	if (score >= 85) return "AA";
	if (score >= 70) return "A";
	return "Non-Conformant";
}

export function generateWcagReport(analysis: WcagAnalysisResult): string {
	const score = getWcagScore(analysis);
	const level = getWcagLevel(score);

	return `
# WCAG 2.2 Uyum Raporu

## Genel Skor: ${score}/100 (Seviye: ${level})

## Element Analizi
- **Toplam Element:** ${analysis.totalElements}
- **Erisilebilir Element:** ${analysis.accessibleElements}
- **Form Elementleri:** ${analysis.formElements}
- **Buton Elementleri:** ${analysis.buttonElements}
- **Resim Elementleri:** ${analysis.imageElements}
- **Tablo Elementleri:** ${analysis.tableElements}

## Tespit Edilen Sorunlar
- **Eksik Label'lar:** ${analysis.missingLabels}
- **Eksik ARIA Etiketleri:** ${analysis.missingAriaLabels}
- **Eksik Alt Text'ler:** ${analysis.missingAltText}
- **Eksik Tablo Basliklari:** ${analysis.missingTableHeaders}
- **Kontrast Sorunlari:** ${analysis.contrastIssues}
- **Klavye Navigasyonu Sorunlari:** ${analysis.keyboardIssues}

## Oneriler
${generateRecommendations(analysis)}
`;
}

function generateRecommendations(analysis: WcagAnalysisResult): string {
	const recommendations: string[] = [];

	if (analysis.missingLabels > 0) {
		recommendations.push("- Form elementleri icin aciklayici label'lar ekleyin");
	}

	if (analysis.missingAriaLabels > 0) {
		recommendations.push("- Butonlar icin ARIA etiketleri ekleyin");
	}

	if (analysis.missingAltText > 0) {
		recommendations.push("- Resimler icin alt text aciklamalari ekleyin");
	}

	if (analysis.missingTableHeaders > 0) {
		recommendations.push("- Tablolar icin baslik hucreleri ekleyin");
	}

	if (analysis.contrastIssues > 0) {
		recommendations.push("- Renk kontrasti icin background-color tanimlayin");
	}

	if (analysis.keyboardIssues > 0) {
		recommendations.push("- Klavye navigasyonu icin tabindex ekleyin");
	}

	if (recommendations.length === 0) {
		return "- Kodunuz WCAG 2.2 standartlarina uyumlu gorunuyor!";
	}

	return recommendations.join("\n");
} 