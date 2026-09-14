/**
 * FocusPulse Toast Notifications
 *
 * Micro-toasts for behavioral nudges and encouragement
 * - Variable interval semi-random notifications during green sessions
 * - Streak warnings, personal-bests, end-of-day summaries
 * - Warm, non-punitive copy
 */

let toastContainer = null;
let greenStreakStartTime = null;
let lastToastTime = 0;
const MIN_TOAST_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum
const MAX_TOAST_INTERVAL = 20 * 60 * 1000; // 20 minutes maximum

/**
 * Initialize toast container
 */
function initializeToastContainer() {
  if (toastContainer) return;

  toastContainer = document.createElement('div');
  toastContainer.id = 'focuspulse-toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483645;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  `;
  document.body.appendChild(toastContainer);
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info', duration = 4000) {
  initializeToastContainer();

  const toast = document.createElement('div');
  toast.className = `focuspulse-toast focuspulse-toast-${type}`;
  toast.textContent = message;

  const colors = {
    success: '#10b981',
    warning: '#f59e0b',
    info: '#3b82f6',
    streak: '#ec4899'
  };

  toast.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    cursor: pointer;
    animation: slideIn 0.3s ease;
    max-width: 320px;
    word-wrap: break-word;
  `;

  toastContainer.appendChild(toast);

  // Add animation
  if (!document.getElementById('focuspulse-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'focuspulse-toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }

      .focuspulse-toast {
        animation: slideOut 0.3s ease forwards;
      }
    `;
    document.head.appendChild(style);
  }

  // Remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);

  // Close on click
  toast.addEventListener('click', () => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  });
}

/**
 * Encouraging messages for green streaks (variable language)
 */
const GREEN_ENCOURAGEMENTS = [
  '🎯 Nice focus session going!',
  '✨ You\'re in the zone!',
  '💪 Keep it up—green time feels good!',
  '🚀 Momentum building!',
  '⚡ This focus streak is paying off!',
  '🌟 You\'re killing it today!',
  '🎪 The flow is real—keep going!',
  '💯 Pure focus. Love to see it!',
  '🔥 On a roll!',
  '🎨 Deep work in progress!',
];

/**
 * Show random encouragement during green sessions
 */
function showGreenEncouragement() {
  const now = Date.now();

  // Only show if enough time has passed since last toast
  if (now - lastToastTime < MIN_TOAST_INTERVAL) {
    return;
  }

  const message = GREEN_ENCOURAGEMENTS[Math.floor(Math.random() * GREEN_ENCOURAGEMENTS.length)];
  showToast(message, 'success');
  lastToastTime = now;
}

/**
 * Schedule random toast during green session
 */
function scheduleGreenToast(currentState) {
  if (currentState.activeColor !== 'green') {
    greenStreakStartTime = null;
    return;
  }

  if (!greenStreakStartTime) {
    greenStreakStartTime = Date.now();
  }

  const elapsedMinutes = Math.floor((Date.now() - greenStreakStartTime) / 60000);

  // Show toast after 5-20 minutes of green, randomly
  if (elapsedMinutes >= 5) {
    const randomChance = Math.random();
    if (randomChance < 0.15) { // 15% chance per check
      showGreenEncouragement();
    }
  }
}

/**
 * Show streak-at-risk warning
 */
function showStreakAtRiskWarning(currentStreak, greenPercentageToday) {
  if (currentStreak <= 0) return;

  const hour = new Date().getHours();
  const isLateInDay = hour >= 19; // After 7 PM

  if (isLateInDay && greenPercentageToday < 0.4) {
    showToast(
      `⚠️ Streak at risk! Need more green today to keep your ${currentStreak}-day streak alive.`,
      'warning',
      6000
    );
  }
}

/**
 * Show personal-best callout
 */
function showPersonalBestCallout(metric, value, type) {
  const messages = {
    longestStreak: `🏆 New personal best! Longest streak: ${value} days!`,
    mostGreenDay: `🌟 Best focus day ever: ${value}% green!`,
    highestScore: `💎 Best productivity score: ${value}!`,
  };

  const message = messages[type] || `🎉 New milestone: ${metric}!`;
  showToast(message, 'streak', 5000);
}

/**
 * Non-punitive message for orange logging
 */
function showOrangeSupport(wastedMinutes, totalMinutes) {
  const supportMessages = [
    `${wastedMinutes + 10}m logged. Hey, it happens—refocus and let's get back to it! 💪`,
    `OK, ${wastedMinutes + 10}m. That's human. Reset and pick green again. You've got this! 🌱`,
    `Distraction noted (${wastedMinutes + 10}m). No judgment—just next time! Let's go. 🚀`,
    `${wastedMinutes + 10}m of drift. It's a learning moment. Ready to go green? 🎯`,
  ];

  const message = supportMessages[Math.floor(Math.random() * supportMessages.length)];
  showToast(message, 'info', 4000);
}

/**
 * Show end-of-day summary
 */
function showEndOfDaySummary(stats) {
  const { efficiency, netScore, currentStreak, totalMinutes, intention } = stats;

  const summaryHTML = `
    <div class="eof-summary">
      <div class="eof-header">Today's Focus Receipt 📋</div>

      ${intention ? `<div class="eof-intention">Goal: "${intention}"</div>` : ''}

      <div class="eof-metrics">
        <div class="eof-metric">
          <span>Efficiency:</span>
          <strong>${efficiency}%</strong>
        </div>
        <div class="eof-metric">
          <span>Score:</span>
          <strong>${Math.round(netScore)}</strong>
        </div>
        <div class="eof-metric">
          <span>Streak:</span>
          <strong>${currentStreak} days</strong>
        </div>
        <div class="eof-metric">
          <span>Total:</span>
          <strong>${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m</strong>
        </div>
      </div>

      <div class="eof-message">
        ${efficiency >= 70 ? '🌟 Excellent focus today!' :
          efficiency >= 50 ? '✨ Good work today!' :
          '🌱 Every day is a chance to improve.'}
      </div>

      <div class="eof-footer">See you tomorrow! 👋</div>
    </div>
  `;

  initializeToastContainer();
  const summary = document.createElement('div');
  summary.className = 'focuspulse-end-of-day-summary';
  summary.innerHTML = summaryHTML;

  const style = document.createElement('style');
  style.textContent = `
    .focuspulse-end-of-day-summary {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483645;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      max-width: 320px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      animation: summarySlideIn 0.4s ease;
      cursor: pointer;
    }

    @keyframes summarySlideIn {
      from {
        transform: translateY(400px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .eof-header {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 12px;
      text-align: center;
    }

    .eof-intention {
      font-size: 13px;
      font-style: italic;
      margin-bottom: 12px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      text-align: center;
    }

    .eof-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }

    .eof-metric {
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    .eof-metric strong {
      font-weight: 700;
    }

    .eof-message {
      text-align: center;
      font-size: 14px;
      margin-bottom: 12px;
      font-weight: 500;
    }

    .eof-footer {
      text-align: center;
      font-size: 12px;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(summary);

  setTimeout(() => {
    summary.style.animation = 'summarySlideIn 0.4s ease reverse';
    setTimeout(() => {
      summary.remove();
    }, 400);
  }, 8000);

  summary.addEventListener('click', () => {
    summary.style.animation = 'summarySlideIn 0.4s ease reverse';
    setTimeout(() => {
      summary.remove();
    }, 400);
  });
}
