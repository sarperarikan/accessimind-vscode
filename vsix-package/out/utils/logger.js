"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;

class Logger {
    constructor() {
        this.outputChannel = null;
    }
    
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    
    log(message) {
        console.log(`[AccessiMind] ${message}`);
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
        }
    }
    
    info(message) {
        this.log(`INFO: ${message}`);
    }
    
    warn(message) {
        this.log(`WARN: ${message}`);
    }
    
    error(message) {
        this.log(`ERROR: ${message}`);
    }
    
    setOutputChannel(channel) {
        this.outputChannel = channel;
    }
}

exports.logger = Logger.getInstance(); 