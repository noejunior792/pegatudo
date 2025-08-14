import { AdvancedVideoDetectionEngine } from './core/detection-engine.js';
import { AdvancedCryptoEngine } from './crypto/crypto-engine.js';
import { AdvancedStreamingEngine } from './core/streaming-engine.js';
import { AdvancedNetworkInterceptor } from './network/network-interceptor.js';
import { AdvancedUIManager } from './ui/advanced-ui-manager.js';
import { YouTubeExtractor } from './extractors/youtube.js';
import { FacebookExtractor } from './extractors/facebook.js';
import { TikTokExtractor } from './extractors/tiktok.js';
import { DownloadStatus, Platform } from './types/index.js';
export class PegaTudoAdvancedEngine {
    constructor() {
        this.isInitialized = false;
        this.isEnabled = true;
        this.currentDetectionResults = [];
        this.activeDownloads = new Map();
        this.debugConfig = this.loadDebugConfig();
        this.stealthConfig = this.loadStealthConfig();
        this.log('PegaTudo Advanced Engine initializing...', 'INFO');
        this.detectionEngine = new AdvancedVideoDetectionEngine(this.debugConfig, this.stealthConfig);
        this.cryptoEngine = new AdvancedCryptoEngine(this.debugConfig);
        this.streamingEngine = new AdvancedStreamingEngine(this.debugConfig, this.stealthConfig);
        this.networkInterceptor = new AdvancedNetworkInterceptor(this.debugConfig, this.stealthConfig);
        this.uiManager = new AdvancedUIManager(this.debugConfig);
        this.setupEventListeners();
        this.registerExtractors();
    }
    async initialize() {
        if (this.isInitialized) {
            this.log('Engine already initialized', 'WARN');
            return;
        }
        try {
            this.log('Starting engine initialization...', 'INFO');
            await this.loadUserPreferences();
            if (!this.isEnabled) {
                this.log('Engine disabled by user preferences', 'INFO');
                return;
            }
            await this.detectionEngine.initialize();
            this.networkInterceptor.start();
            this.startDetectionLoop();
            this.setupPageHandlers();
            this.isInitialized = true;
            this.log('Engine initialization completed', 'INFO');
            this.notifyEngineStatus('initialized');
        }
        catch (error) {
            this.log(`Engine initialization failed: ${error}`, 'ERROR');
            this.notifyEngineStatus('error', error.message);
            throw error;
        }
    }
    shutdown() {
        this.log('Shutting down engine...', 'INFO');
        this.detectionEngine.shutdown();
        this.networkInterceptor.stop();
        this.uiManager.hide();
        this.isInitialized = false;
        this.log('Engine shutdown completed', 'INFO');
    }
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (enabled && !this.isInitialized) {
            this.initialize();
        }
        else if (!enabled && this.isInitialized) {
            this.shutdown();
        }
        this.log(`Engine ${enabled ? 'enabled' : 'disabled'}`, 'INFO');
    }
    async detectMedia() {
        if (!this.isInitialized) {
            throw new Error('Engine not initialized');
        }
        try {
            this.log('Manual media detection triggered', 'DEBUG');
            const results = await this.detectionEngine.detectMedia();
            this.currentDetectionResults = results;
            if (results.length > 0) {
                this.showDetectionResults(results);
            }
            return results;
        }
        catch (error) {
            this.log(`Manual detection failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    showDetectionResults(results) {
        const allSources = [];
        results.forEach(result => {
            allSources.push(...result.sources);
        });
        const uniqueSources = this.deduplicateSources(allSources);
        const sortedSources = this.sortSourcesByQuality(uniqueSources);
        this.log(`Showing ${sortedSources.length} unique media sources`, 'DEBUG');
        this.uiManager.show(sortedSources);
    }
    setupEventListeners() {
        window.addEventListener('pegaTudoStartDownloads', async (event) => {
            const { selections, options } = event.detail;
            await this.handleDownloadRequest(selections, options);
        });
        window.addEventListener('pegaTudoMediaDiscovered', (event) => {
            this.handleMediaDiscovered(event.detail);
        });
        window.addEventListener('pegaTudoConfigChanged', (event) => {
            this.handleConfigChanged(event.detail);
        });
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleChromeMessage(message, sender, sendResponse);
            });
        }
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }
    registerExtractors() {
        this.detectionEngine.registerExtractor(new YouTubeExtractor(this.debugConfig));
        this.detectionEngine.registerExtractor(new FacebookExtractor(this.debugConfig));
        this.detectionEngine.registerExtractor(new TikTokExtractor(this.debugConfig));
        this.log('Platform extractors registered', 'DEBUG');
    }
    startDetectionLoop() {
        const detectAndShow = async () => {
            if (!this.isInitialized || !this.isEnabled)
                return;
            try {
                const results = await this.detectionEngine.detectMedia();
                if (results.length > 0) {
                    this.currentDetectionResults = results;
                    if (this.shouldAutoShowUI(results)) {
                        this.showDetectionResults(results);
                    }
                }
            }
            catch (error) {
                this.log(`Detection loop error: ${error}`, 'ERROR');
            }
        };
        setTimeout(detectAndShow, 2000);
        setInterval(detectAndShow, 10000);
        this.log('Detection loop started', 'DEBUG');
    }
    setupPageHandlers() {
        const url = window.location.href;
        const platform = this.detectCurrentPlatform(url);
        switch (platform) {
            case Platform.YOUTUBE:
                this.setupYouTubeHandlers();
                break;
            case Platform.FACEBOOK:
                this.setupFacebookHandlers();
                break;
            case Platform.TIKTOK:
                this.setupTikTokHandlers();
                break;
            default:
                this.setupGenericHandlers();
                break;
        }
        this.log(`Page handlers setup for platform: ${platform}`, 'DEBUG');
    }
    async handleDownloadRequest(selections, options) {
        this.log(`Processing download request for ${selections.length} items`, 'INFO');
        try {
            const concurrentLimit = options.concurrentDownloads || 2;
            const batches = this.createDownloadBatches(selections, concurrentLimit);
            for (const batch of batches) {
                const batchPromises = batch.map(selection => this.downloadMediaSource(selection.source, selection, options));
                await Promise.allSettled(batchPromises);
            }
            this.log('All downloads completed', 'INFO');
        }
        catch (error) {
            this.log(`Download processing failed: ${error}`, 'ERROR');
            this.uiManager.showError(`Download failed: ${error.message}`);
        }
    }
    async downloadMediaSource(source, selection, options) {
        const downloadId = this.generateDownloadId();
        const filename = this.generateFilename(source, selection, options);
        const progress = {
            downloadId,
            filename,
            progress: 0,
            speed: 0,
            eta: 0,
            status: DownloadStatus.PENDING
        };
        this.activeDownloads.set(downloadId, progress);
        this.uiManager.updateProgress(progress);
        try {
            this.log(`Starting download: ${filename}`, 'DEBUG');
            if (source.segments && source.segments.length > 0) {
                await this.downloadStreamingMedia(source, filename, progress);
            }
            else {
                await this.downloadDirectMedia(source, filename, progress);
            }
            progress.status = DownloadStatus.COMPLETED;
            progress.progress = 100;
            this.uiManager.updateProgress(progress);
            this.log(`Download completed: ${filename}`, 'INFO');
        }
        catch (error) {
            progress.status = DownloadStatus.FAILED;
            progress.error = error.message;
            this.uiManager.updateProgress(progress);
            this.log(`Download failed: ${filename} - ${error}`, 'ERROR');
            if (options.autoRetry) {
                this.log(`Retrying download: ${filename}`, 'INFO');
                setTimeout(() => {
                    this.downloadMediaSource(source, selection, options);
                }, 5000);
            }
        }
        finally {
            this.activeDownloads.delete(downloadId);
        }
    }
    async downloadStreamingMedia(source, filename, progress) {
        const onProgress = (streamProgress) => {
            progress.progress = streamProgress.progress;
            progress.speed = streamProgress.speed;
            progress.eta = streamProgress.eta;
            progress.status = streamProgress.status;
            this.uiManager.updateProgress(progress);
        };
        const blob = await this.streamingEngine.downloadStream(source, filename, onProgress);
        await this.saveBlobToFile(blob, filename);
    }
    async downloadDirectMedia(source, filename, progress) {
        progress.status = DownloadStatus.DOWNLOADING;
        this.uiManager.updateProgress(progress);
        const response = await fetch(source.url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Failed to get response reader');
        }
        const chunks = [];
        let receivedLength = 0;
        const startTime = Date.now();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            chunks.push(value);
            receivedLength += value.length;
            if (contentLength > 0) {
                progress.progress = Math.round((receivedLength / contentLength) * 100);
                const elapsed = (Date.now() - startTime) / 1000;
                progress.speed = receivedLength / elapsed;
                progress.eta = contentLength > receivedLength ?
                    (contentLength - receivedLength) / progress.speed : 0;
                this.uiManager.updateProgress(progress);
            }
        }
        const blob = new Blob(chunks);
        await this.saveBlobToFile(blob, filename);
    }
    async saveBlobToFile(blob, filename) {
        if (typeof chrome !== 'undefined' && chrome.downloads) {
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url,
                filename,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                URL.revokeObjectURL(url);
                if (chrome.runtime.lastError) {
                    throw new Error(chrome.runtime.lastError.message);
                }
            });
        }
        else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
    handleMediaDiscovered(detail) {
        this.log(`Media discovered: ${detail.url}`, 'DEBUG');
        if (this.isInitialized) {
            setTimeout(() => this.detectMedia(), 1000);
        }
    }
    handleConfigChanged(detail) {
        this.log('Configuration changed', 'DEBUG');
        if (detail.debugConfig) {
            this.debugConfig = { ...this.debugConfig, ...detail.debugConfig };
        }
        if (detail.stealthConfig) {
            this.stealthConfig = { ...this.stealthConfig, ...detail.stealthConfig };
        }
        if (detail.enabled !== undefined) {
            this.setEnabled(detail.enabled);
        }
    }
    handleChromeMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'detectMedia':
                this.detectMedia().then(sendResponse);
                break;
            case 'getStatus':
                sendResponse({
                    initialized: this.isInitialized,
                    enabled: this.isEnabled,
                    activeDownloads: this.activeDownloads.size,
                    detectedSources: this.currentDetectionResults.length
                });
                break;
            case 'toggleEngine':
                this.setEnabled(message.enabled);
                sendResponse({ success: true });
                break;
            case 'updateConfig':
                this.handleConfigChanged(message.config);
                sendResponse({ success: true });
                break;
        }
    }
    handleKeyboardShortcuts(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'P') {
            event.preventDefault();
            this.detectMedia();
        }
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault();
            this.quickDownloadBest();
        }
    }
    handleVisibilityChange() {
        if (document.hidden) {
            this.log('Page hidden, reducing detection frequency', 'DEBUG');
        }
        else {
            this.log('Page visible, resuming normal detection', 'DEBUG');
            setTimeout(() => this.detectMedia(), 1000);
        }
    }
    setupYouTubeHandlers() {
        this.log('YouTube handlers setup', 'DEBUG');
    }
    setupFacebookHandlers() {
        this.log('Facebook handlers setup', 'DEBUG');
    }
    setupTikTokHandlers() {
        this.log('TikTok handlers setup', 'DEBUG');
    }
    setupGenericHandlers() {
        this.log('Generic handlers setup', 'DEBUG');
    }
    async loadUserPreferences() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.sync.get(['extensionEnabled', 'debugMode']);
            this.isEnabled = result.extensionEnabled !== false;
            if (result.debugMode) {
                this.debugConfig.enabled = true;
            }
        }
    }
    loadDebugConfig() {
        return {
            enabled: false,
            level: 'INFO',
            logNetworkRequests: false,
            logDetectionResults: true,
            logCryptoOperations: false,
            saveToFile: false
        };
    }
    loadStealthConfig() {
        return {
            randomizeUserAgent: true,
            randomizeRequestTiming: true,
            mimicBrowserBehavior: true,
            avoidDetection: true,
            maxConcurrentRequests: 3,
            requestDelay: { min: 200, max: 800 }
        };
    }
    detectCurrentPlatform(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be'))
            return Platform.YOUTUBE;
        if (url.includes('facebook.com'))
            return Platform.FACEBOOK;
        if (url.includes('tiktok.com'))
            return Platform.TIKTOK;
        if (url.includes('instagram.com'))
            return Platform.INSTAGRAM;
        if (url.includes('twitter.com'))
            return Platform.TWITTER;
        if (url.includes('twitch.tv'))
            return Platform.TWITCH;
        return Platform.GENERIC;
    }
    shouldAutoShowUI(results) {
        const totalSources = results.reduce((sum, result) => sum + result.sources.length, 0);
        return totalSources >= 2;
    }
    deduplicateSources(sources) {
        const seen = new Set();
        return sources.filter(source => {
            const key = `${source.url}:${source.format}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    sortSourcesByQuality(sources) {
        return sources.sort((a, b) => {
            const aQuality = this.getQualityScore(a);
            const bQuality = this.getQualityScore(b);
            return bQuality - aQuality;
        });
    }
    getQualityScore(source) {
        let score = 0;
        if (source.quality) {
            const quality = source.quality;
            score += (quality.width || 0) * (quality.height || 0) / 1000;
            score += (quality.bitrate || 0) / 1000;
        }
        const formatScores = {
            'mp4': 100,
            'webm': 90,
            'mov': 80,
            'avi': 70
        };
        score += formatScores[source.format] || 50;
        return score;
    }
    createDownloadBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    generateDownloadId() {
        return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateFilename(source, selection, options) {
        const pattern = options.filenamePattern || '{title}.{ext}';
        const title = source.metadata?.title || 'media';
        const ext = source.format;
        const quality = source.quality ? `${source.quality.height}p` : '';
        return pattern
            .replace('{title}', this.sanitizeFilename(title))
            .replace('{ext}', ext)
            .replace('{quality}', quality)
            .replace('{uploader}', this.sanitizeFilename(source.metadata?.uploader || ''))
            .replace('{timestamp}', new Date().toISOString().split('T')[0]);
    }
    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    }
    async quickDownloadBest() {
        const results = await this.detectMedia();
        if (results.length === 0)
            return;
        const allSources = results.flatMap(r => r.sources);
        const bestSource = this.sortSourcesByQuality(allSources)[0];
        if (bestSource) {
            await this.downloadMediaSource(bestSource, { source: bestSource, selected: true }, {
                filenamePattern: '{title}_best.{ext}',
                concurrentDownloads: 1,
                autoRetry: true
            });
        }
    }
    notifyEngineStatus(status, message) {
        const event = new CustomEvent('pegaTudoEngineStatus', {
            detail: { status, message, timestamp: new Date() }
        });
        window.dispatchEvent(event);
    }
    log(message, level) {
        if (!this.debugConfig.enabled)
            return;
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] PegaTudo: ${message}`;
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
const pegaTudoEngine = new PegaTudoAdvancedEngine();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        pegaTudoEngine.initialize().catch(console.error);
    });
}
else {
    pegaTudoEngine.initialize().catch(console.error);
}
window.pegaTudoEngine = pegaTudoEngine;
