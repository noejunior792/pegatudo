export function startDownload(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url, filename, conflictAction: "uniquify" },
      (downloadId) => {
        if (downloadId) resolve(downloadId);
        else reject(new Error("Download failed"));
      },
    );
  });
}

export function pauseDownload(downloadId) {
  return new Promise((resolve) => {
    chrome.downloads.pause(downloadId, () => resolve());
  });
}

export function resumeDownload(downloadId) {
  return new Promise((resolve) => {
    chrome.downloads.resume(downloadId, () => resolve());
  });
}
