const processedElements = new WeakSet();
let extensionEnabled = true; // Default to enabled

// Check if extension is enabled
chrome.storage.sync.get(['extensionEnabled'], (result) => {
  extensionEnabled = result.extensionEnabled !== false;
  if (!extensionEnabled) {
    removeAllButtons();
  }
});

// Listen for toggle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleExtension') {
    extensionEnabled = message.enabled;
    if (!extensionEnabled) {
      removeAllButtons();
    } else {
      run(); // Re-run to add buttons back
    }
  }
});

function removeAllButtons() {
  document.querySelectorAll('.pega-tudo-container, .pega-tudo-playlist-button').forEach(el => el.remove());
}

function createFormatModal(videoUrl) {
  if (document.querySelector('.pega-tudo-format-modal')) return;

  const modal = document.createElement('div');
  modal.className = 'pega-tudo-format-modal';
  modal.innerHTML = `
    <div class="pega-tudo-modal-content">
      <div class="pega-tudo-modal-header">
        <h3>Formatos Disponíveis</h3>
        <button class="pega-tudo-close-btn">×</button>
      </div>
      <div class="pega-tudo-modal-body">
        <p>Buscando formatos disponíveis...</p>
      </div>
    </div>
  `;

  // Add modal styles
  if (!document.querySelector('#pega-tudo-modal-styles')) {
    const styles = document.createElement('style');
    styles.id = 'pega-tudo-modal-styles';
    styles.textContent = `
      .pega-tudo-format-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }
      .pega-tudo-modal-content {
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 600px;
        max-height: 80%;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      .pega-tudo-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #eee;
        background: #f8f9fa;
      }
      .pega-tudo-modal-header h3 {
        margin: 0;
        color: #333;
      }
      .pega-tudo-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pega-tudo-close-btn:hover {
        color: #333;
        background: #eee;
        border-radius: 50%;
      }
      .pega-tudo-modal-body {
        padding: 20px;
        max-height: 400px;
        overflow-y: auto;
      }
      .pega-tudo-format-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        margin-bottom: 8px;
        background: #f9f9f9;
      }
      .pega-tudo-format-info {
        flex: 1;
        font-family: monospace;
        font-size: 12px;
        color: #333;
      }
      .pega-tudo-format-btn {
        background: #4CAF50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .pega-tudo-format-btn:hover {
        background: #45a049;
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(modal);

  // Close modal functionality
  const closeBtn = modal.querySelector('.pega-tudo-close-btn');
  const closeModal = () => modal.remove();
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Simulate format fetching (in a real implementation, you'd call yt-dlp)
  setTimeout(() => {
    const modalBody = modal.querySelector('.pega-tudo-modal-body');
    modalBody.innerHTML = `
      <div class="pega-tudo-format-item">
        <div class="pega-tudo-format-info">
          <strong>1920x1080 MP4</strong> (270)<br>
          AVC1.640028 • ~98.71MiB • 4814k
        </div>
        <button class="pega-tudo-format-btn" data-format="270">Baixar</button>
      </div>
      <div class="pega-tudo-format-item">
        <div class="pega-tudo-format-info">
          <strong>1280x720 MP4</strong> (232)<br>
          AVC1.4D401F • ~40.58MiB • 1979k
        </div>
        <button class="pega-tudo-format-btn" data-format="232">Baixar</button>
      </div>
      <div class="pega-tudo-format-item">
        <div class="pega-tudo-format-info">
          <strong>854x480 MP4</strong> (231)<br>
          AVC1.4D401E • ~24.74MiB • 1206k
        </div>
        <button class="pega-tudo-format-btn" data-format="231">Baixar</button>
      </div>
      <div class="pega-tudo-format-item">
        <div class="pega-tudo-format-info">
          <strong>640x360 MP4</strong> (230)<br>
          AVC1.4D401E • ~15.64MiB • 763k
        </div>
        <button class="pega-tudo-format-btn" data-format="230">Baixar</button>
      </div>
      <div class="pega-tudo-format-item">
        <div class="pega-tudo-format-info">
          <strong>Audio Only M4A</strong> (233)<br>
          Audio only • Unknown size
        </div>
        <button class="pega-tudo-format-btn" data-format="233">Baixar</button>
      </div>
      <div class="pega-tudo-format-item">
        <div class="pega-tudo-format-info">
          <strong>Melhor Qualidade</strong> (best)<br>
          Formato automático
        </div>
        <button class="pega-tudo-format-btn" data-format="best">Baixar</button>
      </div>
    `;

    // Add click handlers for format buttons
    modalBody.querySelectorAll('.pega-tudo-format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        const command = `yt-dlp -f "${format}" "${videoUrl}"`;
        navigator.clipboard.writeText(command).then(() => {
          btn.textContent = 'Copiado!';
          setTimeout(() => {
            closeModal();
          }, 1000);
        }).catch(err => {
          console.error('Falha ao copiar comando: ', err);
          btn.textContent = 'Erro!';
        });
      });
    });
  }, 1000);
}

function createDownloadButton(mediaElement) {
  if (!extensionEnabled) return;
  if (processedElements.has(mediaElement) || mediaElement.closest('.pega-tudo-container')) return;

  const isVideo = mediaElement.tagName === 'VIDEO';
  const isAudio = mediaElement.tagName === 'AUDIO';
  const isSource = mediaElement.tagName === 'SOURCE';
  const isDownloadableMedia = isVideo || isAudio || isSource;
  const isYouTubeVideo = isVideo && window.location.hostname.includes("youtube.com");

  const button = document.createElement("button");
  button.className = "pega-tudo-download-button";

  let initialButtonText;
  if (isYouTubeVideo) {
    initialButtonText = "Escolher Formato";
  } else if (isVideo) {
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
    } else if (isYouTubeVideo) { // YouTube video - show format selection modal
      createFormatModal(window.location.href);
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
          button.textContent = isBlobUrl ? "Blob URL: Download instável. Tente inspecionar!" : "Falhou!";
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