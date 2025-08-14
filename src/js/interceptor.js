// PegaTudo - Safe Network Interceptor
// This script carefully intercepts network requests without breaking host pages

(function() {
  'use strict';
  
  // Check if PegaTudo is already initialized to prevent conflicts
  if (window.pegaTudoInitialized) {
    return;
  }
  window.pegaTudoInitialized = true;

  // Store original functions to ensure we can restore them if needed
  const originalFetch = window.fetch;
  const originalXhrOpen = window.XMLHttpRequest.prototype.open;
  const originalXhrSend = window.XMLHttpRequest.prototype.send;

  // Safe event dispatcher that won't interfere with page functionality
  function safeDispatchMediaEvent(url, type, additional = {}) {
    try {
      window.dispatchEvent(new CustomEvent('pegaTudoMediaDiscovered', { 
        detail: { url, type, ...additional }
      }));
    } catch (e) {
      // Silently fail to prevent breaking the host page
      console.debug('PegaTudo: Safe event dispatch failed', e);
    }
  }

  // Enhanced fetch interceptor with better error handling
  window.fetch = function(...args) {
    const requestPromise = originalFetch.apply(this, args);

    // Non-blocking promise handler
    requestPromise.then(response => {
      try {
        if (!response.ok) return; // Skip failed requests
        
        const clone = response.clone();
        const contentType = clone.headers.get('Content-Type') || '';
        const url = args[0] instanceof Request ? args[0].url : args[0];
        
        // Skip very short URLs or data URLs to avoid noise
        if (!url || url.length < 10 || url.startsWith('data:')) return;
        
        // Enhanced media type detection
        if (url.includes('.m3u8') || contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegURL')) {
          safeDispatchMediaEvent(url, 'hls');
        } else if (url.includes('.mpd') || contentType.includes('application/dash+xml')) {
          safeDispatchMediaEvent(url, 'dash');
        } else if (contentType.match(/^video\//)) {
          safeDispatchMediaEvent(url, 'video', { mimeType: contentType });
        } else if (contentType.match(/^image\//)) {
          safeDispatchMediaEvent(url, 'image', { mimeType: contentType });
        } else if (contentType.match(/^audio\//)) {
          safeDispatchMediaEvent(url, 'audio', { mimeType: contentType });
        }
      } catch (e) {
        // Silent error handling to prevent page breakage
      }
    }).catch(() => {
      // Silent error handling for failed requests
    });

    return requestPromise;
  };

  // Enhanced XMLHttpRequest interceptor
  window.XMLHttpRequest.prototype.open = function(...args) {
    const result = originalXhrOpen.apply(this, args);
    
    // Add load listener safely
    const originalAddEventListener = this.addEventListener;
    if (originalAddEventListener) {
      this.addEventListener('load', function() {
        try {
          if (this.status >= 200 && this.status < 300 && this.responseURL) {
            const contentType = this.getResponseHeader('Content-Type') || '';
            
            if (contentType.match(/video|image|audio/) || 
                this.responseURL.match(/\.(mp4|webm|mp3|wav|jpg|jpeg|png|gif)(\?|$)/i)) {
              safeDispatchMediaEvent(this.responseURL, 'xhr', { mimeType: contentType });
            }
          }
        } catch (e) {
          // Silent error handling
        }
      });
    }
    
    return result;
  };

  // Enhanced blob URL detection
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function(blob) {
    const url = originalCreateObjectURL.apply(this, arguments);
    
    // Detect blob URLs that might contain media
    if (blob && blob.type && blob.type.match(/video|image|audio/)) {
      safeDispatchMediaEvent(url, 'blob', { 
        mimeType: blob.type,
        size: blob.size 
      });
    }
    
    return url;
  };

  console.debug('PegaTudo: Safe interceptor initialized');
})();
