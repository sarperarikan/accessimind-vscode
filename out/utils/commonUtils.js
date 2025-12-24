"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStatusBar = exports.modernStatsViewProvider = exports.statsViewProvider = exports.localization = exports.statisticsManager = exports.aiProviderManager = void 0;
exports.initializeCommonUtils = initializeCommonUtils;
exports.isSupportedFileType = isSupportedFileType;
exports.countLinesChanged = countLinesChanged;
exports.getConfiguration = getConfiguration;
exports.showError = showError;
exports.showSuccess = showSuccess;
exports.showInfo = showInfo;
exports.setApiKey = setApiKey;
exports.testAIConnection = testAIConnection;
exports.recordImprovementStats = recordImprovementStats;
exports.handleImprovementResult = handleImprovementResult;
exports.getProgressSteps = getProgressSteps;
exports.runProgressSteps = runProgressSteps;
const vscode = __importStar(require("vscode"));
function initializeCommonUtils(aiProvider, statsManager, localizationManager, statsProvider, modernStatsProvider, statusBarUpdater) {
    exports.aiProviderManager = aiProvider;
    exports.statisticsManager = statsManager;
    exports.localization = localizationManager;
    exports.statsViewProvider = statsProvider;
    exports.modernStatsViewProvider = modernStatsProvider;
    exports.updateStatusBar = statusBarUpdater;
}
// Utility functions
function isSupportedFileType(language) {
    return ["html", "htm", "jsx", "tsx", "vue", "svelte", "php"].includes(language.toLowerCase());
}
function countLinesChanged(original, improved) {
    const originalLines = original.split("\n").length;
    const improvedLines = improved.split("\n").length;
    return Math.abs(improvedLines - originalLines);
}
function getConfiguration() {
    return vscode.workspace.getConfiguration("wcagEnhancer");
}
function showError(message) {
    vscode.window.showErrorMessage(message);
}
function showSuccess(message) {
    vscode.window.showInformationMessage(message);
}
function showInfo(message) {
    vscode.window.showInformationMessage(message);
}
async function setApiKey() {
    const config = vscode.workspace.getConfiguration("wcagEnhancer");
    const aiConfig = config.get("ai") || {};
    const currentKey = aiConfig.apiKey || "";
    const apiKey = await vscode.window.showInputBox({
        title: "🔑 Gemini API Key Configuration",
        prompt: "Enter your Google Gemini API key from Google AI Studio",
        placeHolder: "AIzaSy... (Your API key)",
        password: true,
        value: currentKey,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return "❌ API key cannot be empty";
            }
            if (value.length < 20) {
                return "⚠️ API key seems too short (minimum 20 characters)";
            }
            if (!value.startsWith("AIza")) {
                return "⚠️ Gemini API keys typically start with \"AIza\"";
            }
            return null;
        }
    });
    if (apiKey !== undefined) {
        aiConfig.apiKey = apiKey;
        await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("✅ Gemini API key updated successfully!", "Test Connection").then(action => {
            if (action === "Test Connection") {
                testAIConnection();
            }
        });
    }
}
async function testAIConnection() {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "🧪 Testing AI connection...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Validating configuration..." });
            await new Promise(resolve => setTimeout(resolve, 500));
            progress.report({ increment: 50, message: "Testing AI provider..." });
            // Import AITestUtils dynamically to avoid circular dependencies
            const { AITestUtils } = await Promise.resolve().then(() => __importStar(require("./aiTestUtils")));
            const aiTestUtils = AITestUtils.getInstance();
            const result = await aiTestUtils.testAIProvider();
            progress.report({ increment: 100, message: "Showing results..." });
            await aiTestUtils.showTestResult(result);
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(`❌ AI test failed: ${error}`);
    }
}
async function recordImprovementStats(startTime, originalCode, improvedCode, type, language, fileName, result) {
    const processingTime = Date.now() - startTime;
    const linesImproved = countLinesChanged(originalCode, improvedCode);
    exports.statisticsManager.recordImprovement({
        type,
        language,
        fileName,
        linesImproved,
        wcagCriteria: result.wcagCriteria || [],
        processingTime,
        tokensUsed: result.tokensUsed || 0,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        provider: result.provider || "gemini",
        model: result.model || "unknown"
    });
    // Update stats view and status bar
    exports.statsViewProvider.updateStatistics(exports.statisticsManager.getDetailedStatistics());
    (0, exports.updateStatusBar)();
}
async function handleImprovementResult(editor, originalCode, improvedCode, result, startTime, type, language, fileName) {
    if (result.success && improvedCode && improvedCode !== originalCode) {
        const autoApply = getConfiguration().get("autoApply", false);
        let shouldApply = autoApply;
        if (!autoApply) {
            const action = await vscode.window.showInformationMessage(exports.localization.getString("success.improvements.ready"), { modal: true, detail: result.summary }, exports.localization.getString("button.apply.changes"), exports.localization.getString("button.preview.changes"));
            shouldApply = action === exports.localization.getString("button.apply.changes");
        }
        if (shouldApply) {
            if (type === "file") {
                const document = editor.document;
                await editor.edit(editBuilder => {
                    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(originalCode.length));
                    editBuilder.replace(fullRange, improvedCode);
                });
            }
            else {
                await editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, improvedCode);
                });
            }
            // Record statistics
            await recordImprovementStats(startTime, originalCode, improvedCode, type, language, fileName, result);
            const linesImproved = countLinesChanged(originalCode, improvedCode);
            showSuccess(exports.localization.getString(`success.${type}.improved`) +
                ` (${linesImproved} ${exports.localization.getString("stats.lines.improved")})`);
            return true;
        }
    }
    else {
        showInfo(exports.localization.getString("info.no.improvements.needed"));
    }
    return false;
}
function getProgressSteps() {
    return [
        { increment: 0, message: exports.localization.getString("progress.step.1") },
        { increment: 15, message: exports.localization.getString("progress.step.2") },
        { increment: 30, message: exports.localization.getString("progress.step.3") },
        { increment: 50, message: exports.localization.getString("progress.step.4") },
        { increment: 75, message: exports.localization.getString("progress.step.5") },
        { increment: 90, message: exports.localization.getString("progress.step.6") }
    ];
}
async function runProgressSteps(progress) {
    const steps = getProgressSteps();
    for (let i = 0; i < steps.length - 1; i++) {
        progress.report(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}
//# sourceMappingURL=commonUtils.js.map