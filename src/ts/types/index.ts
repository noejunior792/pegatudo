/**
 * PegaTudo Advanced Video Detection Engine - Core Types
 * Comprehensive type definitions for the video download system
 */

export interface MediaSource {
  url: string;
  type: MediaType;
  quality?: VideoQuality;
  format: string;
  size?: number;
  duration?: number;
  title?: string;
  thumbnail?: string;
  encrypted?: boolean;
  segments?: MediaSegment[];
  headers?: Record<string, string>;
  extractorId?: string;
  metadata?: MediaMetadata;
}

export interface MediaSegment {
  url: string;
  duration: number;
  sequence: number;
  encrypted?: boolean;
  key?: EncryptionKey;
  byteRange?: {
    start: number;
    end: number;
  };
}

export interface EncryptionKey {
  uri: string;
  method: EncryptionMethod;
  iv?: string;
  keyFormat?: string;
  keyFormatVersions?: string;
}

export interface MediaMetadata {
  title?: string;
  description?: string;
  uploader?: string;
  uploadDate?: Date;
  viewCount?: number;
  duration?: number;
  tags?: string[];
  language?: string;
  subtitles?: SubtitleTrack[];
}

export interface SubtitleTrack {
  url: string;
  language: string;
  format: string;
  name?: string;
}

export interface VideoQuality {
  width: number;
  height: number;
  bitrate?: number;
  fps?: number;
  codec?: string;
}

export interface AudioQuality {
  bitrate: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
}

export interface DetectionResult {
  sources: MediaSource[];
  platform: string;
  detectionMethod: DetectionMethod;
  confidence: number;
  timestamp: Date;
}

export interface DownloadOptions {
  quality?: VideoQuality | AudioQuality;
  format?: string;
  outputPath?: string;
  concurrent?: boolean;
  retries?: number;
  headers?: Record<string, string>;
  decrypt?: boolean;
}

export interface DownloadProgress {
  downloadId: string;
  filename: string;
  progress: number;
  speed: number;
  eta: number;
  status: DownloadStatus;
  error?: string;
}

export interface ExtractorConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  retries: number;
  customHeaders?: Record<string, string>;
  userAgent?: string;
}

export interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: Date;
  response?: NetworkResponse;
}

export interface NetworkResponse {
  status: number;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  contentType?: string;
  size?: number;
}

export interface PatternMatch {
  pattern: RegExp;
  type: MediaType;
  priority: number;
  extractor?: string;
}

export enum MediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  LIVE_STREAM = 'live_stream',
  PLAYLIST = 'playlist',
  UNKNOWN = 'unknown'
}

export enum EncryptionMethod {
  NONE = 'NONE',
  AES_128 = 'AES-128',
  AES_128_CTR = 'AES-128-CTR',
  SAMPLE_AES = 'SAMPLE-AES',
  SAMPLE_AES_CTR = 'SAMPLE-AES-CTR'
}

export enum DetectionMethod {
  DOM_SCAN = 'dom_scan',
  NETWORK_INTERCEPT = 'network_intercept',
  PATTERN_MATCH = 'pattern_match',
  API_EXTRACTION = 'api_extraction',
  SHADOW_DOM = 'shadow_dom',
  WEBSOCKET = 'websocket',
  MANIFEST_PARSE = 'manifest_parse'
}

export enum DownloadStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  PROCESSING = 'processing',
  MERGING = 'merging',
  DECRYPTING = 'decrypting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum Platform {
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  TWITTER = 'twitter',
  TWITCH = 'twitch',
  VIMEO = 'vimeo',
  DAILYMOTION = 'dailymotion',
  GENERIC = 'generic'
}

export interface ExtractorInterface {
  id: string;
  name: string;
  platforms: Platform[];
  priority: number;
  canExtract(url: string): boolean;
  extract(url: string, options?: ExtractorConfig): Promise<DetectionResult>;
}

export interface CryptoInterface {
  decrypt(data: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer>;
  deriveKey(keyUri: string, iv?: string): Promise<CryptoKey>;
  decryptSegment(segment: MediaSegment, data: ArrayBuffer): Promise<ArrayBuffer>;
}

export interface NetworkInterceptorInterface {
  start(): void;
  stop(): void;
  addPattern(pattern: PatternMatch): void;
  removePattern(pattern: PatternMatch): void;
  getRequests(): NetworkRequest[];
  clearRequests(): void;
}

export interface UIManagerInterface {
  show(sources: MediaSource[]): void;
  hide(): void;
  updateProgress(progress: DownloadProgress): void;
  showError(error: string): void;
}

export interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

export interface DebugConfig {
  enabled: boolean;
  level: keyof LogLevel;
  logNetworkRequests: boolean;
  logDetectionResults: boolean;
  logCryptoOperations: boolean;
  saveToFile: boolean;
}

export interface StealthConfig {
  randomizeUserAgent: boolean;
  randomizeRequestTiming: boolean;
  mimicBrowserBehavior: boolean;
  avoidDetection: boolean;
  maxConcurrentRequests: number;
  requestDelay: {
    min: number;
    max: number;
  };
}