// Load and set toggle state on popup load
chrome.storage.sync.get(['extensionEnabled'], (result) => {
  const isEnabled = result.extensionEnabled !== false; // Default to true
  const toggle = document.getElementById('extensionToggle');
  const status = document.getElementById('toggleStatus');
  
  toggle.checked = isEnabled;
  status.textContent = isEnabled ? 'Ativado' : 'Desativado';
});

// Handle toggle change
document.getElementById('extensionToggle').addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  const status = document.getElementById('toggleStatus');
  
  // Save state to storage
  chrome.storage.sync.set({ extensionEnabled: isEnabled });
  
  // Update status text
  status.textContent = isEnabled ? 'Ativado' : 'Desativado';
  
  // Send message to content scripts to update their behavior
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'toggleExtension', 
        enabled: isEnabled 
      }).catch(() => {
        // Ignore errors if content script is not loaded
      });
    }
  });
});

document.getElementById("openDownloads").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://downloads" });
});
