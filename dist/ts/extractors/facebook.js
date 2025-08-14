import { DetectionMethod, Platform, MediaType } from '../types/index.js';
export class FacebookExtractor {
    constructor(debugConfig) {
        this.id = 'facebook';
        this.name = 'Facebook Video Extractor';
        this.platforms = [Platform.FACEBOOK];
        this.priority = 18;
        this.debugConfig = debugConfig || this.getDefaultDebugConfig();
        this.log('Facebook Extractor initialized', 'INFO');
    }
    canExtract(url) {
        const facebookPatterns = [
            /facebook\.com\/.*\/videos\//,
            /facebook\.com\/watch\//,
            /fb\.watch\//,
            /facebook\.com\/.*\/posts\//,
            /facebook\.com\/reel\//
        ];
        return facebookPatterns.some(pattern => pattern.test(url));
    }
    async extract(url, config) {
        try {
            this.log(`Extracting from Facebook URL: ${url}`, 'INFO');
            const videoInfo = await this.extractVideoInfo(url);
            const sources = this.convertToMediaSources(videoInfo);
            return {
                sources,
                platform: Platform.FACEBOOK,
                detectionMethod: DetectionMethod.API_EXTRACTION,
                confidence: 0.85,
                timestamp: new Date()
            };
        }
        catch (error) {
            this.log(`Facebook extraction failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async extractVideoInfo(url) {
        try {
            const domInfo = await this.extractFromDOM();
            if (domInfo) {
                this.log('Successfully extracted from DOM', 'DEBUG');
                return domInfo;
            }
        }
        catch (error) {
            this.log(`DOM extraction failed: ${error}`, 'WARN');
        }
        try {
            const networkInfo = await this.extractFromNetworkRequests();
            if (networkInfo) {
                this.log('Successfully extracted from network requests', 'DEBUG');
                return networkInfo;
            }
        }
        catch (error) {
            this.log(`Network extraction failed: ${error}`, 'WARN');
        }
        try {
            const jsonLdInfo = await this.extractFromJsonLd();
            if (jsonLdInfo) {
                this.log('Successfully extracted from JSON-LD', 'DEBUG');
                return jsonLdInfo;
            }
        }
        catch (error) {
            this.log(`JSON-LD extraction failed: ${error}`, 'WARN');
        }
        throw new Error('All Facebook extraction methods failed');
    }
    async extractFromDOM() {
        try {
            const videoElements = document.querySelectorAll('video');
            const videoSources = [];
            for (const video of videoElements) {
                if (video.src) {
                    videoSources.push({
                        url: video.src,
                        quality: 'auto',
                        width: video.videoWidth || undefined,
                        height: video.videoHeight || undefined,
                        type: 'video/mp4'
                    });
                }
                const sources = video.querySelectorAll('source');
                for (const source of sources) {
                    if (source.src) {
                        videoSources.push({
                            url: source.src,
                            quality: source.getAttribute('label') || 'auto',
                            type: source.type || 'video/mp4'
                        });
                    }
                }
            }
            const videoContainers = document.querySelectorAll('[data-video-id], [data-fbid]');
            for (const container of videoContainers) {
                const videoId = container.getAttribute('data-video-id') || container.getAttribute('data-fbid');
                if (videoId) {
                    const videoUrls = this.findVideoUrlsInContainer(container);
                    videoSources.push(...videoUrls);
                }
            }
            if (videoSources.length === 0) {
                return null;
            }
            const title = this.extractTitle();
            const description = this.extractDescription();
            const uploader = this.extractUploader();
            return {
                videoId: this.generateVideoId(),
                title,
                description,
                uploader,
                duration: 0,
                sources: videoSources,
                thumbnails: this.extractThumbnails(),
                isLive: this.detectLiveStream()
            };
        }
        catch (error) {
            this.log(`DOM extraction error: ${error}`, 'ERROR');
            return null;
        }
    }
    async extractFromNetworkRequests() {
        try {
            const windowVars = this.scanWindowForVideoUrls();
            if (windowVars.length > 0) {
                const sources = windowVars.map(url => ({
                    url,
                    quality: 'auto',
                    type: 'video/mp4'
                }));
                return {
                    videoId: this.generateVideoId(),
                    title: this.extractTitle(),
                    description: this.extractDescription(),
                    uploader: this.extractUploader(),
                    duration: 0,
                    sources,
                    thumbnails: [],
                    isLive: false
                };
            }
        }
        catch (error) {
            this.log(`Network extraction error: ${error}`, 'ERROR');
        }
        return null;
    }
    async extractFromJsonLd() {
        try {
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of jsonLdScripts) {
                try {
                    const data = JSON.parse(script.textContent || '');
                    if (data['@type'] === 'VideoObject' || data.videoObject) {
                        const videoObj = data['@type'] === 'VideoObject' ? data : data.videoObject;
                        const sources = [];
                        if (videoObj.contentUrl) {
                            sources.push({
                                url: videoObj.contentUrl,
                                quality: 'auto',
                                type: 'video/mp4'
                            });
                        }
                        if (videoObj.embedUrl) {
                            const embedSources = await this.extractFromEmbed(videoObj.embedUrl);
                            sources.push(...embedSources);
                        }
                        return {
                            videoId: videoObj.identifier || this.generateVideoId(),
                            title: videoObj.name || '',
                            description: videoObj.description || '',
                            uploader: videoObj.author?.name || '',
                            duration: this.parseDuration(videoObj.duration),
                            sources,
                            thumbnails: videoObj.thumbnailUrl ? [videoObj.thumbnailUrl] : [],
                            isLive: false
                        };
                    }
                }
                catch (parseError) {
                    this.log(`JSON-LD parse error: ${parseError}`, 'DEBUG');
                }
            }
            return null;
        }
        catch (error) {
            this.log(`JSON-LD extraction error: ${error}`, 'ERROR');
            return null;
        }
    }
    findVideoUrlsInContainer(container) {
        const sources = [];
        const content = container.innerHTML;
        const urlPatterns = [
            /https:\/\/[^"']*\.mp4[^"']*/g,
            /https:\/\/video-[^"']*\.facebook\.com[^"']*/g,
            /https:\/\/[^"']*\.fbcdn\.net[^"']*\.mp4[^"']*/g
        ];
        for (const pattern of urlPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                sources.push({
                    url: match[0],
                    quality: 'auto',
                    type: 'video/mp4'
                });
            }
        }
        return sources;
    }
    scanWindowForVideoUrls() {
        const urls = [];
        try {
            const windowStr = JSON.stringify(window);
            const urlPattern = /https:\/\/[^"']*\.mp4[^"']*/g;
            let match;
            while ((match = urlPattern.exec(windowStr)) !== null) {
                if (match[0].includes('facebook') || match[0].includes('fbcdn')) {
                    urls.push(match[0]);
                }
            }
        }
        catch (error) {
            this.log(`Window scan error: ${error}`, 'DEBUG');
        }
        return Array.from(new Set(urls));
    }
    async extractFromEmbed(embedUrl) {
        return [];
    }
    extractTitle() {
        const titleSelectors = [
            '[data-testid="post_message"] span',
            '.userContent',
            '[role="article"] [dir="auto"]',
            'h1',
            'title'
        ];
        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent?.trim()) {
                return element.textContent.trim();
            }
        }
        return document.title || 'Facebook Video';
    }
    extractDescription() {
        const descSelectors = [
            '[data-testid="post_message"]',
            '.userContent',
            '[role="article"] [dir="auto"]'
        ];
        for (const selector of descSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent?.trim()) {
                return element.textContent.trim();
            }
        }
        return '';
    }
    extractUploader() {
        const uploaderSelectors = [
            '[data-testid="story-subtitle"] a',
            '.actor a',
            '[data-hovercard-prefer-more-content-show="1"]',
            'strong a[role="link"]'
        ];
        for (const selector of uploaderSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent?.trim()) {
                return element.textContent.trim();
            }
        }
        return 'Unknown';
    }
    extractThumbnails() {
        const thumbnails = [];
        const imgElements = document.querySelectorAll('img');
        for (const img of imgElements) {
            if (img.src && (img.src.includes('fbcdn') || img.src.includes('facebook'))) {
                if (img.width && img.height && img.width > 100 && img.height > 100) {
                    thumbnails.push(img.src);
                }
            }
        }
        return Array.from(new Set(thumbnails)).slice(0, 5);
    }
    detectLiveStream() {
        const liveIndicators = [
            '[data-testid="broadcast_status"]',
            '.live-indicator',
            '[aria-label*="Live"]',
            '[aria-label*="LIVE"]'
        ];
        return liveIndicators.some(selector => document.querySelector(selector) !== null);
    }
    convertToMediaSources(videoInfo) {
        const sources = [];
        for (const source of videoInfo.sources) {
            const mediaSource = {
                url: source.url,
                type: MediaType.VIDEO,
                format: this.getFormatFromType(source.type),
                quality: source.width && source.height ? {
                    width: source.width,
                    height: source.height,
                    codec: 'h264'
                } : undefined,
                metadata: {
                    title: videoInfo.title,
                    description: videoInfo.description,
                    uploader: videoInfo.uploader,
                    duration: videoInfo.duration
                },
                extractorId: this.id
            };
            sources.push(mediaSource);
        }
        this.log(`Converted to ${sources.length} media sources`, 'DEBUG');
        return sources;
    }
    getFormatFromType(type) {
        if (type.includes('mp4'))
            return 'mp4';
        if (type.includes('webm'))
            return 'webm';
        return 'mp4';
    }
    parseDuration(duration) {
        if (!duration)
            return 0;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
        if (match) {
            const hours = parseInt(match[1] || '0');
            const minutes = parseInt(match[2] || '0');
            const seconds = parseFloat(match[3] || '0');
            return hours * 3600 + minutes * 60 + seconds;
        }
        return 0;
    }
    generateVideoId() {
        return `facebook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    log(message, level) {
        if (!this.debugConfig.enabled)
            return;
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] Facebook: ${message}`;
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
