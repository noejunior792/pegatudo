chrome.runtime.onInstalled.addListener(() => {
  console.log("MediaDownloader installed");
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
        sendResponse({ downloadId });
      },
    );
    return true; // Keep the message channel open for async response
  } else if (message.action === "pause") {
    chrome.downloads.pause(message.downloadId, () => {
      sendResponse({ status: "paused" });
    });
    return true;
  } else if (message.action === "resume") {
    chrome.downloads.resume(message.downloadId, () => {
      sendResponse({ status: "resumed" });
    });
    return true;
  } else if (message.action === "summarize") {
    // Placeholder for video summarization (e.g., call an external API)
    summarizeVideo(message.url)
      .then((summary) => {
        sendResponse({ summary });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
});

// Handle authenticated URLs by adding headers (e.g., Authorization)
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders || [];
    // Example: Add Authorization header if available
    const authToken = localStorage.getItem("authToken"); // Hypothetical storage
    if (authToken) {
      headers.push({ name: "Authorization", value: `Bearer ${authToken}` });
    }
    return { requestHeaders: headers };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"],
);

// Placeholder function for video summarization
async function summarizeVideo(url) {
  // In a real implementation, call an AI API (e.g., YouTube Summary API)
  return "This is a placeholder summary for the video.";
}
