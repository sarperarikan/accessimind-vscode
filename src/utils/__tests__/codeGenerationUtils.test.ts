import {
	buildPreviewHtml,
	extractCodeFromResponse,
	isLikelyHtmlDocument,
	normalizeGeneratedCode,
} from "../codeGenerationUtils";

describe("codeGenerationUtils", () => {
	it("extracts fenced code blocks", () => {
		const result = extractCodeFromResponse("```html\n<button>Save</button>\n```");
		expect(result).toBe("<button>Save</button>");
	});

	it("rejects placeholder output for full file replacements", () => {
		expect(() =>
			normalizeGeneratedCode({
				originalCode: "<main>Original</main>",
				generatedContent: "<main>Updated</main>\n// rest of code",
				language: "html",
				mode: "file",
			})
		).toThrow("incomplete code");
	});

	it("rejects partial html fragments when the original is a full html document", () => {
		expect(() =>
			normalizeGeneratedCode({
				originalCode: "<!DOCTYPE html><html><head></head><body><main>Original</main></body></html>",
				generatedContent: "<main>Only fragment</main>",
				language: "html",
				mode: "file",
			})
		).toThrow("partial HTML fragment");
	});

	it("rejects non-code dot responses", () => {
		expect(() =>
			normalizeGeneratedCode({
				originalCode: "<main><button>Save</button></main>",
				generatedContent: ".",
				language: "html",
				mode: "file",
			})
		).toThrow("non-code response");
	});

	it("rejects very short full-file replacements", () => {
		expect(() =>
			normalizeGeneratedCode({
				originalCode: "function save(){ return true; }\ndocument.getElementById(\"save\")?.addEventListener(\"click\", save);\nconsole.log(\"ready\");",
				generatedContent: "x",
				language: "javascript",
				mode: "file",
			})
		).toThrow("too short");
	});

	it("detects html documents", () => {
		expect(isLikelyHtmlDocument("<!DOCTYPE html><html><body></body></html>")).toBe(true);
		expect(isLikelyHtmlDocument("<section><h1>Fragment</h1></section>")).toBe(false);
	});

	it("builds a css preview shell", () => {
		const html = buildPreviewHtml("button { color: red; }", "styles.css", "css");
		expect(html).toContain("Sample Interface");
		expect(html).toContain("<style>button { color: red; }</style>");
		expect(html).toContain("WCAG Smoke Check");
	});

	it("rejects html output when important ids are removed", () => {
		expect(() =>
			normalizeGeneratedCode({
				originalCode: '<!DOCTYPE html><html><body><main id="app"><button id="save-btn">Save</button></main></body></html>',
				generatedContent: '<!DOCTYPE html><html><body><section><a href="#">Changed</a></section></body></html>',
				language: "html",
				mode: "file",
			})
		).toThrow("original structure");
	});

	it("rejects css output with unbalanced braces", () => {
		expect(() =>
			normalizeGeneratedCode({
				originalCode: ".card { color: red; }",
				generatedContent: ".card { color: blue;",
				language: "css",
				mode: "file",
			})
		).toThrow("unbalanced braces");
	});

	it("warns when script output removes original interactive hooks", () => {
		const result = normalizeGeneratedCode({
			originalCode: 'function save(){ return true; }\ndocument.getElementById("save")?.addEventListener("click", save);',
			generatedContent: 'const unrelated = 1;',
			language: "javascript",
			mode: "file",
		});

		expect(result.warnings.join(" ")).toContain("interactive event hooks");
	});

	it("wraps html fragments in a preview document", () => {
		const html = buildPreviewHtml("<section><h1>Hello</h1></section>", "snippet.html", "html");
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("<section><h1>Hello</h1></section>");
		expect(html).toContain("WCAG Smoke Check");
	});

	it("injects smoke check script into full html documents", () => {
		const html = buildPreviewHtml("<!DOCTYPE html><html><body><main id=\"app\">Hello</main></body></html>", "page.html", "html");
		expect(html).toContain("WCAG Smoke Check");
		expect(html).toContain("document.documentElement.getAttribute(\"lang\")");
	});
});
