/**
 * PegaTudo Advanced Content Script
 * Main entry point for the advanced video detection engine
 */
import { DetectionResult } from './types/index.js';
/**
 * Main PegaTudo Advanced Engine Class
 * Orchestrates all components of the advanced video detection system
 */
export declare class PegaTudoAdvancedEngine {
    private detectionEngine;
    private cryptoEngine;
    private streamingEngine;
    private networkInterceptor;
    private uiManager;
    private isInitialized;
    private isEnabled;
    private currentDetectionResults;
    private activeDownloads;
    private debugConfig;
    private stealthConfig;
    constructor();
    /**
     * Initialize the engine
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the engine
     */
    shutdown(): void;
    /**
     * Enable/disable the engine
     */
    setEnabled(enabled: boolean): void;
    /**
     * Manually trigger media detection
     */
    detectMedia(): Promise<DetectionResult[]>;
    /**
     * Show detected media in UI
     */
    private showDetectionResults;
    /**
     * Setup event listeners for UI and other components
     */
    private setupEventListeners;
    /**
     * Register platform-specific extractors
     */
    private registerExtractors;
    /**
     * Start continuous detection loop
     */
    private startDetectionLoop;
    /**
     * Setup page-specific handlers based on current URL
     */
    private setupPageHandlers;
    /**
     * Handle download request from UI
     */
    private handleDownloadRequest;
    /**
     * Download a single media source
     */
    private downloadMediaSource;
    /**
     * Download streaming media (HLS/DASH)
     */
    private downloadStreamingMedia;
    /**
     * Download direct media file
     */
    private downloadDirectMedia;
    /**
     * Save blob to file
     */
    private saveBlobToFile;
    /**
     * Handle media discovered event
     */
    private handleMediaDiscovered;
    /**
     * Handle configuration changes
     */
    private handleConfigChanged;
    /**
     * Handle Chrome extension messages
     */
    private handleChromeMessage;
    /**
     * Handle keyboard shortcuts
     */
    private handleKeyboardShortcuts;
    /**
     * Handle page visibility changes
     */
    private handleVisibilityChange;
    private setupYouTubeHandlers;
    private setupFacebookHandlers;
    private setupTikTokHandlers;
    private setupGenericHandlers;
    private loadUserPreferences;
    private loadDebugConfig;
    private loadStealthConfig;
    private detectCurrentPlatform;
    private shouldAutoShowUI;
    private deduplicateSources;
    private sortSourcesByQuality;
    private getQualityScore;
    private createDownloadBatches;
    private generateDownloadId;
    private generateFilename;
    private sanitizeFilename;
    private quickDownloadBest;
    private notifyEngineStatus;
    private log;
}
//# sourceMappingURL=advanced-content.d.ts.map