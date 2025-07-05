// Load and set toggle state on popup load
chrome.storage.sync.get(['extensionEnabled', 'debugMode'], (result) => {
  const isEnabled = result.extensionEnabled !== false; // Default to true
  const debugMode = result.debugMode === true;

  const extensionToggle = document.getElementById('extensionToggle');
  const extensionStatus = document.getElementById('toggleStatus');
  const debugModeToggle = document.getElementById('debugModeToggle');
  
  extensionToggle.checked = isEnabled;
  extensionStatus.textContent = isEnabled ? 'Ativado' : 'Desativado';
  debugModeToggle.checked = debugMode;
});

// Handle extension toggle change
document.getElementById('extensionToggle').addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  const status = document.getElementById('toggleStatus');
  
  chrome.storage.sync.set({ extensionEnabled: isEnabled });
  status.textContent = isEnabled ? 'Ativado' : 'Desativado';
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'toggleExtension', 
        enabled: isEnabled 
      }).catch(() => {});
    }
  });
});

// Handle debug mode toggle change
document.getElementById('debugModeToggle').addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ debugMode: isEnabled });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'toggleDebugMode', 
                enabled: isEnabled 
            }).catch(() => {});
        }
    });
});

document.getElementById("openDownloads").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://downloads" });
});