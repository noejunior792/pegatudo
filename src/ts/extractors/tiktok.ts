/**
 * PegaTudo TikTok Video Extractor
 * Advanced TikTok video extraction with multiple resolution support
 */

import {
  ExtractorInterface,
  DetectionResult,
  MediaSource,
  DetectionMethod,
  Platform,
  ExtractorConfig,
  MediaType,
  VideoQuality,
  DebugConfig
} from '../types/index.js';

interface TikTokVideoInfo {
  videoId: string;
  title: string;
  description: string;
  uploader: string;
  uploaderVerified: boolean;
  duration: number;
  playCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  sources: TikTokVideoSource[];
  thumbnail: string;
  music?: TikTokMusicInfo;
}

interface TikTokVideoSource {
  url: string;
  quality: string;
  width: number;
  height: number;
  bitrate?: number;
  codec?: string;
}

interface TikTokMusicInfo {
  title: string;
  author: string;
  url?: string;
  duration: number;
}

export class TikTokExtractor implements ExtractorInterface {
  public readonly id = 'tiktok';
  public readonly name = 'TikTok Video Extractor';
  public readonly platforms = [Platform.TIKTOK];
  public readonly priority = 18;

  private debugConfig: DebugConfig;

  constructor(debugConfig?: DebugConfig) {
    this.debugConfig = debugConfig || this.getDefaultDebugConfig();
    this.log('TikTok Extractor initialized', 'INFO');
  }

  public canExtract(url: string): boolean {
    const tiktokPatterns = [
      /tiktok\.com\/.*\/video\/\d+/,
      /tiktok\.com\/v\/\d+/,
      /tiktok\.com\/@[^\/]+\/video\/\d+/,
      /vm\.tiktok\.com\/[A-Za-z0-9]+/
    ];

    return tiktokPatterns.some(pattern => pattern.test(url));
  }

  public async extract(url: string, config?: ExtractorConfig): Promise<DetectionResult> {
    try {
      this.log(`Extracting from TikTok URL: ${url}`, 'INFO');
      
      const videoInfo = await this.extractVideoInfo(url);
      const sources = this.convertToMediaSources(videoInfo);

      return {
        sources,
        platform: Platform.TIKTOK,
        detectionMethod: DetectionMethod.API_EXTRACTION,
        confidence: 0.9,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`TikTok extraction failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  private async extractVideoInfo(url: string): Promise<TikTokVideoInfo> {
    // Method 1: Extract from Next.js props
    try {
      const nextInfo = await this.extractFromNextProps();
      if (nextInfo) {
        this.log('Successfully extracted from Next.js props', 'DEBUG');
        return nextInfo;
      }
    } catch (error) {
      this.log(`Next.js extraction failed: ${error}`, 'WARN');
    }

    // Method 2: Extract from DOM elements
    try {
      const domInfo = await this.extractFromDOM();
      if (domInfo) {
        this.log('Successfully extracted from DOM', 'DEBUG');
        return domInfo;
      }
    } catch (error) {
      this.log(`DOM extraction failed: ${error}`, 'WARN');
    }

    // Method 3: Extract from SIGI state
    try {
      const sigiInfo = await this.extractFromSIGI();
      if (sigiInfo) {
        this.log('Successfully extracted from SIGI state', 'DEBUG');
        return sigiInfo;
      }
    } catch (error) {
      this.log(`SIGI extraction failed: ${error}`, 'WARN');
    }

    throw new Error('All TikTok extraction methods failed');
  }

  private async extractFromNextProps(): Promise<TikTokVideoInfo | null> {
    try {
      // Look for Next.js __NEXT_DATA__ script
      const nextDataScript = document.querySelector('#__NEXT_DATA__');
      if (!nextDataScript || !nextDataScript.textContent) {
        return null;
      }

      const nextData = JSON.parse(nextDataScript.textContent);
      const props = nextData?.props?.pageProps;
      
      if (!props) return null;

      // Navigate through TikTok's complex data structure
      const itemStruct = props.itemInfo?.itemStruct;
      if (!itemStruct) return null;

      const video = itemStruct.video;
      const author = itemStruct.author;
      const music = itemStruct.music;
      const stats = itemStruct.stats;

      if (!video) return null;

      // Extract video sources with different qualities
      const sources: TikTokVideoSource[] = [];

      // Add different quality versions
      if (video.playAddr) {
        sources.push({
          url: video.playAddr,
          quality: 'auto',
          width: video.width || 720,
          height: video.height || 1280,
          bitrate: video.bitrate
        });
      }

      if (video.downloadAddr) {
        sources.push({
          url: video.downloadAddr,
          quality: 'download',
          width: video.width || 720,
          height: video.height || 1280,
          bitrate: video.bitrate
        });
      }

      // Look for additional quality versions
      if (video.bitrateInfo) {
        for (const bitrateInfo of video.bitrateInfo) {
          if (bitrateInfo.PlayAddr?.UrlList) {
            for (const urlInfo of bitrateInfo.PlayAddr.UrlList) {
              sources.push({
                url: urlInfo,
                quality: `${bitrateInfo.Bitrate}kbps`,
                width: video.width || 720,
                height: video.height || 1280,
                bitrate: bitrateInfo.Bitrate,
                codec: bitrateInfo.CodecType
              });
            }
          }
        }
      }

      return {
        videoId: itemStruct.id,
        title: itemStruct.desc || '',
        description: itemStruct.desc || '',
        uploader: author?.uniqueId || author?.nickname || 'Unknown',
        uploaderVerified: author?.verified || false,
        duration: video.duration || 0,
        playCount: stats?.playCount || 0,
        likeCount: stats?.diggCount || 0,
        shareCount: stats?.shareCount || 0,
        commentCount: stats?.commentCount || 0,
        sources,
        thumbnail: video.cover || video.originCover || '',
        music: music ? {
          title: music.title || '',
          author: music.authorName || '',
          url: music.playUrl || undefined,
          duration: music.duration || 0
        } : undefined
      };

    } catch (error) {
      this.log(`Next.js props parsing error: ${error}`, 'ERROR');
      return null;
    }
  }

  private async extractFromDOM(): Promise<TikTokVideoInfo | null> {
    try {
      // Look for video elements
      const videoElements = document.querySelectorAll('video');
      const sources: TikTokVideoSource[] = [];

      for (const video of videoElements) {
        if (video.src && !video.src.startsWith('blob:')) {
          sources.push({
            url: video.src,
            quality: 'auto',
            width: video.videoWidth || 720,
            height: video.videoHeight || 1280
          });
        }
      }

      // Look for TikTok-specific video containers
      const videoContainers = document.querySelectorAll('[data-e2e="video-player"]');
      for (const container of videoContainers) {
        const videoUrl = this.findVideoUrlInContainer(container as HTMLElement);
        if (videoUrl) {
          sources.push({
            url: videoUrl,
            quality: 'auto',
            width: 720,
            height: 1280
          });
        }
      }

      if (sources.length === 0) {
        return null;
      }

      // Extract metadata from DOM
      const title = this.extractTitleFromDOM();
      const uploader = this.extractUploaderFromDOM();
      const thumbnail = this.extractThumbnailFromDOM();

      return {
        videoId: this.generateVideoId(),
        title,
        description: title,
        uploader,
        uploaderVerified: false,
        duration: 0,
        playCount: 0,
        likeCount: 0,
        shareCount: 0,
        commentCount: 0,
        sources,
        thumbnail
      };

    } catch (error) {
      this.log(`DOM extraction error: ${error}`, 'ERROR');
      return null;
    }
  }

  private async extractFromSIGI(): Promise<TikTokVideoInfo | null> {
    try {
      // Look for SIGI_STATE in window object
      const windowAny = window as any;
      if (!windowAny.SIGI_STATE) {
        return null;
      }

      const sigiState = windowAny.SIGI_STATE;
      const itemModule = sigiState.ItemModule;
      
      if (!itemModule) return null;

      // Find the video item
      const videoId = Object.keys(itemModule)[0];
      const videoItem = itemModule[videoId];

      if (!videoItem) return null;

      const video = videoItem.video;
      const author = videoItem.author;
      const music = videoItem.music;
      const stats = videoItem.stats;

      const sources: TikTokVideoSource[] = [];

      // Extract video URLs
      if (video?.playAddr) {
        sources.push({
          url: video.playAddr,
          quality: 'auto',
          width: video.width || 720,
          height: video.height || 1280,
          bitrate: video.bitrate
        });
      }

      if (video?.downloadAddr) {
        sources.push({
          url: video.downloadAddr,
          quality: 'download',
          width: video.width || 720,
          height: video.height || 1280
        });
      }

      return {
        videoId: videoItem.id,
        title: videoItem.desc || '',
        description: videoItem.desc || '',
        uploader: author?.uniqueId || author?.nickname || 'Unknown',
        uploaderVerified: author?.verified || false,
        duration: video?.duration || 0,
        playCount: stats?.playCount || 0,
        likeCount: stats?.diggCount || 0,
        shareCount: stats?.shareCount || 0,
        commentCount: stats?.commentCount || 0,
        sources,
        thumbnail: video?.cover || video?.originCover || '',
        music: music ? {
          title: music.title || '',
          author: music.authorName || '',
          url: music.playUrl || undefined,
          duration: music.duration || 0
        } : undefined
      };

    } catch (error) {
      this.log(`SIGI extraction error: ${error}`, 'ERROR');
      return null;
    }
  }

  private findVideoUrlInContainer(container: HTMLElement): string | null {
    const content = container.innerHTML;
    
    // Look for TikTok video URLs
    const urlPatterns = [
      /https:\/\/[^"']*\.tiktokcdn\.com[^"']*\.mp4[^"']*/g,
      /https:\/\/[^"']*\.tiktok\.com[^"']*\.mp4[^"']*/g,
      /https:\/\/v\d+\.tiktokcdn\.com[^"']*/g
    ];

    for (const pattern of urlPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  private extractTitleFromDOM(): string {
    const titleSelectors = [
      '[data-e2e="video-desc"]',
      '[data-e2e="video-caption"]',
      'title',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return 'TikTok Video';
  }

  private extractUploaderFromDOM(): string {
    const uploaderSelectors = [
      '[data-e2e="video-author-uniqueid"]',
      '[data-e2e="video-author-nickname"]',
      '.author-uniqueid',
      '.author-nickname'
    ];

    for (const selector of uploaderSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim().replace('@', '');
      }
    }

    return 'Unknown';
  }

  private extractThumbnailFromDOM(): string {
    const thumbnailSelectors = [
      '[data-e2e="video-player"] img',
      '.video-cover img',
      '.video-thumbnail img'
    ];

    for (const selector of thumbnailSelectors) {
      const element = document.querySelector(selector) as HTMLImageElement;
      if (element && element.src) {
        return element.src;
      }
    }

    return '';
  }

  private convertToMediaSources(videoInfo: TikTokVideoInfo): MediaSource[] {
    const sources: MediaSource[] = [];

    for (const source of videoInfo.sources) {
      const mediaSource: MediaSource = {
        url: source.url,
        type: MediaType.VIDEO,
        format: 'mp4', // TikTok videos are typically MP4
        quality: {
          width: source.width,
          height: source.height,
          bitrate: source.bitrate,
          codec: source.codec || 'h264'
        },
        metadata: {
          title: videoInfo.title,
          description: videoInfo.description,
          uploader: videoInfo.uploader,
          viewCount: videoInfo.playCount,
          duration: videoInfo.duration,
          tags: this.extractHashtags(videoInfo.description)
        },
        extractorId: this.id,
        thumbnail: videoInfo.thumbnail
      };

      sources.push(mediaSource);
    }

    // Add music source if available
    if (videoInfo.music && videoInfo.music.url) {
      const musicSource: MediaSource = {
        url: videoInfo.music.url,
        type: MediaType.AUDIO,
        format: 'mp3',
        metadata: {
          title: videoInfo.music.title,
          uploader: videoInfo.music.author,
          duration: videoInfo.music.duration
        },
        extractorId: this.id
      };

      sources.push(musicSource);
    }

    // Sort sources by quality (highest bitrate first)
    sources.sort((a, b) => {
      const aBitrate = (a.quality as VideoQuality)?.bitrate || 0;
      const bBitrate = (b.quality as VideoQuality)?.bitrate || 0;
      return bBitrate - aBitrate;
    });

    this.log(`Converted to ${sources.length} media sources`, 'DEBUG');
    return sources;
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#\w+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  private generateVideoId(): string {
    return `tiktok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultDebugConfig(): DebugConfig {
    return {
      enabled: false,
      level: 'INFO',
      logNetworkRequests: false,
      logDetectionResults: false,
      logCryptoOperations: false,
      saveToFile: false
    };
  }

  private log(message: string, level: keyof { DEBUG: 0; INFO: 1; WARN: 2; ERROR: 3 }): void {
    if (!this.debugConfig.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] TikTok: ${message}`;
    
    switch (level) {
      case 'DEBUG':
        console.debug(logMessage);
        break;
      case 'INFO':
        console.info(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'ERROR':
        console.error(logMessage);
        break;
    }
  }
}