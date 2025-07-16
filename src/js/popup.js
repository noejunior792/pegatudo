// PegaTudo - Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const mediaListElement = document.getElementById('mediaList');
  const placeholderElement = document.getElementById('placeholder');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const extensionToggle = document.getElementById('extensionToggle');
  const settingsBtn = document.getElementById('settingsBtn');

  let currentMediaItems = []; // Armazena a lista de mídias atual

  // Listener para o botão de configurações
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Carrega o estado do toggle
  chrome.storage.sync.get('extensionEnabled', (result) => {
    extensionToggle.checked = result.extensionEnabled !== false;
  });

  // Listener para o toggle de ativar/desativar
  extensionToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ extensionEnabled: isEnabled });
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

    currentMediaItems = mediaItems || [];
    if (currentMediaItems.length > 0) {
      placeholderElement.style.display = 'none';
      mediaListElement.style.display = 'block';
      downloadAllBtn.disabled = false;
      renderMediaList(currentMediaItems);
    } else {
      placeholderElement.style.display = 'block';
      mediaListElement.style.display = 'none';
      downloadAllBtn.disabled = true;
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
      <img src="${isImage ? item.url : 'icons/icon48.png'}" class="thumbnail" alt="thumbnail" loading="lazy">
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
      downloadSingleItem(item);
    });

    return div;
  }

  function downloadSingleItem(item) {
    showToast(`Baixando: ${getFileName(item.url)}`);
    chrome.runtime.sendMessage({
      action: 'download',
      url: item.url,
      filename: getFileName(item.url)
    });
  }

  // Listener para o botão "Baixar Todos"
  downloadAllBtn.addEventListener('click', () => {
    if (currentMediaItems.length === 0) {
      showToast('Nenhuma mídia para baixar.', 2000);
      return;
    }

    showToast(`Iniciando download de ${currentMediaItems.length} arquivos...`);
    
    // Baixa todos os itens com um pequeno intervalo
    currentMediaItems.forEach((item, index) => {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'download',
          url: item.url,
          filename: getFileName(item.url)
        });
      }, index * 300); // 300ms de intervalo para não sobrecarregar
    });
  });
});