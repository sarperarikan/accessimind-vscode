import * as path from "path";
import * as vscode from "vscode";

import { AIProviderManager } from "../utils/aiProvider";
import { normalizeGeneratedCode } from "../utils/codeGenerationUtils";
import { LocalizationManager } from "../utils/localizationManager";
import { getRuntimeSettings, readCustomRules } from "../utils/runtimeSettings";
import { AGENT_SKILLS } from "./agentSkills";
import { AgentContextSnapshot, AgentRunSummary, AgentSkill, AgentSkillId } from "./agentTypes";

const LAST_AGENT_SUMMARY_KEY = "accessimind.lastAgentSummary";

export class AgentSessionManager {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly aiProviderManager: AIProviderManager,
        private readonly localization: LocalizationManager
    ) {}

    public async startSession(): Promise<void> {
        const skill = await this.pickSkill();
        if (!skill) {
            return;
        }

        const instruction = await vscode.window.showInputBox({
            title: this.t("AccessiMind Agent", "AccessiMind Agent"),
            prompt: this.t(
                "Describe the production outcome you want.",
                "Istediginiz uretim sonucunu tarif edin."
            ),
            placeHolder: this.t(
                "Example: fix keyboard and screen reader issues without changing visual design",
                "Ornek: gorsel tasarimi degistirmeden klavye ve ekran okuyucu sorunlarini duzelt"
            ),
            ignoreFocusOut: true,
        });

        if (!instruction) {
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: this.t("AccessiMind agent is working...", "AccessiMind agent calisiyor..."),
                cancellable: false,
            },
            async (progress) => {
                progress.report({ increment: 10, message: this.t("Collecting context", "Baglam toplanıyor") });
                const snapshot = await this.collectContext(skill.id, instruction);

                progress.report({ increment: 20, message: this.t("Planning with provider", "Provider ile planlaniyor") });
                const plan = await this.createPlan(skill, snapshot);
                await this.openMarkdownReport("AccessiMind Agent Plan", plan);

                if (skill.id === "investigate-workspace" || skill.id === "production-plan") {
                    await this.storeSummary(skill.id, false, plan);
                    return;
                }

                const editor = vscode.window.activeTextEditor;
                if (!editor || !snapshot.activeCode) {
                    vscode.window.showWarningMessage(this.t("No active editor is available for edits.", "Duzenleme icin aktif editor yok."));
                    await this.storeSummary(skill.id, false, plan);
                    return;
                }

                const proceed = await vscode.window.showWarningMessage(
                    this.t(
                        "Agent plan is ready. Generate an approved code change now?",
                        "Agent plani hazir. Simdi onayli kod degisikligi uretilsin mi?"
                    ),
                    { modal: true },
                    this.t("Generate Change", "Degisiklik Uret")
                );

                if (proceed !== this.t("Generate Change", "Degisiklik Uret")) {
                    await this.storeSummary(skill.id, false, plan);
                    return;
                }

                progress.report({ increment: 45, message: this.t("Generating code", "Kod uretiliyor") });
                const result = await this.generateCode(skill.id, snapshot);
                if (!result) {
                    await this.storeSummary(skill.id, false, plan);
                    return;
                }

                progress.report({ increment: 80, message: this.t("Opening review diff", "Inceleme farki aciliyor") });
                await this.reviewAndMaybeApply(editor, skill.id, snapshot, result);
                await this.storeSummary(skill.id, true, plan);
            }
        );
    }

    public getLastSummary(): AgentRunSummary | undefined {
        return this.context.workspaceState.get<AgentRunSummary>(LAST_AGENT_SUMMARY_KEY);
    }

    private async pickSkill(): Promise<AgentSkill | undefined> {
        const picked = await vscode.window.showQuickPick(
            AGENT_SKILLS.map((skill) => ({
                label: skill.label,
                description: skill.id,
                detail: skill.description,
                skill,
            })),
            {
                title: "AccessiMind Agent",
                placeHolder: this.t("Choose an agent workflow", "Bir agent akisi secin"),
                matchOnDescription: true,
                matchOnDetail: true,
            }
        );

        return picked?.skill;
    }

    private async collectContext(skill: AgentSkillId, instruction: string): Promise<AgentContextSnapshot> {
        const editor = vscode.window.activeTextEditor;
        const workspaceFiles = await this.listWorkspaceFiles();

        if (!editor) {
            return { instruction, workspaceFiles };
        }

        const document = editor.document;
        const selection = editor.selection;
        const selectedCode = !selection.isEmpty ? document.getText(selection) : undefined;

        return {
            instruction,
            fileName: document.fileName,
            language: document.languageId,
            activeCode: skill === "investigate-workspace" ? undefined : document.getText(),
            selectedCode,
            workspaceFiles,
        };
    }

    private async listWorkspaceFiles(): Promise<string[]> {
        const files = await vscode.workspace.findFiles(
            "**/*.{html,htm,css,scss,js,jsx,ts,tsx,vue,svelte,json,md}",
            "**/{node_modules,out,dist,.git}/**",
            80
        );
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return files.map((file) => root ? path.relative(root, file.fsPath) : file.fsPath).sort();
    }

    private async createPlan(skill: AgentSkill, snapshot: AgentContextSnapshot): Promise<string> {
        const provider = await this.aiProviderManager.getCurrentProviderInstance();
        const customRules = await readCustomRules();
        const prompt = [
            "You are AccessiMind Agent, a production-focused WCAG 2.2 engineering agent.",
            "Work as an implementation planner before editing.",
            "Return concise Markdown with: findings, exact edit plan, risk controls, test plan, and rollback notes.",
            "Do not invent files that are not in the workspace map.",
            `Workflow: ${skill.id} - ${skill.description}`,
            `User instruction: ${snapshot.instruction}`,
            `Active file: ${snapshot.fileName || "none"}`,
            `Language: ${snapshot.language || "unknown"}`,
            customRules ? `Custom rules:\n${customRules}` : "",
            snapshot.workspaceFiles.length ? `Workspace map:\n${snapshot.workspaceFiles.map((file) => `- ${file}`).join("\n")}` : "",
            snapshot.selectedCode ? `Selected code:\n\`\`\`${snapshot.language || ""}\n${snapshot.selectedCode.slice(0, 12000)}\n\`\`\`` : "",
            snapshot.activeCode ? `Active code excerpt:\n\`\`\`${snapshot.language || ""}\n${snapshot.activeCode.slice(0, 18000)}\n\`\`\`` : "",
        ].filter(Boolean).join("\n\n");

        const response = await provider.chat(prompt).catch(async () => provider.improveCode({
            code: prompt,
            fileType: "md",
            language: "markdown",
            mode: "agent",
            includeComments: false,
            responseLanguage: this.localization.getCurrentLanguage() as "en" | "tr",
        }));

        if (!response.success || !response.content) {
            return `# AccessiMind Agent Plan\n\nProvider could not create a plan.\n\nError: ${response.error || "Unknown error"}`;
        }

        return response.content;
    }

    private async generateCode(skill: AgentSkillId, snapshot: AgentContextSnapshot): Promise<string | undefined> {
        if (!snapshot.activeCode || !snapshot.language || !snapshot.fileName) {
            return undefined;
        }

        const provider = await this.aiProviderManager.getCurrentProviderInstance();
        const runtimeSettings = getRuntimeSettings();
        const customRules = await readCustomRules();
        const targetCode = skill === "fix-selection" && snapshot.selectedCode ? snapshot.selectedCode : snapshot.activeCode;
        const prompt = [
            `AGENT_PRODUCTION_INSTRUCTION: ${snapshot.instruction}`,
            "Preserve product behavior and visual design unless the instruction explicitly asks otherwise.",
            "Make the smallest production-ready accessibility change that satisfies the plan.",
            "Return only code. No markdown explanation.",
            runtimeSettings.strictMode ? "STRICT_MODE: true" : "",
            runtimeSettings.contextAwareAnalysis ? "CONTEXT_AWARE_ANALYSIS: enabled" : "CONTEXT_AWARE_ANALYSIS: disabled",
            customRules ? `CUSTOM_RULES:\n${customRules}` : "",
            snapshot.activeCode,
        ].filter(Boolean).join("\n\n");

        const result = await provider.improveCode({
            code: prompt,
            fileType: path.extname(snapshot.fileName).replace(".", "") || "unknown",
            language: snapshot.language,
            selectedText: skill === "fix-selection" ? snapshot.selectedCode : undefined,
            wcagLevel: "AA",
            includeComments: vscode.workspace.getConfiguration("wcagEnhancer").get("includeComments") !== false,
            responseLanguage: this.localization.getCurrentLanguage() as "en" | "tr",
            mode: "agent",
        });

        if (!result.success || !result.content) {
            vscode.window.showErrorMessage(`AccessiMind agent failed: ${result.error || "Unknown error"}`);
            return undefined;
        }

        const normalized = normalizeGeneratedCode({
            originalCode: targetCode,
            generatedContent: result.content,
            language: snapshot.language,
            mode: skill === "fix-selection" ? "selection" : "file",
        });

        if (normalized.warnings.length > 0) {
            void vscode.window.showWarningMessage(normalized.warnings.join(" "));
        }

        return normalized.code;
    }

    private async reviewAndMaybeApply(
        editor: vscode.TextEditor,
        skill: AgentSkillId,
        snapshot: AgentContextSnapshot,
        generatedCode: string
    ): Promise<void> {
        const originalCode = skill === "fix-selection" && snapshot.selectedCode ? snapshot.selectedCode : snapshot.activeCode || "";
        const suffix = skill === "fix-selection" ? "selection" : "file";
        const originalUri = vscode.Uri.parse(`untitled:accessimind-agent-original-${suffix}.${snapshot.language || "txt"}`);
        const generatedUri = vscode.Uri.parse(`untitled:accessimind-agent-generated-${suffix}.${snapshot.language || "txt"}`);
        const edit = new vscode.WorkspaceEdit();
        edit.insert(originalUri, new vscode.Position(0, 0), originalCode);
        edit.insert(generatedUri, new vscode.Position(0, 0), generatedCode);
        await vscode.workspace.applyEdit(edit);
        await vscode.commands.executeCommand("vscode.diff", originalUri, generatedUri, "AccessiMind Agent Review");

        const apply = await vscode.window.showWarningMessage(
            this.t("Apply the agent-generated change?", "Agent tarafindan uretilen degisiklik uygulansin mi?"),
            { modal: true },
            this.t("Apply", "Uygula")
        );
        if (apply !== this.t("Apply", "Uygula")) {
            return;
        }

        await editor.edit((builder) => {
            if (skill === "fix-selection" && !editor.selection.isEmpty) {
                builder.replace(editor.selection, generatedCode);
                return;
            }

            const document = editor.document;
            builder.replace(new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), generatedCode);
        });
    }

    private async openMarkdownReport(title: string, content: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({ language: "markdown", content });
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    private async storeSummary(skill: AgentSkillId, applied: boolean, report: string): Promise<void> {
        const summary: AgentRunSummary = {
            skill,
            provider: this.aiProviderManager.getCurrentProviderName(),
            model: this.aiProviderManager.getCurrentModelName(),
            applied,
            report,
        };
        await this.context.workspaceState.update(LAST_AGENT_SUMMARY_KEY, summary);
    }

    private t(en: string, tr: string): string {
        return this.localization.getCurrentLanguage() === "tr" ? tr : en;
    }
}
