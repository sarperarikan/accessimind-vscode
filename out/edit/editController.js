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
exports.EditController = void 0;
exports.editController = editController;
exports.activateEditMode = activateEditMode;
// editController.ts
const vscode = __importStar(require("vscode"));
class EditController {
    constructor() { }
    async startEditMode() {
        vscode.window.showInformationMessage("Edit mode - coming soon!");
    }
    async analyzeCurrentFile() {
        vscode.window.showInformationMessage("Edit analyze mode - coming soon!");
    }
    async improveCurrentFile() {
        vscode.window.showInformationMessage("Edit improve mode - coming soon!");
    }
}
exports.EditController = EditController;
// Export function for extension.ts
async function editController() {
    const controller = new EditController();
    await controller.startEditMode();
}
// Legacy function for backward compatibility
async function activateEditMode(context) {
    const controller = new EditController();
    await controller.startEditMode();
}
async function showImprovementOptions() {
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
    const selected = await vscode.window.showQuickPick(options, {
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
}
async function applyImprovedCode(improvedCode, editor, selection, document) {
    const options = ["Kodu Uygula", "Önizleme", "Kopyala", "İptal"];
    const action = await vscode.window.showInformationMessage("WCAG 2.2 iyileştirmeleri tamamlandı!", ...options);
    switch (action) {
        case "Kodu Uygula":
            await editor.edit(editBuilder => {
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
            await showPreview(improvedCode);
            break;
        case "Kopyala":
            await vscode.env.clipboard.writeText(improvedCode);
            vscode.window.showInformationMessage("İyileştirilmiş kod panoya kopyalandı!");
            break;
        default:
            break;
    }
}
async function showPreview(code) {
    const document = await vscode.workspace.openTextDocument({
        content: code,
        language: "html"
    });
    const previewEditor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
    // Preview'ı sadece okunabilir yap
    await vscode.commands.executeCommand("workbench.action.files.setReadonlyInEditor");
}
//# sourceMappingURL=editController.js.map