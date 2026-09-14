/**
 * FocusPulse Idle Detection
 *
 * Gentle suggestion to mark time as "break" if browser has been idle
 * Uses mouse/keyboard activity to detect idleness
 * Suggestion only - never automatic
 */

let lastActivityTime = Date.now();
let idleTimeout = null;
let isIdle = false;

/**
 * Initialize idle detection
 */
function initializeIdleDetection() {
  // Track activity
  document.addEventListener('mousemove', updateActivity);
  document.addEventListener('mousedown', updateActivity);
  document.addEventListener('keypress', updateActivity);
  document.addEventListener('scroll', updateActivity);
  document.addEventListener('touchstart', updateActivity);

  // Check for idle periodically
  setInterval(checkIdleStatus, 60000); // Check every minute
}

/**
 * Update last activity time
 */
function updateActivity() {
  lastActivityTime = Date.now();
  if (isIdle) {
    isIdle = false;
    clearIdleTimeout();
  }
}

/**
 * Check if user has been idle
 */
async function checkIdleStatus() {
  const settings = await loadSettings();
  if (!settings.enableIdleDetection) return;

  const idleThresholdMs = settings.idleThreshold * 60 * 1000;
  const timeSinceActivity = Date.now() - lastActivityTime;

  if (timeSinceActivity > idleThresholdMs && !isIdle && currentState.activeColor !== 'red') {
    showIdleSuggestion();
    isIdle = true;
  }
}

/**
 * Show idle suggestion toast
 */
function showIdleSuggestion() {
  const idleMinutes = Math.round((Date.now() - lastActivityTime) / 60000);
  const message = `Been idle for ${idleMinutes} minutes. Want to mark this as a break? 💚`;

  if (typeof showToast === 'function') {
    showToast(message, 'info', 8000);
  }
}

/**
 * Clear idle state
 */
function clearIdleTimeout() {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
    idleTimeout = null;
  }
}
