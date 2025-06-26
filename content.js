const processedElements = new WeakSet();

function getYouTubeVideoTitle() {
  const titleElement = document.querySelector('h1.ytd-watch-metadata, #video-title');
  if (titleElement && titleElement.textContent) {
    return titleElement.textContent.trim().replace(/[<>:"/\\|?*]/g, '_');
  }
  return null;
}

function createDownloadButton(mediaElement) {
  if (processedElements.has(mediaElement) || mediaElement.closest('.pega-tudo-container')) return;

  const button = document.createElement("button");
  button.textContent = "Baixar";
  button.className = "pega-tudo-download-button";

  const container = document.createElement("div");
  container.className = "pega-tudo-container";
  container.appendChild(button);

  const targetParent = mediaElement.parentElement;
  targetParent.style.position = "relative";
  targetParent.appendChild(container);

  processedElements.add(mediaElement);

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const url = mediaElement.src || mediaElement.currentSrc;
    const isVideo = mediaElement.tagName === 'VIDEO';
    const isYouTube = window.location.hostname.includes("youtube.com");

    let filename;
    if (isYouTube && isVideo) {
      filename = `${getYouTubeVideoTitle() || 'youtube_video'}.mp4`;
    } else {
      try {
        const extension = new URL(url).pathname.split('.').pop() || 'jpg';
        filename = `media_${Date.now()}.${extension}`.replace(/[<>:"/\\|?*]/g, '_');
      } catch (error) {
        filename = `media_${Date.now()}.jpg`;
      }
    }

    chrome.runtime.sendMessage({ action: "download", url, filename }, (response) => {
      if (response && response.error) {
        console.error("Erro no download:", response.error);
        button.textContent = "Falhou!";
      } else {
        button.textContent = "Baixado!";
        button.disabled = true;
      }
    });
  });
}

function addPlaylistButton() {
  if (!window.location.href.includes("youtube.com/playlist")) return;
  if (document.querySelector('.pega-tudo-playlist-button')) return;

  const playlistHeader = document.querySelector('#header.ytd-playlist-header-renderer');
  if (playlistHeader) {
    const button = document.createElement("button");
    button.textContent = "Copiar links da playlist";
    button.className = "pega-tudo-playlist-button pega-tudo-download-button";

    button.addEventListener('click', () => {
      const videoLinks = Array.from(document.querySelectorAll('a#video-title'))
        .map(a => a.href)
        .join('\n');

      if (videoLinks) {
        navigator.clipboard.writeText(videoLinks).then(() => {
          button.textContent = "Links copiados!";
          setTimeout(() => { button.textContent = "Copiar links da playlist"; }, 3000);
        }).catch(err => {
          console.error('Falha ao copiar links: ', err);
          button.textContent = "Falhou!";
        });
      }
    });

    playlistHeader.appendChild(button);
  }
}

function run() {
  document.querySelectorAll("video, img").forEach(createDownloadButton);
  addPlaylistButton();
}

const observer = new MutationObserver(run);

run();
observer.observe(document.body, { childList: true, subtree: true });