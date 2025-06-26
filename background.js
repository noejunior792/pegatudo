chrome.runtime.onInstalled.addListener(() => {
  console.log("PegaTudo instalado.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download") {
    chrome.downloads.download(
      {
        url: message.url,
        filename: message.filename,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          // Open the downloads page to show progress
          chrome.tabs.create({ url: "chrome://downloads" });
          sendResponse({ downloadId });
        }
      }
    );
    return true; // Keep the message channel open for the async response
  }
});