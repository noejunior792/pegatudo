document.addEventListener('DOMContentLoaded', () => {
    const debugModeToggle = document.getElementById('debugModeToggle');
    chrome.storage.sync.get(['debugMode'], (result) => {
        debugModeToggle.checked = !!result.debugMode;
    });
    debugModeToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.sync.set({ debugMode: isEnabled });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleDebugMode',
                    enabled: isEnabled
                }).catch(() => { });
            }
        });
    });
});
