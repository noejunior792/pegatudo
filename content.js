const processedElements = new WeakSet();
let extensionEnabled = true;

function getFileExtension(mimeType) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  };
  return mimeMap[mimeType] || 'bin';
}

async function downloadBlob(blobUrl) {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const extension = getFileExtension(blob.type);
    const filename = `blob_${Date.now()}.${extension}`;

    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    return { success: true };
  } catch (error) {
    console.error('PegaTudo Error:', error);
    return { success: false, error: error.message };
  }
}

function createDownloadButton(mediaElement) {
  if (!extensionEnabled || processedElements.has(mediaElement) || mediaElement.closest('.pega-tudo-container')) {
    return;
  }

  const isBlob = mediaElement.src.startsWith('blob:');
  if (!isBlob) return;

  const container = document.createElement('div');
  container.className = 'pega-tudo-container';

  const button = document.createElement('button');
  button.textContent = 'Baixar Blob';
  button.className = 'pega-tudo-download-button';

  container.appendChild(button);
  mediaElement.parentElement.style.position = 'relative';
  mediaElement.parentElement.appendChild(container);

  processedElements.add(mediaElement);

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    button.textContent = 'Baixando...';
    button.disabled = true;

    const result = await downloadBlob(mediaElement.src);

    if (result.success) {
      button.textContent = 'Baixado!';
    } else {
      button.textContent = 'Falhou!';
      console.error('Download failed:', result.error);
    }

    setTimeout(() => {
      button.textContent = 'Baixar Blob';
      button.disabled = false;
    }, 3000);
  });
}

function run() {
  if (!extensionEnabled) return;
  document.querySelectorAll('video, img, a').forEach(el => {
    const url = el.src || el.href;
    if (url && url.startsWith('blob:')) {
      createDownloadButton(el);
    }
  });
}

chrome.storage.sync.get(['extensionEnabled'], (result) => {
  extensionEnabled = result.extensionEnabled !== false;
  if (extensionEnabled) {
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleExtension') {
    extensionEnabled = message.enabled;
    if (!extensionEnabled) {
      document.querySelectorAll('.pega-tudo-container').forEach(el => el.remove());
    } else {
      run();
    }
  }
});