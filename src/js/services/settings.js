// PegaTudo - Enhanced Settings
// Advanced configuration options for the extension

document.addEventListener('DOMContentLoaded', () => {
  const debugModeToggle = document.getElementById('debugModeToggle');
  const autoDownloadToggle = document.getElementById('autoDownloadToggle');
  const customNamingToggle = document.getElementById('customNamingToggle');
  const customNamingPattern = document.getElementById('customNamingPattern');
  const maxConcurrentDownloads = document.getElementById('maxConcurrentDownloads');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  const domDetectionToggle = document.getElementById('domDetectionToggle');
  const saveBtn = document.getElementById('saveSettings');
  const resetBtn = document.getElementById('resetSettings');

  // Default settings
  const defaultSettings = {
    debugMode: false,
    autoDownload: false,
    customNaming: false,
    customNamingPattern: '{filename}_{timestamp}',
    maxConcurrentDownloads: 3,
    autoRefresh: true,
    domDetection: true
  };

  // Load saved settings
  loadSettings();

  function loadSettings() {
    chrome.storage.sync.get(Object.keys(defaultSettings), (result) => {
      // Apply loaded settings with defaults
      const settings = { ...defaultSettings, ...result };
      
      debugModeToggle.checked = settings.debugMode;
      autoDownloadToggle.checked = settings.autoDownload;
      customNamingToggle.checked = settings.customNaming;
      customNamingPattern.value = settings.customNamingPattern;
      maxConcurrentDownloads.value = settings.maxConcurrentDownloads;
      autoRefreshToggle.checked = settings.autoRefresh;
      domDetectionToggle.checked = settings.domDetection;
      
      // Update UI state
      updateCustomNamingState();
      updateSettingsInfo();
    });
  }

  function saveSettings() {
    const settings = {
      debugMode: debugModeToggle.checked,
      autoDownload: autoDownloadToggle.checked,
      customNaming: customNamingToggle.checked,
      customNamingPattern: customNamingPattern.value,
      maxConcurrentDownloads: parseInt(maxConcurrentDownloads.value),
      autoRefresh: autoRefreshToggle.checked,
      domDetection: domDetectionToggle.checked
    };

    chrome.storage.sync.set(settings, () => {
      // Show save confirmation
      showSaveConfirmation();
      
      // Notify content scripts about changes
      notifyContentScripts(settings);
    });
  }

  function resetSettings() {
    if (confirm('Tem certeza que deseja restaurar as configurações padrão?')) {
      chrome.storage.sync.set(defaultSettings, () => {
        loadSettings();
        showSaveConfirmation('Configurações restauradas para o padrão!');
        notifyContentScripts(defaultSettings);
      });
    }
  }

  function updateCustomNamingState() {
    customNamingPattern.disabled = !customNamingToggle.checked;
    if (customNamingToggle.checked) {
      customNamingPattern.focus();
    }
  }

  function updateSettingsInfo() {
    const infoElement = document.getElementById('settingsInfo');
    if (infoElement) {
      const activeFeatures = [];
      if (debugModeToggle.checked) activeFeatures.push('Debug');
      if (autoDownloadToggle.checked) activeFeatures.push('Auto-download');
      if (customNamingToggle.checked) activeFeatures.push('Nomes personalizados');
      if (!domDetectionToggle.checked) activeFeatures.push('DOM detection desabilitado');
      
      infoElement.textContent = activeFeatures.length > 0 
        ? `Recursos ativos: ${activeFeatures.join(', ')}`
        : 'Configuração padrão ativa';
    }
  }

  function showSaveConfirmation(message = 'Configurações salvas!') {
    const confirmation = document.createElement('div');
    confirmation.className = 'save-confirmation';
    confirmation.textContent = message;
    document.body.appendChild(confirmation);

    setTimeout(() => {
      confirmation.classList.add('show');
    }, 100);

    setTimeout(() => {
      confirmation.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(confirmation);
      }, 300);
    }, 2000);
  }

  function notifyContentScripts(settings) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: settings
          }).catch(() => {
            // Silent fail for tabs without content scripts
          });
        }
      });
    });
  }

  // Event listeners
  debugModeToggle.addEventListener('change', updateSettingsInfo);
  autoDownloadToggle.addEventListener('change', updateSettingsInfo);
  customNamingToggle.addEventListener('change', () => {
    updateCustomNamingState();
    updateSettingsInfo();
  });
  domDetectionToggle.addEventListener('change', updateSettingsInfo);

  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);

  // Auto-save on change for most settings
  [debugModeToggle, autoDownloadToggle, autoRefreshToggle, domDetectionToggle].forEach(toggle => {
    toggle.addEventListener('change', () => {
      setTimeout(saveSettings, 100); // Small delay for UI feedback
    });
  });

  // Manual save for text inputs
  customNamingPattern.addEventListener('change', saveSettings);
  maxConcurrentDownloads.addEventListener('change', saveSettings);

  // Custom naming pattern validation
  customNamingPattern.addEventListener('input', (e) => {
    const pattern = e.target.value;
    const isValid = validateNamingPattern(pattern);
    
    e.target.classList.toggle('invalid', !isValid);
    
    const helpText = document.getElementById('customNamingHelp');
    if (helpText) {
      helpText.textContent = isValid 
        ? 'Padrão válido' 
        : 'Padrão inválido - use {filename}, {timestamp}, {date}, {time}';
      helpText.className = isValid ? 'help-text valid' : 'help-text invalid';
    }
  });

  function validateNamingPattern(pattern) {
    // Check for valid placeholders and no invalid characters
    const validPlaceholders = ['{filename}', '{timestamp}', '{date}', '{time}', '{type}'];
    const hasValidPlaceholder = validPlaceholders.some(placeholder => 
      pattern.includes(placeholder)
    );
    
    // Check for invalid filename characters
    const invalidChars = /[<>:"\/\\|?*]/g;
    const hasInvalidChars = invalidChars.test(pattern.replace(/\{[^}]+\}/g, ''));
    
    return hasValidPlaceholder && !hasInvalidChars && pattern.length > 0;
  }
});
