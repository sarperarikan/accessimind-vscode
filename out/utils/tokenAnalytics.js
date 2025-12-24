"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenAnalyticsManager = void 0;
const logger_1 = require("./logger");
class TokenAnalyticsManager {
    constructor(context) {
        this.tokenUsageHistory = [];
        this.tokenPrices = new Map();
        this.context = context;
        this.loadTokenData();
        this.initializeTokenPrices();
    }
    static getInstance(context) {
        if (!TokenAnalyticsManager.instance) {
            if (!context) {
                throw new Error("Context required for first TokenAnalyticsManager instance");
            }
            TokenAnalyticsManager.instance = new TokenAnalyticsManager(context);
        }
        return TokenAnalyticsManager.instance;
    }
    initializeTokenPrices() {
        // Gemini model prices (as of 2024 - these should be updated regularly)
        this.tokenPrices.set("gemini-2.5-flash", {
            model: "gemini-2.5-flash",
            provider: "gemini",
            inputPricePerK: 0.0001, // $0.1 per 1M tokens
            outputPricePerK: 0.0003, // $0.3 per 1M tokens
            lastUpdated: Date.now()
        });
        this.tokenPrices.set("gemini-2.5-pro", {
            model: "gemini-2.5-pro",
            provider: "gemini",
            inputPricePerK: 0.00125, // $1.25 per 1M tokens
            outputPricePerK: 0.005, // $5 per 1M tokens
            lastUpdated: Date.now()
        });
        // VS Code Copilot (subscription based, estimated costs)
        this.tokenPrices.set("gpt-4o", {
            model: "gpt-4o",
            provider: "vscode-copilot",
            inputPricePerK: 0.005, // $5 per 1M tokens
            outputPricePerK: 0.015, // $15 per 1M tokens
            lastUpdated: Date.now()
        });
        this.tokenPrices.set("gpt-4o-mini", {
            model: "gpt-4o-mini",
            provider: "vscode-copilot",
            inputPricePerK: 0.00015, // $0.15 per 1M tokens
            outputPricePerK: 0.0006, // $0.6 per 1M tokens
            lastUpdated: Date.now()
        });
        // Additional VS Code Copilot models
        this.tokenPrices.set("gpt-4", {
            model: "gpt-4",
            provider: "vscode-copilot",
            inputPricePerK: 0.03, // $30 per 1M tokens
            outputPricePerK: 0.06, // $60 per 1M tokens
            lastUpdated: Date.now()
        });
        this.tokenPrices.set("gpt-3.5-turbo", {
            model: "gpt-3.5-turbo",
            provider: "vscode-copilot",
            inputPricePerK: 0.0005, // $0.5 per 1M tokens
            outputPricePerK: 0.0015, // $1.5 per 1M tokens
            lastUpdated: Date.now()
        });
        // Generic fallback for unknown copilot models
        this.tokenPrices.set("copilot-default", {
            model: "copilot-default",
            provider: "vscode-copilot",
            inputPricePerK: 0.005, // Default to gpt-4o pricing
            outputPricePerK: 0.015,
            lastUpdated: Date.now()
        });
        this.saveTokenData();
    }
    recordTokenUsage(usage) {
        try {
            const cost = this.calculateTokenCost(usage.model, usage.inputTokens, usage.outputTokens);
            const fullUsage = {
                ...usage,
                timestamp: Date.now(),
                costUSD: cost
            };
            this.tokenUsageHistory.push(fullUsage);
            // Keep only last 10000 records for performance
            if (this.tokenUsageHistory.length > 10000) {
                this.tokenUsageHistory = this.tokenUsageHistory.slice(-10000);
            }
            this.saveTokenData();
            logger_1.logger.info(`Token usage recorded: ${usage.tokensUsed} tokens, $${cost.toFixed(4)} cost`);
        }
        catch (error) {
            logger_1.logger.error("Error recording token usage:", error);
        }
    }
    calculateTokenCost(model, inputTokens, outputTokens) {
        let pricing = this.tokenPrices.get(model);
        // Fallback mechanism for unknown models
        if (!pricing) {
            // Try to find similar models or use provider defaults
            const modelLower = model.toLowerCase();
            if (modelLower.includes("gpt-4o-mini")) {
                pricing = this.tokenPrices.get("gpt-4o-mini");
            }
            else if (modelLower.includes("gpt-4o")) {
                pricing = this.tokenPrices.get("gpt-4o");
            }
            else if (modelLower.includes("gpt-4")) {
                pricing = this.tokenPrices.get("gpt-4");
            }
            else if (modelLower.includes("gpt-3.5")) {
                pricing = this.tokenPrices.get("gpt-3.5-turbo");
            }
            else if (modelLower.includes("gemini-2.5-flash")) {
                pricing = this.tokenPrices.get("gemini-2.5-flash");
            }
            else if (modelLower.includes("gemini-2.5-pro")) {
                pricing = this.tokenPrices.get("gemini-2.5-pro");
            }
            else if (modelLower.includes("gemini")) {
                pricing = this.tokenPrices.get("gemini-2.5-flash"); // Default Gemini
            }
            else {
                // Use provider-based fallback
                pricing = this.tokenPrices.get("copilot-default");
            }
            if (!pricing) {
                logger_1.logger.warn(`No pricing data for model: ${model}, using default`);
                return 0;
            }
        }
        const inputCost = (inputTokens / 1000) * pricing.inputPricePerK;
        const outputCost = (outputTokens / 1000) * pricing.outputPricePerK;
        return inputCost + outputCost;
    }
    estimateTokensFromCode(code, language) {
        // Advanced token estimation based on code characteristics
        const baseTokens = this.estimateTokensSimple(code);
        // Language-specific multipliers based on historical data
        const languageMultipliers = {
            "typescript": 1.2,
            "javascript": 1.1,
            "html": 1.3,
            "css": 1.0,
            "python": 1.1,
            "java": 1.2,
            "react": 1.4,
            "vue": 1.3,
            "angular": 1.4
        };
        const multiplier = languageMultipliers[language.toLowerCase()] || 1.1;
        const estimatedInput = Math.ceil(baseTokens * multiplier);
        // Output tokens are typically 20-40% of input for WCAG improvements
        const estimatedOutput = Math.ceil(estimatedInput * 0.3);
        return {
            input: estimatedInput,
            output: estimatedOutput
        };
    }
    estimateTokensSimple(text) {
        // Rough token estimation: ~4 characters per token on average
        // This is a simplified approach; real tokenization would be more accurate
        const charCount = text.length;
        const wordCount = text.split(/\s+/).length;
        const lineCount = text.split('\n').length;
        // Enhanced estimation considering code structure
        const baseTokens = Math.ceil(charCount / 4);
        const structuralTokens = Math.ceil(wordCount * 0.1); // Keywords, operators
        const newlineTokens = Math.ceil(lineCount * 0.5); // Line breaks
        return baseTokens + structuralTokens + newlineTokens;
    }
    getTokenAnalytics() {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const recentUsage = this.tokenUsageHistory.filter(u => u.timestamp > thirtyDaysAgo);
        const totalCost = recentUsage.reduce((sum, u) => sum + (u.costUSD || 0), 0);
        const totalTokens = recentUsage.reduce((sum, u) => sum + u.tokensUsed, 0);
        const totalOperations = recentUsage.length;
        // Cost by model
        const costByModel = {};
        const costByProvider = {};
        const costByLanguage = {};
        recentUsage.forEach(usage => {
            const cost = usage.costUSD || 0;
            costByModel[usage.model] = (costByModel[usage.model] || 0) + cost;
            costByProvider[usage.provider] = (costByProvider[usage.provider] || 0) + cost;
            costByLanguage[usage.codeLanguage] = (costByLanguage[usage.codeLanguage] || 0) + cost;
        });
        // Calculate efficiency metrics
        const efficiency = this.calculateEfficiencyMetrics(recentUsage);
        // Generate trends
        const trends = this.generateTrends(recentUsage);
        // Generate recommendations
        const recommendations = this.generateRecommendations(recentUsage);
        return {
            totalCost,
            totalTokens,
            averageCostPerOperation: totalOperations > 0 ? totalCost / totalOperations : 0,
            costByModel,
            costByProvider,
            costByLanguage,
            efficiency,
            trends,
            recommendations
        };
    }
    calculateEfficiencyMetrics(usage) {
        if (usage.length === 0) {
            return {
                tokensPerLine: 0,
                tokensPerSecond: 0,
                costPerLine: 0,
                costPerImprovement: 0,
                efficiency: 0
            };
        }
        const totalTokens = usage.reduce((sum, u) => sum + u.tokensUsed, 0);
        const totalLines = usage.reduce((sum, u) => sum + u.linesProcessed, 0);
        const totalTime = usage.reduce((sum, u) => sum + u.processingTime, 0);
        const totalCost = usage.reduce((sum, u) => sum + (u.costUSD || 0), 0);
        const improvements = usage.filter(u => u.operationType === "improvement").length;
        const tokensPerLine = totalLines > 0 ? totalTokens / totalLines : 0;
        const tokensPerSecond = totalTime > 0 ? totalTokens / (totalTime / 1000) : 0;
        const costPerLine = totalLines > 0 ? totalCost / totalLines : 0;
        const costPerImprovement = improvements > 0 ? totalCost / improvements : 0;
        // Calculate efficiency score (0-100)
        // Lower cost per line and higher tokens per second = higher efficiency
        const baseEfficiency = 50;
        const costPenalty = Math.min(costPerLine * 1000, 30); // Penalize high cost per line
        const speedBonus = Math.min(tokensPerSecond / 10, 20); // Bonus for high speed
        const efficiency = Math.max(0, Math.min(100, baseEfficiency - costPenalty + speedBonus));
        return {
            tokensPerLine,
            tokensPerSecond,
            costPerLine,
            costPerImprovement,
            efficiency
        };
    }
    generateTrends(usage) {
        const daily = {};
        const weekly = {};
        const monthly = {};
        usage.forEach(u => {
            const date = new Date(u.timestamp);
            const dateStr = date.toISOString().split('T')[0];
            const weekStr = this.getWeekString(date);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const cost = u.costUSD || 0;
            const tokens = u.tokensUsed;
            // Daily
            if (!daily[dateStr])
                daily[dateStr] = { cost: 0, tokens: 0 };
            daily[dateStr].cost += cost;
            daily[dateStr].tokens += tokens;
            // Weekly
            if (!weekly[weekStr])
                weekly[weekStr] = { cost: 0, tokens: 0 };
            weekly[weekStr].cost += cost;
            weekly[weekStr].tokens += tokens;
            // Monthly
            if (!monthly[monthStr])
                monthly[monthStr] = { cost: 0, tokens: 0 };
            monthly[monthStr].cost += cost;
            monthly[monthStr].tokens += tokens;
        });
        return { daily, weekly, monthly };
    }
    generateRecommendations(usage) {
        const modelEfficiency = {};
        // Calculate efficiency by model
        usage.forEach(u => {
            const cost = u.costUSD || 0;
            if (!modelEfficiency[u.model]) {
                modelEfficiency[u.model] = { cost: 0, operations: 0, efficiency: 0 };
            }
            modelEfficiency[u.model].cost += cost;
            modelEfficiency[u.model].operations += 1;
        });
        // Calculate efficiency scores
        Object.keys(modelEfficiency).forEach(model => {
            const data = modelEfficiency[model];
            const avgCost = data.operations > 0 ? data.cost / data.operations : Infinity;
            data.efficiency = avgCost > 0 ? 1 / avgCost : 0;
        });
        // Find most efficient model
        const mostEfficientModel = Object.keys(modelEfficiency).reduce((best, current) => {
            return modelEfficiency[current].efficiency > modelEfficiency[best]?.efficiency ? current : best;
        }, Object.keys(modelEfficiency)[0] || "gemini-2.5-flash");
        // Generate cost saving tips
        const costSavingTips = [];
        const totalCost = usage.reduce((sum, u) => sum + (u.costUSD || 0), 0);
        if (totalCost > 1) {
            costSavingTips.push("Consider using Gemini 2.5 Flash for simple improvements to reduce costs");
        }
        const geminiUsage = usage.filter(u => u.provider === "gemini").length;
        const copilotUsage = usage.filter(u => u.provider === "vscode-copilot").length;
        if (copilotUsage > geminiUsage && totalCost > 0.1) {
            costSavingTips.push("Gemini models often provide better cost efficiency for WCAG tasks");
        }
        if (usage.some(u => u.linesProcessed > 100)) {
            costSavingTips.push("Break large files into smaller chunks to optimize token usage");
        }
        // Calculate optimization score
        const avgCostPerOp = usage.length > 0 ? totalCost / usage.length : 0;
        const optimizationScore = Math.max(0, Math.min(100, 100 - (avgCostPerOp * 10000)));
        return {
            mostEfficientModel,
            costSavingTips,
            optimizationScore
        };
    }
    predictTokenUsage(code, language, operationType) {
        const tokenEstimate = this.estimateTokensFromCode(code, language);
        const totalTokens = tokenEstimate.input + tokenEstimate.output;
        // Get historical data for similar operations
        const similarOperations = this.tokenUsageHistory.filter(u => u.operationType === operationType &&
            u.codeLanguage.toLowerCase() === language.toLowerCase());
        // Calculate confidence based on historical data
        const confidence = Math.min(0.95, similarOperations.length / 50);
        // Adjust estimate based on historical averages
        if (similarOperations.length > 0) {
            const avgTokensPerLine = similarOperations.reduce((sum, u) => sum + u.tokensUsed / u.linesProcessed, 0) / similarOperations.length;
            const estimatedLines = code.split('\n').length;
            const historicalEstimate = avgTokensPerLine * estimatedLines;
            // Blend estimates
            const blendedEstimate = (totalTokens * 0.6) + (historicalEstimate * 0.4);
            tokenEstimate.input = Math.ceil(blendedEstimate * 0.7);
            tokenEstimate.output = Math.ceil(blendedEstimate * 0.3);
        }
        // Find recommended model based on cost efficiency
        const models = Array.from(this.tokenPrices.keys());
        const modelCosts = models.map(model => ({
            model,
            cost: this.calculateTokenCost(model, tokenEstimate.input, tokenEstimate.output)
        })).sort((a, b) => a.cost - b.cost);
        const recommendedModel = modelCosts[0]?.model || "gemini-2.5-flash";
        const estimatedCost = modelCosts[0]?.cost || 0;
        const reasoning = [];
        reasoning.push(`Estimated ${totalTokens} tokens for ${language} ${operationType}`);
        reasoning.push(`Most cost-effective model: ${recommendedModel} ($${estimatedCost.toFixed(4)})`);
        if (confidence < 0.5) {
            reasoning.push("Limited historical data - estimates may vary");
        }
        return {
            estimatedTokens: totalTokens,
            estimatedCost,
            confidence,
            recommendedModel,
            reasoning
        };
    }
    getWeekString(date) {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    updateTokenPrices(newPrices) {
        newPrices.forEach(price => {
            this.tokenPrices.set(price.model, price);
        });
        this.saveTokenData();
    }
    getTokenPrice(model) {
        return this.tokenPrices.get(model);
    }
    exportTokenData() {
        return {
            usage: this.tokenUsageHistory,
            prices: Array.from(this.tokenPrices.values()),
            analytics: this.getTokenAnalytics()
        };
    }
    resetTokenData() {
        this.tokenUsageHistory = [];
        this.saveTokenData();
    }
    loadTokenData() {
        try {
            const data = this.context.globalState.get("wcagEnhancer.tokenData", {});
            this.tokenUsageHistory = data.usage || [];
            if (data.prices) {
                data.prices.forEach((price) => {
                    this.tokenPrices.set(price.model, price);
                });
            }
        }
        catch (error) {
            logger_1.logger.error("Error loading token data:", error);
            this.tokenUsageHistory = [];
        }
    }
    saveTokenData() {
        try {
            const data = {
                usage: this.tokenUsageHistory,
                prices: Array.from(this.tokenPrices.values())
            };
            this.context.globalState.update("wcagEnhancer.tokenData", data);
        }
        catch (error) {
            logger_1.logger.error("Error saving token data:", error);
        }
    }
}
exports.TokenAnalyticsManager = TokenAnalyticsManager;
//# sourceMappingURL=tokenAnalytics.js.map