const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("darkHorseDesktop", {
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  openPath: (target) => ipcRenderer.invoke("open-path", target),
  saveState: (json) => ipcRenderer.invoke("save-state", json),
  loadState: () => ipcRenderer.invoke("load-state"),
  isDesktop: true,
});
