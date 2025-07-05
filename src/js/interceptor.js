const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0] instanceof Request ? args[0].url : args[0];

    if (response.headers.get('Content-Type')?.match(/video|image/)) {
        window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url, type: 'fetch' } }));
    }

    return response;
};

const originalXhrOpen = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url) {
    this.addEventListener('load', () => {
        if (this.responseURL && this.getResponseHeader('Content-Type')?.match(/video|image/)) {
            window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url: this.responseURL, type: 'xhr' } }));
        }
    });
    originalXhrOpen.apply(this, arguments);
};