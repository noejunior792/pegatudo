/**
 * PegaTudo Advanced Network Interceptor
 * Sophisticated network request interception and analysis for media detection
 */

import {
  NetworkInterceptorInterface,
  NetworkRequest,
  NetworkResponse,
  PatternMatch,
  MediaType,
  DebugConfig,
  StealthConfig
} from '../types/index.js';

interface InterceptedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: Date;
  response?: InterceptedResponse;
  isMediaRequest: boolean;
}

interface InterceptedResponse {
  status: number;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  contentType?: string;
  size?: number;
  timestamp: Date;
}

export class AdvancedNetworkInterceptor implements NetworkInterceptorInterface {
  private isActive: boolean = false;
  private interceptedRequests: Map<string, InterceptedRequest> = new Map();
  private patterns: PatternMatch[] = [];
  private originalFetch: typeof fetch;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send;
  private debugConfig: DebugConfig;
  private stealthConfig: StealthConfig;
  private requestCounter: number = 0;

  // Chrome Extension APIs
  private declarativeNetRequestRules: chrome.declarativeNetRequest.Rule[] = [];
  private ruleIdCounter: number = 1;

  constructor(debugConfig?: DebugConfig, stealthConfig?: StealthConfig) {
    this.debugConfig = debugConfig || this.getDefaultDebugConfig();
    this.stealthConfig = stealthConfig || this.getDefaultStealthConfig();
    
    // Store original functions
    this.originalFetch = window.fetch.bind(window);
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    
    this.initializePatterns();
    this.log('AdvancedNetworkInterceptor initialized', 'INFO');
  }

  /**
   * Start network interception
   */
  public start(): void {
    if (this.isActive) {
      this.log('Network interceptor already active', 'WARN');
      return;
    }

    try {
      this.interceptFetch();
      this.interceptXMLHttpRequest();
      this.setupWebSocketInterception();
      this.setupDeclarativeNetRequest();
      
      this.isActive = true;
      this.log('Network interception started', 'INFO');
    } catch (error) {
      this.log(`Failed to start network interception: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Stop network interception
   */
  public stop(): void {
    if (!this.isActive) {
      this.log('Network interceptor already inactive', 'WARN');
      return;
    }

    try {
      this.restoreFetch();
      this.restoreXMLHttpRequest();
      this.restoreWebSocket();
      this.cleanupDeclarativeNetRequest();
      
      this.isActive = false;
      this.log('Network interception stopped', 'INFO');
    } catch (error) {
      this.log(`Error stopping network interception: ${error}`, 'ERROR');
    }
  }

  /**
   * Add detection pattern
   */
  public addPattern(pattern: PatternMatch): void {
    this.patterns.push(pattern);
    this.updateDeclarativeNetRequestRules();
    this.log(`Added pattern: ${pattern.pattern}`, 'DEBUG');
  }

  /**
   * Remove detection pattern
   */
  public removePattern(pattern: PatternMatch): void {
    const index = this.patterns.findIndex(p => 
      p.pattern.source === pattern.pattern.source && p.type === pattern.type
    );
    
    if (index !== -1) {
      this.patterns.splice(index, 1);
      this.updateDeclarativeNetRequestRules();
      this.log(`Removed pattern: ${pattern.pattern}`, 'DEBUG');
    }
  }

  /**
   * Get all intercepted requests
   */
  public getRequests(): NetworkRequest[] {
    return Array.from(this.interceptedRequests.values()).map(req => ({
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body,
      timestamp: req.timestamp,
      response: req.response ? {
        status: req.response.status,
        headers: req.response.headers,
        body: req.response.body,
        contentType: req.response.contentType,
        size: req.response.size
      } : undefined
    }));
  }

  /**
   * Get media requests only
   */
  public getMediaRequests(): NetworkRequest[] {
    return this.getRequests().filter(req => this.isMediaRequest(req));
  }

  /**
   * Clear request history
   */
  public clearRequests(): void {
    this.interceptedRequests.clear();
    this.log('Request history cleared', 'DEBUG');
  }

  /**
   * Intercept fetch requests
   */
  private interceptFetch(): void {
    const self = this;
    
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const requestId = self.generateRequestId();
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      
      // Create request record
      const request: InterceptedRequest = {
        id: requestId,
        url,
        method,
        headers: self.extractHeaders(init?.headers, input instanceof Request ? input.headers : undefined),
        body: typeof init?.body === 'string' ? init.body : undefined,
        timestamp: new Date(),
        isMediaRequest: self.isMediaRequestByUrl(url)
      };

      self.interceptedRequests.set(requestId, request);
      
      if (self.debugConfig.logNetworkRequests) {
        self.log(`Fetch request: ${method} ${url}`, 'DEBUG');
      }

      try {
        // Add stealth headers if configured
        const stealthInit = self.addStealthHeaders(init || {});
        
        // Call original fetch
        const response = await self.originalFetch(input, stealthInit);
        
        // Record response
        const responseRecord: InterceptedResponse = {
          status: response.status,
          headers: self.extractResponseHeaders(response.headers),
          contentType: response.headers.get('content-type') || undefined,
          size: parseInt(response.headers.get('content-length') || '0') || undefined,
          timestamp: new Date()
        };

        // If it's a media request, capture the body
        if (request.isMediaRequest && self.shouldCaptureBody(response)) {
          try {
            const clonedResponse = response.clone();
            responseRecord.body = await clonedResponse.arrayBuffer();
          } catch (error) {
            self.log(`Failed to capture response body: ${error}`, 'WARN');
          }
        }

        request.response = responseRecord;
        
        if (request.isMediaRequest) {
          self.log(`Media response captured: ${url} (${response.status})`, 'DEBUG');
          self.notifyMediaDiscovered(request);
        }

        return response;
      } catch (error) {
        self.log(`Fetch error for ${url}: ${error}`, 'ERROR');
        throw error;
      }
    };
  }

  /**
   * Intercept XMLHttpRequest
   */
  private interceptXMLHttpRequest(): void {
    const self = this;
    
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
      const requestId = self.generateRequestId();
      const urlString = url.toString();
      
      // Store request info on XHR object
      (this as any).__pegaTudoRequestId = requestId;
      (this as any).__pegaTudoUrl = urlString;
      (this as any).__pegaTudoMethod = method;
      
      const request: InterceptedRequest = {
        id: requestId,
        url: urlString,
        method,
        headers: {},
        timestamp: new Date(),
        isMediaRequest: self.isMediaRequestByUrl(urlString)
      };

      self.interceptedRequests.set(requestId, request);
      
      if (self.debugConfig.logNetworkRequests) {
        self.log(`XHR request: ${method} ${urlString}`, 'DEBUG');
      }

      // Set up response handler
      this.addEventListener('readystatechange', function() {
        if (this.readyState === XMLHttpRequest.DONE) {
          const requestRecord = self.interceptedRequests.get(requestId);
          if (requestRecord) {
            const responseRecord: InterceptedResponse = {
              status: this.status,
              headers: self.parseXHRHeaders(this.getAllResponseHeaders()),
              contentType: this.getResponseHeader('content-type') || undefined,
              size: this.response ? this.response.length || this.response.byteLength : undefined,
              timestamp: new Date()
            };

            // Capture response body for media requests
            if (requestRecord.isMediaRequest && this.response) {
              if (this.responseType === 'arraybuffer') {
                responseRecord.body = this.response;
              } else if (typeof this.response === 'string') {
                const encoder = new TextEncoder();
                responseRecord.body = encoder.encode(this.response).buffer;
              }
            }

            requestRecord.response = responseRecord;
            
            if (requestRecord.isMediaRequest) {
              self.log(`XHR media response captured: ${urlString} (${this.status})`, 'DEBUG');
              self.notifyMediaDiscovered(requestRecord);
            }
          }
        }
      });

      return self.originalXhrOpen.call(this, method, url, async, user, password);
    };

    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const requestId = (this as any).__pegaTudoRequestId;
      if (requestId) {
        const request = self.interceptedRequests.get(requestId);
        if (request && body && typeof body === 'string') {
          request.body = body;
        }
      }

      return self.originalXhrSend.call(this, body);
    };
  }

  /**
   * Setup WebSocket interception
   */
  private setupWebSocketInterception(): void {
    const self = this;
    const originalWebSocket = window.WebSocket;
    
    window.WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        
        const urlString = url.toString();
        const requestId = self.generateRequestId();
        
        const request: InterceptedRequest = {
          id: requestId,
          url: urlString,
          method: 'WEBSOCKET',
          headers: {},
          timestamp: new Date(),
          isMediaRequest: false
        };

        self.interceptedRequests.set(requestId, request);
        
        if (self.debugConfig.logNetworkRequests) {
          self.log(`WebSocket connection: ${urlString}`, 'DEBUG');
        }

        // Intercept messages
        this.addEventListener('message', (event) => {
          try {
            const data = event.data;
            if (typeof data === 'string') {
              // Look for media URLs in WebSocket messages
              const mediaUrls = self.extractMediaUrlsFromText(data);
              if (mediaUrls.length > 0) {
                self.log(`Media URLs found in WebSocket message: ${mediaUrls.join(', ')}`, 'DEBUG');
                // Create fake requests for discovered URLs
                mediaUrls.forEach(mediaUrl => {
                  const mediaRequestId = self.generateRequestId();
                  const mediaRequest: InterceptedRequest = {
                    id: mediaRequestId,
                    url: mediaUrl,
                    method: 'WEBSOCKET_DISCOVERED',
                    headers: {},
                    timestamp: new Date(),
                    isMediaRequest: true
                  };
                  self.interceptedRequests.set(mediaRequestId, mediaRequest);
                  self.notifyMediaDiscovered(mediaRequest);
                });
              }
            }
          } catch (error) {
            self.log(`Error processing WebSocket message: ${error}`, 'ERROR');
          }
        });
      }
    };
  }

  /**
   * Setup Chrome declarativeNetRequest API
   */
  private setupDeclarativeNetRequest(): void {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
      this.log('declarativeNetRequest API not available', 'DEBUG');
      return;
    }

    try {
      this.updateDeclarativeNetRequestRules();
      this.log('declarativeNetRequest rules configured', 'DEBUG');
    } catch (error) {
      this.log(`declarativeNetRequest setup failed: ${error}`, 'ERROR');
    }
  }

  /**
   * Update declarativeNetRequest rules
   */
  private updateDeclarativeNetRequestRules(): void {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
      return;
    }

    const rules: chrome.declarativeNetRequest.Rule[] = [];
    
    this.patterns.forEach((pattern, index) => {
      // Convert regex patterns to match patterns (simplified)
      const urlFilter = this.convertRegexToUrlFilter(pattern.pattern);
      if (urlFilter) {
        rules.push({
          id: this.ruleIdCounter++,
          priority: pattern.priority,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: 'X-PegaTudo-Detected',
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: pattern.type
              }
            ]
          },
          condition: {
            urlFilter,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MEDIA,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.WEBSOCKET
            ]
          }
        });
      }
    });

    this.declarativeNetRequestRules = rules;
    
    // Update rules (this would typically be done in the background script)
    try {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: this.declarativeNetRequestRules.map(rule => rule.id),
        addRules: rules
      });
    } catch (error) {
      this.log(`Failed to update declarativeNetRequest rules: ${error}`, 'ERROR');
    }
  }

  /**
   * Restore original fetch
   */
  private restoreFetch(): void {
    window.fetch = this.originalFetch;
  }

  /**
   * Restore original XMLHttpRequest
   */
  private restoreXMLHttpRequest(): void {
    XMLHttpRequest.prototype.open = this.originalXhrOpen;
    XMLHttpRequest.prototype.send = this.originalXhrSend;
  }

  /**
   * Restore original WebSocket
   */
  private restoreWebSocket(): void {
    // WebSocket restoration would require storing the original constructor
    // This is a simplified implementation
  }

  /**
   * Cleanup declarativeNetRequest rules
   */
  private cleanupDeclarativeNetRequest(): void {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
      return;
    }

    try {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: this.declarativeNetRequestRules.map(rule => rule.id)
      });
    } catch (error) {
      this.log(`Failed to cleanup declarativeNetRequest rules: ${error}`, 'ERROR');
    }
  }

  // Helper methods

  private initializePatterns(): void {
    this.patterns = [
      { pattern: /\.mp4(\?.*)?$/i, type: MediaType.VIDEO, priority: 10 },
      { pattern: /\.webm(\?.*)?$/i, type: MediaType.VIDEO, priority: 10 },
      { pattern: /\.m3u8(\?.*)?$/i, type: MediaType.LIVE_STREAM, priority: 15 },
      { pattern: /\.mpd(\?.*)?$/i, type: MediaType.LIVE_STREAM, priority: 15 },
      { pattern: /^blob:/i, type: MediaType.VIDEO, priority: 12 },
      { pattern: /\.mp3(\?.*)?$/i, type: MediaType.AUDIO, priority: 10 },
      { pattern: /\.wav(\?.*)?$/i, type: MediaType.AUDIO, priority: 9 }
    ];
  }

  private isMediaRequest(request: NetworkRequest): boolean {
    return this.isMediaRequestByUrl(request.url) || this.isMediaContentType(request.response?.contentType);
  }

  private isMediaRequestByUrl(url: string): boolean {
    return this.patterns.some(pattern => pattern.pattern.test(url));
  }

  private isMediaContentType(contentType?: string): boolean {
    if (!contentType) return false;
    
    const mediaContentTypes = [
      'video/', 'audio/', 'application/vnd.apple.mpegurl', 'application/dash+xml'
    ];
    
    return mediaContentTypes.some(type => contentType.includes(type));
  }

  private shouldCaptureBody(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    // Only capture small media files or manifests
    return contentLength < 10 * 1024 * 1024 && // Less than 10MB
           (contentType.includes('application/vnd.apple.mpegurl') ||
            contentType.includes('application/dash+xml') ||
            contentType.includes('text/plain'));
  }

  private extractHeaders(init?: HeadersInit, requestHeaders?: Headers): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (init) {
      if (init instanceof Headers) {
        init.forEach((value, key) => headers[key] = value);
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => headers[key] = value);
      } else {
        Object.assign(headers, init);
      }
    }
    
    if (requestHeaders) {
      requestHeaders.forEach((value, key) => headers[key] = value);
    }
    
    return headers;
  }

  private extractResponseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => result[key] = value);
    return result;
  }

  private parseXHRHeaders(headersString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    
    headersString.split('\r\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    });
    
    return headers;
  }

  private addStealthHeaders(init: RequestInit): RequestInit {
    if (!this.stealthConfig.mimicBrowserBehavior) {
      return init;
    }

    const stealthHeaders: Record<string, string> = {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    if (this.stealthConfig.randomizeUserAgent) {
      stealthHeaders['User-Agent'] = this.getRandomUserAgent();
    }

    return {
      ...init,
      headers: {
        ...stealthHeaders,
        ...init.headers
      }
    };
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private extractMediaUrlsFromText(text: string): string[] {
    const urls: string[] = [];
    const urlPatterns = [
      /https?:\/\/[^\s"']*\.(?:mp4|webm|m3u8|mpd|mp3|wav|ogg)(?:\?[^\s"']*)?/gi,
      /"(https?:\/\/[^"]*\.(?:mp4|webm|m3u8|mpd|mp3|wav|ogg)[^"]*)"/gi,
      /'(https?:\/\/[^']*\.(?:mp4|webm|m3u8|mpd|mp3|wav|ogg)[^']*)'/gi
    ];

    for (const pattern of urlPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const url = match[1] || match[0];
        if (this.isValidUrl(url)) {
          urls.push(url);
        }
      }
    }

    return Array.from(new Set(urls)); // Remove duplicates
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private convertRegexToUrlFilter(regex: RegExp): string | null {
    // Simplified regex to URL filter conversion
    // This is a basic implementation - real implementation would be more sophisticated
    const source = regex.source;
    
    if (source.includes('\\.mp4')) return '*mp4*';
    if (source.includes('\\.webm')) return '*webm*';
    if (source.includes('\\.m3u8')) return '*m3u8*';
    if (source.includes('\\.mpd')) return '*mpd*';
    if (source.includes('blob:')) return 'blob:*';
    
    return null;
  }

  private notifyMediaDiscovered(request: InterceptedRequest): void {
    // Dispatch custom event for media discovery
    const event = new CustomEvent('pegaTudoMediaDiscovered', {
      detail: {
        url: request.url,
        method: request.method,
        headers: request.headers,
        contentType: request.response?.contentType,
        size: request.response?.size,
        timestamp: request.timestamp
      }
    });
    
    window.dispatchEvent(event);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
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

  private getDefaultStealthConfig(): StealthConfig {
    return {
      randomizeUserAgent: true,
      randomizeRequestTiming: true,
      mimicBrowserBehavior: true,
      avoidDetection: true,
      maxConcurrentRequests: 4,
      requestDelay: { min: 100, max: 500 }
    };
  }

  private log(message: string, level: keyof { DEBUG: 0; INFO: 1; WARN: 2; ERROR: 3 }): void {
    if (!this.debugConfig.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] Network: ${message}`;
    
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