/**
 * PegaTudo Advanced Video Detection Engine - Core Engine
 * Sophisticated video detection and processing system
 */
import { DetectionResult, ExtractorInterface, DebugConfig, StealthConfig } from '../types/index.js';
export declare class AdvancedVideoDetectionEngine {
    private extractors;
    private patterns;
    private networkRequests;
    private debugConfig;
    private stealthConfig;
    private isRunning;
    private detectionResults;
    private observers;
    private interceptorActive;
    constructor(debugConfig?: DebugConfig, stealthConfig?: StealthConfig);
    /**
     * Initialize the detection engine
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the detection engine
     */
    shutdown(): void;
    /**
     * Register a custom extractor
     */
    registerExtractor(extractor: ExtractorInterface): void;
    /**
     * Detect media from the current page
     */
    detectMedia(): Promise<DetectionResult[]>;
    /**
     * DOM-based detection with deep scanning
     */
    private detectFromDOM;
    /**
     * Network request interception and analysis
     */
    private detectFromNetworkRequests;
    /**
     * Shadow DOM scanning for hidden media
     */
    private detectFromShadowDOM;
    /**
     * JavaScript context analysis for dynamically loaded media
     */
    private detectFromJavaScriptContext;
    /**
     * WebSocket message interception
     */
    private detectFromWebSockets;
    /**
     * Use registered extractors for platform-specific detection
     */
    private detectWithExtractors;
    /**
     * Setup network request interception using various methods
     */
    private setupNetworkInterception;
    /**
     * Setup DOM mutation observers
     */
    private setupDOMObservers;
    /**
     * Initialize default patterns for media detection
     */
    private initializePatterns;
    private extractVideoSources;
    private extractAudioSources;
    private createMediaSource;
    private extractHiddenMediaURLs;
    private extractMediaFromJSON;
    private isMediaURL;
    private isValidMediaURL;
    private detectMediaType;
    private extractFormat;
    private detectPlatform;
    private getDefaultDebugConfig;
    private getDefaultStealthConfig;
    private log;
    private setupDeclarativeNetRequest;
    private interceptFetch;
    private interceptXHR;
    private setupWebSocketInterception;
    private initializeExtractors;
    private startDetectionLoop;
    private stopNetworkInterception;
    private handleDOMMutations;
    private setupShadowDOMObservers;
    private findShadowRoots;
    private scanShadowRoot;
    private extractFromGlobalContext;
    private hookMediaLibraries;
    private isMediaRequest;
    private processNetworkRequest;
    private deduplicateResults;
    private rankResults;
}
//# sourceMappingURL=detection-engine.d.ts.map