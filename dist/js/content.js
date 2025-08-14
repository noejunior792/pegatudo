(function () {
    'use strict';
    let extensionEnabled = true;
    let debugMode = false;
    let domObserver = null;
    function initialize() {
        if (!extensionEnabled)
            return;
        try {
            if (debugMode) {
                console.log('PegaTudo: Content script initialized safely after page load.');
            }
            setupMediaDetection();
            setupDOMMediaDetection();
        }
        catch (error) {
            logError('initialization', error);
        }
    }
    function setupMediaDetection() {
        try {
            window.addEventListener('pegaTudoMediaDiscovered', (event) => {
                if (!extensionEnabled)
                    return;
                const { url, type, mimeType, size } = event.detail;
                if (debugMode) {
                    console.log('PegaTudo: Media discovered:', { url, type, mimeType, size });
                }
                let fileType = 'unknown';
                let category = type;
                if (mimeType) {
                    if (mimeType.startsWith('video/'))
                        category = 'video';
                    else if (mimeType.startsWith('image/'))
                        category = 'image';
                    else if (mimeType.startsWith('audio/'))
                        category = 'audio';
                }
                try {
                    const urlObj = new URL(url);
                    const extension = urlObj.pathname.split('.').pop().toLowerCase();
                    if (extension && extension.length < 8) {
                        fileType = extension.split('?')[0];
                    }
                }
                catch (e) {
                    const extensionMatch = url.match(/\.([a-z0-9]{2,5})(\?|$)/i);
                    if (extensionMatch) {
                        fileType = extensionMatch[1];
                    }
                }
                sendMediaToBackground(url, category, 'interceptor', {
                    fileType,
                    mimeType,
                    size,
                    timestamp: Date.now()
                });
            }, { passive: true });
        }
        catch (error) {
            logError('media detection setup', error);
        }
    }
    function setupDOMMediaDetection() {
        if (!extensionEnabled)
            return;
        try {
            const scanForMedia = () => {
                try {
                    if (!extensionEnabled || document.hidden)
                        return;
                    const videos = document.querySelectorAll('video[src], video source[src]');
                    videos.forEach(video => {
                        const src = video.src || video.getAttribute('src');
                        if (src && src.startsWith('http') && isValidMediaURL(src)) {
                            sendMediaToBackground(src, 'video', 'dom');
                        }
                    });
                    const audios = document.querySelectorAll('audio[src], audio source[src]');
                    audios.forEach(audio => {
                        const src = audio.src || audio.getAttribute('src');
                        if (src && src.startsWith('http') && isValidMediaURL(src)) {
                            sendMediaToBackground(src, 'audio', 'dom');
                        }
                    });
                    const images = document.querySelectorAll('img[src]');
                    images.forEach(img => {
                        const src = img.src;
                        if (src && src.startsWith('http') && isValidMediaURL(src) &&
                            (img.naturalWidth > 200 || img.naturalHeight > 200 || img.width > 200 || img.height > 200)) {
                            sendMediaToBackground(src, 'image', 'dom');
                        }
                    });
                }
                catch (e) {
                    if (debugMode) {
                        console.log('PegaTudo: DOM scan error:', e);
                    }
                }
            };
            setTimeout(scanForMedia, 2000);
            if (window.MutationObserver && !domObserver) {
                domObserver = new MutationObserver(() => {
                    clearTimeout(domObserver.scanTimeout);
                    domObserver.scanTimeout = setTimeout(scanForMedia, 1000);
                });
                domObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: false
                });
            }
        }
        catch (error) {
            logError('DOM detection setup', error);
        }
    }
    function sendMediaToBackground(url, type, source, additionalData = {}) {
        if (!extensionEnabled || !url)
            return;
        try {
            chrome.runtime.sendMessage({
                action: 'mediaDiscovered',
                media: {
                    url,
                    type,
                    fileType: getFileType(url),
                    timestamp: Date.now(),
                    source,
                    ...additionalData
                }
            }).catch(error => {
                if (debugMode) {
                    console.log('PegaTudo: Error sending media to background:', error);
                }
            });
        }
        catch (error) {
            logError('sending media to background', error);
        }
    }
    function isValidMediaURL(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' || urlObj.protocol === 'blob:';
        }
        catch (e) {
            return false;
        }
    }
    function logError(context, error) {
        if (debugMode) {
            console.error(`PegaTudo [${context}]:`, error);
        }
    }
    function loadSettingsAndInitialize() {
        try {
            chrome.storage.sync.get(['extensionEnabled', 'debugMode', 'domDetection'], (result) => {
                extensionEnabled = result.extensionEnabled !== false;
                debugMode = result.debugMode === true;
                const domDetectionEnabled = result.domDetection !== false;
                if (domDetectionEnabled) {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initialize, { once: true });
                    }
                    else {
                        initialize();
                    }
                }
                else {
                    setupMediaDetection();
                }
            });
        }
        catch (error) {
            logError('settings loading', error);
            initialize();
        }
    }
    try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (message.action === 'toggleExtension') {
                    extensionEnabled = message.enabled;
                    if (debugMode) {
                        console.log('PegaTudo: Extension', extensionEnabled ? 'enabled' : 'disabled');
                    }
                    if (!extensionEnabled && domObserver) {
                        domObserver.disconnect();
                        domObserver = null;
                    }
                }
                if (message.action === 'toggleDebugMode') {
                    debugMode = message.enabled;
                    console.log('PegaTudo: Debug mode', debugMode ? 'enabled' : 'disabled');
                }
                if (message.action === 'settingsUpdated') {
                    const settings = message.settings;
                    extensionEnabled = settings.extensionEnabled !== false;
                    debugMode = settings.debugMode === true;
                    if (settings.domDetection !== false && !domObserver) {
                        setupDOMMediaDetection();
                    }
                    else if (settings.domDetection === false && domObserver) {
                        domObserver.disconnect();
                        domObserver = null;
                    }
                }
            }
            catch (error) {
                logError('message handling', error);
            }
        });
    }
    catch (error) {
        logError('message listener setup', error);
    }
    window.addEventListener('beforeunload', () => {
        try {
            if (domObserver) {
                domObserver.disconnect();
                domObserver = null;
            }
        }
        catch (error) {
        }
    }, { once: true });
    loadSettingsAndInitialize();
})();
