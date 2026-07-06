import { AgentSkill } from "./agentTypes";

export const AGENT_SKILLS: AgentSkill[] = [
    {
        id: "fix-active-file",
        label: "Fix active file",
        description: "Inspect the current file, plan WCAG-safe changes, and offer an approved replacement.",
    },
    {
        id: "fix-selection",
        label: "Fix selection",
        description: "Rewrite only the selected code with accessibility and production-readiness constraints.",
    },
    {
        id: "investigate-workspace",
        label: "Investigate workspace",
        description: "Read a small workspace map and produce an accessibility implementation plan.",
    },
    {
        id: "production-plan",
        label: "Production plan",
        description: "Create a practical implementation plan with risks, tests, and rollout notes.",
    },
];
