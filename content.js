const processedElements = new WeakSet();

function createDownloadButton(mediaElement) {
  if (processedElements.has(mediaElement) || mediaElement.closest('.pega-tudo-container')) return;

  const isVideo = mediaElement.tagName === 'VIDEO';
  const button = document.createElement("button");
  button.className = "pega-tudo-download-button";

  if (isVideo) {
    button.textContent = "Gerar Comando de Download";
  } else {
    button.textContent = "Baixar Imagem";
  }

  const container = document.createElement("div");
  container.className = "pega-tudo-container";
  container.appendChild(button);

  const targetParent = mediaElement.parentElement;
  targetParent.style.position = "relative";
  targetParent.appendChild(container);

  processedElements.add(mediaElement);

  button.addEventListener("click", (e) => {
    e.stopPropagation();

    if (isVideo) {
      const videoUrl = window.location.hostname.includes("youtube.com") ? window.location.href : (mediaElement.src || mediaElement.currentSrc);
      const command = `yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' "${videoUrl}"`;
      navigator.clipboard.writeText(command).then(() => {
        button.textContent = "Comando Copiado!";
        setTimeout(() => { button.textContent = "Gerar Comando de Download"; }, 3000);
      }).catch(err => {
        console.error('Falha ao copiar comando: ', err);
        button.textContent = "Falhou!";
      });
    } else {
      const url = mediaElement.src || mediaElement.currentSrc;
      let filename;
      try {
        const extension = new URL(url).pathname.split('.').pop() || 'jpg';
        filename = `imagem_${Date.now()}.${extension}`.replace(/[<>:"/\\|?*]/g, '_');
      } catch (error) {
        filename = `imagem_${Date.now()}.jpg`;
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
  document.querySelectorAll("video, img").forEach(createDownloadButton);
  addPlaylistButton();
}

const observer = new MutationObserver(run);

run();
observer.observe(document.body, { childList: true, subtree: true });