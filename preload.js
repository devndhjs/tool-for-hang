import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  startDownload: (url) => ipcRenderer.invoke("start-download", url),
});
