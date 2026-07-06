export interface FixConfidenceResult {
	score: number;
	rationale: string[];
	pattern?: LastFixPattern;
}

export interface LastFixPattern {
	tag: string;
	attribute: string;
	value: string;
}

const ACCESSIBILITY_ATTRIBUTES = ["aria-label", "aria-labelledby", "role", "tabindex", "alt", "title", "aria-describedby"];

function countAttribute(code: string, attribute: string): number {
	const pattern = new RegExp(`\\b${attribute}\\s*=`, "gi");
	return (code.match(pattern) || []).length;
}

function detectInsertedPattern(improvedCode: string, attribute: string): LastFixPattern | undefined {
	const pattern = new RegExp(`<([a-zA-Z][\\w:-]*)[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["'][^>]*>`, "i");
	const match = improvedCode.match(pattern);
	if (!match) {
		return undefined;
	}

	return {
		tag: match[1].toLowerCase(),
		attribute,
		value: match[2],
	};
}

export function evaluateFixConfidence(originalCode: string, improvedCode: string): FixConfidenceResult {
	if (!improvedCode.trim()) {
		return { score: 0, rationale: ["No output returned from model."] };
	}

	const rationale: string[] = [];
	let score = 35;

	const originalLength = Math.max(1, originalCode.length);
	const improvedLength = improvedCode.length;
	const deltaRatio = Math.abs(improvedLength - originalLength) / originalLength;
	if (deltaRatio < 0.6) {
		score += 15;
		rationale.push("Change size is proportional to source.");
	} else {
		score -= 10;
		rationale.push("Change size is unusually large.");
	}

	const suspicious = /(hello world|lorem ipsum|placeholder)/i.test(improvedCode);
	if (!suspicious) {
		score += 10;
	} else {
		score -= 15;
		rationale.push("Contains placeholder-like output.");
	}

	let detectedPattern: LastFixPattern | undefined;
	const addedA11yAttrs: string[] = [];
	for (const attribute of ACCESSIBILITY_ATTRIBUTES) {
		const before = countAttribute(originalCode, attribute);
		const after = countAttribute(improvedCode, attribute);
		if (after > before) {
			addedA11yAttrs.push(attribute);
			if (!detectedPattern) {
				detectedPattern = detectInsertedPattern(improvedCode, attribute);
			}
		}
	}

	if (addedA11yAttrs.length > 0) {
		score += 25;
		rationale.push(`Added accessibility attributes: ${addedA11yAttrs.join(", ")}.`);
	} else {
		score -= 5;
		rationale.push("No clear accessibility attribute additions detected.");
	}

	if (/<(html|body|main|form|button|input|img|nav)\b/i.test(improvedCode)) {
		score += 8;
	}

	if ((improvedCode.match(/[\{\}\(\)]/g) || []).length > (originalCode.match(/[\{\}\(\)]/g) || []).length * 2.2) {
		score -= 8;
		rationale.push("Structure may be over-expanded.");
	}

	score = Math.max(0, Math.min(100, score));

	return {
		score,
		rationale,
		pattern: detectedPattern,
	};
}
