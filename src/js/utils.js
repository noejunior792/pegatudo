// PegaTudo - Enhanced Utilities
// Comprehensive utility functions for the extension

function getFileType(url) {
  try {
    const urlObject = new URL(url);
    const extension = urlObject.pathname.split('.').pop().toLowerCase();
    // Limit extension length to avoid very long strings
    if (extension && extension.length < 8) {
      return extension.split('?')[0]; // Remove query params
    }
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function getFileName(url) {
  try {
    const urlObject = new URL(url);
    const pathname = urlObject.pathname;
    // Decode the filename
    const decodedPathname = decodeURIComponent(pathname);
    return decodedPathname.substring(decodedPathname.lastIndexOf('/') + 1) || `media_${Date.now()}`;
  } catch (e) {
    return `media_${Date.now()}`;
  }
}

// Enhanced filename generation with custom patterns
async function generateCustomFileName(url, type, pattern) {
  try {
    // Get default filename
    const defaultFilename = getFileName(url);
    const fileExtension = getFileType(url);
    const baseName = defaultFilename.replace(new RegExp(`\\.${fileExtension}$`, 'i'), '');
    
    // Create replacement values
    const now = new Date();
    const replacements = {
      '{filename}': baseName,
      '{timestamp}': Date.now().toString(),
      '{date}': now.toISOString().split('T')[0], // YYYY-MM-DD
      '{time}': now.toTimeString().split(' ')[0].replace(/:/g, '-'), // HH-MM-SS
      '{type}': type || 'media',
      '{ext}': fileExtension
    };
    
    // Apply pattern
    let customName = pattern;
    Object.entries(replacements).forEach(([placeholder, value]) => {
      customName = customName.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    
    // Sanitize filename (remove invalid characters)
    customName = customName.replace(/[<>:"\/\\|?*]/g, '_');
    
    // Add extension if not present
    if (!customName.includes('.') && fileExtension !== 'unknown') {
      customName += `.${fileExtension}`;
    }
    
    return customName;
  } catch (e) {
    console.error('PegaTudo: Error generating custom filename:', e);
    return getFileName(url);
  }
}

// Convert data URLs to Blob
async function dataURLToBlob(dataURL) {
  try {
    const response = await fetch(dataURL);
    return await response.blob();
  } catch (e) {
    console.error('PegaTudo: Error converting data URL to blob:', e);
    return null;
  }
}

// Enhanced URL validation
function isValidMediaURL(url) {
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:', 'blob:', 'data:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // Check for obvious media patterns
    const mediaExtensions = /\.(mp4|webm|avi|mov|mp3|wav|ogg|jpg|jpeg|png|gif|webp|svg|m3u8|mpd)(\?|$)/i;
    const mediaTypes = /\/(video|audio|image)\//;
    
    return mediaExtensions.test(url) || mediaTypes.test(url) || url.includes('blob:');
  } catch (e) {
    return false;
  }
}

// URL deduplication utility
function deduplicateURLs(urls) {
  const seen = new Set();
  return urls.filter(url => {
    // Normalize URL by removing common tracking parameters
    const normalized = normalizeURL(url);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

// URL normalization (remove tracking params, etc.)
function normalizeURL(url) {
  try {
    const urlObj = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'ref', 'source', '_t', 'hl'
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    return urlObj.toString();
  } catch (e) {
    return url;
  }
}

// Format file size for display
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  if (i === 0) return bytes + ' ' + sizes[i];
  
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

// Detect media type from URL or MIME type
function detectMediaType(url, mimeType) {
  // Check MIME type first
  if (mimeType) {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('m3u8') || mimeType.includes('mpegurl')) return 'hls';
    if (mimeType.includes('dash') || mimeType.includes('mpd')) return 'dash';
  }
  
  // Check URL patterns
  if (url) {
    if (url.includes('.m3u8')) return 'hls';
    if (url.includes('.mpd')) return 'dash';
    if (/\.(mp4|webm|avi|mov|mkv|flv)(\?|$)/i.test(url)) return 'video';
    if (/\.(mp3|wav|ogg|aac|flac|m4a)(\?|$)/i.test(url)) return 'audio';
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(\?|$)/i.test(url)) return 'image';
    if (url.startsWith('blob:')) return 'blob';
  }
  
  return 'unknown';
}

// Debounce function for performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for performance
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Safe JSON parsing
function safeJSONParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

// Generate unique ID for media items
function generateUniqueId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Check if URL is from a supported streaming platform
function isSupportedPlatform(url) {
  const supportedDomains = [
    'youtube.com', 'youtu.be',
    'facebook.com', 'fb.watch',
    'instagram.com',
    'twitter.com', 'x.com',
    'tiktok.com',
    'twitch.tv',
    'vimeo.com',
    'dailymotion.com'
  ];
  
  try {
    const urlObj = new URL(url);
    return supportedDomains.some(domain => 
      urlObj.hostname.includes(domain)
    );
  } catch (e) {
    return false;
  }
}

// Extract domain from URL for display
function getDomainFromURL(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return 'Unknown';
  }
}

// Enhanced error logging with context
function logError(context, error, additionalData = {}) {
  console.error(`PegaTudo [${context}]:`, error, additionalData);
  
  // Store error for debugging (optional)
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['errorLog'], (result) => {
      const errorLog = result.errorLog || [];
      errorLog.push({
        context,
        error: error.message || error.toString(),
        timestamp: Date.now(),
        additionalData
      });
      
      // Keep only last 50 errors
      if (errorLog.length > 50) {
        errorLog.splice(0, errorLog.length - 50);
      }
      
      chrome.storage.local.set({ errorLog });
    });
  }
}

// Performance timing utility
function createTimer(label) {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      console.debug(`PegaTudo Timer [${label}]: ${duration.toFixed(2)}ms`);
      return duration;
    }
  };
}
