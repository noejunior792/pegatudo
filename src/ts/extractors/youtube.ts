/**
 * PegaTudo YouTube Extractor
 * Advanced YouTube video extraction with multiple quality options and live stream support
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

interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  uploader: string;
  duration: number;
  viewCount: number;
  formats: YouTubeFormat[];
  adaptiveFormats: YouTubeFormat[];
  isLive: boolean;
  thumbnails: YouTubeThumbnail[];
}

interface YouTubeFormat {
  itag: number;
  url: string;
  mimeType: string;
  bitrate: number;
  width?: number;
  height?: number;
  fps?: number;
  audioChannels?: number;
  audioSampleRate?: number;
  quality: string;
  qualityLabel?: string;
  contentLength?: string;
}

interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

export class YouTubeExtractor implements ExtractorInterface {
  public readonly id = 'youtube';
  public readonly name = 'YouTube Extractor';
  public readonly platforms = [Platform.YOUTUBE];
  public readonly priority = 20;

  private debugConfig: DebugConfig;

  constructor(debugConfig?: DebugConfig) {
    this.debugConfig = debugConfig || this.getDefaultDebugConfig();
    this.log('YouTube Extractor initialized', 'INFO');
  }

  public canExtract(url: string): boolean {
    const youtubePatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];

    return youtubePatterns.some(pattern => pattern.test(url));
  }

  public async extract(url: string, config?: ExtractorConfig): Promise<DetectionResult> {
    try {
      this.log(`Extracting from YouTube URL: ${url}`, 'INFO');
      
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Could not extract video ID from URL');
      }

      // Try multiple extraction methods
      const videoInfo = await this.extractVideoInfo(videoId);
      const sources = this.convertToMediaSources(videoInfo);

      return {
        sources,
        platform: Platform.YOUTUBE,
        detectionMethod: DetectionMethod.API_EXTRACTION,
        confidence: 0.95,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`YouTube extraction failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private async extractVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
    // Method 1: Try extracting from page source
    try {
      const pageInfo = await this.extractFromPageSource(videoId);
      if (pageInfo) {
        this.log('Successfully extracted from page source', 'DEBUG');
        return pageInfo;
      }
    } catch (error) {
      this.log(`Page source extraction failed: ${error}`, 'WARN');
    }

    // Method 2: Try intercepting network requests
    try {
      const networkInfo = await this.extractFromNetworkRequests(videoId);
      if (networkInfo) {
        this.log('Successfully extracted from network requests', 'DEBUG');
        return networkInfo;
      }
    } catch (error) {
      this.log(`Network extraction failed: ${error}`, 'WARN');
    }

    // Method 3: Try hidden iframe method
    try {
      const iframeInfo = await this.extractFromIframe(videoId);
      if (iframeInfo) {
        this.log('Successfully extracted from iframe', 'DEBUG');
        return iframeInfo;
      }
    } catch (error) {
      this.log(`Iframe extraction failed: ${error}`, 'WARN');
    }

    throw new Error('All extraction methods failed');
  }

  private async extractFromPageSource(videoId: string): Promise<YouTubeVideoInfo | null> {
    try {
      // Look for ytInitialPlayerResponse in page scripts
      const scripts = document.querySelectorAll('script');
      
      for (const script of scripts) {
        const content = script.textContent || '';
        
        // Look for ytInitialPlayerResponse
        const playerResponseMatch = content.match(/var ytInitialPlayerResponse = ({.+?});/);
        if (playerResponseMatch) {
          const playerResponse = JSON.parse(playerResponseMatch[1]);
          return this.parsePlayerResponse(playerResponse);
        }

        // Look for ytInitialData
        const initialDataMatch = content.match(/var ytInitialData = ({.+?});/);
        if (initialDataMatch) {
          const initialData = JSON.parse(initialDataMatch[1]);
          const playerInfo = this.extractFromInitialData(initialData);
          if (playerInfo) return playerInfo;
        }
      }

      return null;
    } catch (error) {
      this.log(`Page source parsing error: ${error}`, 'ERROR');
      return null;
    }
  }

  private async extractFromNetworkRequests(videoId: string): Promise<YouTubeVideoInfo | null> {
    // This would intercept network requests to YouTube's API endpoints
    // Implementation would hook into fetch/XHR and look for player API calls
    
    this.log('Network request extraction not implemented in demo', 'DEBUG');
    return null;
  }

  private async extractFromIframe(videoId: string): Promise<YouTubeVideoInfo | null> {
    try {
      // Create hidden iframe to extract video info
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.style.display = 'none';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      
      document.body.appendChild(iframe);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          document.body.removeChild(iframe);
          reject(new Error('Iframe extraction timeout'));
        }, 10000);

        iframe.onload = () => {
          try {
            // Try to access iframe content (may be blocked by CORS)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              const scripts = iframeDoc.querySelectorAll('script');
              for (const script of scripts) {
                const content = script.textContent || '';
                const playerResponseMatch = content.match(/var ytInitialPlayerResponse = ({.+?});/);
                if (playerResponseMatch) {
                  const playerResponse = JSON.parse(playerResponseMatch[1]);
                  const videoInfo = this.parsePlayerResponse(playerResponse);
                  
                  clearTimeout(timeout);
                  document.body.removeChild(iframe);
                  resolve(videoInfo);
                  return;
                }
              }
            }
            
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve(null);
          } catch (error) {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            reject(error);
          }
        };

        iframe.onerror = () => {
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          reject(new Error('Iframe failed to load'));
        };
      });

    } catch (error) {
      this.log(`Iframe extraction error: ${error}`, 'ERROR');
      return null;
    }
  }

  private parsePlayerResponse(playerResponse: any): YouTubeVideoInfo {
    const videoDetails = playerResponse.videoDetails || {};
    const streamingData = playerResponse.streamingData || {};

    return {
      videoId: videoDetails.videoId || '',
      title: videoDetails.title || 'Unknown Title',
      description: videoDetails.shortDescription || '',
      uploader: videoDetails.author || 'Unknown',
      duration: parseInt(videoDetails.lengthSeconds || '0'),
      viewCount: parseInt(videoDetails.viewCount || '0'),
      formats: streamingData.formats || [],
      adaptiveFormats: streamingData.adaptiveFormats || [],
      isLive: videoDetails.isLiveContent === true,
      thumbnails: videoDetails.thumbnail?.thumbnails || []
    };
  }

  private extractFromInitialData(initialData: any): YouTubeVideoInfo | null {
    try {
      // Navigate through the complex YouTube data structure
      const contents = initialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
      if (!contents) return null;

      // Look for video primary info
      const videoPrimaryInfo = contents.find((item: any) => 
        item.videoPrimaryInfoRenderer
      )?.videoPrimaryInfoRenderer;

      const videoSecondaryInfo = contents.find((item: any) => 
        item.videoSecondaryInfoRenderer
      )?.videoSecondaryInfoRenderer;

      if (!videoPrimaryInfo) return null;

      return {
        videoId: '', // Would need to extract from URL or other source
        title: videoPrimaryInfo.title?.runs?.[0]?.text || 'Unknown Title',
        description: videoSecondaryInfo?.description?.runs?.map((run: any) => run.text).join('') || '',
        uploader: videoSecondaryInfo?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text || 'Unknown',
        duration: 0, // Would need to extract from other sources
        viewCount: this.parseViewCount(videoPrimaryInfo.viewCount?.videoViewCountRenderer?.viewCount?.simpleText || '0'),
        formats: [],
        adaptiveFormats: [],
        isLive: false,
        thumbnails: []
      };
    } catch (error) {
      this.log(`Initial data parsing error: ${error}`, 'ERROR');
      return null;
    }
  }

  private convertToMediaSources(videoInfo: YouTubeVideoInfo): MediaSource[] {
    const sources: MediaSource[] = [];

    // Process regular formats
    for (const format of videoInfo.formats) {
      const source: MediaSource = {
        url: format.url,
        type: this.getMediaTypeFromMimeType(format.mimeType),
        format: this.getFormatFromMimeType(format.mimeType),
        quality: format.width && format.height ? {
          width: format.width,
          height: format.height,
          bitrate: format.bitrate,
          fps: format.fps,
          codec: this.getCodecFromMimeType(format.mimeType)
        } : undefined,
        metadata: {
          title: videoInfo.title,
          description: videoInfo.description,
          uploader: videoInfo.uploader,
          viewCount: videoInfo.viewCount,
          duration: videoInfo.duration
        },
        extractorId: this.id
      };

      sources.push(source);
    }

    // Process adaptive formats
    for (const format of videoInfo.adaptiveFormats) {
      const source: MediaSource = {
        url: format.url,
        type: this.getMediaTypeFromMimeType(format.mimeType),
        format: this.getFormatFromMimeType(format.mimeType),
        quality: format.width && format.height ? {
          width: format.width,
          height: format.height,
          bitrate: format.bitrate,
          fps: format.fps,
          codec: this.getCodecFromMimeType(format.mimeType)
        } : undefined,
        metadata: {
          title: `${videoInfo.title} (${format.quality})`,
          description: videoInfo.description,
          uploader: videoInfo.uploader,
          viewCount: videoInfo.viewCount,
          duration: videoInfo.duration
        },
        extractorId: this.id
      };

      sources.push(source);
    }

    // Sort by quality (highest first)
    sources.sort((a, b) => {
      const aQuality = (a.quality as VideoQuality)?.height || 0;
      const bQuality = (b.quality as VideoQuality)?.height || 0;
      return bQuality - aQuality;
    });

    this.log(`Converted to ${sources.length} media sources`, 'DEBUG');
    return sources;
  }

  private getMediaTypeFromMimeType(mimeType: string): MediaType {
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.UNKNOWN;
  }

  private getFormatFromMimeType(mimeType: string): string {
    const codecMatch = mimeType.match(/codecs="([^"]+)"/);
    if (codecMatch) {
      const codec = codecMatch[1].toLowerCase();
      if (codec.includes('avc')) return 'mp4';
      if (codec.includes('vp9')) return 'webm';
      if (codec.includes('vp8')) return 'webm';
    }

    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('3gpp')) return '3gp';
    
    return 'unknown';
  }

  private getCodecFromMimeType(mimeType: string): string {
    const codecMatch = mimeType.match(/codecs="([^"]+)"/);
    return codecMatch ? codecMatch[1] : 'unknown';
  }

  private parseViewCount(viewCountText: string): number {
    const numberMatch = viewCountText.replace(/[^\d]/g, '');
    return parseInt(numberMatch) || 0;
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
    const logMessage = `[${timestamp}] [${level}] YouTube: ${message}`;
    
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