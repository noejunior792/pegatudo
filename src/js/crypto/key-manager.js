/**
 * Advanced Key Management System for PegaTudo
 * Handles secure key storage, retrieval, and lifecycle management
 */

import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';
import { EncryptionMethod } from '../core/types.js';

export class AdvancedKeyManager {
  constructor(options = {}) {
    this.config = {
      maxCacheSize: options.maxCacheSize || 10000,
      keyExpirationTime: options.keyExpirationTime || 3600000, // 1 hour
      enableSecureStorage: options.enableSecureStorage !== false,
      encryptStorage: options.encryptStorage || false,
      keyRotationInterval: options.keyRotationInterval || 86400000, // 24 hours
      backupKeys: options.backupKeys || true,
      compressionEnabled: options.compressionEnabled || true,
      ...options
    };

    this.keyStore = new Map();
    this.sessionKeys = new Map();
    this.keyMetadata = new Map();
    this.keyUsageStats = new Map();
    this.keyValidationRules = new Map();
    this.keyProviders = new Map();
    this.keyBackups = new Map();
    
    this.storageBackend = null;
    this.encryptionKey = null;
    this.compressionWorker = null;

    this.metrics = {
      keysStored: 0,
      keysRetrieved: 0,
      keysFetched: 0,
      keysExpired: 0,
      keysRotated: 0,
      keyValidationFailures: 0,
      storageOperations: 0
    };

    this.init();
  }

  async init() {
    try {
      // Initialize storage backend
      await this.initializeStorage();

      // Initialize encryption for secure storage
      if (this.config.encryptStorage) {
        await this.initializeStorageEncryption();
      }

      // Initialize compression worker
      if (this.config.compressionEnabled) {
        await this.initializeCompression();
      }

      // Setup key rotation
      this.setupKeyRotation();

      // Setup cache cleanup
      this.setupCacheCleanup();

      // Load existing keys
      await this.loadStoredKeys();

      // Register default key providers
      this.registerDefaultProviders();

      logger.info('Advanced Key Manager initialized', {
        storageBackend: this.storageBackend?.constructor.name,
        secureStorage: this.config.enableSecureStorage,
        compression: this.config.compressionEnabled
      });

      eventSystem.emit('keyManager:initialized', { manager: this });
    } catch (error) {
      logger.error('Failed to initialize key manager', error);
      throw error;
    }
  }

  async initializeStorage() {
    if (this.config.enableSecureStorage) {
      // Try to use IndexedDB for secure storage
      if (typeof indexedDB !== 'undefined') {
        this.storageBackend = new IndexedDBKeyStorage();
        await this.storageBackend.init();
      } else if (typeof chrome !== 'undefined' && chrome.storage) {
        this.storageBackend = new ChromeStorageKeyStorage();
        await this.storageBackend.init();
      } else {
        // Fallback to localStorage with warning
        this.storageBackend = new LocalStorageKeyStorage();
        logger.warn('Using localStorage for key storage - not recommended for production');
      }
    }
  }

  async initializeStorageEncryption() {
    if (!crypto.subtle) {
      logger.warn('Web Crypto API not available, storage encryption disabled');
      this.config.encryptStorage = false;
      return;
    }

    try {
      // Generate or load encryption key for storage
      const stored = await this.storageBackend?.get('__storage_key__');
      if (stored) {
        this.encryptionKey = await crypto.subtle.importKey(
          'raw', 
          stored, 
          { name: 'AES-GCM' }, 
          false, 
          ['encrypt', 'decrypt']
        );
      } else {
        // Generate new encryption key
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        // Store the key
        const exportedKey = await crypto.subtle.exportKey('raw', this.encryptionKey);
        await this.storageBackend?.set('__storage_key__', exportedKey);
      }
    } catch (error) {
      logger.error('Failed to initialize storage encryption', error);
      this.config.encryptStorage = false;
    }
  }

  async initializeCompression() {
    if (typeof Worker === 'undefined') {
      logger.warn('Web Workers not available, compression disabled');
      this.config.compressionEnabled = false;
      return;
    }

    try {
      const workerCode = `
        self.onmessage = async function(e) {
          const { id, action, data } = e.data;
          
          try {
            let result;
            
            if (action === 'compress') {
              result = await compress(data);
            } else if (action === 'decompress') {
              result = await decompress(data);
            }
            
            self.postMessage({ id, success: true, result });
          } catch (error) {
            self.postMessage({ id, success: false, error: error.message });
          }
        };
        
        async function compress(data) {
          const stream = new CompressionStream('gzip');
          const writer = stream.writable.getWriter();
          const reader = stream.readable.getReader();
          
          writer.write(data);
          writer.close();
          
          const chunks = [];
          let done, value;
          while (!done) {
            ({ done, value } = await reader.read());
            if (value) chunks.push(value);
          }
          
          return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
        }
        
        async function decompress(data) {
          const stream = new DecompressionStream('gzip');
          const writer = stream.writable.getWriter();
          const reader = stream.readable.getReader();
          
          writer.write(data);
          writer.close();
          
          const chunks = [];
          let done, value;
          while (!done) {
            ({ done, value } = await reader.read());
            if (value) chunks.push(value);
          }
          
          return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
        }
      `;

      this.compressionWorker = new Worker(
        URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }))
      );

      this.compressionWorker.onmessage = this.handleCompressionMessage.bind(this);
    } catch (error) {
      logger.warn('Failed to initialize compression worker', error);
      this.config.compressionEnabled = false;
    }
  }

  handleCompressionMessage(event) {
    const { id, success, result, error } = event.data;
    const pendingOperation = this.pendingCompressionOperations?.get(id);
    
    if (pendingOperation) {
      if (success) {
        pendingOperation.resolve(result);
      } else {
        pendingOperation.reject(new Error(error));
      }
      this.pendingCompressionOperations.delete(id);
    }
  }

  setupKeyRotation() {
    setInterval(() => {
      this.rotateExpiredKeys();
    }, this.config.keyRotationInterval);
  }

  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredKeys();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async loadStoredKeys() {
    if (!this.storageBackend) return;

    try {
      const storedKeys = await this.storageBackend.getAll();
      let loadedCount = 0;

      for (const [keyId, encryptedData] of Object.entries(storedKeys)) {
        if (keyId.startsWith('__')) continue; // Skip system keys
        
        try {
          const keyData = await this.decryptStorageData(encryptedData);
          const parsed = JSON.parse(new TextDecoder().decode(keyData));
          
          this.keyStore.set(keyId, parsed.key);
          this.keyMetadata.set(keyId, parsed.metadata);
          loadedCount++;
        } catch (error) {
          logger.warn(`Failed to load stored key ${keyId}`, error);
        }
      }

      logger.info(`Loaded ${loadedCount} stored keys`);
    } catch (error) {
      logger.error('Failed to load stored keys', error);
    }
  }

  registerDefaultProviders() {
    // HTTP/HTTPS key provider
    this.registerKeyProvider('http', async (keyUri, options = {}) => {
      const response = await fetch(keyUri, {
        method: 'GET',
        headers: {
          'User-Agent': config.get('network.userAgent'),
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          ...options.headers
        },
        signal: AbortSignal.timeout(options.timeout || 10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    });

    // Data URI provider
    this.registerKeyProvider('data', async (keyUri) => {
      if (!keyUri.startsWith('data:')) {
        throw new Error('Invalid data URI');
      }

      const response = await fetch(keyUri);
      return new Uint8Array(await response.arrayBuffer());
    });

    // Local storage provider
    this.registerKeyProvider('storage', async (keyId) => {
      const stored = this.keyStore.get(keyId);
      if (!stored) {
        throw new Error(`Key not found: ${keyId}`);
      }
      return stored;
    });
  }

  // Key storage and retrieval
  async storeKey(keyId, keyData, metadata = {}) {
    try {
      // Validate key data
      if (!this.validateKey(keyData, metadata)) {
        throw new Error('Key validation failed');
      }

      // Store in memory cache
      this.keyStore.set(keyId, keyData);
      
      // Store metadata
      const keyMetadata = {
        id: keyId,
        timestamp: Date.now(),
        size: keyData.byteLength || keyData.length,
        type: metadata.type || 'unknown',
        method: metadata.method || EncryptionMethod.NONE,
        usage: metadata.usage || [],
        expiresAt: metadata.expiresAt || (Date.now() + this.config.keyExpirationTime),
        source: metadata.source || 'unknown',
        ...metadata
      };
      this.keyMetadata.set(keyId, keyMetadata);

      // Store persistently if enabled
      if (this.storageBackend) {
        await this.persistKey(keyId, keyData, keyMetadata);
      }

      // Create backup if enabled
      if (this.config.backupKeys) {
        this.createKeyBackup(keyId, keyData, keyMetadata);
      }

      this.metrics.keysStored++;
      logger.debug(`Key stored: ${keyId}`, { metadata: keyMetadata });
      
      eventSystem.emit('keyManager:keyStored', { keyId, metadata: keyMetadata });
      
      return keyId;
    } catch (error) {
      logger.error(`Failed to store key ${keyId}`, error);
      throw error;
    }
  }

  async retrieveKey(keyId, options = {}) {
    try {
      // Check memory cache first
      let keyData = this.keyStore.get(keyId);
      let metadata = this.keyMetadata.get(keyId);

      if (!keyData) {
        // Try to load from persistent storage
        if (this.storageBackend) {
          const storedData = await this.storageBackend.get(keyId);
          if (storedData) {
            const decrypted = await this.decryptStorageData(storedData);
            const parsed = JSON.parse(new TextDecoder().decode(decrypted));
            keyData = parsed.key;
            metadata = parsed.metadata;
            
            // Cache in memory
            this.keyStore.set(keyId, keyData);
            this.keyMetadata.set(keyId, metadata);
          }
        }
      }

      if (!keyData) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Check expiration
      if (metadata?.expiresAt && Date.now() > metadata.expiresAt) {
        this.removeKey(keyId);
        throw new Error(`Key expired: ${keyId}`);
      }

      // Update usage statistics
      this.updateKeyUsage(keyId);

      this.metrics.keysRetrieved++;
      logger.debug(`Key retrieved: ${keyId}`);
      
      return keyData;
    } catch (error) {
      logger.error(`Failed to retrieve key ${keyId}`, error);
      throw error;
    }
  }

  async fetchKey(keyUri, options = {}) {
    try {
      // Check if already cached
      const cacheKey = this.generateCacheKey(keyUri, options);
      const cached = await this.retrieveKey(cacheKey, { throwOnNotFound: false });
      
      if (cached) {
        logger.debug(`Using cached key for URI: ${keyUri}`);
        return cached;
      }

      // Determine provider based on URI scheme
      const scheme = this.getUriScheme(keyUri);
      const provider = this.keyProviders.get(scheme);
      
      if (!provider) {
        throw new Error(`No key provider for scheme: ${scheme}`);
      }

      // Fetch key using provider
      logger.debug(`Fetching key from URI: ${keyUri}`);
      const keyData = await provider(keyUri, options);
      
      // Validate fetched key
      if (!keyData || keyData.length === 0) {
        throw new Error('Empty key data received');
      }

      // Store in cache
      await this.storeKey(cacheKey, keyData, {
        source: keyUri,
        scheme,
        fetchedAt: Date.now(),
        ...options.metadata
      });

      this.metrics.keysFetched++;
      logger.debug(`Key fetched and cached: ${keyUri}`);
      
      eventSystem.emit('keyManager:keyFetched', { keyUri, keyId: cacheKey });
      
      return keyData;
    } catch (error) {
      logger.error(`Failed to fetch key from ${keyUri}`, error);
      throw error;
    }
  }

  // Key management operations
  async removeKey(keyId) {
    try {
      // Remove from memory
      this.keyStore.delete(keyId);
      this.keyMetadata.delete(keyId);
      this.keyUsageStats.delete(keyId);
      this.keyBackups.delete(keyId);

      // Remove from persistent storage
      if (this.storageBackend) {
        await this.storageBackend.remove(keyId);
      }

      logger.debug(`Key removed: ${keyId}`);
      eventSystem.emit('keyManager:keyRemoved', { keyId });
      
      return true;
    } catch (error) {
      logger.error(`Failed to remove key ${keyId}`, error);
      return false;
    }
  }

  async clearKeys(filter = {}) {
    let removedCount = 0;
    
    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      let shouldRemove = true;
      
      if (filter.type && metadata.type !== filter.type) {
        shouldRemove = false;
      }
      
      if (filter.olderThan && metadata.timestamp > filter.olderThan) {
        shouldRemove = false;
      }
      
      if (filter.method && metadata.method !== filter.method) {
        shouldRemove = false;
      }
      
      if (shouldRemove && await this.removeKey(keyId)) {
        removedCount++;
      }
    }
    
    logger.info(`Cleared ${removedCount} keys`);
    return removedCount;
  }

  cleanupExpiredKeys() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      if (metadata.expiresAt && now > metadata.expiresAt) {
        this.removeKey(keyId);
        expiredCount++;
        this.metrics.keysExpired++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`Cleaned up ${expiredCount} expired keys`);
    }
  }

  rotateExpiredKeys() {
    // Implementation would depend on specific key rotation policies
    // For now, just cleanup expired keys
    this.cleanupExpiredKeys();
  }

  // Key validation
  validateKey(keyData, metadata = {}) {
    try {
      // Basic validation
      if (!keyData) {
        return false;
      }

      const keyLength = keyData.byteLength || keyData.length;
      
      // Check key length based on encryption method
      if (metadata.method) {
        const expectedLengths = {
          [EncryptionMethod.AES_128]: [16],
          [EncryptionMethod.AES_128_CTR]: [16],
          [EncryptionMethod.AES_256]: [32],
          [EncryptionMethod.AES_256_CTR]: [32],
          [EncryptionMethod.SAMPLE_AES]: [16],
          [EncryptionMethod.SAMPLE_AES_CTR]: [16]
        };
        
        const expected = expectedLengths[metadata.method];
        if (expected && !expected.includes(keyLength)) {
          logger.warn(`Invalid key length for ${metadata.method}: ${keyLength} bytes`);
          this.metrics.keyValidationFailures++;
          return false;
        }
      }

      // Custom validation rules
      const validationRule = this.keyValidationRules.get(metadata.type);
      if (validationRule && !validationRule(keyData, metadata)) {
        this.metrics.keyValidationFailures++;
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Key validation error', error);
      this.metrics.keyValidationFailures++;
      return false;
    }
  }

  // Provider management
  registerKeyProvider(scheme, provider) {
    if (typeof provider !== 'function') {
      throw new Error('Key provider must be a function');
    }
    
    this.keyProviders.set(scheme, provider);
    logger.debug(`Key provider registered for scheme: ${scheme}`);
  }

  unregisterKeyProvider(scheme) {
    return this.keyProviders.delete(scheme);
  }

  // Utility methods
  generateCacheKey(keyUri, options = {}) {
    const hash = this.simpleHash(keyUri + JSON.stringify(options));
    return `cache_${hash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  getUriScheme(uri) {
    const match = uri.match(/^([^:]+):/);
    return match ? match[1].toLowerCase() : 'http';
  }

  updateKeyUsage(keyId) {
    const stats = this.keyUsageStats.get(keyId) || {
      accessCount: 0,
      lastAccessed: 0,
      firstAccessed: Date.now()
    };
    
    stats.accessCount++;
    stats.lastAccessed = Date.now();
    
    this.keyUsageStats.set(keyId, stats);
  }

  // Storage encryption
  async encryptStorageData(data) {
    if (!this.config.encryptStorage || !this.encryptionKey) {
      return data;
    }

    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        data
      );
      
      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv, 0);
      result.set(new Uint8Array(encrypted), iv.length);
      
      return result;
    } catch (error) {
      logger.error('Storage encryption failed', error);
      return data;
    }
  }

  async decryptStorageData(encryptedData) {
    if (!this.config.encryptStorage || !this.encryptionKey) {
      return encryptedData;
    }

    try {
      const iv = encryptedData.slice(0, 12);
      const encrypted = encryptedData.slice(12);
      
      return await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encrypted
      );
    } catch (error) {
      logger.error('Storage decryption failed', error);
      return encryptedData;
    }
  }

  // Backup and restore
  createKeyBackup(keyId, keyData, metadata) {
    this.keyBackups.set(keyId, {
      keyData: new Uint8Array(keyData),
      metadata: { ...metadata },
      backupTime: Date.now()
    });
  }

  async restoreKeyFromBackup(keyId) {
    const backup = this.keyBackups.get(keyId);
    if (!backup) {
      throw new Error(`No backup found for key: ${keyId}`);
    }
    
    await this.storeKey(keyId, backup.keyData, backup.metadata);
    logger.info(`Key restored from backup: ${keyId}`);
  }

  // Persistent storage
  async persistKey(keyId, keyData, metadata) {
    if (!this.storageBackend) return;

    try {
      const payload = {
        key: Array.from(new Uint8Array(keyData)),
        metadata
      };
      
      const jsonData = new TextEncoder().encode(JSON.stringify(payload));
      const compressed = this.config.compressionEnabled ? 
        await this.compressData(jsonData) : jsonData;
      const encrypted = await this.encryptStorageData(compressed);
      
      await this.storageBackend.set(keyId, encrypted);
      this.metrics.storageOperations++;
    } catch (error) {
      logger.error(`Failed to persist key ${keyId}`, error);
    }
  }

  async compressData(data) {
    if (!this.compressionWorker) return data;

    return new Promise((resolve, reject) => {
      const id = `compress_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      
      if (!this.pendingCompressionOperations) {
        this.pendingCompressionOperations = new Map();
      }
      
      this.pendingCompressionOperations.set(id, { resolve, reject });
      this.compressionWorker.postMessage({ id, action: 'compress', data });
    });
  }

  // Statistics and monitoring
  getKeyStatistics() {
    return {
      totalKeys: this.keyStore.size,
      metadataEntries: this.keyMetadata.size,
      usageStats: this.keyUsageStats.size,
      backups: this.keyBackups.size,
      providers: this.keyProviders.size,
      metrics: this.metrics
    };
  }

  getKeyInfo(keyId) {
    return {
      exists: this.keyStore.has(keyId),
      metadata: this.keyMetadata.get(keyId),
      usage: this.keyUsageStats.get(keyId),
      hasBackup: this.keyBackups.has(keyId)
    };
  }

  // Cleanup
  destroy() {
    this.keyStore.clear();
    this.keyMetadata.clear();
    this.keyUsageStats.clear();
    this.keyBackups.clear();
    this.keyProviders.clear();
    
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }
    
    logger.info('Key manager destroyed');
  }
}

// Storage backends
class IndexedDBKeyStorage {
  constructor() {
    this.dbName = 'PegaTudoKeys';
    this.dbVersion = 1;
    this.storeName = 'keys';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async set(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = {};
        const keys = request.result;
        // Note: This is simplified - actual implementation would need to get keys and values
        resolve(result);
      };
    });
  }
}

class ChromeStorageKeyStorage {
  async init() {
    // No initialization needed
  }

  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve);
    });
  }

  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, resolve);
    });
  }
}

class LocalStorageKeyStorage {
  async init() {
    // No initialization needed
  }

  async get(key) {
    const stored = localStorage.getItem(`pegatudo_key_${key}`);
    return stored ? JSON.parse(stored) : undefined;
  }

  async set(key, value) {
    localStorage.setItem(`pegatudo_key_${key}`, JSON.stringify(value));
  }

  async remove(key) {
    localStorage.removeItem(`pegatudo_key_${key}`);
  }

  async getAll() {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('pegatudo_key_')) {
        const keyId = key.replace('pegatudo_key_', '');
        result[keyId] = JSON.parse(localStorage.getItem(key));
      }
    }
    return result;
  }
}

// Export default instance
export const keyManager = new AdvancedKeyManager();

export default AdvancedKeyManager;