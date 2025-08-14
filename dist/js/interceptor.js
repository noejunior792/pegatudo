const originalFetch = window.fetch;
window.fetch = function (...args) {
    const requestPromise = originalFetch.apply(this, args);
    requestPromise.then(response => {
        try {
            const clone = response.clone();
            const contentType = clone.headers.get('Content-Type') || '';
            const url = args[0] instanceof Request ? args[0].url : args[0];
            if (url.includes('.m3u8') || contentType.includes('application/vnd.apple.mpegurl')) {
                window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url, type: 'hls' } }));
            }
            else if (url.includes('.mpd') || contentType.includes('application/dash+xml')) {
                window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url, type: 'dash' } }));
            }
            else if (contentType.match(/video|image|audio/)) {
                window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url, type: 'fetch' } }));
            }
        }
        catch (e) {
        }
    }).catch(() => {
    });
    return requestPromise;
};
const originalXhrOpen = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function (...args) {
    this.addEventListener('load', () => {
        try {
            const contentType = this.getResponseHeader('Content-Type') || '';
            if (this.responseURL && contentType.match(/video|image|audio/)) {
                window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url: this.responseURL, type: 'xhr' } }));
            }
        }
        catch (e) {
        }
    });
    return originalXhrOpen.apply(this, args);
};
