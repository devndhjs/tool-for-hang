const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const cheerio = require("cheerio");

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

async function scrapeImagesFromUrl(browser, url, folderPath, wait) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1920, height: 1080 });

  await delay(wait || 3000);

  // Click tất cả .image-wrapper (để chắc chắn load đủ ảnh)
  const wrappers = await page.$$(".image-wrapper");
  for (const wrapper of wrappers) {
    try {
      await wrapper.click({ force: true });
      // await delay(300); // có thể thêm delay nếu cần
    } catch (e) {
      console.warn("Không click được wrapper:", e.message);
    }
  }

  // Lấy toàn bộ HTML sau khi render
  const html = await page.content();

  // Đóng page sớm để giảm RAM
  await page.close();

  // Parse bằng Cheerio
  const $ = cheerio.load(html);
  const imageInfos = [];
  $(".zoom-image-container.main-image img").each((i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    const alt = $(el).attr("alt") || "image";
    if (src && src.startsWith("http")) {
      imageInfos.push({ src, alt });
    }
  });

  console.log(`🔍 Tìm thấy ${imageInfos.length} ảnh ở ${url}`);

  // Tải ảnh
  await Promise.all(
    imageInfos.map(({ src, alt }, i) => {
      const cleanName = sanitizeFileName(alt || "image");
      const ext = path.extname(src.split("?")[0]) || ".jpg";
      const fileName = `${cleanName}-${i + 1}${ext}`;
      const filePath = path.join(folderPath, fileName);
      return downloadImage(src, filePath);
    })
  );

  return true;
}

module.exports = { scrapeImagesFromUrl };
