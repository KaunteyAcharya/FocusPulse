/**
 * FocusPulse Content Script
 * Renders the floating widget on every tab and syncs with background service worker.
 */

console.log('[FocusPulse] Content script loaded');

let widgetContainer = null;
let currentState = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function initializeWidget() {
  console.log('[FocusPulse] Initializing widget');
  chrome.runtime.sendMessage(
    { type: 'GET_STATE' },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[FocusPulse] Message error:', chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        currentState = response.state;
        createWidget();
        setupStateListeners();
        console.log('[FocusPulse] Widget initialized successfully');
      } else {
        console.error('[FocusPulse] Failed to get state:', response);
      }
    }
  );
}

function createWidget() {
  if (widgetContainer) {
    widgetContainer.remove();
  }

  widgetContainer = document.createElement('div');
  widgetContainer.id = 'focuspulse-widget';
  widgetContainer.classList.add('focuspulse-widget');
  widgetContainer.style.left = currentState.widgetPosition.x + 'px';
  widgetContainer.style.top = currentState.widgetPosition.y + 'px';

  // Restore saved size
  if (currentState.widgetSize) {
    widgetContainer.style.width = currentState.widgetSize.width + 'px';
    widgetContainer.style.height = currentState.widgetSize.height + 'px';
  }

  if (currentState.isCollapsed) {
    widgetContainer.innerHTML = `
      <div class="widget-pill">
        <div class="pill-dot" style="background-color: ${getColorValue(currentState.activeColor)}"></div>
      </div>
    `;
  } else {
    const greenActive = currentState.activeColor === 'green' ? 'active' : '';
    const blueActive = currentState.activeColor === 'blue' ? 'active' : '';
    const orangeActive = currentState.activeColor === 'orange' ? 'active' : '';
    const redActive = currentState.activeColor === 'red' ? 'active' : '';

    widgetContainer.innerHTML = `
      <div class="widget-panel">
        <div class="widget-header">
          <span class="widget-title"><span style="color: #10b981;">focus</span><span style="color: #ef4444;">pulse</span></span>
          <div class="widget-header-buttons">
            <button class="widget-dashboard-btn" aria-label="Open dashboard" title="Dashboard">📊</button>
            <button class="widget-settings-btn" aria-label="Settings" title="Settings">⚙️</button>
            <button class="widget-collapse-btn" aria-label="Collapse widget">−</button>
          </div>
        </div>
        <div class="widget-buttons">
          <button class="color-btn green-btn ${greenActive}" data-color="green" title="Green: Deep Focus">
            <span class="btn-label" style="color: #10b981;">${formatTime(currentState.todaysSessions.green)}</span>
            <span class="btn-label" style="color: #10b981; font-size: 10px;">focus</span>
          </button>
          <button class="color-btn blue-btn ${blueActive}" data-color="blue" title="Blue: Working + Audio">
            <span class="btn-label" style="color: #3b82f6;">${formatTime(currentState.todaysSessions.blue)}</span>
            <span class="btn-label" style="color: #3b82f6; font-size: 10px;">audio</span>
          </button>
          <button class="color-btn orange-btn ${orangeActive}" data-color="orange" title="Orange: Distracted">
            <span class="btn-label" style="color: #f97316;">${formatTime(currentState.todaysSessions.orange)}</span>
            <span class="btn-label" style="color: #f97316; font-size: 10px;">distracted</span>
          </button>
          <button class="color-btn red-btn ${redActive}" data-color="red" title="Red: Break">
            <span class="btn-label" style="color: #ef4444;">${formatTime(currentState.todaysSessions.red)}</span>
            <span class="btn-label" style="color: #ef4444; font-size: 10px;">break</span>
          </button>
        </div>
        <div class="widget-stats">
          <div class="stat-bar">
            <div class="stat-segment green-seg" style="width: ${getTodayPercentage('green')}%"></div>
            <div class="stat-segment blue-seg" style="width: ${getTodayPercentage('blue')}%"></div>
            <div class="stat-segment orange-seg" style="width: ${getTodayPercentage('orange')}%"></div>
            <div class="stat-segment red-seg" style="width: ${getTodayPercentage('red')}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  document.body.appendChild(widgetContainer);
  attachEventListeners();
  setupResizeObserver();
}

function setupResizeObserver() {
  if (!widgetContainer) return;

  const resizeObserver = new ResizeObserver(() => {
    const width = widgetContainer.offsetWidth;
    const height = widgetContainer.offsetHeight;

    chrome.runtime.sendMessage(
      {
        type: 'SIZE_UPDATE',
        size: { width: width, height: height }
      },
      () => {}
    );
  });

  resizeObserver.observe(widgetContainer);
}

function attachEventListeners() {
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

  const dashboardBtn = widgetContainer.querySelector('.widget-dashboard-btn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDashboard();
    });
  }

  const settingsBtn = widgetContainer.querySelector('.widget-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof showSettings === 'function') {
        showSettings();
      }
    });
  }

  const collapseBtn = widgetContainer.querySelector('.widget-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapsed();
    });
  }

  const pill = widgetContainer.querySelector('.widget-pill');
  if (pill) {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapsed();
    });
  }

  const dragHandle = widgetContainer.querySelector('.widget-header') || widgetContainer.querySelector('.widget-pill');
  if (dragHandle) {
    dragHandle.addEventListener('mousedown', startDrag);
  }
}

function startDrag(e) {
  e.preventDefault();
  isDragging = true;
  const rect = widgetContainer.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', stopDrag);
}

function onDragMove(e) {
  if (!isDragging) return;
  const x = Math.max(0, e.clientX - dragOffset.x);
  const y = Math.max(0, e.clientY - dragOffset.y);
  widgetContainer.style.left = x + 'px';
  widgetContainer.style.top = y + 'px';
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', stopDrag);
  const rect = widgetContainer.getBoundingClientRect();
  chrome.runtime.sendMessage(
    { type: 'POSITION_UPDATE', position: { x: rect.left, y: rect.top } },
    () => {}
  );
}

function switchColor(color) {
  chrome.runtime.sendMessage(
    { type: 'COLOR_SWITCH', color: color },
    (response) => {
      if (response && response.success) {
        currentState = response.state;
        updateWidget();

        // Show toast feedback
        if (typeof showToast === 'function') {
          if (color === 'green') {
            showToast('🎯 Go get em!', 'success', 2000);
          } else if (color === 'blue') {
            showToast('🎵 Good work with focus!', 'success', 2000);
          } else if (color === 'red') {
            showToast('Take care of yourself 💚', 'info', 2000);
          }
        }
      }
    }
  );
}

function promptOrangeLogging() {
  const minutes = prompt(
    'How many minutes do you think you wasted?\n\n(We will add a 10-minute penalty on top)',
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
        if (response && response.success) {
          currentState = response.state;
          updateWidget();

          // Show supportive message
          if (typeof showOrangeSupport === 'function') {
            showOrangeSupport(estimatedMinutes, estimatedMinutes + 10);
          }
        }
      }
    );
  }
}

function toggleCollapsed() {
  chrome.runtime.sendMessage(
    { type: 'TOGGLE_COLLAPSED' },
    (response) => {
      if (response && response.success) {
        currentState = response.state;
        createWidget();
      }
    }
  );
}

function updateWidget() {
  if (!widgetContainer) return;

  if (currentState.isCollapsed) {
    const dot = widgetContainer.querySelector('.pill-dot');
    if (dot) {
      dot.style.backgroundColor = getColorValue(currentState.activeColor);
    }
  } else {
    const buttons = widgetContainer.querySelectorAll('.color-btn');
    buttons.forEach((btn) => {
      btn.classList.remove('active');
      if (btn.dataset.color === currentState.activeColor) {
        btn.classList.add('active');
      }
    });

    const segments = widgetContainer.querySelectorAll('.stat-segment');
    if (segments.length === 4) {
      segments[0].style.width = getTodayPercentage('green') + '%';
      segments[1].style.width = getTodayPercentage('blue') + '%';
      segments[2].style.width = getTodayPercentage('orange') + '%';
      segments[3].style.width = getTodayPercentage('red') + '%';
    }

    const labels = widgetContainer.querySelectorAll('.stat-label');
    if (labels.length === 4) {
      labels[0].textContent = 'G: ' + formatTime(currentState.todaysSessions.green);
      labels[1].textContent = 'B: ' + formatTime(currentState.todaysSessions.blue);
      labels[2].textContent = 'O: ' + formatTime(currentState.todaysSessions.orange);
      labels[3].textContent = 'R: ' + formatTime(currentState.todaysSessions.red);
    }
  }
}

function setupStateListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATE_UPDATE') {
      currentState = message.payload;
      updateWidget();

      // Show encouragement if on green
      if (typeof scheduleGreenToast === 'function') {
        scheduleGreenToast(currentState);
      }
    } else if (message.type === 'KEYBOARD_ORANGE_PROMPT') {
      promptOrangeLogging();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      chrome.runtime.sendMessage(
        { type: 'GET_STATE' },
        (response) => {
          if (response && response.success) {
            currentState = response.state;
            updateWidget();
          }
        }
      );
    }
  });
}

function getColorValue(colorName) {
  const colors = {
    green: '#10b981',
    blue: '#3b82f6',
    orange: '#f97316',
    red: '#ef4444'
  };
  return colors[colorName] || '#6b7280';
}

function getTodayPercentage(color) {
  const total = Object.values(currentState.todaysSessions).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return Math.round((currentState.todaysSessions[color] / total) * 100);
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return hours + 'h ' + minutes + 'm';
  } else if (minutes > 0) {
    return minutes + 'm';
  } else {
    return secs + 's';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
  initializeWidget();
}

// Initialize idle detection
if (typeof initializeIdleDetection === 'function') {
  initializeIdleDetection();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !widgetContainer) {
    initializeWidget();
  }
});
