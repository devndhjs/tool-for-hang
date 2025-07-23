import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import os from "os";
import fs from "fs";
import archiver from "archiver";
import { scrapeImagesFromUrl } from "./src/dkhardware.js";

function zipDirectory(sourceDir, outPath) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive.directory(sourceDir, false).on("error", reject).pipe(stream);
    stream.on("close", () => resolve());
    archive.finalize();
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(process.cwd(), "preload.js"),
    },
  });

  await win.loadFile("index.html");
}

ipcMain.handle("start-download", async (event, url) => {
  console.log("Bắt đầu download:", url);
  const wait = 3000;
  const tempDir = path.join(os.tmpdir(), `scrape-${Date.now()}`);
  fs.mkdirSync(tempDir);

  try {
    const folderName = url.split("/").filter(Boolean).pop() || "unknown";
    const folderPath = path.join(tempDir, folderName);
    fs.mkdirSync(folderPath);
    await scrapeImagesFromUrl(url, folderPath, wait);

    const zipPath = path.resolve(`images-${Date.now()}.zip`);
    await zipDirectory(tempDir, zipPath);

    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: true, zipPath };
  } catch (err) {
    console.error("❌ Lỗi:", err);
    return { success: false, message: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();
});
