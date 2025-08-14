document.addEventListener('DOMContentLoaded', () => {
    const mediaListElement = document.getElementById('mediaList');
    const placeholderElement = document.getElementById('placeholder');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const extensionToggle = document.getElementById('extensionToggle');
    const settingsBtn = document.getElementById('settingsBtn');
    let currentMediaItems = [];
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
    chrome.storage.sync.get('extensionEnabled', (result) => {
        extensionToggle.checked = result.extensionEnabled !== false;
    });
    extensionToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.sync.set({ extensionEnabled: isEnabled });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleExtension', enabled: isEnabled });
            }
        });
    });
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
        }
        else {
            placeholderElement.style.display = 'block';
            mediaListElement.style.display = 'none';
            downloadAllBtn.disabled = true;
        }
    });
    function renderMediaList(mediaItems) {
        mediaListElement.innerHTML = '';
        mediaItems.forEach(item => {
            const mediaItemElement = createMediaItemElement(item);
            mediaListElement.appendChild(mediaItemElement);
        });
    }
    function createMediaItemElement(item) {
        const div = document.createElement('div');
        div.className = 'media-item';
        const fileType = getFileType(item.url);
        const isStream = item.type === 'hls' || item.type === 'dash';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType);
        div.innerHTML = `
      <img src="${isImage ? item.url : 'icons/icon48.png'}" class="thumbnail" alt="thumbnail" loading="lazy">
      <div class="media-info">
        <span class="media-url">${getFileName(item.url)}</span>
        <span class="media-type ${isStream ? 'stream' : ''}">${item.type.toUpperCase()}</span>
      </div>
      <div class="media-actions">
        <button class="download-btn" title="Baixar">
          <img src="icons/icon16.png" alt="Download">
        </button>
      </div>
    `;
        div.querySelector('.download-btn').addEventListener('click', (e) => {
            const button = e.currentTarget;
            button.disabled = true;
            if (isStream) {
                downloadStream(item);
            }
            else {
                downloadSingleItem(item);
                setTimeout(() => button.disabled = false, 2000);
            }
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
    function downloadStream(item) {
        showToast(`Iniciando download do stream...`);
        chrome.runtime.sendMessage({
            action: 'downloadHls',
            url: item.url,
            filename: getFileName(item.url).replace('.m3u8', '')
        });
    }
    downloadAllBtn.addEventListener('click', () => {
        const downloadableItems = currentMediaItems.filter(item => item.type !== 'hls' && item.type !== 'dash');
        if (downloadableItems.length === 0) {
            showToast('Nenhuma mídia direta para baixar.', 2000);
            return;
        }
        showToast(`Iniciando download de ${downloadableItems.length} arquivos...`);
        downloadableItems.forEach((item, index) => {
            setTimeout(() => {
                downloadSingleItem(item);
            }, index * 300);
        });
    });
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'hlsProgress') {
            showToast(message.message, 2500);
        }
    });
});
