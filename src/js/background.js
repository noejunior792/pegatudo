// PegaTudo - Background Service Worker
importScripts('./services/hls-downloader.js');

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
    case 'mediaDiscovered':
      if (tabId) {
        if (!mediaByTab[tabId]) {
          mediaByTab[tabId] = [];
        }
        if (!mediaByTab[tabId].some(item => item.url === message.media.url)) {
          mediaByTab[tabId].push(message.media);
        }
      }
      break;

    case 'getMediaList':
      if (tabId) {
        sendResponse(mediaByTab[tabId] || []);
      }
      return true;

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

    case 'downloadHls':
      if (tabId) {
        downloadHls(message.url, message.filename, tabId);
      }
      break;
    
    // Repassa a mensagem de progresso para a popup correta
    case 'hlsProgress':
      chrome.tabs.sendMessage(message.tabId, { 
        action: 'hlsProgress', 
        message: message.message 
      });
      break;
  }
  
  return true;
});

console.log("PegaTudo Service Worker iniciado.");