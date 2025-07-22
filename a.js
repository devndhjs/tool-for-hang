const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const url =
  "https://www.dkhardware.com/hamilton-beach-49630-xcp2-coffee-maker-12-cups-black-silver-black-silver-pack-of-2-product-8101680.html";

// Làm sạch tên file từ alt
function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .normalize("NFD") // loại bỏ dấu tiếng Việt
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-") // thay các ký tự đặc biệt bằng dấu gạch
    .replace(/^-+|-+$/g, "") // xóa gạch ở đầu/cuối
    .substring(0, 50); // giới hạn độ dài
}

// Tải ảnh từ URL và lưu với tên theo alt
async function downloadImage(imageUrl, alt, index) {
  const cleanName = sanitizeFileName(alt || "image");
  const fileExt = path.extname(imageUrl.split("?")[0]) || ".jpg";
  const fileName = `${cleanName}-${index}${fileExt}`;
  const filePath = path.resolve(__dirname, "images", fileName);

  const writer = fs.createWriteStream(filePath);
  const response = await axios({
    url: imageUrl,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      console.log(`✅ Downloaded: ${fileName}`);
      resolve();
    });
    writer.on("error", reject);
  });
}

async function scrapeWithPuppeteer() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--window-size=1920,1080"],
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto(url, { waitUntil: "networkidle2" });

  // Scroll xuống cuối trang và đợi 5s
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await new Promise((r) => setTimeout(r, 5000));

  // Click từng .image-wrapper
  const wrappers = await page.$$(".image-wrapper");
  console.log(`🔍 Found ${wrappers.length} image-wrapper elements`);
  for (let i = 0; i < wrappers.length; i++) {
    console.log(`🖱️ Clicking image-wrapper ${i + 1}/${wrappers.length}`);
    await wrappers[i].click();
    await new Promise((r) => setTimeout(r, 300)); // đợi ảnh thay
  }

  // Lấy danh sách ảnh: src + alt
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

  // Tạo thư mục nếu chưa có
  if (!fs.existsSync("./images")) {
    fs.mkdirSync("./images");
  }

  console.log(`🖼️ Found ${imageInfos.length} images. Downloading...`);
  for (let i = 0; i < imageInfos.length; i++) {
    const { src, alt } = imageInfos[i];
    await downloadImage(src, alt, i + 1);
  }

  console.log("🎉 All images downloaded!");
}

scrapeWithPuppeteer();
