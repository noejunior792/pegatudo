document.addEventListener('DOMContentLoaded', () => {
    const mediaListElement = document.getElementById('mediaList');
    const placeholderElement = document.getElementById('placeholder');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const extensionToggle = document.getElementById('extensionToggle');
    const settingsBtn = document.getElementById('settingsBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const mediaCount = document.getElementById('mediaCount');
    let currentMediaCategories = {};
    let selectedItems = new Set();
    let autoRefreshInterval = null;
    initialize();
    function initialize() {
        setupEventListeners();
        loadSettings();
        loadMediaList();
        startAutoRefresh();
    }
    function setupEventListeners() {
        settingsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
        refreshBtn.addEventListener('click', () => {
            loadMediaList();
            showToast('Lista de mídia atualizada');
        });
        extensionToggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            chrome.storage.sync.set({ extensionEnabled: isEnabled });
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleExtension',
                        enabled: isEnabled
                    }).catch(() => { });
                }
            });
            if (isEnabled) {
                startAutoRefresh();
            }
            else {
                stopAutoRefresh();
            }
        });
        downloadAllBtn.addEventListener('click', () => {
            downloadAllMedia();
        });
        downloadSelectedBtn.addEventListener('click', () => {
            downloadSelectedMedia();
        });
        selectAllBtn.addEventListener('click', () => {
            toggleSelectAll();
        });
    }
    function loadSettings() {
        chrome.storage.sync.get(['extensionEnabled', 'autoRefresh'], (result) => {
            extensionToggle.checked = result.extensionEnabled !== false;
            if (result.extensionEnabled === false) {
                stopAutoRefresh();
            }
        });
    }
    function loadMediaList() {
        chrome.runtime.sendMessage({ action: 'getMediaList' }, (categorizedMedia) => {
            if (chrome.runtime.lastError) {
                showError('Erro ao carregar mídias. Tente recarregar a página.');
                return;
            }
            currentMediaCategories = categorizedMedia || {};
            const totalCount = getTotalMediaCount();
            updateMediaCount(totalCount);
            if (totalCount > 0) {
                showMediaList();
                updateButtonStates();
            }
            else {
                showPlaceholder();
            }
        });
    }
    function getTotalMediaCount() {
        return Object.values(currentMediaCategories).reduce((total, items) => total + items.length, 0);
    }
    function updateMediaCount(count) {
        if (mediaCount) {
            mediaCount.textContent = count > 0 ? `${count} mídias encontradas` : '';
        }
    }
    function showMediaList() {
        placeholderElement.style.display = 'none';
        mediaListElement.style.display = 'block';
        renderCategorizedMedia();
    }
    function showPlaceholder() {
        placeholderElement.style.display = 'block';
        mediaListElement.style.display = 'none';
        downloadAllBtn.disabled = true;
        downloadSelectedBtn.disabled = true;
        selectAllBtn.disabled = true;
    }
    function showError(message) {
        placeholderElement.textContent = message;
        placeholderElement.style.display = 'block';
        mediaListElement.style.display = 'none';
    }
    function renderCategorizedMedia() {
        mediaListElement.innerHTML = '';
        selectedItems.clear();
        const categoryOrder = ['streams', 'videos', 'images', 'audio', 'other'];
        const categoryLabels = {
            streams: 'Streams (HLS/DASH)',
            videos: 'Vídeos',
            images: 'Imagens',
            audio: 'Áudios',
            other: 'Outros'
        };
        categoryOrder.forEach(category => {
            const items = currentMediaCategories[category];
            if (items && items.length > 0) {
                const categorySection = createCategorySection(categoryLabels[category], items, category);
                mediaListElement.appendChild(categorySection);
            }
        });
        updateButtonStates();
    }
    function createCategorySection(title, items, category) {
        const section = document.createElement('div');
        section.className = 'media-category';
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
      <h3>${title} (${items.length})</h3>
      <button class="category-select-all" data-category="${category}">
        Selecionar Todos
      </button>
    `;
        const itemsList = document.createElement('div');
        itemsList.className = 'category-items';
        items.forEach(item => {
            const mediaElement = createMediaItemElement(item, category);
            itemsList.appendChild(mediaElement);
        });
        section.appendChild(header);
        section.appendChild(itemsList);
        header.querySelector('.category-select-all').addEventListener('click', (e) => {
            toggleCategorySelection(category, items);
        });
        return section;
    }
    function createMediaItemElement(item, category) {
        const div = document.createElement('div');
        div.className = 'media-item';
        div.dataset.mediaId = item.id;
        const fileType = item.fileType || getFileType(item.url);
        const isStream = category === 'streams';
        const isImage = category === 'images';
        const fileName = getFileName(item.url);
        let thumbnailSrc = 'icons/icon48.png';
        if (isImage && item.url.startsWith('http')) {
            thumbnailSrc = item.url;
        }
        div.innerHTML = `
      <div class="media-item-select">
        <input type="checkbox" class="media-checkbox" data-media-id="${item.id}">
      </div>
      <div class="media-thumbnail">
        <img src="${thumbnailSrc}" alt="thumbnail" loading="lazy">
        ${isStream ? '<span class="stream-badge">STREAM</span>' : ''}
      </div>
      <div class="media-info">
        <div class="media-filename" title="${fileName}">${fileName}</div>
        <div class="media-metadata">
          <span class="media-type">${item.type.toUpperCase()}</span>
          ${item.mimeType ? `<span class="media-mime">${item.mimeType}</span>` : ''}
          ${item.size ? `<span class="media-size">${formatFileSize(item.size)}</span>` : ''}
          <span class="media-source">${item.source}</span>
        </div>
      </div>
      <div class="media-actions">
        <button class="download-btn" title="Baixar" data-media-id="${item.id}">
          📥
        </button>
      </div>
    `;
        const checkbox = div.querySelector('.media-checkbox');
        const downloadBtn = div.querySelector('.download-btn');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedItems.add(item.id);
                div.classList.add('selected');
            }
            else {
                selectedItems.delete(item.id);
                div.classList.remove('selected');
            }
            updateButtonStates();
        });
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            downloadSingleItem(item, isStream);
        });
        return div;
    }
    function toggleCategorySelection(category, items) {
        const categoryItems = items.map(item => item.id);
        const allSelected = categoryItems.every(id => selectedItems.has(id));
        if (allSelected) {
            categoryItems.forEach(id => {
                selectedItems.delete(id);
                const element = document.querySelector(`[data-media-id="${id}"]`);
                if (element) {
                    const checkbox = element.querySelector('.media-checkbox');
                    const itemDiv = element.closest('.media-item');
                    checkbox.checked = false;
                    itemDiv.classList.remove('selected');
                }
            });
        }
        else {
            categoryItems.forEach(id => {
                selectedItems.add(id);
                const element = document.querySelector(`[data-media-id="${id}"]`);
                if (element) {
                    const checkbox = element.querySelector('.media-checkbox');
                    const itemDiv = element.closest('.media-item');
                    checkbox.checked = true;
                    itemDiv.classList.add('selected');
                }
            });
        }
        updateButtonStates();
    }
    function toggleSelectAll() {
        const allItems = getAllMediaItems();
        const allSelected = allItems.every(item => selectedItems.has(item.id));
        if (allSelected) {
            selectedItems.clear();
            document.querySelectorAll('.media-checkbox').forEach(checkbox => {
                checkbox.checked = false;
                checkbox.closest('.media-item').classList.remove('selected');
            });
        }
        else {
            allItems.forEach(item => selectedItems.add(item.id));
            document.querySelectorAll('.media-checkbox').forEach(checkbox => {
                checkbox.checked = true;
                checkbox.closest('.media-item').classList.add('selected');
            });
        }
        updateButtonStates();
    }
    function getAllMediaItems() {
        return Object.values(currentMediaCategories).flat();
    }
    function updateButtonStates() {
        const totalCount = getTotalMediaCount();
        const selectedCount = selectedItems.size;
        downloadAllBtn.disabled = totalCount === 0;
        downloadSelectedBtn.disabled = selectedCount === 0;
        downloadSelectedBtn.textContent = selectedCount > 0 ?
            `Baixar Selecionados (${selectedCount})` : 'Baixar Selecionados';
        selectAllBtn.disabled = totalCount === 0;
        const allSelected = totalCount > 0 && selectedCount === totalCount;
        selectAllBtn.textContent = allSelected ? 'Desmarcar Todos' : 'Selecionar Todos';
    }
    function downloadSingleItem(item, isStream) {
        const filename = getFileName(item.url);
        if (isStream) {
            showToast(`Iniciando download do stream: ${filename}`);
            const action = item.type === 'dash' ? 'downloadDash' : 'downloadHls';
            chrome.runtime.sendMessage({
                action: action,
                url: item.url,
                filename: filename.replace(/\.(m3u8|mpd)$/, '')
            });
        }
        else {
            showToast(`Baixando: ${filename}`);
            chrome.runtime.sendMessage({
                action: 'download',
                url: item.url,
                filename: filename
            });
        }
    }
    function downloadSelectedMedia() {
        const selectedMedia = getAllMediaItems().filter(item => selectedItems.has(item.id));
        if (selectedMedia.length === 0) {
            showToast('Nenhuma mídia selecionada');
            return;
        }
        const regularDownloads = selectedMedia.filter(item => item.type !== 'hls' && item.type !== 'dash');
        const streamDownloads = selectedMedia.filter(item => item.type === 'hls' || item.type === 'dash');
        showToast(`Iniciando download de ${selectedMedia.length} arquivos...`);
        if (regularDownloads.length > 0) {
            chrome.runtime.sendMessage({
                action: 'downloadMultiple',
                items: regularDownloads.map(item => ({
                    url: item.url,
                    filename: getFileName(item.url)
                }))
            });
        }
        streamDownloads.forEach((item, index) => {
            setTimeout(() => {
                downloadSingleItem(item, true);
            }, index * 1000);
        });
    }
    function downloadAllMedia() {
        const allItems = getAllMediaItems();
        if (allItems.length === 0) {
            showToast('Nenhuma mídia encontrada');
            return;
        }
        allItems.forEach(item => selectedItems.add(item.id));
        updateSelectionUI();
        downloadSelectedMedia();
    }
    function updateSelectionUI() {
        document.querySelectorAll('.media-checkbox').forEach(checkbox => {
            const mediaId = checkbox.dataset.mediaId;
            checkbox.checked = selectedItems.has(mediaId);
            if (selectedItems.has(mediaId)) {
                checkbox.closest('.media-item').classList.add('selected');
            }
        });
        updateButtonStates();
    }
    function formatFileSize(bytes) {
        if (!bytes)
            return '';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    function startAutoRefresh() {
        stopAutoRefresh();
        autoRefreshInterval = setInterval(() => {
            loadMediaList();
        }, 3000);
    }
    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'mediaListUpdated') {
            loadMediaList();
        }
        else if (message.action === 'hlsProgress') {
            showToast(message.message, 2500);
        }
        else if (message.action === 'downloadError') {
            showToast(`Erro no download: ${message.error}`, 5000);
        }
    });
    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
    });
});
