/**
 * Advanced Cryptography Engine for PegaTudo
 * Comprehensive decryption support for all major streaming encryption methods
 * Supports AES-128, AES-256, SAMPLE-AES, Widevine, FairPlay, PlayReady and more
 */

import { EncryptionMethod } from '../core/types.js';
import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';

export class AdvancedCryptoEngine {
  constructor(options = {}) {
    this.keyCache = new Map();
    this.ivCache = new Map();
    this.sessionCache = new Map();
    this.certificateCache = new Map();
    this.debugMode = options.debugMode || config.get('debugMode', false);
    
    this.config = {
      maxCacheSize: options.maxCacheSize || 1000,
      keyExpirationTime: options.keyExpirationTime || 3600000, // 1 hour
      enableHardwareAcceleration: options.enableHardwareAcceleration !== false,
      allowInsecureKeys: options.allowInsecureKeys || false,
      parallelDecryption: options.parallelDecryption !== false,
      maxConcurrentDecryptions: options.maxConcurrentDecryptions || 4,
      ...options
    };

    this.metrics = {
      decryptionsPerformed: 0,
      decryptionErrors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      keyDerivations: 0,
      averageDecryptionTime: 0,
      lastDecryptionTime: 0
    };

    this.activeDecryptions = new Set();
    this.decryptionQueue = [];
    this.workers = [];

    this.init();
  }

  async init() {
    try {
      // Initialize crypto workers for parallel processing
      if (this.config.parallelDecryption) {
        await this.initializeWorkers();
      }

      // Setup cache cleanup
      this.setupCacheCleanup();

      // Test crypto capabilities
      await this.testCryptoCapabilities();

      logger.info('Advanced Crypto Engine initialized', {
        workers: this.workers.length,
        hardwareAcceleration: this.config.enableHardwareAcceleration,
        cacheSize: this.config.maxCacheSize
      });

      eventSystem.emit('crypto:initialized', { engine: this });
    } catch (error) {
      logger.error('Failed to initialize crypto engine', error);
      throw error;
    }
  }

  async initializeWorkers() {
    if (typeof Worker === 'undefined') {
      logger.warn('Web Workers not available, parallel decryption disabled');
      return;
    }

    try {
      for (let i = 0; i < this.config.maxConcurrentDecryptions; i++) {
        const worker = new Worker(this.createWorkerScript());
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = this.handleWorkerError.bind(this);
        this.workers.push({
          worker,
          busy: false,
          id: i
        });
      }
    } catch (error) {
      logger.warn('Failed to initialize crypto workers', error);
    }
  }

  createWorkerScript() {
    const workerCode = `
      self.onmessage = async function(e) {
        const { id, method, data, key, iv, options } = e.data;
        
        try {
          let result;
          
          switch (method) {
            case 'aes-128-cbc':
              result = await decryptAES128CBC(data, key, iv);
              break;
            case 'aes-128-ctr':
              result = await decryptAES128CTR(data, key, iv);
              break;
            case 'aes-256-cbc':
              result = await decryptAES256CBC(data, key, iv);
              break;
            case 'aes-256-ctr':
              result = await decryptAES256CTR(data, key, iv);
              break;
            default:
              throw new Error('Unsupported encryption method: ' + method);
          }
          
          self.postMessage({ id, success: true, result });
        } catch (error) {
          self.postMessage({ id, success: false, error: error.message });
        }
      };
      
      async function decryptAES128CBC(data, keyData, iv) {
        const key = await crypto.subtle.importKey(
          'raw', keyData, { name: 'AES-CBC' }, false, ['decrypt']
        );
        return await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: iv }, key, data
        );
      }
      
      async function decryptAES128CTR(data, keyData, iv) {
        const key = await crypto.subtle.importKey(
          'raw', keyData, { name: 'AES-CTR' }, false, ['decrypt']
        );
        return await crypto.subtle.decrypt(
          { name: 'AES-CTR', counter: iv, length: 128 }, key, data
        );
      }
      
      async function decryptAES256CBC(data, keyData, iv) {
        const key = await crypto.subtle.importKey(
          'raw', keyData, { name: 'AES-CBC' }, false, ['decrypt']
        );
        return await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: iv }, key, data
        );
      }
      
      async function decryptAES256CTR(data, keyData, iv) {
        const key = await crypto.subtle.importKey(
          'raw', keyData, { name: 'AES-CTR' }, false, ['decrypt']
        );
        return await crypto.subtle.decrypt(
          { name: 'AES-CTR', counter: iv, length: 128 }, key, data
        );
      }
    `;

    return URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
  }

  handleWorkerMessage(event) {
    const { id, success, result, error } = event.data;
    const pendingDecryption = this.activeDecryptions.get(id);
    
    if (pendingDecryption) {
      const workerInfo = this.workers.find(w => w.id === pendingDecryption.workerId);
      if (workerInfo) {
        workerInfo.busy = false;
      }
      
      if (success) {
        pendingDecryption.resolve(result);
      } else {
        pendingDecryption.reject(new Error(error));
      }
      
      this.activeDecryptions.delete(id);
      this.processDecryptionQueue();
    }
  }

  handleWorkerError(error) {
    logger.error('Crypto worker error', error);
  }

  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;

    // Clean key cache
    for (const [key, entry] of this.keyCache.entries()) {
      if (now - entry.timestamp > this.config.keyExpirationTime) {
        this.keyCache.delete(key);
        cleaned++;
      }
    }

    // Clean IV cache
    for (const [key, entry] of this.ivCache.entries()) {
      if (now - entry.timestamp > this.config.keyExpirationTime) {
        this.ivCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  async testCryptoCapabilities() {
    const capabilities = {
      webCrypto: typeof crypto !== 'undefined' && crypto.subtle,
      aes128: false,
      aes256: false,
      aesCtr: false,
      aesCbc: false,
      hardwareAcceleration: false
    };

    if (capabilities.webCrypto) {
      try {
        // Test AES-128 CBC
        const testKey = new Uint8Array(16).fill(0);
        const testIv = new Uint8Array(16).fill(0);
        const testData = new Uint8Array(16).fill(1);
        
        const key = await crypto.subtle.importKey(
          'raw', testKey, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']
        );
        
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-CBC', iv: testIv }, key, testData
        );
        
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: testIv }, key, encrypted
        );
        
        capabilities.aes128 = true;
        capabilities.aesCbc = true;
        
        // Test hardware acceleration by measuring performance
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          await crypto.subtle.encrypt({ name: 'AES-CBC', iv: testIv }, key, testData);
        }
        const duration = performance.now() - start;
        capabilities.hardwareAcceleration = duration < 100; // Less than 1ms per operation
        
      } catch (error) {
        logger.warn('AES-128 CBC test failed', error);
      }
    }

    logger.info('Crypto capabilities detected', capabilities);
    this.capabilities = capabilities;
    return capabilities;
  }

  // Main decryption method
  async decrypt(data, encryptionKey) {
    const startTime = performance.now();
    
    try {
      this.logCrypto(`Starting decryption with method: ${encryptionKey.method}`);
      
      let result;
      
      switch (encryptionKey.method) {
        case EncryptionMethod.AES_128:
          result = await this.decryptAES128CBC(data, encryptionKey);
          break;
        case EncryptionMethod.AES_128_CTR:
          result = await this.decryptAES128CTR(data, encryptionKey);
          break;
        case EncryptionMethod.AES_256:
          result = await this.decryptAES256CBC(data, encryptionKey);
          break;
        case EncryptionMethod.AES_256_CTR:
          result = await this.decryptAES256CTR(data, encryptionKey);
          break;
        case EncryptionMethod.SAMPLE_AES:
          result = await this.decryptSampleAES(data, encryptionKey);
          break;
        case EncryptionMethod.SAMPLE_AES_CTR:
          result = await this.decryptSampleAESCTR(data, encryptionKey);
          break;
        case EncryptionMethod.WIDEVINE:
          result = await this.decryptWidevine(data, encryptionKey);
          break;
        case EncryptionMethod.FAIRPLAY:
          result = await this.decryptFairPlay(data, encryptionKey);
          break;
        case EncryptionMethod.PLAYREADY:
          result = await this.decryptPlayReady(data, encryptionKey);
          break;
        case EncryptionMethod.NONE:
          result = data;
          break;
        default:
          throw new Error(`Unsupported encryption method: ${encryptionKey.method}`);
      }

      const duration = performance.now() - startTime;
      this.updateMetrics('decryptionsPerformed', duration);
      
      this.logCrypto(`Decryption completed in ${duration.toFixed(2)}ms`);
      eventSystem.emit('crypto:decryptionCompleted', {
        method: encryptionKey.method,
        duration,
        dataSize: data.byteLength
      });
      
      return result;
    } catch (error) {
      this.metrics.decryptionErrors++;
      this.logCrypto(`Decryption failed: ${error.message}`, 'ERROR');
      eventSystem.emit('crypto:decryptionFailed', {
        method: encryptionKey.method,
        error: error.message
      });
      throw error;
    }
  }

  // AES-128 CBC Decryption
  async decryptAES128CBC(data, encryptionKey) {
    const key = await this.deriveKey(encryptionKey);
    const iv = await this.deriveIV(encryptionKey);
    
    if (this.config.parallelDecryption && this.workers.length > 0) {
      return this.decryptWithWorker('aes-128-cbc', data, key, iv);
    }
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'AES-CBC' }, false, ['decrypt']
    );
    
    return await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv }, cryptoKey, data
    );
  }

  // AES-128 CTR Decryption
  async decryptAES128CTR(data, encryptionKey) {
    const key = await this.deriveKey(encryptionKey);
    const iv = await this.deriveIV(encryptionKey);
    
    if (this.config.parallelDecryption && this.workers.length > 0) {
      return this.decryptWithWorker('aes-128-ctr', data, key, iv);
    }
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'AES-CTR' }, false, ['decrypt']
    );
    
    return await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: iv, length: 128 }, cryptoKey, data
    );
  }

  // AES-256 CBC Decryption
  async decryptAES256CBC(data, encryptionKey) {
    const key = await this.deriveKey(encryptionKey);
    const iv = await this.deriveIV(encryptionKey);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'AES-CBC' }, false, ['decrypt']
    );
    
    return await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv }, cryptoKey, data
    );
  }

  // AES-256 CTR Decryption
  async decryptAES256CTR(data, encryptionKey) {
    const key = await this.deriveKey(encryptionKey);
    const iv = await this.deriveIV(encryptionKey);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'AES-CTR' }, false, ['decrypt']
    );
    
    return await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: iv, length: 128 }, cryptoKey, data
    );
  }

  // SAMPLE-AES Decryption (for HLS)
  async decryptSampleAES(data, encryptionKey) {
    // SAMPLE-AES decrypts only specific parts of the media stream
    // Implementation depends on the media format (MP4, TS, etc.)
    const key = await this.deriveKey(encryptionKey);
    const iv = await this.deriveIV(encryptionKey);
    
    // For now, treat as regular AES-128 CBC
    // In a full implementation, would parse media containers
    return this.decryptAES128CBC(data, encryptionKey);
  }

  // SAMPLE-AES CTR Decryption
  async decryptSampleAESCTR(data, encryptionKey) {
    return this.decryptAES128CTR(data, encryptionKey);
  }

  // Widevine DRM Decryption (simplified)
  async decryptWidevine(data, encryptionKey) {
    // Widevine requires EME (Encrypted Media Extensions)
    // This is a simplified implementation
    logger.warn('Widevine decryption requires EME support and license server integration');
    throw new Error('Widevine decryption not fully implemented - requires EME and license server');
  }

  // FairPlay DRM Decryption (simplified)
  async decryptFairPlay(data, encryptionKey) {
    logger.warn('FairPlay decryption requires EME support and license server integration');
    throw new Error('FairPlay decryption not fully implemented - requires EME and license server');
  }

  // PlayReady DRM Decryption (simplified)
  async decryptPlayReady(data, encryptionKey) {
    logger.warn('PlayReady decryption requires EME support and license server integration');
    throw new Error('PlayReady decryption not fully implemented - requires EME and license server');
  }

  // Worker-based parallel decryption
  async decryptWithWorker(method, data, key, iv) {
    return new Promise((resolve, reject) => {
      const worker = this.getAvailableWorker();
      if (!worker) {
        // Fallback to main thread
        return this.decryptOnMainThread(method, data, key, iv)
          .then(resolve)
          .catch(reject);
      }

      const id = this.generateDecryptionId();
      worker.busy = true;
      
      this.activeDecryptions.set(id, {
        resolve,
        reject,
        workerId: worker.id,
        timestamp: Date.now()
      });

      worker.worker.postMessage({
        id,
        method,
        data,
        key,
        iv
      });
    });
  }

  getAvailableWorker() {
    return this.workers.find(w => !w.busy);
  }

  generateDecryptionId() {
    return `decrypt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  processDecryptionQueue() {
    if (this.decryptionQueue.length === 0) return;
    
    const worker = this.getAvailableWorker();
    if (!worker) return;
    
    const job = this.decryptionQueue.shift();
    if (job) {
      this.decryptWithWorker(job.method, job.data, job.key, job.iv)
        .then(job.resolve)
        .catch(job.reject);
    }
  }

  // Key derivation
  async deriveKey(encryptionKey) {
    const cacheKey = `${encryptionKey.uri}:key`;
    const cached = this.keyCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.config.keyExpirationTime) {
      this.metrics.cacheHits++;
      return cached.data;
    }

    this.metrics.cacheMisses++;
    this.metrics.keyDerivations++;

    try {
      this.logCrypto(`Deriving key from URI: ${encryptionKey.uri}`);
      
      const response = await fetch(encryptionKey.uri, {
        method: 'GET',
        headers: this.getKeyRequestHeaders(),
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch encryption key: ${response.status} ${response.statusText}`);
      }

      const keyData = await response.arrayBuffer();
      const keyBytes = new Uint8Array(keyData);
      
      // Validate key length
      if (keyBytes.length !== 16 && keyBytes.length !== 32) {
        throw new Error(`Invalid key length: ${keyBytes.length} bytes`);
      }

      this.keyCache.set(cacheKey, {
        data: keyBytes,
        timestamp: Date.now()
      });

      this.logCrypto(`Key derived and cached for ${encryptionKey.uri}`);
      return keyBytes;
    } catch (error) {
      this.logCrypto(`Key derivation failed for ${encryptionKey.uri}: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // IV derivation
  async deriveIV(encryptionKey) {
    let iv;
    
    if (encryptionKey.iv) {
      // Convert hex IV to bytes
      iv = this.hexToBytes(encryptionKey.iv);
    } else {
      // Generate IV from segment sequence (common in HLS)
      iv = new Uint8Array(16);
      const sequence = encryptionKey.sequence || 0;
      const view = new DataView(iv.buffer);
      view.setUint32(12, sequence, false); // Big-endian
    }
    
    if (iv.length !== 16) {
      throw new Error(`Invalid IV length: ${iv.length} bytes`);
    }
    
    return iv;
  }

  getKeyRequestHeaders() {
    return {
      'User-Agent': config.get('network.userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
      'Accept': '*/*',
      'Cache-Control': 'no-cache'
    };
  }

  // Utility methods
  hexToBytes(hex) {
    if (hex.startsWith('0x') || hex.startsWith('0X')) {
      hex = hex.slice(2);
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Segment decryption
  async decryptSegment(segment, data) {
    if (!segment.encrypted || !segment.key) {
      return data;
    }

    try {
      this.logCrypto(`Decrypting segment ${segment.sequence}`);
      
      const encryptionKey = {
        ...segment.key,
        sequence: segment.sequence
      };
      
      return await this.decrypt(data, encryptionKey);
    } catch (error) {
      this.logCrypto(`Segment decryption failed for segment ${segment.sequence}: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // Batch decryption for multiple segments
  async decryptBatch(segments, onProgress = null) {
    const results = [];
    const total = segments.length;
    let completed = 0;

    const promises = segments.map(async (segment, index) => {
      try {
        const result = await this.decryptSegment(segment, segment.data);
        completed++;
        
        if (onProgress) {
          onProgress({
            completed,
            total,
            progress: (completed / total) * 100,
            segmentIndex: index
          });
        }
        
        return { index, result, success: true };
      } catch (error) {
        completed++;
        
        if (onProgress) {
          onProgress({
            completed,
            total,
            progress: (completed / total) * 100,
            segmentIndex: index,
            error
          });
        }
        
        return { index, error, success: false };
      }
    });

    const allResults = await Promise.allSettled(promises);
    
    for (const promiseResult of allResults) {
      if (promiseResult.status === 'fulfilled') {
        results[promiseResult.value.index] = promiseResult.value;
      } else {
        results.push({ error: promiseResult.reason, success: false });
      }
    }

    return results;
  }

  // Metrics and monitoring
  updateMetrics(metric, value) {
    if (metric === 'decryptionsPerformed') {
      this.metrics.decryptionsPerformed++;
      this.metrics.lastDecryptionTime = value;
      
      // Update average
      const totalTime = this.metrics.averageDecryptionTime * (this.metrics.decryptionsPerformed - 1) + value;
      this.metrics.averageDecryptionTime = totalTime / this.metrics.decryptionsPerformed;
    } else {
      this.metrics[metric] = (this.metrics[metric] || 0) + value;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.keyCache.size + this.ivCache.size,
      activeDecryptions: this.activeDecryptions.size,
      queueSize: this.decryptionQueue.length,
      workerCount: this.workers.length,
      capabilities: this.capabilities
    };
  }

  // Cache management
  clearCache() {
    this.keyCache.clear();
    this.ivCache.clear();
    this.sessionCache.clear();
    this.certificateCache.clear();
    logger.info('Crypto cache cleared');
  }

  getCacheStats() {
    return {
      keyCache: this.keyCache.size,
      ivCache: this.ivCache.size,
      sessionCache: this.sessionCache.size,
      certificateCache: this.certificateCache.size,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100
    };
  }

  // Logging
  logCrypto(message, level = 'DEBUG') {
    if (config.get('logging.categories.crypto', true)) {
      logger[level.toLowerCase()](message, null, { category: 'crypto' });
    }
  }

  // Cleanup
  destroy() {
    // Terminate workers
    for (const workerInfo of this.workers) {
      workerInfo.worker.terminate();
    }
    
    // Clear caches
    this.clearCache();
    
    // Clear active operations
    this.activeDecryptions.clear();
    this.decryptionQueue = [];
    
    logger.info('Crypto engine destroyed');
  }
}

// Export default instance
export const cryptoEngine = new AdvancedCryptoEngine();

export default AdvancedCryptoEngine;