/**
 * FocusPulse Content Script
 *
 * Renders the floating widget on every tab.
 * Syncs with background service worker to maintain persistent state.
 * Handles all user interactions (color clicks, dragging, expanding/collapsing).
 *
 * Key architectural points:
 * - Listens to chrome.storage.onChanged to detect state updates from other tabs
 * - Sends messages to background worker to update state
 * - Never stores its own copy of truth; always fetches latest from background
 */

let widgetContainer = null;
let currentState = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

/**
 * Initialize widget on page load
 */
function initializeWidget() {
  // Fetch current state from background worker
  chrome.runtime.sendMessage(
    { type: 'GET_STATE' },
    (response) => {
      if (response.success) {
        currentState = response.state;
        createWidget();
        setupStateListeners();
      }
    }
  );
}

/**
 * Create the widget DOM structure
 */
function createWidget() {
  // Remove existing widget if any (to avoid duplicates on navigation)
  if (widgetContainer) {
    widgetContainer.remove();
  }

  // Create container
  widgetContainer = document.createElement('div');
  widgetContainer.id = 'focuspulse-widget';
  widgetContainer.classList.add('focuspulse-widget');

  // Position based on stored position
  widgetContainer.style.left = currentState.widgetPosition.x + 'px';
  widgetContainer.style.top = currentState.widgetPosition.y + 'px';

  // Build HTML
  if (currentState.isCollapsed) {
    widgetContainer.innerHTML = `
      <div class="widget-pill">
        <div class="pill-dot" style="background-color: ${getColorValue(currentState.activeColor)}"></div>
      </div>
    `;
  } else {
    widgetContainer.innerHTML = `
      <div class="widget-panel">
        <div class="widget-header">
          <span class="widget-title">FocusPulse</span>
          <button class="widget-collapse-btn" aria-label="Collapse widget">−</button>
        </div>

        <div class="widget-buttons">
          <button class="color-btn green-btn ${currentState.activeColor === 'green' ? 'active' : ''}"
                  data-color="green" title="Green: Deep Focus">
            <span class="btn-circle"></span>
            <span class="btn-label">Focus</span>
          </button>
          <button class="color-btn blue-btn ${currentState.activeColor === 'blue' ? 'active' : ''}"
                  data-color="blue" title="Blue: Working + Audio">
            <span class="btn-circle"></span>
            <span class="btn-label">Audio</span>
          </button>
          <button class="color-btn orange-btn ${currentState.activeColor === 'orange' ? 'active' : ''}"
                  data-color="orange" title="Orange: Distracted">
            <span class="btn-circle"></span>
            <span class="btn-label">Distracted</span>
          </button>
          <button class="color-btn red-btn ${currentState.activeColor === 'red' ? 'active' : ''}"
                  data-color="red" title="Red: Break">
            <span class="btn-circle"></span>
            <span class="btn-label">Break</span>
          </button>
        </div>

        <div class="widget-stats">
          <div class="stat-bar">
            <div class="stat-segment green-seg" style="width: ${getTodayPercentage('green')}%"></div>
            <div class="stat-segment blue-seg" style="width: ${getTodayPercentage('blue')}%"></div>
            <div class="stat-segment orange-seg" style="width: ${getTodayPercentage('orange')}%"></div>
            <div class="stat-segment red-seg" style="width: ${getTodayPercentage('red')}%"></div>
          </div>
          <div class="stat-labels">
            <span class="stat-label">G: ${formatTime(currentState.todaysSessions.green)}</span>
            <span class="stat-label">B: ${formatTime(currentState.todaysSessions.blue)}</span>
            <span class="stat-label">O: ${formatTime(currentState.todaysSessions.orange)}</span>
            <span class="stat-label">R: ${formatTime(currentState.todaysSessions.red)}</span>
          </div>
        </div>
      </div>
    `;
  }

  document.body.appendChild(widgetContainer);

  // Attach event listeners
  attachEventListeners();
}

/**
 * Attach event listeners to widget
 */
function attachEventListeners() {
  // Color buttons
  const colorBtns = widgetContainer.querySelectorAll('.color-btn');
  colorBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = btn.dataset.color;

      if (color === 'orange') {
        promptOrangeLogging();
      } else {
        switchColor(color);
      }
    });
  });

  // Collapse/expand button
  const collapseBtn = widgetContainer.querySelector('.widget-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapsed();
    });
  }

  // Pill mode: click to expand
  const pill = widgetContainer.querySelector('.widget-pill');
  if (pill) {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapsed();
    });
  }

  // Dragging (on header for full view, anywhere on pill)
  const dragHandle = widgetContainer.querySelector('.widget-header') || widgetContainer.querySelector('.widget-pill');
  if (dragHandle) {
    dragHandle.addEventListener('mousedown', startDrag);
  }
}

/**
 * Start dragging widget
 */
function startDrag(e) {
  e.preventDefault();
  isDragging = true;

  const rect = widgetContainer.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', stopDrag);
}

/**
 * Handle dragging
 */
function onDragMove(e) {
  if (!isDragging) return;

  const x = Math.max(0, e.clientX - dragOffset.x);
  const y = Math.max(0, e.clientY - dragOffset.y);

  widgetContainer.style.left = x + 'px';
  widgetContainer.style.top = y + 'px';
}

/**
 * Stop dragging and save position
 */
function stopDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', stopDrag);

  // Save position to background worker
  const rect = widgetContainer.getBoundingClientRect();
  chrome.runtime.sendMessage(
    {
      type: 'POSITION_UPDATE',
      position: { x: rect.left, y: rect.top }
    },
    () => {
      // Position saved
    }
  );
}

/**
 * Switch active color
 */
function switchColor(color) {
  chrome.runtime.sendMessage(
    { type: 'COLOR_SWITCH', color: color },
    (response) => {
      if (response.success) {
        currentState = response.state;
        updateWidget();
      }
    }
  );
}

/**
 * Prompt user for orange time estimation
 */
function promptOrangeLogging() {
  const minutes = prompt(
    'How many minutes do you think you wasted?\n\n(We'll add a 10-minute penalty on top)',
    '5'
  );

  if (minutes !== null) {
    const estimatedMinutes = Math.max(0, parseInt(minutes) || 0);
    chrome.runtime.sendMessage(
      {
        type: 'ORANGE_LOGGING',
        estimatedMinutesLost: estimatedMinutes
      },
      (response) => {
        if (response.success) {
          currentState = response.state;
          updateWidget();
        }
      }
    );
  }
}

/**
 * Toggle collapsed state
 */
function toggleCollapsed() {
  chrome.runtime.sendMessage(
    { type: 'TOGGLE_COLLAPSED' },
    (response) => {
      if (response.success) {
        currentState = response.state;
        createWidget(); // Recreate to change layout
      }
    }
  );
}

/**
 * Update widget display (called when state changes)
 * If in collapsed mode, just update the dot color
 * If in full mode, update buttons and stats
 */
function updateWidget() {
  if (!widgetContainer) return;

  if (currentState.isCollapsed) {
    const dot = widgetContainer.querySelector('.pill-dot');
    if (dot) {
      dot.style.backgroundColor = getColorValue(currentState.activeColor);
    }
  } else {
    // Update active button
    const buttons = widgetContainer.querySelectorAll('.color-btn');
    buttons.forEach((btn) => {
      btn.classList.remove('active');
    });
    const activeBtn = widgetContainer.querySelector(
      `.color-btn[data-color="${currentState.activeColor}"]`
    );
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Update stat bar
    const segments = widgetContainer.querySelectorAll('.stat-segment');
    if (segments.length === 4) {
      segments[0].style.width = getTodayPercentage('green') + '%';
      segments[1].style.width = getTodayPercentage('blue') + '%';
      segments[2].style.width = getTodayPercentage('orange') + '%';
      segments[3].style.width = getTodayPercentage('red') + '%';
    }

    // Update stat labels
    const labels = widgetContainer.querySelectorAll('.stat-label');
    if (labels.length === 4) {
      labels[0].textContent = 'G: ' + formatTime(currentState.todaysSessions.green);
      labels[1].textContent = 'B: ' + formatTime(currentState.todaysSessions.blue);
      labels[2].textContent = 'O: ' + formatTime(currentState.todaysSessions.orange);
      labels[3].textContent = 'R: ' + formatTime(currentState.todaysSessions.red);
    }
  }
}

/**
 * Setup listeners for state updates from background worker
 * - chrome.runtime.onMessage for direct messages
 * - chrome.storage.onChanged for storage updates
 */
function setupStateListeners() {
  // Listen for state broadcasts from background worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATE_UPDATE') {
      currentState = message.payload;
      updateWidget();
    }
  });

  // Also listen to storage changes (redundant but adds robustness)
  // This is important if multiple tabs update state simultaneously
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      // Fetch fresh state from background worker
      chrome.runtime.sendMessage(
        { type: 'GET_STATE' },
        (response) => {
          if (response.success) {
            currentState = response.state;
            updateWidget();
          }
        }
      );
    }
  });
}

/**
 * Utility: Get hex color for a color name
 */
function getColorValue(colorName) {
  const colors = {
    green: '#10b981',
    blue: '#3b82f6',
    orange: '#f97316',
    red: '#ef4444'
  };
  return colors[colorName] || '#6b7280';
}

/**
 * Utility: Calculate percentage of today's time for a color
 */
function getTodayPercentage(color) {
  const total = Object.values(currentState.todaysSessions).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return Math.round((currentState.todaysSessions[color] / total) * 100);
}

/**
 * Utility: Format seconds to "Xh Ym" or "Xm Ys"
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Initialize on DOM ready
 * Run as early as possible, even if DOM isn't fully loaded
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
  initializeWidget();
}

/**
 * Also reinitialize on page visibility change (user returns to tab)
 * This ensures widget is present even if page navigates
 */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !widgetContainer) {
    initializeWidget();
  }
});
