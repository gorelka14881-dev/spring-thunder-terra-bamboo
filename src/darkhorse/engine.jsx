import * as React from "react";
import * as import_jsx_runtime from "react/jsx-runtime";
import { create } from "zustand";
import { parseJson, messageFromKie, extractVideoUrls, pickDownloadUrl, flattenPrompt, uid } from "./kie";

if (typeof window !== "undefined" && !window.__dhFetchPatched) {
	const orig = window.fetch.bind(window);
	const prefix = () => {
		const host = window.location.hostname;
		if (!/preview\.grok/i.test(host)) return "";
		const m = window.location.pathname.match(/^\/hds-[a-z0-9]+-\d+-[a-z0-9]+/i);
		return m ? m[0] : "";
	};
	window.fetch = (input, init) => {
		if (typeof input === "string" && input.startsWith("/api/")) {
			const p = prefix();
			if (p && !input.startsWith(p + "/")) input = p + input;
		}
		return orig(input, init);
	};
	window.__dhFetchPatched = true;
}

var enqueue = (r) => {
	r.kind === "confirm" ? r.resolve(false) : r.kind === "alert" ? r.resolve() : r.resolve(null);
};
function confirmDialog(opts) {
	return new Promise((resolve) => {
		enqueue({
			kind: "confirm",
			title: opts.title,
			body: opts.body,
			confirmLabel: opts.confirmLabel ?? "Подтвердить",
			danger: Boolean(opts.danger),
			requireCheck: opts.requireCheck,
			resolve
		});
	});
}
function alertDialog(opts) {
	return new Promise((resolve) => {
		enqueue({
			kind: "alert",
			title: opts.title,
			body: opts.body,
			resolve
		});
	});
}
function promptDialog(opts) {
	return new Promise((resolve) => {
		enqueue({
			kind: "prompt",
			title: opts.title,
			body: opts.body,
			placeholder: opts.placeholder,
			value: opts.defaultValue ?? "",
			resolve
		});
	});
}
function pickDialog(opts) {
	return new Promise((resolve) => {
		enqueue({
			kind: "pick",
			title: opts.title,
			body: opts.body,
			options: opts.options,
			createLabel: opts.createLabel ?? "Создать",
			selectedId: opts.selectedId,
			resolve
		});
	});
}
function DialogHost() {
	const [queue, setQueue] = (0, React.useState)([]);
	const [checked, setChecked] = (0, React.useState)(false);
	const [draft, setDraft] = (0, React.useState)("");
	const [picked, setPicked] = (0, React.useState)(null);
	(0, React.useEffect)(() => {
		enqueue = (r) => setQueue((q) => [...q, r]);
		return () => {
			enqueue = (r) => {
				if (r.kind === "confirm") r.resolve(false);
				else if (r.kind === "alert") r.resolve();
				else r.resolve(null);
			};
		};
	}, []);
	const current = queue[0];
	(0, React.useEffect)(() => {
		queue.length;
		setChecked(false);
		if (!current) return;
		if (current.kind === "prompt") setDraft(current.value);
		if (current.kind === "pick") {
			setDraft("");
			const prefer = current.selectedId;
			setPicked(prefer && current.options.some((o) => o.id === prefer) ? prefer : current.options[0]?.id ?? null);
		}
	}, [current]);
	if (!current) return null;
	const close = () => setQueue((q) => q.slice(1));
	const cancel = () => {
		if (current.kind === "confirm") current.resolve(false);
		else if (current.kind === "alert") current.resolve();
		else current.resolve(null);
		close();
	};
	const ok = () => {
		if (current.kind === "confirm") {
			if (current.requireCheck && !checked) return;
			current.resolve(true);
		} else if (current.kind === "alert") current.resolve();
		else if (current.kind === "prompt") {
			const v = draft.trim();
			current.resolve(v ? v : null);
		} else if (current.kind === "pick") {
			const name = draft.trim();
			if (name) current.resolve({
				type: "new",
				name
			});
			else if (picked) current.resolve({
				type: "existing",
				id: picked
			});
			else return;
		}
		close();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "dh-dialog-scrim",
		role: "presentation",
		onMouseDown: cancel,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dh-dialog",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "dh-dialog-title",
			onMouseDown: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "dh-dialog-glow",
					"aria-hidden": true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					id: "dh-dialog-title",
					children: current.title
				}),
				current.kind !== "pick" && "body" in current && current.body ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "dh-dialog-body",
					children: current.body
				}) : null,
				current.kind === "pick" && current.body ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "dh-dialog-body",
					children: current.body
				}) : null,
				current.kind === "prompt" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "input",
					autoFocus: true,
					placeholder: current.placeholder,
					value: draft,
					onChange: (e) => setDraft(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") ok();
					}
				}) : null,
				current.kind === "pick" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "dh-pick",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "dh-pick-list",
							children: current.options.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "muted",
								children: "Пока нет. Создайте новое имя ниже."
							}) : current.options.map((op) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: picked === op.id && !draft.trim() ? "dh-pick-item on" : "dh-pick-item",
								onClick: () => {
									setPicked(op.id);
									setDraft("");
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: op.label }), op.hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: op.hint }) : null]
							}, op.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "label",
							children: "Новое имя"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "input",
							placeholder: current.createLabel,
							value: draft,
							onChange: (e) => setDraft(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") ok();
							}
						})
					]
				}) : null,
				current.kind === "confirm" && current.requireCheck ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "dh-check",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked,
						onChange: (e) => setChecked(e.target.checked)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: current.requireCheck })]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "dh-dialog-actions",
					children: current.kind === "alert" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn primary",
						onClick: ok,
						autoFocus: true,
						children: "Хорошо"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: cancel,
						children: "Отмена"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: current.kind === "confirm" && current.danger ? "btn primary danger" : "btn primary",
						onClick: ok,
						disabled: current.kind === "confirm" && Boolean(current.requireCheck) && !checked,
						children: current.kind === "confirm" ? current.confirmLabel : current.kind === "pick" ? draft.trim() ? current.createLabel : "Выбрать" : "Готово"
					})] })
				})
			]
		})
	});
}
var openMenuImpl = () => {};
function openMenu(x, y, items) {
	openMenuImpl(x, y, items);
}
function MenuHost() {
	const [menu, setMenu] = (0, React.useState)(null);
	const [fly, setFly] = (0, React.useState)(null);
	(0, React.useEffect)(() => {
		openMenuImpl = (x, y, items) => {
			setFly(null);
			setMenu({
				x,
				y,
				items
			});
		};
		const close = () => setMenu(null);
		window.addEventListener("mousedown", close);
		window.addEventListener("scroll", close, true);
		window.addEventListener("resize", close);
		return () => {
			window.removeEventListener("mousedown", close);
			window.removeEventListener("scroll", close, true);
			window.removeEventListener("resize", close);
		};
	}, []);
	if (!menu) return null;
	const left = Math.min(menu.x, window.innerWidth - 240);
	const top = Math.min(menu.y, window.innerHeight - 20 - menu.items.length * 40);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "dh-menu",
		style: {
			left,
			top
		},
		onMouseDown: (e) => e.stopPropagation(),
		children: menu.items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dh-menu-row",
			onMouseEnter: () => setFly(item.children?.length ? index : null),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				disabled: item.disabled,
				onClick: () => {
					if (item.children?.length) {
						setFly(index);
						return;
					}
					setMenu(null);
					item.onClick?.();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }), item.children?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "›" }) : null]
			}), fly === index && item.children?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "dh-submenu",
				children: item.children.map((child) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: child.disabled,
					onClick: () => {
						setMenu(null);
						child.onClick?.();
					},
					children: child.label
				}, child.label))
			}) : null]
		}, `${item.label}-${index}`))
	});
}
var toastImpl = () => {};
function revealLibrary(path) {
	void alertDialog({
		title: "Локальный путь",
		body: `В предпросмотре браузера нельзя открыть проводник Windows. Папка запомнена:\n${path}\n\nНа своём компьютере откройте этот путь вручную. Смена диска — в Настройки → Система.`
	});
	void copyText(path);
}
function toast(text) {
	toastImpl(text);
}
async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		toast("Скопировано");
	} catch {
		await alertDialog({
			title: "Скопируйте вручную",
			body: text
		});
	}
}
function ToastHost() {
	const [items, setItems] = (0, React.useState)([]);
	(0, React.useEffect)(() => {
		toastImpl = (text) => {
			const id = Date.now() + Math.random();
			setItems((list) => [...list.slice(-3), {
				id,
				text
			}]);
			window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 1800);
		};
	}, []);
	if (!items.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "dh-toasts",
		"aria-live": "polite",
		children: items.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "dh-toast",
			children: t.text
		}, t.id))
	});
}
var DEFAULT_THEME = {
	bgHue: 272,
	bgAmt: 22,
	bgWhite: 0,
	glowHue: 274,
	glowAmt: 46,
	glowWhite: 0,
	winHue: 270,
	winAmt: 28,
	winWhite: 0,
	btnHue: 274,
	btnAmt: 42,
	btnWhite: 8,
	logHue: 270,
	logAmt: 18,
	logWhite: 0,
	shineHue: 274,
	shineAmt: 78,
	shineWhite: 18
};
function num(v, fallback, max) {
	const n = Number(v);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(0, n));
}
function clampTheme(raw) {
	return {
		bgHue: num(raw?.bgHue, DEFAULT_THEME.bgHue, 360),
		bgAmt: num(raw?.bgAmt, DEFAULT_THEME.bgAmt, 100),
		bgWhite: num(raw?.bgWhite, DEFAULT_THEME.bgWhite, 100),
		glowHue: num(raw?.glowHue, DEFAULT_THEME.glowHue, 360),
		glowAmt: num(raw?.glowAmt, DEFAULT_THEME.glowAmt, 100),
		glowWhite: num(raw?.glowWhite, DEFAULT_THEME.glowWhite, 100),
		winHue: num(raw?.winHue, DEFAULT_THEME.winHue, 360),
		winAmt: num(raw?.winAmt, DEFAULT_THEME.winAmt, 100),
		winWhite: num(raw?.winWhite, DEFAULT_THEME.winWhite, 100),
		btnHue: num(raw?.btnHue, DEFAULT_THEME.btnHue, 360),
		btnAmt: num(raw?.btnAmt, DEFAULT_THEME.btnAmt, 100),
		btnWhite: num(raw?.btnWhite, DEFAULT_THEME.btnWhite, 100),
		logHue: num(raw?.logHue, DEFAULT_THEME.logHue, 360),
		logAmt: num(raw?.logAmt, DEFAULT_THEME.logAmt, 100),
		logWhite: num(raw?.logWhite, DEFAULT_THEME.logWhite, 100),
		shineHue: num(raw?.shineHue, DEFAULT_THEME.shineHue, 360),
		shineAmt: num(raw?.shineAmt, DEFAULT_THEME.shineAmt, 100),
		shineWhite: num(raw?.shineWhite, DEFAULT_THEME.shineWhite, 100)
	};
}
/** amt: 0 чёрный → 100 цвет. white: 0 чистый цвет → 100 белый. */
function tone(hue, amt, white = 0) {
	const t = Math.max(0, Math.min(100, amt)) / 100;
	const w = Math.max(0, Math.min(100, white)) / 100;
	const sat = Math.round(t * 100 * (1 - w));
	const light = Math.round(t * 46 * (1 - w) + w * 97);
	return `hsl(${Math.round(hue)} ${sat}% ${light}%)`;
}
function applyTheme(theme) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	const t = Math.max(0, Math.min(100, theme.glowAmt)) / 100;
	const w = Math.max(0, Math.min(100, theme.glowWhite)) / 100;
	const gh = Math.round(theme.glowHue);
	const accent = `hsl(${gh} ${Math.round((42 + t * 58) * (1 - w))}% ${Math.round((46 + t * 24) * (1 - w) + w * 96)}%)`;
	const glow = `hsla(${gh} ${Math.round((48 + t * 46) * (1 - w))}% ${Math.round((30 + t * 22) * (1 - w) + w * 92)}% / ${(.1 + t * .38 * (1 - w * .4)).toFixed(3)})`;
	const aura = `hsla(${gh} ${Math.round((42 + t * 40) * (1 - w))}% ${Math.round((26 + t * 16) * (1 - w) + w * 90)}% / ${(.06 + t * .24).toFixed(3)})`;
	const wash = `hsla(${gh} ${Math.round((40 + t * 40) * (1 - w))}% ${Math.round((38 + t * 14) * (1 - w) + w * 90)}% / ${(.16 + t * .3).toFixed(3)})`;
	const btn = tone(theme.btnHue, Math.max(theme.btnAmt, 12), theme.btnWhite);
	const btnInk = theme.btnWhite > 62 ? "#1a1520" : "#f6f1ea";
	const log = tone(theme.logHue, Math.max(theme.logAmt, 8), theme.logWhite);
	const logInk = Math.max(theme.logAmt, 8) / 100 * 46 * (1 - Math.min(100, theme.logWhite) / 100) + Math.min(100, theme.logWhite) / 100 * 97 > 62 ? "#1a1520" : "#f6f1ea";
	const shine = tone(theme.shineHue, Math.max(theme.shineAmt, 24), theme.shineWhite);
	root.style.setProperty("--bg", tone(theme.bgHue, theme.bgAmt, theme.bgWhite));
	root.style.setProperty("--bg-2", tone(theme.bgHue, Math.min(100, theme.bgAmt + 6), theme.bgWhite));
	root.style.setProperty("--header", tone(theme.bgHue, Math.max(0, theme.bgAmt - 5), theme.bgWhite));
	root.style.setProperty("--panel", tone(theme.winHue, theme.winAmt, theme.winWhite));
	root.style.setProperty("--panel-2", tone(theme.winHue, Math.min(100, theme.winAmt + 10), theme.winWhite));
	root.style.setProperty("--accent", accent);
	root.style.setProperty("--accent-wash", wash);
	root.style.setProperty("--glow", glow);
	root.style.setProperty("--aura", aura);
	root.style.setProperty("--violet", accent);
	root.style.setProperty("--violet-2", accent);
	root.style.setProperty("--btn", btn);
	root.style.setProperty("--btn-ink", btnInk);
	root.style.setProperty("--log", log);
	root.style.setProperty("--log-ink", logInk);
	root.style.setProperty("--shine", shine);
	root.style.setProperty("--folder", tone(theme.glowHue, Math.max(36, theme.glowAmt), Math.min(70, theme.glowWhite + 12)));
}
var KEY = "dark-horse-v2";
var SETTINGS_KEY = "dark-horse-settings";
var persistReady = false;
function clampDuration(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 8;
	return Math.min(30, Math.max(3, Math.round(n)));
}
function readSettings() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		return data && typeof data === "object" ? data : null;
	} catch {
		return null;
	}
}
function writeSettings(data) {
	if (typeof localStorage === "undefined" || !data) return;
	try {
		const prev = readSettings() || {};
		const next = {
			...prev,
			duration: clampDuration(data.duration ?? prev.duration),
			resolution: data.resolution ?? prev.resolution,
			aspect: data.aspect ?? prev.aspect,
			count: Number(data.count ?? prev.count ?? 1) || 1,
			audio: data.audio ?? prev.audio,
			nsfw: Boolean(data.nsfw ?? prev.nsfw),
			model: data.model ?? prev.model,
			seed: data.seed ?? prev.seed,
			hallPath: data.hallPath ?? prev.hallPath,
			refsPath: data.refsPath ?? prev.refsPath
		};
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
	} catch {}
}
function storageSafe(data) {
	const keep = (item) => {
		if (!item || typeof item !== "object") return null;
		const next = { ...item };
		if (typeof next.url === "string" && next.url.startsWith("data:")) return null;
		if (typeof next.thumb === "string" && next.thumb.startsWith("data:") && next.thumb.length > 8000) delete next.thumb;
		return next.url ? next : null;
	};
	const stash = data.mediaStash || { image: [], video: [] };
	return {
		...data,
		duration: clampDuration(data.duration),
		mediaStash: {
			image: (stash.image || []).map(keep).filter(Boolean),
			video: (stash.video || []).map(keep).filter(Boolean)
		}
	};
}
var DB_NAME = "dark-horse";
var STORE = "clips";
var FILES = "files";
function slotsFrom(data) {
	const apiKeys = (Array.isArray(data.apiKeys) ? data.apiKeys : []).map((k, i) => ({
		id: String(k?.id || `key-${i + 1}`),
		token: String(k?.token || "")
	})).filter((k, i, arr) => arr.findIndex((x) => x.id === k.id) === i);
	if (!apiKeys.length) apiKeys.push({
		id: "key-1",
		token: String(data.token || "")
	});
	const wanted = String(data.activeKeyId || "");
	const activeKeyId = apiKeys.some((k) => k.id === wanted) ? wanted : apiKeys[0].id;
	return {
		apiKeys,
		activeKeyId,
		token: apiKeys.find((k) => k.id === activeKeyId)?.token || ""
	};
}
function readPersisted() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(KEY);
		const settings = readSettings();
		if (!raw && !settings) return null;
		let data = {};
		if (raw) {
			try {
				const parsed = JSON.parse(raw);
				if (parsed && typeof parsed === "object") data = parsed;
			} catch {}
		}
		if (settings) {
			if (settings.duration != null) data.duration = settings.duration;
			if (settings.resolution) data.resolution = settings.resolution;
			if (settings.aspect) data.aspect = settings.aspect;
			if (settings.count != null) data.count = settings.count;
			if (settings.audio != null) data.audio = settings.audio;
			if (settings.nsfw != null) data.nsfw = settings.nsfw;
			if (settings.model) data.model = settings.model;
			if (settings.seed != null) data.seed = settings.seed;
			if (settings.hallPath) data.hallPath = settings.hallPath;
			if (settings.refsPath) data.refsPath = settings.refsPath;
		}
		return {
			...slotsFrom(data),
			theme: clampTheme(data.theme),
			albums: Array.isArray(data.albums) ? data.albums.filter((a) => a && a.id && a.name).map((a) => ({
				id: String(a.id),
				name: String(a.name),
				createdAt: Number(a.createdAt) || Date.now()
			})) : [],
			lastAlbumId: data.lastAlbumId ? String(data.lastAlbumId) : null,
			refFolders: Array.isArray(data.refFolders) ? data.refFolders.filter((a) => a && a.id && a.name).map((a) => ({
				id: String(a.id),
				name: String(a.name),
				createdAt: Number(a.createdAt) || Date.now()
			})) : [],
			refAssets: Array.isArray(data.refAssets) ? data.refAssets.filter((a) => a && a.id && a.folderId).map((a) => ({
				id: String(a.id),
				folderId: String(a.folderId),
				name: String(a.name || "Файл"),
				kind: a.kind === "video" || a.kind === "audio" ? a.kind : "image",
				createdAt: Number(a.createdAt) || Date.now(),
				thumb: typeof a.thumb === "string" ? a.thumb : void 0
			})) : [],
			model: String(data.model || "wan/3-0-video"),
			promptRaw: String(data.promptRaw || ""),
			promptFlat: String(data.promptFlat || ""),
			first: data.first ?? null,
			last: data.last ?? null,
			refImages: Array.isArray(data.refImages) ? data.refImages : [],
			refVideos: Array.isArray(data.refVideos) ? data.refVideos : [],
			refAudios: Array.isArray(data.refAudios) ? data.refAudios : [],
			refFiles: Array.isArray(data.refFiles) ? data.refFiles : [],
			refLinks: Array.isArray(data.refLinks) ? data.refLinks : [],
			resolution: String(data.resolution || "480P"),
			aspect: String(data.aspect || "16:9"),
			duration: clampDuration(data.duration),
			audio: data.audio !== false,
			nsfw: Boolean(data.nsfw),
			seed: Number.isFinite(Number(data.seed)) ? Number(data.seed) : 1,
			count: Number(data.count || 1),
			jobs: Array.isArray(data.jobs) ? data.jobs : [],
			logs: Array.isArray(data.logs) ? data.logs : [],
			activeJobId: data.activeJobId ?? null,
			seedHits: Array.isArray(data.seedHits) ? data.seedHits : [],
			seedProfiles: Array.isArray(data.seedProfiles) ? data.seedProfiles : [],
			promptHits: Array.isArray(data.promptHits) ? data.promptHits : [],
			promptCollections: Array.isArray(data.promptCollections) ? data.promptCollections : [],
			assistA: data.assistA && data.assistA.login ? data.assistA : null,
			assistB: data.assistB && data.assistB.login ? data.assistB : null,
			folds: data.folds && typeof data.folds === "object" ? data.folds : {},
			promptSlots: Array.isArray(data.promptSlots) && data.promptSlots.length ? data.promptSlots : [{
				id: "slot-1",
				raw: String(data.promptRaw || ""),
				flat: String(data.promptFlat || "")
			}],
			activePromptId: data.activePromptId ? String(data.activePromptId) : "slot-1",
			keysVisible: data.keysVisible !== false,
			hallPath: String(data.hallPath || "Dark Horse/Кинозал"),
			refsPath: String(data.refsPath || "Dark Horse/Референсы"),
			mediaStash: data.mediaStash && typeof data.mediaStash === "object" ? data.mediaStash : { image: [], video: [] },
			seedHits: Array.isArray(data.seedHits) ? data.seedHits.slice(0, 10) : [],
			promptHits: Array.isArray(data.promptHits) ? data.promptHits.slice(0, 10) : []
		};
	} catch {
		return null;
	}
}
function writePersisted(data) {
	const safe = storageSafe(data);
	writeSettings(safe);
	try {
		localStorage.setItem(KEY, JSON.stringify(safe));
	} catch {
		try {
			const slim = {
				...safe,
				first: safe.first ? { ...safe.first, thumb: void 0 } : null,
				last: safe.last ? { ...safe.last, thumb: void 0 } : null,
				refImages: (safe.refImages || []).map((x) => ({ ...x, thumb: void 0 })),
				refVideos: (safe.refVideos || []).map((x) => ({ ...x, thumb: void 0 })),
				refAudios: (safe.refAudios || []).map((x) => ({ ...x, thumb: void 0 })),
				refFiles: (safe.refFiles || []).map((x) => ({ ...x, thumb: void 0 })),
				refAssets: (safe.refAssets || []).map((x) => ({ ...x, thumb: void 0 }))
			};
			localStorage.setItem(KEY, JSON.stringify(slim));
		} catch {}
	}
}
function clearPersisted() {
	try {
		localStorage.removeItem(KEY);
		localStorage.removeItem(SETTINGS_KEY);
	} catch {}
}
function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 2);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
			if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error || /* @__PURE__ */ new Error("IndexedDB"));
	});
}
async function listClips() {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
		req.onsuccess = () => {
			const rows = req.result || [];
			rows.sort((a, b) => b.createdAt - a.createdAt);
			resolve(rows);
		};
		req.onerror = () => reject(req.error);
	});
}
async function saveClip(clip) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(clip);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
async function deleteClip(id) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
async function saveFile(id, blob) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(FILES, "readwrite");
		tx.objectStore(FILES).put(blob, id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
async function getFile(id) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(FILES, "readonly").objectStore(FILES).get(id);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}
async function deleteFile(id) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(FILES, "readwrite");
		tx.objectStore(FILES).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
var liveUrls = /* @__PURE__ */ new Map();
async function localUrl(id) {
	const hit = liveUrls.get(id);
	if (hit) return hit;
	const blob = await getFile(id);
	if (!blob) return null;
	const url = URL.createObjectURL(blob);
	liveUrls.set(id, url);
	return url;
}
function dropLocalUrl(id) {
	const url = liveUrls.get(id);
	if (url) URL.revokeObjectURL(url);
	liveUrls.delete(id);
}
async function wipeClips() {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction([STORE, FILES], "readwrite");
		tx.objectStore(STORE).clear();
		tx.objectStore(FILES).clear();
		tx.oncomplete = () => {
			for (const url of liveUrls.values()) URL.revokeObjectURL(url);
			liveUrls.clear();
			resolve();
		};
		tx.onerror = () => reject(tx.error);
	});
}
function useClipSrc(clip) {
	const remote = clip.remoteUrl;
	const [src, setSrc] = (0, React.useState)(clip.local ? "" : remote);
	(0, React.useEffect)(() => {
		let dead = false;
		if (!clip.local) {
			setSrc(remote);
			return;
		}
		localUrl(clip.id).then((url) => {
			if (!dead) setSrc(url || remote);
		});
		return () => {
			dead = true;
		};
	}, [
		clip.id,
		clip.local,
		remote
	]);
	return src;
}
async function proxyJson(op, token, body) {
	try {
		const res = await fetch(`/api/kie?op=${op}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-kie-token": token
			},
			body: JSON.stringify(body ?? {})
		});
		if (!res.ok && res.status >= 500) return null;
		const data = await res.json();
		if (typeof data?.jsonText === "string") return data;
		return null;
	} catch {
		return null;
	}
}
async function createTask(token, payload) {
	const proxied = await proxyJson("create", token, { payload });
	if (proxied) return proxied;
	const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(payload)
	});
	return {
		httpStatus: res.status,
		jsonText: await res.text()
	};
}
async function getTask(token, taskId) {
	const proxied = await proxyJson("poll", token, { taskId });
	if (proxied) return proxied;
	const url = new URL("https://api.kie.ai/api/v1/jobs/recordInfo");
	url.searchParams.set("taskId", taskId);
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	return {
		httpStatus: res.status,
		jsonText: await res.text()
	};
}
async function uploadFile(token, file) {
	const fd = new FormData();
	fd.append("file", file, file.name);
	try {
		const res = await fetch("/api/kie?op=upload", {
			method: "POST",
			headers: { "x-kie-token": token },
			body: fd
		});
		const data = await res.json();
		if (data.ok && data.url) return data.url;
		if (data.error && res.status !== 413 && res.status < 500) {}
	} catch {}
	const direct = new FormData();
	direct.append("file", file, file.name);
	direct.append("uploadPath", "images/user-uploads");
	direct.append("fileName", file.name);
	const res = await fetch("https://kieai.redpandaai.co/api/file-stream-upload", {
		method: "POST",
		headers: { Authorization: `Bearer ${token}` },
		body: direct
	});
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(text.slice(0, 240) || `HTTP ${res.status}`);
	}
	const url = pickDownloadUrl(json);
	if (!url) {
		const rec = json;
		const msg = rec.msg || rec.message || rec.error;
		throw new Error(typeof msg === "string" ? msg : "Kie не вернул ссылку");
	}
	return url;
}
async function downloadVideo(url, token, filename) {
	const saveBlob = (blob) => {
		const a = document.createElement("a");
		const href = URL.createObjectURL(blob);
		a.href = href;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(href), 4e3);
	};
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		saveBlob(await res.blob());
		return;
	} catch {}
	const res = await fetch(`/api/kie?op=media&url=${encodeURIComponent(url)}`, { headers: { "x-kie-token": token } });
	if (!res.ok) throw new Error(`Не удалось скачать (HTTP ${res.status})`);
	saveBlob(await res.blob());
}
async function getCredit(token) {
	const res = await fetch("/api/kie?op=credit", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-kie-token": token
		},
		body: "{}"
	});
	const data = await res.json();
	if (!res.ok || !data.ok || typeof data.credits !== "number") throw new Error(data.error || "Баланс недоступен");
	return data.credits;
}
async function fetchVideoBlob(url, token) {
	try {
		const direct = await fetch(url);
		if (direct.ok) {
			const blob = await direct.blob();
			if (blob.size > 800) return blob;
		}
	} catch {}
	const res = await fetch(`/api/kie?op=media&url=${encodeURIComponent(url)}`, { headers: { "x-kie-token": token } });
	if (!res.ok) throw new Error(`Не удалось сохранить видео (HTTP ${res.status})`);
	const blob = await res.blob();
	if (blob.size < 800) throw new Error("Пустой файл");
	return blob;
}
function mediaProxySrc(url, token) {
	return `/api/kie?op=media&url=${encodeURIComponent(url)}&t=${encodeURIComponent(token)}`;
}
async function thumbFromFile(file) {
	try {
		if (file.type.startsWith("image/")) {
			const bmp = await createImageBitmap(file);
			return draw(bmp, bmp.width, bmp.height);
		}
		if (file.type.startsWith("video/")) {
			const url = URL.createObjectURL(file);
			try {
				return await frameFromUrl(url);
			} finally {
				URL.revokeObjectURL(url);
			}
		}
	} catch {
		return "";
	}
	return "";
}
async function thumbFromVideoBlob(blob) {
	const url = URL.createObjectURL(blob);
	try {
		return await frameFromUrl(url);
	} catch {
		return "";
	} finally {
		URL.revokeObjectURL(url);
	}
}
async function frameFromUrl(url) {
	const video = document.createElement("video");
	video.src = url;
	video.muted = true;
	video.playsInline = true;
	video.preload = "auto";
	await new Promise((resolve, reject) => {
		video.onloadeddata = () => resolve();
		video.onerror = () => reject(/* @__PURE__ */ new Error("video"));
	});
	const target = Math.min(.2, Math.max(.05, (video.duration || 1) * .04));
	await new Promise((resolve) => {
		const done = () => resolve();
		video.onseeked = done;
		try {
			video.currentTime = target;
		} catch {
			resolve();
		}
		window.setTimeout(resolve, 700);
	});
	return draw(video, video.videoWidth, video.videoHeight);
}
function draw(source, sw, sh) {
	const scale = Math.min(1, 320 / Math.max(sw || 1, sh || 1));
	const w = Math.max(1, Math.round((sw || 1) * scale));
	const h = Math.max(1, Math.round((sh || 1) * scale));
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) return "";
	ctx.drawImage(source, 0, 0, w, h);
	return canvas.toDataURL("image/jpeg", .72);
}
var SEED_MAX = 2147483647;
var RESOLUTIONS = [
	"480P",
	"720P",
	"1080P"
];
var ASPECTS = [
	"16:9",
	"1:1",
	"3:4",
	"4:3",
	"9:16"
];
var persistTimer = 0;
var polling = false;
function clampSeed(n) {
	if (!Number.isFinite(n)) return 1;
	return Math.min(SEED_MAX, Math.max(0, Math.floor(n)));
}
function snapshotOf(s) {
	return {
		promptRaw: s.promptRaw,
		promptFlat: s.promptFlat,
		model: s.model.trim() || "wan/3-0-video",
		resolution: s.resolution,
		aspect: s.aspect,
		duration: s.duration,
		audio: s.audio,
		nsfw: s.nsfw
	};
}
function persistedSlice(s) {
	return {
		token: s.token,
		apiKeys: s.apiKeys,
		activeKeyId: s.activeKeyId,
		theme: s.theme,
		albums: s.albums,
		lastAlbumId: s.lastAlbumId,
		refFolders: s.refFolders,
		refAssets: s.refAssets,
		model: s.model,
		promptRaw: s.promptRaw,
		promptFlat: s.promptFlat,
		first: s.first,
		last: s.last,
		refImages: s.refImages,
		refVideos: s.refVideos,
		refAudios: s.refAudios,
		refFiles: s.refFiles,
		refLinks: s.refLinks,
		resolution: s.resolution,
		aspect: s.aspect,
		duration: s.duration,
		audio: s.audio,
		nsfw: s.nsfw,
		seed: s.seed,
		count: s.count,
		jobs: s.jobs.slice(0, 80),
		logs: s.logs.slice(0, 80),
		activeJobId: s.activeJobId,
		seedHits: s.seedHits.slice(0, 200),
		seedProfiles: s.seedProfiles,
		promptHits: s.promptHits.slice(0, 80),
		promptCollections: s.promptCollections,
		assistA: s.assistA,
		assistB: s.assistB,
		folds: s.folds,
		promptSlots: s.promptSlots,
		activePromptId: s.activePromptId,
		keysVisible: s.keysVisible,
		hallPath: s.hallPath,
		refsPath: s.refsPath,
		mediaStash: cleanStash(s.mediaStash),
		seedHits: s.seedHits.slice(0, 10),
		promptHits: s.promptHits.slice(0, 10)
	};
}
function schedulePersist() {
	if (!persistReady || typeof window === "undefined") return;
	window.clearTimeout(persistTimer);
	persistTimer = window.setTimeout(() => {
		writePersisted(persistedSlice(useDH.getState()));
	}, 160);
}
function flushPersist() {
	if (!persistReady || typeof window === "undefined") return;
	window.clearTimeout(persistTimer);
	writePersisted(persistedSlice(useDH.getState()));
}
var initial = {
	token: "",
	apiKeys: [{
		id: "key-1",
		token: ""
	}],
	activeKeyId: "key-1",
	theme: DEFAULT_THEME,
	albums: [],
	lastAlbumId: null,
	refFolders: [],
	refAssets: [],
	model: "wan/3-0-video",
	promptRaw: "",
	promptFlat: "",
	first: null,
	last: null,
	refImages: [],
	refVideos: [],
	refAudios: [],
	refFiles: [],
	refLinks: [],
	resolution: "480P",
	aspect: "16:9",
	duration: 8,
	audio: true,
	nsfw: false,
	seed: 1,
	count: 1,
	jobs: [],
	logs: [],
	activeJobId: null,
	seedHits: [],
	seedProfiles: [],
	promptHits: [],
	promptCollections: [],
	assistA: null,
	assistB: null,
	folds: {},
	promptSlots: [{ id: "slot-1", raw: "", flat: "" }],
	activePromptId: "slot-1",
	keysVisible: true,
	hallPath: "Dark Horse/Кинозал",
	refsPath: "Dark Horse/Референсы",
	mediaStash: { image: [], video: [] },
	view: "desk",
	sending: false,
	busyUploads: 0,
	clips: [],
	clipsReady: false,
	selectedSeedProfile: null,
	selectedPromptCollection: null,
	credits: {}
};
function buildPayload(s, seed) {
	return {
		model: s.model.trim() || "wan/3-0-video",
		input: {
			prompt: s.promptFlat,
			first_frame_url: s.first?.url?.trim() || null,
			last_frame_url: s.last?.url?.trim() || null,
			reference_image_urls: s.refImages.map((x) => x.url.trim()).filter(Boolean),
			reference_video_urls: s.refVideos.map((x) => x.url.trim()).filter(Boolean),
			reference_audio_urls: s.refAudios.map((x) => x.url.trim()).filter(Boolean),
			reference_link_urls: s.refLinks.map((x) => x.url.trim()).filter(Boolean),
			reference_file_urls: s.refFiles.map((x) => x.url.trim()).filter(Boolean),
			resolution: s.resolution,
			aspect_ratio: s.aspect,
			duration: s.duration,
			audio: s.audio,
			nsfw_checker: s.nsfw,
			seed
		}
	};
}
var useDH = create((set, get) => {
	const commit = (partial, persist = true) => {
		set(partial);
		if (persist) schedulePersist();
	};
	const pushLog = (kind, text) => {
		const line = {
			id: uid(),
			at: Date.now(),
			kind,
			text
		};
		set((s) => ({ logs: [line, ...s.logs].slice(0, 80) }));
		schedulePersist();
	};
	return {
		...initial,
		hydrate: () => {
			const data = readPersisted();
			if (!data) {
				set({ seed: Math.floor(Math.random() * SEED_MAX) + 1 });
				persistReady = true;
				return;
			}
			const jobs = data.jobs.map((j) => j.state === "sending" && !j.taskId ? {
				...j,
				state: "error",
				message: "Прервано перезагрузкой"
			} : j);
			set({
				...data,
				duration: clampDuration(data.duration),
				jobs,
				selectedSeedProfile: data.seedProfiles[0]?.id ?? null,
				selectedPromptCollection: data.promptCollections[0]?.id ?? null
			});
			persistReady = true;
			get().loadClips();
		},
		setView: (view) => set({ view }),
		patch: (partial) => commit(partial),
		setToken: (token) => {
			const activeKeyId = get().activeKeyId;
			const apiKeys = get().apiKeys.map((k) => k.id === activeKeyId ? {
				...k,
				token
			} : k);
			commit({
				token,
				apiKeys
			});
		},
		addApiKey: () => {
			const slot = {
				id: uid(),
				token: ""
			};
			set((s) => ({ apiKeys: [...s.apiKeys, slot] }));
			schedulePersist();
		},
		setApiKeyToken: (id, token) => {
			const apiKeys = get().apiKeys.map((k) => k.id === id ? {
				...k,
				token
			} : k);
			const active = apiKeys.find((k) => k.id === get().activeKeyId)?.token || "";
			commit({
				apiKeys,
				token: active
			});
		},
		selectApiKey: (id) => {
			const slot = get().apiKeys.find((k) => k.id === id);
			if (!slot) return;
			commit({
				activeKeyId: id,
				token: slot.token
			});
		},
		clearApiKey: (id) => {
			const apiKeys = get().apiKeys.map((k) => k.id === id ? {
				...k,
				token: ""
			} : k);
			const active = apiKeys.find((k) => k.id === get().activeKeyId)?.token || "";
			commit({
				apiKeys,
				token: active
			});
			set((s) => {
				const credits = { ...s.credits };
				delete credits[id];
				return { credits };
			});
		},
		removeApiKey: (id) => {
			const cur = get();
			if (cur.apiKeys.length <= 1) {
				get().clearApiKey(id);
				return;
			}
			const apiKeys = cur.apiKeys.filter((k) => k.id !== id);
			const activeKeyId = cur.activeKeyId === id ? apiKeys[0].id : cur.activeKeyId;
			const token = apiKeys.find((k) => k.id === activeKeyId)?.token || "";
			commit({
				apiKeys,
				activeKeyId,
				token
			});
		},
		refreshCredits: async () => {
			const keys = get().apiKeys.filter((k) => k.token.trim());
			await Promise.all(keys.map(async (k) => {
				try {
					const value = await getCredit(k.token.trim());
					set((s) => ({ credits: {
						...s.credits,
						[k.id]: { value }
					} }));
				} catch (error) {
					const message = error instanceof Error ? error.message : "ошибка";
					set((s) => ({ credits: {
						...s.credits,
						[k.id]: {
							value: s.credits[k.id]?.value ?? null,
							error: message
						}
					} }));
				}
			}));
		},
		setTheme: (partial) => {
			commit({ theme: {
				...get().theme,
				...partial
			} });
		},
		createAlbum: (name) => {
			const album = {
				id: uid(),
				name: name.trim() || "Без названия",
				createdAt: Date.now()
			};
			set((s) => ({
				albums: [album, ...s.albums],
				lastAlbumId: album.id
			}));
			schedulePersist();
			return album.id;
		},
		renameAlbum: (id, name) => {
			const next = name.trim();
			if (!next) return;
			set((s) => ({ albums: s.albums.map((a) => a.id === id ? {
				...a,
				name: next
			} : a) }));
			schedulePersist();
		},
		deleteAlbum: async (id) => {
			const doomed = get().clips.filter((c) => c.albumId === id);
			for (const clip of doomed) {
				dropLocalUrl(clip.id);
				try {
					await deleteClip(clip.id);
					await deleteFile(clip.id);
				} catch {}
			}
			set((s) => ({
				albums: s.albums.filter((a) => a.id !== id),
				clips: s.clips.filter((c) => c.albumId !== id),
				lastAlbumId: s.lastAlbumId === id ? s.albums.find((a) => a.id !== id)?.id ?? null : s.lastAlbumId
			}));
			schedulePersist();
		},
		clearHall: async () => {
			const doomed = get().clips.filter((c) => c.shelf === "hall");
			for (const clip of doomed) {
				dropLocalUrl(clip.id);
				try {
					await deleteClip(clip.id);
					await deleteFile(clip.id);
				} catch {}
			}
			set((s) => ({
				albums: [],
				clips: s.clips.filter((c) => c.shelf !== "hall"),
				lastAlbumId: null
			}));
			schedulePersist();
		},
		clearAlbumClips: async (albumId) => {
			const doomed = get().clips.filter((c) => c.albumId === albumId);
			for (const clip of doomed) {
				dropLocalUrl(clip.id);
				try {
					await deleteClip(clip.id);
					await deleteFile(clip.id);
				} catch {}
			}
			set((s) => ({ clips: s.clips.filter((c) => c.albumId !== albumId) }));
			schedulePersist();
		},
		saveClipToAlbum: async (clipId, albumId) => {
			const clip = get().clips.find((c) => c.id === clipId);
			if (!clip) return;
			const next = {
				...clip,
				shelf: "hall",
				albumId
			};
			await saveClip(next);
			set((s) => ({
				clips: s.clips.map((c) => c.id === clipId ? next : c),
				lastAlbumId: albumId
			}));
			schedulePersist();
		},
		createRefFolder: (name) => {
			const folder = {
				id: uid(),
				name: name.trim() || "Без названия",
				createdAt: Date.now()
			};
			set((s) => ({ refFolders: [folder, ...s.refFolders] }));
			schedulePersist();
			return folder.id;
		},
		renameRefFolder: (id, name) => {
			const next = name.trim();
			if (!next) return;
			set((s) => ({ refFolders: s.refFolders.map((f) => f.id === id ? {
				...f,
				name: next
			} : f) }));
			schedulePersist();
		},
		deleteRefFolder: async (id) => {
			const doomed = get().refAssets.filter((a) => a.folderId === id);
			for (const asset of doomed) {
				dropLocalUrl(`ref-${asset.id}`);
				try {
					await deleteFile(`ref-${asset.id}`);
				} catch {}
			}
			set((s) => ({
				refFolders: s.refFolders.filter((f) => f.id !== id),
				refAssets: s.refAssets.filter((a) => a.folderId !== id)
			}));
			schedulePersist();
		},
		addRefAsset: async (folderId, file) => {
			const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image";
			const id = uid();
			await saveFile(`ref-${id}`, file);
			const thumb = await thumbFromFile(file);
			const asset = {
				id,
				folderId,
				name: file.name || "Файл",
				kind,
				createdAt: Date.now(),
				thumb: thumb || void 0
			};
			set((s) => ({ refAssets: [asset, ...s.refAssets] }));
			schedulePersist();
		},
		deleteRefAsset: async (id) => {
			dropLocalUrl(`ref-${id}`);
			try {
				await deleteFile(`ref-${id}`);
			} catch {}
			set((s) => ({ refAssets: s.refAssets.filter((a) => a.id !== id) }));
			schedulePersist();
		},
		clearRefs: async () => {
			const all = get().refAssets;
			for (const asset of all) {
				dropLocalUrl(`ref-${asset.id}`);
				try {
					await deleteFile(`ref-${asset.id}`);
				} catch {}
			}
			set({
				refFolders: [],
				refAssets: []
			});
			schedulePersist();
		},
		clearRefFolderAssets: async (folderId) => {
			const doomed = get().refAssets.filter((a) => a.folderId === folderId);
			for (const asset of doomed) {
				dropLocalUrl(`ref-${asset.id}`);
				try {
					await deleteFile(`ref-${asset.id}`);
				} catch {}
			}
			set((s) => ({ refAssets: s.refAssets.filter((a) => a.folderId !== folderId) }));
			schedulePersist();
		},
		setModel: (model) => commit({ model }),
		setPrompt: (raw) => {
			const s = get();
			const slots = (s.promptSlots?.length ? s.promptSlots : [{ id: "slot-1", raw: "", flat: "" }]).map((p) => p.id === (s.activePromptId || "slot-1") ? {
				...p,
				raw,
				flat: flattenPrompt(raw)
			} : p);
			const active = slots.find((p) => p.id === s.activePromptId) || slots[0];
			commit({
				promptSlots: slots,
				promptRaw: active.raw,
				promptFlat: active.flat
			});
		},
		addPromptSlot: () => {
			const id = uid();
			const s = get();
			const slots = [...(s.promptSlots?.length ? s.promptSlots : [{ id: "slot-1", raw: s.promptRaw, flat: s.promptFlat }]), { id, raw: "", flat: "" }];
			commit({ promptSlots: slots });
		},
		removePromptSlot: (id) => {
			const s = get();
			let slots = (s.promptSlots || []).filter((p) => p.id !== id);
			if (!slots.length) slots = [{ id: "slot-1", raw: "", flat: "" }];
			const active = slots.find((p) => p.id === s.activePromptId) || slots[0];
			commit({
				promptSlots: slots,
				activePromptId: active.id,
				promptRaw: active.raw,
				promptFlat: active.flat
			});
		},
		selectPromptSlot: (id) => {
			const s = get();
			const active = (s.promptSlots || []).find((p) => p.id === id);
			if (!active) return;
			commit({
				activePromptId: id,
				promptRaw: active.raw,
				promptFlat: active.flat
			});
		},
		toggleFold: (id) => commit({ folds: { ...get().folds, [id]: !get().folds?.[id] } }),
		setKeysVisible: (keysVisible) => commit({ keysVisible }),
		setLibraryPath: (kind, value) => commit(kind === "hall" ? { hallPath: value } : { refsPath: value }),
		setMediaStash: (kind, items) => commit({ mediaStash: { ...get().mediaStash, [kind]: items } }),
		setFirst: (first) => commit({ first }),
		setLast: (last) => commit({ last }),
		setList: (key, items) => commit({ [key]: items }),
		setLinks: (refLinks) => commit({ refLinks }),
		bumpUploads: (delta) => set((s) => ({ busyUploads: Math.max(0, s.busyUploads + delta) })),
		setResolution: (resolution) => commit({ resolution }),
		setAspect: (aspect) => commit({ aspect }),
		setDuration: (duration) => {
			const next = clampDuration(duration);
			commit({ duration: next });
			writeSettings({ ...persistedSlice({ ...get(), duration: next }), duration: next });
		},
		setCount: (count) => commit({ count }),
		setAudio: (audio) => commit({ audio }),
		setNsfw: (nsfw) => commit({ nsfw }),
		setSeed: (seed) => commit({ seed: clampSeed(seed) }),
		randomSeed: () => commit({ seed: Math.floor(Math.random() * SEED_MAX) + 1 }),
		pushLog,
		clearLog: () => commit({ logs: [] }),
		clearJobs: () => commit({
			jobs: [],
			activeJobId: null
		}),
		setActiveJob: (activeJobId) => {
			set({ activeJobId });
			schedulePersist();
		},
		sendBatch: async () => {
			const s = get();
			if (s.sending) return;
			if (!s.token.trim()) {
				pushLog("err", "Вставьте API-ключ");
				return;
			}
			if (!s.model.trim()) {
				pushLog("err", "Укажите модель");
				return;
			}
			if (s.busyUploads > 0) {
				pushLog("err", "Дождитесь окончания загрузки файлов");
				return;
			}
			const snap = snapshotOf(s);
			const launched = snap.promptFlat || snap.promptRaw ? [{
				id: uid(),
				raw: snap.promptRaw,
				flat: snap.promptFlat,
				createdAt: Date.now()
			}, ...s.promptHits].slice(0, 10) : s.promptHits;
			const batchToken = s.token.trim();
			const count = Math.min(20, Math.max(1, s.count));
			const fresh = Array.from({ length: count }, (_, i) => ({
				id: uid(),
				index: i + 1,
				seed: (clampSeed(s.seed) + i) % (SEED_MAX + 1),
				state: "sending",
				message: "Отправка createTask",
				token: batchToken,
				createdAt: Date.now(),
				snap
			}));
			set({
				sending: true,
				jobs: [...fresh, ...s.jobs].slice(0, 80),
				promptHits: launched,
				activeJobId: fresh[0]?.id ?? s.activeJobId,
				view: typeof window !== "undefined" && window.innerWidth <= 980 ? "stage" : s.view
			});
			schedulePersist();
			pushLog("info", `Пачка из ${fresh.length} · ${snap.model}`);
			await Promise.all(fresh.map(async (job) => {
				try {
					const res = await createTask(batchToken, buildPayload(get(), job.seed));
					const json = parseJson(res.jsonText);
					const code = typeof json.code === "number" ? json.code : res.httpStatus;
					const data = json.data && typeof json.data === "object" ? json.data : {};
					const taskId = typeof data.taskId === "string" ? data.taskId : "";
					if (res.httpStatus >= 400 || code !== 200 || !taskId) {
						const message = messageFromKie(json, `HTTP ${res.httpStatus}`);
						set((st) => ({ jobs: st.jobs.map((j) => j.id === job.id ? {
							...j,
							state: "error",
							message
						} : j) }));
						pushLog("err", `#${job.index} отказ: ${message}`);
						return;
					}
					set((st) => ({ jobs: st.jobs.map((j) => j.id === job.id ? {
						...j,
						state: "waiting",
						taskId,
						message: `Принято · ${taskId}`
					} : j) }));
					pushLog("ok", `#${job.index} принят · ${taskId} · seed=${job.seed}`);
				} catch (error) {
					const message = error instanceof Error ? error.message : "Сеть";
					set((st) => ({ jobs: st.jobs.map((j) => j.id === job.id ? {
						...j,
						state: "error",
						message
					} : j) }));
					pushLog("err", `#${job.index} сбой: ${message}`);
				}
			}));
			set({ sending: false });
			schedulePersist();
		},
		poll: async () => {
			if (polling) return;
			if (typeof document !== "undefined" && document.hidden) return;
			const active = get().jobs.filter((j) => [
				"waiting",
				"queuing",
				"generating",
				"sending"
			].includes(j.state) && j.taskId);
			if (!active.length) return;
			polling = true;
			try {
				await Promise.all(active.map(async (job) => {
					const token = (job.token || get().token || "").trim();
					if (!token || !job.taskId) return;
					try {
						const res = await getTask(token, job.taskId);
						const json = parseJson(res.jsonText);
						const code = typeof json.code === "number" ? json.code : res.httpStatus;
						const data = json.data && typeof json.data === "object" ? json.data : {};
						if (code !== 200 && !data.state) {
							pushLog("err", `#${job.index} статус: ${messageFromKie(json, "нет ответа")}`);
							return;
						}
						const st = typeof data.state === "string" ? data.state : job.state;
						if (st === "success") {
							const videoUrl = extractVideoUrls(data.resultJson)[0];
							const message = videoUrl ? "Видео готово" : "Готово, но ссылка не найдена";
							let shouldArchive = false;
							set((cur) => ({ jobs: cur.jobs.map((j) => {
								if (j.id !== job.id) return j;
								if (!j.archived && videoUrl) shouldArchive = true;
								return {
									...j,
									state: "success",
									videoUrl: videoUrl || j.videoUrl,
									message,
									archived: j.archived || Boolean(videoUrl)
								};
							}) }));
							pushLog("ok", `#${job.index} готово${videoUrl ? "" : " без URL"}`);
							if (shouldArchive && videoUrl) {
								const hit = {
									id: uid(),
									seed: job.seed,
									promptRaw: job.snap.promptRaw,
									promptFlat: job.snap.promptFlat,
									model: job.snap.model,
									createdAt: Date.now(),
									taskId: job.taskId
								};
								set((cur) => {
									return cur.seedHits.some((h) => h.seed === hit.seed && h.promptFlat === hit.promptFlat && h.taskId === hit.taskId) ? cur : { seedHits: [hit, ...cur.seedHits].slice(0, 10) };
								});
								const clip = {
									id: job.id,
									createdAt: Date.now(),
									promptRaw: job.snap.promptRaw,
									promptFlat: job.snap.promptFlat,
									seed: job.seed,
									model: job.snap.model,
									resolution: job.snap.resolution,
									aspect: job.snap.aspect,
									duration: job.snap.duration,
									audio: job.snap.audio,
									nsfw: job.snap.nsfw,
									taskId: job.taskId || "",
									remoteUrl: videoUrl,
									filename: `dark-horse-${job.seed}-${job.index}.mp4`,
									shelf: "inbox"
								};
								try {
									await saveClip(clip);
									set((cur) => ({ clips: [clip, ...cur.clips.filter((c) => c.id !== clip.id)] }));
									pushLog("ok", `#${job.index} в архиве программы`);
									(async () => {
										try {
											const blob = await fetchVideoBlob(videoUrl, token);
											await saveFile(clip.id, blob);
											let thumb = clip.thumb;
											try {
												const shot = await thumbFromVideoBlob(blob);
												if (shot) thumb = shot;
											} catch {}
											await saveClip({
												...clip,
												local: true,
												thumb
											});
											set((cur) => ({ clips: cur.clips.map((c) => c.id === clip.id ? {
												...c,
												local: true,
												thumb
											} : c) }));
										} catch {
											pushLog("info", `#${job.index} локальная копия не сохранилась — в архиве осталась ссылка`);
										}
										get().refreshCredits();
									})();
								} catch {
									pushLog("info", `#${job.index} не удалось сохранить в архив`);
								}
							}
						} else if (st === "fail") {
							const message = typeof data.failMsg === "string" && data.failMsg || messageFromKie(json, "генерация отклонена");
							set((cur) => ({ jobs: cur.jobs.map((j) => j.id === job.id ? {
								...j,
								state: "fail",
								message
							} : j) }));
							pushLog("err", `#${job.index} ошибка: ${message}`);
						} else if (st === "waiting" || st === "queuing" || st === "generating") {
							const message = st === "generating" ? "Модель рисует кадры" : st === "queuing" ? "В очереди Kie" : "Ожидание слота";
							set((cur) => ({ jobs: cur.jobs.map((j) => j.id === job.id ? {
								...j,
								state: st,
								message
							} : j) }));
						}
					} catch (error) {
						const message = error instanceof Error ? error.message : "сеть";
						pushLog("err", `#${job.index} опрос: ${message}`);
					}
				}));
				schedulePersist();
			} finally {
				polling = false;
			}
		},
		loadClips: async () => {
			try {
				set({
					clips: await listClips(),
					clipsReady: true
				});
			} catch {
				set({ clipsReady: true });
			}
		},
		removeClip: async (id) => {
			dropLocalUrl(id);
			await deleteClip(id);
			try {
				await deleteFile(id);
			} catch {}
			set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
		},
		clearArchive: async () => {
			const inbox = get().clips.filter((c) => (c.shelf ?? "inbox") !== "hall");
			for (const clip of inbox) {
				dropLocalUrl(clip.id);
				try {
					await deleteClip(clip.id);
					await deleteFile(clip.id);
				} catch {}
			}
			set((s) => ({ clips: s.clips.filter((c) => (c.shelf ?? "inbox") === "hall") }));
		},
		updateClipThumb: async (id, thumb) => {
			const clip = get().clips.find((c) => c.id === id);
			if (!clip || clip.thumb === thumb) return;
			const next = {
				...clip,
				thumb
			};
			set((s) => ({ clips: s.clips.map((c) => c.id === id ? next : c) }));
			try {
				await saveClip(next);
			} catch {}
		},
		createSeedProfile: (name) => {
			const id = uid();
			const profile = {
				id,
				name: name.trim() || "Без названия",
				createdAt: Date.now(),
				items: []
			};
			set((s) => ({
				seedProfiles: [profile, ...s.seedProfiles],
				selectedSeedProfile: id
			}));
			schedulePersist();
			return id;
		},
		renameSeedProfile: (id, name) => {
			set((s) => ({ seedProfiles: s.seedProfiles.map((p) => p.id === id ? {
				...p,
				name: name.trim() || p.name
			} : p) }));
			schedulePersist();
		},
		deleteSeedProfile: (id) => {
			set((s) => ({
				seedProfiles: s.seedProfiles.filter((p) => p.id !== id),
				selectedSeedProfile: s.selectedSeedProfile === id ? s.seedProfiles.find((p) => p.id !== id)?.id ?? null : s.selectedSeedProfile
			}));
			schedulePersist();
		},
		addSeeds: (profileId, drafts) => {
			set((s) => ({ seedProfiles: s.seedProfiles.map((p) => {
				if (p.id !== profileId) return p;
				const items = [...p.items];
				for (const d of drafts) {
					if (items.some((it) => it.seed === d.seed && it.promptFlat === d.promptFlat)) continue;
					const item = {
						id: uid(),
						seed: d.seed,
						promptFlat: d.promptFlat,
						promptRaw: d.promptRaw,
						addedAt: Date.now()
					};
					items.unshift(item);
				}
				return {
					...p,
					items
				};
			}) }));
			schedulePersist();
		},
		removeSeedItem: (profileId, itemId) => {
			set((s) => ({ seedProfiles: s.seedProfiles.map((p) => p.id === profileId ? {
				...p,
				items: p.items.filter((it) => it.id !== itemId)
			} : p) }));
			schedulePersist();
		},
		clearSeedHits: () => commit({ seedHits: [] }),
		selectSeedProfile: (selectedSeedProfile) => set({ selectedSeedProfile }),
		createPromptCollection: (name) => {
			const id = uid();
			const col = {
				id,
				name: name.trim() || "Без названия",
				createdAt: Date.now(),
				items: []
			};
			set((s) => ({
				promptCollections: [col, ...s.promptCollections],
				selectedPromptCollection: id
			}));
			schedulePersist();
			return id;
		},
		renamePromptCollection: (id, name) => {
			set((s) => ({ promptCollections: s.promptCollections.map((p) => p.id === id ? {
				...p,
				name: name.trim() || p.name
			} : p) }));
			schedulePersist();
		},
		deletePromptCollection: (id) => {
			set((s) => ({
				promptCollections: s.promptCollections.filter((p) => p.id !== id),
				selectedPromptCollection: s.selectedPromptCollection === id ? s.promptCollections.find((p) => p.id !== id)?.id ?? null : s.selectedPromptCollection
			}));
			schedulePersist();
		},
		addPrompts: (collectionId, drafts) => {
			set((s) => ({ promptCollections: s.promptCollections.map((p) => {
				if (p.id !== collectionId) return p;
				const items = [...p.items];
				for (const d of drafts) {
					const flat = d.flat || flattenPrompt(d.raw);
					if (!flat && !d.raw.trim()) continue;
					if (items.some((it) => it.flat === flat && flat)) continue;
					const item = {
						id: uid(),
						raw: d.raw,
						flat,
						addedAt: Date.now()
					};
					items.unshift(item);
				}
				return {
					...p,
					items
				};
			}) }));
			schedulePersist();
		},
		updatePromptItem: (collectionId, itemId, raw) => {
			const flat = flattenPrompt(raw);
			set((s) => ({ promptCollections: s.promptCollections.map((p) => p.id !== collectionId ? p : {
				...p,
				items: p.items.map((it) => it.id === itemId ? {
					...it,
					raw,
					flat
				} : it)
			}) }));
			schedulePersist();
		},
		removePromptItem: (collectionId, itemId) => {
			set((s) => ({ promptCollections: s.promptCollections.map((p) => p.id === collectionId ? {
				...p,
				items: p.items.filter((it) => it.id !== itemId)
			} : p) }));
			schedulePersist();
		},
		clearPromptHits: () => commit({ promptHits: [] }),
		selectPromptCollection: (selectedPromptCollection) => set({ selectedPromptCollection }),
		applySeed: (seed) => {
			commit({ seed: clampSeed(seed) });
			set({ view: "desk" });
		},
		applyPrompt: (raw, flat) => {
			commit({
				promptRaw: raw,
				promptFlat: flat ?? flattenPrompt(raw)
			});
			set({ view: "desk" });
		},
		setAssist: (which, value) => {
			if (which === "both") commit({
				assistA: value,
				assistB: value
			});
			else if (which === "A") commit({ assistA: value });
			else commit({ assistB: value });
		},
		playRemote: (clip) => {
			(async () => {
				let videoUrl = clip.remoteUrl;
				if (clip.local) {
					const local = await localUrl(clip.id);
					if (local) videoUrl = local;
				}
				const job = {
					id: uid(),
					index: 0,
					seed: clip.seed,
					state: "success",
					message: clip.shelf === "hall" ? "Из кинозала" : "Из архива",
					token: get().token,
					videoUrl,
					createdAt: Date.now(),
					snap: {
						promptRaw: clip.promptRaw,
						promptFlat: clip.promptFlat,
						model: clip.model,
						resolution: clip.resolution,
						aspect: clip.aspect,
						duration: clip.duration,
						audio: clip.audio,
						nsfw: clip.nsfw
					},
					archived: true
				};
				set((s) => ({
					jobs: [job, ...s.jobs].slice(0, 80),
					activeJobId: job.id,
					view: "desk"
				}));
				schedulePersist();
			})();
		},
		wipeAll: async () => {
			clearPersisted();
			try {
				await wipeClips();
			} catch {}
			set({
				...initial,
				seed: Math.floor(Math.random() * SEED_MAX) + 1,
				clipsReady: true
			});
		}
	};
});
function activeVideoJob(s) {
	return s.jobs.find((j) => j.id === s.activeJobId && (j.videoUrl || j.state === "success")) || s.jobs.find((j) => j.videoUrl) || null;
}
async function downloadClip(clip) {
	if (clip.local) {
		const blob = await getFile(clip.id);
		if (blob) {
			const a = document.createElement("a");
			const href = URL.createObjectURL(blob);
			a.href = href;
			a.download = clip.filename;
			a.click();
			setTimeout(() => URL.revokeObjectURL(href), 4e3);
			return;
		}
	}
	await downloadVideo(clip.remoteUrl, useDH.getState().token, clip.filename);
}
async function keepInHall(clip) {
	const s = useDH.getState();
	const last = s.lastAlbumId;
	const ordered = [...s.albums].sort((a, b) => a.id === last ? -1 : b.id === last ? 1 : 0);
	const picked = await pickDialog({
		title: "Сохранить в кинозал",
		body: last ? "Последний альбом уже отмечен. Оставьте его, выберите другой или впишите новое имя." : "Выберите альбом или создайте новый — ролик переедет из архива в эту папку.",
		options: ordered.map((a) => ({
			id: a.id,
			label: a.name,
			hint: a.id === last ? "последний" : `${s.clips.filter((c) => c.albumId === a.id).length}`
		})),
		createLabel: "Создать альбом",
		selectedId: last || void 0
	});
	if (!picked) return;
	const albumId = picked.type === "new" ? useDH.getState().createAlbum(picked.name) : picked.id;
	await useDH.getState().saveClipToAlbum(clip.id, albumId);
	toast(`Сохранено в «${useDH.getState().albums.find((a) => a.id === albumId)?.name || "альбом"}»`);
}
function Archive() {
	const clips = useDH((s) => s.clips).filter((c) => (c.shelf ?? "inbox") !== "hall");
	const ready = useDH((s) => s.clipsReady);
	const loadClips = useDH((s) => s.loadClips);
	const [open, setOpen] = (0, React.useState)(null);
	(0, React.useEffect)(() => {
		if (!ready) loadClips();
	}, [ready, loadClips]);
	(0, React.useEffect)(() => {
		if (!open) return;
		const fresh = clips.find((c) => c.id === open.id);
		if (fresh && fresh !== open) setOpen(fresh);
	}, [clips, open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col archive-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "archive-head",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "empty-kicker",
						children: "Архив"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "archive-title-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Удачные генерации" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn primary",
							onClick: () => {
								(async () => {
									if (!await confirmDialog({
										title: "Очистить архив?",
										body: "Все ролики исчезнут из архива программы. Это нельзя отменить.",
										confirmLabel: "Очистить архив",
										danger: true
									})) return;
									await useDH.getState().clearArchive();
									useDH.getState().pushLog("ok", "Архив очищен");
									setOpen(null);
								})();
							},
							children: "Очистить архив"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "После удачной генерации ролик сам попадает сюда и хранится на этом устройстве. Его можно удалить или сохранить в альбом кинозала."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "archive-grid",
				children: [
					!ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Открываю архив…"
					}) : null,
					ready && clips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Пока пусто. После успешной генерации видео появится здесь."
					}) : null,
					clips.map((clip) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardMedia, {
							clip,
							onOpen: () => setOpen(clip)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "card-body",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: clip.promptFlat || clip.promptRaw || "Без промта" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mono meta-line",
									children: [
										"seed ",
										clip.seed,
										" · ",
										clip.resolution,
										" · ",
										clip.aspect,
										" · ",
										clip.duration,
										"с"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "card-actions",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn outline",
											onClick: () => setOpen(clip),
											children: "Профиль"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn primary",
											onClick: () => void keepInHall(clip).then(() => setOpen(null)),
											children: "В альбом"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn outline",
											onClick: () => {
												downloadClip(clip).catch((error) => {
													useDH.getState().pushLog("err", error instanceof Error ? error.message : "Не удалось скачать");
												});
											},
											children: "Скачать"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn outline",
											onClick: () => {
												(async () => {
													if (!await confirmDialog({
														title: "Удалить ролик?",
														body: "Файл исчезнет из архива и с этого устройства.",
														confirmLabel: "Удалить",
														danger: true
													})) return;
													await useDH.getState().removeClip(clip.id);
													if (open?.id === clip.id) setOpen(null);
												})();
											},
											children: "Удалить"
										})
									]
								})
							]
						})]
					}, clip.id))
				]
			}),
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipProfile, {
				clip: open,
				onClose: () => setOpen(null)
			}) : null
		]
	});
}
function CardMedia({ clip, onOpen }) {
	const src = useClipSrc(clip);
	const ref = (0, React.useRef)(null);
	const [visible, setVisible] = (0, React.useState)(false);
	(0, React.useEffect)(() => {
		const el = ref.current;
		if (!el || clip.thumb) return;
		const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { rootMargin: "200px" });
		io.observe(el);
		return () => io.disconnect();
	}, [clip.thumb]);
	const grab = (v) => {
		if (v.videoWidth < 2) return;
		try {
			const c = document.createElement("canvas");
			c.width = 320;
			c.height = Math.max(1, Math.round(320 * v.videoHeight / v.videoWidth));
			const ctx = c.getContext("2d");
			if (!ctx) return;
			ctx.drawImage(v, 0, 0, c.width, c.height);
			const url = c.toDataURL("image/jpeg", .7);
			if (url.length > 32) useDH.getState().updateClipThumb(clip.id, url);
		} catch {}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "card-media",
		ref,
		role: "button",
		tabIndex: 0,
		onClick: onOpen,
		onKeyDown: (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onOpen();
			}
		},
		children: [clip.thumb ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: clip.thumb,
			alt: ""
		}) : visible && src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
			src: `${src}${src.includes("#") ? "" : "#t=0.15"}`,
			muted: true,
			playsInline: true,
			preload: "auto",
			onLoadedData: (e) => {
				const v = e.currentTarget;
				if (v.currentTime < .05) try {
					v.currentTime = .15;
				} catch {}
				grab(v);
			},
			onSeeked: (e) => grab(e.currentTarget)
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "card-ph" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "card-open",
			children: "Открыть"
		})]
	});
}
function ClipProfile({ clip, onClose, hall = false }) {
	const text = clip.promptRaw || clip.promptFlat || "Промт не сохранён";
	const src = useClipSrc(clip);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "profile-scrim",
		role: "presentation",
		onMouseDown: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "profile-sheet",
			role: "dialog",
			"aria-modal": "true",
			onMouseDown: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "profile-head",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "empty-kicker",
					children: "Генерация"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: new Date(clip.createdAt).toLocaleString("ru-RU") })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn outline",
					onClick: onClose,
					children: "Закрыть"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "profile-body",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "profile-video",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						src: src || void 0,
						poster: clip.thumb,
						controls: true,
						playsInline: true,
						preload: "metadata"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "profile-side",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "profile-seed",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "label",
									children: "Сид"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
									className: "mono",
									children: clip.seed
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline",
									onClick: () => void copyText(String(clip.seed)),
									children: "Копировать"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "settings-grid",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Модель" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: clip.model || "—" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Разрешение" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: clip.resolution || "—" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Соотношение" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: clip.aspect || "—" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Длительность" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: clip.duration ? `${clip.duration} с` : "—" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Аудио" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: clip.audio ? "Вкл" : "Выкл" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "NSFW" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: clip.nsfw ? "Вкл" : "Выкл" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "wide",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Задача" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "mono",
										children: clip.taskId || "—"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "profile-prompt",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "label-row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "label",
									children: "Промт"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									onClick: () => void copyText(text),
									children: "Копировать"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: text })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "profile-actions",
							children: [
								hall ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn primary",
										onClick: () => void keepInHall(clip).then(onClose),
										children: "В альбом"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn outline",
										onClick: () => useDH.getState().playRemote(clip),
										children: "Смотреть в эфире"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn outline",
										onClick: () => {
											(async () => {
												const picked = await pickDialog({
													title: "Сохранить сид в профиль",
													options: useDH.getState().seedProfiles.map((p) => ({
														id: p.id,
														label: p.name,
														hint: `${p.items.length} сидов`
													})),
													createLabel: "Новый профиль"
												});
												if (!picked) return;
												const id = picked.type === "new" ? useDH.getState().createSeedProfile(picked.name) : picked.id;
												useDH.getState().addSeeds(id, [{
													seed: clip.seed,
													promptFlat: clip.promptFlat,
													promptRaw: clip.promptRaw
												}]);
												toast("Сид в профиле");
											})();
										},
										children: "Сид в профиль"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn outline",
										onClick: () => {
											(async () => {
												const picked = await pickDialog({
													title: "Промт в коллекцию",
													options: useDH.getState().promptCollections.map((p) => ({
														id: p.id,
														label: p.name,
														hint: `${p.items.length}`
													})),
													createLabel: "Новая коллекция"
												});
												if (!picked) return;
												const id = picked.type === "new" ? useDH.getState().createPromptCollection(picked.name) : picked.id;
												useDH.getState().addPrompts(id, [{
													raw: clip.promptRaw,
													flat: clip.promptFlat
												}]);
												toast("Промт в коллекции");
											})();
										},
										children: "Промт в коллекцию"
									})
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline",
									onClick: () => {
										downloadClip(clip).catch((error) => {
											useDH.getState().pushLog("err", error instanceof Error ? error.message : "Не удалось скачать");
										});
									},
									children: "Скачать"
								}),
								hall ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline",
									onClick: () => {
										(async () => {
											if (!await confirmDialog({
												title: "Удалить ролик?",
												body: "Файл исчезнет из альбома и с этого устройства.",
												confirmLabel: "Удалить",
												danger: true
											})) return;
											await useDH.getState().removeClip(clip.id);
											onClose();
										})();
									},
									children: "Удалить"
								}) : null
							]
						})
					]
				})]
			})]
		})
	});
}
var REGIONS = [
	{
		male: [
			"Aleksandr",
			"Dmitry",
			"Sergey",
			"Andrey",
			"Mikhail",
			"Pavel",
			"Ivan",
			"Artem",
			"Kirill",
			"Maxim",
			"Roman",
			"Viktor",
			"Alexey",
			"Oleg",
			"Igor",
			"Yuri",
			"Denis",
			"Anton",
			"Vladislav",
			"Gleb",
			"Timur",
			"Matvey",
			"Daniil",
			"Egor",
			"Nikita",
			"Ilya",
			"Fyodor",
			"Konstantin",
			"Vladimir",
			"Nikolai",
			"Ruslan",
			"Yaroslav",
			"Lev",
			"Mark",
			"Platon",
			"Tikhon",
			"Arkady",
			"Vitaly",
			"Evgeny",
			"Stepan",
			"Grigory",
			"Vadim",
			"Boris",
			"Stanislav",
			"Vyacheslav",
			"Anatoly",
			"Semyon",
			"Savva",
			"Miron",
			"German"
		],
		female: [
			"Anna",
			"Maria",
			"Elena",
			"Olga",
			"Irina",
			"Tatiana",
			"Natalia",
			"Svetlana",
			"Ekaterina",
			"Anastasia",
			"Yulia",
			"Daria",
			"Alina",
			"Polina",
			"Victoria",
			"Ksenia",
			"Veronika",
			"Margarita",
			"Yana",
			"Kristina",
			"Diana",
			"Arina",
			"Kira",
			"Milana",
			"Varvara",
			"Elizaveta",
			"Sofia",
			"Alexandra",
			"Ulyana",
			"Valeria",
			"Karina",
			"Eva",
			"Maya",
			"Zlata",
			"Alyona",
			"Vera",
			"Larisa",
			"Inna",
			"Regina",
			"Yaroslava",
			"Vlada",
			"Miroslava",
			"Adelina",
			"Emilia",
			"Nadezhda",
			"Galina",
			"Ludmila",
			"Alisa",
			"Vasilisa",
			"Tamara"
		],
		last: [
			"Ivanov",
			"Petrov",
			"Sokolov",
			"Kuznetsov",
			"Popov",
			"Lebedev",
			"Kozlov",
			"Novikov",
			"Morozov",
			"Volkov",
			"Solovyov",
			"Vasilyev",
			"Zaytsev",
			"Pavlov",
			"Semyonov",
			"Golubev",
			"Vinogradov",
			"Bogdanov",
			"Vorobyov",
			"Fyodorov",
			"Mikhailov",
			"Belyaev",
			"Tarasov",
			"Belov",
			"Komarov",
			"Orlov",
			"Kiselyov",
			"Makarov",
			"Andreyev",
			"Kovalyov",
			"Ilyin",
			"Gusev",
			"Titov",
			"Kuzmin",
			"Kudryavtsev",
			"Baranov",
			"Kulikov",
			"Alekseyev",
			"Stepanov",
			"Yakovlev",
			"Sorokin",
			"Sergeyev",
			"Romanov",
			"Zakharov",
			"Borisov",
			"Korolyov",
			"Gerasimov",
			"Ponomaryov",
			"Grigoryev",
			"Lazarev",
			"Medvedev",
			"Nikitin",
			"Sobolev",
			"Polyakov",
			"Frolov",
			"Aleksandrov",
			"Yegorov",
			"Krylov",
			"Maksimov",
			"Osipov",
			"Davydov",
			"Melnikov",
			"Shcherbakov",
			"Kolesnikov",
			"Karpov",
			"Afanasyev",
			"Vlasov",
			"Tikhonov",
			"Gavrilov",
			"Rodionov",
			"Kotov",
			"Arkhipov",
			"Trofimov",
			"Martynov",
			"Gorshkov",
			"Ovchinnikov",
			"Nazarov",
			"Lobanov",
			"Belyakov",
			"Potapov",
			"Yermakov",
			"Drozdov",
			"Savin",
			"Loginov",
			"Kirillov",
			"Kalashnikov",
			"Antonov",
			"Shestakov",
			"Simonov",
			"Filatov",
			"Prokhorov",
			"Nesterov",
			"Zhukov",
			"Lavrov",
			"Suvorov",
			"Bykov"
		]
	},
	{
		male: [
			"Oliver",
			"Henry",
			"Theodore",
			"Sebastian",
			"Julian",
			"Adrian",
			"Dominic",
			"Marcus",
			"Elias",
			"Felix",
			"Arthur",
			"Hugo",
			"Miles",
			"Nathaniel",
			"Vincent",
			"Graham",
			"Colin",
			"Patrick",
			"Connor",
			"Declan",
			"Liam",
			"Sean",
			"Owen",
			"Caleb",
			"Ethan",
			"Lucas",
			"Benjamin",
			"Samuel",
			"Edward",
			"Frederick",
			"Jonathan",
			"Nicholas",
			"Andrew",
			"Matthew",
			"Daniel",
			"Joseph",
			"Callum",
			"Harrison",
			"Wesley",
			"Elliot",
			"Jonah",
			"Simon",
			"George",
			"Charles",
			"Alfred",
			"Hugh",
			"Lawrence",
			"Percival",
			"Edmund",
			"Roland"
		],
		female: [
			"Emma",
			"Olivia",
			"Charlotte",
			"Amelia",
			"Sophia",
			"Isabella",
			"Evelyn",
			"Abigail",
			"Emily",
			"Elizabeth",
			"Grace",
			"Chloe",
			"Hannah",
			"Natalie",
			"Claire",
			"Eleanor",
			"Josephine",
			"Madeleine",
			"Isabelle",
			"Sophie",
			"Elise",
			"Clara",
			"Violet",
			"Audrey",
			"Beatrice",
			"Rosalie",
			"Imogen",
			"Freya",
			"Harriet",
			"Lucy",
			"Alice",
			"Margaret",
			"Catherine",
			"Penelope",
			"Adeline",
			"Lillian",
			"Genevieve",
			"Cecilia",
			"Helena",
			"Bridget"
		],
		last: [
			"Harrington",
			"Callahan",
			"Donovan",
			"Fitzgerald",
			"McKenzie",
			"Whitaker",
			"Langford",
			"Ellison",
			"Crawford",
			"Hawthorne",
			"Sinclair",
			"Beaumont",
			"Cartwright",
			"Holloway",
			"Prescott",
			"Rutherford",
			"Montgomery",
			"Sullivan",
			"Brennan",
			"Gallagher",
			"Murphy",
			"Walsh",
			"Quinn",
			"Byrne",
			"Doyle",
			"Hughes",
			"Bennett",
			"Collins",
			"Foster",
			"Griffin",
			"Hayes",
			"Marshall",
			"Patterson",
			"Reynolds",
			"Spencer",
			"Wallace",
			"Chambers",
			"Fletcher",
			"Gardner",
			"Hudson",
			"Lawson",
			"Nicholson",
			"Osborne",
			"Parsons",
			"Russell",
			"Townsend",
			"Vaughan",
			"Webster",
			"Ashford",
			"Pemberton",
			"OConnell",
			"Kensington",
			"Whitmore",
			"Blackwell",
			"Dalton",
			"Everett",
			"Hayes",
			"Lockwood",
			"Monroe",
			"Sheffield",
			"Thornton",
			"Wellington",
			"Adler",
			"Brooks",
			"Campbell",
			"Duncan",
			"Fraser",
			"MacLeod",
			"Stewart",
			"Reid",
			"Murray",
			"Boyd",
			"Keane",
			"Nolan",
			"Reilly"
		]
	},
	{
		male: [
			"Luca",
			"Marco",
			"Giovanni",
			"Alessandro",
			"Matteo",
			"Lorenzo",
			"Francesco",
			"Antonio",
			"Andrea",
			"Giuseppe",
			"Pierre",
			"Julien",
			"Antoine",
			"Louis",
			"Gabriel",
			"Etienne",
			"Mathieu",
			"Nicolas",
			"Alexandre",
			"Hugo",
			"Camille",
			"Theo",
			"Raphael",
			"Emile",
			"Laurent",
			"Marc",
			"Olivier",
			"Sebastien",
			"Diego",
			"Alejandro",
			"Javier",
			"Miguel",
			"Carlos",
			"Andres",
			"Pablo",
			"Santiago",
			"Mateo",
			"Nicolas",
			"Emilio",
			"Rafael"
		],
		female: [
			"Chiara",
			"Giulia",
			"Francesca",
			"Bianca",
			"Lucia",
			"Elena",
			"Aurora",
			"Giorgia",
			"Sofia",
			"Martina",
			"Camille",
			"Elise",
			"Amelie",
			"Manon",
			"Chloe",
			"Lea",
			"Ines",
			"Colette",
			"Margot",
			"Juliette",
			"Lucia",
			"Carmen",
			"Valeria",
			"Daniela",
			"Paula",
			"Adriana",
			"Natalia",
			"Isabel",
			"Camila",
			"Renata",
			"Alejandra",
			"Beatriz",
			"Catalina",
			"Elena",
			"Pilar",
			"Rosa",
			"Teresa",
			"Ana",
			"Marina",
			"Clara"
		],
		last: [
			"Rossi",
			"Russo",
			"Ferrari",
			"Esposito",
			"Romano",
			"Colombo",
			"Ricci",
			"Marino",
			"Greco",
			"Bruno",
			"Gallo",
			"Conti",
			"DeLuca",
			"Costa",
			"Giordano",
			"Mancini",
			"Rizzo",
			"Lombardi",
			"Moretti",
			"Barbieri",
			"Fontana",
			"Santoro",
			"Marchetti",
			"Leone",
			"Moreau",
			"Lefevre",
			"Bernard",
			"Laurent",
			"Dubois",
			"Fontaine",
			"Rousseau",
			"Chevalier",
			"Berger",
			"Dupont",
			"Girard",
			"Bonnet",
			"Lambert",
			"Roussel",
			"Vincent",
			"Muller",
			"Garcia",
			"Rodriguez",
			"Martinez",
			"Hernandez",
			"Lopez",
			"Gonzalez",
			"Perez",
			"Sanchez",
			"Ramirez",
			"Torres",
			"Flores",
			"Rivera",
			"Gomez",
			"Diaz",
			"Reyes",
			"Morales",
			"Jimenez",
			"Herrera",
			"Medina",
			"Castro",
			"Vargas",
			"Romero",
			"Alvarez",
			"Mendoza",
			"Castillo",
			"Ortiz",
			"Delgado",
			"Rojas",
			"Vega",
			"Nunez",
			"Guerrero",
			"Silva",
			"Navarro",
			"Dominguez",
			"Ibanez",
			"Cortes",
			"Santos",
			"Ferreira",
			"Oliveira",
			"Costa",
			"Almeida",
			"Pereira",
			"Carvalho",
			"Ribeiro"
		]
	},
	{
		male: [
			"Hans",
			"Lukas",
			"Felix",
			"Jonas",
			"Maximilian",
			"Karl",
			"Friedrich",
			"Wolfgang",
			"Stefan",
			"Andreas",
			"Klaus",
			"Matthias",
			"Tobias",
			"Sebastian",
			"Florian",
			"Moritz",
			"Jan",
			"Henrik",
			"Nils",
			"Erik",
			"Lars",
			"Anders",
			"Johan",
			"Magnus",
			"Sven",
			"Ingrid",
			"Otto",
			"Werner",
			"Dieter",
			"Johann"
		],
		female: [
			"Ingrid",
			"Freya",
			"Astrid",
			"Linnea",
			"Greta",
			"Heidi",
			"Anneliese",
			"Klara",
			"Marta",
			"Elsa",
			"Lena",
			"Mia",
			"Hanna",
			"Nora",
			"Ida",
			"Saga",
			"Elin",
			"Karin",
			"Britta",
			"Sigrid",
			"Annika",
			"Thea",
			"Maren",
			"Petra",
			"Ursula",
			"Monika",
			"Helga",
			"Brigitte",
			"Sabine",
			"Katrin"
		],
		last: [
			"Muller",
			"Schneider",
			"Fischer",
			"Weber",
			"Hoffmann",
			"Wagner",
			"Becker",
			"Richter",
			"Klein",
			"Wolf",
			"Schroder",
			"Neumann",
			"Zimmermann",
			"Kruger",
			"Hofmann",
			"Hartmann",
			"Lange",
			"Schmitt",
			"Werner",
			"Schulz",
			"Koch",
			"Bauer",
			"Schmid",
			"Hahn",
			"Schubert",
			"Vogel",
			"Friedrich",
			"Gunther",
			"Keller",
			"Frank",
			"Berger",
			"Roth",
			"Ludwig",
			"Winter",
			"Krause",
			"Lehmann",
			"Konig",
			"Huber",
			"Mayer",
			"Walter",
			"Andersen",
			"Nielsen",
			"Jensen",
			"Pedersen",
			"Larsen",
			"Johansen",
			"Berg",
			"Lindberg",
			"Holm",
			"Eriksson",
			"Lindqvist",
			"Bergman",
			"Sandstrom",
			"Dahl",
			"Lund",
			"Strom",
			"Vik",
			"Haugen",
			"Nygaard",
			"Solberg",
			"Bakken"
		]
	},
	{
		male: [
			"Hiroshi",
			"Kenji",
			"Takashi",
			"Haruto",
			"Yuto",
			"Sota",
			"Ren",
			"Daiki",
			"Kazuki",
			"Ryo",
			"Haruki",
			"Kaito",
			"Shota",
			"Naoki",
			"Yuki",
			"Minjun",
			"Jiho",
			"Seojun",
			"Hyunwoo",
			"Junseo",
			"Jisoo",
			"Taemin",
			"Donghyun",
			"Sungmin",
			"Woojin",
			"Jaehyun",
			"Kyungsoo",
			"Hajime",
			"Satoshi",
			"Makoto"
		],
		female: [
			"Aiko",
			"Yui",
			"Hana",
			"Sakura",
			"Mei",
			"Akari",
			"Rin",
			"Yuna",
			"Mio",
			"Hina",
			"Emi",
			"Kaori",
			"Nanami",
			"Ayaka",
			"Misaki",
			"Hyejin",
			"Soomin",
			"Jiwon",
			"Minji",
			"Yejin",
			"Suyeon",
			"Haerin",
			"Nari",
			"Eunji",
			"Chaeyoung",
			"Yuna",
			"Sora",
			"Keiko",
			"Naomi",
			"Asuka"
		],
		last: [
			"Sato",
			"Suzuki",
			"Takahashi",
			"Tanaka",
			"Watanabe",
			"Ito",
			"Yamamoto",
			"Nakamura",
			"Kobayashi",
			"Saito",
			"Kato",
			"Yoshida",
			"Yamada",
			"Sasaki",
			"Yamaguchi",
			"Matsumoto",
			"Inoue",
			"Kimura",
			"Hayashi",
			"Shimizu",
			"Yamazaki",
			"Mori",
			"Abe",
			"Ikeda",
			"Hashimoto",
			"Yamashita",
			"Ishikawa",
			"Nakajima",
			"Maeda",
			"Fujita",
			"Ogawa",
			"Goto",
			"Okada",
			"Hasegawa",
			"Murakami",
			"Kondo",
			"Ishii",
			"Kim",
			"Lee",
			"Park",
			"Choi",
			"Jung",
			"Kang",
			"Cho",
			"Yoon",
			"Jang",
			"Lim",
			"Han",
			"Oh",
			"Seo",
			"Shin",
			"Kwon",
			"Hwang",
			"Ahn",
			"Song",
			"Yoo",
			"Hong",
			"Jeon"
		]
	},
	{
		male: [
			"Omar",
			"Karim",
			"Yusuf",
			"Amir",
			"Tariq",
			"Hassan",
			"Malik",
			"Samir",
			"Adel",
			"Nabil",
			"Faisal",
			"Idris",
			"Rami",
			"Zayd",
			"Bilal",
			"Hamid",
			"Jamal",
			"Khaled",
			"Mustafa",
			"Sami",
			"Walid",
			"Anwar",
			"Farid",
			"Imran",
			"Rashid",
			"Tariq",
			"Yasin",
			"Ziad",
			"Bassam",
			"Hadi"
		],
		female: [
			"Aisha",
			"Layla",
			"Noor",
			"Fatima",
			"Leila",
			"Amira",
			"Yasmin",
			"Hana",
			"Salma",
			"Mariam",
			"Dina",
			"Rania",
			"Samira",
			"Lina",
			"Noura",
			"Huda",
			"Zahra",
			"Farah",
			"Iman",
			"Amina",
			"Dalal",
			"Reem",
			"Safa",
			"Lamia",
			"Nadine",
			"Maya",
			"Rana",
			"Dalia",
			"Hala",
			"Yara"
		],
		last: [
			"Hassan",
			"Hussein",
			"Rahman",
			"Farouk",
			"Nasser",
			"Khalil",
			"Mansour",
			"Haddad",
			"Khoury",
			"Najjar",
			"Farah",
			"Saleh",
			"Karim",
			"Aziz",
			"Hamdan",
			"Darwish",
			"Sabbagh",
			"Nasr",
			"Hakim",
			"Abbas",
			"Qureshi",
			"Siddiqui",
			"Malik",
			"Farooq",
			"Shaikh",
			"Ibrahim",
			"Yousef",
			"Barakat",
			"Nasser",
			"Tahan",
			"Kassem",
			"Daher",
			"Awad",
			"Bishara",
			"Haddad",
			"Kanaan",
			"Sayegh",
			"Antoun",
			"Mansour",
			"Zein"
		]
	},
	{
		male: [
			"Arjun",
			"Rohan",
			"Vikram",
			"Aditya",
			"Kabir",
			"Ayaan",
			"Dev",
			"Rahul",
			"Sanjay",
			"Amit",
			"Nikhil",
			"Varun",
			"Aarav",
			"Vihaan",
			"Ishaan",
			"Karan",
			"Rohan",
			"Siddharth",
			"Manan",
			"Harsh",
			"Pranav",
			"Aniket",
			"Rajat",
			"Vivek",
			"Naveen",
			"Karthik",
			"Arun",
			"Deepak",
			"Suresh",
			"Ravi"
		],
		female: [
			"Priya",
			"Ananya",
			"Meera",
			"Aisha",
			"Anika",
			"Diya",
			"Kavya",
			"Ishita",
			"Neha",
			"Pooja",
			"Sneha",
			"Aditi",
			"Riya",
			"Shreya",
			"Nisha",
			"Lakshmi",
			"Anjali",
			"Divya",
			"Tanvi",
			"Aarohi",
			"Myra",
			"Sara",
			"Kiara",
			"Inaya",
			"Avni",
			"Ira",
			"Saanvi",
			"Pari",
			"Zara",
			"Mira"
		],
		last: [
			"Sharma",
			"Patel",
			"Singh",
			"Gupta",
			"Reddy",
			"Iyer",
			"Nair",
			"Mehta",
			"Joshi",
			"Desai",
			"Kapoor",
			"Banerjee",
			"Chatterjee",
			"Mukherjee",
			"Rao",
			"Pillai",
			"Menon",
			"Das",
			"Bose",
			"Ghosh",
			"Chakraborty",
			"Verma",
			"Malhotra",
			"Khanna",
			"Chopra",
			"Bhat",
			"Hegde",
			"Kulkarni",
			"Jain",
			"Agarwal",
			"Saxena",
			"Trivedi",
			"Pandey",
			"Mishra",
			"Tiwari",
			"Dubey",
			"Shukla",
			"Naidu",
			"Shetty",
			"Kaur"
		]
	},
	{
		male: [
			"Jakub",
			"Piotr",
			"Michal",
			"Tomasz",
			"Krzysztof",
			"Andrzej",
			"Pawel",
			"Marcin",
			"Adam",
			"Lukasz",
			"Mateusz",
			"Kacper",
			"Filip",
			"Bartosz",
			"Wojciech",
			"Jan",
			"Stanislaw",
			"Marek",
			"Rafal",
			"Grzegorz",
			"Oskar",
			"Szymon",
			"Dominik",
			"Igor",
			"Aleksander",
			"Nikodem",
			"Antoni",
			"Franciszek",
			"Leon",
			"Tymon"
		],
		female: [
			"Anna",
			"Maria",
			"Katarzyna",
			"Malgorzata",
			"Agnieszka",
			"Barbara",
			"Ewa",
			"Krystyna",
			"Elzbieta",
			"Zofia",
			"Janina",
			"Natalia",
			"Magdalena",
			"Joanna",
			"Monika",
			"Aleksandra",
			"Wiktoria",
			"Zuzanna",
			"Julia",
			"Maja",
			"Hanna",
			"Lena",
			"Alicja",
			"Oliwia",
			"Pola",
			"Nina",
			"Laura",
			"Amelia",
			"Iga",
			"Klara"
		],
		last: [
			"Kowalski",
			"Nowak",
			"Wisniewski",
			"Kaminski",
			"Lewandowski",
			"Zielinski",
			"Szymanski",
			"Wozniak",
			"Dabrowski",
			"Kozlowski",
			"Jankowski",
			"Mazur",
			"Krawczyk",
			"Kaczmarek",
			"Piotrowski",
			"Grabowski",
			"Zajac",
			"Kruk",
			"Wrobel",
			"Jablonski",
			"Wieczorek",
			"Jasinski",
			"Zawadzki",
			"Baran",
			"Sikora",
			"Duda",
			"Szewczyk",
			"Wlodarczyk",
			"Adamczyk",
			"Pawlak",
			"Walczak",
			"Stepien",
			"Gorski",
			"Rutkowski",
			"Michalski",
			"Ostrowski",
			"Sadowski",
			"Czarnecki",
			"Kubiak",
			"Lis"
		]
	}
];
function randInt(a, b) {
	return a + Math.floor(Math.random() * (b - a + 1));
}
function pick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}
function slug(s) {
	return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
}
var DOMAINS = ["outlook.com"];
function genPassword() {
	const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
	const lower = "abcdefghijkmnopqrstuvwxyz";
	const digits = "23456789";
	const special = "!@#$%&*?";
	const pool = upper + lower + digits + special;
	const len = randInt(12, 16);
	const chars = [
		pick(upper.split("")),
		pick(lower.split("")),
		pick(digits.split("")),
		pick(special.split(""))
	];
	while (chars.length < len) chars.push(pick(pool.split("")));
	for (let i = chars.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const t = chars[i];
		chars[i] = chars[j];
		chars[j] = t;
	}
	return chars.join("");
}
function genLogin(first, last) {
	const f = slug(first);
	const l = slug(last);
	const n = randInt(10, 9999);
	const y = randInt(1984, 2006);
	return pick([
		`${f}.${l}${randInt(1, 99)}`,
		`${f}${l.slice(0, 4)}${n}`,
		`${f[0] ?? "a"}${l}${randInt(10, 999)}`,
		`${l}${f.slice(0, 3)}${randInt(10, 99)}`,
		`${f}_${l.slice(0, 6)}${randInt(1, 999)}`,
		`${f}${y}`,
		`${l}.${f[0] ?? "a"}${randInt(10, 999)}`,
		`${f.slice(0, 5)}${l.slice(0, 5)}${randInt(10, 99)}`,
		`${f}${l}${randInt(2, 9)}`
	]).replace(/[^a-zA-Z0-9._]/g, "").replace(/\.{2,}/g, ".").replace(/^\.|\.$/g, "").slice(0, 20);
}
function declineLast(last, female) {
	if (!female || !last) return last;
	if (/skiy$/i.test(last)) return last.replace(/skiy$/i, "skaya");
	if (/sky$/i.test(last)) return last.replace(/sky$/i, "skaya");
	if (/(ov|ev|in|yn)$/i.test(last)) return `${last}a`;
	return last;
}
function mixCase(value) {
	return value.split("").map((ch, i) => (i === 0 || Math.random() < 0.16) && /[a-z]/i.test(ch) ? ch.toUpperCase() : ch.toLowerCase()).join("");
}
function genIdentity() {
	const pool = REGIONS.filter((r) => !r.last?.includes("Sharma") && !r.last?.includes("Sato") && !r.last?.includes("Kim") && !r.last?.includes("Wang") && !r.last?.includes("Patel"));
	const region = pick(pool.length ? pool : REGIONS);
	const female = Math.random() < 0.48;
	const firstName = pick(female ? region.female : region.male);
	const lastName = declineLast(pick(region.last), female);
	let login = mixCase(genLogin(firstName, lastName));
	login = `${login}${randInt(10, 99)}`;
	if (login.length < 8) login = `${login}${randInt(100, 999)}`;
	return {
		login,
		email: `${login}@outlook.com`,
		password: genPassword(),
		firstName,
		lastName
	};
}
function Pane({ title, id, onRegen, onClear }) {
	if (!id) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "muted assist-empty",
		children: "Нажмите «Начать» — появятся логин, пароль, имя и фамилия."
	});
	const rows = [
		["Логин", id.login],
		["Почта", id.email],
		["Пароль", id.password],
		["Имя", id.firstName],
		["Фамилия", id.lastName]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [rows.map(([label, val]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "assist-row",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "assist-label",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
				className: "assist-val",
				children: val
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "btn outline assist-copy",
				onClick: () => void copyText(val),
				children: "Копировать"
			})
		]
	}, label)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "row wrap",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "btn ghost assist-regen",
			onClick: onRegen,
			children: "Перегенерировать"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "btn ghost",
			onClick: onClear,
			children: ["Очистить ", title]
		})]
	})] });
}
function Assist() {
	const a = useDH((s) => s.assistA);
	const b = useDH((s) => s.assistB);
	const setAssist = useDH((s) => s.setAssist);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col assist-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "assist-head",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "empty-kicker",
					children: "Ассистент"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Данные для ручной регистрации" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted",
					children: "Только подсказки: логин, пароль, имя. Ввод на сайтах — вручную. Данные остаются, пока вы сами их не очистите — даже после смены вкладки и закрытия программы."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "assist-actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn primary",
						onClick: () => {
							setAssist("A", genIdentity());
							setAssist("B", genIdentity());
						},
						children: "Начать"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: () => {
							(async () => {
								if (!await confirmDialog({
									title: "Очистить оба экрана?",
									body: "Сгенерированные данные исчезнут и больше не вернутся, пока не нажмёте «Начать».",
									confirmLabel: "Очистить"
								})) return;
								setAssist("both", null);
							})();
						},
						children: "Очистить оба"
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "assist-split",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "assist-pane",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "assist-pane-title",
						children: "Экран A"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pane, {
						title: "A",
						id: a,
						onRegen: () => setAssist("A", genIdentity()),
						onClear: () => {
							(async () => {
								if (await confirmDialog({
									title: "Очистить экран A?",
									body: "Данные экрана A исчезнут.",
									confirmLabel: "Очистить"
								})) setAssist("A", null);
							})();
						}
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "assist-divider",
					"aria-hidden": true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "assist-pane",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "assist-pane-title",
						children: "Экран B"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pane, {
						title: "B",
						id: b,
						onRegen: () => setAssist("B", genIdentity()),
						onClear: () => {
							(async () => {
								if (await confirmDialog({
									title: "Очистить экран B?",
									body: "Данные экрана B исчезнут.",
									confirmLabel: "Очистить"
								})) setAssist("B", null);
							})();
						}
					})]
				})
			]
		})]
	});
}
function Cinema() {
	const albums = useDH((s) => s.albums);
	const clips = useDH((s) => s.clips);
	const ready = useDH((s) => s.clipsReady);
	const loadClips = useDH((s) => s.loadClips);
	const [openId, setOpenId] = (0, React.useState)(null);
	const [openClip, setOpenClip] = (0, React.useState)(null);
	(0, React.useEffect)(() => {
		if (!ready) loadClips();
	}, [ready, loadClips]);
	const album = albums.find((a) => a.id === openId) || null;
	const inside = album ? clips.filter((c) => c.shelf === "hall" && c.albumId === album.id) : [];
	(0, React.useEffect)(() => {
		if (!openClip) return;
		const fresh = clips.find((c) => c.id === openClip.id);
		if (!fresh) setOpenClip(null);
		else if (fresh !== openClip) setOpenClip(fresh);
	}, [clips, openClip]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col archive-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "archive-head",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "empty-kicker",
						children: [album ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "back-link",
						onClick: () => setOpenId(null),
						children: ["← ", "Назад"]
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "empty-kicker",
						children: "Кинозал"
					})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "archive-title-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: album ? album.name : "Папки" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "head-actions",
							children: album ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-action",
									onClick: () => revealLibrary(useDH.getState().hallPath + "/" + album.name),
									children: "Перейти к файлам"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-action",
									onClick: () => {
										(async () => {
											if (!await confirmDialog({
												title: `Удалить всё в папке «${album.name}»?`,
												body: "Ролики этой папки исчезнут с устройства. Сама папка останется.",
												confirmLabel: "Удалить всё",
												danger: true,
												requireCheck: "Я понимаю, что ролики будут удалены"
											})) return;
											await useDH.getState().clearAlbumClips(album.id);
										})();
									},
									children: "Удалить всё"
								})
							] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn primary",
									onClick: () => {
										(async () => {
											const name = await promptDialog({
												title: "Новая папка",
												placeholder: "Например, Нью-Йорк"
											});
											if (!name) return;
											const id = useDH.getState().createAlbum(name);
											setOpenId(id);
										})();
									},
									children: "Создать папку"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-action",
									onClick: () => revealLibrary(useDH.getState().hallPath),
									children: "Перейти к папкам"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-action",
									onClick: () => {
										(async () => {
											if (!await confirmDialog({
												title: "Удалить весь кинозал?",
												body: "Все папки и сохранённые в них ролики будут удалены с этого устройства.",
												confirmLabel: "Удалить всё",
												danger: true,
												requireCheck: "Я понимаю, что удаляю весь кинозал"
											})) return;
											await useDH.getState().clearHall();
											setOpenId(null);
										})();
									},
									children: "Удалить всё"
								})
							] })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: album ? "Ролики этого альбома. Откройте карточку, чтобы смотреть здесь же. Можно скачать или удалить." : "Папки альбомов. Создайте альбом здесь или сохраните ролик из архива."
					})
				]
			}),
			album ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "archive-grid",
				children: [inside.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted",
					children: "В альбоме пока пусто. Сохраните ролики из архива."
				}) : null, inside.map((clip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmCard, {
					clip,
					onOpen: () => setOpenClip(clip)
				}, clip.id))]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "album-grid",
				children: [
					!ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Открываю кинозал…"
					}) : null,
					ready && albums.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Альбомов ещё нет. Нажмите «Создать альбом»."
					}) : null,
					albums.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlbumFolder, {
						album: item,
						count: clips.filter((c) => c.shelf === "hall" && c.albumId === item.id).length,
						onOpen: () => setOpenId(item.id)
					}, item.id))
				]
			}),
			openClip ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipProfile, {
				clip: openClip,
				hall: true,
				onClose: () => setOpenClip(null)
			}) : null
		]
	});
}
function AlbumFolder({ album, count, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "album-folder",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "mac-folder",
			onClick: onOpen,
			onContextMenu: (e) => {
				e.preventDefault();
				openMenu(e.clientX, e.clientY, [{
					label: "Изменить имя",
					onClick: () => {
						(async () => {
							const name = await promptDialog({
								title: "Изменить имя",
								defaultValue: album.name,
								placeholder: "Название альбома"
							});
							if (!name) return;
							useDH.getState().renameAlbum(album.id, name);
						})();
					}
				}, {
					label: "Удалить",
					onClick: () => {
						(async () => {
							if (!await confirmDialog({
								title: `Удалить альбом «${album.name}»?`,
								body: "Папка и все ролики внутри будут удалены с этого устройства.",
								confirmLabel: "Удалить альбом",
								danger: true,
								requireCheck: "Я понимаю, что альбом будет удалён"
							})) return;
							await useDH.getState().deleteAlbum(album.id);
						})();
					}
				}]);
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "mac-shape",
					"aria-hidden": true,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mac-tab" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mac-body" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: album.name }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: count === 1 ? "1 ролик" : `${count} роликов` })
			]
		})
	});
}
function FilmCard({ clip, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardMedia, {
			clip,
			onOpen
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "card-body",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: clip.promptFlat || clip.promptRaw || "Без промта" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mono meta-line",
					children: [
						"seed ",
						clip.seed,
						" · ",
						clip.resolution,
						" · ",
						clip.aspect,
						" · ",
						clip.duration,
						"с"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "card-actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: () => {
							downloadClip(clip).catch((error) => {
								useDH.getState().pushLog("err", error instanceof Error ? error.message : "Не удалось скачать");
							});
						},
						children: "Скачать"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: () => {
							(async () => {
								if (!await confirmDialog({
									title: "Удалить ролик из альбома?",
									body: "Файл исчезнет из кинозала и с этого устройства.",
									confirmLabel: "Удалить",
									danger: true
								})) return;
								await useDH.getState().removeClip(clip.id);
							})();
						},
						children: "Удалить"
					})]
				})
			]
		})]
	});
}
function RefsView() {
	const folders = useDH((s) => s.refFolders);
	const assets = useDH((s) => s.refAssets);
	const [openId, setOpenId] = (0, React.useState)(null);
	const [zoom, setZoom] = (0, React.useState)(null);
	const folder = folders.find((f) => f.id === openId) || null;
	const inside = folder ? assets.filter((a) => a.folderId === folder.id) : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col archive-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "archive-head",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "empty-kicker",
						children: [folder ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "back-link",
							onClick: () => setOpenId(null),
							children: ["← ", "Назад"]
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "empty-kicker",
							children: "Референсы"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "archive-title-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: folder ? folder.name : "Папки" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "head-actions",
							children: folder ? [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-action",
								onClick: () => revealLibrary(`${useDH.getState().refsPath}/${folder.name}`),
								children: "Перейти к файлам"
							}, "files"), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-action",
								onClick: () => {
									(async () => {
										if (!await confirmDialog({
											title: `Удалить всё в папке «${folder.name}»?`,
											body: "Файлы этой папки исчезнут. Сама папка останется.",
											confirmLabel: "Удалить всё",
											danger: true,
											requireCheck: "Я понимаю, что файлы будут удалены"
										})) return;
										await useDH.getState().clearRefFolderAssets(folder.id);
									})();
								},
								children: "Удалить всё"
							}, "wipe")] : [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn primary",
								onClick: () => {
									(async () => {
										const name = await promptDialog({
											title: "Новая папка",
											placeholder: "Например, Нью-Йорк"
										});
										if (!name) return;
										const id = useDH.getState().createRefFolder(name);
										setOpenId(id);
									})();
								},
								children: "Создать папку"
							}, "new"), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-action",
								onClick: () => revealLibrary(useDH.getState().refsPath),
								children: "Перейти к папкам"
							}, "open"), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-action",
								onClick: () => {
									(async () => {
										if (!await confirmDialog({
											title: "Удалить все референсы?",
											body: "Все папки и файлы референсов будут удалены с этого устройства.",
											confirmLabel: "Удалить всё",
											danger: true,
											requireCheck: "Я понимаю, что удаляю все референсы"
										})) return;
										await useDH.getState().clearRefs();
										setOpenId(null);
									})();
								},
								children: "Удалить всё"
							}, "all")]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: folder ? "Файлы хранятся в программе. Левый клик — крупно, правый — отправить в студию или удалить." : "Папки референсов. Правый клик по папке — имя или удаление."
					})
				]
			}),
			folder ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderBody, {
				folder,
				assets: inside,
				onZoom: setZoom
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "album-grid",
				children: [folders.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted",
					children: "Папок ещё нет. Создайте папку и загрузите кадры с компьютера."
				}) : null, folders.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefFolderCard, {
					folder: item,
					count: assets.filter((a) => a.folderId === item.id).length,
					onOpen: () => setOpenId(item.id)
				}, item.id))]
			}),
			zoom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lightbox",
				onClick: () => setZoom(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: zoom,
					alt: ""
				})
			}) : null
		]
	});
}
function RefFolderCard({ folder, count, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		className: "mac-folder",
		onClick: onOpen,
		onContextMenu: (e) => {
			e.preventDefault();
			openMenu(e.clientX, e.clientY, [{
				label: "Изменить имя",
				onClick: () => {
					(async () => {
						const name = await promptDialog({
							title: "Изменить имя",
							defaultValue: folder.name
						});
						if (!name) return;
						useDH.getState().renameRefFolder(folder.id, name);
					})();
				}
			}, {
				label: "Удалить",
				onClick: () => {
					(async () => {
						if (!await confirmDialog({
							title: `Удалить папку «${folder.name}»?`,
							body: "Папка и все референсы внутри будут удалены.",
							confirmLabel: "Удалить",
							danger: true,
							requireCheck: "Я понимаю, что папка будет удалена"
						})) return;
						await useDH.getState().deleteRefFolder(folder.id);
					})();
				}
			}]);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "mac-shape",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mac-tab" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mac-body" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: folder.name }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: count === 1 ? "1 файл" : `${count} файлов` })
		]
	});
}
function FolderBody({ folder, assets, onZoom }) {
	const inputRef = (0, React.useRef)(null);
	const [over, setOver] = (0, React.useState)(false);
	const [busy, setBusy] = (0, React.useState)(false);
	const take = async (list) => {
		const files = Array.from(list || []).filter((f) => /^(image|video|audio)\//.test(f.type));
		if (!files.length) return;
		setBusy(true);
		try {
			for (const file of files) await useDH.getState().addRefAsset(folder.id, file);
			toast(files.length === 1 ? "Референс сохранён" : `Сохранено: ${files.length}`);
		} catch (error) {
			toast(error instanceof Error ? error.message : "Не удалось сохранить");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "refs-body",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `refs-drop${over ? " drag" : ""}`,
			onDragOver: (e) => {
				e.preventDefault();
				setOver(true);
			},
			onDragLeave: () => setOver(false),
			onDrop: (e) => {
				e.preventDefault();
				setOver(false);
				take(e.dataTransfer.files);
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefsGlyph, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: busy ? "Сохраняю…" : "Перетащите файлы сюда" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Изображения, видео или аудио останутся в этой папке" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn outline",
					onClick: () => inputRef.current?.click(),
					children: "С компьютера"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					ref: inputRef,
					type: "file",
					accept: "image/*,video/*,audio/*",
					multiple: true,
					hidden: true,
					onChange: (e) => {
						take(e.target.files);
						e.target.value = "";
					}
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "refs-grid",
			children: assets.map((asset) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefCard, {
				asset,
				onZoom
			}, asset.id))
		})]
	});
}
function RefCard({ asset, onZoom }) {
	const [src, setSrc] = (0, React.useState)(asset.thumb || "");
	(0, React.useEffect)(() => {
		let dead = false;
		localUrl(`ref-${asset.id}`).then((url) => {
			if (!dead && url) setSrc(url);
		});
		return () => {
			dead = true;
		};
	}, [asset.id]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: "ref-card",
		onClick: () => {
			if (asset.kind === "image" && src) onZoom(src);
		},
		onContextMenu: (e) => {
			e.preventDefault();
			const image = asset.kind === "image";
			const video = asset.kind === "video";
			const audio = asset.kind === "audio";
			openMenu(e.clientX, e.clientY, [{
				label: "Добавить в студию",
				children: [
					{
						label: "Стартовый кадр",
						disabled: !image,
						onClick: () => void sendRef(asset, "first")
					},
					{
						label: "Финальный кадр",
						disabled: !image,
						onClick: () => void sendRef(asset, "last")
					},
					{
						label: "Референс изображения",
						disabled: !image,
						onClick: () => void sendRef(asset, "image")
					},
					{
						label: "Референс видео",
						disabled: !video,
						onClick: () => void sendRef(asset, "video")
					},
					{
						label: "Референс аудио",
						disabled: !audio,
						onClick: () => void sendRef(asset, "audio")
					}
				]
			}, {
				label: "Удалить",
				onClick: () => {
					useDH.getState().deleteRefAsset(asset.id);
				}
			}]);
		},
		children: [
			asset.kind === "image" && src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src,
				alt: asset.name
			}) : null,
			asset.kind === "video" && src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				src,
				muted: true,
				playsInline: true
			}) : null,
			asset.kind === "audio" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tile-file",
				children: "AUD"
			}) : null,
			!src && asset.kind !== "audio" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tile-file",
				children: asset.kind === "video" ? "VID" : "IMG"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", { children: asset.name })
		]
	});
}
async function sendRef(asset, target) {
	const token = useDH.getState().token.trim();
	if (!token) {
		toast("Сначала выберите API-ключ");
		return;
	}
	const blob = await getFile(`ref-${asset.id}`);
	if (!blob) {
		toast("Файл не найден");
		return;
	}
	try {
		const url = await uploadFile(token, new File([blob], asset.name, { type: blob.type || "application/octet-stream" }));
		const item = {
			id: asset.id,
			url,
			name: asset.name,
			thumb: asset.thumb,
			kind: asset.kind
		};
		const s = useDH.getState();
		if (target === "first") s.setFirst(item);
		else if (target === "last") s.setLast(item);
		else if (target === "image") s.setList("refImages", [...s.refImages, {
			...item,
			kind: "image"
		}]);
		else if (target === "video") s.setList("refVideos", [...s.refVideos, {
			...item,
			kind: "video"
		}]);
		else s.setList("refAudios", [...s.refAudios, {
			...item,
			kind: "audio"
		}]);
		s.setView("desk");
		toast("Добавлено в студию");
	} catch (error) {
		toast(error instanceof Error ? error.message : "Не удалось отправить");
	}
}
function RefsGlyph() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		className: "refs-glyph",
		viewBox: "0 0 88 64",
		"aria-hidden": true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 16h22l6-8h28a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V16z" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "34",
				cy: "34",
				r: "8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M50 46l10-12 12 14" })
		]
	});
}
function money(n) {
	return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
}
function KeysView() {
	const keys = useDH((s) => s.apiKeys);
	const activeId = useDH((s) => s.activeKeyId);
	const credits = useDH((s) => s.credits);
	const refresh = useDH((s) => s.refreshCredits);
	const keysVisible = useDH((s) => s.keysVisible);
	(0, React.useEffect)(() => {
		refresh();
		const id = window.setInterval(() => void useDH.getState().refreshCredits(), 12e3);
		return () => window.clearInterval(id);
	}, [refresh]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col archive-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "archive-head",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "empty-kicker",
					children: "Kie.ai"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "archive-title-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "API-ключи" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "head-actions",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn primary",
							onClick: () => useDH.getState().addApiKey(),
							children: "Добавить ключ"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "text-action",
							onClick: () => useDH.getState().setKeysVisible(!useDH.getState().keysVisible),
							children: useDH.getState().keysVisible ? "Скрыть ключи" : "Показать ключи"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted",
					children: "Отметьте один ключ — именно он уйдёт в запуск. Баланс кредитов обновляется сам. Ключи остаются только в этом браузере."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "keys-list",
			children: keys.map((key, index) => {
				const snap = credits[key.id];
				const on = key.id === activeId;
				const balance = !key.token.trim() ? "Вставьте ключ, чтобы увидеть кредиты" : snap?.value != null ? `${money(snap.value)} кредитов` : snap?.error ? snap.error : "Смотрю баланс…";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: on ? "key-card on" : "key-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "label-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "label",
								children: ["Ключ ", index + 1]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: snap?.error && key.token.trim() ? "key-balance bad" : "key-balance",
								children: balance
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "key-line",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: on ? "key-check on" : "key-check",
									"aria-pressed": on,
									title: "Использовать этот ключ",
									onClick: () => useDH.getState().selectApiKey(key.id),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "input",
									type: keysVisible ? "text" : "password",
									autoComplete: "off",
									spellCheck: false,
									placeholder: "Токен kie.ai",
									value: key.token,
									onChange: (e) => useDH.getState().setApiKeyToken(key.id, e.target.value),
									onBlur: () => void useDH.getState().refreshCredits()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline icon",
									title: keysVisible ? "Скрыть" : "Показать",
									onClick: () => useDH.getState().setKeysVisible(!keysVisible),
									children: keysVisible ? "•" : "◉"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "key-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn outline",
								onClick: () => useDH.getState().clearApiKey(key.id),
								children: "Очистить"
							}), keys.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn outline",
								onClick: () => useDH.getState().removeApiKey(key.id),
								children: "Убрать"
							}) : null]
						})
					]
				}, key.id);
			})
		})]
	});
}
function SeedsView() {
	const profiles = useDH((s) => s.seedProfiles);
	const selectedId = useDH((s) => s.selectedSeedProfile);
	const hits = useDH((s) => s.seedHits);
	const profile = profiles.find((p) => p.id === selectedId) || null;
	const [picked, setPicked] = (0, React.useState)({});
	const selectedHits = hits.filter((h) => picked[h.id]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col library-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "archive-head",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "empty-kicker",
					children: "Сиды"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "archive-title-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Профили удачных сидов" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn primary",
						onClick: () => {
							(async () => {
								const name = await promptDialog({
									title: "Новый профиль сидов",
									placeholder: "Например, Ночной город"
								});
								if (!name) return;
								useDH.getState().createSeedProfile(name);
							})();
						},
						children: "Новый профиль"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted",
					children: "Сюда попадают только сиды, которые уже успешно сгенерировались. Название профилю даёте вы."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "library-grid",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "lib-side",
					children: [profiles.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Профилей ещё нет."
					}) : null, profiles.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: p.id === profile?.id ? "lib-item on" : "lib-item",
						onClick: () => useDH.getState().selectSeedProfile(p.id),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: p.items.length })]
					}, p.id))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lib-main",
					children: !profile ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted pad",
						children: "Выберите профиль или создайте новый — и добавьте в него сиды справа."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "label-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: profile.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "row",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn ghost",
										onClick: () => {
											(async () => {
												const name = await promptDialog({
													title: "Переименовать профиль",
													defaultValue: profile.name
												});
												if (!name) return;
												useDH.getState().renameSeedProfile(profile.id, name);
											})();
										},
										children: "Имя"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn ghost",
										onClick: () => {
											const lines = profile.items.map((it) => String(it.seed)).join("\n");
											if (lines) copyText(lines);
										},
										children: "Копировать все"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn ghost",
										onClick: () => {
											(async () => {
												if (await confirmDialog({
													title: "Удалить профиль?",
													body: `«${profile.name}» и сиды внутри него исчезнут из коллекции. Сами генерации в архиве останутся.`,
													confirmLabel: "Удалить профиль",
													danger: true
												})) useDH.getState().deleteSeedProfile(profile.id);
											})();
										},
										children: "Удалить"
									})
								]
							})]
						}),
						profile.items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "muted",
							children: "В профиле пока пусто."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lib-cards",
							children: profile.items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								className: "lib-card",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "lib-card-top",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
										className: "mono",
										children: it.seed
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "row",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "btn outline",
												onClick: () => void copyText(String(it.seed)),
												children: "Копировать"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "btn outline",
												onClick: () => useDH.getState().applySeed(it.seed),
												children: "В студию"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "btn ghost",
												onClick: () => useDH.getState().removeSeedItem(profile.id, it.id),
												children: "Убрать"
											})
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: it.promptFlat || it.promptRaw || "Без промта" })]
							}, it.id))
						})
					] })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "lib-recent",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "label-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "label",
								children: "Последние удачные"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									disabled: !hits.length,
									onClick: () => {
										(async () => {
											if (await confirmDialog({
												title: "Очистить последние удачные?",
												body: "Список сидов справа исчезнет. Профили сидов не трогаем.",
												confirmLabel: "Очистить"
											})) {
												useDH.getState().clearSeedHits();
												setPicked({});
											}
										})();
									},
									children: "Очистить"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline",
									onClick: () => {
										if (!profile) {
											toast("Сначала выберите или создайте профиль");
											return;
										}
										if (!selectedHits.length) {
											(async () => {
												const raw = await promptDialog({
													title: "Добавить сид вручную",
													placeholder: "Число сида",
													body: `Попадёт в профиль «${profile.name}».`
												});
												if (!raw) return;
												const seed = Number(raw.replace(/[^\d]/g, ""));
												if (!Number.isFinite(seed)) {
													toast("Нужно число");
													return;
												}
												useDH.getState().addSeeds(profile.id, [{
													seed,
													promptFlat: "",
													promptRaw: ""
												}]);
												toast("Сид добавлен");
											})();
											return;
										}
										useDH.getState().addSeeds(profile.id, selectedHits.map((h) => ({
											seed: h.seed,
											promptFlat: h.promptFlat,
											promptRaw: h.promptRaw
										})));
										setPicked({});
										toast("Сиды добавлены");
									},
									children: "Добавить"
								})]
							})]
						}),
						hits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "muted",
							children: "Когда генерация удастся, сид появится здесь."
						}) : null,
						hits.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "hit",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: Boolean(picked[h.id]),
								onChange: (e) => setPicked((m) => ({
									...m,
									[h.id]: e.target.checked
								}))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
								className: "mono",
								children: h.seed
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: clipPrompt(h) })] })]
						}, h.id))
					]
				})
			]
		})]
	});
}
function clipPrompt(h) {
	return clipPromptText(h.promptFlat || h.promptRaw || "без промта");
}
function clipPromptText(t) {
	const text = t || "без промта";
	return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}
function PromptsView() {
	const cols = useDH((s) => s.promptCollections);
	const selectedId = useDH((s) => s.selectedPromptCollection);
	const hits = useDH((s) => s.promptHits);
	const col = cols.find((c) => c.id === selectedId) || null;
	const [picked, setPicked] = (0, React.useState)({});
	const recent = [];
	const seen = /* @__PURE__ */ new Set();
	for (const h of hits) {
		const key = h.flat || h.raw;
		if (!key || seen.has(key)) continue;
		seen.add(key);
		recent.push(h);
	}
	const selected = recent.filter((h) => picked[h.id]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col library-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "archive-head",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "empty-kicker",
					children: "Промты"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "archive-title-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Коллекции промтов" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn primary",
						onClick: () => {
							(async () => {
								const name = await promptDialog({
									title: "Новая коллекция",
									placeholder: "Например, Портреты"
								});
								if (!name) return;
								useDH.getState().createPromptCollection(name);
							})();
						},
						children: "Новая коллекция"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted",
					children: "Папка с именем. Справа — последние промты, с которыми реально запускали генерацию. Их можно добавить в коллекцию или очистить."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "library-grid",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "lib-side",
					children: [cols.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Коллекций ещё нет."
					}) : null, cols.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: c.id === col?.id ? "lib-item on" : "lib-item",
						onClick: () => useDH.getState().selectPromptCollection(c.id),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: c.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: c.items.length })]
					}, c.id))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lib-main",
					children: !col ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted pad",
						children: "Создайте коллекцию и добавьте промты справа или кнопкой «В коллекцию» у редактора."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "label-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: col.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									onClick: () => {
										(async () => {
											const name = await promptDialog({
												title: "Переименовать коллекцию",
												defaultValue: col.name
											});
											if (!name) return;
											useDH.getState().renamePromptCollection(col.id, name);
										})();
									},
									children: "Имя"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									onClick: () => {
										(async () => {
											if (await confirmDialog({
												title: "Удалить коллекцию?",
												body: `«${col.name}» будет удалена.`,
												confirmLabel: "Удалить",
												danger: true
											})) useDH.getState().deletePromptCollection(col.id);
										})();
									},
									children: "Удалить"
								})]
							})]
						}),
						col.items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "muted",
							children: "В коллекции пока пусто."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lib-cards",
							children: col.items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								className: "lib-card",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: it.raw || it.flat }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "row wrap",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn outline",
											onClick: () => void copyText(it.raw || it.flat),
											children: "Копировать"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn outline",
											onClick: () => useDH.getState().applyPrompt(it.raw, it.flat),
											children: "В студию"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn outline",
											onClick: () => {
												(async () => {
													const next = await promptDialog({
														title: "Править промт",
														defaultValue: it.raw || it.flat
													});
													if (next == null) return;
													useDH.getState().updatePromptItem(col.id, it.id, next);
													toast("Промт обновлён");
												})();
											},
											children: "Править"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn ghost",
											onClick: () => useDH.getState().removePromptItem(col.id, it.id),
											children: "Убрать"
										})
									]
								})]
							}, it.id))
						})
					] })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "lib-recent",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "label-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "label",
								children: "Последние"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									disabled: !recent.length,
									onClick: () => {
										(async () => {
											if (await confirmDialog({
												title: "Очистить последние промты?",
												body: "Список запусков справа исчезнет. Коллекции не трогаем.",
												confirmLabel: "Очистить"
											})) {
												useDH.getState().clearPromptHits();
												setPicked({});
											}
										})();
									},
									children: "Очистить"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline",
									onClick: () => {
										if (!col) {
											toast("Сначала выберите или создайте коллекцию");
											return;
										}
										if (!selected.length) {
											document.dispatchEvent(new CustomEvent("dh-open-prompt", { detail: {
												collectId: col.id,
												empty: true
											} }));
											return;
										}
										useDH.getState().addPrompts(col.id, selected.map((h) => ({
											raw: h.raw,
											flat: h.flat
										})));
										setPicked({});
										toast("Промты добавлены");
									},
									children: "Добавить"
								})]
							})]
						}),
						recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "muted",
							children: "Появятся, когда запустите генерацию с промтом."
						}) : null,
						recent.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "hit",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: Boolean(picked[h.id]),
								onChange: (e) => setPicked((m) => ({
									...m,
									[h.id]: e.target.checked
								}))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: clipPromptText(h.flat || h.raw) }) })]
						}, h.id))
					]
				})
			]
		})]
	});
}
var GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ01DARKHORSE";
var splashOrigin = 0;
var splashFinished = false;
function HorseMark({ stage = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: stage ? "horse-mark stage" : "horse-mark",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "hm-dark",
			children: "DARK"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hm-foot",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hm-horse",
				children: "HORSE"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
				className: "hm-line",
				viewBox: "0 0 240 8",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", { points: "0,4 14,3.42 226,3.42 240,4 226,4.58 14,4.58" })
			})]
		})]
	});
}
function Splash({ onDone }) {
	const hostRef = (0, React.useRef)(null);
	const barRef = (0, React.useRef)(null);
	const pctRef = (0, React.useRef)(null);
	const rootRef = (0, React.useRef)(null);
	(0, React.useEffect)(() => {
		if (splashFinished) {
			onDone();
			return;
		}
		const host = hostRef.current;
		if (!host) return;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const glyph = () => GLYPHS[Math.floor(Math.random() * 57)] ?? "0";
		const build = () => {
			const w = host.clientWidth || window.innerWidth;
			const gap = 18;
			const count = Math.max(12, Math.ceil(w / gap));
			host.replaceChildren();
			for (let i = 0; i < count; i++) {
				const col = document.createElement("div");
				col.className = "matrix-col";
				const len = 22 + i % 10;
				let text = "";
				for (let k = 0; k < len; k++) text += `${glyph()}\n`;
				col.textContent = text;
				const hue = i * 47 % 360;
				col.style.color = `hsl(${hue} 82% 64%)`;
				col.style.left = `${(i + .15) * gap}px`;
				const duration = 7.5 + i % 6 * 1.15;
				col.style.animationDuration = `${duration}s`;
				col.style.animationDelay = `${-Math.random() * duration}s`;
				if (reduce) {
					col.style.animation = "none";
					col.style.top = `${Math.random() * 70}%`;
				}
				host.appendChild(col);
			}
		};
		build();
		const onResize = () => build();
		window.addEventListener("resize", onResize);
		if (!splashOrigin) splashOrigin = performance.now();
		const duration = 5600;
		let tickRaf = 0;
		const progress = (now) => {
			if (splashFinished) return;
			const t = Math.min(1, (now - splashOrigin) / duration);
			const eased = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
			const p = Math.round(eased * 100);
			if (barRef.current) barRef.current.style.width = `${p}%`;
			if (pctRef.current) pctRef.current.textContent = `${p}%`;
			if (t < 1) tickRaf = requestAnimationFrame(progress);
			else {
				splashFinished = true;
				rootRef.current?.classList.add("done");
				window.setTimeout(onDone, 680);
			}
		};
		tickRaf = requestAnimationFrame(progress);
		return () => {
			cancelAnimationFrame(tickRaf);
			window.removeEventListener("resize", onResize);
		};
	}, [onDone]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "splash",
		ref: rootRef,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "matrix-layer",
				ref: hostRef,
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "splash-vignette",
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "splash-glow",
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "splash-inner",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "splash-title",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HorseMark, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "splash-load-label",
						children: "Загрузка"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "splash-track",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "splash-bar",
							ref: barRef
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "splash-pct",
						ref: pctRef,
						children: "0%"
					})
				]
			})
		]
	});
}
var PHRASES = [
	"Бесконечность не предел",
	"Кадр ещё не родился",
	"Ждём удачный сид",
	"Тьма собирает свет",
	"Один промт — много миров",
	"Сид помнит всё",
	"Горизонт ещё не край",
	"Лошадь уже в пути",
	"Здесь появится эфир",
	"Тишина перед кадром",
	"Промт ищет форму",
	"Дальше, чем край кадра",
	"Пыль света ещё не села",
	"Камера держит дыхание",
	"Ночь примеряет цвет",
	"Зерно сида ещё тёплое",
	"Между кадрами есть комната",
	"Тень учится быть светом",
	"Мы на пороге удачного",
	"Эфир слушает промт",
	"Линия ещё не замкнулась",
	"Где-то уже есть этот кадр",
	"Тише. Сейчас проявится",
	"Конь скачет сквозь шум",
	"Свет ищет свою лошадь",
	"Это ещё не финал",
	"Пиксели договариваются",
	"Ожидание тоже монтаж",
	"Кадр выбирает себя",
	"Дальняя комната открыта",
	"Шум становится фактурой",
	"Почти. Ещё один вдох",
	"Тьма не пустая",
	"Сид шепчет номер",
	"Горизонт подмигнул",
	"Плёнка ещё мокрая",
	"Мы держим бесконечность",
	"Сцена собирает кости",
	"Цвет ещё не решил",
	"Здесь будет движение",
	"Ждём, пока мир согласится",
	"Один кадр, потом все",
	"Лошадь не смотрит назад",
	"Эфир тёплый на ощупь",
	"Промт уже в пути",
	"Не моргай слишком рано",
	"Свет складывает крылья",
	"Кадр прячется в шуме",
	"Скоро станет видно"
];
function EtherMark() {
	const [phrase, setPhrase] = (0, React.useState)(0);
	(0, React.useEffect)(() => {
		const id = window.setInterval(() => {
			setPhrase((n) => {
				let next = n;
				while (next === n) next = Math.floor(Math.random() * PHRASES.length);
				return next;
			});
		}, 4200);
		return () => window.clearInterval(id);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ether",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ether-glow",
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HorseMark, { stage: true }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "ether-phrase",
				children: PHRASES[phrase]
			}, phrase)
		]
	});
}
function Stage() {
	const job = useDH((s) => activeVideoJob(s));
	const live = useDH((s) => s.jobs.filter((j) => [
		"sending",
		"waiting",
		"queuing",
		"generating"
	].includes(j.state)).length);
	const ok = useDH((s) => s.jobs.filter((j) => j.state === "success").length);
	const err = useDH((s) => s.jobs.filter((j) => j.state === "fail" || j.state === "error").length);
	const jobs = useDH((s) => s.jobs);
	const activeId = useDH((s) => s.activeJobId);
	const logs = useDH((s) => s.logs);
	const setActiveJob = useDH((s) => s.setActiveJob);
	const clearLog = useDH((s) => s.clearLog);
	const clearJobs = useDH((s) => s.clearJobs);
	const token = useDH((s) => s.token);
	const src = job?.videoUrl || "";
	const [closed, setClosed] = (0, React.useState)("");
	const shown = Boolean(src) && closed !== src;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col stage-col",
		id: "stage-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "stage-player",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "player-wrap native",
					children: [shown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						src,
						controls: true,
						playsInline: true,
						preload: "metadata",
						onError: (e) => {
							const v = e.currentTarget;
							if (!src || v.dataset.fallback === src) return;
							v.dataset.fallback = src;
							v.src = mediaProxySrc(src, token);
						}
					}, src) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EtherMark, {}), shown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "stage-close",
						onClick: () => setClosed(src),
						children: "Закрыть"
					}) : null]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "player-glow" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "stats",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "muted",
						children: "В работе"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "warn",
						children: live
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "muted",
						children: "Готово"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "ok",
						children: ok
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "muted",
						children: "Ошибки"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "bad",
						children: err
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "jobs-head",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "log-title",
					children: "Очередь"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn ghost",
					onClick: () => {
						(async () => {
							if (!jobs.length) return;
							if (await confirmDialog({
								title: "Очистить очередь?",
								body: "Списки «в работе», «готово» и «ошибки» будут стёрты. Сами ролики в архиве останутся.",
								confirmLabel: "Очистить"
							})) {
								clearJobs();
								setClosed("");
							}
						})();
					},
					children: "Очистить"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "jobs",
				children: jobs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted pad",
					children: "Очередь пуста. Запустите генерацию слева."
				}) : jobs.map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `job ${j.id === activeId ? "active" : ""}`,
					onClick: () => {
						setActiveJob(j.id);
						if (j.videoUrl) setClosed("");
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "idx",
							children: ["#", j.index]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `state ${j.state === "success" ? "ok" : j.state === "fail" || j.state === "error" ? "bad" : j.state === "generating" || j.state === "sending" ? "warn" : "muted"}`,
							children: labelOf(j.state)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "msg",
							children: j.message
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "seed",
							children: ["seed ", j.seed]
						})
					]
				}, j.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "log",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "log-head",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "log-title",
						children: "Журнал"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn ghost",
						onClick: () => {
							(async () => {
								if (!logs.length) return;
								if (await confirmDialog({
									title: "Очистить журнал?",
									body: "Записи исчезнут из этого сеанса.",
									confirmLabel: "Очистить"
								})) clearLog();
							})();
						},
						children: "Очистить"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: logs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "muted",
					children: "Здесь будут удачные ответы и ошибки API."
				}) : logs.slice(0, 12).map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "log-line",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "muted",
							children: new Date(line.at).toLocaleTimeString("ru-RU")
						}),
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: line.kind === "ok" ? "ok" : line.kind === "err" ? "bad" : "muted",
							children: line.text
						})
					]
				}, line.id)) })]
			})
		]
	});
}
function labelOf(st) {
	return {
		sending: "Отправка",
		waiting: "Ожидание",
		queuing: "В очереди",
		generating: "Генерация",
		success: "Готово",
		fail: "Ошибка API",
		error: "Сбой"
	}[st] || st;
}
var TITLES = {
	bg: "Задний фон",
	glow: "Подсветка",
	shine: "Сияние",
	win: "Окна",
	btn: "Кнопки",
	log: "Журнал"
};
var KEYS = {
	bg: [
		"bgHue",
		"bgAmt",
		"bgWhite"
	],
	glow: [
		"glowHue",
		"glowAmt",
		"glowWhite"
	],
	shine: [
		"shineHue",
		"shineAmt",
		"shineWhite"
	],
	win: [
		"winHue",
		"winAmt",
		"winWhite"
	],
	btn: [
		"btnHue",
		"btnAmt",
		"btnWhite"
	],
	log: [
		"logHue",
		"logAmt",
		"logWhite"
	]
};
function SettingsDock() {
	const [open, setOpen] = (0, React.useState)(false);
	const [page, setPage] = (0, React.useState)("home");
	const ref = (0, React.useRef)(null);
	(0, React.useEffect)(() => {
		if (!open) return;
		const onDown = (e) => {
			if (!ref.current?.contains(e.target)) setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("mousedown", onDown);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("mousedown", onDown);
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "header-side",
		ref,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: `nav-btn settings-launch${open ? " active" : ""}`,
			onClick: () => {
				setOpen((v) => !v);
				setPage("home");
			},
			children: "Настройки"
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "settings-pop",
			role: "dialog",
			"aria-label": "Настройки",
			children: [
				page === "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "settings-kicker",
						children: "Программа"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("theme"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Тема" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "цвет" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("system"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Система" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "пути" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "settings-row danger",
						onClick: () => {
							(async () => {
								if (!await confirmDialog({
									title: "Стереть все данные?",
									body: "Будут удалены API-ключи, промты, очередь, журнал, архив, кинозал, референсы, сиды и коллекции. Тема вернётся к исходной. Это нельзя отменить.",
									confirmLabel: "Стереть всё",
									danger: true,
									requireCheck: "Я понимаю, что это нельзя отменить"
								})) return;
								await useDH.getState().wipeAll();
								useDH.getState().pushLog("ok", "Все данные программы очищены");
								setOpen(false);
							})();
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Стереть всё" })
					})
				] }) : null,
				page === "system" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SystemPaths, { onBack: () => setPage("home") }) : null,
				page === "theme" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "settings-back",
						onClick: () => setPage("home"),
						children: "← Настройки"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "settings-kicker",
						children: "Тема"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("bg"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Задний фон" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swatch, { kind: "bg" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("glow"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Подсветка" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swatch, { kind: "glow" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("shine"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Сияние" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swatch, { kind: "shine" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("win"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Окна" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swatch, { kind: "win" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("btn"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Кнопки" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swatch, { kind: "btn" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "settings-row",
						onClick: () => setPage("log"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Журнал" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swatch, { kind: "log" })]
					})
				] }) : null,
				page === "bg" || page === "glow" || page === "shine" || page === "win" || page === "btn" || page === "log" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, {
					page,
					onBack: () => setPage("theme")
				}) : null
			]
		}) : null]
	});
}
function Swatch({ kind }) {
	const theme = useDH((s) => s.theme);
	const [hueKey, amtKey, whiteKey] = KEYS[kind];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
		className: "settings-swatch",
		style: { background: tone(theme[hueKey], Math.max(theme[amtKey], 8), theme[whiteKey]) }
	});
}
function Palette({ page, onBack }) {
	const theme = useDH((s) => s.theme);
	const setTheme = useDH((s) => s.setTheme);
	const [hueKey, amtKey, whiteKey] = KEYS[page];
	const hue = theme[hueKey];
	const amt = theme[amtKey];
	const white = theme[whiteKey];
	const paint = tone(hue, amt, white);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "settings-back",
			onClick: onBack,
			children: "← Тема"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "settings-kicker",
			children: TITLES[page]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "palette-preview",
			style: {
				background: paint,
				boxShadow: page === "glow" || page === "shine" ? `0 0 28px ${paint}` : void 0
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: TITLES[page] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "palette-label",
			children: ["Цвет", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "palette-hue",
				type: "range",
				min: 0,
				max: 360,
				value: hue,
				"aria-label": "Цвет",
				onChange: (e) => setTheme({ [hueKey]: Number(e.target.value) }),
				style: { ["--thumb"]: `hsl(${hue} 85% 58%)` }
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "palette-label",
			children: ["Яркость", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "palette-amt",
				type: "range",
				min: 0,
				max: 100,
				value: amt,
				"aria-label": "Яркость",
				onChange: (e) => setTheme({ [amtKey]: Number(e.target.value) }),
				style: {
					background: `linear-gradient(90deg, #050506, hsl(${hue} 100% 46%))`,
					["--thumb"]: tone(hue, amt, 0)
				}
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "palette-label",
			children: ["Насыщенность", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "palette-amt",
				type: "range",
				min: 0,
				max: 100,
				value: white,
				"aria-label": "Насыщенность",
				onChange: (e) => setTheme({ [whiteKey]: Number(e.target.value) }),
				style: {
					background: `linear-gradient(90deg, hsl(${hue} 100% 46%), #f7f7f7)`,
					["--thumb"]: paint
				}
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "muted palette-note",
			children: "Насыщенность: слева чистый цвет, справа белый. Можно сделать белый фон, окна, кнопки и подсветку."
		})
	] });
}
async function uploadInto(file, kind) {
	const token = useDH.getState().token.trim();
	if (!token) throw new Error("Сначала вставьте API-ключ");
	useDH.getState().bumpUploads(1);
	try {
		const thumb = await thumbFromFile(file);
		const url = await uploadFile(token, file);
		return {
			id: uid(),
			url,
			name: file.name,
			thumb: thumb || void 0,
			kind
		};
	} finally {
		useDH.getState().bumpUploads(-1);
	}
}
function FrameField({ label, hint, value, onChange, kind, detail, target }) {
	const inputRef = (0, React.useRef)(null);
	const [pending, setPending] = (0, React.useState)(null);
	const [zoom, setZoom] = (0, React.useState)(null);
	const [over, setOver] = (0, React.useState)(false);
	const shown = pending?.thumb || value?.thumb || (kind === "image" ? value?.url : "") || "";
	const name = pending?.name || value?.name || "";
	const onFiles = async (list) => {
		const file = list?.[0];
		if (!file) return;
		const local = URL.createObjectURL(file);
		setPending({
			name: file.name,
			thumb: local
		});
		try {
			onChange(await uploadInto(file, kind));
			toast(`${label}: загружено`);
			useDH.getState().pushLog("ok", `${label} загружен: ${file.name}`);
		} catch (error) {
			onChange(value);
			const message = error instanceof Error ? error.message : "Ошибка загрузки";
			useDH.getState().pushLog("err", message);
			await alertDialog({
				title: "Не удалось загрузить",
				body: message
			});
		} finally {
			setPending(null);
			URL.revokeObjectURL(local);
		}
	};
	const paste = async () => {
		const url = await promptDialog({
			title: `Ссылка · ${label}`,
			placeholder: "https://"
		});
		if (!url) return;
		if (!/^https?:\/\//i.test(url)) {
			await alertDialog({
				title: "Нужна ссылка",
				body: "Адрес должен начинаться с http:// или https://"
			});
			return;
		}
		onChange({
			id: uid(),
			url,
			name: "Ссылка",
			kind
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "field",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: "label",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `preview-slot ${shown || value?.url ? "has" : ""} ${over ? "drag" : ""}`,
				onDragOver: (e) => {
					e.preventDefault();
					setOver(true);
				},
				onDragLeave: () => setOver(false),
				onDrop: (e) => {
					e.preventDefault();
					setOver(false);
					onFiles(e.dataTransfer.files);
				},
				onContextMenu: (e) => {
					e.preventDefault();
					openMenu(e.clientX, e.clientY, [{
						label: "Копировать ссылку",
						disabled: !value?.url,
						onClick: () => void copyText(value?.url || "")
					}]);
				},
				children: [shown ? kind === "video" && !shown.startsWith("data:") && !shown.startsWith("blob:") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: value?.url,
					poster: value?.thumb,
					muted: true,
					playsInline: true,
					preload: "metadata"
				}) : kind === "video" && value?.url && !pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: value.url,
					poster: value.thumb || shown,
					muted: true,
					playsInline: true,
					preload: "metadata"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: shown,
					alt: name || label,
					onClick: () => setZoom(shown)
				}) : value?.kind === "video" && value.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: value.url,
					muted: true,
					playsInline: true,
					preload: "metadata"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "preview-empty",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CamIcon, {}), dropEmpty(kind)]
				}), pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "preview-veil",
					children: "Загрузка…"
				}) : null]
			}),
			name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "file-name alone",
				children: name
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "row wrap",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "file",
						accept: kind === "video" ? "video/*" : "image/*",
						hidden: true,
						onChange: (e) => {
							onFiles(e.target.files);
							e.target.value = "";
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: () => inputRef.current?.click(),
						children: "С компьютера"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn ghost",
						onClick: () => void paste(),
						children: "Ссылка"
					}),
					detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: () => document.dispatchEvent(new CustomEvent("dh-open-media", { detail: { kind, label, mode: "frame", target } })),
						children: "Подробнее"
					}) : null,
					value || pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn ghost",
						onClick: () => {
							setPending(null);
							onChange(null);
						},
						children: "Очистить"
					}) : null
				]
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "hint",
				children: hint
			}) : null,
			zoom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lightbox",
				onClick: () => setZoom(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: zoom,
					alt: ""
				})
			}) : null
		]
	});
}
function MediaTiles({ label, items, kind, onChange, accept, detail, target }) {
	const inputRef = (0, React.useRef)(null);
	const [busy, setBusy] = (0, React.useState)(0);
	const [zoom, setZoom] = (0, React.useState)(null);
	const addFiles = async (list) => {
		const files = Array.from(list || []);
		if (!files.length) return;
		setBusy(files.length);
		const next = [...items];
		for (const file of files) try {
			const item = await uploadInto(file, kind);
			next.push(item);
			useDH.getState().pushLog("ok", `Загружено: ${file.name}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Ошибка загрузки";
			useDH.getState().pushLog("err", message);
		} finally {
			setBusy((n) => Math.max(0, n - 1));
		}
		onChange(kind === "file" ? next : renumber(next, kind));
	};
	const paste = async () => {
		const url = await promptDialog({
			title: `Ссылка · ${label}`,
			placeholder: "https://"
		});
		if (!url) return;
		if (!/^https?:\/\//i.test(url)) {
			await alertDialog({
				title: "Нужна ссылка",
				body: "Адрес должен начинаться с http:// или https://"
			});
			return;
		}
		onChange(kind === "file" ? [...items, {
			id: uid(),
			url,
			name: "Ссылка",
			kind
		}] : renumber([...items, {
			id: uid(),
			url,
			name: "Ссылка",
			kind
		}], kind));
	};
	const [over, setOver] = (0, React.useState)(false);
	const droppable = kind === "image" || kind === "video";
	const move = (from, to) => {
		if (from === to || kind === "file") return;
		const next = items.slice();
		const [moved] = next.splice(from, 1);
		if (!moved) return;
		next.splice(to, 0, moved);
		onChange(renumber(next, kind));
	};
	const tile = (item, index) => {
		const src = item.thumb || (kind === "image" ? item.url : "");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
			className: "tile",
			draggable: kind !== "file",
			onDragStart: (e) => {
				e.dataTransfer.setData("text/dh-index", String(index));
				e.dataTransfer.effectAllowed = "move";
			},
			onDragOver: (e) => {
				if (kind === "file") return;
				e.preventDefault();
				e.stopPropagation();
			},
			onDrop: (e) => {
				const raw = e.dataTransfer.getData("text/dh-index");
				if (raw === "") return;
				e.preventDefault();
				e.stopPropagation();
				setOver(false);
				move(Number(raw), index);
			},
			onContextMenu: (e) => {
				e.preventDefault();
				openMenu(e.clientX, e.clientY, [{
					label: "Копировать ссылку",
					disabled: !item.url,
					onClick: () => void copyText(item.url)
				}]);
			},
			children: [
				kind !== "file" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tile-num",
					children: index + 1
				}) : null,
				kind === "video" && item.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: item.url,
					poster: item.thumb,
					muted: true,
					playsInline: true,
					preload: "metadata"
				}) : kind === "audio" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tile-file",
					children: "AUD"
				}) : src && kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src,
					alt: item.name,
					onClick: () => setZoom(src)
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tile-file",
					children: extOf(item.name || item.url)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", { children: item.name || "Файл" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "tile-x",
					onClick: () => onChange(kind === "file" ? items.filter((x) => x.id !== item.id) : renumber(items.filter((x) => x.id !== item.id), kind)),
					"aria-label": "Убрать",
					children: "×"
				})
			]
		}, item.id);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "field",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: "label",
				children: label
			}),
			droppable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `preview-slot ${items.length ? "has" : ""} ${over ? "drag" : ""}`,
				onDragOver: (e) => {
					e.preventDefault();
					setOver(true);
				},
				onDragLeave: () => setOver(false),
				onDrop: (e) => {
					e.preventDefault();
					setOver(false);
					if (e.dataTransfer.getData("text/dh-index")) return;
					if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
				},
				children: items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tiles",
					style: {
						padding: 8,
						width: "100%",
						alignSelf: "stretch"
					},
					children: items.map((item, index) => tile(item, index))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "preview-empty",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CamIcon, {}), dropEmpty(kind === "video" ? "video" : "image")]
				})
			}) : items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tiles",
				children: items.map((item, index) => tile(item, index))
			}) : null,
			busy > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "hint",
				children: ["Загрузка… ", busy]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "row wrap",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "file",
						accept,
						multiple: true,
						hidden: true,
						onChange: (e) => {
							addFiles(e.target.files);
							e.target.value = "";
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: () => inputRef.current?.click(),
						children: "С компьютера"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn ghost",
						onClick: () => void paste(),
						children: "+ Ссылка"
					}),
					detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline",
						onClick: () => document.dispatchEvent(new CustomEvent("dh-open-media", { detail: { kind, label, mode: "list", target } })),
						children: "Подробнее"
					}) : null
				]
			}),
			zoom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lightbox",
				onClick: () => setZoom(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: zoom,
					alt: ""
				})
			}) : null
		]
	});
}
function CamIcon() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			fill: "currentColor",
			d: "M8.2 5.2 9.3 3.6h5.4l1.1 1.6H19a1.4 1.4 0 0 1 1.4 1.4v10.4A1.4 1.4 0 0 1 19 18.6H5a1.4 1.4 0 0 1-1.4-1.4V6.6A1.4 1.4 0 0 1 5 5.2h3.2Zm3.8 10.3a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z"
		})
	});
}
function KeyGlyph() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			d: "M14.5 10.2a3.6 3.6 0 1 0-3.3 4.7H9.6l-1.1 1.2H6.8V18H4.8v-2.1l4.6-4.6"
		})
	});
}
function keyOrdinal(index) {
	return index + 1;
}
function dropEmpty(kind) {
	if (kind === "video") return "Загрузить или переместить видео сюда";
	if (kind === "audio") return "Загрузить или переместить аудио сюда";
	return "Загрузить или переместить изображение сюда";
}
function tagOf(kind, n) {
	if (kind === "image") return `@Image${n}`;
	if (kind === "video") return `@Video${n}`;
	return `@Audio${n}`;
}
function renumber(items, kind) {
	return items.map((it, i) => ({
		...it,
		name: tagOf(kind, i + 1)
	}));
}
function extOf(name) {
	return ((name.split("?")[0] || name).split(".").pop() || "file").slice(0, 4).toUpperCase();
}
function LinkList({ items, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "field",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: "label",
				children: "Референс-ссылки"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "list",
				children: items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "list-item",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "input",
						value: item.url,
						placeholder: "https://",
						onChange: (e) => {
							const next = items.slice();
							next[index] = {
								...item,
								url: e.target.value
							};
							onChange(next);
						}
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn outline icon",
						onClick: () => onChange(items.filter((x) => x.id !== item.id)),
						children: "×"
					})]
				}, item.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "btn ghost",
				onClick: () => onChange([...items, {
					id: uid(),
					url: ""
				}]),
				children: "+ Ссылка"
			})
		]
	});
}
function Fold({ id, title, extra, children }) {
	const open = useDH((s) => Boolean(s.folds?.[id]));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fold",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "fold-head",
			onClick: () => useDH.getState().toggleFold(id),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: title }),
				extra || null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: open ? "−" : "+" })
			]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fold-body",
			children
		}) : null]
	});
}
function PromptStack() {
	const slots = useDH((s) => s.promptSlots?.length ? s.promptSlots : [{ id: "slot-1", raw: s.promptRaw || "", flat: s.promptFlat || "" }]);
	const activeId = useDH((s) => s.activePromptId);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "prompt-stack",
		children: [
			slots.map((slot) => {
				const on = slot.id === activeId;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: on ? "prompt-slot on" : "prompt-slot",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "label-row",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "label", children: "Промт" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "prompt-pick",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: on ? "key-check on" : "key-check",
											title: "Использовать этот промт",
											onClick: () => useDH.getState().selectPromptSlot(slot.id),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: on ? "Выбран" : "" })
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "row wrap",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline grow",
									onClick: () => {
										useDH.getState().selectPromptSlot(slot.id);
										document.dispatchEvent(new CustomEvent("dh-open-prompt"));
									},
									children: "Промт"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									disabled: !slot.flat,
									onClick: () => {
										useDH.getState().selectPromptSlot(slot.id);
										void saveCurrentPrompt();
									},
									children: "В коллекцию"
								}),
								slots.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									onClick: () => useDH.getState().removePromptSlot(slot.id),
									children: "Убрать"
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mono preview",
							children: slot.flat || "Не задан. Откройте редактор, вставьте текст и нажмите «Применить»."
						})
					]
				}, slot.id);
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "btn outline",
				onClick: () => useDH.getState().addPromptSlot(),
				children: "Добавить"
			})
		]
	});
}
function StudioForm() {
	const s = useDH();
	const keys = s.apiKeys;
	const credits = s.credits;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "col form-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "form-scroll",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "keys",
					title: "Ключи",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "studio-keys",
						children: keys.map((key, index) => {
							const snap = credits[key.id];
							const on = key.id === s.activeKeyId;
							const balance = !key.token.trim() ? "Нет ключа" : snap?.value != null ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(snap.value)} кр.` : snap?.error ? "Ошибка" : "…";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: on ? "studio-key on" : "studio-key",
								onClick: () => s.selectApiKey(key.id),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["API", keyOrdinal(index)] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyGlyph, {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: balance }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
								]
							}, key.id);
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "model",
					title: "Модель",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "input",
						spellCheck: false,
						value: s.model,
						onChange: (e) => s.setModel(e.target.value)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "prompt",
					title: "Промт",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PromptStack, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "first",
					title: "Стартовый кадр",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FrameField, {
						label: "Стартовый кадр",
						value: s.first,
						kind: "image",
						detail: true,
						target: "first",
						onChange: s.setFirst
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "last",
					title: "Финальный кадр",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FrameField, {
						label: "Финальный кадр",
						value: s.last,
						kind: "image",
						detail: true,
						target: "last",
						onChange: s.setLast
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "refImages",
					title: "Референс-изображения",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaTiles, {
						label: "Референс-изображения",
						items: s.refImages,
						kind: "image",
						accept: "image/*",
						detail: true,
						target: "refImages",
						onChange: (items) => s.setList("refImages", items)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "refVideos",
					title: "Референс-видео",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaTiles, {
						label: "Референс-видео",
						items: s.refVideos,
						kind: "video",
						accept: "video/*",
						detail: true,
						target: "refVideos",
						onChange: (items) => s.setList("refVideos", items)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "refAudios",
					title: "Референс-аудио",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaTiles, {
						label: "Референс-аудио",
						items: s.refAudios,
						kind: "audio",
						accept: "audio/*,.mp3,.wav",
						onChange: (items) => s.setList("refAudios", items)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "links",
					title: "Референс-ссылки",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LinkList, {
						items: s.refLinks,
						onChange: s.setLinks
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "files",
					title: "Референс-файлы",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaTiles, {
						label: "Референс-файлы",
						items: s.refFiles,
						kind: "file",
						onChange: (items) => s.setList("refFiles", items)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "resolution",
					title: "Разрешение",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "seg",
						children: RESOLUTIONS.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: s.resolution === v ? "active" : "",
							onClick: () => s.setResolution(v),
							children: v
						}, v))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "aspect",
					title: "Соотношение сторон",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "seg five",
						children: ASPECTS.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: s.aspect === v ? "active" : "",
							onClick: () => s.setAspect(v),
							children: v
						}, v))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "field",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "label-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "label",
							children: "Длительность"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mono",
							children: [s.duration, " с"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "range",
						type: "range",
						min: 3,
						max: 30,
						step: 1,
						value: s.duration,
						onChange: (e) => s.setDuration(Number(e.target.value))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "label",
							children: "Аудио"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: s.audio ? "toggle on" : "toggle",
							onClick: () => s.setAudio(!s.audio),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "knob" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "toggle-text",
								children: s.audio ? "Вкл" : "Выкл"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "label",
							children: "Проверка NSFW"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: s.nsfw ? "toggle on" : "toggle",
							onClick: () => s.setNsfw(!s.nsfw),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "knob" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "toggle-text",
								children: s.nsfw ? "Вкл" : "Выкл"
							})]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fold, {
					id: "seed",
					title: "Сид",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "input",
							inputMode: "numeric",
							value: String(s.seed),
							onChange: (e) => s.setSeed(Number(e.target.value.replace(/[^\d]/g, "") || 0))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn outline",
							onClick: () => s.randomSeed(),
							children: "Рандом"
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "field",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "label-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "label",
							children: "Количество запросов"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mono",
							children: s.count
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "range",
						type: "range",
						min: 1,
						max: 20,
						step: 1,
						value: s.count,
						onChange: (e) => s.setCount(Number(e.target.value))
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "form-footer",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "btn primary full send",
				disabled: s.sending,
				onClick: () => void s.sendBatch(),
				children: s.sending ? "Запуск…" : s.count === 1 ? "Запуск" : `Запуск ×${s.count}`
			})
		})]
	});
}
async function saveCurrentPrompt() {
	const s = useDH.getState();
	if (!s.promptFlat && !s.promptRaw.trim()) return;
	const picked = await pickDialog({
		title: "Сохранить промт в коллекцию",
		options: s.promptCollections.map((c) => ({
			id: c.id,
			label: c.name,
			hint: `${c.items.length}`
		})),
		createLabel: "Создать коллекцию"
	});
	if (!picked) return;
	const id = picked.type === "new" ? s.createPromptCollection(picked.name) : picked.id;
	useDH.getState().addPrompts(id, [{
		raw: s.promptRaw,
		flat: s.promptFlat
	}]);
	toast("Промт в коллекции");
}
function PromptModal() {
	const openRef = (0, React.useRef)(false);
	const [open, setOpen] = (0, React.useState)(false);
	const [collectId, setCollectId] = (0, React.useState)(null);
	const [draft, setDraft] = (0, React.useState)("");
	const [box, setBox] = (0, React.useState)({
		left: 80,
		top: 48,
		w: 720,
		h: 520
	});
	const drag = (0, React.useRef)(null);
	(0, React.useEffect)(() => {
		const onOpen = (event) => {
			const detail = event.detail;
			const s = useDH.getState();
			setCollectId(detail?.collectId || null);
			setDraft(detail?.empty ? "" : s.promptRaw);
			const w = Math.min(860, Math.max(420, window.innerWidth - 48));
			const h = Math.min(640, Math.max(380, window.innerHeight - 80));
			setBox({
				w,
				h,
				left: Math.max(12, (window.innerWidth - w) / 2),
				top: Math.max(16, (window.innerHeight - h) / 2)
			});
			setOpen(true);
			openRef.current = true;
		};
		document.addEventListener("dh-open-prompt", onOpen);
		const move = (e) => {
			const d = drag.current;
			if (!d) return;
			if (d.kind === "move") setBox((b) => ({
				...b,
				left: Math.max(8, d.left + e.clientX - d.x),
				top: Math.max(8, d.top + e.clientY - d.y)
			}));
			else setBox((b) => ({
				...b,
				w: Math.min(window.innerWidth - 16, Math.max(420, d.w + e.clientX - d.x)),
				h: Math.min(window.innerHeight - 16, Math.max(320, d.h + e.clientY - d.y))
			}));
		};
		const up = () => {
			drag.current = null;
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		return () => {
			document.removeEventListener("dh-open-prompt", onOpen);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
	}, []);
	(0, React.useEffect)(() => {
		const onKey = (e) => {
			if (!open) return;
			if (e.key === "Escape") setOpen(false);
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				useDH.getState().setPrompt(draft);
				setOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, draft]);
	if (!open) return null;
	const flat = flattenPrompt(draft);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "modal",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "modal-window",
			style: {
				left: box.left,
				top: box.top,
				width: box.w,
				height: box.h
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "modal-title",
					onPointerDown: (e) => {
						if (e.target.closest("button")) return;
						drag.current = {
							kind: "move",
							x: e.clientX,
							y: e.clientY,
							...box
						};
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ПРОМТ" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					className: "prompt-area",
					value: draft,
					autoFocus: true,
					placeholder: "Вставьте сценарий. Абзацы можно оставлять — при подтверждении всё станет одной строкой для API.",
					onChange: (e) => setDraft(e.target.value)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flat-box",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "label",
						children: [
							"Строка для запроса · ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: flat.length > 2e4 ? "bad" : "",
								children: flat.length
							}),
							" / 20000"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mono flat-line",
						children: flat || "Пусто"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "modal-actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hint",
						children: "Ctrl+Enter — применить"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "row",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn outline",
								onClick: () => setOpen(false),
								children: "Закрыть"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn ghost",
								onClick: () => {
									const cur = useDH.getState();
									(async () => {
										const picked = await pickDialog({
											title: "Сохранить промт в коллекцию",
											options: cur.promptCollections.map((c) => ({
												id: c.id,
												label: c.name,
												hint: `${c.items.length}`
											})),
											createLabel: "Создать коллекцию"
										});
										if (!picked) return;
										const id = picked.type === "new" ? useDH.getState().createPromptCollection(picked.name) : picked.id;
										useDH.getState().addPrompts(id, [{
											raw: draft,
											flat
										}]);
										toast("Промт в коллекции");
									})();
								},
								children: "В коллекцию"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn primary",
								onClick: () => {
									if (collectId) {
										useDH.getState().addPrompts(collectId, [{
											raw: draft,
											flat
										}]);
										toast("Промт добавлен в коллекцию");
										setOpen(false);
										setCollectId(null);
										return;
									}
									useDH.getState().setPrompt(draft);
									setOpen(false);
								},
								children: collectId ? "В коллекцию" : "Применить"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "resize-handle",
					onPointerDown: (e) => {
						e.stopPropagation();
						drag.current = {
							kind: "resize",
							x: e.clientX,
							y: e.clientY,
							...box
						};
					}
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "prompt-side",
			style: {
				left: Math.min(window.innerWidth - 300, box.left + box.w + 12),
				top: box.top,
				width: 280,
				height: box.h
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "modal-title",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ПОСЛЕДНИЕ" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "prompt-side-list",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecentPrompts, { onPick: setDraft })
			})]
		})]
	});
}
function RecentPrompts({ onPick }) {
	const hits = useDH((s) => s.promptHits);
	if (!hits.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "muted",
		children: "Появятся после запуска генерации."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: hits.map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: () => onPick(hit.raw || hit.flat),
		children: (hit.flat || hit.raw).slice(0, 180)
	}, hit.id)) });
}
var NAV = [
	{
		id: "desk",
		label: "Студия"
	},
	{
		id: "stage",
		label: "Эфир",
		wide: true
	},
	{
		id: "archive",
		label: "Архив"
	},
	{
		id: "cinema",
		label: "Кинозал"
	},
	{
		id: "refs",
		label: "Референсы"
	},
	{
		id: "seeds",
		label: "Сиды"
	},
	{
		id: "prompts",
		label: "Промты"
	},
	{
		id: "assist",
		label: "Ассистент"
	},
	{
		id: "keys",
		label: "Ключи"
	}
];
function DarkHorseApp() {
	const [booted, setBooted] = (0, React.useState)(false);
	const [splash, setSplash] = (0, React.useState)(true);
	const finish = (0, React.useCallback)(() => setSplash(false), []);
	(0, React.useEffect)(() => {
		useDH.getState().hydrate();
		setBooted(true);
		const flush = () => flushPersist();
		window.addEventListener("pagehide", flush);
		window.addEventListener("beforeunload", flush);
		return () => {
			window.removeEventListener("pagehide", flush);
			window.removeEventListener("beforeunload", flush);
		};
	}, []);
	(0, React.useEffect)(() => {
		if (!booted) return;
		const id = window.setInterval(() => void useDH.getState().poll(), 4e3);
		return () => window.clearInterval(id);
	}, [booted]);
	const theme = useDH((s) => s.theme);
	(0, React.useEffect)(() => {
		applyTheme(theme);
	}, [theme]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		splash ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { onDone: finish }) : null,
		splash ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "aura",
			"aria-hidden": true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})]
		}),
		booted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { hidden: splash }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "app app-boot" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHost, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuHost, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToastHost, {})
	] });
}
function Shell({ hidden }) {
	const view = useDH((s) => s.view);
	const model = useDH((s) => s.model);
	const resolution = useDH((s) => s.resolution);
	const aspect = useDH((s) => s.aspect);
	const duration = useDH((s) => s.duration);
	const count = useDH((s) => s.count);
	const sending = useDH((s) => s.sending);
	const jobs = useDH((s) => s.jobs);
	const setView = useDH((s) => s.setView);
	const live = jobs.some((j) => [
		"sending",
		"waiting",
		"queuing",
		"generating"
	].includes(j.state));
	const status = sending ? "Отправка пачки" : live ? "Генерация" : "Готов";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: hidden ? "app app-held" : "app",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "header",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "brand",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HorseMark, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "nav",
						children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `nav-btn${item.wide ? " nav-air" : ""}${view === item.id ? " active" : ""}`,
							onClick: () => setView(item.id === "stage" ? "stage" : item.id),
							children: item.label
						}, item.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsDock, {})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "shell",
				"data-view": view,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioForm, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stage, {}),
					view === "archive" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Archive, {}) : null,
					view === "cinema" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cinema, {}) : null,
					view === "refs" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefsView, {}) : null,
					view === "seeds" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeedsView, {}) : null,
					view === "prompts" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PromptsView, {}) : null,
					view === "assist" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Assist, {}) : null,
					view === "keys" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeysView, {}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "footer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "mono",
					children: [
						model,
						" · ",
						resolution,
						" · ",
						aspect,
						" · ",
						duration,
						"с · ×",
						count
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PromptModal, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaDesk, {})
		]
	});
}
function FolderGlyph() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		className: "folder-glyph",
		viewBox: "0 0 24 24",
		"aria-hidden": true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M3.2 8.2V6.4c0-.9.7-1.6 1.6-1.6h3.7l1.5 1.7h8.2c.9 0 1.6.7 1.6 1.6v8.8c0 .9-.7 1.6-1.6 1.6H4.8c-.9 0-1.6-.7-1.6-1.6V8.2z",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinejoin: "round"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M3.2 10.4h17.6",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.4"
			})
		]
	});
}
async function saveLibraryFolder(kind, folderPath) {
	const next = String(folderPath || "").trim();
	if (!next) return false;
	const apiKind = kind === "hall" ? "cinema" : "refs";
	try {
		const res = await fetch(`/api/library?op=setPath`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ kind: apiKind, path: next })
		});
		const data = await res.json();
		if (data?.ok) {
			useDH.getState().setLibraryPath(kind, data.root || next);
			toast("Путь сохранён");
			return true;
		}
	} catch {}
	useDH.getState().setLibraryPath(kind, next);
	toast("Путь сохранён");
	return true;
}
async function chooseLibraryFolder(kind) {
	try {
		const res = await fetch("/api/library?op=pick", { method: "POST" });
		const data = await res.json();
		if (data?.ok && data.path) {
			await saveLibraryFolder(kind, data.path);
			return true;
		}
	} catch {}
	return false;
}
function SystemPaths({ onBack }) {
	const hallPath = useDH((s) => s.hallPath);
	const refsPath = useDH((s) => s.refsPath);
	const [which, setWhich] = (0, React.useState)(null);
	const [draft, setDraft] = (0, React.useState)("");
	const [busy, setBusy] = (0, React.useState)(false);
	const ask = async (kind) => {
		setBusy(true);
		const picked = await chooseLibraryFolder(kind);
		setBusy(false);
		if (picked) return;
		setWhich(kind);
		setDraft(kind === "hall" ? useDH.getState().hallPath : useDH.getState().refsPath);
	};
	const row = (kind, title, value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "path-row",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "path-row-text",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: title }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: value })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "btn outline path-pick",
				disabled: busy,
				onClick: () => void ask(kind),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderGlyph, {}), "Указать"]
			})
		]
	}, kind);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "settings-back",
			onClick: onBack,
			children: "← Настройки"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "settings-kicker",
			children: "Система"
		}),
		row("hall", "Путь кинозала", hallPath),
		row("refs", "Путь референсов", refsPath),
		which ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "path-modal",
			onClick: () => setWhich(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "path-card",
				onClick: (e) => e.stopPropagation(),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: which === "hall" ? "Путь кинозала" : "Путь референсов" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Проводник не открылся. Вставьте путь к папке вручную или нажмите «Указать» ещё раз."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "input",
						value: draft,
						onChange: (e) => setDraft(e.target.value),
						placeholder: "X:\\Dark Horse"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "row",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "btn outline path-pick",
								onClick: () => {
									void chooseLibraryFolder(which).then((ok) => {
										if (ok) setWhich(null);
									});
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderGlyph, {}), "Указать"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn outline",
								onClick: () => setWhich(null),
								children: "Закрыть"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn primary",
								onClick: () => {
									const next = draft.trim() || (which === "hall" ? "Dark Horse/Кинозал" : "Dark Horse/Референсы");
									void saveLibraryFolder(which, next);
									setWhich(null);
								},
								children: "Сохранить путь"
							})
						]
					})
				]
			})
		}) : null
	] });
}
function cleanStash(stash) {
	const keep = (list) => (Array.isArray(list) ? list : []).filter((it) => it && typeof it.url === "string" && !it.url.startsWith("blob:")).map(({ file, local, ...rest }) => rest);
	return {
		image: keep(stash?.image),
		video: keep(stash?.video)
	};
}
const stashFiles = new Map();
async function dataUrlToFile(dataUrl, name) {
	const res = await fetch(dataUrl);
	const blob = await res.blob();
	return new File([blob], name || "file", { type: blob.type || "application/octet-stream" });
}
async function rememberStashFile(file, kind) {
	const id = uid();
	const thumb = await thumbFromFile(file);
	if (kind === "image") {
		const data = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ""));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
		return {
			id,
			url: data,
			thumb: thumb || data,
			name: file.name,
			kind,
			local: true
		};
	}
	stashFiles.set(id, file);
	return {
		id,
		url: URL.createObjectURL(file),
		thumb: thumb || void 0,
		name: file.name,
		kind,
		local: true
	};
}
function MediaDesk() {
	const [spec, setSpec] = (0, React.useState)(null);
	const [box, setBox] = (0, React.useState)({ left: 72, top: 40, w: 860, h: 620 });
	const [overMain, setOverMain] = (0, React.useState)(false);
	const [overStash, setOverStash] = (0, React.useState)(false);
	const drag = (0, React.useRef)(null);
	const mainInput = (0, React.useRef)(null);
	const stashInput = (0, React.useRef)(null);
	const first = useDH((s) => s.first);
	const last = useDH((s) => s.last);
	const refImages = useDH((s) => s.refImages);
	const refVideos = useDH((s) => s.refVideos);
	const mediaStash = useDH((s) => s.mediaStash);
	(0, React.useEffect)(() => {
		const onOpen = (event) => {
			const detail = event.detail;
			if (!detail) return;
			const w = Math.min(920, Math.max(520, window.innerWidth - 340));
			const h = Math.min(680, Math.max(420, window.innerHeight - 80));
			setBox({
				w,
				h,
				left: Math.max(12, (window.innerWidth - w - 292) / 2),
				top: Math.max(16, (window.innerHeight - h) / 2)
			});
			setSpec(detail);
		};
		const move = (e) => {
			const d = drag.current;
			if (!d) return;
			if (d.kind === "move") setBox((b) => ({
				...b,
				left: Math.max(8, d.left + e.clientX - d.x),
				top: Math.max(8, d.top + e.clientY - d.y)
			}));
			else setBox((b) => ({
				...b,
				w: Math.min(window.innerWidth - 320, Math.max(480, d.w + e.clientX - d.x)),
				h: Math.min(window.innerHeight - 16, Math.max(360, d.h + e.clientY - d.y))
			}));
		};
		const up = () => {
			drag.current = null;
		};
		document.addEventListener("dh-open-media", onOpen);
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		return () => {
			document.removeEventListener("dh-open-media", onOpen);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
	}, []);
	if (!spec) return null;
	const kind = spec.kind === "video" ? "video" : "image";
	const frame = spec.target === "first" || spec.target === "last";
	const items = spec.target === "first" ? first ? [first] : [] : spec.target === "last" ? last ? [last] : [] : spec.target === "refVideos" ? refVideos || [] : refImages || [];
	const stash = (mediaStash && mediaStash[kind]) || [];
	const writeMain = (next) => {
		const store = useDH.getState();
		if (spec.target === "first") store.setFirst(next[0] || null);
		else if (spec.target === "last") store.setLast(next[0] || null);
		else store.setList(spec.target, renumber(next, kind));
	};
	const materialize = async (item) => {
		const file = item.file || stashFiles.get(item.id);
		if (file) return uploadInto(file, kind);
		if (typeof item.url === "string" && item.url.startsWith("data:")) return uploadInto(await dataUrlToFile(item.url, item.name), kind);
		return {
			...item,
			id: uid(),
			kind
		};
	};
	const pushMain = async (item, at) => {
		try {
			const ready = await materialize(item);
			const store = useDH.getState();
			if (frame) {
				if (spec.target === "first") store.setFirst(ready);
				else store.setLast(ready);
				toast(`${spec.label}: добавлено`);
				return;
			}
			const list = [...(store[spec.target] || [])];
			list.splice(at == null ? list.length : at, 0, ready);
			store.setList(spec.target, renumber(list, kind));
			toast("Добавлено в запрос");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Ошибка загрузки";
			useDH.getState().pushLog("err", message);
			await alertDialog({ title: "Не удалось добавить", body: message });
		}
	};
	const takeFiles = async (list, into) => {
		const files = Array.from(list || []);
		if (!files.length) return;
		if (into === "stash") {
			const store = useDH.getState();
			const next = [...((store.mediaStash && store.mediaStash[kind]) || [])];
			for (const file of files) next.push(await rememberStashFile(file, kind));
			store.setMediaStash(kind, next);
			return;
		}
		for (const file of files) {
			try {
				const ready = await uploadInto(file, kind);
				await pushMain(ready);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Ошибка загрузки";
				useDH.getState().pushLog("err", message);
			}
		}
	};
	const pasteInto = async (into) => {
		const url = await promptDialog({
			title: into === "stash" ? "Ссылка в предзагрузку" : `Ссылка · ${spec.label}`,
			placeholder: "https://"
		});
		if (!url) return;
		if (!/^https?:\/\//i.test(url)) {
			await alertDialog({ title: "Нужна ссылка", body: "Адрес должен начинаться с http:// или https://" });
			return;
		}
		const item = { id: uid(), url, name: "Ссылка", kind };
		if (into === "stash") {
			const store = useDH.getState();
			store.setMediaStash(kind, [...((store.mediaStash && store.mediaStash[kind]) || []), item]);
			return;
		}
		await pushMain(item);
	};
	const dropStashId = (e) => e.dataTransfer.getData("text/dh-stash");
	const onMainDrop = (e, at) => {
		e.preventDefault();
		e.stopPropagation();
		setOverMain(false);
		const stashId = dropStashId(e);
		if (stashId) {
			const item = stash.find((x) => x.id === stashId);
			if (item) void pushMain(item, at);
			return;
		}
		const from = e.dataTransfer.getData("text/dh-main");
		if (from !== "" && !frame) {
			const next = items.slice();
			const [moved] = next.splice(Number(from), 1);
			if (!moved) return;
			const dest = at == null ? next.length : at > Number(from) ? at - 1 : at;
			next.splice(dest, 0, moved);
			writeMain(next);
			return;
		}
		if (e.dataTransfer.files?.length) void takeFiles(e.dataTransfer.files, "main");
	};
	const tile = (item, index, source) => {
		const src = item.thumb || (kind === "image" ? item.url : "");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
			className: "tile",
			draggable: true,
			onDragStart: (e) => {
				e.dataTransfer.setData(source === "stash" ? "text/dh-stash" : "text/dh-main", item.id && source === "stash" ? item.id : String(index));
				if (source === "stash") e.dataTransfer.setData("text/dh-stash", item.id);
				else e.dataTransfer.setData("text/dh-main", String(index));
				e.dataTransfer.effectAllowed = "copyMove";
			},
			onDragOver: source === "main" ? (e) => {
				e.preventDefault();
				e.stopPropagation();
			} : void 0,
			onDrop: source === "main" ? (e) => onMainDrop(e, index) : void 0,
			onContextMenu: (e) => {
				e.preventDefault();
				if (source === "stash") openMenu(e.clientX, e.clientY, [{
					label: "Добавить",
					onClick: () => void pushMain(item)
				}, {
					label: "Удалить",
					onClick: () => {
						stashFiles.delete(item.id);
						useDH.getState().setMediaStash(kind, stash.filter((x) => x.id !== item.id));
					}
				}]);
				else openMenu(e.clientX, e.clientY, [{
					label: "Удалить",
					onClick: () => writeMain(items.filter((x) => x.id !== item.id))
				}]);
			},
			children: [
				source === "main" && !frame ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tile-num", children: index + 1 }) : null,
				kind === "video" && item.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: item.url,
					poster: item.thumb,
					muted: true,
					playsInline: true
				}) : src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { src, alt: item.name || "" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tile-file",
					children: extOf(item.name || item.url || "file")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", { children: source === "main" && !frame ? item.name || tagOf(kind, index + 1) : item.name || "Файл" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "tile-x",
					"aria-label": "Убрать",
					onClick: () => {
						if (source === "stash") {
							stashFiles.delete(item.id);
							useDH.getState().setMediaStash(kind, stash.filter((x) => x.id !== item.id));
						} else writeMain(items.filter((x) => x.id !== item.id));
					},
					children: "×"
				})
			]
		}, item.id);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "modal",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "modal-window",
			style: { left: box.left, top: box.top, width: box.w, height: box.h },
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "modal-title",
					onPointerDown: (e) => {
						if (e.target.closest("button")) return;
						drag.current = { kind: "move", x: e.clientX, y: e.clientY, ...box };
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: spec.label || "Медиа" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `desk-stage ${overMain ? "drag" : ""}`,
					onDragOver: (e) => { e.preventDefault(); setOverMain(true); },
					onDragLeave: () => setOverMain(false),
					onDrop: (e) => onMainDrop(e),
					children: items.length ? frame ? kind === "video" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						className: "desk-frame",
						src: items[0].url,
						poster: items[0].thumb,
						muted: true,
						playsInline: true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						className: "desk-frame",
						src: items[0].thumb || items[0].url,
						alt: items[0].name || ""
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tiles desk-tiles",
						children: items.map((item, index) => tile(item, index, "main"))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "desk-empty",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CamIcon, {}), dropEmpty(kind)]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "modal-actions",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: mainInput,
							type: "file",
							accept: kind === "video" ? "video/*" : "image/*",
							multiple: !frame,
							hidden: true,
							onChange: (e) => { void takeFiles(e.target.files, "main"); e.target.value = ""; }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "row",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn outline",
									onClick: () => mainInput.current?.click(),
									children: "С компьютера"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn ghost",
									onClick: () => void pasteInto("main"),
									children: "Ссылка"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn outline",
							onClick: () => setSpec(null),
							children: "Закрыть"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "resize-handle",
					onPointerDown: (e) => {
						e.stopPropagation();
						drag.current = { kind: "resize", x: e.clientX, y: e.clientY, ...box };
					}
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "prompt-side",
			style: {
				left: Math.min(window.innerWidth - 292, box.left + box.w + 12),
				top: box.top,
				width: 280,
				height: box.h
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "modal-title",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ПРЕДЗАГРУЗКА" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "row wrap",
					style: { padding: "8px 8px 0" },
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: stashInput,
							type: "file",
							accept: kind === "video" ? "video/*" : "image/*",
							multiple: true,
							hidden: true,
							onChange: (e) => { void takeFiles(e.target.files, "stash"); e.target.value = ""; }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn outline",
							onClick: () => stashInput.current?.click(),
							children: "С компьютера"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn ghost",
							onClick: () => void pasteInto("stash"),
							children: "Ссылка"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn ghost",
							disabled: !stash.length,
							onClick: () => {
								stash.forEach((item) => stashFiles.delete(item.id));
								useDH.getState().setMediaStash(kind, []);
							},
							children: "Очистить"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `prompt-side-list stash-drop ${overStash ? "drag" : ""}`,
					style: {
						flex: "1 1 auto",
						minHeight: 0,
						overflowY: "auto",
						overflowX: "hidden"
					},
					onDragOver: (e) => { e.preventDefault(); setOverStash(true); },
					onDragLeave: () => setOverStash(false),
					onDrop: (e) => {
						e.preventDefault();
						setOverStash(false);
						if (e.dataTransfer.files?.length) void takeFiles(e.dataTransfer.files, "stash");
					},
					children: stash.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tiles stash-grid",
						children: stash.map((item, index) => tile(item, index, "stash"))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "muted",
						children: "Сюда можно заранее сложить файлы. В запрос они не идут, пока не перетащите их влево или не выберете «Добавить»."
					})
				})
			]
		})]
	});
}
export { DarkHorseApp, useDH };
export default DarkHorseApp;
