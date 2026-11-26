from pathlib import Path
import re

p = Path("src/darkhorse/engine.jsx")
t = p.read_text(encoding="utf-8")

if "async function revealLibrary(kind, folder)" not in t:
    m = re.search(r"function revealLibrary\(path\) \{[\s\S]*?\n\}", t)
    if m:
        new = '''async function revealLibrary(kind, folder) {
\tconst k = kind === "refs" ? "refs" : "cinema";
\tconst folderName = folder || "";
\ttry {
\t\tconst res = await fetch("/api/library?op=open", {
\t\t\tmethod: "POST",
\t\t\theaders: { "content-type": "application/json" },
\t\t\tbody: JSON.stringify({ kind: k, folder: folderName })
\t\t});
\t\tconst data = await res.json();
\t\tif (data && data.ok) {
\t\t\ttoast(data.path ? `Открыто: ${data.path}` : "Папка открыта");
\t\t\treturn;
\t\t}
\t} catch {}
\ttry {
\t\tif (typeof window !== "undefined" && window.darkHorseDesktop?.openPath) {
\t\t\tconst res = await fetch("/api/library?op=status");
\t\t\tconst st = await res.json();
\t\t\tconst root = k === "refs" ? st.refsRoot : st.cinemaRoot;
\t\t\tconst target = folderName ? `${root}/${folderName}` : root;
\t\t\tconst ok = await window.darkHorseDesktop.openPath(target);
\t\t\tif (ok) {
\t\t\t\ttoast(`Открыто: ${target}`);
\t\t\t\treturn;
\t\t\t}
\t\t}
\t} catch {}
\tvoid alertDialog({
\t\ttitle: "Локальный путь",
\t\tbody: `Не удалось открыть проводник автоматически.\\nПапка: ${folderName || (k === "refs" ? "Референсы" : "Кинозал")}\\n\\nУкажите путь в Настройки → Система.`
\t});
}'''
        t = t[: m.start()] + new + t[m.end() :]
        reps = [
            (
                'onClick: () => revealLibrary(useDH.getState().hallPath + "/" + album.name),',
                'onClick: () => { void revealLibrary("cinema", album.name); },',
            ),
            (
                "onClick: () => revealLibrary(useDH.getState().hallPath),",
                'onClick: () => { void revealLibrary("cinema"); },',
            ),
            (
                "onClick: () => revealLibrary(`${useDH.getState().refsPath}/${folder.name}`),",
                'onClick: () => { void revealLibrary("refs", folder.name); },',
            ),
            (
                "onClick: () => revealLibrary(useDH.getState().refsPath),",
                'onClick: () => { void revealLibrary("refs"); },',
            ),
        ]
        for a, b in reps:
            t = t.replace(a, b, 1)

if "darkHorseDesktop?.saveState" not in t:
    old = """function writePersisted(data) {
\tconst safe = storageSafe(data);
\twriteSettings(safe);
\ttry {
\t\tlocalStorage.setItem(KEY, JSON.stringify(safe));
\t} catch {
\t\ttry {
\t\t\tconst slim = {
\t\t\t\t...safe,
\t\t\t\tfirst: safe.first ? { ...safe.first, thumb: void 0 } : null,
\t\t\t\tlast: safe.last ? { ...safe.last, thumb: void 0 } : null,
\t\t\t\trefImages: (safe.refImages || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefVideos: (safe.refVideos || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefAudios: (safe.refAudios || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefFiles: (safe.refFiles || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefAssets: (safe.refAssets || []).map((x) => ({ ...x, thumb: void 0 }))
\t\t\t};
\t\t\tlocalStorage.setItem(KEY, JSON.stringify(slim));
\t\t} catch {}
\t}
}"""
    new = """function writePersisted(data) {
\tconst safe = storageSafe(data);
\twriteSettings(safe);
\tconst payload = JSON.stringify(safe);
\ttry {
\t\tlocalStorage.setItem(KEY, payload);
\t} catch {
\t\ttry {
\t\t\tconst slim = {
\t\t\t\t...safe,
\t\t\t\tfirst: safe.first ? { ...safe.first, thumb: void 0 } : null,
\t\t\t\tlast: safe.last ? { ...safe.last, thumb: void 0 } : null,
\t\t\t\trefImages: (safe.refImages || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefVideos: (safe.refVideos || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefAudios: (safe.refAudios || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefFiles: (safe.refFiles || []).map((x) => ({ ...x, thumb: void 0 })),
\t\t\t\trefAssets: (safe.refAssets || []).map((x) => ({ ...x, thumb: void 0 }))
\t\t\t};
\t\t\tlocalStorage.setItem(KEY, JSON.stringify(slim));
\t\t} catch {}
\t}
\ttry {
\t\tif (typeof window !== "undefined" && window.darkHorseDesktop?.saveState) {
\t\t\tvoid window.darkHorseDesktop.saveState(payload);
\t\t}
\t} catch {}
}"""
    if old in t:
        t = t.replace(old, new, 1)

if "hydrate: async () =>" not in t:
    old = """\t\thydrate: () => {
\t\t\tconst data = readPersisted();
\t\t\tif (!data) {
\t\t\t\tset({ seed: Math.floor(Math.random() * SEED_MAX) + 1 });
\t\t\t\tpersistReady = true;
\t\t\t\treturn;
\t\t\t}"""
    new = """\t\thydrate: async () => {
\t\t\tlet data = readPersisted();
\t\t\tif (!data) {
\t\t\t\ttry {
\t\t\t\t\tif (typeof window !== "undefined" && window.darkHorseDesktop?.loadState) {
\t\t\t\t\t\tconst raw = await window.darkHorseDesktop.loadState();
\t\t\t\t\t\tif (raw) {
\t\t\t\t\t\t\tconst parsed = JSON.parse(raw);
\t\t\t\t\t\t\tif (parsed && typeof parsed === "object") data = slotsFrom(parsed);
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t} catch {}
\t\t\t}
\t\t\tif (!data) {
\t\t\t\tset({ seed: Math.floor(Math.random() * SEED_MAX) + 1 });
\t\t\t\tpersistReady = true;
\t\t\t\treturn;
\t\t\t}"""
    if old in t:
        t = t.replace(old, new, 1)

if "commit({ view })" not in t:
    t = t.replace(
        "\t\tsetView: (view) => set({ view }),",
        "\t\tsetView: (view) => {\n\t\t\tcommit({ view });\n\t\t},",
        1,
    )

if "view: s.view," not in t:
    t = t.replace(
        "function persistedSlice(s) {\n\treturn {\n\t\ttoken: s.token,",
        "function persistedSlice(s) {\n\treturn {\n\t\tview: s.view,\n\t\ttoken: s.token,",
        1,
    )

if "setInterval(flush" not in t:
    old = """\t\twindow.addEventListener("pagehide", flush);
\t\twindow.addEventListener("beforeunload", flush);
\t\treturn () => {
\t\t\twindow.removeEventListener("pagehide", flush);
\t\t\twindow.removeEventListener("beforeunload", flush);
\t\t};"""
    new = """\t\twindow.addEventListener("pagehide", flush);
\t\twindow.addEventListener("beforeunload", flush);
\t\twindow.addEventListener("visibilitychange", () => {
\t\t\tif (document.visibilityState === "hidden") flush();
\t\t});
\t\tconst iv = window.setInterval(flush, 5000);
\t\treturn () => {
\t\t\twindow.removeEventListener("pagehide", flush);
\t\t\twindow.removeEventListener("beforeunload", flush);
\t\t\twindow.clearInterval(iv);
\t\t};"""
    if old in t:
        t = t.replace(old, new, 1)

p.write_text(t, encoding="utf-8")
print("patched engine", len(t))
