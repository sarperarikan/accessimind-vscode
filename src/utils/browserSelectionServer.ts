import * as crypto from "crypto";
import * as http from "http";
import { EventEmitter } from "events";

export interface BrowserSelectionPayload {
    outerHTML: string;
    selector: string;
    tagName: string;
    textPreview: string;
    parentChain: string[];
    contextHtml: string;
    pageUrl: string;
    pageTitle?: string;
}

interface BrowserSelectionEnvelope {
    sessionToken?: string;
    payload?: BrowserSelectionPayload;
}

type BrowserSelectionServerEvents = {
    selection: (payload: BrowserSelectionPayload) => void;
    status: (message: string) => void;
    error: (message: string) => void;
};

const DEFAULT_PORTS = [3210, 3211, 3212, 3213, 3214];

export class BrowserSelectionServer extends EventEmitter {
    private server: http.Server | undefined;
    private sessionToken = "";
    private port = 0;

    public on<E extends keyof BrowserSelectionServerEvents>(event: E, listener: BrowserSelectionServerEvents[E]): this {
        return super.on(event, listener);
    }

    public emit<E extends keyof BrowserSelectionServerEvents>(event: E, ...args: Parameters<BrowserSelectionServerEvents[E]>): boolean {
        return super.emit(event, ...args);
    }

    public async start(): Promise<{ endpointUrl: string; sessionToken: string; port: number }> {
        if (this.server && this.port && this.sessionToken) {
            return {
                endpointUrl: this.getEndpointUrl(),
                sessionToken: this.sessionToken,
                port: this.port
            };
        }

        this.sessionToken = crypto.randomBytes(16).toString("hex");
        this.server = http.createServer((request, response) => {
            void this.handleRequest(request, response);
        });

        this.port = await this.listenOnAvailablePort(this.server);
        this.emit("status", `Browser selection server listening on ${this.getEndpointUrl()}`);

        return {
            endpointUrl: this.getEndpointUrl(),
            sessionToken: this.sessionToken,
            port: this.port
        };
    }

    public getEndpointUrl(): string {
        return `http://127.0.0.1:${this.port}/accessimind/selection`;
    }

    public getSessionToken(): string {
        return this.sessionToken;
    }

    public async dispose(): Promise<void> {
        if (!this.server) {
            return;
        }

        const server = this.server;
        this.server = undefined;
        this.port = 0;
        this.sessionToken = "";

        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }

    private async handleRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

        if (request.method === "OPTIONS") {
            response.writeHead(204);
            response.end();
            return;
        }

        if (request.method !== "POST" || request.url !== "/accessimind/selection") {
            response.writeHead(404, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Not found" }));
            return;
        }

        const body = await this.readRequestBody(request);
        let envelope: BrowserSelectionEnvelope;

        try {
            envelope = JSON.parse(body) as BrowserSelectionEnvelope;
        } catch {
            response.writeHead(400, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Invalid JSON payload" }));
            return;
        }

        if (envelope.sessionToken !== this.sessionToken) {
            response.writeHead(403, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Invalid session token" }));
            return;
        }

        if (!envelope.payload?.outerHTML || !envelope.payload.selector || !envelope.payload.pageUrl) {
            response.writeHead(400, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Missing selection payload" }));
            return;
        }

        this.emit("selection", envelope.payload);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
    }

    private async readRequestBody(request: http.IncomingMessage): Promise<string> {
        const chunks: Buffer[] = [];

        for await (const chunk of request) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }

        return Buffer.concat(chunks).toString("utf8");
    }

    private async listenOnAvailablePort(server: http.Server): Promise<number> {
        for (const port of DEFAULT_PORTS) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const onError = (error: NodeJS.ErrnoException) => {
                        server.off("listening", onListening);
                        reject(error);
                    };
                    const onListening = () => {
                        server.off("error", onError);
                        resolve();
                    };

                    server.once("error", onError);
                    server.once("listening", onListening);
                    server.listen(port, "127.0.0.1");
                });

                return port;
            } catch (error) {
                const err = error as NodeJS.ErrnoException;
                if (err.code !== "EADDRINUSE") {
                    throw error;
                }
            }
        }

        throw new Error("No available localhost port was found for the browser selection server.");
    }
}
