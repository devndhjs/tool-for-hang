const { chromium } = require("playwright"); // Dùng Chromium
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

function downloadImage(url, filePath) {
  const protocol = url.startsWith("https") ? https : http;

  return new Promise((resolve, reject) => {
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close(() => resolve(filePath));
      });

      fileStream.on("error", (err) => {
        fs.unlink(filePath, () => reject(err));
      });
    });

    request.on("error", reject);
  });
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getImagesScript() {
  return `
    (() => {
      const imgs = document.querySelectorAll(".zoom-image-container.main-image img");
      const list = [];
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        const src = img.getAttribute("src") || img.getAttribute("data-src");
        const alt = img.getAttribute("alt") || "image";
        if (src && src.startsWith("http")) {
          list.push({ src, alt });
        }
      }
      return list;
    })()
  `;
}

async function scrapeImagesFromUrl(url, folderPath, wait) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1920, height: 1080 });

  await delay(wait || 3000);

  try {
    const closeBtn = await page.$("#alia-wc914syg6np7o49n svg");
    if (closeBtn) {
      await closeBtn.click();
      // console.log("✅ Đã đóng popup.");
      // await delay(500); // đợi một chút sau khi đóng
    }
  } catch (e) {
    console.warn("⚠️ Không thể đóng popup:", e.message);
  }

  const wrappers = await page.$$(".image-wrapper");
  for (const wrapper of wrappers) {
    try {
      await wrapper.click();
      // await delay(300);
    } catch (e) {
      console.warn("Không click được wrapper:", e.message);
    }
  }

  const imageInfos = await page.evaluate(getImagesScript());

  await browser.close();

  const downloadedFiles = [];

  for (let i = 0; i < imageInfos.length; i++) {
    const { src, alt } = imageInfos[i];
    const cleanName = sanitizeFileName(alt || "image");
    const ext = path.extname(src.split("?")[0]) || ".jpg";
    const fileName = `${cleanName}-${i + 1}${ext}`;
    const filePath = path.join(folderPath, fileName);

    await downloadImage(src, filePath);
    downloadedFiles.push(filePath);
  }

  return downloadedFiles;
}

module.exports = { scrapeImagesFromUrl };
