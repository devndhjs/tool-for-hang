import { chromium } from "playwright";
import * as XLSX from "xlsx";

interface ProductInfo {
  title: string | null;
  price: string | null;
  rating: string | null;
  reviews: string | null;
}

async function scrapeAmazon() {
  const allProducts: ProductInfo[] = [];
  let pagea = 0;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(
    "https://www.amazon.com/gp/browse.html?node=284507&ref_=nav_em__ki_0_2_20_8",
    { waitUntil: "networkidle" }
  );

  await page.waitForSelector(
    ".apb-default-slot.apb-default-merchandised-search-4 a.a-color-base.a-link-normal.a-block"
  );

  const firstLink = await page.$(
    ".apb-default-slot.apb-default-merchandised-search-4 a.a-color-base.a-link-normal.a-block"
  );
  if (!firstLink) {
    console.error("Không tìm thấy link để click");
    await browser.close();
    return;
  }

  await firstLink.click();
  await page.waitForTimeout(4000);

  await page.waitForSelector("#s-result-sort-select");
  await page.selectOption("#s-result-sort-select", "price-desc-rank");
  await page.waitForTimeout(3000);

  while (true) {
    await page.waitForTimeout(5000);
    pagea++;
    await page.waitForSelector(".s-result-item");

    const products: ProductInfo[] = await page.$$eval(
      ".s-result-item",
      (items) => {
        return items.map((item) => {
          const inner = item.querySelector(".sg-col-inner");
          if (!inner)
            return { title: null, price: null, rating: null, reviews: null };

          const titleEl = inner.querySelector(
            "h2.a-size-base-plus.a-spacing-none.a-color-base.a-text-normal span"
          );
          const priceEl =
            inner.querySelector(".a-price .a-offscreen") ||
            inner.querySelector(".a-price-whole") ||
            inner.querySelector(".a-color-base");
          const ratingEl = inner.querySelector(".a-icon-alt");
          const reviewsEl = inner.querySelector(
            "span.a-size-base.s-underline-text"
          );

          const title = titleEl?.textContent?.trim() ?? null;
          const price = priceEl?.textContent?.trim() ?? null;
          const rating = ratingEl?.textContent?.trim() ?? null;
          const reviews = reviewsEl?.textContent?.trim() ?? null;

          return { title, price, rating, reviews };
        });
      }
    );

    const resultPr = products.filter((e) => e.title && e.price);
    console.log(`Trang ${pagea}: thu được ${resultPr.length} sản phẩm`);
    allProducts.push(...resultPr);

    // Kiểm tra nút Next
    const nextBtn = await page.$(".s-pagination-item.s-pagination-next");
    if (!nextBtn) {
      console.log("Không tìm thấy nút Next");
      break;
    }

    const isDisabled = await nextBtn.evaluate((btn) =>
      btn.classList.contains("s-pagination-disabled")
    );
    if (isDisabled) {
      console.log("Đã tới trang cuối");
      break;
    }

    await nextBtn.click({ force: true });
    // Không cần waitForNavigation vì Amazon hay dùng ajax
  }

  console.log(`Tổng số sản phẩm tất cả các trang: ${allProducts.length}`);
  await browser.close();

  // Xử lý dữ liệu
  const cleanedItems = allProducts
    .map((item) => ({
      ...item,
      priceNum: parseFloat(item.price?.replace("$", "") ?? "0"),
      totalRatingsNum: parseInt(item.reviews?.replace(/,/g, "") ?? "0"),
    }))
    .filter((item) => item.priceNum >= 50)
    .sort((a, b) => b.totalRatingsNum - a.totalRatingsNum);

  const worksheetData = cleanedItems.map((item) => ({
    Title: item.title,
    Price: `$${item.priceNum.toFixed(2)}`,
    Rating: item.rating ?? "",
    TotalRatings: item.totalRatingsNum,
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Amazon Best Sellers");

  XLSX.writeFile(workbook, "amazon_best_sellers_filtered.xlsx");
  console.log(
    `✅ Đã lưu ${worksheetData.length} sản phẩm vào amazon_best_sellers_filtered.xlsx`
  );
}

scrapeAmazon().catch(console.error);
