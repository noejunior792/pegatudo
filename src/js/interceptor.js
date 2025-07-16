// Intercept network requests to find media files.
// This script is injected into the page context.

const originalFetch = window.fetch;
window.fetch = function(...args) {
  // Execute the original fetch and get the promise
  const requestPromise = originalFetch.apply(this, args);

  // Attach a non-blocking listener to the promise
  requestPromise.then(response => {
    try {
      // It's crucial to clone the response, as the body can only be read once.
      const clone = response.clone();
      const contentType = clone.headers.get('Content-Type') || '';
      const url = args[0] instanceof Request ? args[0].url : args[0];
      
      // Detecta manifestos de HLS/DASH pela extensão ou pelo content-type
      if (url.includes('.m3u8') || contentType.includes('application/vnd.apple.mpegurl')) {
        window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url, type: 'hls' } }));
      } else if (url.includes('.mpd') || contentType.includes('application/dash+xml')) {
        window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url, type: 'dash' } }));
      } 
      // Detecta outras mídias
      else if (contentType.match(/video|image|audio/)) {
        window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url, type: 'fetch' } }));
      }
    } catch (e) {
      // Silently catch errors to avoid breaking the host page
    }
  }).catch(() => {
    // Also catch potential promise rejections silently
  });

  // Return the original, untouched promise immediately
  return requestPromise;
};

const originalXhrOpen = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(...args) {
    this.addEventListener('load', () => {
        try {
            const contentType = this.getResponseHeader('Content-Type') || '';
            if (this.responseURL && contentType.match(/video|image|audio/)) {
                window.dispatchEvent(new CustomEvent('mediaDiscovered', { detail: { url: this.responseURL, type: 'xhr' } }));
            }
        } catch (e) {
            // Silently catch errors to avoid breaking the host page
        }
    });
    return originalXhrOpen.apply(this, args);
};
