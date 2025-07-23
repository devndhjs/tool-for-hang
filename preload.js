const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ preload.js chạy rồi!");

contextBridge.exposeInMainWorld("electronAPI", {
  startDownload: (url) => ipcRenderer.invoke("start-download", url),
});
