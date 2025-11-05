/**
 * Converts bracket-wrapped values into plain strings (e.g., "[north]" -> "north").
 * @param {string} raw
 * @returns {string}
 */
export function parseBracketValue(raw) {
	const trimmed = typeof raw === "string" ? raw.trim() : "";
	if (!trimmed) return "";
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}
