const processedElements = new WeakSet();

function createDownloadButton(mediaElement) {
  if (processedElements.has(mediaElement)) return;

  const button = document.createElement("button");
  button.textContent = "Baixar";
  button.className = "pega-tudo-download-button";

  const container = document.createElement("div");
  container.className = "pega-tudo-container";
  container.appendChild(button);

  mediaElement.parentElement.style.position = "relative";
  mediaElement.parentElement.appendChild(container);

  processedElements.add(mediaElement);

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const url = mediaElement.src || mediaElement.currentSrc;
    const isVideo = mediaElement.tagName === "VIDEO";
    const extension = isVideo ? "mp4" : new URL(url).pathname.split(".").pop() || "jpg";
    const filename = `media_${Date.now()}.${extension}`;

    chrome.runtime.sendMessage({ action: "download", url, filename }, (response) => {
      if (response.error) {
        console.error("Erro no download:", response.error);
        button.textContent = "Falhou!";
      } else {
        button.textContent = "Baixado!";
        button.disabled = true;
      }
    });
  });
}

function findMedia() {
  document.querySelectorAll("video, img").forEach(createDownloadButton);
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.querySelectorAll("video, img").forEach(createDownloadButton);
        if (node.matches("video, img")) {
          createDownloadButton(node);
        }
      }
    }
  }
});

findMedia();
observer.observe(document.body, { childList: true, subtree: true });