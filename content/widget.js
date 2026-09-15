/**
 * FocusPulse Content Script
 * Renders the floating widget on every tab and syncs with background service worker.
 */

console.log('[FocusPulse] Content script loaded');

let widgetContainer = null;
let currentState = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let liveTimer = null;

/* ============================================================================
   INLINE SVG ICONS (Feather-style, stroke uses currentColor)
   ============================================================================ */
const ICONS = {
  refresh: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.64-6.36"/><polyline points="3 3 3 9 9 9"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`
};

/* Tag definitions: single source of truth for order, colors and labels */
const TAGS = [
  { key: 'green', label: 'Flow', color: '#10b981', desc: 'Deep focus' },
  { key: 'orange', label: 'Noise', color: '#f97316', desc: 'Working + audio' },
  { key: 'red', label: 'Lost', color: '#ef4444', desc: 'Distraction' },
  { key: 'blue', label: 'Rest', color: '#3b82f6', desc: 'Intentional break' }
];

function formatTimeOfDay(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
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

/**
 * Returns per-color seconds INCLUDING the currently running session,
 * so refreshes and the live ticker show up-to-the-second totals.
 */
function getLiveSessions() {
  const s = {
    green: currentState.todaysSessions.green || 0,
    orange: currentState.todaysSessions.orange || 0,
    red: currentState.todaysSessions.red || 0,
    blue: currentState.todaysSessions.blue || 0
  };
  if (
    currentState.activeColor &&
    currentState.sessionStartTime &&
    !currentState.dayEndTime &&
    s[currentState.activeColor] !== undefined
  ) {
    s[currentState.activeColor] += Math.floor((Date.now() - currentState.sessionStartTime) / 1000);
  }
  return s;
}

function getMotivationalMessage(state) {
  if (!state) return 'Ready when you are.';

  const currentStreak = state.streakData ? state.streakData.currentStreak || 0 : 0;
  if (currentStreak >= 3) {
    return `${currentStreak} days honest in a row. Hold the line.`;
  }

  const messages = {
    green: [
      'Locked in. Ride it while it lasts.',
      'This is where progress actually happens.',
      'Deep work, one honest minute at a time.',
      'Guard this hour. It pays you back.'
    ],
    orange: [
      'Half your attention still moves the needle.',
      'Not perfect focus, but still forward.',
      'Turn the volume down when you can.',
      'Keep the momentum, tighten it later.'
    ],
    red: [
      'You noticed. That is the hard part.',
      'No shame here. Start the next minute clean.',
      'Everyone drifts. Coming back is the skill.',
      'Name it, log it, let it go.'
    ],
    blue: [
      'Rest now so focus lands harder later.',
      'A real break beats a fake one at your desk.',
      'Step away fully. You earned it.',
      'Recovery is part of the work.'
    ]
  };

  const list = messages[state.activeColor];
  if (list && list.length) {
    return list[Math.floor(Math.random() * list.length)];
  }
  if (!state.dayStartTime) return 'Press Start when you are ready to begin.';
  if (state.dayEndTime) return 'Day closed. You tracked it honestly.';
  return 'Pick a state to start the clock.';
}

function initializeWidget() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[FocusPulse] Message error:', chrome.runtime.lastError);
      return;
    }
    if (response && response.success) {
      currentState = response.state;
      createWidget();
      setupStateListeners();
      startLiveTimer();
    } else {
      console.error('[FocusPulse] Failed to get state:', response);
    }
  });
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
    document.body.appendChild(widgetContainer);
    attachEventListeners();
    return;
  }

  const live = getLiveSessions();
  const totalTime = live.green + live.orange + live.red + live.blue;

  const tagButtons = TAGS.map((tag) => {
    const active = currentState.activeColor === tag.key ? 'active' : '';
    const pct = totalTime > 0 ? Math.round((live[tag.key] / totalTime) * 100) : 0;
    return `
      <button class="color-btn ${tag.key}-btn ${active}" data-color="${tag.key}" style="--tag:${tag.color}" title="${tag.label}: ${tag.desc}">
        <span class="btn-time" data-color="${tag.key}">${formatTime(live[tag.key])}</span>
        <span class="btn-name">${tag.label}</span>
        <span class="btn-pct" data-color="${tag.key}">${pct}%</span>
      </button>`;
  }).join('');

  const statSegments = TAGS.map((tag) => {
    const pct = totalTime > 0 ? (live[tag.key] / totalTime) * 100 : 0;
    return `<div class="stat-segment" data-color="${tag.key}" style="width:${pct}%;background:${tag.color}"></div>`;
  }).join('');

  widgetContainer.innerHTML = `
    <div class="widget-panel">
      <div class="widget-header">
        <div class="widget-brand">
          <button class="widget-title" title="About FocusPulse">FocusPulse</button>
          <span class="widget-tagline">No lies. You are doing this for you.</span>
        </div>
        <div class="widget-header-buttons">
          <button class="icon-btn widget-refresh-btn" aria-label="Refresh" title="Refresh">${ICONS.refresh}</button>
          <button class="icon-btn widget-dashboard-btn" aria-label="Open dashboard" title="Stats">${ICONS.chart}</button>
          <button class="icon-btn widget-settings-btn" aria-label="Settings" title="Settings">${ICONS.settings}</button>
          <button class="icon-btn widget-collapse-btn" aria-label="Collapse">${ICONS.minus}</button>
        </div>
      </div>

      <div class="widget-session-controls">
        <button class="session-btn ${currentState.dayStartTime ? 'active' : ''}" data-action="day-start" title="Mark the start of your day">
          <span class="session-label">Start</span>
          <span class="session-time">${currentState.dayStartTime ? formatTimeOfDay(new Date(currentState.dayStartTime)) : '·'}</span>
        </button>
        <div class="session-total">
          <span class="total-label">Total</span>
          <span class="total-time">${formatTime(totalTime)}</span>
        </div>
        <button class="session-btn ${currentState.dayEndTime ? 'active' : ''}" data-action="day-end" title="Mark the end of your day">
          <span class="session-label">End</span>
          <span class="session-time">${currentState.dayEndTime ? formatTimeOfDay(new Date(currentState.dayEndTime)) : '·'}</span>
        </button>
      </div>

      <div class="widget-buttons">${tagButtons}</div>

      <div class="widget-stats">
        <div class="stat-bar">${statSegments}</div>
      </div>

      <div class="widget-footer">
        <span class="footer-message">${getMotivationalMessage(currentState)}</span>
        <button class="reset-btn" title="Reset today's timers">${ICONS.reset}<span>Reset</span></button>
      </div>
    </div>
  `;

  document.body.appendChild(widgetContainer);
  attachEventListeners();
  setupResizeObserver();
}

function setupResizeObserver() {
  if (!widgetContainer) return;
  const resizeObserver = new ResizeObserver(() => {
    const width = widgetContainer.offsetWidth;
    const height = widgetContainer.offsetHeight;
    chrome.runtime.sendMessage({ type: 'SIZE_UPDATE', size: { width, height } }, () => {});
  });
  resizeObserver.observe(widgetContainer);
}

/**
 * Lightweight per-second refresh of just the numeric displays,
 * so the active tag and total tick up without a full re-render.
 */
function startLiveTimer() {
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = setInterval(() => {
    if (!widgetContainer || !currentState || currentState.isCollapsed || isDragging) return;
    if (!currentState.activeColor || !currentState.sessionStartTime || currentState.dayEndTime) return;
    refreshLiveTimes();
  }, 1000);
}

function refreshLiveTimes() {
  const live = getLiveSessions();
  const total = live.green + live.orange + live.red + live.blue;

  TAGS.forEach((tag) => {
    const timeEl = widgetContainer.querySelector(`.btn-time[data-color="${tag.key}"]`);
    if (timeEl) timeEl.textContent = formatTime(live[tag.key]);
    const pctEl = widgetContainer.querySelector(`.btn-pct[data-color="${tag.key}"]`);
    if (pctEl) pctEl.textContent = (total > 0 ? Math.round((live[tag.key] / total) * 100) : 0) + '%';
    const seg = widgetContainer.querySelector(`.stat-segment[data-color="${tag.key}"]`);
    if (seg) seg.style.width = (total > 0 ? (live[tag.key] / total) * 100 : 0) + '%';
  });

  const totalEl = widgetContainer.querySelector('.total-time');
  if (totalEl) totalEl.textContent = formatTime(total);
}

function attachEventListeners() {
  // Session start / end
  widgetContainer.querySelectorAll('.session-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const type = action === 'day-start' ? 'DAY_START' : 'DAY_END';
      chrome.runtime.sendMessage({ type }, (response) => {
        if (response && response.success) {
          currentState = response.state;
          createWidget();
          if (typeof showToast === 'function') {
            showToast(action === 'day-start' ? 'Day started' : 'Day ended', 'success', 1500);
          }
        }
      });
    });
  });

  // Tag buttons
  widgetContainer.querySelectorAll('.color-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = btn.dataset.color;
      if (color === 'red') {
        promptRedLogging();
      } else {
        switchColor(color);
      }
    });
  });

  // Header icon buttons
  const refreshBtn = widgetContainer.querySelector('.widget-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const svg = refreshBtn.querySelector('svg');
      if (svg) { svg.style.transition = 'transform 0.5s ease'; svg.style.transform = 'rotate(360deg)'; }
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        if (response && response.success) {
          currentState = response.state;
          createWidget();
          if (typeof showToast === 'function') showToast('Updated', 'success', 1200);
        }
      });
    });
  }

  const titleBtn = widgetContainer.querySelector('.widget-title');
  if (titleBtn) {
    titleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof showAbout === 'function') showAbout();
    });
  }

  const dashboardBtn = widgetContainer.querySelector('.widget-dashboard-btn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof showDashboard === 'function') showDashboard();
    });
  }

  const settingsBtn = widgetContainer.querySelector('.widget-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof showSettings === 'function') showSettings();
    });
  }

  const collapseBtn = widgetContainer.querySelector('.widget-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapsed();
    });
  }

  // Reset
  const resetBtn = widgetContainer.querySelector('.reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = confirm('Reset today’s timers?\n\nThis clears Start/End and all tag times for today. Your history is kept.');
      if (!ok) return;
      chrome.runtime.sendMessage({ type: 'RESET_TIMERS' }, (response) => {
        if (response && response.success) {
          currentState = response.state;
          createWidget();
          if (typeof showToast === 'function') showToast('Timers reset', 'info', 1500);
        }
      });
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
  // Don't start dragging when a control was pressed
  if (e.target.closest('button')) return;
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
  chrome.runtime.sendMessage({ type: 'POSITION_UPDATE', position: { x: rect.left, y: rect.top } }, () => {});
}

function switchColor(color) {
  chrome.runtime.sendMessage({ type: 'COLOR_SWITCH', color: color }, (response) => {
    if (response && response.success) {
      currentState = response.state;
      createWidget();
      if (typeof showToast === 'function') {
        if (color === 'green') showToast('Flow on. Guard the next 25 minutes.', 'success', 1900);
        else if (color === 'orange') showToast('Noise logged. Still moving forward.', 'info', 1800);
        else if (color === 'blue') showToast('Rest logged. Come back sharper.', 'success', 1800);
      }
    }
  });
}

function promptRedLogging() {
  const minutes = prompt('How many minutes were you lost?\n\n(We add a 10-minute penalty on top)', '5');
  if (minutes !== null) {
    const estimatedMinutes = Math.max(0, parseInt(minutes) || 0);
    chrome.runtime.sendMessage({ type: 'RED_LOGGING', estimatedMinutesLost: estimatedMinutes }, (response) => {
      if (response && response.success) {
        currentState = response.state;
        createWidget();
        if (typeof showRedSupport === 'function') {
          showRedSupport(estimatedMinutes, estimatedMinutes + 10);
        }
      }
    });
  }
}

function toggleCollapsed() {
  chrome.runtime.sendMessage({ type: 'TOGGLE_COLLAPSED' }, (response) => {
    if (response && response.success) {
      currentState = response.state;
      createWidget();
    }
  });
}

function setupStateListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATE') {
      currentState = message.payload;
      createWidget();
      if (typeof scheduleGreenToast === 'function') scheduleGreenToast(currentState);
    } else if (message.type === 'KEYBOARD_RED_PROMPT') {
      promptRedLogging();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        if (response && response.success) {
          currentState = response.state;
          createWidget();
        }
      });
    }
  });
}

function getColorValue(colorName) {
  const tag = TAGS.find((t) => t.key === colorName);
  return tag ? tag.color : '#9ca3af';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
  initializeWidget();
}

if (typeof initializeIdleDetection === 'function') {
  initializeIdleDetection();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !widgetContainer) {
    initializeWidget();
  }
});
