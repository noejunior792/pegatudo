/**
 * Advanced Configuration Manager for PegaTudo
 * Handles settings, preferences, profiles, and configuration persistence
 */

import { logger } from './logger.js';
import { Platform, VideoQualityPresets, AudioQualityPresets, LogLevel } from './types.js';

export class ConfigurationManager {
  constructor() {
    this.config = {
      // Core Settings
      version: '3.0.0',
      enabled: true,
      debugMode: false,
      
      // Download Settings
      download: {
        defaultPath: '',
        maxConcurrent: 3,
        retryAttempts: 3,
        retryDelay: 2000,
        timeout: 30000,
        bufferSize: 1024 * 1024, // 1MB
        overwriteFiles: false,
        createSubfolders: true,
        organizeByDate: false,
        organizeByPlatform: true,
        filenameTemplate: '{title}_{quality}.{ext}',
        maxFilenameLength: 255,
        sanitizeFilenames: true
      },

      // Quality Settings
      quality: {
        preferredVideo: 'FHD_1080P',
        preferredAudio: 'HIGH',
        autoSelectBest: true,
        allowLowerQuality: true,
        skipIfQualityUnavailable: false,
        prioritizeFormat: ['mp4', 'webm', 'mkv'],
        skipEncrypted: false,
        maxFileSize: 5 * 1024 * 1024 * 1024 // 5GB
      },

      // Network Settings
      network: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timeout: 30000,
        retries: 3,
        concurrentConnections: 6,
        randomizeRequests: true,
        useProxy: false,
        proxyList: [],
        bypassCORS: true,
        respectRobotsTxt: false,
        rateLimiting: {
          enabled: true,
          requestsPerSecond: 10,
          burstLimit: 50
        }
      },

      // Extraction Settings
      extraction: {
        enabledPlatforms: Object.values(Platform),
        scanDepth: 3,
        followRedirects: true,
        maxRedirects: 10,
        scanIframes: true,
        scanShadowDOM: true,
        interceptNetworkRequests: true,
        parseManifests: true,
        detectLiveStreams: true,
        extractSubtitles: true,
        extractThumbnails: true,
        extractMetadata: true
      },

      // Security Settings
      security: {
        allowedDomains: [],
        blockedDomains: [],
        validateSSL: true,
        sandboxMode: false,
        stealthMode: true,
        antiDetection: {
          enabled: true,
          randomizeUserAgent: true,
          spoofHeaders: true,
          mimicBrowser: true,
          avoidFingerprinting: true
        }
      },

      // UI Settings
      ui: {
        theme: 'dark',
        language: 'en',
        showNotifications: true,
        showProgress: true,
        autoHideButtons: false,
        buttonPosition: 'top-right',
        buttonSize: 'medium',
        showTooltips: true,
        animationsEnabled: true,
        compactMode: false
      },

      // Logging Settings
      logging: {
        enabled: true,
        level: 'INFO',
        categories: {
          network: true,
          detection: true,
          crypto: true,
          downloads: true,
          errors: true
        },
        saveToFile: false,
        maxLogSize: 10 * 1024 * 1024, // 10MB
        persistLogs: false
      },

      // Scheduling Settings
      scheduling: {
        enabled: false,
        queue: [],
        autoStart: false,
        scheduleFormat: 'cron',
        timezone: 'UTC',
        maxScheduledDownloads: 100,
        retryFailedDownloads: true,
        cleanupOldSchedules: true,
        cleanupAfterDays: 30
      },

      // Filter Settings
      filters: {
        enabled: false,
        rules: [],
        defaultAction: 'allow',
        categories: {
          duration: { enabled: false, min: 0, max: Infinity },
          fileSize: { enabled: false, min: 0, max: Infinity },
          quality: { enabled: false, minWidth: 0, minHeight: 0 },
          format: { enabled: false, whitelist: [], blacklist: [] },
          platform: { enabled: false, whitelist: [], blacklist: [] }
        }
      },

      // Export/Import Settings
      backup: {
        autoBackup: true,
        backupInterval: 24 * 60 * 60 * 1000, // 24 hours
        maxBackups: 10,
        includeDownloadHistory: true,
        includeSettings: true,
        includeLogs: false,
        encryptBackups: false,
        backupLocation: 'cloud'
      }
    };

    this.profiles = new Map();
    this.activeProfile = 'default';
    this.listeners = new Map();
    this.initialized = false;

    this.init();
  }

  async init() {
    try {
      await this.loadConfiguration();
      await this.loadProfiles();
      this.setupAutoSave();
      this.initialized = true;
      logger.info('Configuration Manager initialized', { 
        activeProfile: this.activeProfile,
        profileCount: this.profiles.size 
      });
    } catch (error) {
      logger.error('Failed to initialize Configuration Manager', error);
    }
  }

  async loadConfiguration() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.sync.get(['pegatudo_config']);
        if (result.pegatudo_config) {
          this.config = this.mergeConfigs(this.config, result.pegatudo_config);
          logger.debug('Configuration loaded from Chrome storage');
        }
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('pegatudo_config');
        if (stored) {
          this.config = this.mergeConfigs(this.config, JSON.parse(stored));
          logger.debug('Configuration loaded from localStorage');
        }
      }
    } catch (error) {
      logger.warn('Failed to load configuration, using defaults', error);
    }
  }

  async loadProfiles() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['pegatudo_profiles']);
        if (result.pegatudo_profiles) {
          const profiles = result.pegatudo_profiles;
          for (const [name, profile] of Object.entries(profiles)) {
            this.profiles.set(name, profile);
          }
        }
      }
      
      // Ensure default profile exists
      if (!this.profiles.has('default')) {
        this.profiles.set('default', {
          name: 'Default',
          description: 'Default configuration profile',
          config: { ...this.config },
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.warn('Failed to load profiles', error);
    }
  }

  mergeConfigs(base, override) {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  setupAutoSave() {
    setInterval(() => {
      this.saveConfiguration();
    }, 5 * 60 * 1000); // Save every 5 minutes
  }

  async saveConfiguration() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.sync.set({ pegatudo_config: this.config });
        logger.debug('Configuration saved to Chrome storage');
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pegatudo_config', JSON.stringify(this.config));
        logger.debug('Configuration saved to localStorage');
      }
      
      this.notifyListeners('configSaved', this.config);
    } catch (error) {
      logger.error('Failed to save configuration', error);
    }
  }

  async saveProfiles() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const profiles = Object.fromEntries(this.profiles);
        await chrome.storage.local.set({ pegatudo_profiles: profiles });
        logger.debug('Profiles saved', { count: this.profiles.size });
      }
    } catch (error) {
      logger.error('Failed to save profiles', error);
    }
  }

  // Configuration getters
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  // Configuration setters
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    this.notifyListeners('configChanged', { path, value, oldValue });
    
    // Auto-save after changes
    setTimeout(() => this.saveConfiguration(), 1000);
    
    return this;
  }

  // Bulk update
  update(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
    return this;
  }

  // Reset to defaults
  reset(path = null) {
    if (path) {
      // Reset specific section
      const defaultValue = this.getDefaultValue(path);
      if (defaultValue !== undefined) {
        this.set(path, defaultValue);
      }
    } else {
      // Reset entire config
      this.config = this.getDefaultConfig();
      this.notifyListeners('configReset', this.config);
      this.saveConfiguration();
    }
    return this;
  }

  getDefaultConfig() {
    // Return a fresh copy of the default configuration
    return JSON.parse(JSON.stringify(new ConfigurationManager().config));
  }

  getDefaultValue(path) {
    const defaultConfig = this.getDefaultConfig();
    return this.getValueFromPath(defaultConfig, path);
  }

  getValueFromPath(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  // Profile management
  createProfile(name, description = '', baseProfile = 'default') {
    if (this.profiles.has(name)) {
      throw new Error(`Profile '${name}' already exists`);
    }

    const baseConfig = baseProfile === 'default' ? 
      this.config : 
      this.profiles.get(baseProfile)?.config || this.config;

    const profile = {
      name,
      description,
      config: JSON.parse(JSON.stringify(baseConfig)),
      createdAt: new Date().toISOString(),
      lastUsed: null
    };

    this.profiles.set(name, profile);
    this.saveProfiles();
    
    logger.info(`Created profile: ${name}`);
    return profile;
  }

  deleteProfile(name) {
    if (name === 'default') {
      throw new Error('Cannot delete default profile');
    }

    if (this.activeProfile === name) {
      this.switchProfile('default');
    }

    const deleted = this.profiles.delete(name);
    if (deleted) {
      this.saveProfiles();
      logger.info(`Deleted profile: ${name}`);
    }
    
    return deleted;
  }

  switchProfile(name) {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    const profile = this.profiles.get(name);
    this.config = JSON.parse(JSON.stringify(profile.config));
    this.activeProfile = name;
    
    profile.lastUsed = new Date().toISOString();
    this.saveProfiles();
    
    this.notifyListeners('profileSwitched', { name, profile });
    logger.info(`Switched to profile: ${name}`);
    
    return this;
  }

  getProfiles() {
    return Array.from(this.profiles.entries()).map(([name, profile]) => ({
      name,
      ...profile,
      isActive: name === this.activeProfile
    }));
  }

  exportProfile(name = this.activeProfile) {
    const profile = this.profiles.get(name);
    if (!profile) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    return {
      version: this.config.version,
      profile: JSON.parse(JSON.stringify(profile)),
      exportedAt: new Date().toISOString(),
      exportedBy: 'PegaTudo Configuration Manager'
    };
  }

  importProfile(data, overwrite = false) {
    if (!data.profile || !data.profile.name) {
      throw new Error('Invalid profile data');
    }

    const { name } = data.profile;
    
    if (this.profiles.has(name) && !overwrite) {
      throw new Error(`Profile '${name}' already exists`);
    }

    this.profiles.set(name, {
      ...data.profile,
      importedAt: new Date().toISOString()
    });

    this.saveProfiles();
    logger.info(`Imported profile: ${name}`);
    
    return data.profile;
  }

  // Event listeners
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    return () => this.removeListener(event, callback);
  }

  removeListener(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  notifyListeners(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const callback of eventListeners) {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event listener for '${event}'`, error);
        }
      }
    }
  }

  // Backup and restore
  async createBackup() {
    const backup = {
      version: this.config.version,
      timestamp: new Date().toISOString(),
      config: this.config,
      profiles: Object.fromEntries(this.profiles),
      activeProfile: this.activeProfile
    };

    if (this.get('backup.encryptBackups')) {
      // TODO: Implement encryption
      logger.warn('Backup encryption not implemented yet');
    }

    return backup;
  }

  async restoreBackup(backup) {
    if (!backup.config || !backup.profiles) {
      throw new Error('Invalid backup data');
    }

    // Validate backup version compatibility
    if (backup.version && !this.isVersionCompatible(backup.version)) {
      logger.warn(`Backup version ${backup.version} may not be compatible with current version ${this.config.version}`);
    }

    this.config = this.mergeConfigs(this.getDefaultConfig(), backup.config);
    
    this.profiles.clear();
    for (const [name, profile] of Object.entries(backup.profiles)) {
      this.profiles.set(name, profile);
    }

    if (backup.activeProfile && this.profiles.has(backup.activeProfile)) {
      this.activeProfile = backup.activeProfile;
    }

    await this.saveConfiguration();
    await this.saveProfiles();
    
    this.notifyListeners('backupRestored', backup);
    logger.info('Configuration restored from backup');
  }

  isVersionCompatible(version) {
    // Simple version compatibility check
    const [major] = version.split('.').map(Number);
    const [currentMajor] = this.config.version.split('.').map(Number);
    return major === currentMajor;
  }

  // Validation
  validateConfig(config = this.config) {
    const errors = [];

    // Validate download settings
    if (config.download.maxConcurrent < 1 || config.download.maxConcurrent > 10) {
      errors.push('download.maxConcurrent must be between 1 and 10');
    }

    if (config.download.retryAttempts < 0 || config.download.retryAttempts > 10) {
      errors.push('download.retryAttempts must be between 0 and 10');
    }

    // Validate network settings
    if (config.network.timeout < 1000 || config.network.timeout > 300000) {
      errors.push('network.timeout must be between 1000 and 300000 ms');
    }

    // Validate quality settings
    if (!VideoQualityPresets[config.quality.preferredVideo]) {
      errors.push(`Invalid preferred video quality: ${config.quality.preferredVideo}`);
    }

    if (!AudioQualityPresets[config.quality.preferredAudio]) {
      errors.push(`Invalid preferred audio quality: ${config.quality.preferredAudio}`);
    }

    return errors;
  }

  // Utility methods
  isEnabled() {
    return this.get('enabled', true);
  }

  isDebugMode() {
    return this.get('debugMode', false);
  }

  getDownloadPath() {
    return this.get('download.defaultPath', '');
  }

  getMaxConcurrentDownloads() {
    return this.get('download.maxConcurrent', 3);
  }

  getPreferredVideoQuality() {
    return this.get('quality.preferredVideo', 'FHD_1080P');
  }

  getPreferredAudioQuality() {
    return this.get('quality.preferredAudio', 'HIGH');
  }

  getNetworkTimeout() {
    return this.get('network.timeout', 30000);
  }

  // Health check
  getHealth() {
    const errors = this.validateConfig();
    const warnings = [];

    // Check for potential issues
    if (this.get('download.maxConcurrent', 3) > 5) {
      warnings.push('High concurrent download limit may impact performance');
    }

    if (this.get('network.timeout', 30000) < 5000) {
      warnings.push('Low network timeout may cause failed downloads');
    }

    return {
      healthy: errors.length === 0,
      errors,
      warnings,
      lastCheck: new Date().toISOString()
    };
  }
}

// Create global configuration instance
export const config = new ConfigurationManager();

// Export convenience functions
export const get = (path, defaultValue) => config.get(path, defaultValue);
export const set = (path, value) => config.set(path, value);
export const isEnabled = () => config.isEnabled();
export const isDebugMode = () => config.isDebugMode();

export default ConfigurationManager;