let extensionEnabled = true;
let debugMode = false;
function initialize() {
    if (!extensionEnabled)
        return;
    if (debugMode) {
        console.log('PegaTudo: Content script inicializado.');
    }
}
window.addEventListener('mediaDiscovered', (event) => {
    if (!extensionEnabled)
        return;
    const { url, type } = event.detail;
    if (debugMode) {
        console.log('PegaTudo: Mídia descoberta:', { url, type });
    }
    chrome.runtime.sendMessage({
        action: 'mediaDiscovered',
        media: {
            url,
            type,
            fileType: url.match(/\.(jpg|jpeg|png|gif|mp4|webm|mp3|ogg|wav)/i)?.[1] || 'unknown'
        }
    });
});
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
