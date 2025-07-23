import puppeteer from "puppeteer";
import * as XLSX from "xlsx";

interface ProductInfo {
  title: string | null;
  price: string | null;
  rating: string | null;
  reviews: string | null;
}

async function scrapeAmazon() {
  const allProducts: ProductInfo[] = [];
  let pagea: number = 0;
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(
      "https://www.amazon.com/gp/browse.html?node=284507&ref_=nav_em__ki_0_2_20_8",
      { waitUntil: "networkidle2" }
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

    await new Promise((r) => setTimeout(r, Number(4000)));
    await page.waitForSelector("#s-result-sort-select");
    await page.select("#s-result-sort-select", "price-desc-rank");
    await new Promise((r) => setTimeout(r, Number(3000)));
    while (true) {
      await new Promise((r) => setTimeout(r, Number(5000)));
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

      let resultPr = products.filter((e) => e.title && e.price);
      console.log(`Trang ${pagea}: thu được ${resultPr.length} sản phẩm`);
      allProducts.push(...resultPr);
      // console.log());

      // Kiểm tra nút next
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

      // Click Next và đợi trang load

      await nextBtn.click();
      // await page.waitForNavigation({ waitUntil: "networkidle2" });
    }
    console.log(`Tổng số sản phẩm tất cả các trang: ${allProducts.length}`);
    // console.log(allProducts);

    await browser.close();

    // 🔍 Chuyển price + totalRatings về số và lọc giá >= 50$
    const cleanedItems = allProducts
      .map((item) => ({
        ...item,
        priceNum: parseFloat(item.price?.replace("$", "") ?? "0"),
        totalRatingsNum: parseInt(item.reviews?.replace(/,/g, "") ?? "0"),
      }))
      .filter((item) => item.priceNum >= 50)
      .sort((a, b) => b.totalRatingsNum - a.totalRatingsNum);

    // 🧾 Chuẩn bị dữ liệu cho Excel
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
  } catch (error) {}
}

scrapeAmazon().catch(console.error);
