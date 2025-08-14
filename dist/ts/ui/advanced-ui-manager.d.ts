/**
 * PegaTudo Advanced UI Manager
 * Modern, responsive UI for video download management with format selection and batch operations
 */
import { UIManagerInterface, MediaSource, DownloadProgress, DebugConfig } from '../types/index.js';
interface UIConfig {
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    theme: 'light' | 'dark' | 'auto';
    animations: boolean;
    autoHide: boolean;
    autoHideDelay: number;
    showAdvancedOptions: boolean;
    maxVisibleSources: number;
}
export declare class AdvancedUIManager implements UIManagerInterface {
    private container;
    private shadowRoot;
    private isVisible;
    private currentSources;
    private selections;
    private downloadProgresses;
    private debugConfig;
    private uiConfig;
    private autoHideTimer;
    constructor(debugConfig?: DebugConfig, uiConfig?: Partial<UIConfig>);
    /**
     * Show the UI with detected media sources
     */
    show(sources: MediaSource[]): void;
    /**
     * Hide the UI
     */
    hide(): void;
    /**
     * Update download progress
     */
    updateProgress(progress: DownloadProgress): void;
    /**
     * Show error message
     */
    showError(error: string): void;
    /**
     * Show success message
     */
    showSuccess(message: string): void;
    /**
     * Create the main UI structure
     */
    private createUI;
    /**
     * Add comprehensive styles
     */
    private addStyles;
    /**
     * Create the main panel structure
     */
    private createMainPanel;
    /**
     * Position the container based on config
     */
    private positionContainer;
    /**
     * Setup event listeners
     */
    private setupEventListeners;
    /**
     * Update the sources list
     */
    private updateSourcesList;
    /**
     * Create a source item element
     */
    private createSourceItem;
    /**
     * Update selection state
     */
    private updateSelection;
    /**
     * Update quality selection
     */
    private updateQualitySelection;
    /**
     * Update the download button state
     */
    private updateDownloadButton;
    /**
     * Update statistics
     */
    private updateStats;
    /**
     * Calculate total size of selected sources
     */
    private calculateTotalSize;
    /**
     * Select all sources
     */
    private selectAll;
    /**
     * Select no sources
     */
    private selectNone;
    /**
     * Select best quality sources
     */
    private selectBestQuality;
    /**
     * Get best quality source from array
     */
    private getBestQualitySource;
    /**
     * Start downloads for selected sources
     */
    private startDownloads;
    /**
     * Get download options from advanced settings
     */
    private getDownloadOptions;
    /**
     * Toggle advanced options
     */
    private toggleAdvancedOptions;
    /**
     * Update progress display
     */
    private updateProgressDisplay;
    /**
     * Make UI visible
     */
    private makeVisible;
    /**
     * Make UI invisible
     */
    private makeInvisible;
    /**
     * Schedule auto-hide
     */
    private scheduleAutoHide;
    /**
     * Create toast notification
     */
    private createToast;
    /**
     * Update selections based on current sources
     */
    private updateSelections;
    private formatBytes;
    private formatSpeed;
    private formatTime;
    private getDefaultDebugConfig;
    private getDefaultUIConfig;
    private log;
}
export {};
//# sourceMappingURL=advanced-ui-manager.d.ts.map