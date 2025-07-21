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
exports.activateEditMode = exports.editController = exports.EditController = void 0;
// editController.ts
const vscode = __importStar(require("vscode"));
class EditController {
    constructor() { }
    startEditMode() {
        return __awaiter(this, void 0, void 0, function* () {
            vscode.window.showInformationMessage("Edit mode - coming soon!");
        });
    }
    analyzeCurrentFile() {
        return __awaiter(this, void 0, void 0, function* () {
            vscode.window.showInformationMessage("Edit analyze mode - coming soon!");
        });
    }
    improveCurrentFile() {
        return __awaiter(this, void 0, void 0, function* () {
            vscode.window.showInformationMessage("Edit improve mode - coming soon!");
        });
    }
}
exports.EditController = EditController;
// Export function for extension.ts
function editController() {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = new EditController();
        yield controller.startEditMode();
    });
}
exports.editController = editController;
// Legacy function for backward compatibility
function activateEditMode(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = new EditController();
        yield controller.startEditMode();
    });
}
exports.activateEditMode = activateEditMode;
function showImprovementOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = [
            { label: "Form Erişilebilirliği", value: "form-accessibility" },
            { label: "ARIA Etiketleri", value: "aria-labels" },
            { label: "Klavye Navigasyonu", value: "keyboard-navigation" },
            { label: "Renk Kontrastı", value: "color-contrast" },
            { label: "Resim Alt Metinleri", value: "image-alt-text" },
            { label: "Tablo Erişilebilirliği", value: "table-accessibility" },
            { label: "Hata Mesajları", value: "error-messages" },
            { label: "Tüm İyileştirmeler", value: "all" }
        ];
        const selected = yield vscode.window.showQuickPick(options, {
            placeHolder: "Uygulamak istediğiniz iyileştirmeleri seçin",
            canPickMany: true
        });
        if (!selected)
            return [];
        // "Tüm İyileştirmeler" seçilirse tümünü döndür
        if (selected.some(item => item.value === "all")) {
            return options.filter(item => item.value !== "all").map(item => item.value);
        }
        return selected.map(item => item.value);
    });
}
function applyImprovedCode(improvedCode, editor, selection, document) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = ["Kodu Uygula", "Önizleme", "Kopyala", "İptal"];
        const action = yield vscode.window.showInformationMessage("WCAG 2.2 iyileştirmeleri tamamlandı!", ...options);
        switch (action) {
            case "Kodu Uygula":
                yield editor.edit(editBuilder => {
                    if (selection.isEmpty) {
                        // Tüm dosyayı değiştir
                        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
                        editBuilder.replace(fullRange, improvedCode);
                    }
                    else {
                        // Sadece seçili kısmı değiştir
                        editBuilder.replace(selection, improvedCode);
                    }
                });
                vscode.window.showInformationMessage("İyileştirmeler başarıyla uygulandı!");
                break;
            case "Önizleme":
                yield showPreview(improvedCode);
                break;
            case "Kopyala":
                yield vscode.env.clipboard.writeText(improvedCode);
                vscode.window.showInformationMessage("İyileştirilmiş kod panoya kopyalandı!");
                break;
            default:
                break;
        }
    });
}
function showPreview(code) {
    return __awaiter(this, void 0, void 0, function* () {
        const document = yield vscode.workspace.openTextDocument({
            content: code,
            language: "html"
        });
        const previewEditor = yield vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        // Preview'ı sadece okunabilir yap
        yield vscode.commands.executeCommand("workbench.action.files.setReadonlyInEditor");
    });
}
