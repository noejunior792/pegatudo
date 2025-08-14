/**
 * Advanced YouTube Extractor for PegaTudo
 * Comprehensive YouTube video extraction with support for all formats,
 * live streams, shorts, and advanced features
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

export class AdvancedYouTubeExtractor {
  constructor(options = {}) {
    this.id = 'youtube';
    this.name = 'YouTube Extractor';
    this.platforms = [Platform.YOUTUBE];
    this.priority = 100;

    this.config = {
      enableLiveStreams: options.enableLiveStreams !== false,
      enableShorts: options.enableShorts !== false,
      enablePlaylistExtraction: options.enablePlaylistExtraction !== false,
      enableSubtitles: options.enableSubtitles !== false,
      enableThumbnails: options.enableThumbnails !== false,
      enableChapters: options.enableChapters !== false,
      extractAudioOnly: options.extractAudioOnly || false,
      extractVideoOnly: options.extractVideoOnly || false,
      maxQuality: options.maxQuality || '4K',
      preferredFormat: options.preferredFormat || 'mp4',
      bypassAgeRestriction: options.bypassAgeRestriction || false,
      ...options
    };

    // YouTube API patterns and endpoints
    this.patterns = {
      videoId: /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
      shortsId: /youtube\.com\/shorts\/([^"&?\/\s]{11})/,
      playlistId: /[?&]list=([^&]+)/,
      timestampId: /[?&]t=([^&]+)/
    };

    this.endpoints = {
      playerApi: 'https://www.youtube.com/youtubei/v1/player',
      nextApi: 'https://www.youtube.com/youtubei/v1/next',
      searchApi: 'https://www.youtube.com/youtubei/v1/search',
      browseApi: 'https://www.youtube.com/youtubei/v1/browse',
      innertubeConfig: 'https://www.youtube.com/s/player/{0}/player_ias.vflset/en_US/base.js'
    };

    // YouTube client configurations
    this.clients = {
      web: {
        clientName: 'WEB',
        clientVersion: '2.20240125.00.00',
        platform: 'DESKTOP'
      },
      android: {
        clientName: 'ANDROID',
        clientVersion: '18.02.37',
        platform: 'MOBILE',
        androidSdkVersion: 30
      },
      ios: {
        clientName: 'IOS',
        clientVersion: '18.02.10',
        platform: 'MOBILE',
        deviceModel: 'iPhone13,2',
        osVersion: '15.6'
      },
      tv: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        platform: 'TV'
      }
    };

    // Format quality mappings
    this.qualityMap = new Map([
      [144, { label: '144p', width: 256, height: 144 }],
      [240, { label: '240p', width: 426, height: 240 }],
      [360, { label: '360p', width: 640, height: 360 }],
      [480, { label: '480p', width: 854, height: 480 }],
      [720, { label: '720p', width: 1280, height: 720 }],
      [1080, { label: '1080p', width: 1920, height: 1080 }],
      [1440, { label: '1440p', width: 2560, height: 1440 }],
      [2160, { label: '4K', width: 3840, height: 2160 }],
      [4320, { label: '8K', width: 7680, height: 4320 }]
    ]);

    // Format ITAGs and their specifications
    this.formatSpecs = new Map([
      // Video + Audio formats
      [18, { container: 'mp4', vcodec: 'avc1', acodec: 'mp4a', quality: 360 }],
      [22, { container: 'mp4', vcodec: 'avc1', acodec: 'mp4a', quality: 720 }],
      [37, { container: 'mp4', vcodec: 'avc1', acodec: 'mp4a', quality: 1080 }],
      [38, { container: 'mp4', vcodec: 'avc1', acodec: 'mp4a', quality: 3072 }],
      
      // Adaptive video-only formats
      [133, { container: 'mp4', vcodec: 'avc1', quality: 240 }],
      [134, { container: 'mp4', vcodec: 'avc1', quality: 360 }],
      [135, { container: 'mp4', vcodec: 'avc1', quality: 480 }],
      [136, { container: 'mp4', vcodec: 'avc1', quality: 720 }],
      [137, { container: 'mp4', vcodec: 'avc1', quality: 1080 }],
      [298, { container: 'mp4', vcodec: 'avc1', quality: 720, fps: 60 }],
      [299, { container: 'mp4', vcodec: 'avc1', quality: 1080, fps: 60 }],
      [264, { container: 'mp4', vcodec: 'avc1', quality: 1440 }],
      [267, { container: 'mp4', vcodec: 'avc1', quality: 1440 }],
      [271, { container: 'mp4', vcodec: 'avc1', quality: 1440 }],
      [313, { container: 'webm', vcodec: 'vp9', quality: 2160 }],
      [315, { container: 'webm', vcodec: 'vp9', quality: 2160, fps: 60 }],
      
      // Audio-only formats
      [139, { container: 'mp4', acodec: 'mp4a', bitrate: 48 }],
      [140, { container: 'mp4', acodec: 'mp4a', bitrate: 128 }],
      [141, { container: 'mp4', acodec: 'mp4a', bitrate: 256 }],
      [171, { container: 'webm', acodec: 'vorbis', bitrate: 128 }],
      [249, { container: 'webm', acodec: 'opus', bitrate: 50 }],
      [250, { container: 'webm', acodec: 'opus', bitrate: 70 }],
      [251, { container: 'webm', acodec: 'opus', bitrate: 160 }]
    ]);

    this.cache = new Map();
    this.playerCache = new Map();
    this.signatureCache = new Map();

    this.metrics = {
      extractionsPerformed: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      liveStreamsExtracted: 0,
      shortsExtracted: 0,
      playlistsExtracted: 0,
      signatureDecryptions: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.init();
  }

  init() {
    logger.info('Advanced YouTube Extractor initialized', {
      platforms: this.platforms,
      clients: Object.keys(this.clients),
      formatSpecs: this.formatSpecs.size
    });
  }

  // Main extraction methods
  canExtract(url) {
    return this.patterns.videoId.test(url) || this.patterns.shortsId.test(url);
  }

  async extract(url, options = {}) {
    try {
      this.metrics.extractionsPerformed++;
      logger.info(`Extracting YouTube video: ${url}`);
      
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Could not extract video ID from URL');
      }

      // Check cache first
      const cacheKey = `${videoId}_${JSON.stringify(options)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minute cache
        this.metrics.cacheHits++;
        return cached.result;
      }
      
      this.metrics.cacheMisses++;

      // Extract video information
      const videoInfo = await this.getVideoInfo(videoId, options);
      
      // Convert to detection result
      const result = await this.convertToDetectionResult(videoInfo, url, options);
      
      // Cache the result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      this.metrics.successfulExtractions++;
      eventSystem.emit('youtube:extractionCompleted', { videoId, url, result });
      
      return result;
    } catch (error) {
      this.metrics.failedExtractions++;
      logger.error(`YouTube extraction failed for ${url}`, error);
      throw error;
    }
  }

  extractVideoId(url) {
    // Handle YouTube Shorts
    const shortsMatch = url.match(this.patterns.shortsId);
    if (shortsMatch) {
      return shortsMatch[1];
    }

    // Handle regular YouTube videos
    const videoMatch = url.match(this.patterns.videoId);
    return videoMatch ? videoMatch[1] : null;
  }

  async getVideoInfo(videoId, options = {}) {
    const clients = options.clients || ['web', 'android', 'ios'];
    let lastError = null;

    // Try different clients until one works
    for (const clientName of clients) {
      try {
        logger.debug(`Trying YouTube client: ${clientName} for video ${videoId}`);
        const videoInfo = await this.getVideoInfoWithClient(videoId, clientName, options);
        
        if (videoInfo && videoInfo.formats && videoInfo.formats.length > 0) {
          videoInfo.clientUsed = clientName;
          return videoInfo;
        }
      } catch (error) {
        logger.warn(`YouTube client ${clientName} failed for video ${videoId}`, error);
        lastError = error;
      }
    }

    throw lastError || new Error('All YouTube clients failed to extract video information');
  }

  async getVideoInfoWithClient(videoId, clientName, options = {}) {
    const client = this.clients[clientName];
    if (!client) {
      throw new Error(`Unknown YouTube client: ${clientName}`);
    }

    // Prepare request payload
    const payload = {
      context: {
        client: {
          clientName: client.clientName,
          clientVersion: client.clientVersion,
          ...client
        }
      },
      videoId: videoId,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS'
        }
      },
      racaptchaToken: options.racaptchaToken,
      contentCheckOk: true,
      racaptchaResponse: options.racaptchaResponse
    };

    // Make API request
    const response = await networkManager.post(this.endpoints.playerApi, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.getUserAgent(clientName),
        'X-YouTube-Client-Name': this.getClientId(clientName),
        'X-YouTube-Client-Version': client.clientVersion,
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`
      }
    });

    if (!response.ok) {
      throw new Error(`YouTube API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check for errors
    if (data.playabilityStatus?.status !== 'OK') {
      const status = data.playabilityStatus?.status || 'UNKNOWN';
      const reason = data.playabilityStatus?.reason || 'No reason provided';
      throw new Error(`Video playability error: ${status} - ${reason}`);
    }

    // Parse video information
    return this.parseVideoInfo(data, videoId, clientName);
  }

  parseVideoInfo(data, videoId, clientName) {
    const videoDetails = data.videoDetails || {};
    const streamingData = data.streamingData || {};
    
    const videoInfo = {
      videoId: videoId,
      title: videoDetails.title || 'Unknown Title',
      description: videoDetails.shortDescription || '',
      uploader: videoDetails.author || 'Unknown Channel',
      channelId: videoDetails.channelId,
      duration: parseInt(videoDetails.lengthSeconds || '0', 10),
      viewCount: parseInt(videoDetails.viewCount || '0', 10),
      isLive: videoDetails.isLive === true,
      isLiveDVR: videoDetails.isLiveDVR === true,
      isUpcoming: videoDetails.isUpcoming === true,
      isPrivate: videoDetails.isPrivate === true,
      isFamilySafe: videoDetails.isFamilySafe !== false,
      availableCountries: videoDetails.availableCountries || [],
      publishDate: videoDetails.publishDate,
      uploadDate: videoDetails.uploadDate,
      
      // Media formats
      formats: [],
      adaptiveFormats: [],
      
      // Additional content
      thumbnails: this.parseThumbnails(videoDetails.thumbnail),
      subtitles: [],
      chapters: [],
      
      // Technical details
      clientUsed: clientName,
      expiresInSeconds: streamingData.expiresInSeconds,
      hlsManifestUrl: streamingData.hlsManifestUrl,
      dashManifestUrl: streamingData.dashManifestUrl
    };

    // Parse formats
    if (streamingData.formats) {
      for (const format of streamingData.formats) {
        const parsedFormat = this.parseFormat(format, false);
        if (parsedFormat) {
          videoInfo.formats.push(parsedFormat);
        }
      }
    }

    // Parse adaptive formats
    if (streamingData.adaptiveFormats) {
      for (const format of streamingData.adaptiveFormats) {
        const parsedFormat = this.parseFormat(format, true);
        if (parsedFormat) {
          videoInfo.adaptiveFormats.push(parsedFormat);
        }
      }
    }

    // Parse subtitles
    if (this.config.enableSubtitles && data.captions) {
      videoInfo.subtitles = this.parseSubtitles(data.captions);
    }

    // Parse chapters
    if (this.config.enableChapters && data.playerOverlays) {
      videoInfo.chapters = this.parseChapters(data.playerOverlays);
    }

    // Special handling for live streams
    if (videoInfo.isLive && streamingData.hlsManifestUrl) {
      this.metrics.liveStreamsExtracted++;
      videoInfo.liveManifest = streamingData.hlsManifestUrl;
    }

    // Detect if this is a YouTube Short
    if (videoInfo.duration <= 60 && videoInfo.duration > 0) {
      videoInfo.isShort = true;
      this.metrics.shortsExtracted++;
    }

    return videoInfo;
  }

  parseFormat(format, isAdaptive) {
    try {
      const parsedFormat = {
        itag: format.itag,
        url: format.url,
        mimeType: format.mimeType,
        quality: format.quality,
        qualityLabel: format.qualityLabel,
        bitrate: format.bitrate || format.averageBitrate,
        fps: format.fps,
        width: format.width,
        height: format.height,
        contentLength: format.contentLength,
        lastModified: format.lastModified,
        projectionType: format.projectionType,
        approxDurationMs: format.approxDurationMs,
        
        // Audio properties
        audioChannels: format.audioChannels,
        audioSampleRate: format.audioSampleRate,
        audioQuality: format.audioQuality,
        
        // Technical properties
        isAdaptive: isAdaptive,
        hasVideo: !!format.width,
        hasAudio: !!format.audioChannels || format.mimeType?.includes('audio'),
        
        // Decryption info
        signatureCipher: format.signatureCipher,
        cipher: format.cipher
      };

      // Handle encrypted URLs
      if (format.signatureCipher || format.cipher) {
        parsedFormat.encrypted = true;
        parsedFormat.cipherData = this.parseCipher(format.signatureCipher || format.cipher);
      }

      // Get format specifications
      const spec = this.formatSpecs.get(format.itag);
      if (spec) {
        parsedFormat.container = spec.container;
        parsedFormat.vcodec = spec.vcodec;
        parsedFormat.acodec = spec.acodec;
        parsedFormat.expectedQuality = spec.quality;
      }

      // Parse container and codecs from mimeType
      if (format.mimeType) {
        const mimeMatch = format.mimeType.match(/(\w+)\/(\w+)(?:;\s*codecs="([^"]+)")?/);
        if (mimeMatch) {
          parsedFormat.mimeType = mimeMatch[0];
          parsedFormat.container = parsedFormat.container || mimeMatch[2];
          if (mimeMatch[3]) {
            const codecs = mimeMatch[3].split(', ');
            parsedFormat.codecs = codecs;
            
            // Separate video and audio codecs
            for (const codec of codecs) {
              if (codec.startsWith('avc1') || codec.startsWith('hev1') || codec.startsWith('vp9') || codec.startsWith('av01')) {
                parsedFormat.vcodec = codec;
              } else if (codec.startsWith('mp4a') || codec.startsWith('opus') || codec.startsWith('vorbis')) {
                parsedFormat.acodec = codec;
              }
            }
          }
        }
      }

      return parsedFormat;
    } catch (error) {
      logger.warn(`Failed to parse YouTube format with itag ${format.itag}`, error);
      return null;
    }
  }

  parseCipher(cipherText) {
    const params = new URLSearchParams(cipherText);
    return {
      url: params.get('url'),
      s: params.get('s'),
      sp: params.get('sp') || 'signature'
    };
  }

  parseThumbnails(thumbnailData) {
    if (!thumbnailData || !thumbnailData.thumbnails) return [];
    
    return thumbnailData.thumbnails.map(thumb => ({
      url: thumb.url,
      width: thumb.width,
      height: thumb.height
    }));
  }

  parseSubtitles(captionsData) {
    const subtitles = [];
    
    if (captionsData.playerCaptionsTracklistRenderer) {
      const tracks = captionsData.playerCaptionsTracklistRenderer.captionTracks || [];
      
      for (const track of tracks) {
        subtitles.push({
          url: track.baseUrl,
          language: track.languageCode,
          name: track.name?.simpleText || track.languageCode,
          isAutoGenerated: track.kind === 'asr',
          format: 'vtt' // YouTube captions are typically in WebVTT format
        });
      }
    }
    
    return subtitles;
  }

  parseChapters(playerOverlays) {
    const chapters = [];
    
    // Implementation would parse chapter markers from player overlays
    // This is a complex extraction that varies with YouTube's UI changes
    
    return chapters;
  }

  async convertToDetectionResult(videoInfo, originalUrl, options = {}) {
    const sources = [];
    
    // Process regular formats (video + audio combined)
    for (const format of videoInfo.formats) {
      if (await this.shouldIncludeFormat(format, options)) {
        const source = await this.formatToMediaSource(format, videoInfo, originalUrl);
        if (source) {
          sources.push(source);
        }
      }
    }

    // Process adaptive formats
    for (const format of videoInfo.adaptiveFormats) {
      if (await this.shouldIncludeFormat(format, options)) {
        const source = await this.formatToMediaSource(format, videoInfo, originalUrl);
        if (source) {
          sources.push(source);
        }
      }
    }

    // Add HLS live stream if available
    if (videoInfo.isLive && videoInfo.hlsManifestUrl) {
      const hlsSource = createMediaSource(videoInfo.hlsManifestUrl, MediaType.LIVE_STREAM);
      hlsSource.format = 'hls';
      hlsSource.title = `${videoInfo.title} (Live HLS)`;
      hlsSource.metadata = {
        isLive: true,
        title: videoInfo.title,
        uploader: videoInfo.uploader,
        duration: videoInfo.duration
      };
      sources.push(hlsSource);
    }

    // Add DASH manifest if available
    if (videoInfo.dashManifestUrl) {
      const dashSource = createMediaSource(videoInfo.dashManifestUrl, MediaType.VIDEO);
      dashSource.format = 'dash';
      dashSource.title = `${videoInfo.title} (DASH)`;
      dashSource.metadata = {
        title: videoInfo.title,
        uploader: videoInfo.uploader,
        duration: videoInfo.duration
      };
      sources.push(dashSource);
    }

    // Sort sources by quality (highest first)
    sources.sort((a, b) => {
      const aHeight = a.quality?.height || 0;
      const bHeight = b.quality?.height || 0;
      return bHeight - aHeight;
    });

    const result = createDetectionResult(sources, Platform.YOUTUBE);
    result.detectionMethod = DetectionMethod.API_EXTRACTION;
    result.confidence = 0.95;
    
    // Add metadata
    result.metadata = {
      videoId: videoInfo.videoId,
      title: videoInfo.title,
      description: videoInfo.description,
      uploader: videoInfo.uploader,
      channelId: videoInfo.channelId,
      duration: videoInfo.duration,
      viewCount: videoInfo.viewCount,
      isLive: videoInfo.isLive,
      isShort: videoInfo.isShort,
      thumbnails: videoInfo.thumbnails,
      subtitles: videoInfo.subtitles,
      chapters: videoInfo.chapters,
      publishDate: videoInfo.publishDate,
      uploadDate: videoInfo.uploadDate,
      clientUsed: videoInfo.clientUsed
    };

    return result;
  }

  async shouldIncludeFormat(format, options) {
    // Filter based on configuration
    if (this.config.extractAudioOnly && format.hasVideo) {
      return false;
    }
    
    if (this.config.extractVideoOnly && !format.hasVideo) {
      return false;
    }

    // Filter by quality
    if (format.height && this.config.maxQuality) {
      const maxHeight = this.getMaxQualityHeight(this.config.maxQuality);
      if (format.height > maxHeight) {
        return false;
      }
    }

    // Filter by format preference
    if (this.config.preferredFormat && format.container !== this.config.preferredFormat) {
      // Allow format if no preferred format is available
      // This logic could be more sophisticated
    }

    return true;
  }

  getMaxQualityHeight(qualityLabel) {
    const qualityMap = {
      '144p': 144,
      '240p': 240,
      '360p': 360,
      '480p': 480,
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '4K': 2160,
      '8K': 4320
    };
    
    return qualityMap[qualityLabel] || 2160;
  }

  async formatToMediaSource(format, videoInfo, originalUrl) {
    try {
      // Decrypt URL if necessary
      let url = format.url;
      if (format.encrypted && format.cipherData) {
        url = await this.decryptSignature(format.cipherData, videoInfo.videoId);
      }

      if (!url) {
        logger.warn(`Could not get URL for format ${format.itag}`);
        return null;
      }

      // Determine media type
      let mediaType = MediaType.VIDEO;
      if (format.hasAudio && !format.hasVideo) {
        mediaType = MediaType.AUDIO;
      } else if (format.hasVideo && !format.hasAudio) {
        mediaType = MediaType.VIDEO;
      }

      const source = createMediaSource(url, mediaType);
      source.format = format.container || 'unknown';
      source.size = format.contentLength ? parseInt(format.contentLength, 10) : null;
      source.title = this.generateFormatTitle(format, videoInfo);
      
      // Quality information
      if (format.width && format.height) {
        source.quality = {
          width: format.width,
          height: format.height,
          bitrate: format.bitrate,
          fps: format.fps,
          codec: format.vcodec
        };
      } else if (format.hasAudio) {
        source.quality = {
          bitrate: format.bitrate,
          sampleRate: format.audioSampleRate,
          channels: format.audioChannels,
          codec: format.acodec
        };
      }

      // Additional metadata
      source.metadata = {
        itag: format.itag,
        mimeType: format.mimeType,
        qualityLabel: format.qualityLabel,
        isAdaptive: format.isAdaptive,
        hasVideo: format.hasVideo,
        hasAudio: format.hasAudio,
        container: format.container,
        vcodec: format.vcodec,
        acodec: format.acodec,
        approxDurationMs: format.approxDurationMs,
        lastModified: format.lastModified,
        
        // Video metadata
        videoId: videoInfo.videoId,
        title: videoInfo.title,
        uploader: videoInfo.uploader,
        duration: videoInfo.duration
      };

      return source;
    } catch (error) {
      logger.error(`Failed to create media source for format ${format.itag}`, error);
      return null;
    }
  }

  generateFormatTitle(format, videoInfo) {
    let title = videoInfo.title;
    
    if (format.qualityLabel) {
      title += ` (${format.qualityLabel})`;
    } else if (format.height) {
      title += ` (${format.height}p)`;
    } else if (format.bitrate) {
      title += ` (${Math.round(format.bitrate / 1000)}kbps)`;
    }
    
    if (format.fps && format.fps > 30) {
      title += ` ${format.fps}fps`;
    }
    
    if (format.container) {
      title += ` [${format.container}]`;
    }
    
    if (format.isAdaptive) {
      if (format.hasVideo && !format.hasAudio) {
        title += ' (Video Only)';
      } else if (format.hasAudio && !format.hasVideo) {
        title += ' (Audio Only)';
      }
    }
    
    return title;
  }

  async decryptSignature(cipherData, videoId) {
    try {
      if (!cipherData.s) {
        // No signature to decrypt
        return cipherData.url;
      }

      // Get the signature decryption function
      const decryptFunc = await this.getSignatureDecryptionFunction(videoId);
      if (!decryptFunc) {
        throw new Error('Could not get signature decryption function');
      }

      // Decrypt the signature
      const decryptedSignature = decryptFunc(cipherData.s);
      
      // Add the signature to the URL
      const url = new URL(cipherData.url);
      url.searchParams.set(cipherData.sp, decryptedSignature);
      
      this.metrics.signatureDecryptions++;
      return url.toString();
    } catch (error) {
      logger.error('Failed to decrypt YouTube signature', error);
      return null;
    }
  }

  async getSignatureDecryptionFunction(videoId) {
    // This is a complex process that involves:
    // 1. Getting the player JavaScript code
    // 2. Extracting the signature decryption function
    // 3. Creating a JavaScript function that can decrypt signatures
    
    // For now, return a placeholder function
    // In a real implementation, this would involve parsing YouTube's player JS
    return (signature) => {
      // This is a simplified placeholder
      // Real signature decryption requires parsing YouTube's player code
      logger.warn('Signature decryption not fully implemented');
      return signature;
    };
  }

  getUserAgent(clientName) {
    const userAgents = {
      web: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      android: 'com.google.android.youtube/18.02.37 (Linux; U; Android 11) gzip',
      ios: 'com.google.ios.youtube/18.02.10 (iPhone13,2; U; CPU iOS 15_6 like Mac OS X)',
      tv: 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version'
    };
    
    return userAgents[clientName] || userAgents.web;
  }

  getClientId(clientName) {
    const clientIds = {
      web: '1',
      android: '3',
      ios: '5',
      tv: '85'
    };
    
    return clientIds[clientName] || '1';
  }

  // Playlist extraction (if enabled)
  async extractPlaylist(url, options = {}) {
    if (!this.config.enablePlaylistExtraction) {
      throw new Error('Playlist extraction is disabled');
    }

    const playlistMatch = url.match(this.patterns.playlistId);
    if (!playlistMatch) {
      throw new Error('No playlist ID found in URL');
    }

    const playlistId = playlistMatch[1];
    
    // Implementation would extract all videos from the playlist
    // This is a complex process involving YouTube's browse API
    
    this.metrics.playlistsExtracted++;
    throw new Error('Playlist extraction not yet fully implemented');
  }

  // Cache management
  clearCache() {
    this.cache.clear();
    this.playerCache.clear();
    this.signatureCache.clear();
    logger.info('YouTube extractor cache cleared');
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      playerCacheSize: this.playerCache.size,
      signatureCacheSize: this.signatureCache.size,
      supportedClients: Object.keys(this.clients).length,
      supportedFormats: this.formatSpecs.size
    };
  }

  // Quality and format utilities
  getQualityLabel(format) {
    if (format.qualityLabel) return format.qualityLabel;
    if (format.height) {
      const quality = this.qualityMap.get(format.height);
      return quality ? quality.label : `${format.height}p`;
    }
    if (format.bitrate) {
      return `${Math.round(format.bitrate / 1000)}kbps`;
    }
    return 'Unknown Quality';
  }

  getFormatDescription(format) {
    const parts = [];
    
    if (format.qualityLabel) {
      parts.push(format.qualityLabel);
    }
    
    if (format.fps && format.fps > 30) {
      parts.push(`${format.fps}fps`);
    }
    
    if (format.container) {
      parts.push(format.container.toUpperCase());
    }
    
    if (format.vcodec) {
      parts.push(format.vcodec.toUpperCase());
    }
    
    if (format.acodec && format.acodec !== format.vcodec) {
      parts.push(format.acodec.toUpperCase());
    }
    
    return parts.join(' ');
  }

  destroy() {
    this.clearCache();
    logger.info('YouTube extractor destroyed');
  }
}

// Export default instance
export const youtubeExtractor = new AdvancedYouTubeExtractor();

export default AdvancedYouTubeExtractor;