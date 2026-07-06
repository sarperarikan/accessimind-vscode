export type AgentSkillId =
    | "fix-active-file"
    | "fix-selection"
    | "investigate-workspace"
    | "production-plan";

export interface AgentSkill {
    id: AgentSkillId;
    label: string;
    description: string;
}

export interface AgentContextSnapshot {
    instruction: string;
    fileName?: string;
    language?: string;
    activeCode?: string;
    selectedCode?: string;
    workspaceFiles: string[];
}

export interface AgentRunSummary {
    skill: AgentSkillId;
    provider: string;
    model?: string;
    applied: boolean;
    report: string;
}
