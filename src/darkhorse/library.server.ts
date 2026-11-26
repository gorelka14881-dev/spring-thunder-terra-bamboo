import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

type Meta = {
  cinemaChosen: string | null;
  refsChosen: string | null;
};

function dataRoot() {
  // Electron sets DH_HOME = <userData>/DarkHorseData/Dark Horse
  if (process.env.DH_HOME) return path.dirname(process.env.DH_HOME);
  // Fallback writable location
  return path.join(os.homedir(), "DarkHorseData");
}

function homeDir() {
  return process.env.DH_HOME || path.join(dataRoot(), "Dark Horse");
}

function metaFile() {
  return path.join(dataRoot(), "library.json");
}

function defaultChosen() {
  return dataRoot();
}

async function readMeta(): Promise<Meta> {
  try {
    const raw = JSON.parse(await fs.readFile(metaFile(), "utf8")) as Partial<Meta>;
    return {
      cinemaChosen: typeof raw.cinemaChosen === "string" ? raw.cinemaChosen : null,
      refsChosen: typeof raw.refsChosen === "string" ? raw.refsChosen : null,
    };
  } catch {
    return { cinemaChosen: null, refsChosen: null };
  }
}

async function writeMeta(meta: Meta) {
  await fs.mkdir(path.dirname(metaFile()), { recursive: true });
  await fs.writeFile(metaFile(), JSON.stringify(meta, null, 2));
}

function kindFolder(kind: string) {
  // English folder names to avoid path issues; UI can still say Russian
  return kind === "refs" ? "References" : "Cinema";
}

function rootFor(meta: Meta, kind: string) {
  const chosen = kind === "refs" ? meta.refsChosen : meta.cinemaChosen;
  const base = chosen && path.isAbsolute(chosen) ? chosen : defaultChosen();
  // If user pointed directly at Cinema/References, use as-is
  const baseName = path.basename(base).toLowerCase();
  if (baseName === "cinema" || baseName === "кинозал" || baseName === "references" || baseName === "референсы") {
    return base;
  }
  return path.join(base, "Dark Horse", kindFolder(kind));
}

function safeSegment(name: string) {
  const clean = name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean === "." || clean === "..") return "";
  return clean.slice(0, 120);
}

function inside(root: string, target: string) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

async function ensure(meta: Meta) {
  await fs.mkdir(rootFor(meta, "cinema"), { recursive: true });
  await fs.mkdir(rootFor(meta, "refs"), { recursive: true });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function copyTree(from: string, to: string) {
  try {
    await fs.access(from);
  } catch {
    return;
  }
  await fs.mkdir(to, { recursive: true });
  await fs.cp(from, to, { recursive: true, force: true });
}

async function dirEmpty(dir: string) {
  try {
    const items = await fs.readdir(dir);
    return items.length === 0;
  } catch {
    return true;
  }
}

async function moveKind(meta: Meta, kind: string, chosen: string) {
  const nextChosen = path.resolve(chosen);
  const stat = await fs.stat(nextChosen).catch(() => null);
  if (!stat?.isDirectory()) return { ok: false, error: "Это не папка" };
  const oldRoot = rootFor(meta, kind);
  const nextMeta = {
    ...meta,
    ...(kind === "refs" ? { refsChosen: nextChosen } : { cinemaChosen: nextChosen }),
  };
  const newRoot = rootFor(nextMeta, kind);
  if (path.resolve(oldRoot) !== path.resolve(newRoot)) {
    await fs.mkdir(newRoot, { recursive: true });
    await copyTree(oldRoot, newRoot);
    const oldParent = path.dirname(oldRoot);
    if (path.basename(oldParent) === "Dark Horse" && inside(oldParent, oldRoot)) {
      await fs.rm(oldRoot, { recursive: true, force: true });
      if (await dirEmpty(oldParent)) await fs.rm(oldParent, { recursive: true, force: true });
    }
  } else {
    await fs.mkdir(newRoot, { recursive: true });
  }
  await writeMeta(nextMeta);
  await ensure(nextMeta);
  return { ok: true, meta: nextMeta, root: newRoot };
}

function runFile(cmd: string, args: string[], timeout = 180000) {
  return new Promise<{ stdout: string }>((resolve, reject) => {
    execFile(cmd, args, { timeout, windowsHide: false }, (error, stdout) => {
      if (error) reject(error);
      else resolve({ stdout: String(stdout || "") });
    });
  });
}

async function pickLocalFolder() {
  const bridge = process.env.DH_BRIDGE_URL;
  if (bridge) {
    try {
      const res = await fetch(`${bridge}/pick`, { method: "POST" });
      const data = (await res.json()) as { path?: string | null };
      return data.path || null;
    } catch {
      return null;
    }
  }
  if (process.platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$d.Description = 'Выберите папку'",
      "$d.ShowNewFolderButton = $true",
      "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }",
    ].join("; ");
    const { stdout } = await runFile("powershell.exe", ["-NoProfile", "-STA", "-Command", script]);
    return stdout.trim() || null;
  }
  if (process.platform === "darwin") {
    const { stdout } = await runFile("osascript", ["-e", "POSIX path of (choose folder with prompt \"Выберите папку\")"]);
    return stdout.trim().replace(/\/$/, "") || null;
  }
  for (const [cmd, args] of [
    ["zenity", ["--file-selection", "--directory", "--title=Выберите папку"]],
    ["kdialog", ["--getexistingdirectory", "."]],
  ] as const) {
    try {
      const { stdout } = await runFile(cmd, [...args]);
      const picked = stdout.trim();
      if (picked) return picked;
    } catch {
      /* next picker */
    }
  }
  return null;
}

async function openInShell(target: string) {
  const bridge = process.env.DH_BRIDGE_URL;
  if (bridge) {
    try {
      await fetch(`${bridge}/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: target }),
      });
    } catch {}
    return;
  }
  const platform = process.platform;
  if (platform === "win32") spawn("explorer", [target], { detached: true, stdio: "ignore" }).unref();
  else if (platform === "darwin") spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  else spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
}

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

export async function handleLibrary(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "";
  try {
    let meta = await readMeta();
    await ensure(meta);
    if (op === "status") {
      return json({
        ok: true,
        cinemaRoot: rootFor(meta, "cinema"),
        refsRoot: rootFor(meta, "refs"),
        cinemaChosen: meta.cinemaChosen || defaultChosen(),
        refsChosen: meta.refsChosen || defaultChosen(),
      });
    }
    if (op === "file" && request.method === "GET") {
      const kind = url.searchParams.get("kind") === "refs" ? "refs" : "cinema";
      const folder = safeSegment(url.searchParams.get("folder") || "");
      const name = safeSegment(url.searchParams.get("name") || "");
      if (!folder || !name) return json({ error: "Нет файла" }, 400);
      const file = path.join(rootFor(meta, kind), folder, name);
      const root = rootFor(meta, kind);
      if (!inside(root, file)) return json({ error: "Путь отклонён" }, 400);
      const data = await fs.readFile(file);
      const ext = path.extname(name).toLowerCase();
      return new Response(data, {
        headers: {
          "content-type": MIME[ext] || "application/octet-stream",
          "cache-control": "private, max-age=60",
        },
      });
    }
    if (request.method !== "POST") return json({ error: "method" }, 405);
    if (op === "pick") {
      const pathPicked = await pickLocalFolder();
      if (!pathPicked) return json({ ok: false, manual: true });
      return json({ ok: true, path: pathPicked });
    }
    if (op === "setPath") {
      const body = (await request.json()) as { kind?: string; path?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      if (!body.path) return json({ ok: false, error: "Укажите папку" }, 400);
      const result = await moveKind(meta, kind, body.path);
      return json(result, result.ok ? 200 : 400);
    }
    if (op === "open") {
      const body = (await request.json()) as { kind?: string; folder?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      const root = rootFor(meta, kind);
      const folder = body.folder ? safeSegment(body.folder) : "";
      const target = folder ? path.join(root, folder) : root;
      if (!inside(root, target)) return json({ error: "Путь отклонён" }, 400);
      await fs.mkdir(target, { recursive: true });
      await openInShell(target);
      return json({ ok: true, path: target });
    }
    if (op === "list") {
      const body = (await request.json()) as { kind?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      const root = rootFor(meta, kind);
      const entries = await fs.readdir(root, { withFileTypes: true });
      const folders = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const full = path.join(root, entry.name);
        const kids = await fs.readdir(full).catch(() => []);
        const st = await fs.stat(full);
        folders.push({ name: entry.name, count: kids.length, mtime: st.mtimeMs });
      }
      folders.sort((a, b) => b.mtime - a.mtime);
      return json({ ok: true, root, folders });
    }
    if (op === "files") {
      const body = (await request.json()) as { kind?: string; folder?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      const folder = safeSegment(body.folder || "");
      if (!folder) return json({ ok: false, error: "Нет папки" }, 400);
      const dir = path.join(rootFor(meta, kind), folder);
      if (!inside(rootFor(meta, kind), dir)) return json({ error: "Путь отклонён" }, 400);
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const files = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const st = await fs.stat(path.join(dir, entry.name));
        files.push({ name: entry.name, size: st.size, mtime: st.mtimeMs });
      }
      files.sort((a, b) => b.mtime - a.mtime);
      return json({ ok: true, files });
    }
    if (op === "mkdir") {
      const body = (await request.json()) as { kind?: string; name?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      const name = safeSegment(body.name || "");
      if (!name) return json({ ok: false, error: "Пустое имя" }, 400);
      await fs.mkdir(path.join(rootFor(meta, kind), name), { recursive: true });
      return json({ ok: true, name });
    }
    if (op === "rename") {
      const body = (await request.json()) as { kind?: string; from?: string; to?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      const from = safeSegment(body.from || "");
      const to = safeSegment(body.to || "");
      if (!from || !to) return json({ ok: false, error: "Имя" }, 400);
      const root = rootFor(meta, kind);
      await fs.rename(path.join(root, from), path.join(root, to));
      return json({ ok: true });
    }
    if (op === "rmdir") {
      const body = (await request.json()) as { kind?: string; name?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      const name = safeSegment(body.name || "");
      if (!name) return json({ ok: false }, 400);
      const root = rootFor(meta, kind);
      const target = path.join(root, name);
      if (!inside(root, target)) return json({ error: "Путь отклонён" }, 400);
      await fs.rm(target, { recursive: true, force: true });
      return json({ ok: true });
    }
    if (op === "clear") {
      const body = (await request.json()) as { kind?: string; folder?: string };
      const kind = body.kind === "refs" ? "refs" : "cinema";
      const root = rootFor(meta, kind);
      if (body.folder) {
        const name = safeSegment(body.folder);
        const dir = path.join(root, name);
        if (!inside(root, dir)) return json({ error: "Путь отклонён" }, 400);
        const entries = await fs.readdir(dir).catch(() => []);
        await Promise.all(entries.map((entry) => fs.rm(path.join(dir, entry), { recursive: true, force: true })));
      } else {
        const entries = await fs.readdir(root).catch(() => []);
        await Promise.all(entries.map((entry) => fs.rm(path.join(root, entry), { recursive: true, force: true })));
      }
      return json({ ok: true });
    }
    if (op === "put") {
      const form = await request.formData();
      const kind = form.get("kind") === "refs" ? "refs" : "cinema";
      const folder = safeSegment(String(form.get("folder") || ""));
      const file = form.get("file");
      if (!folder || !(file instanceof File)) return json({ ok: false, error: "Нет файла" }, 400);
      const name = safeSegment(file.name || "file.bin") || "file.bin";
      const root = rootFor(meta, kind);
      const dir = path.join(root, folder);
      if (!inside(root, dir)) return json({ error: "Путь отклонён" }, 400);
      await fs.mkdir(dir, { recursive: true });
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(dir, name), buf);
      return json({ ok: true, name });
    }
    return json({ error: "Неизвестная операция" }, 400);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Сбой" }, 500);
  }
}
