import puppeteer from "puppeteer";
import * as XLSX from "xlsx";

interface Item {
  title: string;
  price: string | null;
  rating: string | null;
  totalRatings: string | null;
}

(async () => {
  const baseUrl =
    "https://www.amazon.com/Best-Sellers-Home-Kitchen/zgbs/home-garden/ref=zg_bs_pg_";
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: null,
  });
  const page = await browser.newPage();
  const allItems: Item[] = [];

  for (let pg = 1; pg <= 100; pg++) {
    const url = `${baseUrl}${pg}?_encoding=UTF8&pg=${pg}`;
    console.log(`🔄 Đang xử lý: ${url}`);

    await page.goto(url, { waitUntil: "networkidle2" });

    const isErrorPage = await page.evaluate(
      () => !!document.querySelector('img[src*="error/en_US/title._TTD_.png"]')
    );
    if (isErrorPage) {
      console.log(`⛔️ Dừng lại vì gặp trang lỗi tại trang ${pg}`);
      break;
    }

    // Scroll nhẹ để trigger lazy load
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 3000));
    });

    const { results } = await page.evaluate(() => {
      const data: Item[] = [];

      const listItems = document.querySelectorAll("li.zg-no-numbers");

      listItems.forEach((item) => {
        const titleElement = item.querySelector(
          "div._cDEzb_p13n-sc-css-line-clamp-3_g3dy1"
        );
        const priceElement =
          item.querySelector("span.a-size-base.a-color-price") ||
          item.querySelector(".p13n-sc-price");
        const ratingElement = item.querySelector(
          "i.a-icon-star-small span.a-icon-alt"
        );
        const totalRatingsElement = item.querySelector(
          'a[href*="product-reviews"] span.a-size-small'
        );

        const title = titleElement?.textContent?.trim() ?? null;
        const price = priceElement?.textContent?.trim() ?? null;
        const rating = ratingElement?.textContent?.trim() ?? null;
        const totalRatings = totalRatingsElement?.textContent?.trim() ?? null;

        if (title && price) {
          data.push({ title, price, rating, totalRatings });
        }
      });

      return { results: data };
    });

    allItems.push(...results);
  }

  await browser.close();

  // 🔍 Chuyển price + totalRatings về số và lọc giá >= 50$
  const cleanedItems = allItems
    .map((item) => ({
      ...item,
      priceNum: parseFloat(item.price?.replace("$", "") ?? "0"),
      totalRatingsNum: parseInt(item.totalRatings?.replace(/,/g, "") ?? "0"),
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
})();
