/**
 * FocusPulse Settings Panel
 *
 * Lightweight settings for customization:
 * - Streak threshold (% green needed for a streak day)
 * - Productivity score formula weights
 * - Toggle for micro-toasts
 * - Toggle for idle detection suggestions
 * - Data export
 */

let settingsPanel = null;

const DEFAULT_SETTINGS = {
  streakThreshold: 0.4, // 40% green = streak day
  enableToasts: true,
  enableIdleDetection: true,
  idleThreshold: 15, // minutes of inactivity before suggestion
  greenWeight: 1.0,
  blueWeight: 0.5,
  orangePenalty: 1.0,
  redPenalty: 0.25
};

/**
 * Load settings from storage
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('focuspulse_settings', (result) => {
      resolve(result.focuspulse_settings || DEFAULT_SETTINGS);
    });
  });
}

/**
 * Save settings to storage
 */
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ focuspulse_settings: settings }, resolve);
  });
}

/**
 * Show settings panel
 */
async function showSettings() {
  if (settingsPanel) {
    settingsPanel.style.display = 'flex';
    return;
  }

  const settings = await loadSettings();

  settingsPanel = document.createElement('div');
  settingsPanel.id = 'focuspulse-settings-panel';
  settingsPanel.innerHTML = `
    <div class="settings-container">
      <div class="settings-header">
        <h2>FocusPulse Settings</h2>
        <button class="settings-close-btn" aria-label="Close settings">&times;</button>
      </div>

      <div class="settings-content">
        <div class="settings-section">
          <h3>Streak Settings</h3>
          <div class="settings-item">
            <label for="streak-threshold">Streak Threshold (% green needed for a streak day)</label>
            <div class="settings-control">
              <input type="range" id="streak-threshold" min="0" max="100" value="${settings.streakThreshold * 100}" step="5">
              <span class="settings-value">${Math.round(settings.streakThreshold * 100)}%</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Notifications</h3>
          <div class="settings-item">
            <label for="enable-toasts">
              <input type="checkbox" id="enable-toasts" ${settings.enableToasts ? 'checked' : ''}>
              Enable toast notifications
            </label>
          </div>
          <div class="settings-item">
            <label for="enable-idle">
              <input type="checkbox" id="enable-idle" ${settings.enableIdleDetection ? 'checked' : ''}>
              Enable idle detection suggestions
            </label>
          </div>
          <div class="settings-item">
            <label for="idle-threshold">Idle suggestion threshold (minutes)</label>
            <input type="number" id="idle-threshold" min="5" max="60" value="${settings.idleThreshold}" step="5">
          </div>
        </div>

        <div class="settings-section">
          <h3>Data</h3>
          <button class="settings-btn" id="export-json-btn">📥 Export as JSON</button>
          <button class="settings-btn" id="export-csv-btn">📥 Export as CSV</button>
          <button class="settings-btn settings-btn-danger" id="clear-data-btn">🗑️ Clear All Data</button>
        </div>

        <div class="settings-footer">
          <button class="settings-btn settings-btn-primary" id="save-settings-btn">Save Settings</button>
        </div>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = getSettingsCSS();
  settingsPanel.appendChild(style);

  document.body.appendChild(settingsPanel);

  // Attach event listeners
  const closeBtn = settingsPanel.querySelector('.settings-close-btn');
  closeBtn.addEventListener('click', hideSettings);

  const saveBtn = settingsPanel.querySelector('#save-settings-btn');
  saveBtn.addEventListener('click', () => saveSettingsFromPanel(settings));

  const exportJsonBtn = settingsPanel.querySelector('#export-json-btn');
  exportJsonBtn.addEventListener('click', exportDataAsJSON);

  const exportCsvBtn = settingsPanel.querySelector('#export-csv-btn');
  exportCsvBtn.addEventListener('click', exportDataAsCSV);

  const clearBtn = settingsPanel.querySelector('#clear-data-btn');
  clearBtn.addEventListener('click', clearAllData);

  // Update range display
  const streakInput = settingsPanel.querySelector('#streak-threshold');
  streakInput.addEventListener('input', (e) => {
    settingsPanel.querySelector('.settings-value').textContent = e.target.value + '%';
  });

  settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) {
      hideSettings();
    }
  });
}

/**
 * Hide settings panel
 */
function hideSettings() {
  if (settingsPanel) {
    settingsPanel.style.display = 'none';
  }
}

/**
 * Save settings from panel
 */
async function saveSettingsFromPanel() {
  const streakThreshold = parseInt(settingsPanel.querySelector('#streak-threshold').value) / 100;
  const enableToasts = settingsPanel.querySelector('#enable-toasts').checked;
  const enableIdle = settingsPanel.querySelector('#enable-idle').checked;
  const idleThreshold = parseInt(settingsPanel.querySelector('#idle-threshold').value);

  const settings = {
    streakThreshold,
    enableToasts,
    enableIdleDetection: enableIdle,
    idleThreshold,
    greenWeight: 1.0,
    blueWeight: 0.5,
    orangePenalty: 1.0,
    redPenalty: 0.25
  };

  await saveSettings(settings);
  showToast('✅ Settings saved!', 'success', 2000);
}

/**
 * Export data as JSON
 */
async function exportDataAsJSON() {
  const data = await new Promise((resolve) => {
    chrome.storage.local.get(null, resolve);
  });

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadFile(blob, 'focuspulse-data.json');
  showToast('📥 Data exported as JSON', 'success', 2000);
}

/**
 * Export data as CSV
 */
async function exportDataAsCSV() {
  const data = await new Promise((resolve) => {
    chrome.storage.local.get('sessionHistory', resolve);
  });

  const sessions = data.sessionHistory || [];

  let csv = 'Date,Color,Start Time,End Time,Duration (minutes)\n';
  sessions.forEach((session) => {
    const startDate = new Date(session.startTime);
    const durationMinutes = Math.round(session.durationSeconds / 60);
    csv += `"${new Date(session.startTime).toDateString()}","${session.color}","${startDate.toLocaleTimeString()}","${new Date(session.endTime).toLocaleTimeString()}","${durationMinutes}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  downloadFile(blob, 'focuspulse-sessions.csv');
  showToast('📥 Data exported as CSV', 'success', 2000);
}

/**
 * Download file helper
 */
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clear all data with confirmation
 */
function clearAllData() {
  const confirmed = confirm('⚠️ This will permanently delete all your FocusPulse data. Are you sure?');
  if (confirmed) {
    chrome.storage.local.clear(() => {
      showToast('🗑️ All data cleared', 'warning', 3000);
      hideSettings();
      // Reload page to reset widget
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    });
  }
}

/**
 * Get settings panel CSS
 */
function getSettingsCSS() {
  return `
    #focuspulse-settings-panel {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
    }

    .settings-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 90%;
      max-width: 500px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .settings-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .settings-close-btn {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 32px;
      height: 32px;
    }

    .settings-close-btn:hover {
      color: #1f2937;
    }

    .settings-content {
      overflow-y: auto;
      padding: 20px;
      flex: 1;
    }

    .settings-section {
      margin-bottom: 24px;
    }

    .settings-section h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .settings-item {
      margin-bottom: 12px;
    }

    .settings-item label {
      display: block;
      font-size: 13px;
      color: #374151;
      margin-bottom: 6px;
      font-weight: 500;
    }

    .settings-item input[type="checkbox"] {
      margin-right: 8px;
      cursor: pointer;
    }

    .settings-item input[type="number"],
    .settings-item input[type="range"] {
      width: 100%;
      padding: 6px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
    }

    .settings-control {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .settings-control input[type="range"] {
      flex: 1;
      width: auto;
    }

    .settings-value {
      min-width: 40px;
      text-align: right;
      font-weight: 600;
      color: #1f2937;
    }

    .settings-btn {
      display: block;
      width: 100%;
      padding: 10px;
      margin-bottom: 8px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .settings-btn:hover {
      background: #e5e7eb;
    }

    .settings-btn-primary {
      background: #10b981;
      color: white;
      border-color: #10b981;
    }

    .settings-btn-primary:hover {
      background: #059669;
    }

    .settings-btn-danger {
      background: #fee2e2;
      color: #991b1b;
      border-color: #fecaca;
    }

    .settings-btn-danger:hover {
      background: #fecaca;
    }

    .settings-footer {
      padding: 20px;
      border-top: 1px solid #e5e7eb;
    }
  `;
}
