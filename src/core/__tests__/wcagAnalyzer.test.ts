import { WcagAnalyzer, WcagIssue } from "../wcagAnalyzer";

// Mock the GeminiAPI
jest.mock("../../utils/geminiApi", () => ({
	GeminiAPI: {
		getInstance: jest.fn().mockReturnValue({
			improveCode: jest.fn().mockResolvedValue({
				success: true,
				content: "{\"issues\": []}",
				tokensUsed: 100
			})
		})
	}
}));

describe("WcagAnalyzer", () => {
	let wcagAnalyzer: WcagAnalyzer;

	beforeEach(() => {
		wcagAnalyzer = new WcagAnalyzer();
	});

	describe("analyzeCode", () => {
		it("should analyze HTML code and find accessibility issues", async () => {
			const htmlCode = `
				<img src="test.jpg">
				<input type="text">
				<button></button>
			`;

			const result = await wcagAnalyzer.analyzeCode(htmlCode, "html", "test.html");

			expect(result).toHaveProperty("issues");
			expect(result).toHaveProperty("summary");
			expect(result).toHaveProperty("recommendations");
			expect(result).toHaveProperty("wcagCriteria");
			expect(Array.isArray(result.issues)).toBe(true);
		});

		it("should find missing alt attributes in images", async () => {
			const htmlCode = "<img src=\"test.jpg\">";
			const result = await wcagAnalyzer.analyzeCode(htmlCode, "html", "test.html");

			const imgAltIssue = result.issues.find(issue => issue.id === "img-alt-missing");
			expect(imgAltIssue).toBeDefined();
			expect(imgAltIssue?.severity).toBe("critical");
			expect(imgAltIssue?.wcagCriterion).toBe("1.1.1");
		});

		it("should find missing form labels", async () => {
			const htmlCode = "<input type=\"text\" placeholder=\"Enter name\">";
			const result = await wcagAnalyzer.analyzeCode(htmlCode, "html", "test.html");

			const labelIssue = result.issues.find(issue => issue.id === "input-label-missing");
			expect(labelIssue).toBeDefined();
			expect(labelIssue?.severity).toBe("critical");
			expect(labelIssue?.wcagCriterion).toBe("1.3.1");
		});

		it("should find empty buttons", async () => {
			const htmlCode = "<button></button>";
			const result = await wcagAnalyzer.analyzeCode(htmlCode, "html", "test.html");

			const buttonIssue = result.issues.find(issue => issue.id === "button-empty");
			expect(buttonIssue).toBeDefined();
			expect(buttonIssue?.severity).toBe("critical");
			expect(buttonIssue?.wcagCriterion).toBe("2.4.4");
		});

		it("should analyze CSS for accessibility issues", async () => {
			const cssCode = `
				.text { color: #666; background-color: #777; }
				.small { font-size: 10px; }
			`;

			const result = await wcagAnalyzer.analyzeCode(cssCode, "css", "test.css");

			expect(result.issues.length).toBeGreaterThan(0);
		});

		it("should generate proper summary", async () => {
			const htmlCode = `
				<img src="test.jpg">
				<input type="text">
			`;

			const result = await wcagAnalyzer.analyzeCode(htmlCode, "html", "test.html");

			expect(result.summary.totalIssues).toBeGreaterThan(0);
			expect(result.summary.criticalIssues).toBeGreaterThan(0);
			expect(result.summary.complianceLevel).toBeDefined();
			expect(["A", "AA", "AAA", "Non-compliant"]).toContain(result.summary.complianceLevel);
		});
	});

	describe("generateDetailedReport", () => {
		it("should generate detailed report with additional recommendations", async () => {
			const htmlCode = "<div>Test content</div>";
			const result = await wcagAnalyzer.generateDetailedReport(htmlCode, "html", "test.html");

			expect(result.recommendations).toContain("📋 Düzenli WCAG testleri yapın");
			expect(result.recommendations).toContain("🔧 Otomatik erişilebilirlik testleri entegre edin");
		});
	});
}); 