import { DetectionMethod, Platform, MediaType } from '../types/index.js';
export class TikTokExtractor {
    constructor(debugConfig) {
        this.id = 'tiktok';
        this.name = 'TikTok Video Extractor';
        this.platforms = [Platform.TIKTOK];
        this.priority = 18;
        this.debugConfig = debugConfig || this.getDefaultDebugConfig();
        this.log('TikTok Extractor initialized', 'INFO');
    }
    canExtract(url) {
        const tiktokPatterns = [
            /tiktok\.com\/.*\/video\/\d+/,
            /tiktok\.com\/v\/\d+/,
            /tiktok\.com\/@[^\/]+\/video\/\d+/,
            /vm\.tiktok\.com\/[A-Za-z0-9]+/
        ];
        return tiktokPatterns.some(pattern => pattern.test(url));
    }
    async extract(url, config) {
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
        }
        catch (error) {
            this.log(`TikTok extraction failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async extractVideoInfo(url) {
        try {
            const nextInfo = await this.extractFromNextProps();
            if (nextInfo) {
                this.log('Successfully extracted from Next.js props', 'DEBUG');
                return nextInfo;
            }
        }
        catch (error) {
            this.log(`Next.js extraction failed: ${error}`, 'WARN');
        }
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
            const sigiInfo = await this.extractFromSIGI();
            if (sigiInfo) {
                this.log('Successfully extracted from SIGI state', 'DEBUG');
                return sigiInfo;
            }
        }
        catch (error) {
            this.log(`SIGI extraction failed: ${error}`, 'WARN');
        }
        throw new Error('All TikTok extraction methods failed');
    }
    async extractFromNextProps() {
        try {
            const nextDataScript = document.querySelector('#__NEXT_DATA__');
            if (!nextDataScript || !nextDataScript.textContent) {
                return null;
            }
            const nextData = JSON.parse(nextDataScript.textContent);
            const props = nextData?.props?.pageProps;
            if (!props)
                return null;
            const itemStruct = props.itemInfo?.itemStruct;
            if (!itemStruct)
                return null;
            const video = itemStruct.video;
            const author = itemStruct.author;
            const music = itemStruct.music;
            const stats = itemStruct.stats;
            if (!video)
                return null;
            const sources = [];
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
        }
        catch (error) {
            this.log(`Next.js props parsing error: ${error}`, 'ERROR');
            return null;
        }
    }
    async extractFromDOM() {
        try {
            const videoElements = document.querySelectorAll('video');
            const sources = [];
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
            const videoContainers = document.querySelectorAll('[data-e2e="video-player"]');
            for (const container of videoContainers) {
                const videoUrl = this.findVideoUrlInContainer(container);
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
        }
        catch (error) {
            this.log(`DOM extraction error: ${error}`, 'ERROR');
            return null;
        }
    }
    async extractFromSIGI() {
        try {
            const windowAny = window;
            if (!windowAny.SIGI_STATE) {
                return null;
            }
            const sigiState = windowAny.SIGI_STATE;
            const itemModule = sigiState.ItemModule;
            if (!itemModule)
                return null;
            const videoId = Object.keys(itemModule)[0];
            const videoItem = itemModule[videoId];
            if (!videoItem)
                return null;
            const video = videoItem.video;
            const author = videoItem.author;
            const music = videoItem.music;
            const stats = videoItem.stats;
            const sources = [];
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
        }
        catch (error) {
            this.log(`SIGI extraction error: ${error}`, 'ERROR');
            return null;
        }
    }
    findVideoUrlInContainer(container) {
        const content = container.innerHTML;
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
    extractTitleFromDOM() {
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
    extractUploaderFromDOM() {
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
    extractThumbnailFromDOM() {
        const thumbnailSelectors = [
            '[data-e2e="video-player"] img',
            '.video-cover img',
            '.video-thumbnail img'
        ];
        for (const selector of thumbnailSelectors) {
            const element = document.querySelector(selector);
            if (element && element.src) {
                return element.src;
            }
        }
        return '';
    }
    convertToMediaSources(videoInfo) {
        const sources = [];
        for (const source of videoInfo.sources) {
            const mediaSource = {
                url: source.url,
                type: MediaType.VIDEO,
                format: 'mp4',
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
        if (videoInfo.music && videoInfo.music.url) {
            const musicSource = {
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
        sources.sort((a, b) => {
            const aBitrate = a.quality?.bitrate || 0;
            const bBitrate = b.quality?.bitrate || 0;
            return bBitrate - aBitrate;
        });
        this.log(`Converted to ${sources.length} media sources`, 'DEBUG');
        return sources;
    }
    extractHashtags(text) {
        const hashtagRegex = /#\w+/g;
        const matches = text.match(hashtagRegex);
        return matches ? matches.map(tag => tag.substring(1)) : [];
    }
    generateVideoId() {
        return `tiktok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
