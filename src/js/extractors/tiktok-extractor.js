/**
 * Advanced TikTok Extractor for PegaTudo
 * Comprehensive TikTok video extraction with watermark removal,
 * high-quality format selection, and anti-detection measures
 */

import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';
import { networkManager } from '../network/network-manager.js';
import { 
  MediaType,
  Platform,
  DetectionMethod,
  createMediaSource,
  createDetectionResult
} from '../core/types.js';

export class AdvancedTikTokExtractor {
  constructor(options = {}) {
    this.id = 'tiktok';
    this.name = 'TikTok Extractor';
    this.platforms = [Platform.TIKTOK];
    this.priority = 90;

    this.config = {
      enableWatermarkRemoval: options.enableWatermarkRemoval !== false,
      enableHDDownload: options.enableHDDownload !== false,
      enableAudioExtraction: options.enableAudioExtraction !== false,
      enableSlideshow: options.enableSlideshow !== false,
      enableUserVideos: options.enableUserVideos || false,
      bypassRegionRestriction: options.bypassRegionRestriction || false,
      preferredQuality: options.preferredQuality || 'highest',
      useAlternativeAPIs: options.useAlternativeAPIs !== false,
      antiDetection: options.antiDetection !== false,
      ...options
    };

    // TikTok URL patterns
    this.patterns = {
      video: /(?:https?:\/\/)?(?:www\.|m\.|vm\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      shortUrl: /(?:https?:\/\/)?(?:vm\.tiktok\.com|vt\.tiktok\.com)\/([A-Za-z0-9]+)/,
      mobileUrl: /(?:https?:\/\/)?m\.tiktok\.com\/v\/(\d+)/,
      shareUrl: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]+)/,
      userProfile: /(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/@([\w.-]+)/,
      hashtag: /(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/tag\/([^?]+)/,
      challenge: /(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/challenge\/([^?]+)/
    };

    // TikTok API endpoints and configurations
    this.endpoints = {
      webApi: 'https://www.tiktok.com/api/',
      mobileApi: 'https://m.tiktok.com/api/',
      shareApi: 'https://api.tiktok.com/share/',
      cdnBase: 'https://v16-webapp.tiktok.com/',
      alternativeApi: 'https://api16-normal-c-useast1a.tiktokv.com/',
      musicallyApi: 'https://api.musical.ly/',
      bytedanceApi: 'https://api.bytedance.com/'
    };

    // User agents for different device types
    this.userAgents = {
      desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
      bot: 'TikTok 26.2.0 rv:262018 (iPhone; iOS 17.0; en_US) Cronet'
    };

    // Quality preferences mapping
    this.qualityMap = new Map([
      ['highest', ['play_addr_h264', 'play_addr', 'download_addr']],
      ['high', ['play_addr', 'play_addr_h264', 'download_addr']],
      ['medium', ['download_addr', 'play_addr', 'play_addr_h264']],
      ['watermark_free', ['play_addr_h264', 'play_addr']],
      ['original', ['origin_cover', 'play_addr_h264', 'play_addr']]
    ]);

    // Device signatures for API requests
    this.deviceSignatures = {
      iphone: {
        device_type: 'iphone',
        device_brand: 'Apple',
        device_id: this.generateDeviceId(),
        os_version: '17.0',
        app_version: '26.2.0',
        app_name: 'tiktok_web'
      },
      android: {
        device_type: 'android',
        device_brand: 'Samsung',
        device_id: this.generateDeviceId(),
        os_version: '13',
        app_version: '26.2.0',
        app_name: 'tiktok_web'
      }
    };

    this.cache = new Map();
    this.sessionCache = new Map();
    this.cdnCache = new Map();

    this.metrics = {
      extractionsPerformed: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      watermarkFreeExtracted: 0,
      hdExtractions: 0,
      slideshowsExtracted: 0,
      apiCallsMade: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.init();
  }

  init() {
    logger.info('Advanced TikTok Extractor initialized', {
      platforms: this.platforms,
      watermarkRemoval: this.config.enableWatermarkRemoval,
      hdDownload: this.config.enableHDDownload
    });
  }

  canExtract(url) {
    return Object.values(this.patterns).some(pattern => pattern.test(url));
  }

  async extract(url, options = {}) {
    try {
      this.metrics.extractionsPerformed++;
      logger.info(`Extracting TikTok video: ${url}`);

      // Normalize URL first
      const normalizedUrl = await this.normalizeUrl(url);
      const videoId = this.extractVideoId(normalizedUrl);
      
      if (!videoId) {
        throw new Error('Could not extract video ID from TikTok URL');
      }

      // Check cache
      const cacheKey = `${videoId}_${JSON.stringify(options)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minute cache
        this.metrics.cacheHits++;
        return cached.result;
      }
      
      this.metrics.cacheMisses++;

      // Extract video information using multiple methods
      const videoInfo = await this.getVideoInfo(videoId, normalizedUrl, options);
      
      // Convert to detection result
      const result = await this.convertToDetectionResult(videoInfo, url, options);
      
      // Cache the result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      this.metrics.successfulExtractions++;
      eventSystem.emit('tiktok:extractionCompleted', { videoId, url, result });
      
      return result;
    } catch (error) {
      this.metrics.failedExtractions++;
      logger.error(`TikTok extraction failed for ${url}`, error);
      throw error;
    }
  }

  async normalizeUrl(url) {
    // Handle short URLs and redirects
    if (this.patterns.shortUrl.test(url) || this.patterns.shareUrl.test(url)) {
      try {
        const response = await networkManager.head(url, {
          maxRedirects: 5,
          timeout: 10000
        });
        return response.url;
      } catch (error) {
        logger.warn('Failed to resolve TikTok short URL', error);
        return url;
      }
    }
    
    return url;
  }

  extractVideoId(url) {
    // Try different patterns to extract video ID
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const match = url.match(pattern);
      if (match) {
        if (type === 'video' || type === 'mobileUrl') {
          return match[1];
        }
        // For other patterns, we might need additional processing
      }
    }
    return null;
  }

  async getVideoInfo(videoId, url, options = {}) {
    const methods = [
      'getVideoInfoFromWeb',
      'getVideoInfoFromMobile', 
      'getVideoInfoFromAPI',
      'getVideoInfoFromAlternative'
    ];

    let lastError = null;

    for (const method of methods) {
      try {
        logger.debug(`Trying TikTok extraction method: ${method} for video ${videoId}`);
        const videoInfo = await this[method](videoId, url, options);
        
        if (videoInfo && videoInfo.videoUrls && videoInfo.videoUrls.length > 0) {
          videoInfo.extractionMethod = method;
          return videoInfo;
        }
      } catch (error) {
        logger.warn(`TikTok method ${method} failed for video ${videoId}`, error);
        lastError = error;
      }
    }

    throw lastError || new Error('All TikTok extraction methods failed');
  }

  async getVideoInfoFromWeb(videoId, url, options = {}) {
    const response = await networkManager.get(url, {
      headers: {
        'User-Agent': this.userAgents.desktop,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.tiktok.com/',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseWebPageData(html, videoId);
  }

  parseWebPageData(html, videoId) {
    const videoInfo = {
      videoId,
      title: '',
      description: '',
      author: '',
      authorId: '',
      duration: 0,
      viewCount: 0,
      likeCount: 0,
      shareCount: 0,
      commentCount: 0,
      createTime: null,
      isSlideshow: false,
      musicInfo: {},
      videoUrls: [],
      audioUrls: [],
      covers: [],
      hashtags: [],
      mentions: []
    };

    try {
      // Extract initial data from SIGI_STATE
      const sigiMatch = html.match(/window\['SIGI_STATE'\]\s*=\s*({.+?});/);
      if (sigiMatch) {
        const sigiData = JSON.parse(sigiMatch[1]);
        return this.parseSigiData(sigiData, videoId, videoInfo);
      }

      // Fallback to __DEFAULT_SCOPE__ data
      const defaultScopeMatch = html.match(/window\['__DEFAULT_SCOPE__'\]\s*=\s*({.+?});/);
      if (defaultScopeMatch) {
        const defaultData = JSON.parse(defaultScopeMatch[1]);
        return this.parseDefaultScopeData(defaultData, videoId, videoInfo);
      }

      // Last resort: regex extraction from HTML
      return this.parseHtmlRegex(html, videoId, videoInfo);
    } catch (error) {
      logger.error('Failed to parse TikTok web page data', error);
      throw error;
    }
  }

  parseSigiData(sigiData, videoId, videoInfo) {
    // Find video item in SIGI data
    const itemModule = sigiData.ItemModule;
    if (!itemModule) {
      throw new Error('No ItemModule found in SIGI data');
    }

    const videoItem = itemModule[videoId];
    if (!videoItem) {
      throw new Error(`Video ${videoId} not found in ItemModule`);
    }

    // Extract basic information
    videoInfo.title = videoItem.desc || '';
    videoInfo.author = videoItem.author?.uniqueId || '';
    videoInfo.authorId = videoItem.author?.id || '';
    videoInfo.duration = videoItem.video?.duration || 0;
    videoInfo.createTime = videoItem.createTime ? new Date(videoItem.createTime * 1000) : null;
    
    // Extract statistics
    const stats = videoItem.stats || {};
    videoInfo.viewCount = stats.playCount || 0;
    videoInfo.likeCount = stats.diggCount || 0;
    videoInfo.shareCount = stats.shareCount || 0;
    videoInfo.commentCount = stats.commentCount || 0;

    // Extract video URLs
    const video = videoItem.video || {};
    this.extractVideoUrls(video, videoInfo);

    // Extract music information
    if (videoItem.music) {
      videoInfo.musicInfo = {
        id: videoItem.music.id,
        title: videoItem.music.title,
        author: videoItem.music.authorName,
        original: videoItem.music.original,
        duration: videoItem.music.duration,
        playUrl: videoItem.music.playUrl
      };
      
      if (videoItem.music.playUrl) {
        videoInfo.audioUrls.push({
          url: videoItem.music.playUrl,
          quality: 'original',
          format: 'mp3'
        });
      }
    }

    // Extract covers/thumbnails
    this.extractCovers(video, videoInfo);

    // Check if it's a slideshow
    videoInfo.isSlideshow = videoItem.imagePost?.images?.length > 0;
    if (videoInfo.isSlideshow) {
      this.metrics.slideshowsExtracted++;
      videoInfo.images = videoItem.imagePost.images.map(img => ({
        url: img.imageURL?.urlList?.[0] || img.imageURL,
        width: img.imageWidth,
        height: img.imageHeight
      }));
    }

    // Extract hashtags and mentions
    this.extractHashtagsAndMentions(videoInfo.title, videoInfo);

    return videoInfo;
  }

  extractVideoUrls(video, videoInfo) {
    const qualities = this.qualityMap.get(this.config.preferredQuality) || 
                     this.qualityMap.get('highest');

    for (const quality of qualities) {
      const videoData = video[quality];
      if (videoData) {
        const urls = Array.isArray(videoData.urlList) ? videoData.urlList : [videoData];
        
        for (const url of urls) {
          if (url && typeof url === 'string') {
            videoInfo.videoUrls.push({
              url: url,
              quality: quality,
              width: video.width,
              height: video.height,
              bitrate: video.bitrate,
              format: this.getFormatFromUrl(url),
              hasWatermark: quality === 'download_addr'
            });
          }
        }
      }
    }

    // If watermark removal is enabled, prioritize watermark-free URLs
    if (this.config.enableWatermarkRemoval) {
      videoInfo.videoUrls = videoInfo.videoUrls.filter(item => !item.hasWatermark);
      if (videoInfo.videoUrls.length > 0) {
        this.metrics.watermarkFreeExtracted++;
      }
    }

    // Check for HD quality
    const hasHD = videoInfo.videoUrls.some(item => 
      (item.width && item.width >= 1280) || item.quality.includes('h264')
    );
    if (hasHD) {
      this.metrics.hdExtractions++;
    }
  }

  extractCovers(video, videoInfo) {
    const coverSources = ['cover', 'dynamicCover', 'originCover'];
    
    for (const source of coverSources) {
      const coverData = video[source];
      if (coverData) {
        const urls = Array.isArray(coverData.urlList) ? coverData.urlList : [coverData];
        
        for (const url of urls) {
          if (url && typeof url === 'string') {
            videoInfo.covers.push({
              url: url,
              type: source,
              width: coverData.width,
              height: coverData.height
            });
          }
        }
      }
    }
  }

  extractHashtagsAndMentions(text, videoInfo) {
    if (!text) return;

    // Extract hashtags
    const hashtagMatches = text.match(/#[\w\u4e00-\u9fff]+/g);
    if (hashtagMatches) {
      videoInfo.hashtags = hashtagMatches.map(tag => tag.substring(1));
    }

    // Extract mentions
    const mentionMatches = text.match(/@[\w.]+/g);
    if (mentionMatches) {
      videoInfo.mentions = mentionMatches.map(mention => mention.substring(1));
    }
  }

  parseDefaultScopeData(defaultData, videoId, videoInfo) {
    // Similar parsing logic for DEFAULT_SCOPE data structure
    // This is a fallback method when SIGI_STATE is not available
    
    try {
      const webapp = defaultData['webapp.video-detail'];
      if (webapp && webapp.itemInfo && webapp.itemInfo.itemStruct) {
        const item = webapp.itemInfo.itemStruct;
        return this.parseSigiData({ ItemModule: { [videoId]: item } }, videoId, videoInfo);
      }
    } catch (error) {
      logger.warn('Failed to parse DEFAULT_SCOPE data', error);
    }

    return videoInfo;
  }

  parseHtmlRegex(html, videoId, videoInfo) {
    // Last resort: extract data using regex patterns
    try {
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        videoInfo.title = titleMatch[1].replace(/\s*\|\s*TikTok$/, '');
      }

      // Extract basic video info from meta tags
      const metaPatterns = {
        description: /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
        author: /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i,
        duration: /<meta[^>]*property=["']video:duration["'][^>]*content=["']([^"']+)["']/i
      };

      for (const [key, pattern] of Object.entries(metaPatterns)) {
        const match = html.match(pattern);
        if (match) {
          videoInfo[key] = match[1];
        }
      }

      // Extract video URLs from various script tags
      const videoUrlPatterns = [
        /["']playAddr["']:\s*["']([^"']+)["']/g,
        /["']downloadAddr["']:\s*["']([^"']+)["']/g,
        /["']play_addr_h264["']:\s*["']([^"']+)["']/g
      ];

      for (const pattern of videoUrlPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1] && !videoInfo.videoUrls.some(v => v.url === match[1])) {
            videoInfo.videoUrls.push({
              url: match[1],
              quality: 'unknown',
              format: this.getFormatFromUrl(match[1]),
              hasWatermark: false
            });
          }
        }
      }

      return videoInfo;
    } catch (error) {
      logger.error('Failed to parse TikTok HTML with regex', error);
      throw error;
    }
  }

  async getVideoInfoFromMobile(videoId, url, options = {}) {
    // Mobile version often has different data structure
    const mobileUrl = url.replace('www.tiktok.com', 'm.tiktok.com');
    
    const response = await networkManager.get(mobileUrl, {
      headers: {
        'User-Agent': this.userAgents.mobile,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://m.tiktok.com/'
      }
    });

    if (!response.ok) {
      throw new Error(`Mobile request failed: ${response.status}`);
    }

    const html = await response.text();
    return this.parseWebPageData(html, videoId);
  }

  async getVideoInfoFromAPI(videoId, url, options = {}) {
    // Direct API approach (may require additional authentication)
    const apiUrl = `${this.endpoints.webApi}item/detail/?itemId=${videoId}`;
    
    const response = await networkManager.get(apiUrl, {
      headers: {
        'User-Agent': this.userAgents.bot,
        'Accept': 'application/json',
        'Referer': url,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    this.metrics.apiCallsMade++;
    
    return this.parseApiResponse(data, videoId);
  }

  parseApiResponse(data, videoId) {
    // Parse direct API response
    const videoInfo = {
      videoId,
      videoUrls: [],
      audioUrls: [],
      covers: []
    };

    if (data.itemInfo && data.itemInfo.itemStruct) {
      const item = data.itemInfo.itemStruct;
      return this.parseSigiData({ ItemModule: { [videoId]: item } }, videoId, videoInfo);
    }

    return videoInfo;
  }

  async getVideoInfoFromAlternative(videoId, url, options = {}) {
    // Use alternative/backup APIs
    if (!this.config.useAlternativeAPIs) {
      throw new Error('Alternative APIs disabled');
    }

    // This would implement backup extraction methods
    // Could include third-party services or different API endpoints
    throw new Error('Alternative extraction methods not implemented');
  }

  async convertToDetectionResult(videoInfo, originalUrl, options = {}) {
    const sources = [];

    // Process video URLs
    for (const videoData of videoInfo.videoUrls) {
      const source = createMediaSource(videoData.url, MediaType.VIDEO);
      source.format = videoData.format;
      source.title = this.generateVideoTitle(videoInfo, videoData);
      
      if (videoData.width && videoData.height) {
        source.quality = {
          width: videoData.width,
          height: videoData.height,
          bitrate: videoData.bitrate,
          hasWatermark: videoData.hasWatermark
        };
      }

      source.metadata = {
        videoId: videoInfo.videoId,
        title: videoInfo.title,
        author: videoInfo.author,
        duration: videoInfo.duration,
        quality: videoData.quality,
        hasWatermark: videoData.hasWatermark,
        isSlideshow: videoInfo.isSlideshow
      };

      sources.push(source);
    }

    // Process audio URLs if audio extraction is enabled
    if (this.config.enableAudioExtraction && videoInfo.audioUrls.length > 0) {
      for (const audioData of videoInfo.audioUrls) {
        const source = createMediaSource(audioData.url, MediaType.AUDIO);
        source.format = audioData.format;
        source.title = `${videoInfo.title} (Audio Only)`;
        
        source.metadata = {
          videoId: videoInfo.videoId,
          title: videoInfo.title,
          author: videoInfo.author,
          musicInfo: videoInfo.musicInfo
        };

        sources.push(source);
      }
    }

    // Process slideshow images if enabled
    if (this.config.enableSlideshow && videoInfo.isSlideshow && videoInfo.images) {
      for (let i = 0; i < videoInfo.images.length; i++) {
        const image = videoInfo.images[i];
        const source = createMediaSource(image.url, MediaType.IMAGE);
        source.format = 'jpg';
        source.title = `${videoInfo.title} (Image ${i + 1})`;
        
        if (image.width && image.height) {
          source.quality = {
            width: image.width,
            height: image.height
          };
        }

        source.metadata = {
          videoId: videoInfo.videoId,
          title: videoInfo.title,
          author: videoInfo.author,
          imageIndex: i + 1,
          totalImages: videoInfo.images.length
        };

        sources.push(source);
      }
    }

    const result = createDetectionResult(sources, Platform.TIKTOK);
    result.detectionMethod = DetectionMethod.API_EXTRACTION;
    result.confidence = 0.9;

    // Add comprehensive metadata
    result.metadata = {
      videoId: videoInfo.videoId,
      title: videoInfo.title,
      description: videoInfo.description,
      author: videoInfo.author,
      authorId: videoInfo.authorId,
      duration: videoInfo.duration,
      viewCount: videoInfo.viewCount,
      likeCount: videoInfo.likeCount,
      shareCount: videoInfo.shareCount,
      commentCount: videoInfo.commentCount,
      createTime: videoInfo.createTime,
      isSlideshow: videoInfo.isSlideshow,
      musicInfo: videoInfo.musicInfo,
      hashtags: videoInfo.hashtags,
      mentions: videoInfo.mentions,
      covers: videoInfo.covers,
      extractionMethod: videoInfo.extractionMethod
    };

    return result;
  }

  generateVideoTitle(videoInfo, videoData) {
    let title = videoInfo.title || 'TikTok Video';
    
    if (videoData.quality && videoData.quality !== 'unknown') {
      title += ` (${videoData.quality})`;
    }
    
    if (videoData.width && videoData.height) {
      title += ` [${videoData.width}x${videoData.height}]`;
    }
    
    if (!videoData.hasWatermark) {
      title += ' [No Watermark]';
    }
    
    return title;
  }

  getFormatFromUrl(url) {
    if (!url) return 'mp4';
    
    if (url.includes('.webm')) return 'webm';
    if (url.includes('.mov')) return 'mov';
    if (url.includes('.mp3')) return 'mp3';
    if (url.includes('.m4a')) return 'm4a';
    
    return 'mp4'; // Default format for TikTok
  }

  generateDeviceId() {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  // User profile extraction (if enabled)
  async extractUserVideos(username, options = {}) {
    if (!this.config.enableUserVideos) {
      throw new Error('User video extraction is disabled');
    }

    // Implementation would extract all videos from a user's profile
    // This is a complex process that would require pagination handling
    throw new Error('User video extraction not yet implemented');
  }

  // Cache management
  clearCache() {
    this.cache.clear();
    this.sessionCache.clear();
    this.cdnCache.clear();
    logger.info('TikTok extractor cache cleared');
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      sessionCacheSize: this.sessionCache.size,
      cdnCacheSize: this.cdnCache.size,
      supportedPatterns: Object.keys(this.patterns).length,
      qualityMappings: this.qualityMap.size
    };
  }

  destroy() {
    this.clearCache();
    logger.info('TikTok extractor destroyed');
  }
}

// Export default instance
export const tiktokExtractor = new AdvancedTikTokExtractor();

export default AdvancedTikTokExtractor;