/**
 * PegaTudo Facebook Video Extractor
 * Advanced Facebook video extraction with support for various video types
 */
import { ExtractorInterface, DetectionResult, Platform, ExtractorConfig, DebugConfig } from '../types/index.js';
export declare class FacebookExtractor implements ExtractorInterface {
    readonly id = "facebook";
    readonly name = "Facebook Video Extractor";
    readonly platforms: Platform[];
    readonly priority = 18;
    private debugConfig;
    constructor(debugConfig?: DebugConfig);
    canExtract(url: string): boolean;
    extract(url: string, config?: ExtractorConfig): Promise<DetectionResult>;
    private extractVideoInfo;
    private extractFromDOM;
    private extractFromNetworkRequests;
    private extractFromJsonLd;
    private findVideoUrlsInContainer;
    private scanWindowForVideoUrls;
    private extractFromEmbed;
    private extractTitle;
    private extractDescription;
    private extractUploader;
    private extractThumbnails;
    private detectLiveStream;
    private convertToMediaSources;
    private getFormatFromType;
    private parseDuration;
    private generateVideoId;
    private getDefaultDebugConfig;
    private log;
}
//# sourceMappingURL=facebook.d.ts.map