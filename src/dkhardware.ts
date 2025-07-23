import { chromium } from "playwright";

export async function scrapeImagesFromUrl(
  url: string,
  folderPath: string,
  wait: number
) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(3000); // đợi ảnh hiện

  // Click vào tất cả .image-wrapper
  const wrappers = await page.$$(".image-wrapper");
  for (const wrapper of wrappers) {
    await wrapper.click();
    await page.waitForTimeout(300); // đợi ảnh hiện
  }

  await page.waitForTimeout(wait || 3000);

  // Lấy ảnh
  const imageInfos = await page.evaluate(() => {
    const imgs = document.querySelectorAll(
      ".zoom-image-container.main-image img"
    );
    const list: { src: string; alt: string }[] = [];
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

  // Tải ảnh về như cũ
  const axios = await import("axios");
  const fs = await import("fs");
  const path = await import("path");

  const sanitizeFileName = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);

  const downloadedFiles = [];

  for (let i = 0; i < imageInfos.length; i++) {
    const { src, alt } = imageInfos[i];
    const cleanName = sanitizeFileName(alt || "image");
    const ext = path.extname(src.split("?")[0]) || ".jpg";
    const fileName = `${cleanName}-${i + 1}${ext}`;
    const filePath = path.join(folderPath, fileName);

    const writer = fs.createWriteStream(filePath);
    const response = await axios.default({
      url: src,
      method: "GET",
      responseType: "stream",
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", () => resolve(filePath));
      writer.on("error", reject);
    });

    downloadedFiles.push(filePath);
  }

  return downloadedFiles;
}
