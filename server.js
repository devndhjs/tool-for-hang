const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const puppeteer = require("puppeteer");
const archiver = require("archiver");
const os = require("os");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.static("public"));

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

async function downloadImage(imageUrl, alt, index, folderPath) {
  const cleanName = sanitizeFileName(alt || "image");
  const fileExt = path.extname(imageUrl.split("?")[0]) || ".jpg";
  const fileName = `${cleanName}-${index}${fileExt}`;
  const filePath = path.resolve(folderPath, fileName);

  const writer = fs.createWriteStream(filePath);
  const response = await axios({
    url: imageUrl,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

async function scrapeImagesFromUrl(url, folderPath, wait) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url, { waitUntil: "networkidle2" });

  // await page.evaluate(() => {
  //   window.scrollTo(0, document.body.scrollHeight);
  // });
  await new Promise((r) => setTimeout(r, Number(wait || 3000)));

  const wrappers = await page.$$(".image-wrapper");
  for (let i = 0; i < wrappers.length; i++) {
    await wrappers[i].click();
    // await new Promise((r) => setTimeout(r,  300));
  }

  const imageInfos = await page.evaluate(() => {
    const imgs = document.querySelectorAll(
      ".zoom-image-container.main-image img"
    );
    const list = [];
    imgs.forEach((img) => {
      const src = img.getAttribute("src") || img.getAttribute("data-src");
      const alt = img.getAttribute("alt") || "image";
      if (src && src.startsWith("http")) {
        list.push({ src, alt });
      }
    });
    return list;
  });

  await browser.close();

  const downloadedFiles = [];
  for (let i = 0; i < imageInfos.length; i++) {
    const { src, alt } = imageInfos[i];
    const filePath = await downloadImage(src, alt, i + 1, folderPath);
    downloadedFiles.push(filePath);
  }

  return downloadedFiles;
}

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

  try {
    for (let i = 0; i < urls.length; i++) {
      const urlPart = urls[i].split("/").filter(Boolean).pop(); // lấy phần cuối URL
      const cleanName = urlPart.substring(0, 20); // giới hạn 20 ký tự
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
