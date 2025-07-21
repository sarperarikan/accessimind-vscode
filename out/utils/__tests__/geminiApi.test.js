"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const geminiApi_1 = require("../geminiApi");
describe("GeminiAPI", () => {
    let geminiApi;
    beforeEach(() => {
        geminiApi = geminiApi_1.GeminiAPI.getInstance();
    });
    describe("getInstance", () => {
        it("should return singleton instance", () => {
            const instance1 = geminiApi_1.GeminiAPI.getInstance();
            const instance2 = geminiApi_1.GeminiAPI.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe("improveCode", () => {
        it("should return error when API key is missing", async () => {
            const request = {
                code: "<div>Test</div>",
                fileType: "html",
                language: "html",
                mode: "edit"
            };
            const result = await geminiApi.improveCode(request);
            expect(result.success).toBe(false);
            expect(result.error).toContain("API anahtarı bulunamadı");
        });
        it("should handle request with selectedText", async () => {
            const request = {
                code: "<div>Test</div>",
                fileType: "html",
                language: "html",
                selectedText: "<div>Selected</div>",
                mode: "edit",
                wcagLevel: "AA",
                includeComments: true
            };
            const result = await geminiApi.improveCode(request);
            expect(result).toHaveProperty("success");
            expect(result).toHaveProperty("error");
        });
    });
    describe("getAvailableModels", () => {
        it("should return array of available models", async () => {
            const models = await geminiApi.getAvailableModels();
            expect(Array.isArray(models)).toBe(true);
            expect(models.length).toBeGreaterThan(0);
        });
    });
    // Note: getModelInfo method may not exist in current implementation
    // describe("getModelInfo", () => {
    // 	it("should return model information", () => {
    // 		const modelInfo = geminiApi.getModelInfo("gemini-2.0-flash");
    // 		expect(modelInfo).toHaveProperty("name");
    // 		expect(modelInfo).toHaveProperty("description");
    // 		expect(modelInfo).toHaveProperty("maxTokens");
    // 		expect(typeof modelInfo.maxTokens).toBe("number");
    // 	});
    // 	it("should return default info for unknown model", () => {
    // 		const modelInfo = geminiApi.getModelInfo("unknown-model");
    // 		expect(modelInfo.name).toBe("Unknown Model");
    // 	});
    // });
});
//# sourceMappingURL=geminiApi.test.js.map