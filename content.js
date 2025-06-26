const processedElements = new WeakSet();

function createDownloadButton(mediaElement) {
  if (processedElements.has(mediaElement) || mediaElement.closest('.pega-tudo-container')) return;

  const isVideo = mediaElement.tagName === 'VIDEO';
  const isAudio = mediaElement.tagName === 'AUDIO';
  const isSource = mediaElement.tagName === 'SOURCE';
  const isDownloadableMedia = isVideo || isAudio || isSource;

  const button = document.createElement("button");
  button.className = "pega-tudo-download-button";

  let initialButtonText;
  if (isVideo) {
    initialButtonText = "Gerar Comando de Download";
  } else if (isAudio) {
    initialButtonText = "Baixar Áudio";
  } else if (isSource) {
    initialButtonText = "Baixar Mídia";
  } else {
    initialButtonText = "Baixar Imagem";
  }
  button.textContent = initialButtonText;

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
    const isBlobUrl = url.startsWith("blob:");
    const isYouTubeVideo = isVideo && window.location.hostname.includes("youtube.com");

    if (isVideo && !isBlobUrl && !isYouTubeVideo) { // Regular video, not YouTube, not blob
      const command = `yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' "${url}"`;
      navigator.clipboard.writeText(command).then(() => {
        button.textContent = "Comando Copiado!";
        setTimeout(() => { button.textContent = "Gerar Comando de Download"; }, 3000);
      }).catch(err => {
        console.error('Falha ao copiar comando: ', err);
        button.textContent = "Falhou!";
      });
    } else if (isYouTubeVideo) { // YouTube video (always use page URL for yt-dlp)
      const command = `yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' "${window.location.href}"`;
      navigator.clipboard.writeText(command).then(() => {
        button.textContent = "Comando Copiado!";
        setTimeout(() => { button.textContent = "Gerar Comando de Download"; }, 3000);
      }).catch(err => {
        console.error('Falha ao copiar comando: ', err);
        button.textContent = "Falhou!";
      });
    } else { // All other cases: audio, source, image, or video with blob URL
      let filename;
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const extension = pathname.split('.').pop();
        const baseName = pathname.split('/').pop().split('.')[0];
        const mediaType = isAudio ? 'audio' : (mediaElement.tagName === 'IMG' ? 'imagem' : (isVideo ? 'video' : 'midia'));
        filename = `${baseName || mediaType}_${Date.now()}.${extension || 'bin'}`.replace(/[<>:"/\\|?*]/g, '_');
      } catch (error) {
        filename = `${(isVideo ? 'video' : 'midia')}_${Date.now()}.bin`; // More specific default for video blobs
      }

      chrome.runtime.sendMessage({ action: "download", url, filename }, (response) => {
        if (response && response.error) {
          console.error("Erro no download:", response.error);
          button.textContent = isBlobUrl ? "Falha Blob: Tente outro método!" : "Falhou!";
          setTimeout(() => { button.textContent = initialButtonText; }, 5000);
        } else {
          button.textContent = "Baixado!";
          button.disabled = true;
        }
      });
    }
  });
}

function addPlaylistButton() {
  if (!window.location.href.includes("youtube.com/playlist")) return;
  if (document.querySelector('.pega-tudo-playlist-button')) return;

  const playlistHeader = document.querySelector('#header.ytd-playlist-header-renderer');
  if (playlistHeader) {
    const button = document.createElement("button");
    button.textContent = "Gerar Comando para Playlist";
    button.className = "pega-tudo-playlist-button pega-tudo-download-button";

    button.addEventListener('click', () => {
      const playlistUrl = window.location.href;
      const command = `yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' "${playlistUrl}"`;
      navigator.clipboard.writeText(command).then(() => {
        button.textContent = "Comando Copiado!";
        setTimeout(() => { button.textContent = "Gerar Comando para Playlist"; }, 3000);
      }).catch(err => {
        console.error('Falha ao copiar comando: ', err);
        button.textContent = "Falhou!";
      });
    });

    playlistHeader.appendChild(button);
  }
}

function run() {
  document.querySelectorAll("video, img, audio, source").forEach(createDownloadButton);
  addPlaylistButton();
}

const observer = new MutationObserver(run);

run();
observer.observe(document.body, { childList: true, subtree: true });