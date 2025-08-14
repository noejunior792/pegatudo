/**
 * PegaTudo Advanced Engine Integration
 * Integrates the advanced TypeScript engine with the existing extension
 */

// Enhanced content script with advanced engine integration
(function() {
    'use strict';
    
    let advancedEngine = null;
    let originalExtensionEnabled = true;
    
    // Initialize the advanced engine when available
    async function initializeAdvancedEngine() {
        try {
            // Check if the advanced engine classes are available
            if (typeof window.AdvancedVideoDetectionEngine !== 'undefined') {
                // Initialize advanced engine
                advancedEngine = new window.PegaTudoAdvancedEngine();
                await advancedEngine.initialize();
                
                console.log('PegaTudo Advanced Engine activated!');
                
                // Disable original extension to avoid conflicts
                originalExtensionEnabled = false;
                
                // Notify user of upgrade
                showUpgradeNotification();
                
            } else {
                console.log('PegaTudo running in compatibility mode');
                // Keep original extension active
                originalExtensionEnabled = true;
            }
        } catch (error) {
            console.warn('Advanced engine initialization failed:', error);
            console.log('Falling back to original extension');
            originalExtensionEnabled = true;
        }
    }
    
    // Show upgrade notification
    function showUpgradeNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 2147483647;
            max-width: 300px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🚀 PegaTudo Advanced Engine</div>
            <div style="font-size: 12px; opacity: 0.9;">
                Advanced video detection with encryption support, streaming protocols, and AI-powered extraction is now active!
            </div>
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.7;">
                Press Ctrl+Shift+P to open advanced interface
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    // Enhanced media detection combining both engines
    function enhancedMediaDetection() {
        if (advancedEngine) {
            // Use advanced engine
            advancedEngine.detectMedia().catch(error => {
                console.warn('Advanced detection failed:', error);
                // Fallback to original detection
                if (window.pegaTudoOriginalDetection) {
                    window.pegaTudoOriginalDetection();
                }
            });
        } else if (originalExtensionEnabled && window.pegaTudoOriginalDetection) {
            // Use original engine
            window.pegaTudoOriginalDetection();
        }
    }
    
    // Store original detection function
    if (typeof window.run === 'function') {
        window.pegaTudoOriginalDetection = window.run;
    }
    
    // Enhanced initialization
    function enhancedInitialize() {
        initializeAdvancedEngine();
        
        // Set up enhanced observers
        if (!advancedEngine && originalExtensionEnabled) {
            // Fall back to original extension
            if (window.initialize) {
                window.initialize();
            }
        }
        
        // Enhanced event listeners
        window.addEventListener('pegaTudoEngineStatus', (event) => {
            console.log('Engine status:', event.detail);
        });
        
        window.addEventListener('pegaTudoMediaDiscovered', (event) => {
            console.log('Media discovered:', event.detail);
        });
        
        // Periodic enhanced detection
        setInterval(enhancedMediaDetection, 5000);
    }
    
    // Advanced download handling
    function enhancedDownloadHandler(url, element) {
        if (advancedEngine) {
            // Let advanced engine handle it
            advancedEngine.detectMedia().then(results => {
                if (results.length > 0) {
                    // Advanced engine will show its UI
                    return;
                }
                // Fallback to original handler
                if (window.handleDownload) {
                    window.handleDownload(url, element);
                }
            });
        } else if (window.handleDownload) {
            window.handleDownload(url, element);
        }
    }
    
    // Override original functions with enhanced versions
    if (window.handleDownload) {
        window.handleDownloadOriginal = window.handleDownload;
        window.handleDownload = enhancedDownloadHandler;
    }
    
    // Enhanced storage handling
    chrome.storage.sync.get(['extensionEnabled', 'debugMode', 'advancedEngine'], (result) => {
        const extensionEnabled = result.extensionEnabled !== false;
        const debugMode = result.debugMode === true;
        const useAdvancedEngine = result.advancedEngine !== false;
        
        if (extensionEnabled) {
            if (useAdvancedEngine) {
                enhancedInitialize();
            } else if (window.initialize) {
                window.initialize();
            }
        }
        
        // Set debug mode
        if (debugMode && advancedEngine) {
            advancedEngine.setDebugMode(true);
        }
    });
    
    // Enhanced message handling
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'toggleExtension') {
            originalExtensionEnabled = message.enabled;
            
            if (advancedEngine) {
                advancedEngine.setEnabled(message.enabled);
            } else if (message.enabled && window.initialize) {
                window.initialize();
            } else if (!message.enabled && window.removeAllUI) {
                window.removeAllUI();
            }
        }
        
        if (message.action === 'toggleDebugMode') {
            if (advancedEngine) {
                advancedEngine.setDebugMode(message.enabled);
            }
        }
        
        if (message.action === 'triggerDetection') {
            enhancedMediaDetection();
        }
        
        if (message.action === 'getEngineStatus') {
            return Promise.resolve({
                advancedEngine: !!advancedEngine,
                originalEngine: originalExtensionEnabled,
                version: advancedEngine ? '3.0-advanced' : '2.2-compatible'
            });
        }
    });
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Ctrl+Shift+P: Trigger advanced detection
        if (event.ctrlKey && event.shiftKey && event.key === 'P') {
            event.preventDefault();
            enhancedMediaDetection();
        }
        
        // Ctrl+Shift+D: Quick download best quality
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault();
            if (advancedEngine && advancedEngine.quickDownloadBest) {
                advancedEngine.quickDownloadBest();
            } else {
                enhancedMediaDetection();
            }
        }
        
        // Ctrl+Shift+I: Show engine info
        if (event.ctrlKey && event.shiftKey && event.key === 'I') {
            event.preventDefault();
            console.log('PegaTudo Engine Status:', {
                advancedEngine: !!advancedEngine,
                originalEngine: originalExtensionEnabled,
                version: advancedEngine ? '3.0-advanced' : '2.2-compatible',
                detectedSources: advancedEngine ? advancedEngine.currentDetectionResults?.length || 0 : 'N/A'
            });
        }
    });
    
    // Performance monitoring
    let performanceMetrics = {
        detectionCount: 0,
        successfulDownloads: 0,
        failedDownloads: 0,
        averageDetectionTime: 0
    };
    
    function trackPerformance(operation, startTime) {
        const duration = performance.now() - startTime;
        
        switch (operation) {
            case 'detection':
                performanceMetrics.detectionCount++;
                performanceMetrics.averageDetectionTime = 
                    (performanceMetrics.averageDetectionTime + duration) / 2;
                break;
            case 'download_success':
                performanceMetrics.successfulDownloads++;
                break;
            case 'download_failure':
                performanceMetrics.failedDownloads++;
                break;
        }
        
        // Log performance every 10 operations
        if (performanceMetrics.detectionCount % 10 === 0) {
            console.log('PegaTudo Performance Metrics:', performanceMetrics);
        }
    }
    
    // Enhanced error handling
    window.addEventListener('error', (event) => {
        if (event.error && event.error.message && event.error.message.includes('PegaTudo')) {
            console.error('PegaTudo Error:', event.error);
            
            // Try to recover
            if (advancedEngine && advancedEngine.handleError) {
                advancedEngine.handleError(event.error);
            }
        }
    });
    
    // Expose enhanced API
    window.pegaTudoEnhanced = {
        getEngine: () => advancedEngine,
        triggerDetection: enhancedMediaDetection,
        getMetrics: () => performanceMetrics,
        isAdvanced: () => !!advancedEngine
    };
    
    console.log('PegaTudo Enhanced Integration loaded');
    
})();