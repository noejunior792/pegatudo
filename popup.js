document.getElementById("openDownloads").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://downloads" });
});