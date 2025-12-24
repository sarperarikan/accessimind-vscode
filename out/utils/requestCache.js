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
exports.RequestCache = void 0;
const crypto = __importStar(require("crypto"));
class RequestCache {
    constructor() {
        this.cache = new Map();
        this.TTL = 1000 * 60 * 60; // 1 hour TTL
        this.MAX_SIZE = 50;
    }
    // Use named instances to share cache across same provider types if needed, 
    // or unique instances per provider class
    static getInstance(namespace) {
        if (!RequestCache.instances.has(namespace)) {
            RequestCache.instances.set(namespace, new RequestCache());
        }
        return RequestCache.instances.get(namespace);
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        if (Date.now() - entry.timestamp > this.TTL) {
            this.cache.delete(key);
            return undefined;
        }
        return { ...entry.response, cached: true };
    }
    set(key, response) {
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
    generateKey(model, prompt) {
        return crypto.createHash("md5").update(`${model}:${prompt}`).digest("hex");
    }
    clear() {
        this.cache.clear();
    }
}
exports.RequestCache = RequestCache;
RequestCache.instances = new Map();
//# sourceMappingURL=requestCache.js.map