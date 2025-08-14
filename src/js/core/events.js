/**
 * Advanced Event System for PegaTudo
 * Provides event-driven architecture with sophisticated event handling,
 * filtering, throttling, and cross-component communication
 */

import { logger } from './logger.js';

export class AdvancedEventSystem {
  constructor(options = {}) {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.eventHistory = [];
    this.eventQueue = [];
    this.middleware = [];
    this.config = {
      maxHistory: options.maxHistory || 1000,
      enablePersistence: options.enablePersistence || false,
      throttleDefaults: {
        enabled: false,
        wait: 100,
        maxWait: 1000
      },
      debounceDefaults: {
        enabled: false,
        wait: 100
      },
      enableCrossTab: options.enableCrossTab || false,
      enableMetrics: options.enableMetrics || true,
      ...options
    };

    this.metrics = {
      eventsEmitted: 0,
      listenersRegistered: 0,
      eventTypes: new Map(),
      errors: 0,
      throttledEvents: 0,
      debouncedEvents: 0
    };

    this.throttledEvents = new Map();
    this.debouncedEvents = new Map();
    this.namespaces = new Map();
    
    if (this.config.enableCrossTab) {
      this.setupCrossTabCommunication();
    }

    this.init();
  }

  init() {
    // Load persisted events if enabled
    if (this.config.enablePersistence) {
      this.loadPersistedEvents();
    }

    // Setup global error handling
    this.setupErrorHandling();

    logger.debug('Advanced Event System initialized', {
      maxHistory: this.config.maxHistory,
      persistence: this.config.enablePersistence,
      crossTab: this.config.enableCrossTab
    });
  }

  setupErrorHandling() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.emit('global:error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.emit('global:unhandledRejection', {
          reason: event.reason,
          promise: event.promise
        });
      });
    }
  }

  setupCrossTabCommunication() {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('pegatudo_events');
      this.broadcastChannel.onmessage = (event) => {
        const { type, data, origin, timestamp } = event.data;
        if (origin !== this.getInstanceId()) {
          this.emit(`crossTab:${type}`, data, { 
            crossTab: true, 
            origin, 
            timestamp 
          });
        }
      };
    }
  }

  getInstanceId() {
    if (!this.instanceId) {
      this.instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.instanceId;
  }

  // Event registration methods
  on(eventType, listener, options = {}) {
    const normalizedOptions = this.normalizeOptions(options);
    
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const wrappedListener = this.wrapListener(listener, normalizedOptions);
    this.listeners.get(eventType).add(wrappedListener);

    // Store original listener reference for removal
    wrappedListener.originalListener = listener;
    
    this.updateMetrics('listenersRegistered', 1);
    
    logger.debug(`Event listener registered: ${eventType}`, { options: normalizedOptions });

    // Return unsubscribe function
    return () => this.off(eventType, listener);
  }

  once(eventType, listener, options = {}) {
    const normalizedOptions = { ...this.normalizeOptions(options), once: true };
    
    if (!this.onceListeners.has(eventType)) {
      this.onceListeners.set(eventType, new Set());
    }

    const wrappedListener = this.wrapListener(listener, normalizedOptions);
    this.onceListeners.get(eventType).add(wrappedListener);
    
    wrappedListener.originalListener = listener;
    
    this.updateMetrics('listenersRegistered', 1);
    
    logger.debug(`One-time event listener registered: ${eventType}`);

    return () => this.off(eventType, listener);
  }

  off(eventType, listener) {
    let removed = false;

    // Remove from regular listeners
    const regularListeners = this.listeners.get(eventType);
    if (regularListeners) {
      for (const wrappedListener of regularListeners) {
        if (wrappedListener.originalListener === listener) {
          regularListeners.delete(wrappedListener);
          removed = true;
          break;
        }
      }
      
      if (regularListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }

    // Remove from once listeners
    const onceListeners = this.onceListeners.get(eventType);
    if (onceListeners) {
      for (const wrappedListener of onceListeners) {
        if (wrappedListener.originalListener === listener) {
          onceListeners.delete(wrappedListener);
          removed = true;
          break;
        }
      }
      
      if (onceListeners.size === 0) {
        this.onceListeners.delete(eventType);
      }
    }

    if (removed) {
      logger.debug(`Event listener removed: ${eventType}`);
    }

    return removed;
  }

  offAll(eventType) {
    let count = 0;
    
    if (this.listeners.has(eventType)) {
      count += this.listeners.get(eventType).size;
      this.listeners.delete(eventType);
    }
    
    if (this.onceListeners.has(eventType)) {
      count += this.onceListeners.get(eventType).size;
      this.onceListeners.delete(eventType);
    }

    logger.debug(`All listeners removed for event: ${eventType}`, { count });
    return count;
  }

  normalizeOptions(options) {
    return {
      namespace: options.namespace || 'default',
      priority: options.priority || 0,
      throttle: options.throttle || false,
      debounce: options.debounce || false,
      condition: options.condition || null,
      transform: options.transform || null,
      crossTab: options.crossTab || false,
      persistent: options.persistent || false,
      async: options.async || false,
      once: options.once || false,
      ...options
    };
  }

  wrapListener(listener, options) {
    const wrappedListener = async (data, meta = {}) => {
      try {
        // Check condition
        if (options.condition && !options.condition(data, meta)) {
          return;
        }

        // Transform data
        let transformedData = data;
        if (options.transform) {
          transformedData = options.transform(data, meta);
        }

        // Execute listener
        if (options.async) {
          await listener(transformedData, meta);
        } else {
          listener(transformedData, meta);
        }
      } catch (error) {
        this.handleListenerError(error, listener, data, meta);
      }
    };

    // Copy options to wrapper
    wrappedListener.options = options;
    wrappedListener.originalListener = listener;

    return wrappedListener;
  }

  handleListenerError(error, listener, data, meta) {
    this.updateMetrics('errors', 1);
    
    logger.error('Event listener error', {
      error: error.message,
      stack: error.stack,
      data,
      meta
    });

    this.emit('system:listenerError', {
      error,
      listener,
      data,
      meta,
      timestamp: new Date()
    });
  }

  // Event emission methods
  emit(eventType, data = null, meta = {}) {
    const eventData = {
      type: eventType,
      data,
      meta: {
        timestamp: new Date(),
        source: 'local',
        id: this.generateEventId(),
        ...meta
      }
    };

    // Process middleware
    if (!this.processMiddleware(eventData)) {
      return false;
    }

    // Handle throttling
    if (this.isThrottled(eventType)) {
      this.updateMetrics('throttledEvents', 1);
      return false;
    }

    // Handle debouncing
    if (this.isDebounced(eventType)) {
      this.scheduleDebounced(eventType, eventData);
      return true;
    }

    return this.executeEmit(eventData);
  }

  async emitAsync(eventType, data = null, meta = {}) {
    const eventData = {
      type: eventType,
      data,
      meta: {
        timestamp: new Date(),
        source: 'local',
        id: this.generateEventId(),
        async: true,
        ...meta
      }
    };

    if (!this.processMiddleware(eventData)) {
      return false;
    }

    return this.executeEmitAsync(eventData);
  }

  executeEmit(eventData) {
    const { type, data, meta } = eventData;
    
    // Record event history
    this.recordEvent(eventData);
    
    // Update metrics
    this.updateMetrics('eventsEmitted', 1);
    this.updateEventTypeMetrics(type);

    let listenersExecuted = 0;

    // Execute regular listeners
    const regularListeners = this.listeners.get(type);
    if (regularListeners) {
      const sortedListeners = Array.from(regularListeners)
        .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));
      
      for (const listener of sortedListeners) {
        listener(data, meta);
        listenersExecuted++;
      }
    }

    // Execute once listeners
    const onceListeners = this.onceListeners.get(type);
    if (onceListeners) {
      const sortedListeners = Array.from(onceListeners)
        .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));
      
      for (const listener of sortedListeners) {
        listener(data, meta);
        listenersExecuted++;
      }
      
      // Clear once listeners after execution
      this.onceListeners.delete(type);
    }

    // Emit to cross-tab if enabled
    if (meta.crossTab && this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type,
        data,
        origin: this.getInstanceId(),
        timestamp: meta.timestamp
      });
    }

    // Persist event if needed
    if (meta.persistent && this.config.enablePersistence) {
      this.persistEvent(eventData);
    }

    logger.debug(`Event emitted: ${type}`, { 
      listenersExecuted, 
      data: typeof data === 'object' ? Object.keys(data) : data 
    });

    return listenersExecuted > 0;
  }

  async executeEmitAsync(eventData) {
    const { type, data, meta } = eventData;
    
    this.recordEvent(eventData);
    this.updateMetrics('eventsEmitted', 1);
    this.updateEventTypeMetrics(type);

    const promises = [];

    // Execute regular listeners
    const regularListeners = this.listeners.get(type);
    if (regularListeners) {
      const sortedListeners = Array.from(regularListeners)
        .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));
      
      for (const listener of sortedListeners) {
        promises.push(listener(data, meta));
      }
    }

    // Execute once listeners
    const onceListeners = this.onceListeners.get(type);
    if (onceListeners) {
      const sortedListeners = Array.from(onceListeners)
        .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));
      
      for (const listener of sortedListeners) {
        promises.push(listener(data, meta));
      }
      
      this.onceListeners.delete(type);
    }

    try {
      await Promise.all(promises);
      return promises.length > 0;
    } catch (error) {
      logger.error('Error in async event execution', { type, error });
      return false;
    }
  }

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  // Middleware system
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    
    this.middleware.push(middleware);
    logger.debug('Middleware added', { count: this.middleware.length });
  }

  processMiddleware(eventData) {
    for (const middleware of this.middleware) {
      try {
        const result = middleware(eventData);
        if (result === false) {
          logger.debug('Event blocked by middleware', { type: eventData.type });
          return false;
        }
      } catch (error) {
        logger.error('Middleware error', { error, eventType: eventData.type });
        return false;
      }
    }
    return true;
  }

  // Throttling and debouncing
  throttle(eventType, wait = 100, options = {}) {
    this.throttledEvents.set(eventType, {
      wait,
      maxWait: options.maxWait || wait * 10,
      lastExecuted: 0,
      ...options
    });
  }

  debounce(eventType, wait = 100, options = {}) {
    this.debouncedEvents.set(eventType, {
      wait,
      immediate: options.immediate || false,
      ...options
    });
  }

  isThrottled(eventType) {
    const throttleConfig = this.throttledEvents.get(eventType);
    if (!throttleConfig) return false;

    const now = Date.now();
    const timeSinceLastExecution = now - throttleConfig.lastExecuted;
    
    if (timeSinceLastExecution < throttleConfig.wait) {
      return true;
    }
    
    throttleConfig.lastExecuted = now;
    return false;
  }

  isDebounced(eventType) {
    return this.debouncedEvents.has(eventType);
  }

  scheduleDebounced(eventType, eventData) {
    const debounceConfig = this.debouncedEvents.get(eventType);
    if (!debounceConfig) return;

    // Clear existing timeout
    if (debounceConfig.timeoutId) {
      clearTimeout(debounceConfig.timeoutId);
    }

    // Schedule new execution
    debounceConfig.timeoutId = setTimeout(() => {
      this.executeEmit(eventData);
      this.updateMetrics('debouncedEvents', 1);
    }, debounceConfig.wait);
  }

  // Event history and queuing
  recordEvent(eventData) {
    this.eventHistory.push(eventData);
    
    // Maintain history size limit
    if (this.eventHistory.length > this.config.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxHistory);
    }
  }

  getEventHistory(filter = {}) {
    let history = [...this.eventHistory];

    if (filter.type) {
      history = history.filter(event => event.type === filter.type);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(event => new Date(event.meta.timestamp) >= since);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  clearHistory() {
    this.eventHistory = [];
    logger.debug('Event history cleared');
  }

  // Namespace support
  namespace(name) {
    if (!this.namespaces.has(name)) {
      this.namespaces.set(name, new AdvancedEventSystem({
        ...this.config,
        enableCrossTab: false // Namespaces don't support cross-tab by default
      }));
    }
    return this.namespaces.get(name);
  }

  // Metrics and monitoring
  updateMetrics(metric, value) {
    if (!this.config.enableMetrics) return;
    
    if (typeof this.metrics[metric] === 'number') {
      this.metrics[metric] += value;
    } else {
      this.metrics[metric] = value;
    }
  }

  updateEventTypeMetrics(eventType) {
    if (!this.config.enableMetrics) return;
    
    const count = this.metrics.eventTypes.get(eventType) || 0;
    this.metrics.eventTypes.set(eventType, count + 1);
  }

  getMetrics() {
    return {
      ...this.metrics,
      eventTypes: Object.fromEntries(this.metrics.eventTypes),
      uptime: Date.now() - (this.startTime || Date.now()),
      listenerCount: this.getListenerCount(),
      eventHistorySize: this.eventHistory.length,
      middlewareCount: this.middleware.length,
      namespaceCount: this.namespaces.size
    };
  }

  getListenerCount() {
    let count = 0;
    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }
    for (const listeners of this.onceListeners.values()) {
      count += listeners.size;
    }
    return count;
  }

  // Persistence
  async persistEvent(eventData) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const key = `pegatudo_event_${eventData.meta.id}`;
        await chrome.storage.local.set({ [key]: eventData });
      }
    } catch (error) {
      logger.error('Failed to persist event', error);
    }
  }

  async loadPersistedEvents() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(null);
        const eventKeys = Object.keys(result).filter(key => key.startsWith('pegatudo_event_'));
        
        for (const key of eventKeys) {
          const eventData = result[key];
          if (eventData && eventData.meta.persistent) {
            this.recordEvent(eventData);
          }
        }
        
        logger.debug('Loaded persisted events', { count: eventKeys.length });
      }
    } catch (error) {
      logger.error('Failed to load persisted events', error);
    }
  }

  // Utility methods
  hasListeners(eventType) {
    return (this.listeners.has(eventType) && this.listeners.get(eventType).size > 0) ||
           (this.onceListeners.has(eventType) && this.onceListeners.get(eventType).size > 0);
  }

  getEventTypes() {
    const types = new Set();
    for (const type of this.listeners.keys()) types.add(type);
    for (const type of this.onceListeners.keys()) types.add(type);
    return Array.from(types);
  }

  destroy() {
    this.listeners.clear();
    this.onceListeners.clear();
    this.eventHistory = [];
    this.eventQueue = [];
    this.middleware = [];
    this.throttledEvents.clear();
    this.debouncedEvents.clear();
    this.namespaces.clear();

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }

    logger.debug('Event system destroyed');
  }
}

// Create global event system instance
export const eventSystem = new AdvancedEventSystem({
  enableCrossTab: true,
  enableMetrics: true,
  enablePersistence: false,
  maxHistory: 1000
});

// Export convenience functions
export const on = (eventType, listener, options) => eventSystem.on(eventType, listener, options);
export const once = (eventType, listener, options) => eventSystem.once(eventType, listener, options);
export const off = (eventType, listener) => eventSystem.off(eventType, listener);
export const emit = (eventType, data, meta) => eventSystem.emit(eventType, data, meta);
export const emitAsync = (eventType, data, meta) => eventSystem.emitAsync(eventType, data, meta);

// Namespace shortcuts
export const createNamespace = (name) => eventSystem.namespace(name);

export default AdvancedEventSystem;