const COMMENT_PREFIX = "#";

/**
 * Parses the stat configuration file into a map of defaults.
 * @param {string} raw
 * @returns {Record<string, number>}
 */
export function parseStatConfig(raw) {
	if (typeof raw !== "string") {
		throw new TypeError("Stat config parser expected a string payload.");
	}

	const lines = raw.split(/\r?\n/);
	const defaults = Object.create(null);

	for (let index = 0; index < lines.length; index += 1) {
		const rawLine = lines[index];
		if (typeof rawLine !== "string") {
			continue;
		}

		const commentIndex = rawLine.indexOf(COMMENT_PREFIX);
		const withoutComment = commentIndex === -1 ? rawLine : rawLine.slice(0, commentIndex);
		const trimmed = withoutComment.trim();
		if (!trimmed) {
			continue;
		}

		let namePart = "";
		let valuePart = "";

		const separatorMatch = trimmed.match(/^([^=:]+?)\s*[:=]\s*(.+)$/);
		if (separatorMatch) {
			namePart = separatorMatch[1].trim();
			valuePart = separatorMatch[2].trim();
		} else {
			const segments = trimmed.split(/\s+/);
			if (segments.length < 2) {
				throw new Error(`Invalid stat entry on line ${index + 1}. Expected "name = value".`);
			}
			[namePart] = segments;
			valuePart = segments.slice(1).join(" ").trim();
		}

		const normalizedName = namePart.toLowerCase();
		if (!normalizedName) {
			throw new Error(`Stat name missing on line ${index + 1}.`);
		}
		if (Object.prototype.hasOwnProperty.call(defaults, normalizedName)) {
			throw new Error(`Duplicate stat "${namePart}" on line ${index + 1}.`);
		}

		const value = Number(valuePart);
		if (!Number.isFinite(value)) {
			throw new Error(`Invalid default value "${valuePart}" for stat "${namePart}" on line ${index + 1}.`);
		}

		defaults[normalizedName] = value;
	}

	return defaults;
}

/**
 * Loads and parses a stat configuration file.
 * @param {string} url
 * @returns {Promise<Record<string, number>>}
 */
export async function loadStatConfig(url) {
	if (!url) {
		return {};
	}

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load stat config file (${response.status}).`);
	}

	const text = await response.text();
	return parseStatConfig(text);
}
