import * as path from "path";
import * as vscode from "vscode";

import { AIProviderManager } from "../utils/aiProvider";
import { LocalizationManager } from "../utils/localizationManager";
import { logger } from "../utils/logger";
import { LastFixPattern } from "./fixConfidence";

type Severity = "critical" | "major" | "minor";

interface LocalIssue {
	id: string;
	severity: Severity;
	message: string;
	line?: number;
}

interface SnapshotData {
	hash: string;
	issues: string[];
	criticalCount: number;
	majorCount: number;
	minorCount: number;
	metrics: CodeMetrics;
	weightedIssueScore: number;
	timestamp: string;
}

interface TokenRecord {
	name: string;
	value: string;
	file: string;
}

interface CodeMetrics {
	totalLines: number;
	tagCount: number;
	interactiveCount: number;
	ariaAttributeCount: number;
	formControlCount: number;
	landmarkCount: number;
	missingAltCount: number;
	missingInputLabelCount: number;
	emptyButtonCount: number;
	keyboardGapCount: number;
}

interface AiIssue {
	id: string;
	severity: Severity;
	description: string;
}

interface DynamicRiskContext {
	issues: LocalIssue[];
	aiIssues: AiIssue[];
	metrics: CodeMetrics;
	weightedIssueScore: number;
}

const LAST_FIX_PATTERN_KEY = "accessimind.lastFixPattern";
const LAST_JOURNEY_KEY = "accessimind.latestJourney";
const LAST_DOM_DIFF_KEY = "accessimind.latestDomDiff";
const LAST_TOKEN_GUARD_KEY = "accessimind.latestTokenGuard";
const LAST_COMPONENT_MEMORY_KEY = "accessimind.latestComponentMemory";
const LAST_REGRESSION_KEY = "accessimind.latestRegression";

export class InnovationManager {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly localization: LocalizationManager,
		private readonly aiProviderManager: AIProviderManager
	) {}

	public async runUserJourneyScan(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(this.t("Open a file before running User Journey Scan.", "User Journey Scan calistirmadan once bir dosya acin."));
			return;
		}

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: this.t("AccessiMind: Running User Journey Scan...", "AccessiMind: User Journey Scan calisiyor..."),
				cancellable: false,
			},
			async (progress) => {
				progress.report({ increment: 20, message: this.t("Collecting active file context...", "Aktif dosya baglami toplanıyor...") });
				const code = editor.document.getText();

				progress.report({ increment: 40, message: this.t("Analyzing local accessibility signals...", "Yerel erisilebilirlik sinyalleri analiz ediliyor...") });
				const context = await this.buildDynamicRiskContext(code, editor.document.languageId, editor.document.fileName);
				const allIssues = [...context.issues, ...context.aiIssues.map((issue) => ({
					id: `ai-${issue.id}`,
					severity: issue.severity,
					message: `[AI] ${issue.description}`,
				}))];

				progress.report({ increment: 25, message: this.t("Computing dynamic score...", "Dinamik skor hesaplanıyor...") });
				const score = this.calculateScore(allIssues);
				const summary = {
					file: editor.document.fileName,
					score,
					total: allIssues.length,
					critical: allIssues.filter((issue) => issue.severity === "critical").length,
					major: allIssues.filter((issue) => issue.severity === "major").length,
					minor: allIssues.filter((issue) => issue.severity === "minor").length,
					metrics: context.metrics,
					weightedIssueScore: context.weightedIssueScore,
					timestamp: new Date().toISOString(),
				};

				progress.report({ increment: 15, message: this.t("Creating report...", "Rapor olusturuluyor...") });
				await this.context.workspaceState.update(LAST_JOURNEY_KEY, summary);
				await this.openMarkdownReport(
					"User Journey Scan",
					this.buildJourneyReport(summary, allIssues)
				);
			}
		);
	}

	public async runDomDiffRiskAnalysis(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(this.t("Open a file before running DOM Diff Risk.", "DOM Diff Risk calistirmadan once bir dosya acin."));
			return;
		}

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: this.t("AccessiMind: Running DOM Diff Risk...", "AccessiMind: DOM Diff Risk calisiyor..."),
				cancellable: false,
			},
			async (progress) => {
				progress.report({ increment: 10, message: this.t("Collecting active code snapshot...", "Aktif kod snapshot aliniyor...") });
				const code = editor.document.getText();

				progress.report({ increment: 30, message: this.t("Extracting live accessibility metrics...", "Canli erisilebilirlik metrikleri cikartiliyor...") });
				const context = await this.buildDynamicRiskContext(code, editor.document.languageId, editor.document.fileName);
				const issues = context.issues;
				const issueFingerprints = [...issues, ...context.aiIssues.map((issue) => ({
					id: `ai-${issue.id}`,
					severity: issue.severity,
					line: 0,
				}))].map((issue) => `${issue.id}:${issue.line ?? 0}:${issue.severity}`).sort();

				progress.report({ increment: 25, message: this.t("Comparing with previous baseline...", "Onceki baseline ile karsilastiriliyor...") });
				const snapshotKey = `accessimind.domSnapshot:${editor.document.uri.toString()}`;
				const previous = this.context.workspaceState.get<SnapshotData>(snapshotKey);

				const current: SnapshotData = {
					hash: this.simpleHash(code),
					issues: issueFingerprints,
					criticalCount: issues.filter((issue) => issue.severity === "critical").length,
					majorCount: issues.filter((issue) => issue.severity === "major").length,
					minorCount: issues.filter((issue) => issue.severity === "minor").length,
					metrics: context.metrics,
					weightedIssueScore: context.weightedIssueScore,
					timestamp: new Date().toISOString(),
				};

				const previousSet = new Set(previous?.issues ?? []);
				const currentSet = new Set(current.issues);
				const introduced = current.issues.filter((entry) => !previousSet.has(entry));
				const resolved = (previous?.issues ?? []).filter((entry) => !currentSet.has(entry));
				const metricsDelta = this.diffMetrics(previous?.metrics, current.metrics);

				progress.report({ increment: 25, message: this.t("Computing dynamic risk score...", "Dinamik risk skoru hesaplaniyor...") });
				const riskScore = this.calculateDynamicDomRisk(current, previous, introduced.length, resolved.length, metricsDelta);

				const result = {
					file: editor.document.fileName,
					riskScore,
					introduced: introduced.length,
					resolved: resolved.length,
					previousIssues: previous?.issues.length ?? 0,
					currentIssues: current.issues.length,
					metricsDelta,
					weightedIssueScore: current.weightedIssueScore,
					timestamp: current.timestamp,
				};

				progress.report({ increment: 10, message: this.t("Saving snapshot and creating report...", "Snapshot kaydediliyor ve rapor olusturuluyor...") });
				await this.context.workspaceState.update(snapshotKey, current);
				await this.context.workspaceState.update(LAST_DOM_DIFF_KEY, result);

				await this.openMarkdownReport(
					"DOM Diff Risk",
					this.buildDomDiffReport(result, introduced, resolved)
				);
			}
		);
	}

	public async runDesignTokenGuard(): Promise<void> {
		const files = await vscode.workspace.findFiles("**/*.{css,scss,less,ts,tsx,js,jsx,json}", "**/{node_modules,dist,out,.git}/**", 200);
		const tokens: TokenRecord[] = [];

		for (const file of files) {
			try {
				const bytes = await vscode.workspace.fs.readFile(file);
				const content = Buffer.from(bytes).toString("utf8");
				tokens.push(...this.extractColorTokens(content, file.fsPath));
			} catch (error) {
				logger.warn(`Token guard skipped ${file.fsPath}: ${String(error)}`);
			}
		}

		const violations = this.findContrastViolations(tokens);
		const summary = {
			totalTokens: tokens.length,
			violations: violations.length,
			timestamp: new Date().toISOString(),
		};

		await this.context.workspaceState.update(LAST_TOKEN_GUARD_KEY, summary);
		await this.openMarkdownReport(
			"Design Token Guard",
			this.buildTokenGuardReport(summary, violations)
		);
	}

	public async analyzeComponentMemory(): Promise<void> {
		const files = await vscode.workspace.findFiles("**/*.{tsx,jsx,vue,html}", "**/{node_modules,dist,out,.git}/**", 200);
		const componentCounts: Record<string, number> = {};
		const classCounts: Record<string, number> = {};

		for (const file of files) {
			try {
				const bytes = await vscode.workspace.fs.readFile(file);
				const content = Buffer.from(bytes).toString("utf8");

				for (const match of content.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
					const name = match[1];
					componentCounts[name] = (componentCounts[name] || 0) + 1;
				}

				for (const match of content.matchAll(/class(?:Name)?\s*=\s*["']([^"']+)["']/g)) {
					const classes = match[1].split(/\s+/).filter(Boolean);
					for (const cls of classes) {
						classCounts[cls] = (classCounts[cls] || 0) + 1;
					}
				}
			} catch (error) {
				logger.warn(`Component memory skipped ${file.fsPath}: ${String(error)}`);
			}
		}

		const topComponents = Object.entries(componentCounts)
			.filter(([, count]) => count >= 3)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 12);
		const topClasses = Object.entries(classCounts)
			.filter(([, count]) => count >= 4)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 12);

		const result = {
			topComponents,
			topClasses,
			timestamp: new Date().toISOString(),
		};

		await this.context.workspaceState.update(LAST_COMPONENT_MEMORY_KEY, result);
		await this.openMarkdownReport("Component Memory", this.buildComponentMemoryReport(result));
	}

	public async applyLastFixToSimilarPlaces(): Promise<void> {
		const pattern = this.context.workspaceState.get<LastFixPattern>(LAST_FIX_PATTERN_KEY);
		if (!pattern) {
			vscode.window.showWarningMessage(this.t("No previous fix pattern was recorded yet.", "Henuz kaydedilmis bir onceki duzeltme paterni yok."));
			return;
		}

		const files = await vscode.workspace.findFiles("**/*.{html,htm,tsx,jsx,vue,svelte}", "**/{node_modules,dist,out,.git}/**", 200);
		let touchedFiles = 0;
		let replacements = 0;

		for (const file of files) {
			const bytes = await vscode.workspace.fs.readFile(file);
			const text = Buffer.from(bytes).toString("utf8");
			const updated = this.injectAttributePattern(text, pattern);
			if (updated === text) {
				continue;
			}

			replacements += this.countReplacements(text, updated);
			touchedFiles += 1;
			await vscode.workspace.fs.writeFile(file, Buffer.from(updated, "utf8"));
			if (replacements >= 200) {
				break;
			}
		}

		vscode.window.showInformationMessage(
			this.t(
				`Applied last fix pattern to ${replacements} place(s) in ${touchedFiles} file(s).`,
				`Son duzeltme paterni ${touchedFiles} dosyada ${replacements} noktaya uygulandi.`
			)
		);
	}

	public async generateA11yTestFile(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!editor || !workspaceFolder) {
			vscode.window.showErrorMessage(this.t("Open a file in a workspace before generating tests.", "Test olusturmadan once workspace icinde bir dosya acin."));
			return;
		}

		const code = editor.document.getText();
		const issues = this.collectLocalIssues(code).slice(0, 8);
		const baseName = path.basename(editor.document.fileName, path.extname(editor.document.fileName));
		const relativeDir = path.join("tests", "accessimind");
		const outputPath = path.join(workspaceFolder.uri.fsPath, relativeDir, `${baseName}.a11y.spec.ts`);
		const outputUri = vscode.Uri.file(outputPath);

		await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(outputPath)));
		await vscode.workspace.fs.writeFile(outputUri, Buffer.from(this.buildGeneratedTest(baseName, issues), "utf8"));

		const document = await vscode.workspace.openTextDocument(outputUri);
		await vscode.window.showTextDocument(document, { preview: false });

		vscode.window.showInformationMessage(
			this.t("Accessibility test file generated successfully.", "Accessibility test dosyasi basariyla olusturuldu.")
		);
	}

	public async generatePrReadySummary(): Promise<void> {
		const journey = this.context.workspaceState.get<Record<string, unknown>>(LAST_JOURNEY_KEY);
		const domDiff = this.context.workspaceState.get<Record<string, unknown>>(LAST_DOM_DIFF_KEY);
		const tokenGuard = this.context.workspaceState.get<Record<string, unknown>>(LAST_TOKEN_GUARD_KEY);
		const componentMemory = this.context.workspaceState.get<Record<string, unknown>>(LAST_COMPONENT_MEMORY_KEY);
		const regression = this.context.workspaceState.get<Record<string, unknown>>(LAST_REGRESSION_KEY);
		const provider = this.aiProviderManager.getCurrentProviderName();

		const summary = `# AccessiMind PR Summary

- Generated At: ${new Date().toISOString()}
- Active Provider: ${provider}

## User Journey Scan
${journey ? JSON.stringify(journey, null, 2) : "No journey scan data available yet."}

## DOM Diff Risk
${domDiff ? JSON.stringify(domDiff, null, 2) : "No DOM diff data available yet."}

## Design Token Guard
${tokenGuard ? JSON.stringify(tokenGuard, null, 2) : "No design token guard data available yet."}

## Component Memory
${componentMemory ? JSON.stringify(componentMemory, null, 2) : "No component memory data available yet."}

## Regression Shield
${regression ? JSON.stringify(regression, null, 2) : "No regression data available yet."}
`;

		await vscode.env.clipboard.writeText(summary);
		const doc = await vscode.workspace.openTextDocument({ language: "markdown", content: summary });
		await vscode.window.showTextDocument(doc, { preview: false });

		vscode.window.showInformationMessage(
			this.t("PR summary copied to clipboard and opened in editor.", "PR ozeti panoya kopyalandi ve editorde acildi.")
		);
	}

	public async runRegressionShield(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(this.t("Open a file before running Regression Shield.", "Regression Shield calistirmadan once bir dosya acin."));
			return;
		}

		const baselineKey = `accessimind.regressionBaseline:${editor.document.uri.toString()}`;
		const code = editor.document.getText();
		const issues = this.collectLocalIssues(code);
		const current = {
			critical: issues.filter((issue) => issue.severity === "critical").length,
			major: issues.filter((issue) => issue.severity === "major").length,
			minor: issues.filter((issue) => issue.severity === "minor").length,
			total: issues.length,
			timestamp: new Date().toISOString(),
		};

		const baseline = this.context.workspaceState.get<typeof current>(baselineKey);
		if (!baseline) {
			await this.context.workspaceState.update(baselineKey, current);
			vscode.window.showInformationMessage(
				this.t("Regression baseline created. Run Regression Shield again after changes.", "Regression baseline olusturuldu. Degisikliklerden sonra tekrar calistirin.")
			);
			return;
		}

		const delta = {
			critical: current.critical - baseline.critical,
			major: current.major - baseline.major,
			minor: current.minor - baseline.minor,
			total: current.total - baseline.total,
		};

		const status = delta.critical > 0 || delta.major > 0 ? "regressed" : delta.total < 0 ? "improved" : "stable";
		const payload = { baseline, current, delta, status, file: editor.document.fileName, timestamp: new Date().toISOString() };
		await this.context.workspaceState.update(LAST_REGRESSION_KEY, payload);
		await this.openMarkdownReport("Regression Shield", this.buildRegressionReport(payload));
	}

	public async rememberLastFixPattern(pattern: LastFixPattern | undefined): Promise<void> {
		if (!pattern || !pattern.tag || !pattern.attribute || !pattern.value) {
			return;
		}
		await this.context.workspaceState.update(LAST_FIX_PATTERN_KEY, pattern);
	}

	private collectLocalIssues(code: string): LocalIssue[] {
		const issues: LocalIssue[] = [];
		const lines = code.split(/\r?\n/);

		for (const [index, line] of lines.entries()) {
			const lineNumber = index + 1;
			if (/<img(?![^>]*\balt=)[^>]*>/i.test(line)) {
				issues.push({ id: "img-alt-missing", severity: "critical", message: "Image without alt text.", line: lineNumber });
			}
			if (/<input(?![^>]*(aria-label|aria-labelledby|id=))[^>]*>/i.test(line)) {
				issues.push({ id: "input-label-missing", severity: "critical", message: "Input might be missing an accessible label.", line: lineNumber });
			}
			if (/<button[^>]*>\s*<\/button>/i.test(line)) {
				issues.push({ id: "button-empty", severity: "critical", message: "Empty button text.", line: lineNumber });
			}
			if (/<(div|span)[^>]*onClick=/i.test(line) && !/onKey(Down|Up|Press)=/i.test(line)) {
				issues.push({ id: "keyboard-handler-missing", severity: "major", message: "Clickable non-semantic element without keyboard handler.", line: lineNumber });
			}
			if (/tabindex\s*=\s*["']?[1-9]\d*["']?/i.test(line)) {
				issues.push({ id: "positive-tabindex", severity: "major", message: "Positive tabindex can break logical tab order.", line: lineNumber });
			}
			if (/outline\s*:\s*none/i.test(line)) {
				issues.push({ id: "focus-outline-removed", severity: "major", message: "Focus outline removed without replacement.", line: lineNumber });
			}
			if (/font-size\s*:\s*\d+px/i.test(line)) {
				issues.push({ id: "fixed-font-size", severity: "minor", message: "Fixed font-size in px can reduce scalability.", line: lineNumber });
			}
		}

		if (/color\s*:\s*#[0-9a-f]{3,8}/i.test(code) && /background(-color)?\s*:\s*#[0-9a-f]{3,8}/i.test(code)) {
			issues.push({ id: "color-contrast-review-needed", severity: "minor", message: "Contrast pair detected; manual validation recommended." });
		}

		return issues;
	}

	private extractMetrics(code: string): CodeMetrics {
		const totalLines = code.split(/\r?\n/).length;
		const tagCount = (code.match(/<([a-zA-Z][\w:-]*)\b/g) || []).length;
		const interactiveCount = (code.match(/<(button|a|input|select|textarea|summary)\b/gi) || []).length +
			(code.match(/\bon(click|keydown|keyup|keypress)\s*=/gi) || []).length;
		const ariaAttributeCount = (code.match(/\baria-[\w-]+\s*=/gi) || []).length;
		const formControlCount = (code.match(/<(input|select|textarea|button)\b/gi) || []).length;
		const landmarkCount = (code.match(/<(main|nav|header|footer|aside|section)\b/gi) || []).length;
		const missingAltCount = (code.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
		const missingInputLabelCount = (code.match(/<input(?![^>]*(aria-label|aria-labelledby|id=))[^>]*>/gi) || []).length;
		const emptyButtonCount = (code.match(/<button[^>]*>\s*<\/button>/gi) || []).length;
		const keyboardGapCount =
			(code.match(/<(div|span)[^>]*onClick=/gi) || []).length - (code.match(/onKey(Down|Up|Press)=/gi) || []).length;

		return {
			totalLines,
			tagCount,
			interactiveCount,
			ariaAttributeCount,
			formControlCount,
			landmarkCount,
			missingAltCount,
			missingInputLabelCount,
			emptyButtonCount,
			keyboardGapCount: Math.max(0, keyboardGapCount),
		};
	}

	private weightedIssueScore(issues: Array<{ severity: Severity }>): number {
		let score = 0;
		for (const issue of issues) {
			if (issue.severity === "critical") {
				score += 18;
			} else if (issue.severity === "major") {
				score += 9;
			} else {
				score += 4;
			}
		}
		return score;
	}

	private async buildDynamicRiskContext(code: string, language: string, fileName: string): Promise<DynamicRiskContext> {
		const issues = this.collectLocalIssues(code);
		const metrics = this.extractMetrics(code);
		const aiIssues = await this.tryAiIssues(code, language, fileName);

		const weightedIssueScore = this.weightedIssueScore(issues) + this.weightedIssueScore(aiIssues);
		return {
			issues,
			aiIssues,
			metrics,
			weightedIssueScore,
		};
	}

	private async tryAiIssues(code: string, language: string, fileName: string): Promise<AiIssue[]> {
		try {
			const provider = await this.aiProviderManager.getCurrentProviderInstance();
			if (!(await provider.isAvailable())) {
				return [];
			}

			const response = await provider.analyzeCode({
				code,
				fileType: path.extname(fileName).replace(".", "") || "unknown",
				language,
				wcagLevel: "AA",
				responseLanguage: this.localization.getCurrentLanguage() === "tr" ? "tr" : "en",
			});
			if (!response.success || !response.content) {
				return [];
			}

			const parsed = this.parseAiIssueResponse(response.content);
			return parsed.slice(0, 20);
		} catch (error) {
			logger.warn(`AI issue analysis skipped: ${String(error)}`);
			return [];
		}
	}

	private parseAiIssueResponse(content: string): AiIssue[] {
		let payload: unknown;
		try {
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			payload = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
		} catch {
			return [];
		}

		const issuesRaw = (payload as { issues?: unknown[] })?.issues;
		if (!Array.isArray(issuesRaw)) {
			return [];
		}

		const mapSeverity = (value: unknown): Severity => {
			const normalized = String(value || "").toLowerCase();
			if (normalized.includes("critical")) {
				return "critical";
			}
			if (normalized.includes("major") || normalized.includes("high")) {
				return "major";
			}
			return "minor";
		};

		return issuesRaw
			.map((item, index) => {
				const asObj = item as Record<string, unknown>;
				const description = String(asObj.description || asObj.message || asObj.issue || "").trim();
				if (!description) {
					return null;
				}

				return {
					id: String(asObj.id || `issue-${index + 1}`),
					severity: mapSeverity(asObj.severity),
					description,
				} satisfies AiIssue;
			})
			.filter((item): item is AiIssue => item !== null);
	}

	private calculateDynamicDomRisk(
		current: SnapshotData,
		previous: SnapshotData | undefined,
		introducedCount: number,
		resolvedCount: number,
		metricsDelta: Record<keyof CodeMetrics, number>
	): number {
		const baseRisk = current.weightedIssueScore;
		const deltaScore = (introducedCount * 7) - (resolvedCount * 4);
		const prevWeighted = previous?.weightedIssueScore ?? current.weightedIssueScore;
		const trendPenalty = Math.max(0, current.weightedIssueScore - prevWeighted);
		const structureRisk =
			Math.max(0, metricsDelta.totalLines) * 0.1 +
			Math.max(0, metricsDelta.tagCount) * 0.4 +
			Math.max(0, metricsDelta.interactiveCount) * 2 +
			Math.max(0, metricsDelta.formControlCount) * 2 +
			Math.max(0, metricsDelta.missingAltCount) * 8 +
			Math.max(0, metricsDelta.missingInputLabelCount) * 10 +
			Math.max(0, metricsDelta.keyboardGapCount) * 6;
		const ariaCompensation = metricsDelta.ariaAttributeCount > 0 ? -Math.min(8, metricsDelta.ariaAttributeCount * 1.2) : 0;
		const semanticsPenalty = metricsDelta.tagCount > 0 && metricsDelta.ariaAttributeCount <= 0 ? 6 : 0;
		const baseline = previous ? 6 : 2;

		return Math.max(
			0,
			Math.min(
				100,
				baseline + baseRisk * 0.85 + deltaScore + trendPenalty * 0.6 + structureRisk + semanticsPenalty + ariaCompensation
			)
		);
	}

	private diffMetrics(previous: CodeMetrics | undefined, current: CodeMetrics): Record<keyof CodeMetrics, number> {
		if (!previous) {
			return {
				totalLines: 0,
				tagCount: 0,
				interactiveCount: 0,
				ariaAttributeCount: 0,
				formControlCount: 0,
				landmarkCount: 0,
				missingAltCount: 0,
				missingInputLabelCount: 0,
				emptyButtonCount: 0,
				keyboardGapCount: 0,
			};
		}

		const empty: CodeMetrics = {
			totalLines: 0,
			tagCount: 0,
			interactiveCount: 0,
			ariaAttributeCount: 0,
			formControlCount: 0,
			landmarkCount: 0,
			missingAltCount: 0,
			missingInputLabelCount: 0,
			emptyButtonCount: 0,
			keyboardGapCount: 0,
		};
		const base = previous || empty;
		return {
			totalLines: current.totalLines - base.totalLines,
			tagCount: current.tagCount - base.tagCount,
			interactiveCount: current.interactiveCount - base.interactiveCount,
			ariaAttributeCount: current.ariaAttributeCount - base.ariaAttributeCount,
			formControlCount: current.formControlCount - base.formControlCount,
			landmarkCount: current.landmarkCount - base.landmarkCount,
			missingAltCount: current.missingAltCount - base.missingAltCount,
			missingInputLabelCount: current.missingInputLabelCount - base.missingInputLabelCount,
			emptyButtonCount: current.emptyButtonCount - base.emptyButtonCount,
			keyboardGapCount: current.keyboardGapCount - base.keyboardGapCount,
		};
	}

	private calculateScore(issues: LocalIssue[]): number {
		let score = 100;
		for (const issue of issues) {
			if (issue.severity === "critical") {
				score -= 18;
			} else if (issue.severity === "major") {
				score -= 10;
			} else {
				score -= 4;
			}
		}
		return Math.max(0, score);
	}

	private simpleHash(input: string): string {
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			hash = (hash << 5) - hash + input.charCodeAt(i);
			hash |= 0;
		}
		return String(hash);
	}

	private extractColorTokens(content: string, filePath: string): TokenRecord[] {
		const tokens: TokenRecord[] = [];
		const cssVarRegex = /--([a-zA-Z0-9-_]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g;
		const objectRegex = /["']?([a-zA-Z0-9-_.]*(?:color|bg|text|surface|fg)[a-zA-Z0-9-_.]*)["']?\s*[:=]\s*["'](#[0-9a-fA-F]{3,8})["']/g;

		for (const match of content.matchAll(cssVarRegex)) {
			tokens.push({ name: match[1].toLowerCase(), value: match[2], file: filePath });
		}

		for (const match of content.matchAll(objectRegex)) {
			tokens.push({ name: match[1].toLowerCase(), value: match[2], file: filePath });
		}

		return tokens;
	}

	private findContrastViolations(tokens: TokenRecord[]): Array<{ fg: TokenRecord; bg: TokenRecord; ratio: number }> {
		const foreground = tokens.filter((token) => /(text|fg|on)/.test(token.name));
		const backgrounds = tokens.filter((token) => /(bg|background|surface|canvas)/.test(token.name));
		const violations: Array<{ fg: TokenRecord; bg: TokenRecord; ratio: number }> = [];

		for (const fg of foreground) {
			for (const bg of backgrounds) {
				if (!this.tokensLikelyRelated(fg.name, bg.name)) {
					continue;
				}
				const ratio = this.contrastRatio(fg.value, bg.value);
				if (ratio !== null && ratio < 4.5) {
					violations.push({ fg, bg, ratio });
				}
			}
		}

		return violations.slice(0, 50);
	}

	private tokensLikelyRelated(fgName: string, bgName: string): boolean {
		const normalize = (name: string) =>
			name
				.replace(/(text|fg|on|bg|background|surface|canvas)/g, "")
				.replace(/[-_.]/g, "")
				.trim();
		const a = normalize(fgName);
		const b = normalize(bgName);
		if (!a || !b) {
			return true;
		}
		return a === b || a.includes(b) || b.includes(a);
	}

	private contrastRatio(colorA: string, colorB: string): number | null {
		const a = this.toRgb(colorA);
		const b = this.toRgb(colorB);
		if (!a || !b) {
			return null;
		}

		const luminance = (rgb: [number, number, number]) => {
			const normalize = (channel: number) => {
				const value = channel / 255;
				return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * normalize(rgb[0]) + 0.7152 * normalize(rgb[1]) + 0.0722 * normalize(rgb[2]);
		};

		const l1 = luminance(a);
		const l2 = luminance(b);
		const lighter = Math.max(l1, l2);
		const darker = Math.min(l1, l2);
		return (lighter + 0.05) / (darker + 0.05);
	}

	private toRgb(value: string): [number, number, number] | null {
		const hex = value.trim().toLowerCase();
		if (hex.startsWith("#")) {
			const body = hex.slice(1);
			if (body.length === 3) {
				return [
					parseInt(body[0] + body[0], 16),
					parseInt(body[1] + body[1], 16),
					parseInt(body[2] + body[2], 16),
				];
			}
			if (body.length === 6 || body.length === 8) {
				return [
					parseInt(body.slice(0, 2), 16),
					parseInt(body.slice(2, 4), 16),
					parseInt(body.slice(4, 6), 16),
				];
			}
			return null;
		}

		const rgbMatch = hex.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
		if (rgbMatch) {
			return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
		}
		return null;
	}

	private injectAttributePattern(text: string, pattern: LastFixPattern): string {
		if (!/^[a-zA-Z][\w:-]*$/.test(pattern.tag) || !/^[a-zA-Z][\w:-]*$/.test(pattern.attribute)) {
			return text;
		}
		const safeValue = pattern.value.replace(/"/g, "&quot;");
		const matcher = new RegExp(`<${pattern.tag}(?![^>]*\\b${pattern.attribute}\\s*=)([^>]*)>`, "gi");
		return text.replace(matcher, `<${pattern.tag}$1 ${pattern.attribute}="${safeValue}">`);
	}

	private countReplacements(original: string, updated: string): number {
		if (original === updated) {
			return 0;
		}
		const originalTags = (original.match(/<[^/!][^>]*>/g) || []).length;
		const updatedTags = (updated.match(/<[^/!][^>]*>/g) || []).length;
		return Math.abs(updatedTags - originalTags) + Math.max(1, Math.floor(Math.abs(updated.length - original.length) / 20));
	}

	private buildGeneratedTest(baseName: string, issues: LocalIssue[]): string {
		const assertions = issues.map((issue) => {
			if (issue.id.includes("img-alt")) {
				return "await expect(page.locator('img:not([alt])')).toHaveCount(0);";
			}
			if (issue.id.includes("input-label")) {
				return "await expect(page.locator('input:not([aria-label]):not([aria-labelledby])')).toHaveCount(0);";
			}
			if (issue.id.includes("button-empty")) {
				return "await expect(page.locator('button:empty')).toHaveCount(0);";
			}
			if (issue.id.includes("keyboard-handler")) {
				return "await expect(page.locator('[onclick]:not(button):not(a):not(input)')).toHaveCount(0);";
			}
			return "await expect(page).toHaveTitle(/.+/);";
		});

		return `import { test, expect } from "@playwright/test";

test.describe("${baseName} accessibility", () => {
	test("core a11y checks", async ({ page }) => {
		// TODO: Update URL/path for your app route before running this test.
		await page.goto("http://localhost:3000");

		${assertions.join("\n\t\t")}
	});
});
`;
	}

	private buildJourneyReport(
		summary: {
			file: string;
			score: number;
			total: number;
			critical: number;
			major: number;
			minor: number;
			metrics: CodeMetrics;
			weightedIssueScore: number;
			timestamp: string;
		},
		issues: LocalIssue[]
	): string {
		return `# User Journey Scan

- File: \`${summary.file}\`
- Generated: ${summary.timestamp}
- Accessibility Score: **${summary.score}/100**
- Issues: ${summary.total} (critical: ${summary.critical}, major: ${summary.major}, minor: ${summary.minor})
- Weighted Issue Score: ${summary.weightedIssueScore}

## Live Metrics
- Total lines: ${summary.metrics.totalLines}
- HTML tags: ${summary.metrics.tagCount}
- Interactive nodes: ${summary.metrics.interactiveCount}
- ARIA attributes: ${summary.metrics.ariaAttributeCount}
- Missing alt: ${summary.metrics.missingAltCount}
- Missing input labels: ${summary.metrics.missingInputLabelCount}
- Keyboard gaps: ${summary.metrics.keyboardGapCount}

## Findings
${issues.length === 0 ? "- No local issues detected." : issues.map((issue) => `- [${issue.severity}] ${issue.message}${issue.line ? ` (line ${issue.line})` : ""}`).join("\n")}

## Suggested Next Step
- Run "AccessiMind: Generate Accessibility Test" to create regression coverage for this file.
`;
	}

	private buildDomDiffReport(
		result: {
			file: string;
			riskScore: number;
			introduced: number;
			resolved: number;
			previousIssues: number;
			currentIssues: number;
			metricsDelta: Record<keyof CodeMetrics, number>;
			weightedIssueScore: number;
			timestamp: string;
		},
		introduced: string[],
		resolved: string[]
	): string {
		return `# DOM Diff Risk

- File: \`${result.file}\`
- Generated: ${result.timestamp}
- Risk Score: **${result.riskScore}/100**
- Previous Issues: ${result.previousIssues}
- Current Issues: ${result.currentIssues}
- Introduced: ${result.introduced}
- Resolved: ${result.resolved}
- Weighted Issue Score: ${result.weightedIssueScore}

## Metrics Delta
- lines: ${result.metricsDelta.totalLines >= 0 ? "+" : ""}${result.metricsDelta.totalLines}
- tags: ${result.metricsDelta.tagCount >= 0 ? "+" : ""}${result.metricsDelta.tagCount}
- interactive: ${result.metricsDelta.interactiveCount >= 0 ? "+" : ""}${result.metricsDelta.interactiveCount}
- aria attrs: ${result.metricsDelta.ariaAttributeCount >= 0 ? "+" : ""}${result.metricsDelta.ariaAttributeCount}
- missing alt: ${result.metricsDelta.missingAltCount >= 0 ? "+" : ""}${result.metricsDelta.missingAltCount}
- missing labels: ${result.metricsDelta.missingInputLabelCount >= 0 ? "+" : ""}${result.metricsDelta.missingInputLabelCount}
- keyboard gaps: ${result.metricsDelta.keyboardGapCount >= 0 ? "+" : ""}${result.metricsDelta.keyboardGapCount}

## Introduced Fingerprints
${introduced.length === 0 ? "- None" : introduced.map((item) => `- ${item}`).join("\n")}

## Resolved Fingerprints
${resolved.length === 0 ? "- None" : resolved.map((item) => `- ${item}`).join("\n")}
`;
	}

	private buildTokenGuardReport(
		summary: { totalTokens: number; violations: number; timestamp: string },
		violations: Array<{ fg: TokenRecord; bg: TokenRecord; ratio: number }>
	): string {
		return `# Design Token Guard

- Generated: ${summary.timestamp}
- Tokens Scanned: ${summary.totalTokens}
- Contrast Violations: ${summary.violations}

## Violations
${violations.length === 0
		? "- No low-contrast token pairs detected."
		: violations
			.map((violation) => `- ${violation.fg.name} (${violation.fg.value}) vs ${violation.bg.name} (${violation.bg.value}) => ratio ${violation.ratio.toFixed(2)} in \`${violation.fg.file}\``)
			.join("\n")}
`;
	}

	private buildComponentMemoryReport(result: { topComponents: Array<[string, number]>; topClasses: Array<[string, number]>; timestamp: string }): string {
		return `# Component Memory

- Generated: ${result.timestamp}

## Reused Components
${result.topComponents.length === 0 ? "- No repeated custom components detected." : result.topComponents.map(([name, count]) => `- ${name}: ${count}`).join("\n")}

## Reused CSS Classes
${result.topClasses.length === 0 ? "- No repeated classes detected." : result.topClasses.map(([name, count]) => `- ${name}: ${count}`).join("\n")}
`;
	}

	private buildRegressionReport(payload: {
		baseline: { critical: number; major: number; minor: number; total: number; timestamp: string };
		current: { critical: number; major: number; minor: number; total: number; timestamp: string };
		delta: { critical: number; major: number; minor: number; total: number };
		status: string;
		file: string;
		timestamp: string;
	}): string {
		return `# Regression Shield

- File: \`${payload.file}\`
- Status: **${payload.status}**
- Generated: ${payload.timestamp}

## Baseline
- Total: ${payload.baseline.total} (critical: ${payload.baseline.critical}, major: ${payload.baseline.major}, minor: ${payload.baseline.minor})
- Timestamp: ${payload.baseline.timestamp}

## Current
- Total: ${payload.current.total} (critical: ${payload.current.critical}, major: ${payload.current.major}, minor: ${payload.current.minor})
- Timestamp: ${payload.current.timestamp}

## Delta
- Total: ${payload.delta.total >= 0 ? "+" : ""}${payload.delta.total}
- Critical: ${payload.delta.critical >= 0 ? "+" : ""}${payload.delta.critical}
- Major: ${payload.delta.major >= 0 ? "+" : ""}${payload.delta.major}
- Minor: ${payload.delta.minor >= 0 ? "+" : ""}${payload.delta.minor}
`;
	}

	private async openMarkdownReport(title: string, content: string): Promise<void> {
		const doc = await vscode.workspace.openTextDocument({
			language: "markdown",
			content: content,
		});
		await vscode.window.showTextDocument(doc, { preview: false });
	}

	private t(en: string, tr: string): string {
		return this.localization.getCurrentLanguage() === "tr" ? tr : en;
	}
}

