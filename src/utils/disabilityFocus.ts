export type DisabilityFocusGroup =
	| "screenReader"
	| "lowVision"
	| "hearing"
	| "motor"
	| "cognitive";

export interface DisabilityFocusOption {
	id: DisabilityFocusGroup;
	label: string;
	description: string;
}

export const DISABILITY_FOCUS_OPTIONS: DisabilityFocusOption[] = [
	{
		id: "screenReader",
		label: "Screen reader and blind users",
		description: "Names, roles, landmarks, live regions, semantic structure",
	},
	{
		id: "lowVision",
		label: "Low vision users",
		description: "Contrast, zoom, scalable text, visible focus, spacing",
	},
	{
		id: "hearing",
		label: "Deaf and hard of hearing users",
		description: "Captions, transcripts, visual alternatives for audio cues",
	},
	{
		id: "motor",
		label: "Motor and keyboard users",
		description: "Keyboard access, target size, focus order, reduced precision needs",
	},
	{
		id: "cognitive",
		label: "Cognitive and neurodivergent users",
		description: "Clear labels, predictable flow, error prevention, simpler interactions",
	},
];

const VALID_GROUPS = new Set<DisabilityFocusGroup>(
	DISABILITY_FOCUS_OPTIONS.map((option) => option.id)
);

export function normalizeDisabilityFocusGroups(value: unknown): DisabilityFocusGroup[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is DisabilityFocusGroup =>
		typeof item === "string" && VALID_GROUPS.has(item as DisabilityFocusGroup)
	);
}

export function getDisabilityFocusSummary(
	groups: DisabilityFocusGroup[],
	language: "en" | "tr"
): string {
	if (groups.length === 0) {
		return language === "tr" ? "Tum engel gruplari" : "All disability groups";
	}

	if (groups.length === 1) {
		const match = DISABILITY_FOCUS_OPTIONS.find((option) => option.id === groups[0]);
		return match?.label || groups[0];
	}

	return language === "tr"
		? `${groups.length} engel grubu secili`
		: `${groups.length} disability groups selected`;
}

export function getDisabilityFocusInstruction(
	groups: DisabilityFocusGroup[],
	language: "en" | "tr"
): string {
	if (groups.length === 0) {
		return language === "tr"
			? "DISABILITY_FOCUS: Tum engel gruplarina dengeli bicimde hitap eden iyilestirmeler yap."
			: "DISABILITY_FOCUS: Apply balanced improvements that support all disability groups.";
	}

	const selected = groups
		.map((group) => DISABILITY_FOCUS_OPTIONS.find((option) => option.id === group)?.label || group)
		.join(", ");

	return language === "tr"
		? `DISABILITY_FOCUS: Su gruplara oncelik ver: ${selected}. Temel WCAG gereksinimlerini koru, ancak iyilestirme onceligini bu kullanici gruplarinin ihtiyaclarina gore belirle.`
		: `DISABILITY_FOCUS: Prioritize these user groups: ${selected}. Keep baseline WCAG coverage, but bias the improvements toward the needs of these groups.`;
}
