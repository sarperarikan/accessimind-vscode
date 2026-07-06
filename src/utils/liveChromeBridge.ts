import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { EventEmitter } from "events";
import * as vscode from "vscode";
import { BrowserIntegrationConfig } from "./browserIntegrationUtils";
// chrome-remote-interface has no useful TS types in this repo setup.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CDP = require("chrome-remote-interface");

export interface LiveChromeSelectionPayload {
    outerHTML: string;
    selector: string;
    tagName: string;
    textPreview: string;
    parentChain: string[];
    contextHtml: string;
    pageUrl: string;
}

type LiveChromeEvents = {
    status: (message: string) => void;
    selection: (payload: LiveChromeSelectionPayload) => void;
    error: (message: string) => void;
    urlChanged: (url: string) => void;
};

const INSPECT_SCRIPT = `
(function() {
  if (window.__accessimindPickModeInstalled) return;
  window.__accessimindPickModeInstalled = true;
  let pickMode = false;
  let hovered = null;
  let menu = null;
  const ignored = new Set(["HTML","BODY","HEAD","META","LINK","SCRIPT","STYLE"]);

  function isInspectable(node) {
    return !!node && node.tagName && !ignored.has(node.tagName);
  }

  function clearHover() {
    if (!hovered) return;
    hovered.style.outline = hovered.dataset.accessimindOutline || "";
    delete hovered.dataset.accessimindOutline;
    hovered = null;
  }

  function selectorFor(element) {
    if (element.id) return "#" + element.id;
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      if (node.classList.length) part += "." + Array.from(node.classList).slice(0, 2).join(".");
      const siblingIndex = node.parentElement ? Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName).indexOf(node) : -1;
      if (siblingIndex >= 0) part += ":nth-of-type(" + (siblingIndex + 1) + ")";
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function parentChainFor(element) {
    const chain = [];
    let current = element;
    while (current && current.nodeType === 1 && chain.length < 6) {
      chain.unshift(current.tagName.toLowerCase());
      current = current.parentElement;
    }
    return chain;
  }

  function removeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
  }

  function emitSelection(element) {
    const payload = {
      outerHTML: element.outerHTML,
      selector: selectorFor(element),
      tagName: element.tagName.toLowerCase(),
      textPreview: (element.textContent || "").trim().slice(0, 160),
      parentChain: parentChainFor(element),
      contextHtml: (element.parentElement ? element.parentElement.outerHTML : element.outerHTML).slice(0, 6000),
      pageUrl: location.href
    };
    console.log("__ACCESSIMIND_SELECTION__" + JSON.stringify(payload));
  }

  function openMenu(event, element) {
    removeMenu();
    menu = document.createElement("div");
    Object.assign(menu.style, {
      position: "fixed",
      left: event.clientX + "px",
      top: event.clientY + "px",
      zIndex: "2147483647",
      background: "rgba(17, 24, 39, 0.98)",
      color: "#f8fafc",
      border: "1px solid rgba(148, 163, 184, 0.4)",
      borderRadius: "10px",
      boxShadow: "0 16px 30px rgba(0,0,0,0.28)",
      padding: "8px"
    });
    menu.innerHTML = '<button type="button" style="border:none;background:#0f766e;color:#f8fafc;padding:10px 14px;border-radius:8px;cursor:pointer;font:600 13px/1.2 system-ui,sans-serif;">Analyze with AI</button>';
    menu.querySelector("button").addEventListener("click", function() {
      emitSelection(element);
      removeMenu();
    });
    document.body.appendChild(menu);
  }

  document.addEventListener("mouseover", function(event) {
    if (!pickMode) return;
    const element = event.target && event.target.closest ? event.target.closest("*") : null;
    if (!isInspectable(element) || element === hovered) return;
    clearHover();
    hovered = element;
    hovered.dataset.accessimindOutline = hovered.style.outline || "";
    hovered.style.outline = "2px solid #f97316";
  }, true);

  document.addEventListener("mouseout", function(event) {
    if (!hovered || !event.relatedTarget || hovered.contains(event.relatedTarget)) return;
    clearHover();
  }, true);

  document.addEventListener("click", function() {
    removeMenu();
  }, true);

  document.addEventListener("contextmenu", function(event) {
    if (!pickMode) return;
    const element = event.target && event.target.closest ? event.target.closest("*") : null;
    if (!isInspectable(element)) return;
    event.preventDefault();
    openMenu(event, element);
  }, true);

  window.__accessimindSetPickMode = function(enabled) {
    pickMode = !!enabled;
    removeMenu();
    clearHover();
    return pickMode;
  };
})();
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function candidateBrowserPaths(): string[] {
    const localAppData = process.env.LOCALAPPDATA || "";
    return [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
    ];
}

export function detectBrowserExecutable(preferredPath?: string): string | undefined {
    if (preferredPath && preferredPath.trim()) {
        return fs.existsSync(preferredPath) ? preferredPath : undefined;
    }

    return candidateBrowserPaths().find((candidate) => fs.existsSync(candidate));
}

export class LiveChromeBridge extends EventEmitter {
    private readonly port = 9223;
    private readonly userDataDir = path.join(os.tmpdir(), "accessimind-live-chrome");
    private browserProcess: any;
    private client: any;
    private currentTargetId: string | undefined;
    private pickModeEnabled = false;
    private currentBrowserConfig: BrowserIntegrationConfig = {
        enabled: false,
        browserPath: "",
        launchMode: "new-isolated-window"
    };

    public on<E extends keyof LiveChromeEvents>(event: E, listener: LiveChromeEvents[E]): this {
        return super.on(event, listener);
    }

    public emit<E extends keyof LiveChromeEvents>(event: E, ...args: Parameters<LiveChromeEvents[E]>): boolean {
        return super.emit(event, ...args);
    }

    public async launchOrAttach(url: string, browserConfig: BrowserIntegrationConfig): Promise<void> {
        this.currentBrowserConfig = browserConfig;
        if (browserConfig.launchMode === "attach-existing-debug-session") {
            this.emit("status", "Attaching to an existing Chrome debugging session...");
            await this.attachToBestTarget(url);
            if (this.client) {
                await this.client.Page.navigate({ url });
            }
            return;
        }

        const executable = detectBrowserExecutable(browserConfig.browserPath);
        if (!executable) {
            throw new Error(
                browserConfig.browserPath
                    ? "Configured browserPath could not be found."
                    : "Chrome or Edge executable was not found on this machine."
            );
        }

        if (!this.browserProcess || this.browserProcess.killed) {
            fs.mkdirSync(this.userDataDir, { recursive: true });
            const { spawn } = await import("child_process");
            this.browserProcess = spawn(
                executable,
                [
                    `--remote-debugging-port=${this.port}`,
                    `--user-data-dir=${this.userDataDir}`,
                    "--new-window",
                    url
                ],
                {
                    detached: true,
                    stdio: "ignore"
                }
            );
            this.browserProcess.unref();
            this.emit("status", "Chrome launched. Waiting for the debugging port...");
            await sleep(1800);
        }

        await this.attachToBestTarget(url);
    }

    public async navigate(url: string): Promise<void> {
        if (!this.client) {
            await this.launchOrAttach(url, this.currentBrowserConfig);
            return;
        }

        await this.client.Page.navigate({ url });
        this.emit("status", "Chrome navigated to the requested URL.");
    }

    public async setPickMode(enabled: boolean): Promise<void> {
        this.pickModeEnabled = enabled;
        if (!this.client) {
            return;
        }

        await this.ensureInspectorInjected();
        await this.client.Runtime.evaluate({
            expression: `window.__accessimindSetPickMode && window.__accessimindSetPickMode(${enabled ? "true" : "false"});`,
            awaitPromise: false
        });
        this.emit("status", enabled ? "Pick mode enabled in Chrome." : "Pick mode disabled in Chrome.");
    }

    public async bringToFront(): Promise<void> {
        if (!this.client) {
            return;
        }
        await this.client.Page.bringToFront();
    }

    public async close(): Promise<void> {
        if (this.client) {
            try {
                await this.client.close();
            } catch {
                // ignore
            }
            this.client = undefined;
        }
    }

    private async attachToBestTarget(url: string): Promise<void> {
        const targets = await this.waitForTargets();
        const normalizedUrl = url.replace(/\/$/, "");
        const target =
            targets.find((item: any) => item.type === "page" && item.url.replace(/\/$/, "") === normalizedUrl) ||
            targets.find((item: any) => item.type === "page" && item.url.startsWith(normalizedUrl)) ||
            targets.find((item: any) => item.type === "page");

        if (!target) {
            throw new Error("No Chrome page target was found for the requested URL.");
        }

        if (this.client) {
            try {
                await this.client.close();
            } catch {
                // ignore
            }
        }

        this.currentTargetId = target.id;
        this.client = await CDP({ target, port: this.port });
        await this.client.Page.enable();
        await this.client.Runtime.enable();

        this.client.Runtime.consoleAPICalled((event: any) => {
            const value = event.args?.[0]?.value;
            if (typeof value !== "string" || !value.startsWith("__ACCESSIMIND_SELECTION__")) {
                return;
            }
            try {
                const payload = JSON.parse(value.slice("__ACCESSIMIND_SELECTION__".length));
                this.emit("selection", payload);
            } catch (error) {
                this.emit("error", `Failed to parse Chrome selection payload: ${String(error)}`);
            }
        });

        this.client.Page.loadEventFired(async () => {
            await this.ensureInspectorInjected();
            if (this.pickModeEnabled) {
                await this.setPickMode(true);
            }
            const currentUrl = await this.readCurrentUrl();
            if (currentUrl) {
                this.emit("urlChanged", currentUrl);
            }
        });

        await this.ensureInspectorInjected();
        const currentUrl = await this.readCurrentUrl();
        if (currentUrl) {
            this.emit("urlChanged", currentUrl);
        }
        this.emit("status", "Connected to live Chrome.");
    }

    private async ensureInspectorInjected(): Promise<void> {
        if (!this.client) {
            return;
        }

        await this.client.Runtime.evaluate({
            expression: INSPECT_SCRIPT,
            awaitPromise: false
        });
    }

    private async readCurrentUrl(): Promise<string | undefined> {
        if (!this.client) {
            return undefined;
        }
        const result = await this.client.Runtime.evaluate({
            expression: "location.href",
            returnByValue: true
        });
        return result?.result?.value;
    }

    private async waitForTargets(): Promise<any[]> {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            try {
                const targets = await CDP.List({ port: this.port });
                if (targets.length > 0) {
                    return targets;
                }
            } catch {
                // wait for Chrome port
            }
            await sleep(500);
        }
        throw new Error("Chrome debugging port did not become available.");
    }
}
