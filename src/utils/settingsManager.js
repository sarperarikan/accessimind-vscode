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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsManager = void 0;
const vscode = __importStar(require("vscode"));
class SettingsManager {
    constructor() {
        this.setupConfigChangeListener();
    }
    static getInstance() {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }
    setupConfigChangeListener() {
        this.configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration("aiAccessibility.apiKey") || event.affectsConfiguration("aiAccessibility.model")) {
                this.onSettingsChanged();
            }
        });
    }
    onSettingsChanged() {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration("aiAccessibility");
            const apiKey = config.get("apiKey");
            const model = config.get("model");
            if (apiKey && apiKey.trim() !== "") {
                vscode.window.showInformationMessage("AI Accessibility API ayarları güncellendi.");
            }
            else {
                vscode.window.showWarningMessage("AI Accessibility API anahtarı boş veya eksik.");
            }
        });
    }
    updateApiKey(apiKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration("aiAccessibility");
            yield config.update("apiKey", apiKey, vscode.ConfigurationTarget.Global);
        });
    }
    updateModel(model) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration("aiAccessibility");
            yield config.update("model", model, vscode.ConfigurationTarget.Global);
        });
    }
    validateSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration("aiAccessibility");
            const apiKey = config.get("apiKey");
            const model = config.get("model");
            if (!apiKey || apiKey.trim() === "") {
                return { isValid: false, message: "API anahtarı ayarlanmamış." };
            }
            if (!model || model.trim() === "") {
                return { isValid: false, message: "Model seçimi yapılmamış." };
            }
            return { isValid: true, message: "Ayarlar geçerli." };
        });
    }
    dispose() {
        if (this.configChangeListener) {
            this.configChangeListener.dispose();
        }
    }
}
exports.SettingsManager = SettingsManager;
