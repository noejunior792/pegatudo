// PegaTudo - Content Script

let extensionEnabled = true;
let debugMode = false;

// Inicializa a extensão na página
function initialize() {
  if (!extensionEnabled) return;
  
  if (debugMode) {
    console.log('PegaTudo: Content script inicializado.');
  }
  
  // O interceptor já está sendo injetado via manifest.json e funciona de forma independente.
}

// Listener para mídias descobertas pelo interceptor
window.addEventListener('mediaDiscovered', (event) => {
  if (!extensionEnabled) return;

  const { url, type } = event.detail;
  if (debugMode) {
    console.log('PegaTudo: Mídia descoberta:', { url, type });
  }

  // Envia a mídia para o background script para ser agregada
  chrome.runtime.sendMessage({
    action: 'mediaDiscovered',
    media: {
      url,
      type, // 'fetch' ou 'xhr'
      fileType: url.match(/\.(jpg|jpeg|png|gif|mp4|webm|mp3|ogg|wav)/i)?.[1] || 'unknown'
    }
  });
});

// Gerencia o estado da extensão (ativado/desativado)
chrome.storage.sync.get(['extensionEnabled', 'debugMode'], (result) => {
  extensionEnabled = result.extensionEnabled !== false;
  debugMode = result.debugMode === true;
  initialize();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleExtension') {
    extensionEnabled = message.enabled;
  }
  if (message.action === 'toggleDebugMode') {
    debugMode = message.enabled;
  }
});
