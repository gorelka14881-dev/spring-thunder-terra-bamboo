const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("darkHorseDesktop", {
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  openPath: (target) => ipcRenderer.invoke("open-path", target),
  isDesktop: true,
});
