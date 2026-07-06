import { WcagAnalyzer } from "../wcagAnalyzer";

jest.mock("../../utils/aiProvider", () => ({
	AIProviderManager: {
		getInstance: jest.fn().mockReturnValue({
			getCurrentProviderInstance: jest.fn().mockResolvedValue({
				analyzeCode: jest.fn().mockResolvedValue({
					success: true,
					content: "{\"issues\": []}",
					tokensUsed: 100,
				}),
			}),
			getCurrentProviderName: jest.fn().mockReturnValue("gemini"),
		}),
	},
}));

describe("WcagAnalyzer", () => {
	let wcagAnalyzer: WcagAnalyzer;

	beforeEach(() => {
		wcagAnalyzer = new WcagAnalyzer();
	});

	it("analyzes HTML code and returns the expected structure", async () => {
		const htmlCode = `
			<img src="test.jpg">
			<input type="text">
			<button></button>
		`;

		const result = await wcagAnalyzer.analyzeCode(htmlCode, "html", "test.html");

		expect(Array.isArray(result.issues)).toBe(true);
		expect(result.summary.totalIssues).toBeGreaterThan(0);
		expect(Array.isArray(result.recommendations)).toBe(true);
		expect(Array.isArray(result.wcagCriteria)).toBe(true);
	});

	it("finds missing alt attributes in images", async () => {
		const result = await wcagAnalyzer.analyzeCode('<img src="test.jpg">', "html", "test.html");
		const issue = result.issues.find((entry) => entry.id === "img-alt-missing");

		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("critical");
		expect(issue?.wcagCriterion).toBe("1.1.1");
	});

	it("finds missing form labels", async () => {
		const result = await wcagAnalyzer.analyzeCode(
			'<input type="text" placeholder="Enter name">',
			"html",
			"test.html"
		);
		const issue = result.issues.find((entry) => entry.id === "input-label-missing");

		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("critical");
		expect(issue?.wcagCriterion).toBe("1.3.1");
	});

	it("finds empty buttons", async () => {
		const result = await wcagAnalyzer.analyzeCode("<button></button>", "html", "test.html");
		const issue = result.issues.find((entry) => entry.id === "button-empty");

		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("critical");
		expect(issue?.wcagCriterion).toBe("2.4.4");
	});

	it("analyzes CSS for accessibility issues", async () => {
		const cssCode = `
			.text { color: #666; background-color: #777; }
			.small { font-size: 10px; }
		`;

		const result = await wcagAnalyzer.analyzeCode(cssCode, "css", "test.css");
		expect(result.issues.length).toBeGreaterThan(0);
	});

	it("generates a consistent summary", async () => {
		const htmlCode = `
			<img src="test.jpg">
			<input type="text">
		`;

		const result = await wcagAnalyzer.analyzeCode(htmlCode, "html", "test.html");

		expect(result.summary.criticalIssues).toBeGreaterThan(0);
		expect(["A", "AA", "AAA", "Non-conformant"]).toContain(result.summary.conformanceLevel);
	});

	it("adds extra recommendations in the detailed report", async () => {
		const result = await wcagAnalyzer.generateDetailedReport("<div>Test content</div>", "html", "test.html");

		expect(result.recommendations.length).toBeGreaterThanOrEqual(4);
		expect(result.recommendations.some((entry) => entry.length > 0)).toBe(true);
	});
});
