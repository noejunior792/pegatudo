// PegaTudo - Content Script
// Safe content script that doesn't interfere with page functionality

let extensionEnabled = true;
let debugMode = false;

// Initialize extension only after page is fully loaded
function initialize() {
  if (!extensionEnabled) return;
  
  if (debugMode) {
    console.log('PegaTudo: Content script initialized safely after page load.');
  }
  
  // Setup media detection listener
  setupMediaDetection();
  
  // Setup DOM-based media detection as fallback
  setupDOMMediaDetection();
}

// Enhanced media detection with better error handling
function setupMediaDetection() {
  window.addEventListener('pegaTudoMediaDiscovered', (event) => {
    if (!extensionEnabled) return;

    const { url, type, mimeType, size } = event.detail;
    
    if (debugMode) {
      console.log('PegaTudo: Media discovered:', { url, type, mimeType, size });
    }

    // Enhanced media categorization
    let fileType = 'unknown';
    let category = type;
    
    if (mimeType) {
      if (mimeType.startsWith('video/')) category = 'video';
      else if (mimeType.startsWith('image/')) category = 'image';
      else if (mimeType.startsWith('audio/')) category = 'audio';
    }
    
    // Extract file extension more safely
    try {
      const urlObj = new URL(url);
      const extension = urlObj.pathname.split('.').pop().toLowerCase();
      if (extension && extension.length < 8) {
        fileType = extension.split('?')[0];
      }
    } catch (e) {
      // Use fallback detection
      const extensionMatch = url.match(/\.([a-z0-9]{2,5})(\?|$)/i);
      if (extensionMatch) {
        fileType = extensionMatch[1];
      }
    }

    // Send media to background script with enhanced metadata
    chrome.runtime.sendMessage({
      action: 'mediaDiscovered',
      media: {
        url,
        type: category,
        fileType,
        mimeType,
        size,
        timestamp: Date.now(),
        source: 'interceptor'
      }
    }).catch(err => {
      if (debugMode) {
        console.log('PegaTudo: Error sending media to background:', err);
      }
    });
  });
}

// Fallback DOM-based media detection
function setupDOMMediaDetection() {
  if (!extensionEnabled) return;
  
  // Safe DOM scanning that doesn't affect page performance
  const scanForMedia = () => {
    try {
      // Find video elements
      const videos = document.querySelectorAll('video[src], video source[src]');
      videos.forEach(video => {
        const src = video.src || video.getAttribute('src');
        if (src && src.startsWith('http')) {
          sendMediaToBackground(src, 'video', 'dom');
        }
      });
      
      // Find audio elements
      const audios = document.querySelectorAll('audio[src], audio source[src]');
      audios.forEach(audio => {
        const src = audio.src || audio.getAttribute('src');
        if (src && src.startsWith('http')) {
          sendMediaToBackground(src, 'audio', 'dom');
        }
      });
      
      // Find image elements (only large ones to avoid noise)
      const images = document.querySelectorAll('img[src]');
      images.forEach(img => {
        const src = img.src;
        if (src && src.startsWith('http') && 
            (img.naturalWidth > 200 || img.naturalHeight > 200)) {
          sendMediaToBackground(src, 'image', 'dom');
        }
      });
      
    } catch (e) {
      if (debugMode) {
        console.log('PegaTudo: DOM scan error:', e);
      }
    }
  };
  
  // Run initial scan after a delay
  setTimeout(scanForMedia, 2000);
  
  // Setup mutation observer for dynamic content
  if (window.MutationObserver) {
    const observer = new MutationObserver(() => {
      // Debounced scan
      clearTimeout(observer.scanTimeout);
      observer.scanTimeout = setTimeout(scanForMedia, 1000);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }
}

function sendMediaToBackground(url, type, source) {
  chrome.runtime.sendMessage({
    action: 'mediaDiscovered',
    media: {
      url,
      type,
      fileType: getFileType(url),
      timestamp: Date.now(),
      source
    }
  }).catch(() => {
    // Silent error handling
  });
}

// Load extension settings and initialize
chrome.storage.sync.get(['extensionEnabled', 'debugMode'], (result) => {
  extensionEnabled = result.extensionEnabled !== false;
  debugMode = result.debugMode === true;
  
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
});

// Listen for settings changes
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleExtension') {
    extensionEnabled = message.enabled;
    if (debugMode) {
      console.log('PegaTudo: Extension', extensionEnabled ? 'enabled' : 'disabled');
    }
  }
  if (message.action === 'toggleDebugMode') {
    debugMode = message.enabled;
    console.log('PegaTudo: Debug mode', debugMode ? 'enabled' : 'disabled');
  }
});
