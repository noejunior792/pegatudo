/**
 * PegaTudo TikTok Video Extractor
 * Advanced TikTok video extraction with multiple resolution support
 */
import { ExtractorInterface, DetectionResult, Platform, ExtractorConfig, DebugConfig } from '../types/index.js';
export declare class TikTokExtractor implements ExtractorInterface {
    readonly id = "tiktok";
    readonly name = "TikTok Video Extractor";
    readonly platforms: Platform[];
    readonly priority = 18;
    private debugConfig;
    constructor(debugConfig?: DebugConfig);
    canExtract(url: string): boolean;
    extract(url: string, config?: ExtractorConfig): Promise<DetectionResult>;
    private extractVideoInfo;
    private extractFromNextProps;
    private extractFromDOM;
    private extractFromSIGI;
    private findVideoUrlInContainer;
    private extractTitleFromDOM;
    private extractUploaderFromDOM;
    private extractThumbnailFromDOM;
    private convertToMediaSources;
    private extractHashtags;
    private generateVideoId;
    private getDefaultDebugConfig;
    private log;
}
//# sourceMappingURL=tiktok.d.ts.map