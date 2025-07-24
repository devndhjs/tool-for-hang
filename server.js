const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const os = require("os");
const crypto = require("crypto");
const { chromium } = require("playwright"); // Dùng Chromium
const { scrapeImagesFromUrl } = require("./src/dkhardware");

const app = express();
app.use(express.json());
app.use(express.static("public"));

function zipDirectory(sourceDir, outPath) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive.directory(sourceDir, false).on("error", reject).pipe(stream);
    stream.on("close", () => resolve());
    archive.finalize();
  });
}

app.post("/download-images", async (req, res) => {
  const urls = req.body.urls;
  const wait = req.body.wait;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "Danh sách URL không hợp lệ" });
  }

  const sessionId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `scrape-${sessionId}`);
  fs.mkdirSync(tempDir);
  const browser = await chromium.launch({ headless: true });

  try {
    await Promise.all(
      urls.map((url) => scrapeImagesFromUrl(browser, url, tempDir, wait))
    );
    await browser.close();

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
