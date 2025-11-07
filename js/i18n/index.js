const STORAGE_KEY = "equilibrium.language";
const FALLBACK_LANGUAGE = "en";

const LANGUAGE_OPTIONS = [
	{ code: "en", label: "English" },
	{ code: "fr", label: "Français" },
	{ code: "zh-Hans", label: "简体中文" },
];

const translations = {
	en: {
		app: {
			documentTitleSuffix: "Narrative Demo",
			gameTitle: "Equilibrium",
			tagline: "An Interactive Narrative Game",
			teamTitle: "Team",
		},
		common: {
			language: "Language",
			loading: "Loading...",
			storyMap: "Story Map",
			saveGame: "Save Game",
			loadGame: "Load Game",
			returnHome: "Return Home",
			restart: "Restart",
			undo: "Undo Last Choice",
			skip: "Skip",
			autoSkipOn: "Auto Skip: On",
			autoSkipOff: "Auto Skip: Off",
			autoSkipEnable: "Enable always skip text",
			autoSkipDisable: "Disable always skip text",
			autoSkipLabel: "Toggle always skip text",
			choices: "Choices",
			journal: "Journal",
			stats: "Stats",
			inventory: "Inventory",
			returnToGame: "Return to Game",
			storyMapPlaceholder: "Play the story to reveal the map.",
			storyMapViewLabel: "Story map view",
			gameActions: "Game actions",
			textPlaybackOptions: "Text playback options",
			skipTextAnimation: "Skip text animation",
			continue: "Continue",
			success: "Success",
			failure: "Failure",
		},
		home: {
			newGame: "New Game",
			loadGame: "Load Game",
			languageInfo: "Story translation coming soon. The narrative currently appears in English.",
		},
		graph: {
			visitedBranches: "Visited Branches",
			showFullMap: "Show Full Map",
			title: "Story Map",
		},
		noscript: {
			message: "This interactive story requires JavaScript. Please enable it to play.",
		},
		notice: {
			storyPlaceholder: "Story translation coming soon. The narrative currently appears in English.",
		},
		messages: {
			failedToStartStory: "Failed to start the story. Please check the game files and try again.",
			unableToLoadStoryFile:
				"Unable to load story file. Please ensure assets/story.txt exists and is well formatted.",
			storyLoadFailedTitle: "Story Load Failed",
			restartConfirm:
				"Restarting wipes your current progress and takes you back to the beginning. Do you really want to restart?",
			returnHomeConfirm:
				"Returning home will leave the current story session. Do you want to go back to the home screen?",
			undoPromptPrimary:
				"Every choice carries weight; once a move is made, there's no taking it back. Do you still want to try to undo your last decision?",
			undoUnavailable: "There's no choice to undo right now.",
			needRunningGameSave: "A game needs to be running before it can be saved.",
			unableToCaptureState: "Unable to capture the current game state for saving.",
			saveFailed: "Saving failed. Please check the console for details.",
			gameSaved: "Game saved to {{name}}.",
			saveFallbackName: "the chosen location",
			selectSaveFile: "Select a save file to load.",
			loadCancelled: "Load cancelled.",
			failedToReadSave: "Failed to read the save file.",
			loadingSaveFailed: "Loading the save file failed.",
		},
		choices: {
			noFurtherChoices: "This path has no further choices.",
			noneAvailable: "No available choices.",
		},
		inventory: {
			empty: "Inventory empty.",
		},
		stats: {
			empty: "No stats configured.",
		},
		journal: {
			empty: "No actions recorded yet.",
		},
		roll: {
			summaryDice: "{{dice}} -> {{rolls}}",
			summaryTotal: "Total {{total}} / Target {{target}}",
			summaryTotalNoTarget: "Total {{total}}",
			modifierLine: "Modifier",
			diceLine: "Dice",
			totalLine: "Total",
			targetLine: "Target",
			noDetails: "No roll details.",
		},
		change: {
			statusUpdated: "Status Updated",
			statsUpdated: "Stats Updated",
			inventoryUpdated: "Inventory Updated",
			recentChanges: "Recent changes applied",
			afterSource: "After \"{{source}}\"",
			statsSection: "Stats",
			inventorySection: "Inventory",
		},
		saveSystem: {
			invalidJson: "Save file is not valid JSON.",
			fileDescription: "Narrative Save Files",
		},
		storyRenderer: {
			storyUnavailable: "Story unavailable",
			unableToLocate: "Unable to locate the next branch.",
		},
		graphView: {
			storyMapUnavailable: "Story map unavailable.",
			youAreHere: "You Are Here",
		},
	},
	fr: {
		app: {
			documentTitleSuffix: "Démo narrative",
			gameTitle: "Equilibrium",
			tagline: "Un jeu narratif interactif",
			teamTitle: "Équipe",
		},
		common: {
			language: "Langue",
			loading: "Chargement...",
			storyMap: "Carte de l'histoire",
			saveGame: "Sauvegarder",
			loadGame: "Charger une partie",
			returnHome: "Retour à l'accueil",
			restart: "Recommencer",
			undo: "Annuler le dernier choix",
			skip: "Passer",
			autoSkipOn: "Avance auto : activée",
			autoSkipOff: "Avance auto : désactivée",
			autoSkipEnable: "Activer l'avance automatique du texte",
			autoSkipDisable: "Désactiver l'avance automatique du texte",
			autoSkipLabel: "Activer/désactiver l'avance automatique du texte",
			choices: "Choix",
			journal: "Journal",
			stats: "Statistiques",
			inventory: "Inventaire",
			returnToGame: "Retour au jeu",
			storyMapPlaceholder: "Jouez l'histoire pour révéler la carte.",
			storyMapViewLabel: "Vue de la carte narrative",
			gameActions: "Actions du jeu",
			textPlaybackOptions: "Options de lecture du texte",
			skipTextAnimation: "Passer l'animation du texte",
			continue: "Continuer",
			success: "Succès",
			failure: "Échec",
		},
		home: {
			newGame: "Nouvelle partie",
			loadGame: "Charger une partie",
			languageInfo: "La traduction de l'histoire arrivera bientôt. Pour l'instant, le récit reste en anglais.",
		},
		graph: {
			visitedBranches: "Branches visitées",
			showFullMap: "Afficher toute la carte",
			title: "Carte de l'histoire",
		},
		noscript: {
			message: "Cette histoire interactive nécessite JavaScript. Veuillez l'activer pour jouer.",
		},
		notice: {
			storyPlaceholder: "La traduction de l'histoire arrivera bientôt. Pour l'instant, le récit reste en anglais.",
		},
		messages: {
			failedToStartStory: "Impossible de démarrer l'histoire. Vérifiez les fichiers du jeu et réessayez.",
			unableToLoadStoryFile:
				"Impossible de charger le fichier de l'histoire. Assurez-vous que assets/story.txt existe et est correctement formaté.",
			storyLoadFailedTitle: "Échec du chargement de l'histoire",
			restartConfirm:
				"Recommencer efface votre progression actuelle et vous ramène au début. Voulez-vous vraiment recommencer ?",
			returnHomeConfirm:
				"Retourner à l'accueil quittera la session en cours. Voulez-vous revenir à l'écran d'accueil ?",
			undoPromptPrimary:
				"Chaque choix compte ; une fois fait, il n'y a pas de retour en arrière. Voulez-vous tout de même annuler votre dernière décision ?",
			undoUnavailable: "Aucun choix à annuler pour le moment.",
			needRunningGameSave: "Une partie doit être en cours avant de pouvoir être sauvegardée.",
			unableToCaptureState: "Impossible de capturer l'état actuel de la partie pour la sauvegarder.",
			saveFailed: "Échec de la sauvegarde. Consultez la console pour plus de détails.",
			gameSaved: "Partie sauvegardée vers {{name}}.",
			saveFallbackName: "l'emplacement choisi",
			selectSaveFile: "Sélectionnez un fichier de sauvegarde à charger.",
			loadCancelled: "Chargement annulé.",
			failedToReadSave: "Lecture du fichier de sauvegarde impossible.",
			loadingSaveFailed: "Le chargement du fichier de sauvegarde a échoué.",
		},
		choices: {
			noFurtherChoices: "Cette voie n'a plus de choix.",
			noneAvailable: "Aucun choix disponible.",
		},
		inventory: {
			empty: "Inventaire vide.",
		},
		stats: {
			empty: "Aucune statistique définie.",
		},
		journal: {
			empty: "Aucune action enregistrée pour le moment.",
		},
		roll: {
			summaryDice: "{{dice}} -> {{rolls}}",
			summaryTotal: "Total {{total}} / Objectif {{target}}",
			summaryTotalNoTarget: "Total {{total}}",
			modifierLine: "Modificateur",
			diceLine: "Dés",
			totalLine: "Total",
			targetLine: "Objectif",
			noDetails: "Aucun détail de jet de dés.",
		},
		change: {
			statusUpdated: "Statut mis à jour",
			statsUpdated: "Statistiques mises à jour",
			inventoryUpdated: "Inventaire mis à jour",
			recentChanges: "Derniers changements appliqués",
			afterSource: "Après « {{source}} »",
			statsSection: "Statistiques",
			inventorySection: "Inventaire",
		},
		saveSystem: {
			invalidJson: "Le fichier de sauvegarde n'est pas un JSON valide.",
			fileDescription: "Fichiers de sauvegarde narrative",
		},
		storyRenderer: {
			storyUnavailable: "Histoire indisponible",
			unableToLocate: "Impossible de localiser la prochaine branche.",
		},
		graphView: {
			storyMapUnavailable: "Carte de l'histoire indisponible.",
			youAreHere: "Vous êtes ici",
		},
	},
	"zh-Hans": {
		app: {
			documentTitleSuffix: "叙事演示",
			gameTitle: "Equilibrium",
			tagline: "互动叙事游戏",
			teamTitle: "团队",
		},
		common: {
			language: "语言",
			loading: "加载中...",
			storyMap: "剧情地图",
			saveGame: "保存游戏",
			loadGame: "读取存档",
			returnHome: "返回主页",
			restart: "重新开始",
			undo: "撤销上一步",
			skip: "跳过",
			autoSkipOn: "自动跳过：开",
			autoSkipOff: "自动跳过：关",
			autoSkipEnable: "启用自动跳过文本",
			autoSkipDisable: "关闭自动跳过文本",
			autoSkipLabel: "切换自动跳过文本",
			choices: "选项",
			journal: "日志",
			stats: "属性",
			inventory: "物品",
			returnToGame: "返回游戏",
			storyMapPlaceholder: "游玩故事以解锁地图。",
			storyMapViewLabel: "剧情地图视图",
			gameActions: "游戏操作",
			textPlaybackOptions: "文本播放选项",
			skipTextAnimation: "跳过文本动画",
			continue: "继续",
			success: "成功",
			failure: "失败",
		},
		home: {
			newGame: "开始新游戏",
			loadGame: "读取存档",
			languageInfo: "故事翻译即将上线，目前仍显示英文剧情。",
		},
		graph: {
			visitedBranches: "已探索分支",
			showFullMap: "显示完整地图",
			title: "剧情地图",
		},
		noscript: {
			message: "此互动故事需要启用 JavaScript 才能运行。",
		},
		notice: {
			storyPlaceholder: "故事翻译即将上线，目前仍显示英文剧情。",
		},
		messages: {
			failedToStartStory: "无法启动故事。请检查游戏文件后重试。",
			unableToLoadStoryFile: "无法加载故事文件。请确认 assets/story.txt 存在且格式正确。",
			storyLoadFailedTitle: "故事加载失败",
			restartConfirm: "重新开始会清除当前进度并回到开头。确定要重新开始吗？",
			returnHomeConfirm: "返回主页将退出当前剧情。是否回到主界面？",
			undoPromptPrimary: "每一次选择都很重要，一旦做出就无法回头。仍然要撤销上一决定吗？",
			undoUnavailable: "当前没有可撤销的选择。",
			needRunningGameSave: "需要先开始游戏才能进行保存。",
			unableToCaptureState: "无法获取当前游戏状态，保存失败。",
			saveFailed: "保存失败。详情请查看控制台。",
			gameSaved: "已保存至 {{name}}。",
			saveFallbackName: "选定的位置",
			selectSaveFile: "请选择一个存档文件。",
			loadCancelled: "已取消读取。",
			failedToReadSave: "读取存档文件失败。",
			loadingSaveFailed: "载入存档失败。",
		},
		choices: {
			noFurtherChoices: "此路线没有更多可选项。",
			noneAvailable: "当前没有可用的选项。",
		},
		inventory: {
			empty: "物品栏为空。",
		},
		stats: {
			empty: "暂无属性数据。",
		},
		journal: {
			empty: "尚未记录任何行动。",
		},
		roll: {
			summaryDice: "{{dice}} -> {{rolls}}",
			summaryTotal: "总计 {{total}} / 目标 {{target}}",
			summaryTotalNoTarget: "总计 {{total}}",
			modifierLine: "修正值",
			diceLine: "骰子",
			totalLine: "总计",
			targetLine: "目标",
			noDetails: "暂无掷骰详情。",
		},
		change: {
			statusUpdated: "状态已更新",
			statsUpdated: "属性已更新",
			inventoryUpdated: "物品栏已更新",
			recentChanges: "已应用最新变更",
			afterSource: "来自“{{source}}”之后",
			statsSection: "属性",
			inventorySection: "物品",
		},
		saveSystem: {
			invalidJson: "存档文件不是有效的 JSON。",
			fileDescription: "叙事存档文件",
		},
		storyRenderer: {
			storyUnavailable: "故事不可用",
			unableToLocate: "无法定位下一章节。",
		},
		graphView: {
			storyMapUnavailable: "无法显示剧情地图。",
			youAreHere: "当前位置",
		},
	},
};

const bindings = new Set();
const NOOP = () => {};

let currentLanguage = resolveInitialLanguage();
applyDocumentLanguage(currentLanguage);

const listeners = new Set();

export function getAvailableLanguages() {
	return LANGUAGE_OPTIONS.slice();
}

export function getCurrentLanguage() {
	return currentLanguage;
}

export function setLanguage(code) {
	const next = normalizeLanguage(code);
	if (next === currentLanguage) {
		return currentLanguage;
	}
	currentLanguage = next;
	storeLanguage(next);
	applyDocumentLanguage(next);
	notifyLanguageChange();
	return currentLanguage;
}

export function onLanguageChange(listener) {
	if (typeof listener !== "function") {
		return () => {};
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function t(key, replacements = null) {
	if (!key) {
		return "";
	}
	const value = getTranslation(currentLanguage, key);
	if (value !== undefined) {
		return formatValue(value, replacements);
	}
	const fallbackValue = getTranslation(FALLBACK_LANGUAGE, key);
	if (fallbackValue !== undefined) {
		return formatValue(fallbackValue, replacements);
	}
	return key;
}

export function bindText(element, key, options = {}) {
	if (!element) {
		return NOOP;
	}
	return createBinding(
		element,
		key,
		(target, value) => {
			if (!target) return;
			target.textContent = value == null ? "" : String(value);
		},
		options
	);
}

export function bindAttribute(element, attribute, key, options = {}) {
	if (!attribute || !element || typeof element.setAttribute !== "function") {
		return NOOP;
	}
	return createBinding(
		element,
		key,
		(target, value) => {
			if (!target || typeof target.setAttribute !== "function") {
				return;
			}
			if (value == null) {
				if (typeof target.removeAttribute === "function") {
					target.removeAttribute(attribute);
				} else {
					target.setAttribute(attribute, "");
				}
			} else {
				target.setAttribute(attribute, String(value));
			}
		},
		options
	);
}

export function refreshBindings() {
	for (const binding of Array.from(bindings)) {
		applyBinding(binding);
	}
}

function formatValue(value, replacements) {
	if (typeof value === "string") {
		return applyReplacements(value, replacements);
	}
	if (typeof value === "function") {
		try {
			return value(replacements);
		} catch {
			return "";
		}
	}
	return value == null ? "" : String(value);
}

function applyReplacements(template, replacements) {
	if (!replacements || typeof replacements !== "object") {
		return template;
	}
	return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, token) => {
		if (Object.prototype.hasOwnProperty.call(replacements, token)) {
			const replacement = replacements[token];
			return replacement == null ? "" : String(replacement);
		}
		return match;
	});
}

function createBinding(target, key, apply, options = {}) {
	if (!target || typeof apply !== "function") {
		return NOOP;
	}
	const binding = {
		target,
		key,
		apply,
		options: options || {},
	};
	bindings.add(binding);
	applyBinding(binding);
	return () => {
		bindings.delete(binding);
	};
}

function applyBinding(binding) {
	if (!binding) return;
	const { target, apply } = binding;
	if (!target || typeof apply !== "function") {
		return;
	}
	const value = resolveBindingValue(binding);
	apply(target, value, binding);
}

function resolveBindingValue(binding) {
	const replacements = resolveBindingReplacements(binding.options);
	const rawValue = t(binding.key, replacements);
	const transform =
		binding && binding.options && typeof binding.options.transform === "function"
			? binding.options.transform
			: null;
	return transform ? transform(rawValue) : rawValue;
}

function resolveBindingReplacements(options) {
	if (!options || typeof options !== "object") {
		return undefined;
	}
	const { replacements } = options;
	if (typeof replacements === "function") {
		try {
			return replacements();
		} catch {
			return undefined;
		}
	}
	return replacements;
}

function getTranslation(language, key) {
	const source = translations[language];
	if (!source) {
		return undefined;
	}
	const segments = key.split(".");
	let current = source;
	for (const segment of segments) {
		if (!current || typeof current !== "object" || !(segment in current)) {
			return undefined;
		}
		current = current[segment];
	}
	return current;
}

function resolveInitialLanguage() {
	const stored = readStoredLanguage();
	if (stored) {
		return stored;
	}
	if (typeof navigator !== "undefined") {
		const languages = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
		for (const lang of languages) {
			const normalized = normalizeLanguage(lang);
			if (normalized) {
				return normalized;
			}
		}
	}
	return FALLBACK_LANGUAGE;
}

function normalizeLanguage(value) {
	if (!value) {
		return FALLBACK_LANGUAGE;
	}
	const stringValue = String(value).trim();
	if (!stringValue) {
		return FALLBACK_LANGUAGE;
	}
	const direct = LANGUAGE_OPTIONS.find((option) => option.code === stringValue);
	if (direct) {
		return direct.code;
}
	const lower = stringValue.toLowerCase();
	if (lower.startsWith("fr")) {
		return "fr";
	}
	if (lower.startsWith("zh")) {
		return "zh-Hans";
	}
	if (lower.startsWith("en")) {
		return "en";
	}
	return FALLBACK_LANGUAGE;
}

function readStoredLanguage() {
	if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
		return null;
	}
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return null;
		}
		return normalizeLanguage(stored);
	} catch {
		return null;
	}
}

function storeLanguage(code) {
	if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
		return;
	}
	try {
		window.localStorage.setItem(STORAGE_KEY, code);
	} catch {
		// ignore storage errors
	}
}

function applyDocumentLanguage(lang) {
	if (typeof document === "undefined" || !document.documentElement) {
		return;
	}
	document.documentElement.lang = lang;
}

function notifyLanguageChange() {
	refreshBindings();
	for (const listener of Array.from(listeners)) {
		try {
			listener(currentLanguage);
		} catch {
			// ignore listener errors
		}
	}
}
