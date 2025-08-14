import { DetectionMethod, MediaType, Platform } from '../types/index.js';
export class AdvancedVideoDetectionEngine {
    constructor(debugConfig, stealthConfig) {
        this.extractors = new Map();
        this.patterns = [];
        this.networkRequests = [];
        this.isRunning = false;
        this.detectionResults = [];
        this.observers = [];
        this.interceptorActive = false;
        this.debugConfig = debugConfig || this.getDefaultDebugConfig();
        this.stealthConfig = stealthConfig || this.getDefaultStealthConfig();
        this.initializePatterns();
        this.log('AdvancedVideoDetectionEngine initialized', 'INFO');
    }
    async initialize() {
        try {
            this.log('Starting Advanced Video Detection Engine...', 'INFO');
            await this.setupNetworkInterception();
            this.setupDOMObservers();
            this.setupWebSocketInterception();
            this.initializeExtractors();
            this.isRunning = true;
            this.log('Advanced Video Detection Engine started successfully', 'INFO');
            this.startDetectionLoop();
        }
        catch (error) {
            this.log(`Failed to initialize engine: ${error}`, 'ERROR');
            throw error;
        }
    }
    shutdown() {
        this.log('Shutting down Advanced Video Detection Engine...', 'INFO');
        this.isRunning = false;
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        if (this.interceptorActive) {
            this.stopNetworkInterception();
        }
        this.log('Advanced Video Detection Engine shut down', 'INFO');
    }
    registerExtractor(extractor) {
        this.extractors.set(extractor.id, extractor);
        this.log(`Registered extractor: ${extractor.name}`, 'INFO');
    }
    async detectMedia() {
        const results = [];
        try {
            const detectionPromises = [
                this.detectFromDOM(),
                this.detectFromNetworkRequests(),
                this.detectFromShadowDOM(),
                this.detectFromJavaScriptContext(),
                this.detectFromWebSockets(),
                this.detectWithExtractors()
            ];
            const detectionResults = await Promise.allSettled(detectionPromises);
            detectionResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.length > 0) {
                    results.push(...result.value);
                    this.log(`Detection method ${index} found ${result.value.length} sources`, 'DEBUG');
                }
                else if (result.status === 'rejected') {
                    this.log(`Detection method ${index} failed: ${result.reason}`, 'WARN');
                }
            });
            const uniqueResults = this.deduplicateResults(results);
            const rankedResults = this.rankResults(uniqueResults);
            this.detectionResults = rankedResults;
            this.log(`Total unique media sources detected: ${rankedResults.length}`, 'INFO');
            return rankedResults;
        }
        catch (error) {
            this.log(`Error during media detection: ${error}`, 'ERROR');
            return [];
        }
    }
    async detectFromDOM() {
        const results = [];
        const startTime = performance.now();
        try {
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
                const sources = this.extractVideoSources(video);
                if (sources.length > 0) {
                    results.push({
                        sources,
                        platform: this.detectPlatform(window.location.href),
                        detectionMethod: DetectionMethod.DOM_SCAN,
                        confidence: 0.9,
                        timestamp: new Date()
                    });
                }
            });
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                const sources = this.extractAudioSources(audio);
                if (sources.length > 0) {
                    results.push({
                        sources,
                        platform: this.detectPlatform(window.location.href),
                        detectionMethod: DetectionMethod.DOM_SCAN,
                        confidence: 0.8,
                        timestamp: new Date()
                    });
                }
            });
            const blobElements = document.querySelectorAll('[src*="blob:"], [href*="blob:"], [src*="data:"], [href*="data:"]');
            blobElements.forEach(element => {
                const url = element.getAttribute('src') || element.getAttribute('href');
                if (url && this.isMediaURL(url)) {
                    const source = this.createMediaSource(url, element);
                    results.push({
                        sources: [source],
                        platform: this.detectPlatform(window.location.href),
                        detectionMethod: DetectionMethod.DOM_SCAN,
                        confidence: 0.7,
                        timestamp: new Date()
                    });
                }
            });
            const scriptElements = document.querySelectorAll('script');
            for (const script of Array.from(scriptElements)) {
                if (script.textContent) {
                    const hiddenSources = await this.extractHiddenMediaURLs(script.textContent);
                    if (hiddenSources.length > 0) {
                        results.push({
                            sources: hiddenSources,
                            platform: this.detectPlatform(window.location.href),
                            detectionMethod: DetectionMethod.PATTERN_MATCH,
                            confidence: 0.6,
                            timestamp: new Date()
                        });
                    }
                }
            }
            const detectionTime = performance.now() - startTime;
            this.log(`DOM detection completed in ${detectionTime.toFixed(2)}ms, found ${results.length} results`, 'DEBUG');
        }
        catch (error) {
            this.log(`DOM detection error: ${error}`, 'ERROR');
        }
        return results;
    }
    async detectFromNetworkRequests() {
        const results = [];
        try {
            const mediaRequests = this.networkRequests.filter(request => this.isMediaRequest(request));
            for (const request of mediaRequests) {
                const source = await this.processNetworkRequest(request);
                if (source) {
                    results.push({
                        sources: [source],
                        platform: this.detectPlatform(request.url),
                        detectionMethod: DetectionMethod.NETWORK_INTERCEPT,
                        confidence: 0.95,
                        timestamp: new Date()
                    });
                }
            }
            this.log(`Network detection found ${results.length} media sources`, 'DEBUG');
        }
        catch (error) {
            this.log(`Network detection error: ${error}`, 'ERROR');
        }
        return results;
    }
    async detectFromShadowDOM() {
        const results = [];
        try {
            const shadowHosts = this.findShadowRoots(document.body);
            for (const shadowRoot of shadowHosts) {
                const shadowResults = await this.scanShadowRoot(shadowRoot);
                results.push(...shadowResults);
            }
            this.log(`Shadow DOM detection found ${results.length} sources`, 'DEBUG');
        }
        catch (error) {
            this.log(`Shadow DOM detection error: ${error}`, 'ERROR');
        }
        return results;
    }
    async detectFromJavaScriptContext() {
        const results = [];
        try {
            const globalMediaSources = this.extractFromGlobalContext();
            results.push(...globalMediaSources);
            this.hookMediaLibraries();
            this.log(`JavaScript context detection found ${results.length} sources`, 'DEBUG');
        }
        catch (error) {
            this.log(`JavaScript context detection error: ${error}`, 'ERROR');
        }
        return results;
    }
    async detectFromWebSockets() {
        const results = [];
        try {
            this.log(`WebSocket detection found ${results.length} sources`, 'DEBUG');
        }
        catch (error) {
            this.log(`WebSocket detection error: ${error}`, 'ERROR');
        }
        return results;
    }
    async detectWithExtractors() {
        const results = [];
        const currentUrl = window.location.href;
        try {
            const sortedExtractors = Array.from(this.extractors.values())
                .sort((a, b) => b.priority - a.priority);
            for (const extractor of sortedExtractors) {
                if (extractor.canExtract(currentUrl)) {
                    try {
                        const result = await extractor.extract(currentUrl);
                        if (result && result.sources.length > 0) {
                            results.push(result);
                            this.log(`Extractor ${extractor.name} found ${result.sources.length} sources`, 'DEBUG');
                        }
                    }
                    catch (error) {
                        this.log(`Extractor ${extractor.name} failed: ${error}`, 'WARN');
                    }
                }
            }
            this.log(`Extractor-based detection found ${results.length} total results`, 'DEBUG');
        }
        catch (error) {
            this.log(`Extractor detection error: ${error}`, 'ERROR');
        }
        return results;
    }
    async setupNetworkInterception() {
        try {
            this.interceptFetch();
            this.interceptXHR();
            if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
                await this.setupDeclarativeNetRequest();
            }
            this.interceptorActive = true;
            this.log('Network interception setup completed', 'DEBUG');
        }
        catch (error) {
            this.log(`Network interception setup failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    setupDOMObservers() {
        try {
            const mainObserver = new MutationObserver((mutations) => {
                this.handleDOMMutations(mutations);
            });
            mainObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'href', 'data-src', 'data-video-src']
            });
            this.observers.push(mainObserver);
            this.setupShadowDOMObservers();
            this.log('DOM observers setup completed', 'DEBUG');
        }
        catch (error) {
            this.log(`DOM observer setup failed: ${error}`, 'ERROR');
        }
    }
    initializePatterns() {
        this.patterns = [
            { pattern: /\.mp4(\?.*)?$/i, type: MediaType.VIDEO, priority: 10 },
            { pattern: /\.webm(\?.*)?$/i, type: MediaType.VIDEO, priority: 10 },
            { pattern: /\.mkv(\?.*)?$/i, type: MediaType.VIDEO, priority: 9 },
            { pattern: /\.avi(\?.*)?$/i, type: MediaType.VIDEO, priority: 9 },
            { pattern: /\.mov(\?.*)?$/i, type: MediaType.VIDEO, priority: 9 },
            { pattern: /\.mp3(\?.*)?$/i, type: MediaType.AUDIO, priority: 10 },
            { pattern: /\.wav(\?.*)?$/i, type: MediaType.AUDIO, priority: 9 },
            { pattern: /\.ogg(\?.*)?$/i, type: MediaType.AUDIO, priority: 9 },
            { pattern: /\.flac(\?.*)?$/i, type: MediaType.AUDIO, priority: 9 },
            { pattern: /\.m3u8(\?.*)?$/i, type: MediaType.LIVE_STREAM, priority: 15 },
            { pattern: /\.mpd(\?.*)?$/i, type: MediaType.LIVE_STREAM, priority: 15 },
            { pattern: /\/playlist\.m3u8/i, type: MediaType.LIVE_STREAM, priority: 15 },
            { pattern: /^blob:/i, type: MediaType.VIDEO, priority: 12 },
            { pattern: /^data:video/i, type: MediaType.VIDEO, priority: 11 },
            { pattern: /^data:audio/i, type: MediaType.AUDIO, priority: 11 },
            { pattern: /youtube\.com.*\/watch/i, type: MediaType.VIDEO, priority: 20, extractor: 'youtube' },
            { pattern: /youtu\.be\//i, type: MediaType.VIDEO, priority: 20, extractor: 'youtube' },
            { pattern: /facebook\.com.*\/videos/i, type: MediaType.VIDEO, priority: 18, extractor: 'facebook' },
            { pattern: /tiktok\.com.*\/video/i, type: MediaType.VIDEO, priority: 18, extractor: 'tiktok' },
            { pattern: /instagram\.com.*\/p\//i, type: MediaType.VIDEO, priority: 17, extractor: 'instagram' },
            { pattern: /twitter\.com.*\/status/i, type: MediaType.VIDEO, priority: 17, extractor: 'twitter' },
            { pattern: /twitch\.tv\//i, type: MediaType.LIVE_STREAM, priority: 19, extractor: 'twitch' }
        ];
        this.log(`Initialized ${this.patterns.length} detection patterns`, 'DEBUG');
    }
    extractVideoSources(video) {
        const sources = [];
        if (video.src) {
            sources.push(this.createMediaSource(video.src, video));
        }
        const sourceElements = video.querySelectorAll('source');
        sourceElements.forEach(source => {
            if (source.src) {
                sources.push(this.createMediaSource(source.src, source));
            }
        });
        return sources;
    }
    extractAudioSources(audio) {
        const sources = [];
        if (audio.src) {
            sources.push(this.createMediaSource(audio.src, audio));
        }
        const sourceElements = audio.querySelectorAll('source');
        sourceElements.forEach(source => {
            if (source.src) {
                sources.push(this.createMediaSource(source.src, source));
            }
        });
        return sources;
    }
    createMediaSource(url, element) {
        const mediaType = this.detectMediaType(url);
        const format = this.extractFormat(url);
        return {
            url,
            type: mediaType,
            format,
            metadata: {
                title: element?.getAttribute('title') || element?.getAttribute('alt') || undefined
            }
        };
    }
    async extractHiddenMediaURLs(content) {
        const sources = [];
        try {
            const urlPatterns = [
                /"(https?:\/\/[^"]*\.(?:mp4|webm|m3u8|mpd)[^"]*)"/gi,
                /'(https?:\/\/[^']*\.(?:mp4|webm|m3u8|mpd)[^']*)'/gi,
                /url:\s*["']([^"']*\.(?:mp4|webm|m3u8|mpd)[^"']*)/gi,
                /src:\s*["']([^"']*\.(?:mp4|webm|m3u8|mpd)[^"']*)/gi
            ];
            for (const pattern of urlPatterns) {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const url = match[1];
                    if (this.isValidMediaURL(url)) {
                        sources.push(this.createMediaSource(url));
                    }
                }
            }
            try {
                const parsed = JSON.parse(content);
                const jsonSources = this.extractMediaFromJSON(parsed);
                sources.push(...jsonSources);
            }
            catch {
            }
        }
        catch (error) {
            this.log(`Error extracting hidden URLs: ${error}`, 'WARN');
        }
        return sources;
    }
    extractMediaFromJSON(obj, depth = 0) {
        if (depth > 10)
            return [];
        const sources = [];
        if (typeof obj === 'string' && this.isValidMediaURL(obj)) {
            sources.push(this.createMediaSource(obj));
        }
        else if (Array.isArray(obj)) {
            for (const item of obj) {
                sources.push(...this.extractMediaFromJSON(item, depth + 1));
            }
        }
        else if (typeof obj === 'object' && obj !== null) {
            for (const key of Object.keys(obj)) {
                if (key.toLowerCase().includes('url') || key.toLowerCase().includes('src')) {
                    sources.push(...this.extractMediaFromJSON(obj[key], depth + 1));
                }
            }
        }
        return sources;
    }
    isMediaURL(url) {
        if (!url)
            return false;
        return this.patterns.some(pattern => pattern.pattern.test(url));
    }
    isValidMediaURL(url) {
        try {
            new URL(url);
            return this.isMediaURL(url);
        }
        catch {
            return false;
        }
    }
    detectMediaType(url) {
        const pattern = this.patterns.find(p => p.pattern.test(url));
        return pattern?.type || MediaType.UNKNOWN;
    }
    extractFormat(url) {
        const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return match ? match[1].toLowerCase() : 'unknown';
    }
    detectPlatform(url) {
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
        if (url.includes('vimeo.com'))
            return Platform.VIMEO;
        if (url.includes('dailymotion.com'))
            return Platform.DAILYMOTION;
        return Platform.GENERIC;
    }
    getDefaultDebugConfig() {
        return {
            enabled: false,
            level: 'INFO',
            logNetworkRequests: false,
            logDetectionResults: true,
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
            maxConcurrentRequests: 4,
            requestDelay: { min: 100, max: 500 }
        };
    }
    log(message, level) {
        if (!this.debugConfig.enabled)
            return;
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${String(level)}] PegaTudo: ${message}`;
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
    async setupDeclarativeNetRequest() {
    }
    interceptFetch() {
    }
    interceptXHR() {
    }
    setupWebSocketInterception() {
    }
    initializeExtractors() {
    }
    startDetectionLoop() {
    }
    stopNetworkInterception() {
    }
    handleDOMMutations(mutations) {
    }
    setupShadowDOMObservers() {
    }
    findShadowRoots(element) {
        return [];
    }
    async scanShadowRoot(shadowRoot) {
        return [];
    }
    extractFromGlobalContext() {
        return [];
    }
    hookMediaLibraries() {
    }
    isMediaRequest(request) {
        return false;
    }
    async processNetworkRequest(request) {
        return null;
    }
    deduplicateResults(results) {
        return results;
    }
    rankResults(results) {
        return results.sort((a, b) => b.confidence - a.confidence);
    }
}
