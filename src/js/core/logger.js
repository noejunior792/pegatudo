/**
 * Advanced Logging System for PegaTudo
 * Comprehensive logging with multiple outputs, filtering, and performance monitoring
 */

import { LogLevel } from './types.js';

export class AdvancedLogger {
  constructor(options = {}) {
    this.config = {
      enabled: options.enabled !== false,
      level: options.level || LogLevel.INFO,
      logNetworkRequests: options.logNetworkRequests || false,
      logDetectionResults: options.logDetectionResults || false,
      logCryptoOperations: options.logCryptoOperations || false,
      saveToFile: options.saveToFile || false,
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      prefix: options.prefix || 'PegaTudo',
      includeTimestamp: options.includeTimestamp !== false,
      includeStack: options.includeStack || false,
      colorize: options.colorize !== false,
      persistLogs: options.persistLogs || false,
      ...options
    };

    this.logs = [];
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.metrics = {
      logsWritten: 0,
      errorsLogged: 0,
      warningsLogged: 0,
      performanceEntries: []
    };

    this.colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[35m', // Magenta
      RESET: '\x1b[0m'
    };

    if (this.config.persistLogs) {
      this.loadPersistedLogs();
    }

    this.setupPerformanceMonitoring();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setupPerformanceMonitoring() {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`pegatudo_session_start_${this.sessionId}`);
    }
  }

  shouldLog(level) {
    if (!this.config.enabled) return false;
    const numericLevel = typeof level === 'string' ? LogLevel[level] : level;
    return numericLevel >= this.config.level;
  }

  formatMessage(level, message, data = null, meta = {}) {
    const timestamp = new Date().toISOString();
    const levelStr = typeof level === 'number' ? 
      Object.keys(LogLevel)[level] : level.toString();
    
    let formattedMessage = '';
    
    if (this.config.includeTimestamp) {
      formattedMessage += `[${timestamp}] `;
    }
    
    if (this.config.colorize && typeof window === 'undefined') {
      formattedMessage += `${this.colors[levelStr] || ''}[${this.config.prefix}:${levelStr}]${this.colors.RESET} `;
    } else {
      formattedMessage += `[${this.config.prefix}:${levelStr}] `;
    }
    
    formattedMessage += message;

    const logEntry = {
      id: this.generateLogId(),
      timestamp,
      level: levelStr,
      message,
      data,
      meta: {
        sessionId: this.sessionId,
        url: typeof window !== 'undefined' ? window.location.href : 'background',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        ...meta
      },
      formattedMessage
    };

    if (this.config.includeStack && (level === LogLevel.ERROR || level === LogLevel.FATAL)) {
      logEntry.stack = new Error().stack;
    }

    return logEntry;
  }

  generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  writeLog(logEntry) {
    if (!this.shouldLog(logEntry.level)) return;

    this.logs.push(logEntry);
    this.metrics.logsWritten++;

    if (logEntry.level === 'ERROR' || logEntry.level === 'FATAL') {
      this.metrics.errorsLogged++;
    } else if (logEntry.level === 'WARN') {
      this.metrics.warningsLogged++;
    }

    // Output to console
    this.outputToConsole(logEntry);

    // Save to file if enabled
    if (this.config.saveToFile) {
      this.saveToFile(logEntry);
    }

    // Persist logs if enabled
    if (this.config.persistLogs) {
      this.persistLogs();
    }

    // Manage log size
    this.manageLogs();
  }

  outputToConsole(logEntry) {
    const { level, formattedMessage, data } = logEntry;
    
    switch (level) {
      case 'DEBUG':
        if (data) {
          console.debug(formattedMessage, data);
        } else {
          console.debug(formattedMessage);
        }
        break;
      case 'INFO':
        if (data) {
          console.info(formattedMessage, data);
        } else {
          console.info(formattedMessage);
        }
        break;
      case 'WARN':
        if (data) {
          console.warn(formattedMessage, data);
        } else {
          console.warn(formattedMessage);
        }
        break;
      case 'ERROR':
      case 'FATAL':
        if (data) {
          console.error(formattedMessage, data);
        } else {
          console.error(formattedMessage);
        }
        if (logEntry.stack) {
          console.error('Stack trace:', logEntry.stack);
        }
        break;
      default:
        if (data) {
          console.log(formattedMessage, data);
        } else {
          console.log(formattedMessage);
        }
    }
  }

  async saveToFile(logEntry) {
    try {
      const logData = JSON.stringify(logEntry) + '\n';
      
      // Use modern File System Access API if available
      if (typeof window !== 'undefined' && window.showSaveFilePicker) {
        await this.saveWithFileSystemAPI(logData);
      } else {
        // Fallback to download
        this.downloadLogFile(logData);
      }
    } catch (error) {
      console.error('Failed to save log to file:', error);
    }
  }

  async saveWithFileSystemAPI(logData) {
    try {
      if (!this.fileHandle) {
        this.fileHandle = await window.showSaveFilePicker({
          suggestedName: `pegatudo_logs_${this.sessionId}.log`,
          types: [{
            description: 'Log files',
            accept: { 'text/plain': ['.log', '.txt'] }
          }]
        });
      }

      const writable = await this.fileHandle.createWritable({ keepExistingData: true });
      await writable.write(logData);
      await writable.close();
    } catch (error) {
      console.warn('File System API save failed:', error);
    }
  }

  downloadLogFile(logData) {
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pegatudo_logs_${this.sessionId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  manageLogs() {
    // Keep only the most recent logs if size limit exceeded
    const totalSize = JSON.stringify(this.logs).length;
    if (totalSize > this.config.maxLogSize) {
      const keepCount = Math.floor(this.logs.length * 0.7); // Keep 70%
      this.logs = this.logs.slice(-keepCount);
    }
  }

  persistLogs() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const recentLogs = this.logs.slice(-100); // Keep only recent 100 logs
        chrome.storage.local.set({
          [`pegatudo_logs_${this.sessionId}`]: {
            logs: recentLogs,
            metrics: this.metrics,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.warn('Failed to persist logs:', error);
    }
  }

  async loadPersistedLogs() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(null);
        const logKeys = Object.keys(result).filter(key => key.startsWith('pegatudo_logs_'));
        
        for (const key of logKeys) {
          const logData = result[key];
          if (logData && logData.logs) {
            this.logs.push(...logData.logs);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted logs:', error);
    }
  }

  // Public logging methods
  debug(message, data = null, meta = {}) {
    const logEntry = this.formatMessage(LogLevel.DEBUG, message, data, meta);
    this.writeLog(logEntry);
  }

  info(message, data = null, meta = {}) {
    const logEntry = this.formatMessage(LogLevel.INFO, message, data, meta);
    this.writeLog(logEntry);
  }

  warn(message, data = null, meta = {}) {
    const logEntry = this.formatMessage(LogLevel.WARN, message, data, meta);
    this.writeLog(logEntry);
  }

  error(message, data = null, meta = {}) {
    const logEntry = this.formatMessage(LogLevel.ERROR, message, data, meta);
    this.writeLog(logEntry);
  }

  fatal(message, data = null, meta = {}) {
    const logEntry = this.formatMessage(LogLevel.FATAL, message, data, meta);
    this.writeLog(logEntry);
  }

  // Performance logging
  time(label) {
    const startTime = performance.now();
    this.metrics.performanceEntries.push({
      label,
      startTime,
      endTime: null,
      duration: null,
      type: 'timer'
    });
    this.debug(`Timer started: ${label}`);
  }

  timeEnd(label) {
    const endTime = performance.now();
    const entry = this.metrics.performanceEntries.find(e => 
      e.label === label && e.endTime === null
    );
    
    if (entry) {
      entry.endTime = endTime;
      entry.duration = endTime - entry.startTime;
      this.info(`Timer ended: ${label} - ${entry.duration.toFixed(2)}ms`);
    }
  }

  // Network request logging
  logNetworkRequest(request, response = null) {
    if (!this.config.logNetworkRequests) return;
    
    this.debug('Network Request', {
      url: request.url,
      method: request.method,
      headers: request.headers,
      timestamp: new Date(),
      response: response ? {
        status: response.status,
        headers: response.headers,
        size: response.size
      } : null
    }, { category: 'network' });
  }

  // Detection result logging
  logDetectionResult(result) {
    if (!this.config.logDetectionResults) return;
    
    this.info('Detection Result', {
      platform: result.platform,
      sourcesFound: result.sources.length,
      detectionMethod: result.detectionMethod,
      confidence: result.confidence,
      timestamp: result.timestamp
    }, { category: 'detection' });
  }

  // Crypto operation logging
  logCryptoOperation(operation, details) {
    if (!this.config.logCryptoOperations) return;
    
    this.debug(`Crypto Operation: ${operation}`, details, { category: 'crypto' });
  }

  // Get logs with filtering
  getLogs(filter = {}) {
    let filteredLogs = [...this.logs];

    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }

    if (filter.category) {
      filteredLogs = filteredLogs.filter(log => 
        log.meta && log.meta.category === filter.category
      );
    }

    if (filter.since) {
      const since = new Date(filter.since);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= since
      );
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        log.message.toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.data).toLowerCase().includes(searchTerm)
      );
    }

    return filteredLogs;
  }

  // Export logs
  exportLogs(format = 'json') {
    const logs = this.getLogs();
    
    switch (format) {
      case 'json':
        return JSON.stringify({
          sessionId: this.sessionId,
          startTime: this.startTime,
          metrics: this.metrics,
          logs
        }, null, 2);
      
      case 'csv':
        return this.exportLogsAsCSV(logs);
      
      case 'txt':
        return logs.map(log => log.formattedMessage).join('\n');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  exportLogsAsCSV(logs) {
    const headers = ['timestamp', 'level', 'message', 'data', 'url'];
    const rows = logs.map(log => [
      log.timestamp,
      log.level,
      log.message.replace(/"/g, '""'),
      log.data ? JSON.stringify(log.data).replace(/"/g, '""') : '',
      log.meta.url || ''
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    this.metrics = {
      logsWritten: 0,
      errorsLogged: 0,
      warningsLogged: 0,
      performanceEntries: []
    };
    this.info('Logs cleared');
  }

  // Get metrics
  getMetrics() {
    return {
      ...this.metrics,
      sessionId: this.sessionId,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      totalLogs: this.logs.length,
      memoryUsage: this.getMemoryUsage()
    };
  }

  getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }
}

// Create global logger instance
export const logger = new AdvancedLogger();

// Export convenience functions
export const debug = (...args) => logger.debug(...args);
export const info = (...args) => logger.info(...args);
export const warn = (...args) => logger.warn(...args);
export const error = (...args) => logger.error(...args);
export const fatal = (...args) => logger.fatal(...args);

export default AdvancedLogger;