// PegaTudo - Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const mediaListElement = document.getElementById('mediaList');
  const placeholderElement = document.getElementById('placeholder');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const extensionToggle = document.getElementById('extensionToggle');

  // Carrega o estado do toggle
  chrome.storage.sync.get('extensionEnabled', (result) => {
    extensionToggle.checked = result.extensionEnabled !== false;
  });

  // Listener para o toggle de ativar/desativar
  extensionToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ extensionEnabled: isEnabled });
    // Envia mensagem para o content script para ativar/desativar em tempo real
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleExtension', enabled: isEnabled });
      }
    });
  });

  // Pede a lista de mídias para o background script
  chrome.runtime.sendMessage({ action: 'getMediaList' }, (mediaItems) => {
    if (chrome.runtime.lastError) {
      placeholderElement.textContent = 'Erro ao carregar mídias. Tente recarregar a página.';
      console.error(chrome.runtime.lastError);
      return;
    }

    if (mediaItems && mediaItems.length > 0) {
      placeholderElement.style.display = 'none';
      mediaListElement.style.display = 'block';
      renderMediaList(mediaItems);
    } else {
      placeholderElement.style.display = 'block';
      mediaListElement.style.display = 'none';
    }
  });

  function renderMediaList(mediaItems) {
    mediaListElement.innerHTML = ''; // Limpa a lista
    mediaItems.forEach(item => {
      const mediaItemElement = createMediaItemElement(item);
      mediaListElement.appendChild(mediaItemElement);
    });
  }

  function createMediaItemElement(item) {
    const div = document.createElement('div');
    div.className = 'media-item';

    const fileType = getFileType(item.url);
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType);

    div.innerHTML = `
      <img src="${isImage ? item.url : 'icons/icon48.png'}" class="thumbnail" alt="thumbnail">
      <div class="media-info">
        <span class="media-url">${getFileName(item.url)}</span>
        <span class="media-type">${fileType.toUpperCase()} - ${item.type}</span>
      </div>
      <div class="media-actions">
        <button class="download-btn" title="Baixar">
          <img src="icons/icon16.png" alt="Download">
        </button>
      </div>
    `;

    div.querySelector('.download-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'download',
        url: item.url,
        filename: getFileName(item.url)
      });
    });

    return div;
  }

  // Listener para o botão "Baixar Todos"
  downloadAllBtn.addEventListener('click', () => {
    // Futura implementação
    alert('Funcionalidade "Baixar Todos" será implementada em breve!');
  });
});
