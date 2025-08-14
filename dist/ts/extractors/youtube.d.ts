/**
 * PegaTudo YouTube Extractor
 * Advanced YouTube video extraction with multiple quality options and live stream support
 */
import { ExtractorInterface, DetectionResult, Platform, ExtractorConfig, DebugConfig } from '../types/index.js';
export declare class YouTubeExtractor implements ExtractorInterface {
    readonly id = "youtube";
    readonly name = "YouTube Extractor";
    readonly platforms: Platform[];
    readonly priority = 20;
    private debugConfig;
    constructor(debugConfig?: DebugConfig);
    canExtract(url: string): boolean;
    extract(url: string, config?: ExtractorConfig): Promise<DetectionResult>;
    private extractVideoId;
    private extractVideoInfo;
    private extractFromPageSource;
    private extractFromNetworkRequests;
    private extractFromIframe;
    private parsePlayerResponse;
    private extractFromInitialData;
    private convertToMediaSources;
    private getMediaTypeFromMimeType;
    private getFormatFromMimeType;
    private getCodecFromMimeType;
    private parseViewCount;
    private getDefaultDebugConfig;
    private log;
}
//# sourceMappingURL=youtube.d.ts.map