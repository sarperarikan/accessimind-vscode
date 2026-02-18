import * as https from "https";

/**
 * Optimized HTTP Agent for API requests
 * Provides connection pooling, keep-alive, and timeout management
 */
export class OptimizedHttpAgent {
    private static instance: OptimizedHttpAgent;
    private agent: https.Agent;
    private requestQueue: Map<string, Promise<any>> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    private constructor() {
        // Create optimized agent with connection pooling
        this.agent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,  // Keep connections alive for 30 seconds
            maxSockets: 10,         // Max concurrent connections
            maxFreeSockets: 5,      // Max idle connections
            timeout: 60000,         // 60 second timeout
            scheduling: 'fifo'      // First-in-first-out scheduling
        });
    }

    public static getInstance(): OptimizedHttpAgent {
        if (!OptimizedHttpAgent.instance) {
            OptimizedHttpAgent.instance = new OptimizedHttpAgent();
        }
        return OptimizedHttpAgent.instance;
    }

    public getAgent(): https.Agent {
        return this.agent;
    }

    /**
     * Deduplicate identical requests - if same request is in flight, return that promise
     */
    public async deduplicatedRequest<T>(
        key: string,
        requestFn: () => Promise<T>
    ): Promise<T> {
        // Check if identical request is already in flight
        const existingRequest = this.requestQueue.get(key);
        if (existingRequest) {
            return existingRequest as Promise<T>;
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
    public debounce<T>(
        key: string,
        requestFn: () => Promise<T>,
        delayMs: number = 300
    ): Promise<T> {
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
                } catch (error) {
                    reject(error);
                }
            }, delayMs);

            this.debounceTimers.set(key, timer);
        });
    }

    /**
     * Retry with exponential backoff
     */
    public async retryWithBackoff<T>(
        requestFn: () => Promise<T>,
        maxRetries: number = 3,
        baseDelayMs: number = 1000,
        shouldCancel?: () => boolean
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error as Error;

                // Don't retry on certain errors
                const errorMessage = lastError.message.toLowerCase();
                if (
                    errorMessage.includes('invalid api key') ||
                    errorMessage.includes('unauthorized') ||
                    errorMessage.includes('quota exceeded')
                ) {
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

    public destroy(): void {
        this.agent.destroy();
        this.requestQueue.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }
}

/**
 * Request options with optimization features
 */
export interface OptimizedRequestOptions {
    enableCompression?: boolean;
    timeout?: number;
    retries?: number;
    deduplicate?: boolean;
    debounceMs?: number;
}

/**
 * Create optimized HTTPS request options
 */
export function createOptimizedRequestOptions(
    baseOptions: https.RequestOptions,
    optimizations?: OptimizedRequestOptions
): https.RequestOptions {
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
export class PromptOptimizer {
    /**
     * Compress code by removing unnecessary whitespace (preserving readability)
     */
    public static compressCode(code: string): string {
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
    public static truncateCode(code: string, maxChars: number = 200000): string {
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
    public static createConcisePrompt(
        code: string,
        task: 'analyze' | 'improve' | 'explain',
        options: {
            wcagLevel?: 'A' | 'AA' | 'AAA';
            language?: string;
            responseLanguage?: 'en' | 'tr';
        } = {}
    ): string {
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
    public static estimateTokens(text: string): number {
        // Average: 1 token ≈ 4 characters for English, 2-3 for code
        const words = text.split(/\s+/).length;
        const chars = text.length;

        // Use a weighted average
        return Math.ceil((words * 1.3) + (chars / 4));
    }

    /**
     * Check if request should be batched for efficiency
     */
    public static shouldBatch(codeLength: number): boolean {
        return codeLength < 500; // Small code snippets can be batched
    }
}

/**
 * Response streaming helper for faster first-byte time
 */
export class StreamingResponseHandler {
    private buffer: string = '';
    private onChunk?: (chunk: string) => void;
    private onComplete?: (fullContent: string) => void;

    constructor(options?: {
        onChunk?: (chunk: string) => void;
        onComplete?: (fullContent: string) => void;
    }) {
        this.onChunk = options?.onChunk;
        this.onComplete = options?.onComplete;
    }

    public handleChunk(data: string | Buffer): void {
        const chunk = typeof data === 'string' ? data : data.toString('utf-8');
        this.buffer += chunk;

        if (this.onChunk) {
            this.onChunk(chunk);
        }
    }

    public complete(): string {
        if (this.onComplete) {
            this.onComplete(this.buffer);
        }
        return this.buffer;
    }

    public getBuffer(): string {
        return this.buffer;
    }
}

/**
 * Performance metrics for API calls
 */
export interface ApiMetrics {
    requestCount: number;
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    totalTokensUsed: number;
    errorCount: number;
}

export class ApiMetricsCollector {
    private static instance: ApiMetricsCollector;
    private metrics: ApiMetrics = {
        requestCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        totalTokensUsed: 0,
        errorCount: 0
    };
    private responseTimes: number[] = [];

    public static getInstance(): ApiMetricsCollector {
        if (!ApiMetricsCollector.instance) {
            ApiMetricsCollector.instance = new ApiMetricsCollector();
        }
        return ApiMetricsCollector.instance;
    }

    public recordRequest(responseTime: number, tokensUsed: number = 0, cached: boolean = false): void {
        this.metrics.requestCount++;

        if (cached) {
            this.metrics.cacheHits++;
        } else {
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

    public recordError(): void {
        this.metrics.errorCount++;
    }

    public getMetrics(): ApiMetrics {
        return { ...this.metrics };
    }

    public getCacheHitRate(): number {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
    }

    public reset(): void {
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
