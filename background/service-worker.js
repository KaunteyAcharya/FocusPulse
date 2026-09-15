/**
 * FocusPulse Background Service Worker
 *
 * Single source of truth for:
 * - Current active color state
 * - Current session start timestamp
 * - Today's accumulated seconds per color
 * - Widget position and collapsed state
 *
 * All state persists to chrome.storage.local on every change.
 */

// Import analytics utilities
importScripts('analytics.js');

const DEFAULT_STATE = {
  // Current state
  activeColor: null, // null = nothing active/paused, else 'green' | 'blue' | 'orange' | 'red'
  sessionStartTime: null,
  widgetPosition: { x: 20, y: 20 },
  widgetSize: { width: 280, height: 'auto' },
  isCollapsed: false,

  // Session timing (for total time since day started)
  dayStartTime: null,
  dayEndTime: null,

  // Today's accumulated time (in seconds)
  todaysSessions: {
    green: 0,
    blue: 0,
    orange: 0,
    red: 0
  },

  // Today's date (to reset on new day)
  lastSessionDate: new Date().toDateString(),

  // Full session history (for analytics in later phases)
  sessionHistory: []
};

let currentState = { ...DEFAULT_STATE };
let stateInitialized = false;

/**
 * Initialize state from chrome.storage.local on service worker startup
 */
async function initializeState() {
  if (stateInitialized) return;

  const stored = await chrome.storage.local.get(null);

  if (Object.keys(stored).length > 0) {
    currentState = { ...DEFAULT_STATE, ...stored };
  } else {
    currentState = { ...DEFAULT_STATE };
    await saveState();
  }

  // Check if it's a new day; if so, reset today's sessions but keep history
  const today = new Date().toDateString();
  if (currentState.lastSessionDate !== today) {
    currentState.lastSessionDate = today;
    currentState.todaysSessions = {
      green: 0,
      blue: 0,
      orange: 0,
      red: 0
    };
    currentState.activeColor = null;
    currentState.sessionStartTime = null;
    currentState.dayStartTime = null;
    currentState.dayEndTime = null;
  }

  stateInitialized = true;
}

/**
 * Persist current state to chrome.storage.local
 */
async function saveState() {
  await chrome.storage.local.set({
    activeColor: currentState.activeColor,
    sessionStartTime: currentState.sessionStartTime,
    widgetPosition: currentState.widgetPosition,
    widgetSize: currentState.widgetSize,
    isCollapsed: currentState.isCollapsed,
    dayStartTime: currentState.dayStartTime,
    dayEndTime: currentState.dayEndTime,
    todaysSessions: currentState.todaysSessions,
    lastSessionDate: currentState.lastSessionDate,
    sessionHistory: currentState.sessionHistory
  });
}

/**
 * Handle color switch from content script
 * End previous session, add time to previous color, start new session
 */
async function handleColorSwitch(newColor) {
  await initializeState();

  const now = Date.now();

  // If there was a previous session, log its time
  if (currentState.sessionStartTime !== null && currentState.activeColor) {
    const elapsedSeconds = Math.floor(
      (now - currentState.sessionStartTime) / 1000
    );
    currentState.todaysSessions[currentState.activeColor] += elapsedSeconds;

    // Log to session history
    currentState.sessionHistory.push({
      color: currentState.activeColor,
      startTime: currentState.sessionStartTime,
      endTime: now,
      durationSeconds: elapsedSeconds,
      date: new Date().toDateString()
    });
  }

  // Auto-mark day start on first activity if not set
  if (!currentState.dayStartTime) {
    currentState.dayStartTime = now;
    currentState.dayEndTime = null;
  }

  // Switch to new color and start new session
  currentState.activeColor = newColor;
  currentState.sessionStartTime = now;

  await saveState();
  broadcastStateToAllTabs();
}

/**
 * Reset today's timers (keeps history intact)
 */
async function handleResetTimers() {
  await initializeState();
  currentState.todaysSessions = { green: 0, blue: 0, orange: 0, red: 0 };
  currentState.activeColor = null;
  currentState.sessionStartTime = null;
  currentState.dayStartTime = null;
  currentState.dayEndTime = null;
  await saveState();
  broadcastStateToAllTabs();
}

/**
 * Handle red logging with penalty
 * User estimates minutes lost, we add 10-minute penalty
 */
async function handleRedLogging(estimatedMinutesLost) {
  await initializeState();

  const totalMinutes = estimatedMinutesLost + 10; // Add 10-minute penalty
  const totalSeconds = totalMinutes * 60;

  currentState.todaysSessions.red += totalSeconds;

  // Log to session history
  const now = Date.now();
  currentState.sessionHistory.push({
    color: 'red',
    startTime: now - totalSeconds * 1000,
    endTime: now,
    durationSeconds: totalSeconds,
    estimatedWastedMinutes: estimatedMinutesLost,
    penaltyMinutes: 10,
    date: new Date().toDateString()
  });

  // If red was active, end that session and switch to blue
  if (currentState.activeColor === 'red') {
    currentState.activeColor = 'blue';
    currentState.sessionStartTime = now;
  }

  await saveState();
  broadcastStateToAllTabs();
}

/**
 * Update widget position (called when user drags widget)
 */
async function handlePositionUpdate(position) {
  await initializeState();
  currentState.widgetPosition = position;
  await saveState();
  broadcastStateToAllTabs();
}

/**
 * Update widget size (called when user resizes widget)
 */
async function handleSizeUpdate(size) {
  await initializeState();
  currentState.widgetSize = size;
  await saveState();
}

/**
 * Toggle collapsed state
 */
async function handleToggleCollapsed() {
  await initializeState();
  currentState.isCollapsed = !currentState.isCollapsed;
  await saveState();
  broadcastStateToAllTabs();
}

/**
 * Broadcast current state to all content scripts
 * This ensures widget stays in sync across tabs
 */
async function broadcastStateToAllTabs() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    chrome.tabs.sendMessage(
      tab.id,
      {
        type: 'STATE_UPDATE',
        payload: currentState
      }
    ).catch(() => {
      // Tab may not have content script loaded, ignore error
    });
  });
}

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await initializeState();

    try {
      switch (message.type) {
        case 'COLOR_SWITCH':
          await handleColorSwitch(message.color);
          sendResponse({ success: true, state: currentState });
          break;

        case 'RED_LOGGING':
          await handleRedLogging(message.estimatedMinutesLost);
          sendResponse({ success: true, state: currentState });
          break;

        case 'POSITION_UPDATE':
          await handlePositionUpdate(message.position);
          sendResponse({ success: true });
          break;

        case 'SIZE_UPDATE':
          await handleSizeUpdate(message.size);
          sendResponse({ success: true });
          break;

        case 'TOGGLE_COLLAPSED':
          await handleToggleCollapsed();
          sendResponse({ success: true, state: currentState });
          break;

        case 'DAY_START':
          currentState.dayStartTime = Date.now();
          currentState.dayEndTime = null;
          await saveState();
          broadcastStateToAllTabs();
          sendResponse({ success: true, state: currentState });
          break;

        case 'DAY_END': {
          const now = Date.now();
          currentState.dayEndTime = now;
          // End the current session by committing its running time
          if (currentState.sessionStartTime !== null && currentState.activeColor) {
            const elapsedSeconds = Math.floor((now - currentState.sessionStartTime) / 1000);
            currentState.todaysSessions[currentState.activeColor] += elapsedSeconds;
            currentState.sessionHistory.push({
              color: currentState.activeColor,
              startTime: currentState.sessionStartTime,
              endTime: now,
              durationSeconds: elapsedSeconds,
              date: new Date().toDateString()
            });
          }
          // Unmark everything so nothing stays active or highlighted after ending the day
          currentState.activeColor = null;
          currentState.sessionStartTime = null;
          await saveState();
          broadcastStateToAllTabs();
          sendResponse({ success: true, state: currentState });
          break;
        }

        case 'RESET_TIMERS':
          await handleResetTimers();
          sendResponse({ success: true, state: currentState });
          break;

        case 'GET_STATE':
          sendResponse({ success: true, state: currentState });
          break;

        case 'GET_ANALYTICS':
          const analytics = getAnalyticsForPeriod(currentState.sessionHistory, message.period);
          const { currentStreak } = calculateStreaks(currentState.sessionHistory);
          sendResponse({
            success: true,
            analytics: {
              ...analytics,
              currentStreak: currentStreak
            }
          });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate we'll send response asynchronously
  return true;
});

/**
 * Listen for keyboard commands
 */
chrome.commands.onCommand.addListener((command) => {
  console.log('[FocusPulse] Keyboard command:', command);

  const colorMap = {
    'focus-green': 'green',
    'focus-audio': 'orange',
    'focus-distracted': 'red',
    'focus-break': 'blue'
  };

  const color = colorMap[command];
  if (color) {
    (async () => {
      try {
        await initializeState();
        console.log('[FocusPulse] Processing keyboard command for:', color);

        if (color === 'red') {
          // For red, send a message to all tabs to prompt
          const tabs = await chrome.tabs.query({});
          console.log('[FocusPulse] Sending red prompt to', tabs.length, 'tabs');
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(
              tab.id,
              { type: 'KEYBOARD_RED_PROMPT' }
            ).catch(() => {});
          });
        } else {
          // For other colors, just switch
          await handleColorSwitch(color);
          console.log('[FocusPulse] Color switched to:', color);
        }
      } catch (error) {
        console.error('[FocusPulse] Command error:', error);
      }
    })();
  }
});

/**
 * Initialize on service worker startup
 */
initializeState();
