import { pickDownloadUrl } from "./kie";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function isSafeUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "metadata.google.internal") return false;
  if (h.includes(":")) return false;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const a = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (a[0] === 10 || a[0] === 127 || a[0] === 0) return false;
    if (a[0] === 169 && a[1] === 254) return false;
    if (a[0] === 192 && a[1] === 168) return false;
    if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return false;
    if (a[0] === 100 && a[1] >= 64 && a[1] <= 127) return false;
  }
  return true;
}

async function readToken(request: Request, url: URL) {
  return request.headers.get("x-kie-token") || url.searchParams.get("t") || "";
}

async function handleCreate(token: string, request: Request) {
  let body: { payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const payload = body?.payload;
  if (!payload || typeof payload !== "object") return json({ error: "Нет payload" }, 400);
  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json({ httpStatus: res.status, jsonText: await res.text() });
}

async function handlePoll(token: string, request: Request) {
  let taskId = "";
  try {
    const body = await request.json();
    taskId = String(body.taskId || "");
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (!taskId) return json({ error: "Нет taskId" }, 400);
  const u = new URL("https://api.kie.ai/api/v1/jobs/recordInfo");
  u.searchParams.set("taskId", taskId);
  const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
  return json({ httpStatus: res.status, jsonText: await res.text() });
}

async function handleUpload(token: string, request: Request) {
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "Нет файла" }, 400);
  if (file.size > 83886080) return json({ ok: false, error: "Файл больше 80 МБ — попробуйте прямую загрузку" }, 413);
  const out = new FormData();
  out.append("file", file, file.name || "upload.bin");
  out.append("uploadPath", "images/user-uploads");
  out.append("fileName", file.name || "upload.bin");
  const res = await fetch("https://kieai.redpandaai.co/api/file-stream-upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: out,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ ok: false, error: text.slice(0, 240) || `HTTP ${res.status}` });
  }
  const url = pickDownloadUrl(parsed);
  if (!url) {
    const rec = parsed as { msg?: unknown; message?: unknown; error?: unknown };
    const msg = rec.msg || rec.message || rec.error;
    return json({ ok: false, error: typeof msg === "string" ? msg : "Kie не вернул ссылку" });
  }
  return json({ ok: true, url });
}

async function handleCredit(token: string) {
  const res = await fetch("https://api.kie.ai/api/v1/chat/credit", { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let parsed: { data?: unknown; msg?: unknown; message?: unknown; error?: unknown } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ ok: false, error: text.slice(0, 180) || `HTTP ${res.status}` }, 502);
  }
  const data = parsed.data;
  const credits = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(credits)) {
    const msg = parsed.msg || parsed.message || parsed.error;
    return json({ ok: false, error: typeof msg === "string" ? msg : "Нет баланса" });
  }
  return json({ ok: true, credits });
}

async function handleMedia(request: Request, url: URL) {
  const target = url.searchParams.get("url") || "";
  if (!isSafeUrl(target)) return json({ error: "Ссылка отклонена" }, 400);
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  const res = await fetch(target, { headers });
  const out = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = res.headers.get(key);
    if (v) out.set(key, v);
  }
  if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");
  out.set("cache-control", "private, max-age=3600");
  return new Response(res.body, { status: res.status, headers: out });
}

export async function handleKie(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "";
  try {
    if (op === "media" && request.method === "GET") {
      if (!(await readToken(request, url))) return json({ error: "Нет API-ключа" }, 401);
      return await handleMedia(request, url);
    }
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const token = await readToken(request, url);
    if (!token) return json({ ok: false, error: "Нет API-ключа" }, 401);
    if (op === "create") return await handleCreate(token, request);
    if (op === "poll") return await handlePoll(token, request);
    if (op === "upload") return await handleUpload(token, request);
    if (op === "credit") return await handleCredit(token);
    return json({ error: "Неизвестная операция" }, 400);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Сбой запроса" }, 502);
  }
}
