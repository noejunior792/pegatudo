document.getElementById("autoDetect").addEventListener("change", (e) => {
  chrome.storage.sync.set({ autoDetect: e.target.checked }, () => {
    console.log("Auto-detect setting saved:", e.target.checked);
  });
});
