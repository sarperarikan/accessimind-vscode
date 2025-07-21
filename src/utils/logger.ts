import * as vscode from "vscode";

export interface LogLevel {
	DEBUG: 0
	INFO: 1
	WARN: 2
	ERROR: 3
}

export const LOG_LEVELS: LogLevel = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3
};

class Logger {
	private outputChannel: vscode.OutputChannel;
	private logLevel: number = LOG_LEVELS.INFO;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel("Gemini Flash Extension");
	}

	setLogLevel(level: number) {
		this.logLevel = level;
	}

	private formatMessage(level: string, message: string, data?: any): string {
		const timestamp = new Date().toISOString();
		let formattedMessage = `[${timestamp}] [${level}] ${message}`;
		
		if (data) {
			formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
		}
		
		return formattedMessage;
	}

	debug(message: string, data?: any) {
		if (this.logLevel <= LOG_LEVELS.DEBUG) {
			const formattedMessage = this.formatMessage("DEBUG", message, data);
			this.outputChannel.appendLine(formattedMessage);
			console.debug(formattedMessage);
		}
	}

	info(message: string, data?: any) {
		if (this.logLevel <= LOG_LEVELS.INFO) {
			const formattedMessage = this.formatMessage("INFO", message, data);
			this.outputChannel.appendLine(formattedMessage);
			console.info(formattedMessage);
		}
	}

	warn(message: string, data?: any) {
		if (this.logLevel <= LOG_LEVELS.WARN) {
			const formattedMessage = this.formatMessage("WARN", message, data);
			this.outputChannel.appendLine(formattedMessage);
			console.warn(formattedMessage);
		}
	}

	error(message: string, error?: any) {
		if (this.logLevel <= LOG_LEVELS.ERROR) {
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

export const logger = new Logger(); 