/**
 * PegaTudo Advanced Streaming Protocol Handler
 * Handles HLS (.m3u8) and DASH (.mpd) streaming protocols with encryption support
 */

import {
  MediaSource,
  MediaSegment,
  EncryptionKey,
  EncryptionMethod,
  DetectionResult,
  DetectionMethod,
  Platform,
  VideoQuality,
  AudioQuality,
  DownloadProgress,
  DownloadStatus,
  DebugConfig,
  StealthConfig,
  MediaType
} from '../types/index.js';

import { AdvancedCryptoEngine } from '../crypto/crypto-engine.js';

export interface StreamPlaylist {
  url: string;
  quality?: VideoQuality | AudioQuality;
  bandwidth?: number;
  codecs?: string[];
  segments: MediaSegment[];
  keys: EncryptionKey[];
  totalDuration: number;
  isLive: boolean;
  type: 'video' | 'audio' | 'subtitle';
}

export interface DASHRepresentation {
  id: string;
  bandwidth: number;
  width?: number;
  height?: number;
  frameRate?: string;
  codecs: string;
  mimeType: string;
  segments: MediaSegment[];
  initializationUrl?: string;
}

export class AdvancedStreamingEngine {
  private cryptoEngine: AdvancedCryptoEngine;
  private debugConfig: DebugConfig;
  private stealthConfig: StealthConfig;
  private downloadQueue: Map<string, DownloadProgress> = new Map();
  private activeDownloads: Set<string> = new Set();

  constructor(
    debugConfig?: DebugConfig,
    stealthConfig?: StealthConfig
  ) {
    this.debugConfig = debugConfig || this.getDefaultDebugConfig();
    this.stealthConfig = stealthConfig || this.getDefaultStealthConfig();
    this.cryptoEngine = new AdvancedCryptoEngine(debugConfig);
    this.log('AdvancedStreamingEngine initialized', 'INFO');
  }

  /**
   * Process HLS playlist and extract media sources
   */
  public async processHLSPlaylist(playlistUrl: string): Promise<DetectionResult> {
    try {
      this.log(`Processing HLS playlist: ${playlistUrl}`, 'INFO');
      
      const playlist = await this.fetchPlaylist(playlistUrl);
      const isMainPlaylist = this.isMainPlaylist(playlist);
      
      if (isMainPlaylist) {
        return await this.processMainHLSPlaylist(playlistUrl, playlist);
      } else {
        return await this.processMediaPlaylist(playlistUrl, playlist);
      }
      
    } catch (error) {
      this.log(`HLS processing failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Process DASH MPD manifest
   */
  public async processDASHManifest(manifestUrl: string): Promise<DetectionResult> {
    try {
      this.log(`Processing DASH manifest: ${manifestUrl}`, 'INFO');
      
      const manifestXML = await this.fetchManifest(manifestUrl);
      const representations = await this.parseDASHManifest(manifestXML, manifestUrl);
      
      const sources: MediaSource[] = [];
      
      for (const representation of representations) {
        const mediaSource: MediaSource = {
          url: manifestUrl,
          type: this.getDASHMediaType(representation.mimeType),
          format: 'dash',
          quality: representation.width && representation.height ? {
            width: representation.width,
            height: representation.height,
            bitrate: representation.bandwidth,
            codec: representation.codecs
          } : undefined,
          segments: representation.segments,
          metadata: {
            title: `DASH ${representation.mimeType} - ${representation.bandwidth}bps`
          }
        };
        
        sources.push(mediaSource);
      }
      
      return {
        sources,
        platform: this.detectPlatform(manifestUrl),
        detectionMethod: DetectionMethod.MANIFEST_PARSE,
        confidence: 0.95,
        timestamp: new Date()
      };
      
    } catch (error) {
      this.log(`DASH processing failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Download and merge streaming media
   */
  public async downloadStream(
    source: MediaSource,
    filename: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<Blob> {
    const downloadId = this.generateDownloadId();
    const progress: DownloadProgress = {
      downloadId,
      filename,
      progress: 0,
      speed: 0,
      eta: 0,
      status: DownloadStatus.PENDING
    };

    try {
      this.downloadQueue.set(downloadId, progress);
      this.activeDownloads.add(downloadId);
      
      this.log(`Starting stream download: ${filename}`, 'INFO');
      progress.status = DownloadStatus.DOWNLOADING;
      onProgress?.(progress);

      if (!source.segments || source.segments.length === 0) {
        throw new Error('No segments found in media source');
      }

      // Download all segments
      const segmentBlobs = await this.downloadSegments(
        source.segments,
        downloadId,
        onProgress
      );

      // Decrypt if necessary
      const decryptedBlobs = await this.decryptSegments(
        segmentBlobs,
        source.segments,
        downloadId,
        onProgress
      );

      // Merge segments
      progress.status = DownloadStatus.MERGING;
      onProgress?.(progress);
      
      const finalBlob = await this.mergeSegments(decryptedBlobs, source.format);
      
      progress.status = DownloadStatus.COMPLETED;
      progress.progress = 100;
      onProgress?.(progress);
      
      this.log(`Stream download completed: ${filename}`, 'INFO');
      return finalBlob;
      
    } catch (error) {
      progress.status = DownloadStatus.FAILED;
      progress.error = error.message;
      onProgress?.(progress);
      
      this.log(`Stream download failed: ${error}`, 'ERROR');
      throw error;
    } finally {
      this.activeDownloads.delete(downloadId);
      this.downloadQueue.delete(downloadId);
    }
  }

  /**
   * Download segments with concurrent connections and retry logic
   */
  private async downloadSegments(
    segments: MediaSegment[],
    downloadId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<ArrayBuffer[]> {
    const maxConcurrent = this.stealthConfig.maxConcurrentRequests;
    const segmentBlobs: ArrayBuffer[] = new Array(segments.length);
    let completedCount = 0;
    const startTime = Date.now();

    this.log(`Downloading ${segments.length} segments with ${maxConcurrent} concurrent connections`, 'DEBUG');

    // Download segments in batches
    for (let i = 0; i < segments.length; i += maxConcurrent) {
      const batch = segments.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (segment, batchIndex) => {
        const segmentIndex = i + batchIndex;
        return this.downloadSegmentWithRetry(segment, segmentIndex);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, batchIndex) => {
        const segmentIndex = i + batchIndex;
        if (result.status === 'fulfilled') {
          segmentBlobs[segmentIndex] = result.value;
          completedCount++;
        } else {
          this.log(`Segment ${segmentIndex} download failed: ${result.reason}`, 'ERROR');
          throw new Error(`Failed to download segment ${segmentIndex}: ${result.reason}`);
        }
      });

      // Update progress
      const progress = this.downloadQueue.get(downloadId);
      if (progress && onProgress) {
        progress.progress = Math.round((completedCount / segments.length) * 80); // 80% for download
        
        const elapsed = Date.now() - startTime;
        const rate = completedCount / (elapsed / 1000);
        progress.speed = rate;
        progress.eta = (segments.length - completedCount) / rate;
        
        onProgress(progress);
      }

      // Add delay between batches for stealth
      if (i + maxConcurrent < segments.length) {
        await this.randomDelay();
      }
    }

    return segmentBlobs;
  }

  /**
   * Download single segment with retry logic
   */
  private async downloadSegmentWithRetry(
    segment: MediaSegment,
    index: number,
    maxRetries: number = 3
  ): Promise<ArrayBuffer> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`Downloading segment ${index} (attempt ${attempt})`, 'DEBUG');
        
        const response = await fetch(segment.url, {
          headers: this.getStealthHeaders()
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.arrayBuffer();
        this.log(`Successfully downloaded segment ${index} (${data.byteLength} bytes)`, 'DEBUG');
        
        return data;
        
      } catch (error) {
        lastError = error as Error;
        this.log(`Segment ${index} download attempt ${attempt} failed: ${error}`, 'WARN');
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to download segment ${index} after ${maxRetries} attempts`);
  }

  /**
   * Decrypt segments if they are encrypted
   */
  private async decryptSegments(
    segmentBlobs: ArrayBuffer[],
    segments: MediaSegment[],
    downloadId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<ArrayBuffer[]> {
    const encryptedSegments = segments.filter(seg => seg.encrypted);
    
    if (encryptedSegments.length === 0) {
      this.log('No encrypted segments, skipping decryption', 'DEBUG');
      return segmentBlobs;
    }

    this.log(`Decrypting ${encryptedSegments.length} encrypted segments`, 'INFO');
    
    const progress = this.downloadQueue.get(downloadId);
    if (progress) {
      progress.status = DownloadStatus.DECRYPTING;
      onProgress?.(progress);
    }

    const decryptedBlobs: ArrayBuffer[] = [...segmentBlobs];
    let decryptedCount = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.encrypted && segment.key) {
        try {
          decryptedBlobs[i] = await this.cryptoEngine.decryptSegment(segment, segmentBlobs[i]);
          decryptedCount++;
          
          // Update progress
          if (progress && onProgress) {
            progress.progress = 80 + Math.round((decryptedCount / encryptedSegments.length) * 15); // 15% for decryption
            onProgress(progress);
          }
          
        } catch (error) {
          this.log(`Failed to decrypt segment ${i}: ${error}`, 'ERROR');
          // Continue with encrypted segment - may still be playable
        }
      }
    }

    this.log(`Successfully decrypted ${decryptedCount}/${encryptedSegments.length} segments`, 'INFO');
    return decryptedBlobs;
  }

  /**
   * Merge segments into final media file
   */
  private async mergeSegments(segments: ArrayBuffer[], format: string): Promise<Blob> {
    this.log(`Merging ${segments.length} segments into ${format} format`, 'INFO');
    
    // Calculate total size
    const totalSize = segments.reduce((sum, segment) => sum + segment.byteLength, 0);
    this.log(`Total merged size: ${this.formatBytes(totalSize)}`, 'DEBUG');
    
    // Determine MIME type
    const mimeType = this.getMimeTypeForFormat(format);
    
    // Create final blob
    const finalBlob = new Blob(segments, { type: mimeType });
    
    this.log(`Successfully merged segments into ${mimeType} blob`, 'INFO');
    return finalBlob;
  }

  /**
   * Process main HLS playlist (contains multiple quality streams)
   */
  private async processMainHLSPlaylist(playlistUrl: string, playlist: string): Promise<DetectionResult> {
    const lines = playlist.split('\n');
    const streams: StreamPlaylist[] = [];
    
    let currentStreamInfo: any = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        currentStreamInfo = this.parseStreamInf(line);
      } else if (line && !line.startsWith('#') && currentStreamInfo.BANDWIDTH) {
        const streamUrl = this.resolveUrl(line, playlistUrl);
        
        try {
          const streamPlaylist = await this.fetchPlaylist(streamUrl);
          const mediaPlaylist = await this.parseMediaPlaylist(streamUrl, streamPlaylist);
          
          mediaPlaylist.quality = this.extractQualityFromStreamInf(currentStreamInfo);
          mediaPlaylist.bandwidth = parseInt(currentStreamInfo.BANDWIDTH);
          
          streams.push(mediaPlaylist);
        } catch (error) {
          this.log(`Failed to process stream: ${streamUrl}: ${error}`, 'WARN');
        }
        
        currentStreamInfo = {};
      }
    }

    // Convert streams to media sources
    const sources: MediaSource[] = streams.map(stream => ({
      url: stream.url,
      type: stream.type === 'video' ? MediaType.VIDEO : MediaType.AUDIO,
      format: 'hls',
      quality: stream.quality as VideoQuality,
      segments: stream.segments,
      metadata: {
        title: `HLS ${stream.type} - ${stream.bandwidth}bps`,
        duration: stream.totalDuration
      }
    }));

    return {
      sources,
      platform: this.detectPlatform(playlistUrl),
      detectionMethod: DetectionMethod.MANIFEST_PARSE,
      confidence: 0.95,
      timestamp: new Date()
    };
  }

  /**
   * Process media playlist (contains actual segments)
   */
  private async processMediaPlaylist(playlistUrl: string, playlist: string): Promise<DetectionResult> {
    const mediaPlaylist = await this.parseMediaPlaylist(playlistUrl, playlist);
    
    const source: MediaSource = {
      url: playlistUrl,
      type: MediaType.VIDEO, // Default to video, could be refined
      format: 'hls',
      segments: mediaPlaylist.segments,
      metadata: {
        title: 'HLS Stream',
        duration: mediaPlaylist.totalDuration
      }
    };

    return {
      sources: [source],
      platform: this.detectPlatform(playlistUrl),
      detectionMethod: DetectionMethod.MANIFEST_PARSE,
      confidence: 0.9,
      timestamp: new Date()
    };
  }

  /**
   * Parse media playlist into segments
   */
  private async parseMediaPlaylist(playlistUrl: string, playlist: string): Promise<StreamPlaylist> {
    const lines = playlist.split('\n');
    const segments: MediaSegment[] = [];
    const keys: EncryptionKey[] = [];
    
    let currentKey: EncryptionKey | undefined;
    let segmentDuration: number = 0;
    let sequence: number = 0;
    let totalDuration: number = 0;
    let isLive: boolean = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXT-X-KEY:')) {
        const key = this.cryptoEngine.extractKeysFromM3U8(line)[0];
        if (key) {
          currentKey = key;
          keys.push(key);
        }
      } else if (line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durationMatch) {
          segmentDuration = parseFloat(durationMatch[1]);
        }
      } else if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
        // Check if it's a live stream
        isLive = !line.includes('VOD');
      } else if (line && !line.startsWith('#')) {
        // This is a segment URL
        const segmentUrl = this.resolveUrl(line, playlistUrl);
        
        const segment: MediaSegment = {
          url: segmentUrl,
          duration: segmentDuration,
          sequence: sequence++,
          encrypted: !!currentKey && currentKey.method !== EncryptionMethod.NONE,
          key: currentKey
        };
        
        segments.push(segment);
        totalDuration += segmentDuration;
      }
    }

    return {
      url: playlistUrl,
      segments,
      keys,
      totalDuration,
      isLive,
      type: 'video' // Could be refined based on content analysis
    };
  }

  /**
   * Parse DASH MPD manifest
   */
  private async parseDASHManifest(manifestXML: string, baseUrl: string): Promise<DASHRepresentation[]> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(manifestXML, 'text/xml');
    const representations: DASHRepresentation[] = [];

    // Find all Representation elements
    const representationElements = doc.querySelectorAll('Representation');
    
    for (const repr of representationElements) {
      const representation = await this.parseDASHRepresentation(repr, baseUrl, doc);
      if (representation) {
        representations.push(representation);
      }
    }

    this.log(`Parsed ${representations.length} DASH representations`, 'DEBUG');
    return representations;
  }

  /**
   * Parse individual DASH representation
   */
  private async parseDASHRepresentation(
    element: Element,
    baseUrl: string,
    doc: Document
  ): Promise<DASHRepresentation | null> {
    try {
      const id = element.getAttribute('id') || '';
      const bandwidth = parseInt(element.getAttribute('bandwidth') || '0');
      const width = element.getAttribute('width') ? parseInt(element.getAttribute('width')!) : undefined;
      const height = element.getAttribute('height') ? parseInt(element.getAttribute('height')!) : undefined;
      const frameRate = element.getAttribute('frameRate') || undefined;
      const codecs = element.getAttribute('codecs') || '';
      const mimeType = element.getAttribute('mimeType') || '';

      // Parse segments from SegmentTemplate or SegmentList
      const segments = await this.parseDASHSegments(element, baseUrl, doc);

      return {
        id,
        bandwidth,
        width,
        height,
        frameRate,
        codecs,
        mimeType,
        segments
      };
    } catch (error) {
      this.log(`Failed to parse DASH representation: ${error}`, 'ERROR');
      return null;
    }
  }

  /**
   * Parse DASH segments from SegmentTemplate or SegmentList
   */
  private async parseDASHSegments(
    representation: Element,
    baseUrl: string,
    doc: Document
  ): Promise<MediaSegment[]> {
    const segments: MediaSegment[] = [];

    // Try SegmentTemplate first
    const segmentTemplate = representation.querySelector('SegmentTemplate') ||
                           representation.parentElement?.querySelector('SegmentTemplate');
    
    if (segmentTemplate) {
      return this.parseSegmentTemplate(segmentTemplate, baseUrl);
    }

    // Try SegmentList
    const segmentList = representation.querySelector('SegmentList') ||
                       representation.parentElement?.querySelector('SegmentList');
    
    if (segmentList) {
      return this.parseSegmentList(segmentList, baseUrl);
    }

    return segments;
  }

  /**
   * Parse SegmentTemplate for DASH
   */
  private parseSegmentTemplate(template: Element, baseUrl: string): MediaSegment[] {
    const segments: MediaSegment[] = [];
    const media = template.getAttribute('media') || '';
    const duration = parseFloat(template.getAttribute('duration') || '0');
    const startNumber = parseInt(template.getAttribute('startNumber') || '1');
    
    // This is a simplified implementation
    // Real implementation would need to handle timeline and other complexities
    
    return segments;
  }

  /**
   * Parse SegmentList for DASH
   */
  private parseSegmentList(segmentList: Element, baseUrl: string): MediaSegment[] {
    const segments: MediaSegment[] = [];
    const segmentUrls = segmentList.querySelectorAll('SegmentURL');
    
    segmentUrls.forEach((segmentUrl, index) => {
      const media = segmentUrl.getAttribute('media') || '';
      const url = this.resolveUrl(media, baseUrl);
      
      segments.push({
        url,
        duration: 0, // Would need to be calculated from timeline
        sequence: index
      });
    });
    
    return segments;
  }

  // Utility methods
  
  private async fetchPlaylist(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: this.getStealthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
  }

  private async fetchManifest(url: string): Promise<string> {
    return this.fetchPlaylist(url); // Same implementation
  }

  private isMainPlaylist(playlist: string): boolean {
    return playlist.includes('#EXT-X-STREAM-INF:');
  }

  private parseStreamInf(line: string): Record<string, string> {
    const params: Record<string, string> = {};
    const regex = /([A-Z-]+)=([^,]+)/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
      params[match[1]] = match[2];
    }

    return params;
  }

  private extractQualityFromStreamInf(streamInfo: Record<string, string>): VideoQuality | undefined {
    const resolution = streamInfo.RESOLUTION;
    if (resolution) {
      const [width, height] = resolution.split('x').map(Number);
      return {
        width,
        height,
        bitrate: parseInt(streamInfo.BANDWIDTH || '0')
      };
    }
    return undefined;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  private getDASHMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.UNKNOWN;
  }

  private detectPlatform(url: string): string {
    // Implementation would detect platform based on URL patterns
    return Platform.GENERIC;
  }

  private getMimeTypeForFormat(format: string): string {
    const mimeTypes: Record<string, string> = {
      'hls': 'video/mp2t',
      'dash': 'video/mp4',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ts': 'video/mp2t'
    };
    
    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  }

  private getStealthHeaders(): Record<string, string> {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];

    const headers: Record<string, string> = {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    if (this.stealthConfig.randomizeUserAgent) {
      headers['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    return headers;
  }

  private async randomDelay(): Promise<void> {
    if (!this.stealthConfig.randomizeRequestTiming) return;
    
    const min = this.stealthConfig.requestDelay.min;
    const max = this.stealthConfig.requestDelay.max;
    const delay = Math.random() * (max - min) + min;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private generateDownloadId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  private getDefaultStealthConfig(): StealthConfig {
    return {
      randomizeUserAgent: true,
      randomizeRequestTiming: true,
      mimicBrowserBehavior: true,
      avoidDetection: true,
      maxConcurrentRequests: 3,
      requestDelay: { min: 200, max: 800 }
    };
  }

  private log(message: string, level: keyof { DEBUG: 0; INFO: 1; WARN: 2; ERROR: 3 }): void {
    if (!this.debugConfig.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] Streaming: ${message}`;
    
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