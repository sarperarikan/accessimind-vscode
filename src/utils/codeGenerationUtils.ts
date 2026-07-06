export type GeneratedCodeMode = "file" | "selection";

interface NormalizeGeneratedCodeOptions {
	originalCode: string;
	generatedContent: string;
	language: string;
	mode: GeneratedCodeMode;
}

interface StructuralSignature {
	kind: "html" | "css" | "script" | "other";
	tokens: Set<string>;
	importantTokens: Set<string>;
}

const PLACEHOLDER_PATTERNS = [
	/\.\.\./,
	/\/\/\s*rest of code/i,
	/\/\*\s*remaining code\s*\*\//i,
	/continue from here/i,
	/same as before/i,
];

const HTML_DOCUMENT_PATTERN = /<html[\s>]|<!doctype html>/i;
const HTML_HEAD_PATTERN = /<head[\s>]/i;
const HTML_BODY_PATTERN = /<body[\s>]/i;

function getLanguageKind(language: string, code: string): StructuralSignature["kind"] {
	const normalized = language.toLowerCase();
	if (normalized === "html" || normalized === "htm" || isLikelyHtmlDocument(code)) {
		return "html";
	}
	if (normalized === "css" || normalized === "scss" || normalized === "less") {
		return "css";
	}
	if (["javascript", "js", "typescript", "ts", "tsx", "jsx", "react"].includes(normalized)) {
		return "script";
	}
	return "other";
}

function collectMatches(code: string, regex: RegExp, prefix = ""): Set<string> {
	const values = new Set<string>();
	for (const match of code.matchAll(regex)) {
		if (match[1]) {
			values.add(`${prefix}${match[1]}`);
		}
	}
	return values;
}

function getStructuralSignature(code: string, language: string): StructuralSignature {
	const kind = getLanguageKind(language, code);
	const tokens = new Set<string>();
	const importantTokens = new Set<string>();

	if (kind === "html") {
		for (const value of collectMatches(code, /<([a-z][\w-]*)\b/gi, "tag:")) {
			tokens.add(value);
		}
		for (const value of collectMatches(code, /\bid="([^"]+)"/gi, "id:")) {
			tokens.add(value);
			importantTokens.add(value);
		}
		for (const value of collectMatches(code, /\bclass="([^"]+)"/gi)) {
			for (const className of value.split(/\s+/).filter(Boolean)) {
				tokens.add(`class:${className}`);
			}
		}
		for (const landmark of ["header", "nav", "main", "footer", "form", "button", "input"]) {
			if (code.toLowerCase().includes(`<${landmark}`)) {
				importantTokens.add(`tag:${landmark}`);
			}
		}
		return { kind, tokens, importantTokens };
	}

	if (kind === "css") {
		for (const value of collectMatches(code, /([.#]?[_a-zA-Z][\w-]*)\s*[{,:]/g, "selector:")) {
			tokens.add(value);
			if (value.startsWith("selector:#") || value.startsWith("selector:.")) {
				importantTokens.add(value);
			}
		}
		for (const value of collectMatches(code, /([a-z-]+)\s*:/g, "prop:")) {
			tokens.add(value);
		}
		return { kind, tokens, importantTokens };
	}

	if (kind === "script") {
		for (const value of collectMatches(code, /function\s+([A-Za-z_$][\w$]*)/g, "fn:")) {
			tokens.add(value);
			importantTokens.add(value);
		}
		for (const value of collectMatches(code, /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, "var:")) {
			tokens.add(value);
		}
		for (const value of collectMatches(code, /(?:class)\s+([A-Za-z_$][\w$]*)/g, "class:")) {
			tokens.add(value);
			importantTokens.add(value);
		}
		for (const value of collectMatches(code, /getElementById\(["'`]([^"'`]+)["'`]\)/g, "dom-id:")) {
			tokens.add(value);
			importantTokens.add(value);
		}
		return { kind, tokens, importantTokens };
	}

	return { kind, tokens, importantTokens };
}

function getOverlapRatio(original: Set<string>, candidate: Set<string>): number {
	if (original.size === 0) {
		return 1;
	}

	let matches = 0;
	for (const token of original) {
		if (candidate.has(token)) {
			matches += 1;
		}
	}

	return matches / original.size;
}

function hasBalancedPairs(code: string, openChar: string, closeChar: string): boolean {
	let count = 0;
	for (const char of code) {
		if (char === openChar) {
			count += 1;
		} else if (char === closeChar) {
			count -= 1;
			if (count < 0) {
				return false;
			}
		}
	}
	return count === 0;
}

function validateHtmlIntegrity(originalCode: string, generatedCode: string, mode: GeneratedCodeMode, warnings: string[]): void {
	const lowerGenerated = generatedCode.toLowerCase();
	const hasHtmlLikeStructure =
		/<[a-z!/][^>]*>/i.test(generatedCode) ||
		HTML_DOCUMENT_PATTERN.test(generatedCode) ||
		(HTML_HEAD_PATTERN.test(generatedCode) && HTML_BODY_PATTERN.test(generatedCode));

	if (!hasHtmlLikeStructure) {
		throw new Error("Generated HTML appears to be malformed.");
	}

	if (mode === "file" && isLikelyHtmlDocument(originalCode)) {
		const hasOpenHtml = /<html[\s>]/i.test(generatedCode);
		const hasCloseHtml = /<\/html>/i.test(generatedCode);
		const hasOpenBody = /<body[\s>]/i.test(generatedCode);
		const hasCloseBody = /<\/body>/i.test(generatedCode);

		if ((hasOpenHtml && !hasCloseHtml) || (hasOpenBody && !hasCloseBody)) {
			throw new Error("Generated HTML appears to be malformed.");
		}
	}

	const originalSignature = getStructuralSignature(originalCode, "html");
	const generatedSignature = getStructuralSignature(generatedCode, "html");
	const tokenOverlap = getOverlapRatio(originalSignature.tokens, generatedSignature.tokens);
	const importantOverlap = getOverlapRatio(originalSignature.importantTokens, generatedSignature.importantTokens);

	if (mode === "file" && importantOverlap < 0.6) {
		throw new Error("Generated HTML changed too much of the original structure.");
	}

	if (mode === "file" && tokenOverlap < 0.45) {
		warnings.push("Generated HTML differs significantly from the original structure.");
	}

	for (const match of generatedCode.matchAll(/\baria-(?:describedby|labelledby|controls)="([^"]+)"/gi)) {
		const ids = match[1].split(/\s+/).filter(Boolean);
		for (const id of ids) {
			if (!generatedCode.includes(`id="${id}"`)) {
				throw new Error(`Generated HTML references a missing element id: ${id}.`);
			}
		}
	}

	for (const match of generatedCode.matchAll(/<a[^>]+href="#([^"]+)"/gi)) {
		const target = match[1];
		if (!generatedCode.includes(`id="${target}"`)) {
			warnings.push(`Anchor target #${target} is missing in generated HTML.`);
		}
	}
}

function validateCssIntegrity(originalCode: string, generatedCode: string, mode: GeneratedCodeMode, warnings: string[]): void {
	if (!hasBalancedPairs(generatedCode, "{", "}")) {
		throw new Error("Generated CSS contains unbalanced braces.");
	}

	const originalSignature = getStructuralSignature(originalCode, "css");
	const generatedSignature = getStructuralSignature(generatedCode, "css");
	const importantOverlap = getOverlapRatio(originalSignature.importantTokens, generatedSignature.importantTokens);

	if (mode === "file" && importantOverlap < 0.5 && originalSignature.importantTokens.size > 0) {
		throw new Error("Generated CSS removed too many original selectors.");
	}

	if (!/focus-visible|focus\b/.test(generatedCode)) {
		warnings.push("Generated CSS does not appear to add visible focus styles.");
	}
}

function validateScriptIntegrity(originalCode: string, generatedCode: string, mode: GeneratedCodeMode, warnings: string[]): void {
	if (!hasBalancedPairs(generatedCode, "{", "}") || !hasBalancedPairs(generatedCode, "(", ")")) {
		throw new Error("Generated script contains unbalanced braces or parentheses.");
	}

	const originalSignature = getStructuralSignature(originalCode, "script");
	const generatedSignature = getStructuralSignature(generatedCode, "script");
	const importantOverlap = getOverlapRatio(originalSignature.importantTokens, generatedSignature.importantTokens);

	if (mode === "file" && importantOverlap < 0.4 && originalSignature.importantTokens.size > 0) {
		throw new Error("Generated script changed too much of the original program structure.");
	}

	if (mode === "file" && originalSignature.importantTokens.size >= 2 && generatedSignature.importantTokens.size === 0) {
		throw new Error("Generated script changed too much of the original program structure.");
	}

	if (/addEventListener|onkeydown|onclick/.test(originalCode) && !/addEventListener|onkeydown|onclick/.test(generatedCode)) {
		warnings.push("Generated script removed original interactive event hooks.");
	}
}

function validateStructuralIntegrity(originalCode: string, generatedCode: string, language: string, mode: GeneratedCodeMode, warnings: string[]): void {
	const kind = getLanguageKind(language, originalCode);

	if (kind === "html") {
		validateHtmlIntegrity(originalCode, generatedCode, mode, warnings);
		return;
	}

	if (kind === "css") {
		validateCssIntegrity(originalCode, generatedCode, mode, warnings);
		return;
	}

	if (kind === "script") {
		validateScriptIntegrity(originalCode, generatedCode, mode, warnings);
	}
}

export function extractCodeFromResponse(content: string): string {
	const fencedMatch = content.match(/```[\w-]*\n([\s\S]*?)\n```/);
	if (fencedMatch) {
		return fencedMatch[1].trim();
	}

	return content.trim();
}

export function isLikelyHtmlDocument(code: string): boolean {
	return HTML_DOCUMENT_PATTERN.test(code) || (HTML_HEAD_PATTERN.test(code) && HTML_BODY_PATTERN.test(code));
}

export function normalizeGeneratedCode({
	originalCode,
	generatedContent,
	language,
	mode,
}: NormalizeGeneratedCodeOptions): { code: string; warnings: string[] } {
	const normalizedCode = extractCodeFromResponse(generatedContent);
	const warnings: string[] = [];

	if (!normalizedCode.trim()) {
		throw new Error("The AI provider returned empty code.");
	}

	if (/^[.\s]+$/.test(normalizedCode) || /^(ok|done|no changes|unchanged)$/i.test(normalizedCode)) {
		throw new Error("The AI provider returned a non-code response.");
	}

	for (const pattern of PLACEHOLDER_PATTERNS) {
		if (pattern.test(normalizedCode)) {
			throw new Error("The AI provider returned incomplete code with placeholders.");
		}
	}

	const originalIsHtmlDocument = /^(html|htm)$/i.test(language) && isLikelyHtmlDocument(originalCode);
	if (mode === "file" && originalIsHtmlDocument && !isLikelyHtmlDocument(normalizedCode)) {
		throw new Error("The AI provider returned a partial HTML fragment for a full HTML document.");
	}

	if (mode === "file" && originalCode.trim().length >= 80 && normalizedCode.length <= 3) {
		throw new Error("The AI provider returned a response that is too short to replace the full file.");
	}

	if (mode === "selection" && normalizedCode.length > originalCode.length * 3) {
		warnings.push("Selection fix is significantly larger than the original selection.");
	}

	const changedLengthRatio =
		Math.abs(normalizedCode.length - originalCode.length) / Math.max(originalCode.length, 1);
	if (mode === "file" && changedLengthRatio > 1.2) {
		warnings.push("Generated file is much larger than the original input.");
	}

	validateStructuralIntegrity(originalCode, normalizedCode, language, mode, warnings);

	return {
		code: normalizedCode,
		warnings,
	};
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function getSmokeCheckScript(): string {
	return `<script>
document.addEventListener("DOMContentLoaded", () => {
	const results = [];
	const push = (status, label, detail) => results.push({ status, label, detail });
	const hasLang = !!document.documentElement.getAttribute("lang");
	push(hasLang ? "pass" : "warn", "Document language", hasLang ? document.documentElement.lang : "Missing lang attribute on <html>.");

	const title = (document.title || "").trim();
	push(title ? "pass" : "warn", "Document title", title || "Missing <title>.");

	const landmarks = document.querySelectorAll("main, nav, header, footer, aside, form");
	push(landmarks.length > 0 ? "pass" : "warn", "Landmarks", landmarks.length > 0 ? \`\${landmarks.length} landmark elements detected.\` : "No landmark elements detected.");

	const images = [...document.querySelectorAll("img")];
	const missingAlt = images.filter((img) => !img.hasAttribute("alt"));
	push(missingAlt.length === 0 ? "pass" : "fail", "Image alt text", images.length === 0 ? "No images found." : missingAlt.length === 0 ? "All images have alt attributes." : \`\${missingAlt.length} image(s) missing alt.\`);

	const controls = [...document.querySelectorAll("input, select, textarea")];
	const unlabeledControls = controls.filter((control) => {
		const id = control.getAttribute("id");
		const hasLabel = !!(id && document.querySelector(\`label[for="\${id}"]\`));
		return !(hasLabel || control.getAttribute("aria-label") || control.getAttribute("aria-labelledby"));
	});
	push(unlabeledControls.length === 0 ? "pass" : "fail", "Form labels", controls.length === 0 ? "No form controls found." : unlabeledControls.length === 0 ? "All controls have labels." : \`\${unlabeledControls.length} control(s) missing labels.\`);

	const buttons = [...document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']")];
	const unnamedButtons = buttons.filter((button) => {
		const text = (button.textContent || "").trim();
		return !(text || button.getAttribute("aria-label") || button.getAttribute("aria-labelledby") || button.getAttribute("value"));
	});
	push(unnamedButtons.length === 0 ? "pass" : "fail", "Control names", buttons.length === 0 ? "No buttons found." : unnamedButtons.length === 0 ? "Interactive controls have accessible names." : \`\${unnamedButtons.length} button(s) missing accessible names.\`);

	const ariaRefs = [...document.querySelectorAll("[aria-describedby], [aria-labelledby], [aria-controls]")];
	const missingRefs = [];
	for (const node of ariaRefs) {
		for (const attr of ["aria-describedby", "aria-labelledby", "aria-controls"]) {
			const value = node.getAttribute(attr);
			if (!value) continue;
			for (const id of value.split(/\\s+/).filter(Boolean)) {
				if (!document.getElementById(id)) {
					missingRefs.push(\`\${attr} -> #\${id}\`);
				}
			}
		}
	}
	push(missingRefs.length === 0 ? "pass" : "fail", "ARIA references", missingRefs.length === 0 ? "ARIA references are valid." : missingRefs.join(", "));

	const skipLinks = [...document.querySelectorAll('a[href^="#"]')].filter((link) => /skip/i.test((link.textContent || "") + " " + (link.getAttribute("class") || "")));
	const brokenSkipLinks = skipLinks.filter((link) => {
		const target = (link.getAttribute("href") || "").slice(1);
		return target && !document.getElementById(target);
	});
	push(brokenSkipLinks.length === 0 ? "pass" : "warn", "Skip links", skipLinks.length === 0 ? "No skip links detected." : brokenSkipLinks.length === 0 ? "Skip links point to valid targets." : \`\${brokenSkipLinks.length} skip link target(s) missing.\`);

	const focusables = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
	push(focusables.length > 0 ? "pass" : "warn", "Focusable elements", focusables.length > 0 ? \`\${focusables.length} focusable element(s) detected.\` : "No focusable elements found.");

	const panel = document.createElement("aside");
	panel.setAttribute("aria-label", "Accessibility smoke check");
	panel.style.position = "fixed";
	panel.style.right = "16px";
	panel.style.bottom = "16px";
	panel.style.width = "min(360px, calc(100vw - 32px))";
	panel.style.maxHeight = "70vh";
	panel.style.overflow = "auto";
	panel.style.zIndex = "9999";
	panel.style.background = "rgba(23, 32, 38, 0.96)";
	panel.style.color = "#f0f4f8";
	panel.style.border = "1px solid rgba(240,244,248,0.15)";
	panel.style.borderRadius = "16px";
	panel.style.boxShadow = "0 20px 40px rgba(0,0,0,0.25)";
	panel.style.padding = "16px";
	panel.innerHTML = '<h2 style="margin:0 0 12px;font:600 1rem/1.2 system-ui,sans-serif;">WCAG Smoke Check</h2>';

	for (const result of results) {
		const item = document.createElement("div");
		item.style.padding = "10px 0";
		item.style.borderTop = "1px solid rgba(240,244,248,0.12)";
		const color = result.status === "pass" ? "#7bd88f" : result.status === "warn" ? "#ffd166" : "#ff6b6b";
		item.innerHTML = \`<div style="display:flex;align-items:center;gap:8px;"><strong style="color:\${color};text-transform:uppercase;font:700 0.72rem/1 system-ui,sans-serif;">\${result.status}</strong><span style="font:600 0.95rem/1.3 system-ui,sans-serif;">\${result.label}</span></div><p style="margin:6px 0 0;color:#d9e2ec;font:400 0.85rem/1.45 system-ui,sans-serif;">\${result.detail}</p>\`;
		panel.appendChild(item);
	}

	document.body.appendChild(panel);
});
</script>`;
}

function injectSmokeCheckIntoHtmlDocument(content: string): string {
	const smokeScript = getSmokeCheckScript();
	if (/<\/body>/i.test(content)) {
		return content.replace(/<\/body>/i, `${smokeScript}</body>`);
	}

	if (/<\/html>/i.test(content)) {
		return content.replace(/<\/html>/i, `${smokeScript}</html>`);
	}

	return `${content}\n${smokeScript}`;
}

function buildHtmlShell(bodyContent: string, title: string, languageLabel: string, extraHead = "", extraScript = ""): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(title)}</title>
	<style>
		:root {
			--bg: #f6f3ea;
			--panel: #fffdf8;
			--ink: #1f2933;
			--muted: #52606d;
			--accent: #0b6e4f;
			--border: #d9d2c3;
			--code-bg: #172026;
			--code-ink: #f0f4f8;
			--focus: #d64545;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			font-family: Georgia, "Segoe UI", serif;
			background:
				radial-gradient(circle at top left, rgba(11, 110, 79, 0.08), transparent 32%),
				linear-gradient(180deg, #f8f5ee 0%, #f0e9dd 100%);
			color: var(--ink);
		}
		.skip-link {
			position: absolute;
			left: 16px;
			top: -48px;
			background: var(--focus);
			color: #fff;
			padding: 10px 14px;
			border-radius: 999px;
			text-decoration: none;
			z-index: 20;
		}
		.skip-link:focus {
			top: 16px;
		}
		.header {
			padding: 24px;
			border-bottom: 1px solid var(--border);
			background: rgba(255, 253, 248, 0.92);
			backdrop-filter: blur(8px);
		}
		.header h1 {
			margin: 0 0 8px;
			font-size: 1.4rem;
		}
		.header p {
			margin: 0;
			color: var(--muted);
		}
		.badge {
			display: inline-block;
			margin-top: 12px;
			padding: 6px 10px;
			border-radius: 999px;
			background: rgba(11, 110, 79, 0.12);
			color: var(--accent);
			font: 600 0.85rem/1 system-ui, sans-serif;
		}
		main {
			padding: 24px;
		}
		.preview-card {
			background: var(--panel);
			border: 1px solid var(--border);
			border-radius: 20px;
			box-shadow: 0 20px 40px rgba(31, 41, 51, 0.08);
			overflow: hidden;
		}
		.preview-body {
			padding: 24px;
		}
		pre {
			margin: 0;
			padding: 20px;
			overflow: auto;
			background: var(--code-bg);
			color: var(--code-ink);
			font: 500 0.92rem/1.6 "Cascadia Code", Consolas, monospace;
			border-radius: 16px;
		}
		button:focus-visible,
		a:focus-visible,
		input:focus-visible,
		textarea:focus-visible {
			outline: 3px solid var(--focus);
			outline-offset: 2px;
		}
		.sr-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}
		@media (prefers-reduced-motion: reduce) {
			*, *::before, *::after { animation: none !important; transition: none !important; }
		}
	</style>
	${extraHead}
</head>
<body>
	<a class="skip-link" href="#preview-root">Skip to preview</a>
	<header class="header">
		<h1>${escapeHtml(title)}</h1>
		<p>Generated browser preview for local WCAG verification.</p>
		<span class="badge">${escapeHtml(languageLabel)}</span>
	</header>
	<main id="preview-root">
		${bodyContent}
	</main>
	<section class="sr-only" aria-live="polite" id="preview-smoke-status">Accessibility smoke checks will run after render.</section>
	${extraScript}
	${getSmokeCheckScript()}
</body>
</html>`;
}

function buildCssPreview(content: string, fileName: string): string {
	const demoMarkup = `
<section class="preview-card">
	<div class="preview-body">
		<nav aria-label="Preview navigation">
			<a href="#card-content">Jump to sample content</a>
		</nav>
		<h2>Sample Interface</h2>
		<p id="card-content">This preview mounts your stylesheet on a small accessible demo surface.</p>
		<button type="button">Primary action</button>
		<a href="#details">Secondary link</a>
		<form>
			<label for="preview-input">Email address</label>
			<input id="preview-input" type="email" placeholder="name@example.com">
		</form>
	</div>
</section>`;

	return buildHtmlShell(demoMarkup, fileName, "CSS preview", `<style>${content}</style>`);
}

function buildJavaScriptPreview(content: string, fileName: string, executable: boolean): string {
	const demoMarkup = `
<section class="preview-card">
	<div class="preview-body">
		<h2>Interactive Sandbox</h2>
		<p>This preview hosts the script with a small accessible DOM playground.</p>
		<button id="preview-button" type="button">Trigger action</button>
		<div id="preview-status" role="status" aria-live="polite">Waiting for interaction.</div>
		<div id="details" tabindex="-1">Focusable details region.</div>
	</div>
</section>
<section class="preview-card" style="margin-top: 20px;">
	<div class="preview-body">
		<h2>Source</h2>
		<pre><code>${escapeHtml(content)}</code></pre>
	</div>
</section>`;

	const script = executable
		? `<script>
document.addEventListener("DOMContentLoaded", () => {
	const status = document.getElementById("preview-status");
	const button = document.getElementById("preview-button");
	if (button && status) {
		button.addEventListener("click", () => {
			status.textContent = "Preview shell action executed.";
		});
	}
});
</script>
<script>
${content}
</script>`
		: `<script>
document.addEventListener("DOMContentLoaded", () => {
	const status = document.getElementById("preview-status");
	if (status) {
		status.textContent = "This file type cannot run directly in the browser. Source is shown below.";
	}
});
</script>`;

	return buildHtmlShell(demoMarkup, fileName, executable ? "JavaScript preview" : "Script source preview", "", script);
}

function buildMarkupPreview(content: string, fileName: string): string {
	const wrappedContent = isLikelyHtmlDocument(content)
		? injectSmokeCheckIntoHtmlDocument(content)
		: buildHtmlShell(`<section class="preview-card"><div class="preview-body">${content}</div></section>`, fileName, "HTML fragment preview");

	return wrappedContent;
}

function buildCodePreview(content: string, fileName: string, language: string): string {
	const body = `
<section class="preview-card">
	<div class="preview-body">
		<h2>Source Preview</h2>
		<p>This file type is displayed in a realistic browser shell for review.</p>
		<pre><code>${escapeHtml(content)}</code></pre>
	</div>
</section>`;

	return buildHtmlShell(body, fileName, `${language} source preview`);
}

export function buildPreviewHtml(content: string, fileName: string, languageId: string): string {
	const normalizedLanguage = languageId.toLowerCase();

	if (normalizedLanguage === "html" || normalizedLanguage === "htm") {
		return buildMarkupPreview(content, fileName);
	}

	if (normalizedLanguage === "css") {
		return buildCssPreview(content, fileName);
	}

	if (normalizedLanguage === "javascript" || normalizedLanguage === "js") {
		return buildJavaScriptPreview(content, fileName, true);
	}

	if (normalizedLanguage === "typescript" || normalizedLanguage === "ts" || normalizedLanguage === "tsx" || normalizedLanguage === "jsx" || normalizedLanguage === "react") {
		return buildJavaScriptPreview(content, fileName, false);
	}

	return buildCodePreview(content, fileName, languageId || "plain text");
}
