/**
 * PegaTudo Advanced Video Detection Engine - Core Types & Constants
 * Comprehensive type definitions converted from TypeScript to JavaScript constants
 * Part of the massive 50+ file modular architecture
 */

// Core Media Types
export const MediaType = {
  VIDEO: 'video',
  AUDIO: 'audio', 
  IMAGE: 'image',
  LIVE_STREAM: 'live_stream',
  PLAYLIST: 'playlist',
  SUBTITLE: 'subtitle',
  DOCUMENT: 'document',
  ARCHIVE: 'archive',
  UNKNOWN: 'unknown'
};

// Encryption Methods
export const EncryptionMethod = {
  NONE: 'NONE',
  AES_128: 'AES-128',
  AES_128_CTR: 'AES-128-CTR', 
  AES_256: 'AES-256',
  AES_256_CTR: 'AES-256-CTR',
  SAMPLE_AES: 'SAMPLE-AES',
  SAMPLE_AES_CTR: 'SAMPLE-AES-CTR',
  WIDEVINE: 'WIDEVINE',
  FAIRPLAY: 'FAIRPLAY',
  PLAYREADY: 'PLAYREADY'
};

// Detection Methods
export const DetectionMethod = {
  DOM_SCAN: 'dom_scan',
  NETWORK_INTERCEPT: 'network_intercept',
  PATTERN_MATCH: 'pattern_match',
  API_EXTRACTION: 'api_extraction',
  SHADOW_DOM: 'shadow_dom',
  WEBSOCKET: 'websocket',
  MANIFEST_PARSE: 'manifest_parse',
  SOURCE_BUFFER: 'source_buffer',
  MEDIA_CAPTURE: 'media_capture',
  IFRAME_INTERCEPT: 'iframe_intercept',
  SERVICE_WORKER: 'service_worker',
  WORKER_THREAD: 'worker_thread'
};

// Download Status
export const DownloadStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  PROCESSING: 'processing',
  MERGING: 'merging',
  DECRYPTING: 'decrypting',
  CONVERTING: 'converting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
  RETRYING: 'retrying'
};

// Supported Platforms
export const Platform = {
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  TIKTOK: 'tiktok',
  INSTAGRAM: 'instagram',
  TWITTER: 'twitter',
  TWITCH: 'twitch',
  VIMEO: 'vimeo',
  DAILYMOTION: 'dailymotion',
  NETFLIX: 'netflix',
  AMAZON_PRIME: 'amazon_prime',
  DISNEY_PLUS: 'disney_plus',
  HULU: 'hulu',
  HBO_MAX: 'hbo_max',
  PARAMOUNT_PLUS: 'paramount_plus',
  PEACOCK: 'peacock',
  APPLE_TV: 'apple_tv',
  CRUNCHYROLL: 'crunchyroll',
  FUNIMATION: 'funimation',
  PORNHUB: 'pornhub',
  XVIDEOS: 'xvideos',
  REDDIT: 'reddit',
  LINKEDIN: 'linkedin',
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  ZOOM: 'zoom',
  TEAMS: 'teams',
  GENERIC: 'generic'
};

// Streaming Protocols
export const StreamingProtocol = {
  HLS: 'hls',
  DASH: 'dash',
  SMOOTH: 'smooth',
  RTMP: 'rtmp',
  RTSP: 'rtsp',
  WebRTC: 'webrtc',
  HTTP_PROGRESSIVE: 'http_progressive',
  WEBSOCKET_STREAM: 'websocket_stream'
};

// Video Quality Presets
export const VideoQualityPresets = {
  UHD_8K: { width: 7680, height: 4320, bitrate: 100000000, label: '8K UHD' },
  UHD_4K: { width: 3840, height: 2160, bitrate: 50000000, label: '4K UHD' },
  QHD_1440P: { width: 2560, height: 1440, bitrate: 16000000, label: '1440p QHD' },
  FHD_1080P: { width: 1920, height: 1080, bitrate: 8000000, label: '1080p Full HD' },
  HD_720P: { width: 1280, height: 720, bitrate: 5000000, label: '720p HD' },
  SD_480P: { width: 854, height: 480, bitrate: 2500000, label: '480p SD' },
  SD_360P: { width: 640, height: 360, bitrate: 1000000, label: '360p' },
  SD_240P: { width: 426, height: 240, bitrate: 500000, label: '240p' },
  SD_144P: { width: 256, height: 144, bitrate: 200000, label: '144p' }
};

// Audio Quality Presets
export const AudioQualityPresets = {
  LOSSLESS: { bitrate: 1411000, sampleRate: 44100, channels: 2, codec: 'flac', label: 'Lossless' },
  HIGH: { bitrate: 320000, sampleRate: 44100, channels: 2, codec: 'mp3', label: '320 kbps' },
  MEDIUM: { bitrate: 192000, sampleRate: 44100, channels: 2, codec: 'mp3', label: '192 kbps' },
  LOW: { bitrate: 128000, sampleRate: 44100, channels: 2, codec: 'mp3', label: '128 kbps' },
  VERY_LOW: { bitrate: 64000, sampleRate: 22050, channels: 1, codec: 'mp3', label: '64 kbps' }
};

// Log Levels
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

// File Formats
export const VideoFormats = [
  'mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'ogv', '3gp', 'm4v', 'ts', 'm2ts'
];

export const AudioFormats = [
  'mp3', 'aac', 'ogg', 'wav', 'flac', 'm4a', 'wma', 'opus', 'aiff'
];

export const ImageFormats = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'
];

// Factory functions for creating media objects
export function createMediaSource(url, type = MediaType.UNKNOWN) {
  return {
    url,
    type,
    quality: null,
    format: '',
    size: null,
    duration: null,
    title: null,
    thumbnail: null,
    encrypted: false,
    segments: [],
    headers: {},
    extractorId: null,
    metadata: {},
    timestamp: new Date(),
    id: generateId()
  };
}

export function createMediaSegment(url, duration, sequence) {
  return {
    url,
    duration,
    sequence,
    encrypted: false,
    key: null,
    byteRange: null,
    timestamp: new Date(),
    id: generateId()
  };
}

export function createEncryptionKey(uri, method = EncryptionMethod.NONE) {
  return {
    uri,
    method,
    iv: null,
    keyFormat: null,
    keyFormatVersions: null,
    derivedKey: null,
    timestamp: new Date()
  };
}

export function createDownloadProgress(downloadId, filename) {
  return {
    downloadId,
    filename,
    progress: 0,
    speed: 0,
    eta: 0,
    status: DownloadStatus.PENDING,
    error: null,
    startTime: new Date(),
    lastUpdate: new Date(),
    bytesDownloaded: 0,
    totalBytes: 0
  };
}

export function createDetectionResult(sources = [], platform = Platform.GENERIC) {
  return {
    sources,
    platform,
    detectionMethod: DetectionMethod.DOM_SCAN,
    confidence: 0,
    timestamp: new Date(),
    id: generateId(),
    metadata: {}
  };
}

// Utility functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function isVideoFormat(format) {
  return VideoFormats.includes(format.toLowerCase());
}

export function isAudioFormat(format) {
  return AudioFormats.includes(format.toLowerCase());
}

export function isImageFormat(format) {
  return ImageFormats.includes(format.toLowerCase());
}

export function getQualityLabel(quality) {
  if (!quality) return 'Unknown';
  if (quality.width && quality.height) {
    return `${quality.width}x${quality.height}`;
  }
  if (quality.bitrate) {
    return `${Math.round(quality.bitrate / 1000)} kbps`;
  }
  return 'Unknown';
}

export function validateMediaSource(source) {
  if (!source || typeof source !== 'object') return false;
  if (!source.url || typeof source.url !== 'string') return false;
  if (!Object.values(MediaType).includes(source.type)) return false;
  return true;
}

export function sanitizeFilename(filename) {
  if (!filename) return 'download';
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.+$/, '')
    .slice(0, 255);
}

// Export all types for external use
export default {
  MediaType,
  EncryptionMethod,
  DetectionMethod,
  DownloadStatus,
  Platform,
  StreamingProtocol,
  VideoQualityPresets,
  AudioQualityPresets,
  LogLevel,
  VideoFormats,
  AudioFormats,
  ImageFormats,
  createMediaSource,
  createMediaSegment,
  createEncryptionKey,
  createDownloadProgress,
  createDetectionResult,
  isVideoFormat,
  isAudioFormat,
  isImageFormat,
  getQualityLabel,
  validateMediaSource,
  sanitizeFilename
};