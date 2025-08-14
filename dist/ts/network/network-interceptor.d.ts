/**
 * PegaTudo Advanced Network Interceptor
 * Sophisticated network request interception and analysis for media detection
 */
import { NetworkInterceptorInterface, NetworkRequest, PatternMatch, DebugConfig, StealthConfig } from '../types/index.js';
export declare class AdvancedNetworkInterceptor implements NetworkInterceptorInterface {
    private isActive;
    private interceptedRequests;
    private patterns;
    private originalFetch;
    private originalXhrOpen;
    private originalXhrSend;
    private debugConfig;
    private stealthConfig;
    private requestCounter;
    private declarativeNetRequestRules;
    private ruleIdCounter;
    constructor(debugConfig?: DebugConfig, stealthConfig?: StealthConfig);
    /**
     * Start network interception
     */
    start(): void;
    /**
     * Stop network interception
     */
    stop(): void;
    /**
     * Add detection pattern
     */
    addPattern(pattern: PatternMatch): void;
    /**
     * Remove detection pattern
     */
    removePattern(pattern: PatternMatch): void;
    /**
     * Get all intercepted requests
     */
    getRequests(): NetworkRequest[];
    /**
     * Get media requests only
     */
    getMediaRequests(): NetworkRequest[];
    /**
     * Clear request history
     */
    clearRequests(): void;
    /**
     * Intercept fetch requests
     */
    private interceptFetch;
    /**
     * Intercept XMLHttpRequest
     */
    private interceptXMLHttpRequest;
    /**
     * Setup WebSocket interception
     */
    private setupWebSocketInterception;
    /**
     * Setup Chrome declarativeNetRequest API
     */
    private setupDeclarativeNetRequest;
    /**
     * Update declarativeNetRequest rules
     */
    private updateDeclarativeNetRequestRules;
    /**
     * Restore original fetch
     */
    private restoreFetch;
    /**
     * Restore original XMLHttpRequest
     */
    private restoreXMLHttpRequest;
    /**
     * Restore original WebSocket
     */
    private restoreWebSocket;
    /**
     * Cleanup declarativeNetRequest rules
     */
    private cleanupDeclarativeNetRequest;
    private initializePatterns;
    private isMediaRequest;
    private isMediaRequestByUrl;
    private isMediaContentType;
    private shouldCaptureBody;
    private extractHeaders;
    private extractResponseHeaders;
    private parseXHRHeaders;
    private addStealthHeaders;
    private getRandomUserAgent;
    private extractMediaUrlsFromText;
    private isValidUrl;
    private convertRegexToUrlFilter;
    private notifyMediaDiscovered;
    private generateRequestId;
    private getDefaultDebugConfig;
    private getDefaultStealthConfig;
    private log;
}
//# sourceMappingURL=network-interceptor.d.ts.map