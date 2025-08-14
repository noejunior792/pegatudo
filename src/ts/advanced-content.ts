/**
 * PegaTudo Advanced Content Script
 * Main entry point for the advanced video detection engine
 */

import { AdvancedVideoDetectionEngine } from './core/detection-engine.js';
import { AdvancedCryptoEngine } from './crypto/crypto-engine.js';
import { AdvancedStreamingEngine } from './core/streaming-engine.js';
import { AdvancedNetworkInterceptor } from './network/network-interceptor.js';
import { AdvancedUIManager } from './ui/advanced-ui-manager.js';
import { YouTubeExtractor } from './extractors/youtube.js';
import { FacebookExtractor } from './extractors/facebook.js';
import { TikTokExtractor } from './extractors/tiktok.js';

import {
  DebugConfig,
  StealthConfig,
  DetectionResult,
  MediaSource,
  DownloadProgress,
  DownloadStatus,
  Platform
} from './types/index.js';

/**
 * Main PegaTudo Advanced Engine Class
 * Orchestrates all components of the advanced video detection system
 */
export class PegaTudoAdvancedEngine {
  private detectionEngine: AdvancedVideoDetectionEngine;
  private cryptoEngine: AdvancedCryptoEngine;
  private streamingEngine: AdvancedStreamingEngine;
  private networkInterceptor: AdvancedNetworkInterceptor;
  private uiManager: AdvancedUIManager;
  
  private isInitialized: boolean = false;
  private isEnabled: boolean = true;
  private currentDetectionResults: DetectionResult[] = [];
  private activeDownloads: Map<string, DownloadProgress> = new Map();
  
  private debugConfig: DebugConfig;
  private stealthConfig: StealthConfig;

  constructor() {
    this.debugConfig = this.loadDebugConfig();
    this.stealthConfig = this.loadStealthConfig();
    
    this.log('PegaTudo Advanced Engine initializing...', 'INFO');
    
    // Initialize core components
    this.detectionEngine = new AdvancedVideoDetectionEngine(this.debugConfig, this.stealthConfig);
    this.cryptoEngine = new AdvancedCryptoEngine(this.debugConfig);
    this.streamingEngine = new AdvancedStreamingEngine(this.debugConfig, this.stealthConfig);
    this.networkInterceptor = new AdvancedNetworkInterceptor(this.debugConfig, this.stealthConfig);
    this.uiManager = new AdvancedUIManager(this.debugConfig);
    
    this.setupEventListeners();
    this.registerExtractors();
  }

  /**
   * Initialize the engine
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.log('Engine already initialized', 'WARN');
      return;
    }

    try {
      this.log('Starting engine initialization...', 'INFO');
      
      // Load user preferences
      await this.loadUserPreferences();
      
      if (!this.isEnabled) {
        this.log('Engine disabled by user preferences', 'INFO');
        return;
      }

      // Initialize core components
      await this.detectionEngine.initialize();
      this.networkInterceptor.start();
      
      // Start detection loop
      this.startDetectionLoop();
      
      // Setup page-specific handlers
      this.setupPageHandlers();
      
      this.isInitialized = true;
      this.log('Engine initialization completed', 'INFO');
      
      // Notify successful initialization
      this.notifyEngineStatus('initialized');
      
    } catch (error) {
      this.log(`Engine initialization failed: ${error}`, 'ERROR');
      this.notifyEngineStatus('error', error.message);
      throw error;
    }
  }

  /**
   * Shutdown the engine
   */
  public shutdown(): void {
    this.log('Shutting down engine...', 'INFO');
    
    this.detectionEngine.shutdown();
    this.networkInterceptor.stop();
    this.uiManager.hide();
    
    this.isInitialized = false;
    this.log('Engine shutdown completed', 'INFO');
  }

  /**
   * Enable/disable the engine
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (enabled && !this.isInitialized) {
      this.initialize();
    } else if (!enabled && this.isInitialized) {
      this.shutdown();
    }
    
    this.log(`Engine ${enabled ? 'enabled' : 'disabled'}`, 'INFO');
  }

  /**
   * Manually trigger media detection
   */
  public async detectMedia(): Promise<DetectionResult[]> {
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
      
    } catch (error) {
      this.log(`Manual detection failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Show detected media in UI
   */
  private showDetectionResults(results: DetectionResult[]): void {
    const allSources: MediaSource[] = [];
    
    results.forEach(result => {
      allSources.push(...result.sources);
    });
    
    // Remove duplicates
    const uniqueSources = this.deduplicateSources(allSources);
    
    // Sort by quality and relevance
    const sortedSources = this.sortSourcesByQuality(uniqueSources);
    
    this.log(`Showing ${sortedSources.length} unique media sources`, 'DEBUG');
    this.uiManager.show(sortedSources);
  }

  /**
   * Setup event listeners for UI and other components
   */
  private setupEventListeners(): void {
    // Listen for download requests from UI
    window.addEventListener('pegaTudoStartDownloads', async (event: any) => {
      const { selections, options } = event.detail;
      await this.handleDownloadRequest(selections, options);
    });

    // Listen for media discovered events
    window.addEventListener('pegaTudoMediaDiscovered', (event: any) => {
      this.handleMediaDiscovered(event.detail);
    });

    // Listen for configuration changes
    window.addEventListener('pegaTudoConfigChanged', (event: any) => {
      this.handleConfigChanged(event.detail);
    });

    // Listen for Chrome extension messages
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleChromeMessage(message, sender, sendResponse);
      });
    }

    // Setup keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      this.handleKeyboardShortcuts(event);
    });

    // Setup page visibility change handler
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });
  }

  /**
   * Register platform-specific extractors
   */
  private registerExtractors(): void {
    this.detectionEngine.registerExtractor(new YouTubeExtractor(this.debugConfig));
    this.detectionEngine.registerExtractor(new FacebookExtractor(this.debugConfig));
    this.detectionEngine.registerExtractor(new TikTokExtractor(this.debugConfig));
    
    this.log('Platform extractors registered', 'DEBUG');
  }

  /**
   * Start continuous detection loop
   */
  private startDetectionLoop(): void {
    const detectAndShow = async () => {
      if (!this.isInitialized || !this.isEnabled) return;
      
      try {
        const results = await this.detectionEngine.detectMedia();
        
        if (results.length > 0) {
          this.currentDetectionResults = results;
          
          // Auto-show UI if significant media detected
          if (this.shouldAutoShowUI(results)) {
            this.showDetectionResults(results);
          }
        }
        
      } catch (error) {
        this.log(`Detection loop error: ${error}`, 'ERROR');
      }
    };

    // Initial detection
    setTimeout(detectAndShow, 2000);
    
    // Periodic detection
    setInterval(detectAndShow, 10000);
    
    this.log('Detection loop started', 'DEBUG');
  }

  /**
   * Setup page-specific handlers based on current URL
   */
  private setupPageHandlers(): void {
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

  /**
   * Handle download request from UI
   */
  private async handleDownloadRequest(selections: any[], options: any): Promise<void> {
    this.log(`Processing download request for ${selections.length} items`, 'INFO');
    
    try {
      const concurrentLimit = options.concurrentDownloads || 2;
      const batches = this.createDownloadBatches(selections, concurrentLimit);
      
      for (const batch of batches) {
        const batchPromises = batch.map(selection => 
          this.downloadMediaSource(selection.source, selection, options)
        );
        
        await Promise.allSettled(batchPromises);
      }
      
      this.log('All downloads completed', 'INFO');
      
    } catch (error) {
      this.log(`Download processing failed: ${error}`, 'ERROR');
      this.uiManager.showError(`Download failed: ${error.message}`);
    }
  }

  /**
   * Download a single media source
   */
  private async downloadMediaSource(
    source: MediaSource, 
    selection: any, 
    options: any
  ): Promise<void> {
    const downloadId = this.generateDownloadId();
    const filename = this.generateFilename(source, selection, options);
    
    const progress: DownloadProgress = {
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
      
      // Handle different source types
      if (source.segments && source.segments.length > 0) {
        // Streaming media (HLS/DASH)
        await this.downloadStreamingMedia(source, filename, progress);
      } else {
        // Direct media file
        await this.downloadDirectMedia(source, filename, progress);
      }
      
      progress.status = DownloadStatus.COMPLETED;
      progress.progress = 100;
      this.uiManager.updateProgress(progress);
      
      this.log(`Download completed: ${filename}`, 'INFO');
      
    } catch (error) {
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
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  /**
   * Download streaming media (HLS/DASH)
   */
  private async downloadStreamingMedia(
    source: MediaSource, 
    filename: string, 
    progress: DownloadProgress
  ): Promise<void> {
    const onProgress = (streamProgress: DownloadProgress) => {
      progress.progress = streamProgress.progress;
      progress.speed = streamProgress.speed;
      progress.eta = streamProgress.eta;
      progress.status = streamProgress.status;
      this.uiManager.updateProgress(progress);
    };

    const blob = await this.streamingEngine.downloadStream(source, filename, onProgress);
    
    // Save the blob
    await this.saveBlobToFile(blob, filename);
  }

  /**
   * Download direct media file
   */
  private async downloadDirectMedia(
    source: MediaSource, 
    filename: string, 
    progress: DownloadProgress
  ): Promise<void> {
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

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
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

    const blob = new Blob(chunks as BlobPart[]);
    await this.saveBlobToFile(blob, filename);
  }

  /**
   * Save blob to file
   */
  private async saveBlobToFile(blob: Blob, filename: string): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      // Use Chrome downloads API
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
    } else {
      // Fallback to direct download
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

  /**
   * Handle media discovered event
   */
  private handleMediaDiscovered(detail: any): void {
    this.log(`Media discovered: ${detail.url}`, 'DEBUG');
    
    // Trigger re-detection to capture new media
    if (this.isInitialized) {
      setTimeout(() => this.detectMedia(), 1000);
    }
  }

  /**
   * Handle configuration changes
   */
  private handleConfigChanged(detail: any): void {
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

  /**
   * Handle Chrome extension messages
   */
  private handleChromeMessage(message: any, sender: any, sendResponse: any): void {
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

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Ctrl+Shift+P: Show PegaTudo UI
    if (event.ctrlKey && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      this.detectMedia();
    }
    
    // Ctrl+Shift+D: Quick download best quality
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      this.quickDownloadBest();
    }
  }

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Page hidden - reduce detection frequency
      this.log('Page hidden, reducing detection frequency', 'DEBUG');
    } else {
      // Page visible - resume normal detection
      this.log('Page visible, resuming normal detection', 'DEBUG');
      setTimeout(() => this.detectMedia(), 1000);
    }
  }

  // Platform-specific setup methods

  private setupYouTubeHandlers(): void {
    // YouTube-specific event listeners and handlers
    this.log('YouTube handlers setup', 'DEBUG');
  }

  private setupFacebookHandlers(): void {
    // Facebook-specific event listeners and handlers
    this.log('Facebook handlers setup', 'DEBUG');
  }

  private setupTikTokHandlers(): void {
    // TikTok-specific event listeners and handlers
    this.log('TikTok handlers setup', 'DEBUG');
  }

  private setupGenericHandlers(): void {
    // Generic handlers for unknown platforms
    this.log('Generic handlers setup', 'DEBUG');
  }

  // Utility methods

  private async loadUserPreferences(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.sync.get(['extensionEnabled', 'debugMode']);
      this.isEnabled = result.extensionEnabled !== false;
      if (result.debugMode) {
        this.debugConfig.enabled = true;
      }
    }
  }

  private loadDebugConfig(): DebugConfig {
    return {
      enabled: false,
      level: 'INFO',
      logNetworkRequests: false,
      logDetectionResults: true,
      logCryptoOperations: false,
      saveToFile: false
    };
  }

  private loadStealthConfig(): StealthConfig {
    return {
      randomizeUserAgent: true,
      randomizeRequestTiming: true,
      mimicBrowserBehavior: true,
      avoidDetection: true,
      maxConcurrentRequests: 3,
      requestDelay: { min: 200, max: 800 }
    };
  }

  private detectCurrentPlatform(url: string): Platform {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return Platform.YOUTUBE;
    if (url.includes('facebook.com')) return Platform.FACEBOOK;
    if (url.includes('tiktok.com')) return Platform.TIKTOK;
    if (url.includes('instagram.com')) return Platform.INSTAGRAM;
    if (url.includes('twitter.com')) return Platform.TWITTER;
    if (url.includes('twitch.tv')) return Platform.TWITCH;
    return Platform.GENERIC;
  }

  private shouldAutoShowUI(results: DetectionResult[]): boolean {
    const totalSources = results.reduce((sum, result) => sum + result.sources.length, 0);
    return totalSources >= 2; // Show UI if 2 or more sources detected
  }

  private deduplicateSources(sources: MediaSource[]): MediaSource[] {
    const seen = new Set<string>();
    return sources.filter(source => {
      const key = `${source.url}:${source.format}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private sortSourcesByQuality(sources: MediaSource[]): MediaSource[] {
    return sources.sort((a, b) => {
      // Prioritize by quality, then by format preference
      const aQuality = this.getQualityScore(a);
      const bQuality = this.getQualityScore(b);
      return bQuality - aQuality;
    });
  }

  private getQualityScore(source: MediaSource): number {
    let score = 0;
    
    if (source.quality) {
      const quality = source.quality as any;
      score += (quality.width || 0) * (quality.height || 0) / 1000;
      score += (quality.bitrate || 0) / 1000;
    }
    
    // Format preferences
    const formatScores: Record<string, number> = {
      'mp4': 100,
      'webm': 90,
      'mov': 80,
      'avi': 70
    };
    
    score += formatScores[source.format] || 50;
    
    return score;
  }

  private createDownloadBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private generateDownloadId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFilename(source: MediaSource, selection: any, options: any): string {
    const pattern = options.filenamePattern || '{title}.{ext}';
    const title = source.metadata?.title || 'media';
    const ext = source.format;
    const quality = source.quality ? `${(source.quality as any).height}p` : '';
    
    return pattern
      .replace('{title}', this.sanitizeFilename(title))
      .replace('{ext}', ext)
      .replace('{quality}', quality)
      .replace('{uploader}', this.sanitizeFilename(source.metadata?.uploader || ''))
      .replace('{timestamp}', new Date().toISOString().split('T')[0]);
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  }

  private async quickDownloadBest(): Promise<void> {
    const results = await this.detectMedia();
    if (results.length === 0) return;
    
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

  private notifyEngineStatus(status: string, message?: string): void {
    const event = new CustomEvent('pegaTudoEngineStatus', {
      detail: { status, message, timestamp: new Date() }
    });
    window.dispatchEvent(event);
  }

  private log(message: string, level: keyof { DEBUG: 0; INFO: 1; WARN: 2; ERROR: 3 }): void {
    if (!this.debugConfig.enabled) return;
    
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

// Initialize the engine when the script loads
const pegaTudoEngine = new PegaTudoAdvancedEngine();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    pegaTudoEngine.initialize().catch(console.error);
  });
} else {
  pegaTudoEngine.initialize().catch(console.error);
}

// Export for global access
(window as any).pegaTudoEngine = pegaTudoEngine;