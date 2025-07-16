// settings.js

document.addEventListener('DOMContentLoaded', () => {
  const debugModeToggle = document.getElementById('debugModeToggle');

  // Carrega o valor salvo e atualiza o toggle
  chrome.storage.sync.get(['debugMode'], (result) => {
    debugModeToggle.checked = !!result.debugMode;
  });

  // Salva a configuração quando o toggle é alterado
  debugModeToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ debugMode: isEnabled });

    // Notifica o content script sobre a mudança (opcional, mas bom para consistência)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'toggleDebugMode', 
                enabled: isEnabled 
            }).catch(() => {});
        }
    });
  });
});
