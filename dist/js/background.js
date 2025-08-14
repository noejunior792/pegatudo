importScripts('./services/hls-downloader.js');
const mediaByTab = {};
chrome.tabs.onRemoved.addListener((tabId) => {
    if (mediaByTab[tabId]) {
        delete mediaByTab[tabId];
    }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        if (mediaByTab[tabId]) {
            delete mediaByTab[tabId];
        }
    }
});
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
