const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const IS_PACKAGED = app.isPackaged;
const ROOT = IS_PACKAGED
  ? path.join(process.resourcesPath, "app")
  : path.join(__dirname, "..");

const STATIC_DIR = path.join(ROOT, ".vercel", "output", "static");
const SERVER_DIR = path.join(ROOT, ".vercel", "output", "functions", "__server.func");
const SERVER_ENTRY = path.join(SERVER_DIR, "index.mjs");
const DATA_DIR = path.join(app.getPath("userData"), "DarkHorseData");
const PORT = 18765;
const BRIDGE_PORT = 18766;

let mainWindow = null;
let bridgeServer = null;
let appServer = null;

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "Dark Horse", "Cinema"), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "Dark Horse", "References"), { recursive: true });
}

async function pickFolder() {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: "Выберите папку",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths?.length) return null;
  return result.filePaths[0];
}

function startBridge() {
  bridgeServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === "/pick" && req.method === "POST") {
      try {
        const folder = await pickFolder();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ path: folder }));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ path: null, error: String(e) }));
      }
      return;
    }
    if (req.url === "/open" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", async () => {
        try {
          const data = JSON.parse(body || "{}");
          if (data.path) await shell.openPath(String(data.path));
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  bridgeServer.listen(BRIDGE_PORT, "127.0.0.1");
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
  };
  return types[ext] || "application/octet-stream";
}

function tryServeStatic(req, res) {
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (!urlPath || urlPath === "/") return false;
    const filePath = path.normalize(path.join(STATIC_DIR, urlPath));
    if (!filePath.startsWith(STATIC_DIR)) return false;
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "content-type": contentType(filePath) });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function nodeReqToWebRequest(req, bodyBuf) {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const url = `http://${host}${req.url || "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }
  const method = req.method || "GET";
  const init = { method, headers };
  if (bodyBuf && bodyBuf.length && method !== "GET" && method !== "HEAD") {
    init.body = bodyBuf;
  }
  return new Request(url, init);
}

async function webResponseToNode(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function startNitroHttp() {
  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error("SERVER_ENTRY missing: " + SERVER_ENTRY);
  }

  process.env.PORT = String(PORT);
  process.env.HOST = "127.0.0.1";
  process.env.NITRO_PORT = String(PORT);
  process.env.NITRO_HOST = "127.0.0.1";
  process.env.DH_HOME = path.join(DATA_DIR, "Dark Horse");
  process.env.DH_BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;
  process.env.NODE_ENV = "production";

  const mod = await import(pathToFileURL(SERVER_ENTRY).href);
  const handler =
    typeof mod.default === "function"
      ? mod.default
      : typeof mod.default?.fetch === "function"
        ? mod.default.fetch.bind(mod.default)
        : typeof mod.fetch === "function"
          ? mod.fetch
          : typeof mod.handler === "function"
            ? mod.handler
            : null;

  if (!handler) {
    throw new Error(
      "No fetch handler in server entry. Keys: " + Object.keys(mod).join(",")
    );
  }

  appServer = http.createServer(async (req, res) => {
    try {
      if (tryServeStatic(req, res)) return;

      const body = await readBody(req);
      const webReq = nodeReqToWebRequest(req, body);
      const webRes = await handler(webReq);
      await webResponseToNode(webRes, res);
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Server error: " + String(e && e.stack ? e.stack : e));
    }
  });

  await new Promise((resolve, reject) => {
    appServer.once("error", reject);
    appServer.listen(PORT, "127.0.0.1", resolve);
  });
}

function startStaticOnly() {
  appServer = http.createServer((req, res) => {
    if (tryServeStatic(req, res)) return;
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      "Not Found\n\nStatic root: " +
        STATIC_DIR +
        "\nTried: " +
        path.join(STATIC_DIR, "index.html") +
        "\nROOT: " +
        ROOT +
        "\nSERVER: " +
        SERVER_ENTRY +
        " exists=" +
        fs.existsSync(SERVER_ENTRY)
    );
  });
  appServer.listen(PORT, "127.0.0.1");
}

async function startServer() {
  try {
    await startNitroHttp();
  } catch (e) {
    const srvxCandidates = [
      path.join(ROOT, "node_modules", "srvx", "dist", "cli.mjs"),
      path.join(ROOT, "node_modules", "srvx", "bin", "srvx.mjs"),
    ];
    const cli = srvxCandidates.find((p) => fs.existsSync(p));
    if (cli && fs.existsSync(SERVER_ENTRY)) {
      const child = spawn(
        process.execPath,
        [cli, "--static", STATIC_DIR, SERVER_ENTRY],
        {
          cwd: SERVER_DIR,
          env: {
            ...process.env,
            PORT: String(PORT),
            HOST: "127.0.0.1",
            ELECTRON_RUN_AS_NODE: "1",
            DH_HOME: path.join(DATA_DIR, "Dark Horse"),
            DH_BRIDGE_URL: `http://127.0.0.1:${BRIDGE_PORT}`,
            NODE_ENV: "production",
          },
          stdio: "ignore",
        }
      );
      appServer = { close: () => { try { child.kill(); } catch {} } };
      return;
    }
    startStaticOnly();
    console.error("startServer failed", e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#1a1720",
    show: false,
    autoHideMenuBar: true,
    title: "Dark Horse",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const url = `http://127.0.0.1:${PORT}/`;
  const tryLoad = (attempt = 0) => {
    mainWindow.loadURL(url).catch(() => {
      if (attempt < 80) setTimeout(() => tryLoad(attempt + 1), 250);
    });
  };
  setTimeout(() => tryLoad(), 400);
}

ipcMain.handle("pick-folder", async () => pickFolder());
ipcMain.handle("open-path", async (_e, target) => {
  if (!target || typeof target !== "string") return false;
  const err = await shell.openPath(target);
  return !err;
});

ipcMain.handle("save-state", async (_e, json) => {
  try {
    const file = path.join(DATA_DIR, "state.json");
    fs.writeFileSync(file, String(json || "{}"), "utf8");
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("load-state", async () => {
  try {
    const file = path.join(DATA_DIR, "state.json");
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
});

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("enable-gpu-rasterization");

app.whenReady().then(async () => {
  ensureData();
  startBridge();
  await startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (appServer && appServer.close) try { appServer.close(); } catch {}
  if (bridgeServer) try { bridgeServer.close(); } catch {}
  app.quit();
});
