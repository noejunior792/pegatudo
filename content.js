document.addEventListener("DOMContentLoaded", () => {
  // Find all media elements
  const videos = document.querySelectorAll("video");
  const images = document.querySelectorAll("img");
  const mediaElements = [...videos, ...images];

  mediaElements.forEach((element) => {
    // Skip if already processed
    if (element.dataset.mediaDownloader) return;
    element.dataset.mediaDownloader = "true";

    // Create popup
    const popup = document.createElement("div");
    popup.className = "media-downloader-popup";
    popup.innerHTML = `
      <button class="download-btn">Download</button>
      <button class="pause-btn" disabled>Pause</button>
      <button class="resume-btn" disabled>Resume</button>
      <button class="summary-btn" ${element.tagName === "IMG" ? "disabled" : ""}>Summarize</button>
    `;

    // Position popup over media
    element.style.position = "relative";
    element.parentNode.insertBefore(popup, element.nextSibling);

    // Extract URL
    const url = element.src || element.currentSrc;
    const isVideo = element.tagName === "VIDEO";
    let downloadId = null;

    // Download button
    popup.querySelector(".download-btn").addEventListener("click", () => {
      const filename = `media_${Date.now()}.${isVideo ? "mp4" : "png"}`;
      chrome.runtime.sendMessage(
        {
          action: "download",
          url,
          filename,
        },
        (response) => {
          downloadId = response.downloadId;
          popup.querySelector(".download-btn").disabled = true;
          popup.querySelector(".pause-btn").disabled = false;
          popup.querySelector(".resume-btn").disabled = false;
        },
      );
    });

    // Pause button
    popup.querySelector(".pause-btn").addEventListener("click", () => {
      if (downloadId) {
        chrome.runtime.sendMessage(
          { action: "pause", downloadId },
          (response) => {
            if (response.status === "paused") {
              popup.querySelector(".pause-btn").disabled = true;
              popup.querySelector(".resume-btn").disabled = false;
            }
          },
        );
      }
    });

    // Resume button
    popup.querySelector(".resume-btn").addEventListener("click", () => {
      if (downloadId) {
        chrome.runtime.sendMessage(
          { action: "resume", downloadId },
          (response) => {
            if (response.status === "resumed") {
              popup.querySelector(".pause-btn").disabled = false;
              popup.querySelector(".resume-btn").disabled = true;
            }
          },
        );
      }
    });

    // Summarize button (videos only)
    if (isVideo) {
      popup.querySelector(".summary-btn").addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "summarize", url }, (response) => {
          if (response.summary) {
            alert(`Summary: ${response.summary}`);
          } else {
            alert(`Error: ${response.error}`);
          }
        });
      });
    }
  });
});

// Observe DOM changes for dynamically loaded media
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === "VIDEO" || node.tagName === "IMG") {
          // Re-run media detection
          document.dispatchEvent(new Event("DOMContentLoaded"));
        }
      });
    }
  });
});
observer.observe(document.body, { childList: true, subtree: true });
