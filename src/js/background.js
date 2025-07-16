// PegaTudo - Background Service Worker

// Armazena as mídias encontradas por ID de aba
const mediaByTab = {};

// Limpa o armazenamento de mídia quando uma aba é fechada
chrome.tabs.onRemoved.addListener((tabId) => {
  if (mediaByTab[tabId]) {
    delete mediaByTab[tabId];
  }
});

// Limpa o armazenamento de mídia quando o usuário navega para uma nova página na mesma aba
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    if (mediaByTab[tabId]) {
      delete mediaByTab[tabId];
    }
  }
});

// Listener principal de mensagens
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.action) {
    // Mensagem do content script quando uma nova mídia é descoberta
    case 'mediaDiscovered':
      if (tabId) {
        if (!mediaByTab[tabId]) {
          mediaByTab[tabId] = [];
        }
        // Evita adicionar URLs duplicadas
        if (!mediaByTab[tabId].some(item => item.url === message.media.url)) {
          mediaByTab[tabId].push(message.media);
        }
      }
      break;

    // Mensagem da popup para obter a lista de mídias da aba atual
    case 'getMediaList':
      if (tabId) {
        sendResponse(mediaByTab[tabId] || []);
      }
      return true; // Necessário para sendResponse assíncrono

    // Mensagem para iniciar um download
    case 'download':
      chrome.downloads.download({
        url: message.url,
        filename: message.filename,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
        }
      });
      break;
  }
  
  // Retorna true para indicar que a resposta pode ser assíncrona
  return true;
});

console.log("PegaTudo Service Worker iniciado.");
