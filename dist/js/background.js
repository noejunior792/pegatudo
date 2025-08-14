importScripts('./services/hls-downloader.js');
const mediaByTab = {};
const maxMediaPerTab = 500;
chrome.runtime.onInstalled.addListener(() => {
    console.log('PegaTudo: Setting up network request rules...');
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1, 2, 3, 4, 5],
        addRules: [
            {
                id: 1,
                priority: 1,
                action: { type: "allow" },
                condition: {
                    urlFilter: "*",
                    resourceTypes: ["media"]
                }
            },
            {
                id: 2,
                priority: 1,
                action: { type: "allow" },
                condition: {
                    urlFilter: "*.m3u8*",
                    resourceTypes: ["xmlhttprequest", "other"]
                }
            },
            {
                id: 3,
                priority: 1,
                action: { type: "allow" },
                condition: {
                    urlFilter: "*.mpd*",
                    resourceTypes: ["xmlhttprequest", "other"]
                }
            },
            {
                id: 4,
                priority: 1,
                action: { type: "allow" },
                condition: {
                    urlFilter: "*.ts*",
                    resourceTypes: ["xmlhttprequest", "other"]
                }
            },
            {
                id: 5,
                priority: 1,
                action: { type: "allow" },
                condition: {
                    urlFilter: "blob:*",
                    resourceTypes: ["media", "xmlhttprequest"]
                }
            }
        ]
    }).catch(err => {
        console.error('PegaTudo: Error setting up declarative rules:', err);
    });
});
function addMediaToTab(tabId, media) {
    if (!mediaByTab[tabId]) {
        mediaByTab[tabId] = [];
    }
    const isDuplicate = mediaByTab[tabId].some(item => item.url === media.url &&
        item.type === media.type);
    if (!isDuplicate) {
        if (mediaByTab[tabId].length >= maxMediaPerTab) {
            mediaByTab[tabId].shift();
        }
        mediaByTab[tabId].push({
            ...media,
            id: generateMediaId(media),
            addedAt: Date.now()
        });
        chrome.runtime.sendMessage({
            action: 'mediaListUpdated',
            tabId,
            mediaCount: mediaByTab[tabId].length
        }).catch(() => {
        });
    }
}
function generateMediaId(media) {
    return btoa(media.url + media.type + media.timestamp).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}
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
                addMediaToTab(tabId, message.media);
            }
            break;
        case 'getMediaList':
            if (tabId) {
                const mediaList = mediaByTab[tabId] || [];
                const categorized = categorizeMedia(mediaList);
                sendResponse(categorized);
            }
            return true;
        case 'download':
            downloadSingleFile(message.url, message.filename);
            break;
        case 'downloadMultiple':
            downloadMultipleFiles(message.items);
            break;
        case 'downloadHls':
            if (tabId) {
                downloadHls(message.url, message.filename, tabId);
            }
            break;
        case 'downloadDash':
            if (tabId) {
                downloadDash(message.url, message.filename, tabId);
            }
            break;
        case 'hlsProgress':
            if (message.tabId) {
                chrome.tabs.sendMessage(message.tabId, {
                    action: 'hlsProgress',
                    message: message.message
                }).catch(() => {
                });
            }
            break;
        case 'getTabMediaCount':
            if (tabId) {
                sendResponse(mediaByTab[tabId]?.length || 0);
            }
            return true;
    }
    return true;
});
function categorizeMedia(mediaList) {
    const categories = {
        videos: [],
        images: [],
        audio: [],
        streams: [],
        other: []
    };
    mediaList.forEach(media => {
        if (media.type === 'hls' || media.type === 'dash') {
            categories.streams.push(media);
        }
        else if (media.type === 'video' || media.mimeType?.startsWith('video/')) {
            categories.videos.push(media);
        }
        else if (media.type === 'image' || media.mimeType?.startsWith('image/')) {
            categories.images.push(media);
        }
        else if (media.type === 'audio' || media.mimeType?.startsWith('audio/')) {
            categories.audio.push(media);
        }
        else {
            categories.other.push(media);
        }
    });
    Object.keys(categories).forEach(key => {
        categories[key].sort((a, b) => b.timestamp - a.timestamp);
    });
    return categories;
}
function downloadSingleFile(url, filename, options = {}) {
    chrome.downloads.download({
        url: url,
        filename: filename,
        conflictAction: 'uniquify',
        ...options
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error('PegaTudo: Download failed:', chrome.runtime.lastError);
            chrome.runtime.sendMessage({
                action: 'downloadError',
                error: chrome.runtime.lastError.message,
                url: url
            }).catch(() => { });
        }
        else {
            console.log('PegaTudo: Download started:', downloadId);
        }
    });
}
function downloadMultipleFiles(items) {
    if (!items || items.length === 0)
        return;
    console.log(`PegaTudo: Starting batch download of ${items.length} files`);
    items.forEach((item, index) => {
        setTimeout(() => {
            downloadSingleFile(item.url, item.filename || getFileName(item.url));
        }, index * 500);
    });
}
function getFileName(url) {
    try {
        const urlObject = new URL(url);
        const pathname = urlObject.pathname;
        const decodedPathname = decodeURIComponent(pathname);
        return decodedPathname.substring(decodedPathname.lastIndexOf('/') + 1) || `media_${Date.now()}`;
    }
    catch (e) {
        return `media_${Date.now()}`;
    }
}
async function downloadDash(url, filename, tabId) {
    console.log('PegaTudo: DASH download not fully implemented yet, using regular download');
    downloadSingleFile(url, filename);
}
console.log("PegaTudo: Enhanced service worker started.");
