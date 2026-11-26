const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("darkHorseDesktop", {
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  isDesktop: true,
});
