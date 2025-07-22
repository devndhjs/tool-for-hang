import axios from "axios";
import path from "path";
import puppeteer from "puppeteer";
import fs from "fs";

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

async function downloadImage(
  imageUrl: string,
  alt: any,
  index: number,
  folderPath: any
) {
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

export async function scrapeImagesFromUrl(
  url: string,
  folderPath: any,
  wait: any
) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
    const list: any[] = [];
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
