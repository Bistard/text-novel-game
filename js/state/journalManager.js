/**
 * Appends a journal entry, clamping to the maximum length.
 * @param {string[]} journal
 * @param {string} text
 * @param {number} maxEntries
 */
export function appendJournal(journal, text, maxEntries) {
	if (!Array.isArray(journal)) {
		return;
	}
	if (!text) return;

	journal.push(text);
	if (typeof maxEntries === "number" && maxEntries > 0 && journal.length > maxEntries) {
		journal.splice(0, journal.length - maxEntries);
	}
}

/**
 * Sanitises journal entries from a snapshot and clamps to the allowed length.
 * @param {unknown[]} entries
 * @param {number} maxEntries
 * @returns {string[]}
 */
export function normaliseJournal(entries, maxEntries) {
	const filtered = Array.isArray(entries)
		? entries
				.filter((entry) => typeof entry === "string" && entry.trim())
				.map((entry) => entry.trim())
		: [];

	if (typeof maxEntries === "number" && maxEntries > 0 && filtered.length > maxEntries) {
		return filtered.slice(filtered.length - maxEntries);
	}
	return filtered.slice();
}
