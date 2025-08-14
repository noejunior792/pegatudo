/**
 * Advanced Detection Engine for PegaTudo
 * Coordinates all extractors and detection methods for comprehensive
 * media discovery across all supported platforms
 */

import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';
import { networkManager } from '../network/network-manager.js';
import { streamingEngine } from '../streaming/streaming-engine.js';
import { youtubeExtractor } from '../extractors/youtube-extractor.js';
import { tiktokExtractor } from '../extractors/tiktok-extractor.js';
import { instagramExtractor } from '../extractors/instagram-extractor.js';
import { twitterExtractor } from '../extractors/twitter-extractor.js';
import { 
  MediaType,
  Platform,
  DetectionMethod,
  createDetectionResult,
  createMediaSource
} from '../core/types.js';

export class AdvancedDetectionEngine {
  constructor(options = {}) {
    this.config = {
      enableDOMScan: options.enableDOMScan !== false,
      enableNetworkIntercept: options.enableNetworkIntercept !== false,
      enablePatternMatch: options.enablePatternMatch !== false,
      enableAPIExtraction: options.enableAPIExtraction !== false,
      enableStreamingDetection: options.enableStreamingDetection !== false,
      enableShadowDOMScan: options.enableShadowDOMScan !== false,
      enableServiceWorkerDetection: options.enableServiceWorkerDetection || false,
      enableWebSocketDetection: options.enableWebSocketDetection || false,
      scanInterval: options.scanInterval || 2000,
      maxConcurrentDetections: options.maxConcurrentDetections || 5,
      enableCaching: options.enableCaching !== false,
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      enableIntelligentFiltering: options.enableIntelligentFiltering !== false,
      minMediaSize: options.minMediaSize || 1024, // 1KB minimum
      maxMediaSize: options.maxMediaSize || 5 * 1024 * 1024 * 1024, // 5GB maximum
      ...options
    };

    // Register extractors
    this.extractors = new Map([
      ['youtube', youtubeExtractor],
      ['tiktok', tiktokExtractor],
      ['instagram', instagramExtractor],
      ['twitter', twitterExtractor]
    ]);

    // Detection methods
    this.detectionMethods = new Map([
      [DetectionMethod.DOM_SCAN, this.scanDOM.bind(this)],
      [DetectionMethod.NETWORK_INTERCEPT, this.interceptNetwork.bind(this)],
      [DetectionMethod.PATTERN_MATCH, this.matchPatterns.bind(this)],
      [DetectionMethod.API_EXTRACTION, this.extractFromAPI.bind(this)],
      [DetectionMethod.SHADOW_DOM, this.scanShadowDOM.bind(this)],
      [DetectionMethod.WEBSOCKET, this.detectWebSocket.bind(this)],
      [DetectionMethod.MANIFEST_PARSE, this.parseManifests.bind(this)],
      [DetectionMethod.SOURCE_BUFFER, this.detectSourceBuffer.bind(this)],
      [DetectionMethod.MEDIA_CAPTURE, this.detectMediaCapture.bind(this)],
      [DetectionMethod.IFRAME_INTERCEPT, this.interceptIframes.bind(this)],
      [DetectionMethod.SERVICE_WORKER, this.detectServiceWorker.bind(this)],
      [DetectionMethod.WORKER_THREAD, this.detectWorkerThread.bind(this)]
    ]);

    // URL patterns for generic detection
    this.patterns = {
      video: [
        /\.(mp4|webm|mkv|avi|mov|wmv|flv|ogv|3gp|m4v|ts|m2ts)(\?[^]*)?$/i,
        /\/video\/[^\/]+\.(mp4|webm|mkv)/i,
        /video[^\/]*\.(mp4|webm)/i
      ],
      audio: [
        /\.(mp3|aac|ogg|wav|flac|m4a|wma|opus|aiff)(\?[^]*)?$/i,
        /\/audio\/[^\/]+\.(mp3|aac|ogg)/i,
        /audio[^\/]*\.(mp3|aac)/i
      ],
      image: [
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(\?[^]*)?$/i,
        /\/image\/[^\/]+\.(jpg|jpeg|png)/i,
        /photo[^\/]*\.(jpg|jpeg|png)/i
      ],
      streaming: [
        /\.m3u8(\?[^]*)?$/i,
        /\.mpd(\?[^]*)?$/i,
        /\/hls\/[^\/]+/i,
        /\/dash\/[^\/]+/i,
        /\/stream[^\/]*/i
      ]
    };

    // Content type mappings
    this.contentTypes = {
      video: [
        'video/mp4', 'video/webm', 'video/mkv', 'video/avi', 'video/mov',
        'video/quicktime', 'video/x-msvideo', 'video/x-flv', 'video/ogg',
        'video/3gpp', 'video/mp2t', 'application/vnd.apple.mpegurl'
      ],
      audio: [
        'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/flac',
        'audio/aac', 'audio/webm', 'audio/opus', 'audio/x-wav'
      ],
      image: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'image/bmp', 'image/tiff', 'image/x-icon'
      ]
    };

    this.cache = new Map();
    this.activeDetections = new Set();
    this.detectedMedia = new Map();
    this.networkRequests = new Map();
    this.observers = [];
    this.scanTimer = null;

    this.metrics = {
      totalDetections: 0,
      successfulDetections: 0,
      failedDetections: 0,
      mediaDetected: 0,
      videosDetected: 0,
      audiosDetected: 0,
      imagesDetected: 0,
      streamsDetected: 0,
      apiExtractions: 0,
      domScans: 0,
      networkInterceptions: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.init();
  }

  async init() {
    try {
      // Setup DOM observation
      if (this.config.enableDOMScan) {
        this.setupDOMObserver();
      }

      // Setup network interception
      if (this.config.enableNetworkIntercept) {
        this.setupNetworkInterception();
      }

      // Setup service worker detection
      if (this.config.enableServiceWorkerDetection) {
        this.setupServiceWorkerDetection();
      }

      // Setup WebSocket detection
      if (this.config.enableWebSocketDetection) {
        this.setupWebSocketDetection();
      }

      // Start periodic scanning
      this.startPeriodicScan();

      logger.info('Advanced Detection Engine initialized', {
        extractors: this.extractors.size,
        detectionMethods: this.detectionMethods.size,
        enabledFeatures: Object.keys(this.config).filter(key => this.config[key] === true)
      });

      eventSystem.emit('detection:initialized', { engine: this });
    } catch (error) {
      logger.error('Failed to initialize detection engine', error);
      throw error;
    }
  }

  // Main detection entry point
  async detectMedia(options = {}) {
    try {
      this.metrics.totalDetections++;
      logger.debug('Starting media detection');

      const detectionId = this.generateDetectionId();
      this.activeDetections.add(detectionId);

      // Check cache first
      const url = window.location.href;
      const cacheKey = `${url}_${JSON.stringify(options)}`;
      
      if (this.config.enableCaching) {
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
          this.metrics.cacheHits++;
          this.activeDetections.delete(detectionId);
          return cached.result;
        }
        this.metrics.cacheMisses++;
      }

      // Run all enabled detection methods
      const results = await this.runAllDetectionMethods(options);
      
      // Merge and filter results
      const mergedResult = this.mergeDetectionResults(results);
      const filteredResult = this.filterResults(mergedResult, options);

      // Cache the result
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, {
          result: filteredResult,
          timestamp: Date.now()
        });
      }

      this.metrics.successfulDetections++;
      this.activeDetections.delete(detectionId);

      eventSystem.emit('detection:completed', { 
        detectionId, 
        result: filteredResult,
        url 
      });

      return filteredResult;
    } catch (error) {
      this.metrics.failedDetections++;
      logger.error('Media detection failed', error);
      throw error;
    }
  }

  async runAllDetectionMethods(options = {}) {
    const results = [];
    const enabledMethods = this.getEnabledDetectionMethods();

    // Run detection methods with concurrency control
    const semaphore = new Semaphore(this.config.maxConcurrentDetections);
    
    const promises = enabledMethods.map(async ([method, detector]) => {
      await semaphore.acquire();
      
      try {
        logger.debug(`Running detection method: ${method}`);
        const result = await detector(options);
        
        if (result && result.sources && result.sources.length > 0) {
          results.push({
            method,
            result,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        logger.warn(`Detection method ${method} failed`, error);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results;
  }

  getEnabledDetectionMethods() {
    const enabled = [];
    
    for (const [method, detector] of this.detectionMethods.entries()) {
      switch (method) {
        case DetectionMethod.DOM_SCAN:
          if (this.config.enableDOMScan) enabled.push([method, detector]);
          break;
        case DetectionMethod.NETWORK_INTERCEPT:
          if (this.config.enableNetworkIntercept) enabled.push([method, detector]);
          break;
        case DetectionMethod.PATTERN_MATCH:
          if (this.config.enablePatternMatch) enabled.push([method, detector]);
          break;
        case DetectionMethod.API_EXTRACTION:
          if (this.config.enableAPIExtraction) enabled.push([method, detector]);
          break;
        case DetectionMethod.SHADOW_DOM:
          if (this.config.enableShadowDOMScan) enabled.push([method, detector]);
          break;
        case DetectionMethod.WEBSOCKET:
          if (this.config.enableWebSocketDetection) enabled.push([method, detector]);
          break;
        case DetectionMethod.SERVICE_WORKER:
          if (this.config.enableServiceWorkerDetection) enabled.push([method, detector]);
          break;
        default:
          enabled.push([method, detector]);
      }
    }
    
    return enabled;
  }

  // Detection method implementations
  async scanDOM(options = {}) {
    try {
      this.metrics.domScans++;
      const sources = [];

      // Scan for media elements
      const mediaElements = [
        ...document.querySelectorAll('video'),
        ...document.querySelectorAll('audio'),
        ...document.querySelectorAll('img'),
        ...document.querySelectorAll('source'),
        ...document.querySelectorAll('a[href*=".mp4"], a[href*=".webm"], a[href*=".mp3"]'),
        ...document.querySelectorAll('[src*=".mp4"], [src*=".webm"], [src*=".mp3"]')
      ];

      for (const element of mediaElements) {
        const mediaSource = this.analyzeMediaElement(element);
        if (mediaSource) {
          sources.push(mediaSource);
        }
      }

      // Scan for streaming manifests
      const manifestElements = [
        ...document.querySelectorAll('[src*=".m3u8"], [href*=".m3u8"]'),
        ...document.querySelectorAll('[src*=".mpd"], [href*=".mpd"]'),
        ...document.querySelectorAll('[data-src*=".m3u8"], [data-href*=".m3u8"]')
      ];

      for (const element of manifestElements) {
        const streamSource = await this.analyzeStreamingElement(element);
        if (streamSource) {
          sources.push(streamSource);
        }
      }

      // Scan for blob URLs
      const blobElements = [
        ...document.querySelectorAll('[src^="blob:"]'),
        ...document.querySelectorAll('[href^="blob:"]')
      ];

      for (const element of blobElements) {
        const blobSource = this.analyzeBlobElement(element);
        if (blobSource) {
          sources.push(blobSource);
        }
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('DOM scan failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async interceptNetwork(options = {}) {
    try {
      this.metrics.networkInterceptions++;
      const sources = [];

      // Get network requests from the network manager
      const requests = networkManager.getRequests ? networkManager.getRequests() : [];
      
      for (const request of requests) {
        if (this.isMediaRequest(request)) {
          const mediaSource = this.createMediaSourceFromRequest(request);
          if (mediaSource) {
            sources.push(mediaSource);
          }
        }
      }

      // Check stored network requests
      for (const [url, requestData] of this.networkRequests.entries()) {
        if (this.isMediaUrl(url)) {
          const mediaSource = createMediaSource(url, this.getMediaTypeFromUrl(url));
          mediaSource.metadata = {
            fromNetworkIntercept: true,
            contentType: requestData.contentType,
            size: requestData.size,
            timestamp: requestData.timestamp
          };
          sources.push(mediaSource);
        }
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Network interception failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async matchPatterns(options = {}) {
    try {
      const sources = [];
      const url = window.location.href;

      // Check if current page URL matches any patterns
      for (const [type, patterns] of Object.entries(this.patterns)) {
        for (const pattern of patterns) {
          if (pattern.test(url)) {
            const mediaType = this.getMediaTypeFromString(type);
            const source = createMediaSource(url, mediaType);
            source.metadata = {
              fromPatternMatch: true,
              pattern: pattern.toString(),
              detectedType: type
            };
            sources.push(source);
          }
        }
      }

      // Scan page content for URLs matching patterns
      const pageText = document.documentElement.textContent || document.documentElement.innerText;
      const urls = this.extractUrlsFromText(pageText);

      for (const extractedUrl of urls) {
        if (this.isMediaUrl(extractedUrl)) {
          const mediaType = this.getMediaTypeFromUrl(extractedUrl);
          const source = createMediaSource(extractedUrl, mediaType);
          source.metadata = {
            fromPatternMatch: true,
            extractedFromText: true
          };
          sources.push(source);
        }
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Pattern matching failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async extractFromAPI(options = {}) {
    try {
      this.metrics.apiExtractions++;
      const url = window.location.href;
      
      // Try each extractor
      for (const [name, extractor] of this.extractors.entries()) {
        if (extractor.canExtract(url)) {
          try {
            logger.debug(`Using ${name} extractor for ${url}`);
            const result = await extractor.extract(url, options);
            
            if (result && result.sources && result.sources.length > 0) {
              return result;
            }
          } catch (error) {
            logger.warn(`${name} extractor failed`, error);
          }
        }
      }

      return createDetectionResult([], Platform.GENERIC);
    } catch (error) {
      logger.error('API extraction failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async scanShadowDOM(options = {}) {
    try {
      const sources = [];
      
      // Find all elements with shadow roots
      const elementsWithShadow = this.findElementsWithShadowDOM(document);
      
      for (const element of elementsWithShadow) {
        if (element.shadowRoot) {
          const shadowSources = this.scanElementForMedia(element.shadowRoot);
          sources.push(...shadowSources);
        }
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Shadow DOM scan failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async detectWebSocket(options = {}) {
    try {
      const sources = [];
      
      // This would intercept WebSocket connections that might be streaming media
      // Implementation would require WebSocket monkey-patching
      
      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('WebSocket detection failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async parseManifests(options = {}) {
    try {
      const sources = [];
      
      // Look for streaming manifests and parse them
      const manifestUrls = this.findManifestUrls();
      
      for (const manifestUrl of manifestUrls) {
        try {
          if (manifestUrl.includes('.m3u8')) {
            // HLS manifest
            const hlsResult = await streamingEngine.processHLSStream(manifestUrl);
            if (hlsResult && hlsResult.sources) {
              sources.push(...hlsResult.sources);
            }
          } else if (manifestUrl.includes('.mpd')) {
            // DASH manifest
            const dashResult = await streamingEngine.processDASHStream(manifestUrl);
            if (dashResult && dashResult.sources) {
              sources.push(...dashResult.sources);
            }
          }
        } catch (error) {
          logger.warn(`Failed to parse manifest ${manifestUrl}`, error);
        }
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Manifest parsing failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async detectSourceBuffer(options = {}) {
    try {
      const sources = [];
      
      // Detect Media Source Extensions usage
      if (typeof MediaSource !== 'undefined') {
        // Monitor for SourceBuffer operations
        // This would require monkey-patching MediaSource API
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('SourceBuffer detection failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async detectMediaCapture(options = {}) {
    try {
      const sources = [];
      
      // Detect getUserMedia streams
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // This would require monitoring getUserMedia calls
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Media capture detection failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async interceptIframes(options = {}) {
    try {
      const sources = [];
      const iframes = document.querySelectorAll('iframe');
      
      for (const iframe of iframes) {
        try {
          // Try to access iframe content (may be blocked by CORS)
          if (iframe.contentDocument) {
            const iframeSources = this.scanElementForMedia(iframe.contentDocument);
            sources.push(...iframeSources);
          }
        } catch (error) {
          // CORS blocked - can't access iframe content
          logger.debug('Cannot access iframe content (CORS)', { src: iframe.src });
        }
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Iframe interception failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async detectServiceWorker(options = {}) {
    try {
      const sources = [];
      
      if ('serviceWorker' in navigator) {
        // Monitor service worker registrations and messages
        // This would require service worker interception
      }

      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Service worker detection failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  async detectWorkerThread(options = {}) {
    try {
      const sources = [];
      
      // Monitor Web Worker and SharedWorker usage
      // This would require worker thread interception
      
      return createDetectionResult(sources, Platform.GENERIC);
    } catch (error) {
      logger.error('Worker thread detection failed', error);
      return createDetectionResult([], Platform.GENERIC);
    }
  }

  // Utility methods
  analyzeMediaElement(element) {
    try {
      const src = element.src || element.href || element.dataset.src || element.dataset.href;
      if (!src) return null;

      const mediaType = this.getMediaTypeFromElement(element);
      const source = createMediaSource(src, mediaType);
      
      source.metadata = {
        tagName: element.tagName.toLowerCase(),
        fromDOMScan: true,
        width: element.width || element.videoWidth || element.naturalWidth,
        height: element.height || element.videoHeight || element.naturalHeight,
        duration: element.duration,
        poster: element.poster,
        alt: element.alt,
        title: element.title
      };

      return source;
    } catch (error) {
      logger.warn('Failed to analyze media element', error);
      return null;
    }
  }

  async analyzeStreamingElement(element) {
    try {
      const src = element.src || element.href || element.dataset.src;
      if (!src) return null;

      const source = createMediaSource(src, MediaType.LIVE_STREAM);
      source.format = src.includes('.m3u8') ? 'hls' : 'dash';
      source.metadata = {
        fromStreamingDetection: true,
        tagName: element.tagName.toLowerCase()
      };

      return source;
    } catch (error) {
      logger.warn('Failed to analyze streaming element', error);
      return null;
    }
  }

  analyzeBlobElement(element) {
    try {
      const src = element.src || element.href;
      if (!src || !src.startsWith('blob:')) return null;

      const mediaType = this.getMediaTypeFromElement(element);
      const source = createMediaSource(src, mediaType);
      
      source.metadata = {
        fromBlobDetection: true,
        tagName: element.tagName.toLowerCase()
      };

      return source;
    } catch (error) {
      logger.warn('Failed to analyze blob element', error);
      return null;
    }
  }

  getMediaTypeFromElement(element) {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'video':
        return MediaType.VIDEO;
      case 'audio':
        return MediaType.AUDIO;
      case 'img':
        return MediaType.IMAGE;
      case 'source':
        return element.type?.includes('video') ? MediaType.VIDEO : 
               element.type?.includes('audio') ? MediaType.AUDIO : MediaType.UNKNOWN;
      default:
        return this.getMediaTypeFromUrl(element.src || element.href);
    }
  }

  getMediaTypeFromUrl(url) {
    if (!url) return MediaType.UNKNOWN;
    
    const urlLower = url.toLowerCase();
    
    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(urlLower)) {
          return this.getMediaTypeFromString(type);
        }
      }
    }
    
    return MediaType.UNKNOWN;
  }

  getMediaTypeFromString(typeString) {
    switch (typeString) {
      case 'video':
        return MediaType.VIDEO;
      case 'audio':
        return MediaType.AUDIO;
      case 'image':
        return MediaType.IMAGE;
      case 'streaming':
        return MediaType.LIVE_STREAM;
      default:
        return MediaType.UNKNOWN;
    }
  }

  isMediaRequest(request) {
    if (!request) return false;
    
    // Check content type
    const contentType = request.response?.headers?.['content-type']?.toLowerCase();
    if (contentType) {
      for (const [type, types] of Object.entries(this.contentTypes)) {
        if (types.some(mediaType => contentType.includes(mediaType))) {
          return true;
        }
      }
    }
    
    // Check URL patterns
    return this.isMediaUrl(request.url);
  }

  isMediaUrl(url) {
    if (!url) return false;
    
    for (const patterns of Object.values(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(url)) {
          return true;
        }
      }
    }
    
    return false;
  }

  createMediaSourceFromRequest(request) {
    try {
      const mediaType = this.getMediaTypeFromUrl(request.url);
      const source = createMediaSource(request.url, mediaType);
      
      source.metadata = {
        fromNetworkIntercept: true,
        method: request.method,
        status: request.response?.status,
        contentType: request.response?.headers?.['content-type'],
        contentLength: request.response?.headers?.['content-length'],
        timestamp: request.timestamp
      };

      return source;
    } catch (error) {
      logger.warn('Failed to create media source from request', error);
      return null;
    }
  }

  extractUrlsFromText(text) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const matches = text.match(urlRegex);
    return matches || [];
  }

  findElementsWithShadowDOM(root) {
    const elements = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      elements.push(node);
    }

    return elements;
  }

  scanElementForMedia(root) {
    const sources = [];
    const mediaElements = root.querySelectorAll('video, audio, img, source, [src], [href]');
    
    for (const element of mediaElements) {
      const mediaSource = this.analyzeMediaElement(element);
      if (mediaSource) {
        sources.push(mediaSource);
      }
    }

    return sources;
  }

  findManifestUrls() {
    const urls = [];
    
    // Scan for manifest URLs in various places
    const elements = document.querySelectorAll('[src], [href], [data-src], [data-href]');
    
    for (const element of elements) {
      const url = element.src || element.href || element.dataset.src || element.dataset.href;
      if (url && (url.includes('.m3u8') || url.includes('.mpd'))) {
        urls.push(url);
      }
    }

    // Also check in script tags and inline content
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      const manifestMatches = content.match(/https?:\/\/[^"'\s]+\.(?:m3u8|mpd)(?:\?[^"'\s]*)?/gi);
      if (manifestMatches) {
        urls.push(...manifestMatches);
      }
    }

    return [...new Set(urls)]; // Remove duplicates
  }

  mergeDetectionResults(results) {
    const allSources = [];
    const metadata = {
      detectionMethods: [],
      totalResults: results.length,
      timestamp: Date.now()
    };

    for (const resultData of results) {
      metadata.detectionMethods.push({
        method: resultData.method,
        sourcesFound: resultData.result.sources.length,
        timestamp: resultData.timestamp
      });
      
      allSources.push(...resultData.result.sources);
    }

    // Remove duplicates based on URL
    const uniqueSources = this.removeDuplicateSources(allSources);
    
    const mergedResult = createDetectionResult(uniqueSources, Platform.GENERIC);
    mergedResult.metadata = metadata;
    
    return mergedResult;
  }

  removeDuplicateSources(sources) {
    const seen = new Set();
    const unique = [];

    for (const source of sources) {
      if (!seen.has(source.url)) {
        seen.add(source.url);
        unique.push(source);
      }
    }

    return unique;
  }

  filterResults(result, options = {}) {
    if (!this.config.enableIntelligentFiltering) {
      return result;
    }

    const filtered = result.sources.filter(source => {
      // Size filtering
      if (source.size) {
        if (source.size < this.config.minMediaSize || source.size > this.config.maxMediaSize) {
          return false;
        }
      }

      // Quality filtering
      if (options.minQuality && source.quality) {
        if (source.quality.height && source.quality.height < options.minQuality.height) {
          return false;
        }
      }

      // Format filtering
      if (options.allowedFormats && source.format) {
        if (!options.allowedFormats.includes(source.format)) {
          return false;
        }
      }

      return true;
    });

    result.sources = filtered;
    return result;
  }

  // Setup methods
  setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNewElement(node);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
  }

  processNewElement(element) {
    // Check if the new element contains media
    if (element.matches && element.matches('video, audio, img, source, [src], [href]')) {
      const mediaSource = this.analyzeMediaElement(element);
      if (mediaSource) {
        this.notifyMediaDetected(mediaSource);
      }
    }

    // Check child elements
    const mediaElements = element.querySelectorAll('video, audio, img, source, [src], [href]');
    for (const mediaElement of mediaElements) {
      const mediaSource = this.analyzeMediaElement(mediaElement);
      if (mediaSource) {
        this.notifyMediaDetected(mediaSource);
      }
    }
  }

  setupNetworkInterception() {
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);
      
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      this.processNetworkRequest(url, response);
      
      return response;
    };

    // Intercept XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.addEventListener('load', () => {
        if (this.status >= 200 && this.status < 300) {
          // Process successful requests
          const contentType = this.getResponseHeader('content-type');
          if (contentType) {
            networkManager.networkRequests?.set(url, {
              contentType,
              size: this.getResponseHeader('content-length'),
              timestamp: Date.now()
            });
          }
        }
      });
      
      return originalXhrOpen.apply(this, arguments);
    };
  }

  processNetworkRequest(url, response) {
    if (this.isMediaUrl(url)) {
      const contentType = response.headers?.get('content-type');
      const contentLength = response.headers?.get('content-length');
      
      this.networkRequests.set(url, {
        contentType,
        size: contentLength ? parseInt(contentLength, 10) : null,
        timestamp: Date.now()
      });

      // Notify about detected media
      const mediaSource = createMediaSource(url, this.getMediaTypeFromUrl(url));
      mediaSource.metadata = {
        fromNetworkIntercept: true,
        contentType,
        size: contentLength
      };
      
      this.notifyMediaDetected(mediaSource);
    }
  }

  setupServiceWorkerDetection() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        // Handle service worker messages that might contain media URLs
        this.processServiceWorkerMessage(event.data);
      });
    }
  }

  setupWebSocketDetection() {
    // Monitor WebSocket connections for streaming media
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      const ws = new originalWebSocket(...args);
      
      ws.addEventListener('message', (event) => {
        // Process WebSocket messages for media content
        this.processWebSocketMessage(event.data);
      });
      
      return ws;
    };
  }

  processServiceWorkerMessage(data) {
    // Process service worker messages
    if (data && data.type === 'media-detected') {
      this.notifyMediaDetected(data.source);
    }
  }

  processWebSocketMessage(data) {
    // Process WebSocket messages for media content
    // This would depend on the specific streaming protocol
  }

  notifyMediaDetected(mediaSource) {
    this.metrics.mediaDetected++;
    
    // Update type-specific metrics
    switch (mediaSource.type) {
      case MediaType.VIDEO:
        this.metrics.videosDetected++;
        break;
      case MediaType.AUDIO:
        this.metrics.audiosDetected++;
        break;
      case MediaType.IMAGE:
        this.metrics.imagesDetected++;
        break;
      case MediaType.LIVE_STREAM:
        this.metrics.streamsDetected++;
        break;
    }

    eventSystem.emit('detection:mediaDetected', { source: mediaSource });
  }

  startPeriodicScan() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    this.scanTimer = setInterval(async () => {
      try {
        await this.detectMedia({ periodic: true });
      } catch (error) {
        logger.warn('Periodic scan failed', error);
      }
    }, this.config.scanInterval);
  }

  generateDetectionId() {
    return `detection_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  // Public API
  getDetectedMedia() {
    return Array.from(this.detectedMedia.values());
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      activeDetections: this.activeDetections.size,
      networkRequests: this.networkRequests.size,
      extractorsRegistered: this.extractors.size,
      detectionMethodsEnabled: this.getEnabledDetectionMethods().length
    };
  }

  clearCache() {
    this.cache.clear();
    this.detectedMedia.clear();
    this.networkRequests.clear();
    logger.info('Detection engine cache cleared');
  }

  destroy() {
    // Clear timers
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    // Disconnect observers
    for (const observer of this.observers) {
      observer.disconnect();
    }

    // Clear caches
    this.clearCache();

    logger.info('Detection engine destroyed');
  }
}

// Semaphore utility for controlling concurrency
class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentConcurrency = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.currentConcurrency < this.maxConcurrency) {
        this.currentConcurrency++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.currentConcurrency--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.currentConcurrency++;
      next();
    }
  }
}

// Export default instance
export const detectionEngine = new AdvancedDetectionEngine();

export default AdvancedDetectionEngine;