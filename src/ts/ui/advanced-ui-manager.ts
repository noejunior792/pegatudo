/**
 * PegaTudo Advanced UI Manager
 * Modern, responsive UI for video download management with format selection and batch operations
 */

import {
  UIManagerInterface,
  MediaSource,
  DownloadProgress,
  DownloadStatus,
  VideoQuality,
  AudioQuality,
  MediaType,
  DebugConfig
} from '../types/index.js';

interface UIConfig {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  autoHide: boolean;
  autoHideDelay: number;
  showAdvancedOptions: boolean;
  maxVisibleSources: number;
}

interface DownloadSelection {
  source: MediaSource;
  selected: boolean;
  format?: string;
  quality?: VideoQuality | AudioQuality;
  customFilename?: string;
}

export class AdvancedUIManager implements UIManagerInterface {
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private isVisible: boolean = false;
  private currentSources: MediaSource[] = [];
  private selections: Map<string, DownloadSelection> = new Map();
  private downloadProgresses: Map<string, DownloadProgress> = new Map();
  private debugConfig: DebugConfig;
  private uiConfig: UIConfig;
  private autoHideTimer: number | null = null;

  constructor(debugConfig?: DebugConfig, uiConfig?: Partial<UIConfig>) {
    this.debugConfig = debugConfig || this.getDefaultDebugConfig();
    this.uiConfig = { ...this.getDefaultUIConfig(), ...uiConfig };
    this.log('AdvancedUIManager initialized', 'INFO');
  }

  /**
   * Show the UI with detected media sources
   */
  public show(sources: MediaSource[]): void {
    try {
      this.currentSources = sources;
      this.updateSelections();
      
      if (!this.container) {
        this.createUI();
      }
      
      this.updateSourcesList();
      this.makeVisible();
      
      this.log(`UI shown with ${sources.length} media sources`, 'DEBUG');
      
      if (this.uiConfig.autoHide) {
        this.scheduleAutoHide();
      }
      
    } catch (error) {
      this.log(`Error showing UI: ${error}`, 'ERROR');
      this.showError(`Failed to display media sources: ${error.message}`);
    }
  }

  /**
   * Hide the UI
   */
  public hide(): void {
    if (this.container) {
      this.makeInvisible();
      this.log('UI hidden', 'DEBUG');
    }
    
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  /**
   * Update download progress
   */
  public updateProgress(progress: DownloadProgress): void {
    this.downloadProgresses.set(progress.downloadId, progress);
    
    if (this.isVisible) {
      this.updateProgressDisplay(progress);
    }
    
    this.log(`Progress updated: ${progress.filename} - ${progress.progress}%`, 'DEBUG');
  }

  /**
   * Show error message
   */
  public showError(error: string): void {
    this.createToast(error, 'error');
    this.log(`Error shown to user: ${error}`, 'ERROR');
  }

  /**
   * Show success message
   */
  public showSuccess(message: string): void {
    this.createToast(message, 'success');
    this.log(`Success shown to user: ${message}`, 'INFO');
  }

  /**
   * Create the main UI structure
   */
  private createUI(): void {
    // Create container with shadow DOM for isolation
    this.container = document.createElement('div');
    this.container.className = 'pega-tudo-advanced-ui';
    
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });
    
    // Add styles
    this.addStyles();
    
    // Create main UI elements
    this.createMainPanel();
    
    // Position the container
    this.positionContainer();
    
    // Add to DOM
    document.body.appendChild(this.container);
    
    // Setup event listeners
    this.setupEventListeners();
    
    this.log('UI created and added to DOM', 'DEBUG');
  }

  /**
   * Add comprehensive styles
   */
  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        pointer-events: none;
      }

      .main-panel {
        pointer-events: auto;
        background: ${this.uiConfig.theme === 'dark' ? '#1a1a1a' : '#ffffff'};
        border: 1px solid ${this.uiConfig.theme === 'dark' ? '#333' : '#e0e0e0'};
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        width: 420px;
        max-height: 600px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: translateY(-20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .main-panel.visible {
        transform: translateY(0);
        opacity: 1;
      }

      .header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .content {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }

      .toolbar {
        padding: 12px 20px;
        border-bottom: 1px solid ${this.uiConfig.theme === 'dark' ? '#333' : '#e0e0e0'};
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .btn {
        padding: 6px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        color: #333;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .btn:hover {
        background: #f5f5f5;
        border-color: #ccc;
      }

      .btn.primary {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }

      .btn.primary:hover {
        background: #0056b3;
        border-color: #0056b3;
      }

      .btn.success {
        background: #28a745;
        color: white;
        border-color: #28a745;
      }

      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .sources-list {
        flex: 1;
        overflow-y: auto;
        max-height: 400px;
      }

      .source-item {
        padding: 12px 20px;
        border-bottom: 1px solid ${this.uiConfig.theme === 'dark' ? '#333' : '#f0f0f0'};
        display: flex;
        align-items: center;
        gap: 12px;
        transition: background-color 0.2s;
      }

      .source-item:hover {
        background: ${this.uiConfig.theme === 'dark' ? '#2a2a2a' : '#f8f9fa'};
      }

      .source-checkbox {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      .source-info {
        flex: 1;
        min-width: 0;
      }

      .source-title {
        font-weight: 500;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .source-details {
        font-size: 12px;
        color: ${this.uiConfig.theme === 'dark' ? '#999' : '#666'};
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .quality-badge {
        background: #e3f2fd;
        color: #1976d2;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }

      .format-badge {
        background: #f3e5f5;
        color: #7b1fa2;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }

      .size-badge {
        background: #e8f5e8;
        color: #388e3c;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }

      .quality-selector {
        min-width: 100px;
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        background: white;
      }

      .progress-section {
        padding: 16px 20px;
        border-top: 1px solid ${this.uiConfig.theme === 'dark' ? '#333' : '#e0e0e0'};
        background: ${this.uiConfig.theme === 'dark' ? '#2a2a2a' : '#f8f9fa'};
        max-height: 200px;
        overflow-y: auto;
      }

      .progress-item {
        margin-bottom: 12px;
      }

      .progress-item:last-child {
        margin-bottom: 0;
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }

      .progress-filename {
        font-size: 12px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }

      .progress-percentage {
        font-size: 12px;
        color: ${this.uiConfig.theme === 'dark' ? '#999' : '#666'};
      }

      .progress-bar {
        width: 100%;
        height: 6px;
        background: ${this.uiConfig.theme === 'dark' ? '#333' : '#e0e0e0'};
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4caf50, #45a049);
        border-radius: 3px;
        transition: width 0.3s ease;
        position: relative;
      }

      .progress-fill.error {
        background: #f44336;
      }

      .progress-fill.completed {
        background: #4caf50;
      }

      .progress-details {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 11px;
        color: ${this.uiConfig.theme === 'dark' ? '#999' : '#666'};
      }

      .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 2147483648;
        max-width: 300px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }

      .toast.visible {
        transform: translateX(0);
      }

      .toast.success {
        background: #4caf50;
        color: white;
      }

      .toast.error {
        background: #f44336;
        color: white;
      }

      .toast.warning {
        background: #ff9800;
        color: white;
      }

      .advanced-options {
        padding: 16px 20px;
        border-top: 1px solid ${this.uiConfig.theme === 'dark' ? '#333' : '#e0e0e0'};
        background: ${this.uiConfig.theme === 'dark' ? '#2a2a2a' : '#f8f9fa'};
        display: none;
      }

      .advanced-options.visible {
        display: block;
      }

      .option-group {
        margin-bottom: 12px;
      }

      .option-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 4px;
        color: ${this.uiConfig.theme === 'dark' ? '#ccc' : '#555'};
      }

      .option-input {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        background: white;
      }

      .stats {
        padding: 8px 20px;
        background: ${this.uiConfig.theme === 'dark' ? '#2a2a2a' : '#f8f9fa'};
        border-top: 1px solid ${this.uiConfig.theme === 'dark' ? '#333' : '#e0e0e0'};
        font-size: 11px;
        color: ${this.uiConfig.theme === 'dark' ? '#999' : '#666'};
        text-align: center;
      }

      /* Scrollbar styling */
      .sources-list::-webkit-scrollbar,
      .progress-section::-webkit-scrollbar {
        width: 6px;
      }

      .sources-list::-webkit-scrollbar-track,
      .progress-section::-webkit-scrollbar-track {
        background: transparent;
      }

      .sources-list::-webkit-scrollbar-thumb,
      .progress-section::-webkit-scrollbar-thumb {
        background: ${this.uiConfig.theme === 'dark' ? '#444' : '#ccc'};
        border-radius: 3px;
      }

      .sources-list::-webkit-scrollbar-thumb:hover,
      .progress-section::-webkit-scrollbar-thumb:hover {
        background: ${this.uiConfig.theme === 'dark' ? '#555' : '#999'};
      }

      /* Animation classes */
      @keyframes slideInUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes slideOutDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(20px);
          opacity: 0;
        }
      }

      .animate-in {
        animation: slideInUp 0.3s ease;
      }

      .animate-out {
        animation: slideOutDown 0.3s ease;
      }
    `;
    
    this.shadowRoot!.appendChild(style);
  }

  /**
   * Create the main panel structure
   */
  private createMainPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'main-panel';
    
    panel.innerHTML = `
      <div class="header">
        <h3>🎬 PegaTudo - Advanced Downloader</h3>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      <div class="content">
        <div class="toolbar">
          <button class="btn" id="selectAllBtn">Select All</button>
          <button class="btn" id="selectNoneBtn">Select None</button>
          <button class="btn" id="selectBestBtn">Select Best Quality</button>
          <button class="btn primary" id="downloadBtn" disabled>Download Selected</button>
          <button class="btn" id="advancedBtn">Advanced</button>
        </div>
        <div class="sources-list" id="sourcesList">
          <!-- Sources will be populated here -->
        </div>
        <div class="progress-section" id="progressSection" style="display: none;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px;">Downloads</h4>
          <div id="progressList"></div>
        </div>
        <div class="advanced-options" id="advancedOptions">
          <div class="option-group">
            <label class="option-label">Custom Filename Pattern:</label>
            <input type="text" class="option-input" id="filenamePattern" placeholder="{title} - {quality}.{ext}">
          </div>
          <div class="option-group">
            <label class="option-label">Concurrent Downloads:</label>
            <select class="option-input" id="concurrentDownloads">
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label">Auto-retry Failed Downloads:</label>
            <select class="option-input" id="autoRetry">
              <option value="true" selected>Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <div class="stats" id="stats">
          Ready to download media files
        </div>
      </div>
    `;
    
    this.shadowRoot!.appendChild(panel);
  }

  /**
   * Position the container based on config
   */
  private positionContainer(): void {
    if (!this.container) return;
    
    const styles: Record<string, string> = {
      position: 'fixed',
      zIndex: '2147483647'
    };
    
    switch (this.uiConfig.position) {
      case 'top-right':
        styles.top = '20px';
        styles.right = '20px';
        break;
      case 'top-left':
        styles.top = '20px';
        styles.left = '20px';
        break;
      case 'bottom-right':
        styles.bottom = '20px';
        styles.right = '20px';
        break;
      case 'bottom-left':
        styles.bottom = '20px';
        styles.left = '20px';
        break;
    }
    
    Object.assign(this.container.style, styles);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.shadowRoot) return;
    
    // Close button
    const closeBtn = this.shadowRoot.getElementById('closeBtn');
    closeBtn?.addEventListener('click', () => this.hide());
    
    // Toolbar buttons
    const selectAllBtn = this.shadowRoot.getElementById('selectAllBtn');
    selectAllBtn?.addEventListener('click', () => this.selectAll());
    
    const selectNoneBtn = this.shadowRoot.getElementById('selectNoneBtn');
    selectNoneBtn?.addEventListener('click', () => this.selectNone());
    
    const selectBestBtn = this.shadowRoot.getElementById('selectBestBtn');
    selectBestBtn?.addEventListener('click', () => this.selectBestQuality());
    
    const downloadBtn = this.shadowRoot.getElementById('downloadBtn');
    downloadBtn?.addEventListener('click', () => this.startDownloads());
    
    const advancedBtn = this.shadowRoot.getElementById('advancedBtn');
    advancedBtn?.addEventListener('click', () => this.toggleAdvancedOptions());
    
    // Prevent clicks from bubbling to page
    const panel = this.shadowRoot.querySelector('.main-panel');
    panel?.addEventListener('click', (e) => e.stopPropagation());
    
    // Auto-hide on outside click
    document.addEventListener('click', (e) => {
      if (this.isVisible && this.uiConfig.autoHide && !this.container?.contains(e.target as Node)) {
        this.hide();
      }
    });
  }

  /**
   * Update the sources list
   */
  private updateSourcesList(): void {
    const sourcesList = this.shadowRoot?.getElementById('sourcesList');
    if (!sourcesList) return;
    
    sourcesList.innerHTML = '';
    
    const visibleSources = this.currentSources.slice(0, this.uiConfig.maxVisibleSources);
    
    visibleSources.forEach((source, index) => {
      const sourceItem = this.createSourceItem(source, index);
      sourcesList.appendChild(sourceItem);
    });
    
    if (this.currentSources.length > this.uiConfig.maxVisibleSources) {
      const moreItem = document.createElement('div');
      moreItem.className = 'source-item';
      moreItem.innerHTML = `
        <div class="source-info">
          <div class="source-title">... and ${this.currentSources.length - this.uiConfig.maxVisibleSources} more sources</div>
          <div class="source-details">Click "Show All" to see complete list</div>
        </div>
      `;
      sourcesList.appendChild(moreItem);
    }
    
    this.updateStats();
    this.updateDownloadButton();
  }

  /**
   * Create a source item element
   */
  private createSourceItem(source: MediaSource, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'source-item';
    
    const sourceId = `source_${index}`;
    const isSelected = this.selections.get(sourceId)?.selected || false;
    
    const quality = source.quality as VideoQuality;
    const qualityText = quality ? `${quality.width}x${quality.height}` : 'Auto';
    const sizeText = source.size ? this.formatBytes(source.size) : 'Unknown';
    
    item.innerHTML = `
      <input type="checkbox" class="source-checkbox" id="${sourceId}" ${isSelected ? 'checked' : ''}>
      <div class="source-info">
        <div class="source-title">${source.metadata?.title || 'Untitled Media'}</div>
        <div class="source-details">
          <span class="quality-badge">${qualityText}</span>
          <span class="format-badge">${source.format.toUpperCase()}</span>
          <span class="size-badge">${sizeText}</span>
          ${source.extractorId ? `<span class="size-badge">${source.extractorId}</span>` : ''}
        </div>
      </div>
      <select class="quality-selector" id="${sourceId}_quality">
        <option value="original">Original</option>
        <option value="best">Best Quality</option>
        <option value="medium">Medium Quality</option>
        <option value="low">Low Quality</option>
      </select>
    `;
    
    // Add event listeners
    const checkbox = item.querySelector(`#${sourceId}`) as HTMLInputElement;
    checkbox?.addEventListener('change', () => {
      this.updateSelection(sourceId, source, checkbox.checked);
    });
    
    const qualitySelector = item.querySelector(`#${sourceId}_quality`) as HTMLSelectElement;
    qualitySelector?.addEventListener('change', () => {
      this.updateQualitySelection(sourceId, qualitySelector.value);
    });
    
    return item;
  }

  /**
   * Update selection state
   */
  private updateSelection(sourceId: string, source: MediaSource, selected: boolean): void {
    if (selected) {
      this.selections.set(sourceId, {
        source,
        selected: true,
        format: source.format,
        quality: source.quality
      });
    } else {
      this.selections.delete(sourceId);
    }
    
    this.updateDownloadButton();
    this.updateStats();
  }

  /**
   * Update quality selection
   */
  private updateQualitySelection(sourceId: string, quality: string): void {
    const selection = this.selections.get(sourceId);
    if (selection) {
      // Update quality based on selection
      // This would involve more complex logic in a real implementation
      this.selections.set(sourceId, { ...selection, quality: selection.quality });
    }
  }

  /**
   * Update the download button state
   */
  private updateDownloadButton(): void {
    const downloadBtn = this.shadowRoot?.getElementById('downloadBtn') as HTMLButtonElement;
    if (downloadBtn) {
      const selectedCount = this.selections.size;
      downloadBtn.disabled = selectedCount === 0;
      downloadBtn.textContent = selectedCount > 0 ? `Download ${selectedCount} Selected` : 'Download Selected';
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const stats = this.shadowRoot?.getElementById('stats');
    if (stats) {
      const totalSources = this.currentSources.length;
      const selectedSources = this.selections.size;
      const totalSize = this.calculateTotalSize();
      
      stats.textContent = `${totalSources} sources found, ${selectedSources} selected${totalSize ? `, ~${totalSize}` : ''}`;
    }
  }

  /**
   * Calculate total size of selected sources
   */
  private calculateTotalSize(): string {
    let totalBytes = 0;
    let hasSize = false;
    
    for (const selection of this.selections.values()) {
      if (selection.source.size) {
        totalBytes += selection.source.size;
        hasSize = true;
      }
    }
    
    return hasSize ? this.formatBytes(totalBytes) : '';
  }

  /**
   * Select all sources
   */
  private selectAll(): void {
    this.currentSources.forEach((source, index) => {
      const sourceId = `source_${index}`;
      const checkbox = this.shadowRoot?.getElementById(sourceId) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = true;
        this.updateSelection(sourceId, source, true);
      }
    });
  }

  /**
   * Select no sources
   */
  private selectNone(): void {
    this.selections.clear();
    const checkboxes = this.shadowRoot?.querySelectorAll('.source-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes?.forEach(checkbox => checkbox.checked = false);
    this.updateDownloadButton();
    this.updateStats();
  }

  /**
   * Select best quality sources
   */
  private selectBestQuality(): void {
    this.selectNone();
    
    // Group sources by type and select the best quality for each
    const videoSources = this.currentSources.filter(s => s.type === MediaType.VIDEO);
    const audioSources = this.currentSources.filter(s => s.type === MediaType.AUDIO);
    
    const bestVideo = this.getBestQualitySource(videoSources);
    const bestAudio = this.getBestQualitySource(audioSources);
    
    [bestVideo, bestAudio].forEach(source => {
      if (source) {
        const index = this.currentSources.indexOf(source);
        const sourceId = `source_${index}`;
        const checkbox = this.shadowRoot?.getElementById(sourceId) as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = true;
          this.updateSelection(sourceId, source, true);
        }
      }
    });
  }

  /**
   * Get best quality source from array
   */
  private getBestQualitySource(sources: MediaSource[]): MediaSource | null {
    if (sources.length === 0) return null;
    
    return sources.reduce((best, current) => {
      const bestQuality = best.quality as VideoQuality;
      const currentQuality = current.quality as VideoQuality;
      
      if (!bestQuality && currentQuality) return current;
      if (bestQuality && !currentQuality) return best;
      if (!bestQuality && !currentQuality) return best;
      
      // Compare by resolution, then bitrate
      const bestScore = (bestQuality.width || 0) * (bestQuality.height || 0) + (bestQuality.bitrate || 0);
      const currentScore = (currentQuality.width || 0) * (currentQuality.height || 0) + (currentQuality.bitrate || 0);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Start downloads for selected sources
   */
  private startDownloads(): void {
    const selectedSources = Array.from(this.selections.values());
    
    if (selectedSources.length === 0) {
      this.showError('No sources selected for download');
      return;
    }
    
    this.log(`Starting download of ${selectedSources.length} sources`, 'INFO');
    
    // Show progress section
    const progressSection = this.shadowRoot?.getElementById('progressSection');
    if (progressSection) {
      progressSection.style.display = 'block';
    }
    
    // Dispatch download event
    const event = new CustomEvent('pegaTudoStartDownloads', {
      detail: {
        selections: selectedSources,
        options: this.getDownloadOptions()
      }
    });
    
    window.dispatchEvent(event);
    
    this.showSuccess(`Started downloading ${selectedSources.length} files`);
  }

  /**
   * Get download options from advanced settings
   */
  private getDownloadOptions(): any {
    const filenamePattern = (this.shadowRoot?.getElementById('filenamePattern') as HTMLInputElement)?.value || '{title}.{ext}';
    const concurrentDownloads = parseInt((this.shadowRoot?.getElementById('concurrentDownloads') as HTMLSelectElement)?.value || '2');
    const autoRetry = (this.shadowRoot?.getElementById('autoRetry') as HTMLSelectElement)?.value === 'true';
    
    return {
      filenamePattern,
      concurrentDownloads,
      autoRetry
    };
  }

  /**
   * Toggle advanced options
   */
  private toggleAdvancedOptions(): void {
    const advancedOptions = this.shadowRoot?.getElementById('advancedOptions');
    if (advancedOptions) {
      advancedOptions.classList.toggle('visible');
    }
  }

  /**
   * Update progress display
   */
  private updateProgressDisplay(progress: DownloadProgress): void {
    const progressList = this.shadowRoot?.getElementById('progressList');
    if (!progressList) return;
    
    let progressItem = this.shadowRoot?.getElementById(`progress_${progress.downloadId}`);
    
    if (!progressItem) {
      progressItem = document.createElement('div');
      progressItem.className = 'progress-item';
      progressItem.id = `progress_${progress.downloadId}`;
      progressList.appendChild(progressItem);
    }
    
    const statusClass = progress.status === DownloadStatus.FAILED ? 'error' : 
                       progress.status === DownloadStatus.COMPLETED ? 'completed' : '';
    
    progressItem.innerHTML = `
      <div class="progress-header">
        <div class="progress-filename">${progress.filename}</div>
        <div class="progress-percentage">${progress.progress}%</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${statusClass}" style="width: ${progress.progress}%"></div>
      </div>
      <div class="progress-details">
        <span>${progress.status}</span>
        ${progress.speed ? `<span>${this.formatSpeed(progress.speed)}</span>` : ''}
        ${progress.eta ? `<span>ETA: ${this.formatTime(progress.eta)}</span>` : ''}
      </div>
      ${progress.error ? `<div style="color: #f44336; font-size: 11px; margin-top: 4px;">${progress.error}</div>` : ''}
    `;
  }

  /**
   * Make UI visible
   */
  private makeVisible(): void {
    if (this.container && this.shadowRoot) {
      const panel = this.shadowRoot.querySelector('.main-panel');
      panel?.classList.add('visible');
      this.isVisible = true;
    }
  }

  /**
   * Make UI invisible
   */
  private makeInvisible(): void {
    if (this.container && this.shadowRoot) {
      const panel = this.shadowRoot.querySelector('.main-panel');
      panel?.classList.remove('visible');
      this.isVisible = false;
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (this.container && !this.isVisible) {
          this.container.remove();
          this.container = null;
          this.shadowRoot = null;
        }
      }, 300);
    }
  }

  /**
   * Schedule auto-hide
   */
  private scheduleAutoHide(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
    
    this.autoHideTimer = window.setTimeout(() => {
      this.hide();
    }, this.uiConfig.autoHideDelay);
  }

  /**
   * Create toast notification
   */
  private createToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('visible'), 100);
    
    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Update selections based on current sources
   */
  private updateSelections(): void {
    // Clear selections that are no longer valid
    const validIds = this.currentSources.map((_, index) => `source_${index}`);
    const currentIds = Array.from(this.selections.keys());
    
    currentIds.forEach(id => {
      if (!validIds.includes(id)) {
        this.selections.delete(id);
      }
    });
  }

  // Utility methods

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private formatSpeed(bytesPerSecond: number): string {
    return this.formatBytes(bytesPerSecond) + '/s';
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  private getDefaultDebugConfig(): DebugConfig {
    return {
      enabled: false,
      level: 'INFO',
      logNetworkRequests: false,
      logDetectionResults: false,
      logCryptoOperations: false,
      saveToFile: false
    };
  }

  private getDefaultUIConfig(): UIConfig {
    return {
      position: 'top-right',
      theme: 'auto',
      animations: true,
      autoHide: false,
      autoHideDelay: 5000,
      showAdvancedOptions: true,
      maxVisibleSources: 10
    };
  }

  private log(message: string, level: keyof { DEBUG: 0; INFO: 1; WARN: 2; ERROR: 3 }): void {
    if (!this.debugConfig.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] UI: ${message}`;
    
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