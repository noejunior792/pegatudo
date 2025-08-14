import { EncryptionMethod, DetectionMethod, Platform, DownloadStatus, MediaType } from '../types/index.js';
import { AdvancedCryptoEngine } from '../crypto/crypto-engine.js';
export class AdvancedStreamingEngine {
    constructor(debugConfig, stealthConfig) {
        this.downloadQueue = new Map();
        this.activeDownloads = new Set();
        this.debugConfig = debugConfig || this.getDefaultDebugConfig();
        this.stealthConfig = stealthConfig || this.getDefaultStealthConfig();
        this.cryptoEngine = new AdvancedCryptoEngine(debugConfig);
        this.log('AdvancedStreamingEngine initialized', 'INFO');
    }
    async processHLSPlaylist(playlistUrl) {
        try {
            this.log(`Processing HLS playlist: ${playlistUrl}`, 'INFO');
            const playlist = await this.fetchPlaylist(playlistUrl);
            const isMainPlaylist = this.isMainPlaylist(playlist);
            if (isMainPlaylist) {
                return await this.processMainHLSPlaylist(playlistUrl, playlist);
            }
            else {
                return await this.processMediaPlaylist(playlistUrl, playlist);
            }
        }
        catch (error) {
            this.log(`HLS processing failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async processDASHManifest(manifestUrl) {
        try {
            this.log(`Processing DASH manifest: ${manifestUrl}`, 'INFO');
            const manifestXML = await this.fetchManifest(manifestUrl);
            const representations = await this.parseDASHManifest(manifestXML, manifestUrl);
            const sources = [];
            for (const representation of representations) {
                const mediaSource = {
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
        }
        catch (error) {
            this.log(`DASH processing failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async downloadStream(source, filename, onProgress) {
        const downloadId = this.generateDownloadId();
        const progress = {
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
            const segmentBlobs = await this.downloadSegments(source.segments, downloadId, onProgress);
            const decryptedBlobs = await this.decryptSegments(segmentBlobs, source.segments, downloadId, onProgress);
            progress.status = DownloadStatus.MERGING;
            onProgress?.(progress);
            const finalBlob = await this.mergeSegments(decryptedBlobs, source.format);
            progress.status = DownloadStatus.COMPLETED;
            progress.progress = 100;
            onProgress?.(progress);
            this.log(`Stream download completed: ${filename}`, 'INFO');
            return finalBlob;
        }
        catch (error) {
            progress.status = DownloadStatus.FAILED;
            progress.error = error.message;
            onProgress?.(progress);
            this.log(`Stream download failed: ${error}`, 'ERROR');
            throw error;
        }
        finally {
            this.activeDownloads.delete(downloadId);
            this.downloadQueue.delete(downloadId);
        }
    }
    async downloadSegments(segments, downloadId, onProgress) {
        const maxConcurrent = this.stealthConfig.maxConcurrentRequests;
        const segmentBlobs = new Array(segments.length);
        let completedCount = 0;
        const startTime = Date.now();
        this.log(`Downloading ${segments.length} segments with ${maxConcurrent} concurrent connections`, 'DEBUG');
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
                }
                else {
                    this.log(`Segment ${segmentIndex} download failed: ${result.reason}`, 'ERROR');
                    throw new Error(`Failed to download segment ${segmentIndex}: ${result.reason}`);
                }
            });
            const progress = this.downloadQueue.get(downloadId);
            if (progress && onProgress) {
                progress.progress = Math.round((completedCount / segments.length) * 80);
                const elapsed = Date.now() - startTime;
                const rate = completedCount / (elapsed / 1000);
                progress.speed = rate;
                progress.eta = (segments.length - completedCount) / rate;
                onProgress(progress);
            }
            if (i + maxConcurrent < segments.length) {
                await this.randomDelay();
            }
        }
        return segmentBlobs;
    }
    async downloadSegmentWithRetry(segment, index, maxRetries = 3) {
        let lastError = null;
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
            }
            catch (error) {
                lastError = error;
                this.log(`Segment ${index} download attempt ${attempt} failed: ${error}`, 'WARN');
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error(`Failed to download segment ${index} after ${maxRetries} attempts`);
    }
    async decryptSegments(segmentBlobs, segments, downloadId, onProgress) {
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
        const decryptedBlobs = [...segmentBlobs];
        let decryptedCount = 0;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (segment.encrypted && segment.key) {
                try {
                    decryptedBlobs[i] = await this.cryptoEngine.decryptSegment(segment, segmentBlobs[i]);
                    decryptedCount++;
                    if (progress && onProgress) {
                        progress.progress = 80 + Math.round((decryptedCount / encryptedSegments.length) * 15);
                        onProgress(progress);
                    }
                }
                catch (error) {
                    this.log(`Failed to decrypt segment ${i}: ${error}`, 'ERROR');
                }
            }
        }
        this.log(`Successfully decrypted ${decryptedCount}/${encryptedSegments.length} segments`, 'INFO');
        return decryptedBlobs;
    }
    async mergeSegments(segments, format) {
        this.log(`Merging ${segments.length} segments into ${format} format`, 'INFO');
        const totalSize = segments.reduce((sum, segment) => sum + segment.byteLength, 0);
        this.log(`Total merged size: ${this.formatBytes(totalSize)}`, 'DEBUG');
        const mimeType = this.getMimeTypeForFormat(format);
        const finalBlob = new Blob(segments, { type: mimeType });
        this.log(`Successfully merged segments into ${mimeType} blob`, 'INFO');
        return finalBlob;
    }
    async processMainHLSPlaylist(playlistUrl, playlist) {
        const lines = playlist.split('\n');
        const streams = [];
        let currentStreamInfo = {};
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                currentStreamInfo = this.parseStreamInf(line);
            }
            else if (line && !line.startsWith('#') && currentStreamInfo.BANDWIDTH) {
                const streamUrl = this.resolveUrl(line, playlistUrl);
                try {
                    const streamPlaylist = await this.fetchPlaylist(streamUrl);
                    const mediaPlaylist = await this.parseMediaPlaylist(streamUrl, streamPlaylist);
                    mediaPlaylist.quality = this.extractQualityFromStreamInf(currentStreamInfo);
                    mediaPlaylist.bandwidth = parseInt(currentStreamInfo.BANDWIDTH);
                    streams.push(mediaPlaylist);
                }
                catch (error) {
                    this.log(`Failed to process stream: ${streamUrl}: ${error}`, 'WARN');
                }
                currentStreamInfo = {};
            }
        }
        const sources = streams.map(stream => ({
            url: stream.url,
            type: stream.type === 'video' ? MediaType.VIDEO : MediaType.AUDIO,
            format: 'hls',
            quality: stream.quality,
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
    async processMediaPlaylist(playlistUrl, playlist) {
        const mediaPlaylist = await this.parseMediaPlaylist(playlistUrl, playlist);
        const source = {
            url: playlistUrl,
            type: MediaType.VIDEO,
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
    async parseMediaPlaylist(playlistUrl, playlist) {
        const lines = playlist.split('\n');
        const segments = [];
        const keys = [];
        let currentKey;
        let segmentDuration = 0;
        let sequence = 0;
        let totalDuration = 0;
        let isLive = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-KEY:')) {
                const key = this.cryptoEngine.extractKeysFromM3U8(line)[0];
                if (key) {
                    currentKey = key;
                    keys.push(key);
                }
            }
            else if (line.startsWith('#EXTINF:')) {
                const durationMatch = line.match(/#EXTINF:([\d.]+)/);
                if (durationMatch) {
                    segmentDuration = parseFloat(durationMatch[1]);
                }
            }
            else if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
                isLive = !line.includes('VOD');
            }
            else if (line && !line.startsWith('#')) {
                const segmentUrl = this.resolveUrl(line, playlistUrl);
                const segment = {
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
            type: 'video'
        };
    }
    async parseDASHManifest(manifestXML, baseUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(manifestXML, 'text/xml');
        const representations = [];
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
    async parseDASHRepresentation(element, baseUrl, doc) {
        try {
            const id = element.getAttribute('id') || '';
            const bandwidth = parseInt(element.getAttribute('bandwidth') || '0');
            const width = element.getAttribute('width') ? parseInt(element.getAttribute('width')) : undefined;
            const height = element.getAttribute('height') ? parseInt(element.getAttribute('height')) : undefined;
            const frameRate = element.getAttribute('frameRate') || undefined;
            const codecs = element.getAttribute('codecs') || '';
            const mimeType = element.getAttribute('mimeType') || '';
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
        }
        catch (error) {
            this.log(`Failed to parse DASH representation: ${error}`, 'ERROR');
            return null;
        }
    }
    async parseDASHSegments(representation, baseUrl, doc) {
        const segments = [];
        const segmentTemplate = representation.querySelector('SegmentTemplate') ||
            representation.parentElement?.querySelector('SegmentTemplate');
        if (segmentTemplate) {
            return this.parseSegmentTemplate(segmentTemplate, baseUrl);
        }
        const segmentList = representation.querySelector('SegmentList') ||
            representation.parentElement?.querySelector('SegmentList');
        if (segmentList) {
            return this.parseSegmentList(segmentList, baseUrl);
        }
        return segments;
    }
    parseSegmentTemplate(template, baseUrl) {
        const segments = [];
        const media = template.getAttribute('media') || '';
        const duration = parseFloat(template.getAttribute('duration') || '0');
        const startNumber = parseInt(template.getAttribute('startNumber') || '1');
        return segments;
    }
    parseSegmentList(segmentList, baseUrl) {
        const segments = [];
        const segmentUrls = segmentList.querySelectorAll('SegmentURL');
        segmentUrls.forEach((segmentUrl, index) => {
            const media = segmentUrl.getAttribute('media') || '';
            const url = this.resolveUrl(media, baseUrl);
            segments.push({
                url,
                duration: 0,
                sequence: index
            });
        });
        return segments;
    }
    async fetchPlaylist(url) {
        const response = await fetch(url, {
            headers: this.getStealthHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
        }
        return await response.text();
    }
    async fetchManifest(url) {
        return this.fetchPlaylist(url);
    }
    isMainPlaylist(playlist) {
        return playlist.includes('#EXT-X-STREAM-INF:');
    }
    parseStreamInf(line) {
        const params = {};
        const regex = /([A-Z-]+)=([^,]+)/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            params[match[1]] = match[2];
        }
        return params;
    }
    extractQualityFromStreamInf(streamInfo) {
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
    resolveUrl(url, baseUrl) {
        try {
            return new URL(url, baseUrl).href;
        }
        catch {
            return url;
        }
    }
    getDASHMediaType(mimeType) {
        if (mimeType.startsWith('video/'))
            return MediaType.VIDEO;
        if (mimeType.startsWith('audio/'))
            return MediaType.AUDIO;
        return MediaType.UNKNOWN;
    }
    detectPlatform(url) {
        return Platform.GENERIC;
    }
    getMimeTypeForFormat(format) {
        const mimeTypes = {
            'hls': 'video/mp2t',
            'dash': 'video/mp4',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ts': 'video/mp2t'
        };
        return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
    }
    getStealthHeaders() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        const headers = {
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
    async randomDelay() {
        if (!this.stealthConfig.randomizeRequestTiming)
            return;
        const min = this.stealthConfig.requestDelay.min;
        const max = this.stealthConfig.requestDelay.max;
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    generateDownloadId() {
        return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    getDefaultDebugConfig() {
        return {
            enabled: false,
            level: 'INFO',
            logNetworkRequests: false,
            logDetectionResults: false,
            logCryptoOperations: false,
            saveToFile: false
        };
    }
    getDefaultStealthConfig() {
        return {
            randomizeUserAgent: true,
            randomizeRequestTiming: true,
            mimicBrowserBehavior: true,
            avoidDetection: true,
            maxConcurrentRequests: 3,
            requestDelay: { min: 200, max: 800 }
        };
    }
    log(message, level) {
        if (!this.debugConfig.enabled)
            return;
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
