
import * as crypto from "crypto";

export interface CacheEntry<T> {
    response: T;
    timestamp: number;
}

export class RequestCache<T extends { cached?: boolean }> {
    private static instances: Map<string, RequestCache<any>> = new Map();
    private cache: Map<string, CacheEntry<T>> = new Map();
    private readonly TTL = 1000 * 60 * 60; // 1 hour TTL
    private readonly MAX_SIZE = 50;

    // Use named instances to share cache across same provider types if needed, 
    // or unique instances per provider class
    public static getInstance<T extends { cached?: boolean }>(namespace: string): RequestCache<T> {
        if (!RequestCache.instances.has(namespace)) {
            RequestCache.instances.set(namespace, new RequestCache<T>());
        }
        return RequestCache.instances.get(namespace) as RequestCache<T>;
    }

    public get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() - entry.timestamp > this.TTL) {
            this.cache.delete(key);
            return undefined;
        }

        return { ...entry.response, cached: true };
    }

    public set(key: string, response: T): void {
        if (this.cache.size >= this.MAX_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, {
            response: { ...response, cached: true },
            timestamp: Date.now()
        });
    }

    public generateKey(model: string, prompt: string): string {
        return crypto.createHash("md5").update(`${model}:${prompt}`).digest("hex");
    }

    public clear(): void {
        this.cache.clear();
    }
}
