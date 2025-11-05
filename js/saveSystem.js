const SAVE_FILE_TYPES = [
	{
		description: "Narrative Save Files",
		accept: {
			"application/json": [".save"],
			"text/plain": [".save"],
		},
	},
];

/**
 * Generates a filename like "single-narrative-game-20251104-153045.save".
 * @param {Date} [date]
 */
export function getSuggestedSaveFilename(date = new Date()) {
	const pad = (value) => String(value).padStart(2, "0");
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());
	return `single-narrative-game-${year}${month}${day}-${hours}${minutes}${seconds}.save`;
}

/**
 * Writes the provided save payload to disk, prompting the user for a destination.
 * @param {SerializedSaveData} payload
 * @returns {Promise<SaveOperationResult>}
 */
export async function saveGameToFile(payload) {
	const filename = getSuggestedSaveFilename();
	const serialized = JSON.stringify(payload, null, 2);

	if (typeof window.showSaveFilePicker === "function") {
		try {
			const fileHandle = await window.showSaveFilePicker({
				suggestedName: filename,
				types: SAVE_FILE_TYPES,
			});
			const writable = await fileHandle.createWritable();
			await writable.write(serialized);
			await writable.close();
			return { status: "saved", fileName: fileHandle.name || filename };
		} catch (error) {
			if (isAbortError(error)) {
				return { status: "cancelled" };
			}
			return { status: "error", error };
		}
	}

	downloadViaAnchor(serialized, filename);
	return { status: "downloaded", fileName: filename };
}

/**
 * Prompts the user to select a save file and returns its parsed content.
 * @returns {Promise<LoadOperationResult>}
 */
export async function loadGameFromFile() {
	if (typeof window.showOpenFilePicker === "function") {
		try {
			const handles = await window.showOpenFilePicker({
				multiple: false,
				types: SAVE_FILE_TYPES,
			});
			if (!handles || !handles.length) {
				return { status: "cancelled" };
			}
			const file = await handles[0].getFile();
			const text = await file.text();
			return parseSaveFile(text, file.name);
		} catch (error) {
			if (isAbortError(error)) {
				return { status: "cancelled" };
			}
			return { status: "error", error };
		}
	}

	return loadViaFileInput();
}

function downloadViaAnchor(text, filename) {
	const blob = new Blob([text], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.style.display = "none";
	document.body.appendChild(anchor);
	anchor.click();
	window.setTimeout(() => {
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}, 0);
}

function loadViaFileInput() {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".save,application/json";
		input.style.display = "none";

		const cleanup = () => {
			if (input.parentNode) {
				input.parentNode.removeChild(input);
			}
		};

		const handleSelection = async () => {
			try {
				if (!input.files || !input.files.length) {
					cleanup();
					resolve({ status: "cancelled" });
					return;
				}
				const file = input.files[0];
				const text = await file.text();
				resolve(parseSaveFile(text, file.name));
			} catch (error) {
				resolve({ status: "error", error });
			} finally {
				cleanup();
			}
		};

		input.addEventListener("change", handleSelection, { once: true });
		// Some browsers support a cancel event on file inputs.
		input.addEventListener(
			"cancel",
			() => {
				cleanup();
				resolve({ status: "cancelled" });
			},
			{ once: true }
		);

		document.body.appendChild(input);
		input.click();
	});
}

function parseSaveFile(text, fileName) {
	try {
		const data = JSON.parse(text);
		return { status: "loaded", fileName, data };
	} catch (error) {
		return {
			status: "error",
			error,
			fileName,
			message: "Save file is not valid JSON.",
		};
	}
}

function isAbortError(error) {
	if (!error) return false;
	if (error.name === "AbortError") return true;
	if (typeof DOMException !== "undefined" && error.code === DOMException.ABORT_ERR) {
		return true;
	}
	return false;
}

/**
 * @typedef {Object} SerializedSaveData
 * @property {number} version
 * @property {string} createdAt
 * @property {{ url: string, statsConfigUrl?: string|null, start?: string|null, currentBranchId?: string|null, currentBranchTitle?: string|null }} story
 * @property {{ currentBranchId?: string|null, stats: Record<string, number>, inventory: Record<string, number>, journal: string[] }} state
 */

/**
 * @typedef {{ status: "saved"|"downloaded"|"cancelled"|"error", fileName?: string, error?: unknown }} SaveOperationResult
 */

/**
 * @typedef {{ status: "loaded"|"cancelled"|"error", data?: SerializedSaveData, fileName?: string, message?: string, error?: unknown }} LoadOperationResult
 */
