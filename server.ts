import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import os from "os";
import crypto from "crypto";
import { scrapeImagesFromUrl } from "./src/dkhardware";

const app = express();
app.use(express.json());
app.use(express.static("public"));

function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive.directory(sourceDir, false).on("error", reject).pipe(stream);
    stream.on("close", () => resolve());
    archive.finalize();
  });
}

app.post("/download-images", async (req: Request, res: Response) => {
  const urls: string[] = req.body.urls;
  const wait: number = req.body.wait;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "Danh sách URL không hợp lệ" });
  }

  const sessionId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `scrape-${sessionId}`);
  fs.mkdirSync(tempDir);

  try {
    for (let i = 0; i < urls.length; i++) {
      const urlPart = urls[i].split("/").filter(Boolean).pop() || "unknown";
      const cleanName = urlPart.substring(0, 20);
      const folder = path.join(tempDir, cleanName);
      fs.mkdirSync(folder);
      await scrapeImagesFromUrl(urls[i], folder, wait);
    }

    const zipPath = path.join(os.tmpdir(), `images-${sessionId}.zip`);
    await zipDirectory(tempDir, zipPath);

    res.download(zipPath, "images.zip", () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
    });
  } catch (err) {
    console.error("❌ Lỗi khi xử lý:", err);
    res.status(500).json({ error: "Đã có lỗi xảy ra khi xử lý ảnh" });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
