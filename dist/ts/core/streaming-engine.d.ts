/**
 * PegaTudo Advanced Streaming Protocol Handler
 * Handles HLS (.m3u8) and DASH (.mpd) streaming protocols with encryption support
 */
import { MediaSource, MediaSegment, EncryptionKey, DetectionResult, VideoQuality, AudioQuality, DownloadProgress, DebugConfig, StealthConfig } from '../types/index.js';
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
export declare class AdvancedStreamingEngine {
    private cryptoEngine;
    private debugConfig;
    private stealthConfig;
    private downloadQueue;
    private activeDownloads;
    constructor(debugConfig?: DebugConfig, stealthConfig?: StealthConfig);
    /**
     * Process HLS playlist and extract media sources
     */
    processHLSPlaylist(playlistUrl: string): Promise<DetectionResult>;
    /**
     * Process DASH MPD manifest
     */
    processDASHManifest(manifestUrl: string): Promise<DetectionResult>;
    /**
     * Download and merge streaming media
     */
    downloadStream(source: MediaSource, filename: string, onProgress?: (progress: DownloadProgress) => void): Promise<Blob>;
    /**
     * Download segments with concurrent connections and retry logic
     */
    private downloadSegments;
    /**
     * Download single segment with retry logic
     */
    private downloadSegmentWithRetry;
    /**
     * Decrypt segments if they are encrypted
     */
    private decryptSegments;
    /**
     * Merge segments into final media file
     */
    private mergeSegments;
    /**
     * Process main HLS playlist (contains multiple quality streams)
     */
    private processMainHLSPlaylist;
    /**
     * Process media playlist (contains actual segments)
     */
    private processMediaPlaylist;
    /**
     * Parse media playlist into segments
     */
    private parseMediaPlaylist;
    /**
     * Parse DASH MPD manifest
     */
    private parseDASHManifest;
    /**
     * Parse individual DASH representation
     */
    private parseDASHRepresentation;
    /**
     * Parse DASH segments from SegmentTemplate or SegmentList
     */
    private parseDASHSegments;
    /**
     * Parse SegmentTemplate for DASH
     */
    private parseSegmentTemplate;
    /**
     * Parse SegmentList for DASH
     */
    private parseSegmentList;
    private fetchPlaylist;
    private fetchManifest;
    private isMainPlaylist;
    private parseStreamInf;
    private extractQualityFromStreamInf;
    private resolveUrl;
    private getDASHMediaType;
    private detectPlatform;
    private getMimeTypeForFormat;
    private getStealthHeaders;
    private randomDelay;
    private generateDownloadId;
    private formatBytes;
    private getDefaultDebugConfig;
    private getDefaultStealthConfig;
    private log;
}
//# sourceMappingURL=streaming-engine.d.ts.map