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
exports.ApiMetricsCollector = exports.StreamingResponseHandler = exports.PromptOptimizer = exports.OptimizedHttpAgent = void 0;
exports.createOptimizedRequestOptions = createOptimizedRequestOptions;
const https = __importStar(require("https"));
/**
 * Optimized HTTP Agent for API requests
 * Provides connection pooling, keep-alive, and timeout management
 */
class OptimizedHttpAgent {
    constructor() {
        this.requestQueue = new Map();
        this.debounceTimers = new Map();
        // Create optimized agent with connection pooling
        this.agent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000, // Keep connections alive for 30 seconds
            maxSockets: 10, // Max concurrent connections
            maxFreeSockets: 5, // Max idle connections
            timeout: 60000, // 60 second timeout
            scheduling: 'fifo' // First-in-first-out scheduling
        });
    }
    static getInstance() {
        if (!OptimizedHttpAgent.instance) {
            OptimizedHttpAgent.instance = new OptimizedHttpAgent();
        }
        return OptimizedHttpAgent.instance;
    }
    getAgent() {
        return this.agent;
    }
    /**
     * Deduplicate identical requests - if same request is in flight, return that promise
     */
    async deduplicatedRequest(key, requestFn) {
        // Check if identical request is already in flight
        const existingRequest = this.requestQueue.get(key);
        if (existingRequest) {
            return existingRequest;
        }
        // Create new request and store it
        const requestPromise = requestFn().finally(() => {
            this.requestQueue.delete(key);
        });
        this.requestQueue.set(key, requestPromise);
        return requestPromise;
    }
    /**
     * Debounce rapid requests - wait for a pause in activity before sending
     */
    debounce(key, requestFn, delayMs = 300) {
        return new Promise((resolve, reject) => {
            // Clear existing timer
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            // Set new timer
            const timer = setTimeout(async () => {
                this.debounceTimers.delete(key);
                try {
                    const result = await requestFn();
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            }, delayMs);
            this.debounceTimers.set(key, timer);
        });
    }
    /**
     * Retry with exponential backoff
     */
    async retryWithBackoff(requestFn, maxRetries = 3, baseDelayMs = 1000, shouldCancel) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            }
            catch (error) {
                lastError = error;
                // Don't retry on certain errors
                const errorMessage = lastError.message.toLowerCase();
                if (errorMessage.includes('invalid api key') ||
                    errorMessage.includes('unauthorized') ||
                    errorMessage.includes('quota exceeded')) {
                    throw lastError;
                }
                if (attempt < maxRetries) {
                    if (shouldCancel && shouldCancel()) {
                        throw new Error('Operation cancelled');
                    }
                    const jitter = Math.floor(Math.random() * 100);
                    const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }
    destroy() {
        this.agent.destroy();
        this.requestQueue.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }
}
exports.OptimizedHttpAgent = OptimizedHttpAgent;
/**
 * Create optimized HTTPS request options
 */
function createOptimizedRequestOptions(baseOptions, optimizations) {
    const agent = OptimizedHttpAgent.getInstance().getAgent();
    return {
        ...baseOptions,
        agent,
        timeout: optimizations?.timeout ?? 60000,
        headers: {
            ...baseOptions.headers,
            // Enable compression for smaller payloads
            ...(optimizations?.enableCompression !== false ? {
                'Accept-Encoding': 'gzip, deflate'
            } : {}),
            // Connection keep-alive
            'Connection': 'keep-alive'
        }
    };
}
/**
 * Prompt optimizer for reducing token usage
 */
class PromptOptimizer {
    /**
     * Compress code by removing unnecessary whitespace (preserving readability)
     */
    static compressCode(code) {
        // Remove excessive blank lines (more than 2 consecutive)
        let compressed = code.replace(/\n{3,}/g, '\n\n');
        // Remove trailing whitespace from each line
        compressed = compressed.split('\n')
            .map(line => line.trimEnd())
            .join('\n');
        // Trim start and end
        return compressed.trim();
    }
    /**
     * Truncate code if it's too long
     */
    static truncateCode(code, maxChars = 8000) {
        if (code.length <= maxChars) {
            return code;
        }
        // Try to truncate at a logical break point
        const truncated = code.substring(0, maxChars);
        const lastNewline = truncated.lastIndexOf('\n');
        if (lastNewline > maxChars * 0.8) {
            return truncated.substring(0, lastNewline) + '\n// ... (truncated for brevity)';
        }
        return truncated + '\n// ... (truncated for brevity)';
    }
    /**
     * Create a more efficient prompt for simple tasks
     */
    static createConcisePrompt(code, task, options = {}) {
        const { wcagLevel = 'AA', language = 'html', responseLanguage = 'en' } = options;
        // Use shorter, more direct prompts
        const prompts = {
            analyze: {
                en: `WCAG ${wcagLevel} audit of ${language} code. List issues with criteria numbers.`,
                tr: `${language} kodu için WCAG ${wcagLevel} denetimi. Sorunları kriter numaralarıyla listele.`
            },
            improve: {
                en: `Improve this ${language} code for WCAG ${wcagLevel}. Return only improved code with brief comments.`,
                tr: `Bu ${language} kodunu WCAG ${wcagLevel} için iyileştir. Sadece iyileştirilmiş kodu kısa yorumlarla döndür.`
            },
            explain: {
                en: `Explain WCAG ${wcagLevel} issues in this ${language} code briefly.`,
                tr: `Bu ${language} kodundaki WCAG ${wcagLevel} sorunlarını kısaca açıkla.`
            }
        };
        const prompt = prompts[task][responseLanguage];
        const compressedCode = this.compressCode(code);
        const truncatedCode = this.truncateCode(compressedCode);
        return `${prompt}\n\n\`\`\`${language}\n${truncatedCode}\n\`\`\``;
    }
    /**
     * Estimate token count (rough approximation)
     */
    static estimateTokens(text) {
        // Average: 1 token ≈ 4 characters for English, 2-3 for code
        const words = text.split(/\s+/).length;
        const chars = text.length;
        // Use a weighted average
        return Math.ceil((words * 1.3) + (chars / 4));
    }
    /**
     * Check if request should be batched for efficiency
     */
    static shouldBatch(codeLength) {
        return codeLength < 500; // Small code snippets can be batched
    }
}
exports.PromptOptimizer = PromptOptimizer;
/**
 * Response streaming helper for faster first-byte time
 */
class StreamingResponseHandler {
    constructor(options) {
        this.buffer = '';
        this.onChunk = options?.onChunk;
        this.onComplete = options?.onComplete;
    }
    handleChunk(data) {
        const chunk = typeof data === 'string' ? data : data.toString('utf-8');
        this.buffer += chunk;
        if (this.onChunk) {
            this.onChunk(chunk);
        }
    }
    complete() {
        if (this.onComplete) {
            this.onComplete(this.buffer);
        }
        return this.buffer;
    }
    getBuffer() {
        return this.buffer;
    }
}
exports.StreamingResponseHandler = StreamingResponseHandler;
class ApiMetricsCollector {
    constructor() {
        this.metrics = {
            requestCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageResponseTime: 0,
            totalTokensUsed: 0,
            errorCount: 0
        };
        this.responseTimes = [];
    }
    static getInstance() {
        if (!ApiMetricsCollector.instance) {
            ApiMetricsCollector.instance = new ApiMetricsCollector();
        }
        return ApiMetricsCollector.instance;
    }
    recordRequest(responseTime, tokensUsed = 0, cached = false) {
        this.metrics.requestCount++;
        if (cached) {
            this.metrics.cacheHits++;
        }
        else {
            this.metrics.cacheMisses++;
        }
        this.responseTimes.push(responseTime);
        if (this.responseTimes.length > 100) {
            this.responseTimes.shift(); // Keep last 100 for rolling average
        }
        this.metrics.averageResponseTime =
            this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        this.metrics.totalTokensUsed += tokensUsed;
    }
    recordError() {
        this.metrics.errorCount++;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getCacheHitRate() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
    }
    reset() {
        this.metrics = {
            requestCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageResponseTime: 0,
            totalTokensUsed: 0,
            errorCount: 0
        };
        this.responseTimes = [];
    }
}
exports.ApiMetricsCollector = ApiMetricsCollector;
//# sourceMappingURL=apiOptimizer.js.map