window.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded!");
  console.log("window.electronAPI:", window.electronAPI);
  document.querySelector("button").addEventListener("click", download);
});

async function download() {
  const url = document.getElementById("urlInput").value;
  document.getElementById("status").innerText = "⏳ Đang tải...";
  try {
    const result = await window.electronAPI.startDownload(url);
    if (result.success) {
      document.getElementById("status").innerText =
        "✅ Hoàn tất! File: " + result.zipPath;
    } else {
      document.getElementById("status").innerText = "❌ Lỗi: " + result.message;
    }
  } catch (e) {
    document.getElementById("status").innerText = "❌ Lỗi: " + e.message;
  }
}
