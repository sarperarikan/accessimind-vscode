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
exports.SettingAction = exports.SettingCategory = exports.SettingItem = exports.SettingsViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const settingsManager_1 = require("../utils/settingsManager");
const aiTestUtils_1 = require("../utils/aiTestUtils");
const aiProvider_1 = require("../utils/aiProvider");
const logger_1 = require("../utils/logger");
class SettingsViewProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.settings = [];
        this.settingsManager = settingsManager_1.SettingsManager.getInstance();
        this.aiTestUtils = aiTestUtils_1.AITestUtils.getInstance();
        this.aiProviderManager = aiProvider_1.AIProviderManager.getInstance();
        this.refresh();
        // Configuration değişikliklerini dinle
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("wcagEnhancer")) {
                this.refresh();
            }
        });
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.settings);
        }
        if (element.children) {
            return Promise.resolve(element.children);
        }
        return Promise.resolve([]);
    }
    async refresh() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        const aiModelConfig = config.get("aiModels") || {};
        const currentProvider = aiConfig.provider || "gemini";
        const currentModel = aiModelConfig.selectedModel || "gemini-2.5-flash";
        const wcagLevel = config.get("wcagLevel") || "AA";
        const language = config.get("language") || "auto";
        const autoApply = config.get("autoApply") || false;
        const includeComments = config.get("includeComments") !== false;
        const enableStatistics = config.get("enableStatistics") !== false;
        // Available models for current provider
        let availableModels = [];
        try {
            if (currentProvider === "gemini") {
                availableModels = [
                    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "En hızlı model" },
                    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "En kaliteli model" }
                ];
            }
            else if (currentProvider === "vscode-copilot") {
                availableModels = await this.aiProviderManager.getAvailableCopilotModels();
            }
        }
        catch (error) {
            logger_1.logger.error("Model listesi alınamadı:", error);
        }
        this.settings = [
            new SettingCategory("🤖 AI Provider Configuration", "ai-provider-config", [
                new SettingItem("AI Provider", currentProvider === "gemini" ? "🚀 Google Gemini" : "🤖 GitHub Copilot", "Select AI provider for WCAG improvements", "aiProvider", "gear", [
                    new SettingAction("🚀 Select Gemini", "selectProvider", { provider: "gemini" }),
                    new SettingAction("🤖 Select Copilot", "selectProvider", { provider: "vscode-copilot" })
                ]),
                ...(currentProvider === "gemini" ? [
                    new SettingItem("Gemini API Key", aiConfig.apiKey ? "✅ Configured" : "❌ Not Configured", "Get API key from Google AI Studio", "apiKey", "key", [
                        new SettingAction("🔑 Set API Key", "setApiKey"),
                        new SettingAction("📋 Open API Studio", "openExternal", { url: "https://makersuite.google.com/" })
                    ])
                ] : []),
                new SettingItem("Connection Test", "Test current AI provider", "Check if AI connection is working", "testConnection", "play", [
                    new SettingAction("🧪 Test Connection", "testConnection")
                ])
            ]),
            new SettingCategory("🧠 AI Model Settings", "ai-model-settings", [
                new SettingItem("Selected Model", this.getModelDisplayName(currentModel, availableModels), `Current ${currentProvider === "gemini" ? "Gemini" : "Copilot"} model`, "selectedModel", "circuit-board", availableModels.map(model => new SettingAction(`${model.name}${model.id === currentModel ? " ✅" : ""}`, "selectModel", { modelId: model.id, provider: currentProvider }))),
                new SettingItem("Model Preferences", "Model preferences for different use cases", "Preferred models for different scenarios", "modelPreferences", "settings", [
                    new SettingAction("⚡ For Quick Improvements", "showModelPreferences", { type: "quick" }),
                    new SettingAction("🔍 For Complex Analysis", "showModelPreferences", { type: "complex" })
                ])
            ]),
            new SettingCategory("♿ WCAG Configuration", "wcag-config", [
                new SettingItem("WCAG Level", `Level ${wcagLevel}`, "Target WCAG compliance level", "wcagLevel", "shield", [
                    new SettingAction(`Level A${wcagLevel === "A" ? " ✅" : ""}`, "setWcagLevel", { level: "A" }),
                    new SettingAction(`Level AA${wcagLevel === "AA" ? " ✅" : ""}`, "setWcagLevel", { level: "AA" }),
                    new SettingAction(`Level AAA${wcagLevel === "AAA" ? " ✅" : ""}`, "setWcagLevel", { level: "AAA" })
                ]),
                new SettingItem("Auto Apply", autoApply ? "✅ Enabled" : "❌ Disabled", "Apply improvements automatically without confirmation", "autoApply", autoApply ? "check" : "x", [
                    new SettingAction(autoApply ? "❌ Disable" : "✅ Enable", "toggleAutoApply")
                ]),
                new SettingItem("Include Comments", includeComments ? "✅ Include" : "❌ Exclude", "Add explanatory comments about WCAG improvements", "includeComments", includeComments ? "comment" : "comment-discussion", [
                    new SettingAction(includeComments ? "❌ Exclude" : "✅ Include", "toggleIncludeComments")
                ])
            ]),
            new SettingCategory("🌍 Language & Localization", "language-settings", [
                new SettingItem("Interface Language", this.getLanguageDisplayName(language), "AI responses and interface language", "language", "globe", [
                    new SettingAction(`Auto${language === "auto" ? " ✅" : ""}`, "setLanguage", { language: "auto" }),
                    new SettingAction(`English${language === "en" ? " ✅" : ""}`, "setLanguage", { language: "en" }),
                    new SettingAction(`Türkçe${language === "tr" ? " ✅" : ""}`, "setLanguage", { language: "tr" })
                ])
            ]),
            new SettingCategory("📊 Statistics & Analytics", "statistics-settings", [
                new SettingItem("Statistics Tracking", enableStatistics ? "✅ Enabled" : "❌ Disabled", "Track usage statistics and metrics", "enableStatistics", enableStatistics ? "graph" : "graph-left", [
                    new SettingAction(enableStatistics ? "❌ Disable" : "✅ Enable", "toggleStatistics"),
                    new SettingAction("📊 View Statistics", "showStatistics"),
                    new SettingAction("📤 Export Statistics", "exportStatistics"),
                    new SettingAction("🗑️ Reset Statistics", "resetStatistics")
                ])
            ]),
            new SettingCategory("⌨️ Keyboard Shortcuts", "keyboard-shortcuts", [
                new SettingItem("Shortcut Configuration", "Customize keyboard shortcuts", "Manage keyboard shortcuts for all commands", "shortcuts", "symbol-key", [
                    new SettingAction("⌨️ Customize Shortcuts", "openKeybindings"),
                    new SettingAction("🔄 Reset to Defaults", "resetKeybindings")
                ])
            ]),
            new SettingCategory("📊 Statistics & Analytics", "statistics-analytics", [
                new SettingItem("View Statistics", "Display detailed WCAG enhancement statistics", "Show comprehensive usage and performance statistics", "showStatistics", "graph", [
                    new SettingAction("📊 Show Statistics", "showStatistics"),
                    new SettingAction("📤 Export Statistics", "exportStatistics"),
                    new SettingAction("🗑️ Reset Statistics", "resetStatistics")
                ]),
                new SettingItem("Open Dynamic Panel", "Open real-time statistics panel", "View live statistics and manage data", "openDynamicPanel", "dashboard", [])
            ]),
            new SettingCategory("🔗 Help & Resources", "help-resources", [
                new SettingItem("Documentation & Guides", "Access to help resources", "WCAG guides and extension documentation", "help", "book", [
                    new SettingAction("📖 WCAG 2.2 Guide", "openExternal", { url: "https://www.w3.org/WAI/WCAG22/quickref/" }),
                    new SettingAction("🎯 Accessibility Testing", "openExternal", { url: "https://wave.webaim.org/" }),
                    new SettingAction("🚀 Show Setup Wizard Again", "showWizard"),
                    new SettingAction("💬 GitHub Discussions", "openExternal", { url: "https://github.com/your-repo/wcag-enhancer/discussions" }),
                    new SettingAction("🐛 Report Bug", "openExternal", { url: "https://github.com/your-repo/wcag-enhancer/issues" })
                ])
            ])
        ];
        this._onDidChangeTreeData.fire();
    }
    getModelDisplayName(modelId, availableModels) {
        const model = availableModels.find(m => m.id === modelId);
        return model ? `${model.name} ✅` : modelId;
    }
    getLanguageDisplayName(language) {
        const languageMap = {
            "auto": "Auto",
            "en": "English",
            "tr": "Türkçe"
        };
        return languageMap[language] || language;
    }
    async handleSettingClick(item) {
        if (!item.actions || item.actions.length === 0)
            return;
        // Tek action varsa direkt çalıştır
        if (item.actions.length === 1) {
            await this.executeAction(item.actions[0]);
            return;
        }
        // Birden fazla action varsa quickpick göster
        const quickPickItems = item.actions.map(action => ({
            label: action.label,
            action: action
        }));
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            title: item.label,
            placeHolder: item.description
        });
        if (selected) {
            await this.executeAction(selected.action);
        }
    }
    async executeAction(action) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        try {
            switch (action.actionType) {
                case "selectProvider":
                    await this.selectProvider(action.data?.provider);
                    break;
                case "setApiKey":
                    await this.setApiKey();
                    break;
                case "selectModel":
                    await this.selectModel(action.data?.modelId, action.data?.provider);
                    break;
                case "setWcagLevel":
                    await config.update("wcagLevel", action.data?.level, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`✅ WCAG seviyesi ${action.data?.level} olarak ayarlandı`);
                    break;
                case "setLanguage":
                    await config.update("language", action.data?.language, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage("✅ Dil ayarı güncellendi");
                    break;
                case "toggleAutoApply":
                    const currentAutoApply = config.get("autoApply") || false;
                    await config.update("autoApply", !currentAutoApply, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`✅ Otomatik uygulama ${!currentAutoApply ? "etkinleştirildi" : "devre dışı bırakıldı"}`);
                    break;
                case "toggleIncludeComments":
                    const currentIncludeComments = config.get("includeComments") !== false;
                    await config.update("includeComments", !currentIncludeComments, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`✅ Açıklayıcı yorumlar ${!currentIncludeComments ? "dahil edilecek" : "dahil edilmeyecek"}`);
                    break;
                case "toggleStatistics":
                    const currentStats = config.get("enableStatistics") !== false;
                    await config.update("enableStatistics", !currentStats, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`✅ İstatistik takibi ${!currentStats ? "etkinleştirildi" : "devre dışı bırakıldı"}`);
                    break;
                case "testConnection":
                    await this.testConnection();
                    break;
                case "showStatistics":
                    await vscode.commands.executeCommand("wcagEnhancer.showDetailedStatistics");
                    break;
                case "exportStatistics":
                    await vscode.commands.executeCommand("wcagEnhancer.exportStatistics");
                    break;
                case "resetStatistics":
                    await vscode.commands.executeCommand("wcagEnhancer.resetStatistics");
                    break;
                case "showWizard":
                    await vscode.commands.executeCommand("wcagEnhancer.showWelcome");
                    break;
                case "openKeybindings":
                    await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", "@ext:wcagEnhancer");
                    break;
                case "resetKeybindings":
                    await this.resetKeybindings();
                    break;
                case "openExternal":
                    if (action.data?.url) {
                        await vscode.env.openExternal(vscode.Uri.parse(action.data.url));
                    }
                    break;
                case "showModelPreferences":
                    await this.showModelPreferences(action.data?.type);
                    break;
                case "runCommand":
                    if (action.data?.command) {
                        await vscode.commands.executeCommand(action.data.command);
                    }
                    break;
                default:
                    logger_1.logger.warn("Unknown action type:", action.actionType);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Ayar güncellenirken hata oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
            logger_1.logger.error("Ayar güncelleme hatası:", error);
        }
    }
    async selectProvider(provider) {
        if (!provider)
            return;
        try {
            const success = await this.aiProviderManager.setProvider(provider);
            if (success) {
                vscode.window.showInformationMessage(`✅ AI sağlayıcı ${provider === "gemini" ? "Gemini" : "Copilot"} olarak ayarlandı`);
            }
            else {
                vscode.window.showErrorMessage(`❌ ${provider === "gemini" ? "Gemini" : "Copilot"} sağlayıcısı kullanılamıyor`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Sağlayıcı ayarlanamadı: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
        }
    }
    async setApiKey() {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const aiConfig = config.get("ai") || {};
        const currentKey = aiConfig.apiKey || "";
        const apiKey = await vscode.window.showInputBox({
            title: "🔑 Gemini API Anahtarı",
            prompt: "Google AI Studio'dan API anahtarınızı girin",
            placeHolder: "AIzaSy... (API anahtarınız)",
            password: true,
            value: currentKey,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return "❌ API anahtarı boş olamaz";
                }
                if (value.length < 20) {
                    return "⚠️ API anahtarı çok kısa (minimum 20 karakter)";
                }
                if (!value.startsWith("AIza")) {
                    return "⚠️ Gemini API anahtarları genellikle \"AIza\" ile başlar";
                }
                return null;
            }
        });
        if (apiKey !== undefined) {
            aiConfig.apiKey = apiKey;
            await config.update("ai", aiConfig, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage("✅ Gemini API anahtarı güncellendi!", "🧪 Bağlantıyı Test Et").then(action => {
                if (action === "🧪 Bağlantıyı Test Et") {
                    this.testConnection();
                }
            });
        }
    }
    async selectModel(modelId, provider) {
        if (!modelId || !provider)
            return;
        try {
            const success = await this.aiProviderManager.setModel(modelId);
            if (success) {
                vscode.window.showInformationMessage(`✅ AI modeli ${modelId} olarak ayarlandı`);
            }
            else {
                vscode.window.showErrorMessage(`❌ Model ayarlanamadı: ${modelId}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Model ayarlanamadı: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
        }
    }
    async testConnection() {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🧪 AI bağlantısı test ediliyor...",
                cancellable: false
            }, async () => {
                const result = await this.aiTestUtils.testAIProvider();
                await this.aiTestUtils.showTestResult(result);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Bağlantı testi başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
        }
    }
    async resetKeybindings() {
        const confirm = await vscode.window.showWarningMessage("⚠️ Tüm AccessiMind klavye kısayolları varsayılan değerlerine sıfırlanacak. Devam etmek istiyor musunuz?", { modal: true }, "Sıfırla");
        if (confirm === "Sıfırla") {
            const config = vscode.workspace.getConfiguration("wcagEnhancer");
            await config.update("shortcuts", undefined, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage("✅ Klavye kısayolları varsayılan değerlerine sıfırlandı!");
        }
    }
    async showModelPreferences(type) {
        const config = vscode.workspace.getConfiguration("wcagEnhancer");
        const modelConfig = config.get("aiModels") || {};
        const preferences = modelConfig.modelPreferences || {};
        const title = type === "quick" ? "Hızlı İyileştirmeler İçin Model" : "Karmaşık Analiz İçin Model";
        const currentModel = type === "quick" ? preferences.forQuickImprovements : preferences.forComplexAnalysis;
        const availableModels = type === "quick"
            ? [
                { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
                { id: "gpt-4o-mini", name: "GPT-4o Mini" },
                { id: "claude-3-haiku", name: "Claude 3 Haiku" }
            ]
            : [
                { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
                { id: "gpt-4o", name: "GPT-4o" },
                { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet" }
            ];
        const options = availableModels.map(model => ({
            label: `${model.name}${model.id === currentModel ? " ✅" : ""}`,
            value: model.id
        }));
        const selected = await vscode.window.showQuickPick(options, {
            title: title,
            placeHolder: `Mevcut: ${currentModel || "Varsayılan"}`
        });
        if (selected) {
            const key = type === "quick" ? "forQuickImprovements" : "forComplexAnalysis";
            preferences[key] = selected.value;
            modelConfig.modelPreferences = preferences;
            await config.update("aiModels", modelConfig, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`✅ ${title} tercihi güncellendi`);
        }
    }
}
exports.SettingsViewProvider = SettingsViewProvider;
SettingsViewProvider.viewType = "wcagEnhancer.settingsView";
class SettingItem extends vscode.TreeItem {
    constructor(label, value, description, settingKey, iconName, actions, children) {
        super(label, children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.value = value;
        this.description = description;
        this.settingKey = settingKey;
        this.iconName = iconName;
        this.actions = actions;
        this.children = children;
        this.tooltip = `${label}: ${description}`;
        this.description = value;
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.contextValue = settingKey;
        if (actions && actions.length > 0) {
            this.command = {
                command: "wcagEnhancer.settings.itemClicked",
                title: "Ayarı Değiştir",
                arguments: [this]
            };
        }
    }
}
exports.SettingItem = SettingItem;
class SettingCategory extends SettingItem {
    constructor(label, categoryKey, children) {
        super(label, "", "", categoryKey, "folder", undefined, children);
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        this.contextValue = "category";
    }
}
exports.SettingCategory = SettingCategory;
class SettingAction {
    constructor(label, actionType, data) {
        this.label = label;
        this.actionType = actionType;
        this.data = data;
    }
}
exports.SettingAction = SettingAction;
//# sourceMappingURL=settingsViewProvider.js.map