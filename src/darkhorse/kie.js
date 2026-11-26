function pickDownloadUrl(json) {
	if (!json || typeof json !== "object") return null;
	const root = json;
	const data = root.data && typeof root.data === "object" ? root.data : root;
	for (const key of [
		"downloadUrl",
		"fileUrl",
		"url",
		"file_url",
		"download_url"
	]) {
		const value = data[key];
		if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
	}
	return null;
}
function parseJson(text) {
	try {
		const p = JSON.parse(text);
		if (p && typeof p === "object" && !Array.isArray(p)) return p;
		return { msg: String(text).slice(0, 400) };
	} catch {
		return { msg: String(text).slice(0, 400) };
	}
}
function messageFromKie(json, fallback) {
	const data = json.data && typeof json.data === "object" ? json.data : null;
	const msg = json.msg;
	const message = json.message;
	const error = json.error;
	const fail = data?.failMsg;
	if (typeof msg === "string" && msg) return msg;
	if (typeof message === "string" && message) return message;
	if (typeof error === "string" && error) return error;
	if (typeof fail === "string" && fail) return fail;
	return fallback;
}
function extractVideoUrls(resultJson) {
	let parsed = resultJson;
	if (typeof resultJson === "string" && resultJson.trim()) try {
		parsed = JSON.parse(resultJson);
	} catch {
		if (/^https?:\/\//i.test(resultJson.trim())) return [resultJson.trim()];
		return [];
	}
	const urls = [];
	const walk = (v) => {
		if (typeof v === "string" && /^https?:\/\//i.test(v)) urls.push(v);
		else if (Array.isArray(v)) v.forEach(walk);
		else if (v && typeof v === "object") Object.values(v).forEach(walk);
	};
	if (parsed && typeof parsed === "object") {
		const o = parsed;
		const direct = o.resultUrls || o.result_urls || o.videoUrl || o.video_url;
		if (typeof direct === "string") urls.push(direct);
		if (Array.isArray(direct)) {
			for (const item of direct) if (typeof item === "string") urls.push(item);
			else if (item && typeof item === "object") {
				const rec = item;
				const u = rec.url || rec.resultUrl || rec.video_url || rec.videoUrl;
				if (typeof u === "string") urls.push(u);
			}
		}
	}
	if (!urls.length) walk(parsed);
	return [...new Set(urls.filter(Boolean))];
}
function flattenPrompt(text) {
	return String(text || "").replace(/\r\n/g, "\n").replace(/\n+/g, " ").replace(/\t+/g, " ").replace(/[ \u00a0]{2,}/g, " ").trim();
}
function uid() {
	return crypto.randomUUID();
}

export { pickDownloadUrl, parseJson, messageFromKie, extractVideoUrls, flattenPrompt, uid };
