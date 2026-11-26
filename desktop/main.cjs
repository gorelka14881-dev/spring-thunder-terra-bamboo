const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");

const IS_PACKAGED = app.isPackaged;
const ROOT = IS_PACKAGED ? path.join(process.resourcesPath, "app") : path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, ".vercel", "output");
const STATIC_DIR = path.join(OUTPUT, "static");
const SERVER_ENTRY = path.join(OUTPUT, "functions", "__server.func", "index.mjs");
const DATA_DIR = path.join(app.getPath("userData"), "DarkHorseData");
const PORT = 18765;
const BRIDGE_PORT = 18766;

let mainWindow = null;
let serverProc = null;
let bridgeServer = null;

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "Dark Horse", "Кинозал"), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "Dark Horse", "Референсы"), { recursive: true });
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

function startServer() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    NITRO_PORT: String(PORT),
    NITRO_HOST: "127.0.0.1",
    DH_HOME: path.join(DATA_DIR, "Dark Horse"),
    DH_BRIDGE_URL: `http://127.0.0.1:${BRIDGE_PORT}`,
    NODE_ENV: "production",
  };

  const srvxCli = path.join(ROOT, "node_modules", "srvx", "bin", "srvx.mjs");
  const srvxCli2 = path.join(ROOT, "node_modules", "srvx", "dist", "cli.mjs");
  const cli = fs.existsSync(srvxCli) ? srvxCli : srvxCli2;

  if (fs.existsSync(SERVER_ENTRY) && fs.existsSync(cli)) {
    serverProc = spawn(process.execPath, [cli, "--static", STATIC_DIR, SERVER_ENTRY], {
      cwd: path.dirname(SERVER_ENTRY),
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "ignore",
    });
    return;
  }

  const root = fs.existsSync(STATIC_DIR) ? STATIC_DIR : path.join(ROOT, "public");
  const staticServer = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.normalize(path.join(root, urlPath));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
  staticServer.listen(PORT, "127.0.0.1");
  serverProc = { kill: () => staticServer.close() };
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
      if (attempt < 50) setTimeout(() => tryLoad(attempt + 1), 200);
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
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("enable-gpu-rasterization");

app.whenReady().then(() => {
  ensureData();
  startBridge();
  startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProc && serverProc.kill) try { serverProc.kill(); } catch {}
  if (bridgeServer) try { bridgeServer.close(); } catch {}
  app.quit();
});
