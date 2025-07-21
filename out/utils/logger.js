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
exports.logger = exports.LOG_LEVELS = void 0;
const vscode = __importStar(require("vscode"));
exports.LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};
class Logger {
    constructor() {
        this.logLevel = exports.LOG_LEVELS.INFO;
        this.outputChannel = vscode.window.createOutputChannel("Gemini Flash Extension");
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        let formattedMessage = `[${timestamp}] [${level}] ${message}`;
        if (data) {
            formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
        }
        return formattedMessage;
    }
    debug(message, data) {
        if (this.logLevel <= exports.LOG_LEVELS.DEBUG) {
            const formattedMessage = this.formatMessage("DEBUG", message, data);
            this.outputChannel.appendLine(formattedMessage);
            console.debug(formattedMessage);
        }
    }
    info(message, data) {
        if (this.logLevel <= exports.LOG_LEVELS.INFO) {
            const formattedMessage = this.formatMessage("INFO", message, data);
            this.outputChannel.appendLine(formattedMessage);
            console.info(formattedMessage);
        }
    }
    warn(message, data) {
        if (this.logLevel <= exports.LOG_LEVELS.WARN) {
            const formattedMessage = this.formatMessage("WARN", message, data);
            this.outputChannel.appendLine(formattedMessage);
            console.warn(formattedMessage);
        }
    }
    error(message, error) {
        if (this.logLevel <= exports.LOG_LEVELS.ERROR) {
            const formattedMessage = this.formatMessage("ERROR", message, error);
            this.outputChannel.appendLine(formattedMessage);
            console.error(formattedMessage);
        }
    }
    showOutput() {
        this.outputChannel.show();
    }
    clear() {
        this.outputChannel.clear();
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map