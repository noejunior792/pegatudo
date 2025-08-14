import { MediaType } from '../types/index.js';
export class AdvancedNetworkInterceptor {
    constructor(debugConfig, stealthConfig) {
        this.isActive = false;
        this.interceptedRequests = new Map();
        this.patterns = [];
        this.requestCounter = 0;
        this.declarativeNetRequestRules = [];
        this.ruleIdCounter = 1;
        this.debugConfig = debugConfig || this.getDefaultDebugConfig();
        this.stealthConfig = stealthConfig || this.getDefaultStealthConfig();
        this.originalFetch = window.fetch.bind(window);
        this.originalXhrOpen = XMLHttpRequest.prototype.open;
        this.originalXhrSend = XMLHttpRequest.prototype.send;
        this.initializePatterns();
        this.log('AdvancedNetworkInterceptor initialized', 'INFO');
    }
    start() {
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
        }
        catch (error) {
            this.log(`Failed to start network interception: ${error}`, 'ERROR');
            throw error;
        }
    }
    stop() {
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
        }
        catch (error) {
            this.log(`Error stopping network interception: ${error}`, 'ERROR');
        }
    }
    addPattern(pattern) {
        this.patterns.push(pattern);
        this.updateDeclarativeNetRequestRules();
        this.log(`Added pattern: ${pattern.pattern}`, 'DEBUG');
    }
    removePattern(pattern) {
        const index = this.patterns.findIndex(p => p.pattern.source === pattern.pattern.source && p.type === pattern.type);
        if (index !== -1) {
            this.patterns.splice(index, 1);
            this.updateDeclarativeNetRequestRules();
            this.log(`Removed pattern: ${pattern.pattern}`, 'DEBUG');
        }
    }
    getRequests() {
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
    getMediaRequests() {
        return this.getRequests().filter(req => this.isMediaRequest(req));
    }
    clearRequests() {
        this.interceptedRequests.clear();
        this.log('Request history cleared', 'DEBUG');
    }
    interceptFetch() {
        const self = this;
        window.fetch = async function (input, init) {
            const requestId = self.generateRequestId();
            const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
            const method = init?.method || (input instanceof Request ? input.method : 'GET');
            const request = {
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
                const stealthInit = self.addStealthHeaders(init || {});
                const response = await self.originalFetch(input, stealthInit);
                const responseRecord = {
                    status: response.status,
                    headers: self.extractResponseHeaders(response.headers),
                    contentType: response.headers.get('content-type') || undefined,
                    size: parseInt(response.headers.get('content-length') || '0') || undefined,
                    timestamp: new Date()
                };
                if (request.isMediaRequest && self.shouldCaptureBody(response)) {
                    try {
                        const clonedResponse = response.clone();
                        responseRecord.body = await clonedResponse.arrayBuffer();
                    }
                    catch (error) {
                        self.log(`Failed to capture response body: ${error}`, 'WARN');
                    }
                }
                request.response = responseRecord;
                if (request.isMediaRequest) {
                    self.log(`Media response captured: ${url} (${response.status})`, 'DEBUG');
                    self.notifyMediaDiscovered(request);
                }
                return response;
            }
            catch (error) {
                self.log(`Fetch error for ${url}: ${error}`, 'ERROR');
                throw error;
            }
        };
    }
    interceptXMLHttpRequest() {
        const self = this;
        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            const requestId = self.generateRequestId();
            const urlString = url.toString();
            this.__pegaTudoRequestId = requestId;
            this.__pegaTudoUrl = urlString;
            this.__pegaTudoMethod = method;
            const request = {
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
            this.addEventListener('readystatechange', function () {
                if (this.readyState === XMLHttpRequest.DONE) {
                    const requestRecord = self.interceptedRequests.get(requestId);
                    if (requestRecord) {
                        const responseRecord = {
                            status: this.status,
                            headers: self.parseXHRHeaders(this.getAllResponseHeaders()),
                            contentType: this.getResponseHeader('content-type') || undefined,
                            size: this.response ? this.response.length || this.response.byteLength : undefined,
                            timestamp: new Date()
                        };
                        if (requestRecord.isMediaRequest && this.response) {
                            if (this.responseType === 'arraybuffer') {
                                responseRecord.body = this.response;
                            }
                            else if (typeof this.response === 'string') {
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
        XMLHttpRequest.prototype.send = function (body) {
            const requestId = this.__pegaTudoRequestId;
            if (requestId) {
                const request = self.interceptedRequests.get(requestId);
                if (request && body && typeof body === 'string') {
                    request.body = body;
                }
            }
            return self.originalXhrSend.call(this, body);
        };
    }
    setupWebSocketInterception() {
        const self = this;
        const originalWebSocket = window.WebSocket;
        window.WebSocket = class extends originalWebSocket {
            constructor(url, protocols) {
                super(url, protocols);
                const urlString = url.toString();
                const requestId = self.generateRequestId();
                const request = {
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
                this.addEventListener('message', (event) => {
                    try {
                        const data = event.data;
                        if (typeof data === 'string') {
                            const mediaUrls = self.extractMediaUrlsFromText(data);
                            if (mediaUrls.length > 0) {
                                self.log(`Media URLs found in WebSocket message: ${mediaUrls.join(', ')}`, 'DEBUG');
                                mediaUrls.forEach(mediaUrl => {
                                    const mediaRequestId = self.generateRequestId();
                                    const mediaRequest = {
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
                    }
                    catch (error) {
                        self.log(`Error processing WebSocket message: ${error}`, 'ERROR');
                    }
                });
            }
        };
    }
    setupDeclarativeNetRequest() {
        if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
            this.log('declarativeNetRequest API not available', 'DEBUG');
            return;
        }
        try {
            this.updateDeclarativeNetRequestRules();
            this.log('declarativeNetRequest rules configured', 'DEBUG');
        }
        catch (error) {
            this.log(`declarativeNetRequest setup failed: ${error}`, 'ERROR');
        }
    }
    updateDeclarativeNetRequestRules() {
        if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
            return;
        }
        const rules = [];
        this.patterns.forEach((pattern, index) => {
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
        try {
            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: this.declarativeNetRequestRules.map(rule => rule.id),
                addRules: rules
            });
        }
        catch (error) {
            this.log(`Failed to update declarativeNetRequest rules: ${error}`, 'ERROR');
        }
    }
    restoreFetch() {
        window.fetch = this.originalFetch;
    }
    restoreXMLHttpRequest() {
        XMLHttpRequest.prototype.open = this.originalXhrOpen;
        XMLHttpRequest.prototype.send = this.originalXhrSend;
    }
    restoreWebSocket() {
    }
    cleanupDeclarativeNetRequest() {
        if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
            return;
        }
        try {
            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: this.declarativeNetRequestRules.map(rule => rule.id)
            });
        }
        catch (error) {
            this.log(`Failed to cleanup declarativeNetRequest rules: ${error}`, 'ERROR');
        }
    }
    initializePatterns() {
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
    isMediaRequest(request) {
        return this.isMediaRequestByUrl(request.url) || this.isMediaContentType(request.response?.contentType);
    }
    isMediaRequestByUrl(url) {
        return this.patterns.some(pattern => pattern.pattern.test(url));
    }
    isMediaContentType(contentType) {
        if (!contentType)
            return false;
        const mediaContentTypes = [
            'video/', 'audio/', 'application/vnd.apple.mpegurl', 'application/dash+xml'
        ];
        return mediaContentTypes.some(type => contentType.includes(type));
    }
    shouldCaptureBody(response) {
        const contentType = response.headers.get('content-type') || '';
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        return contentLength < 10 * 1024 * 1024 &&
            (contentType.includes('application/vnd.apple.mpegurl') ||
                contentType.includes('application/dash+xml') ||
                contentType.includes('text/plain'));
    }
    extractHeaders(init, requestHeaders) {
        const headers = {};
        if (init) {
            if (init instanceof Headers) {
                init.forEach((value, key) => headers[key] = value);
            }
            else if (Array.isArray(init)) {
                init.forEach(([key, value]) => headers[key] = value);
            }
            else {
                Object.assign(headers, init);
            }
        }
        if (requestHeaders) {
            requestHeaders.forEach((value, key) => headers[key] = value);
        }
        return headers;
    }
    extractResponseHeaders(headers) {
        const result = {};
        headers.forEach((value, key) => result[key] = value);
        return result;
    }
    parseXHRHeaders(headersString) {
        const headers = {};
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
    addStealthHeaders(init) {
        if (!this.stealthConfig.mimicBrowserBehavior) {
            return init;
        }
        const stealthHeaders = {
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
    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }
    extractMediaUrlsFromText(text) {
        const urls = [];
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
        return Array.from(new Set(urls));
    }
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    convertRegexToUrlFilter(regex) {
        const source = regex.source;
        if (source.includes('\\.mp4'))
            return '*mp4*';
        if (source.includes('\\.webm'))
            return '*webm*';
        if (source.includes('\\.m3u8'))
            return '*m3u8*';
        if (source.includes('\\.mpd'))
            return '*mpd*';
        if (source.includes('blob:'))
            return 'blob:*';
        return null;
    }
    notifyMediaDiscovered(request) {
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
    generateRequestId() {
        return `req_${Date.now()}_${++this.requestCounter}`;
    }
    getDefaultDebugConfig() {
        return {
            enabled: false,
            level: 'INFO',
            logNetworkRequests: false,
            logDetectionResults: false,
            logCryptoOperations: false,
            saveToFile: false
        };
    }
    getDefaultStealthConfig() {
        return {
            randomizeUserAgent: true,
            randomizeRequestTiming: true,
            mimicBrowserBehavior: true,
            avoidDetection: true,
            maxConcurrentRequests: 4,
            requestDelay: { min: 100, max: 500 }
        };
    }
    log(message, level) {
        if (!this.debugConfig.enabled)
            return;
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
