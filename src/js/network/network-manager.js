/**
 * Advanced Network Manager for PegaTudo
 * Comprehensive network handling with request interception, proxy support,
 * rate limiting, retry logic, and intelligent routing
 */

import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';
import { MediaType, createNetworkRequest } from '../core/types.js';

export class AdvancedNetworkManager {
  constructor(options = {}) {
    this.config = {
      maxConcurrentRequests: options.maxConcurrentRequests || 6,
      defaultTimeout: options.defaultTimeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      rateLimitEnabled: options.rateLimitEnabled !== false,
      requestsPerSecond: options.requestsPerSecond || 10,
      burstLimit: options.burstLimit || 50,
      enableProxy: options.enableProxy || false,
      proxyRotation: options.proxyRotation || false,
      enableCaching: options.enableCaching !== false,
      cacheMaxAge: options.cacheMaxAge || 3600000, // 1 hour
      userAgentRotation: options.userAgentRotation || false,
      stealthMode: options.stealthMode || false,
      ...options
    };

    this.activeRequests = new Map();
    this.requestQueue = [];
    this.requestHistory = [];
    this.rateLimiter = null;
    this.cache = new Map();
    this.proxyList = [];
    this.currentProxyIndex = 0;
    this.userAgents = [];
    this.currentUserAgentIndex = 0;
    this.interceptors = new Map();
    this.middlewares = [];

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      retriedRequests: 0,
      bytesSent: 0,
      bytesReceived: 0,
      averageResponseTime: 0,
      requestsByDomain: new Map(),
      requestsByStatus: new Map()
    };

    this.requestStates = {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
      RETRYING: 'retrying'
    };

    this.init();
  }

  async init() {
    try {
      // Initialize rate limiter
      if (this.config.rateLimitEnabled) {
        this.initializeRateLimiter();
      }

      // Load proxy list
      if (this.config.enableProxy) {
        await this.loadProxyList();
      }

      // Load user agent list
      if (this.config.userAgentRotation) {
        this.loadUserAgents();
      }

      // Setup request processing
      this.setupRequestProcessor();

      // Setup cache cleanup
      this.setupCacheCleanup();

      // Setup network monitoring
      this.setupNetworkMonitoring();

      // Register default interceptors
      this.registerDefaultInterceptors();

      logger.info('Advanced Network Manager initialized', {
        maxConcurrent: this.config.maxConcurrentRequests,
        rateLimiting: this.config.rateLimitEnabled,
        proxy: this.config.enableProxy,
        caching: this.config.enableCaching
      });

      eventSystem.emit('network:initialized', { manager: this });
    } catch (error) {
      logger.error('Failed to initialize network manager', error);
      throw error;
    }
  }

  initializeRateLimiter() {
    this.rateLimiter = {
      tokens: this.config.burstLimit,
      lastRefill: Date.now(),
      refillRate: this.config.requestsPerSecond,
      maxTokens: this.config.burstLimit
    };

    // Refill tokens periodically
    setInterval(() => {
      this.refillTokens();
    }, 100); // Refill every 100ms
  }

  refillTokens() {
    if (!this.rateLimiter) return;

    const now = Date.now();
    const timePassed = now - this.rateLimiter.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.rateLimiter.refillRate;
    
    this.rateLimiter.tokens = Math.min(
      this.rateLimiter.maxTokens,
      this.rateLimiter.tokens + tokensToAdd
    );
    this.rateLimiter.lastRefill = now;
  }

  canMakeRequest() {
    if (!this.config.rateLimitEnabled || !this.rateLimiter) return true;
    
    if (this.rateLimiter.tokens >= 1) {
      this.rateLimiter.tokens--;
      return true;
    }
    
    return false;
  }

  async loadProxyList() {
    // Load proxy list from configuration or external source
    const proxies = config.get('network.proxyList', []);
    this.proxyList = proxies.filter(proxy => this.validateProxy(proxy));
    
    if (this.proxyList.length === 0) {
      logger.warn('No valid proxies configured');
      this.config.enableProxy = false;
    } else {
      logger.info(`Loaded ${this.proxyList.length} proxies`);
    }
  }

  validateProxy(proxy) {
    // Basic proxy validation
    return proxy && proxy.host && proxy.port && typeof proxy.port === 'number';
  }

  loadUserAgents() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
    ];
  }

  setupRequestProcessor() {
    // Process queued requests periodically
    setInterval(() => {
      this.processRequestQueue();
    }, 100);
  }

  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  setupNetworkMonitoring() {
    // Monitor online/offline status
    if (typeof navigator !== 'undefined') {
      window.addEventListener('online', () => {
        eventSystem.emit('network:online');
        logger.info('Network connection restored');
      });

      window.addEventListener('offline', () => {
        eventSystem.emit('network:offline');
        logger.warn('Network connection lost');
      });
    }
  }

  registerDefaultInterceptors() {
    // Register interceptor for media detection
    this.addInterceptor('media-detector', (request, response) => {
      if (response && response.headers) {
        const contentType = response.headers['content-type'] || response.headers['Content-Type'];
        if (contentType) {
          if (contentType.includes('video/') || contentType.includes('audio/') || contentType.includes('image/')) {
            eventSystem.emit('network:mediaDetected', {
              url: request.url,
              contentType,
              size: response.headers['content-length']
            });
          }
        }
      }
    });

    // Register interceptor for manifest detection
    this.addInterceptor('manifest-detector', (request, response) => {
      const url = request.url.toLowerCase();
      if (url.includes('.m3u8') || url.includes('.mpd') || url.includes('manifest')) {
        eventSystem.emit('network:manifestDetected', {
          url: request.url,
          type: url.includes('.m3u8') ? 'hls' : url.includes('.mpd') ? 'dash' : 'unknown'
        });
      }
    });
  }

  // Main request method
  async request(url, options = {}) {
    const requestId = this.generateRequestId();
    const request = this.createRequest(requestId, url, options);

    try {
      logger.debug(`Starting request: ${url}`, { requestId, method: request.method });
      this.activeRequests.set(requestId, request);
      
      // Check rate limiting
      if (!this.canMakeRequest()) {
        return this.queueRequest(request);
      }

      // Check cache first
      if (this.config.enableCaching && request.method === 'GET') {
        const cached = this.getCachedResponse(url, options);
        if (cached) {
          this.updateMetrics('cachedRequests');
          return this.createResponse(cached, request);
        }
      }

      // Execute request
      const response = await this.executeRequest(request);
      
      // Cache successful GET responses
      if (this.config.enableCaching && request.method === 'GET' && response.ok) {
        this.cacheResponse(url, options, response);
      }

      // Run interceptors
      this.runInterceptors(request, response);

      this.updateMetrics('successfulRequests', request, response);
      this.activeRequests.delete(requestId);
      
      return response;
    } catch (error) {
      logger.error(`Request failed: ${url}`, { error: error.message, requestId });
      
      // Retry logic
      if (request.retryCount < this.config.retryAttempts) {
        return this.retryRequest(request, error);
      }

      this.updateMetrics('failedRequests', request, null, error);
      this.activeRequests.delete(requestId);
      throw error;
    }
  }

  createRequest(requestId, url, options) {
    const request = {
      id: requestId,
      url,
      method: options.method || 'GET',
      headers: this.buildHeaders(options.headers),
      body: options.body,
      timeout: options.timeout || this.config.defaultTimeout,
      retryCount: 0,
      state: this.requestStates.PENDING,
      timestamp: Date.now(),
      proxy: this.getNextProxy(),
      userAgent: this.getNextUserAgent(),
      signal: options.signal,
      credentials: options.credentials,
      mode: options.mode,
      cache: options.cache,
      redirect: options.redirect || 'follow',
      referrer: options.referrer,
      referrerPolicy: options.referrerPolicy,
      ...options
    };

    return request;
  }

  buildHeaders(customHeaders = {}) {
    const headers = {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      ...customHeaders
    };

    // Add user agent
    if (this.config.userAgentRotation && this.userAgents.length > 0) {
      headers['User-Agent'] = this.getNextUserAgent();
    } else {
      headers['User-Agent'] = config.get('network.userAgent', headers['User-Agent']);
    }

    // Stealth mode headers
    if (this.config.stealthMode) {
      headers['DNT'] = '1';
      headers['Upgrade-Insecure-Requests'] = '1';
    }

    return headers;
  }

  getNextProxy() {
    if (!this.config.enableProxy || this.proxyList.length === 0) {
      return null;
    }

    if (this.config.proxyRotation) {
      const proxy = this.proxyList[this.currentProxyIndex];
      this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length;
      return proxy;
    }

    return this.proxyList[0];
  }

  getNextUserAgent() {
    if (this.userAgents.length === 0) {
      return config.get('network.userAgent');
    }

    const userAgent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }

  async executeRequest(request) {
    request.state = this.requestStates.IN_PROGRESS;
    const startTime = performance.now();

    try {
      // Apply middleware
      for (const middleware of this.middlewares) {
        request = await middleware.beforeRequest(request) || request;
      }

      // Create fetch options
      const fetchOptions = {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: this.createTimeoutSignal(request.timeout, request.signal),
        credentials: request.credentials,
        mode: request.mode,
        cache: request.cache,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy
      };

      // Execute the actual fetch
      let response = await fetch(request.url, fetchOptions);

      // Handle redirects manually if needed
      if (response.redirected && request.followRedirects !== false) {
        logger.debug(`Request redirected: ${request.url} -> ${response.url}`);
      }

      // Apply response middleware
      for (const middleware of this.middlewares) {
        response = await middleware.afterResponse(response, request) || response;
      }

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Create enhanced response object
      const enhancedResponse = this.enhanceResponse(response, request, responseTime);
      
      request.state = this.requestStates.COMPLETED;
      
      logger.debug(`Request completed: ${request.url}`, {
        status: response.status,
        responseTime: responseTime.toFixed(2) + 'ms'
      });

      return enhancedResponse;
    } catch (error) {
      request.state = this.requestStates.FAILED;
      
      if (error.name === 'AbortError') {
        logger.debug(`Request cancelled: ${request.url}`);
        request.state = this.requestStates.CANCELLED;
      }
      
      throw error;
    }
  }

  createTimeoutSignal(timeout, existingSignal) {
    if (existingSignal) {
      // If there's already a signal, we need to combine them
      const controller = new AbortController();
      
      // Abort if existing signal is aborted
      if (existingSignal.aborted) {
        controller.abort();
      } else {
        existingSignal.addEventListener('abort', () => controller.abort());
      }
      
      // Abort after timeout
      setTimeout(() => controller.abort(), timeout);
      
      return controller.signal;
    }
    
    return AbortSignal.timeout(timeout);
  }

  enhanceResponse(response, request, responseTime) {
    const enhanced = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: this.parseHeaders(response.headers),
      url: response.url,
      redirected: response.redirected,
      type: response.type,
      
      // Enhanced properties
      requestId: request.id,
      responseTime,
      fromCache: false,
      retryCount: request.retryCount,
      
      // Methods
      arrayBuffer: () => response.arrayBuffer(),
      blob: () => response.blob(),
      formData: () => response.formData(),
      json: () => response.json(),
      text: () => response.text(),
      
      // Clone method
      clone: () => response.clone()
    };

    return enhanced;
  }

  parseHeaders(headers) {
    const parsed = {};
    for (const [key, value] of headers.entries()) {
      parsed[key] = value;
    }
    return parsed;
  }

  async retryRequest(request, lastError) {
    request.retryCount++;
    request.state = this.requestStates.RETRYING;
    
    const delay = this.calculateRetryDelay(request.retryCount);
    logger.debug(`Retrying request in ${delay}ms: ${request.url}`, {
      attempt: request.retryCount,
      maxAttempts: this.config.retryAttempts
    });

    this.updateMetrics('retriedRequests');
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Rotate proxy for retry if enabled
    if (this.config.enableProxy && this.config.proxyRotation) {
      request.proxy = this.getNextProxy();
    }

    // Try again
    return this.executeRequest(request);
  }

  calculateRetryDelay(retryCount) {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  // Queue management
  queueRequest(request) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }

  processRequestQueue() {
    const maxConcurrent = this.config.maxConcurrentRequests;
    const currentActive = this.activeRequests.size;
    
    if (currentActive >= maxConcurrent || this.requestQueue.length === 0) {
      return;
    }

    const slotsAvailable = maxConcurrent - currentActive;
    const toProcess = Math.min(slotsAvailable, this.requestQueue.length);

    for (let i = 0; i < toProcess; i++) {
      const queueItem = this.requestQueue.shift();
      if (queueItem && this.canMakeRequest()) {
        this.executeQueuedRequest(queueItem);
      } else if (queueItem) {
        // Put it back if we can't make the request due to rate limiting
        this.requestQueue.unshift(queueItem);
        break;
      }
    }
  }

  async executeQueuedRequest(queueItem) {
    try {
      const response = await this.executeRequest(queueItem.request);
      queueItem.resolve(response);
    } catch (error) {
      queueItem.reject(error);
    }
  }

  // Caching
  getCachedResponse(url, options) {
    const cacheKey = this.generateCacheKey(url, options);
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheMaxAge) {
      logger.debug(`Cache hit: ${url}`);
      return cached.response;
    }
    
    if (cached) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  cacheResponse(url, options, response) {
    const cacheKey = this.generateCacheKey(url, options);
    
    // Only cache successful responses
    if (response.ok) {
      this.cache.set(cacheKey, {
        response: this.cloneResponse(response),
        timestamp: Date.now()
      });
    }
  }

  cloneResponse(response) {
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: { ...response.headers },
      url: response.url,
      fromCache: true
    };
  }

  generateCacheKey(url, options) {
    const key = `${url}:${JSON.stringify(options.headers || {})}`;
    return this.simpleHash(key);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.cacheMaxAge) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  // Interceptors and middleware
  addInterceptor(name, interceptor) {
    this.interceptors.set(name, interceptor);
  }

  removeInterceptor(name) {
    return this.interceptors.delete(name);
  }

  runInterceptors(request, response) {
    for (const [name, interceptor] of this.interceptors.entries()) {
      try {
        interceptor(request, response);
      } catch (error) {
        logger.error(`Interceptor error: ${name}`, error);
      }
    }
  }

  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }

  removeMiddleware(middleware) {
    const index = this.middlewares.indexOf(middleware);
    if (index > -1) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  // Convenience methods
  get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: data,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: data
    });
  }

  delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  head(url, options = {}) {
    return this.request(url, { ...options, method: 'HEAD' });
  }

  // Streaming support
  async streamDownload(url, options = {}, onProgress = null) {
    const response = await this.request(url, {
      ...options,
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers['content-length'];
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let received = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      received += value.length;
      
      if (onProgress && total > 0) {
        onProgress({
          loaded: received,
          total,
          progress: (received / total) * 100
        });
      }
    }

    return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
  }

  // Batch requests
  async batchRequest(urls, options = {}) {
    const batchOptions = {
      concurrency: options.concurrency || this.config.maxConcurrentRequests,
      failFast: options.failFast || false,
      ...options
    };

    const results = [];
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < urls.length; i += batchOptions.concurrency) {
      batches.push(urls.slice(i, i + batchOptions.concurrency));
    }

    // Process batches sequentially
    for (const batch of batches) {
      const batchPromises = batch.map(async (url, index) => {
        try {
          const response = await this.request(url, options);
          return { index: i * batchOptions.concurrency + index, url, response, success: true };
        } catch (error) {
          if (batchOptions.failFast) {
            throw error;
          }
          return { index: i * batchOptions.concurrency + index, url, error, success: false };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  // Metrics and monitoring
  updateMetrics(type, request = null, response = null, error = null) {
    this.metrics.totalRequests++;
    
    if (type === 'successfulRequests') {
      this.metrics.successfulRequests++;
      
      // Update response time average
      const responseTime = response.responseTime;
      const total = this.metrics.successfulRequests;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (total - 1) + responseTime) / total;
      
      // Update domain stats
      const domain = new URL(request.url).hostname;
      const domainCount = this.metrics.requestsByDomain.get(domain) || 0;
      this.metrics.requestsByDomain.set(domain, domainCount + 1);
      
      // Update status stats
      const statusCount = this.metrics.requestsByStatus.get(response.status) || 0;
      this.metrics.requestsByStatus.set(response.status, statusCount + 1);
      
      // Update bytes
      if (response.headers['content-length']) {
        this.metrics.bytesReceived += parseInt(response.headers['content-length'], 10);
      }
    } else if (type === 'failedRequests') {
      this.metrics.failedRequests++;
    } else if (type === 'cachedRequests') {
      this.metrics.cachedRequests++;
    } else if (type === 'retriedRequests') {
      this.metrics.retriedRequests++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      cacheSize: this.cache.size,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0,
      requestsByDomain: Object.fromEntries(this.metrics.requestsByDomain),
      requestsByStatus: Object.fromEntries(this.metrics.requestsByStatus)
    };
  }

  // Utility methods
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  createResponse(data, request) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      url: request.url,
      fromCache: true,
      requestId: request.id,
      responseTime: 0,
      retryCount: 0,
      
      arrayBuffer: () => Promise.resolve(data.arrayBuffer),
      blob: () => Promise.resolve(data.blob),
      json: () => Promise.resolve(data.json),
      text: () => Promise.resolve(data.text)
    };
  }

  // Cleanup
  destroy() {
    // Cancel all active requests
    for (const [id, request] of this.activeRequests.entries()) {
      if (request.signal && !request.signal.aborted) {
        request.signal.abort();
      }
    }

    this.activeRequests.clear();
    this.requestQueue = [];
    this.cache.clear();
    this.interceptors.clear();
    this.middlewares = [];

    logger.info('Network manager destroyed');
  }
}

// Export default instance
export const networkManager = new AdvancedNetworkManager();

export default AdvancedNetworkManager;