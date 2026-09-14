/**
 * FocusPulse Dashboard
 *
 * In-page overlay showing analytics for different time periods.
 * Embedded in content script and triggered by widget interaction.
 */

let dashboardOverlay = null;
let currentDashboardTab = 'today';

/**
 * Create and show the dashboard overlay
 */
function showDashboard() {
  if (dashboardOverlay) {
    dashboardOverlay.style.display = 'flex';
    loadDashboardData('today');
    return;
  }

  dashboardOverlay = document.createElement('div');
  dashboardOverlay.id = 'focuspulse-dashboard-overlay';
  dashboardOverlay.innerHTML = `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h2>Analytics Dashboard</h2>
        <button class="dashboard-close-btn" aria-label="Close dashboard">&times;</button>
      </div>

      <div class="dashboard-tabs">
        <button class="dashboard-tab active" data-tab="today">Today</button>
        <button class="dashboard-tab" data-tab="thisWeek">This Week</button>
        <button class="dashboard-tab" data-tab="thisMonth">This Month</button>
        <button class="dashboard-tab" data-tab="thisYear">This Year</button>
        <button class="dashboard-tab" data-tab="allTime">All Time</button>
      </div>

      <div class="dashboard-content">
        <div class="dashboard-metrics">
          <div class="metric-card">
            <h3>Time Breakdown</h3>
            <div class="chart-placeholder">
              <canvas id="breakdown-chart"></canvas>
            </div>
          </div>

          <div class="metric-card">
            <h3>Key Metrics</h3>
            <div class="metrics-grid">
              <div class="metric-item">
                <span class="metric-label">Efficiency</span>
                <span class="metric-value" id="efficiency-value">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Productivity Score</span>
                <span class="metric-value" id="score-value">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Trend</span>
                <span class="metric-value" id="trend-value">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Current Streak</span>
                <span class="metric-value" id="streak-value">-</span>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-timeline">
          <h3>Day Timeline</h3>
          <div id="timeline-container"></div>
        </div>
      </div>
    </div>
  `;

  // Add CSS
  const style = document.createElement('style');
  style.textContent = getDashboardCSS();
  dashboardOverlay.appendChild(style);

  document.body.appendChild(dashboardOverlay);

  // Attach event listeners
  const closeBtn = dashboardOverlay.querySelector('.dashboard-close-btn');
  closeBtn.addEventListener('click', hideDashboard);

  const tabs = dashboardOverlay.querySelectorAll('.dashboard-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchDashboardTab(tabName);
    });
  });

  // Close on background click
  dashboardOverlay.addEventListener('click', (e) => {
    if (e.target === dashboardOverlay) {
      hideDashboard();
    }
  });

  loadDashboardData('today');
}

/**
 * Hide the dashboard overlay
 */
function hideDashboard() {
  if (dashboardOverlay) {
    dashboardOverlay.style.display = 'none';
  }
}

/**
 * Switch dashboard tab
 */
function switchDashboardTab(tabName) {
  currentDashboardTab = tabName;

  const tabs = dashboardOverlay.querySelectorAll('.dashboard-tab');
  tabs.forEach((tab) => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  loadDashboardData(tabName);
}

/**
 * Load data for a specific period and update dashboard
 */
function loadDashboardData(period) {
  chrome.runtime.sendMessage(
    {
      type: 'GET_ANALYTICS',
      period: period
    },
    (response) => {
      if (response && response.success) {
        updateDashboardDisplay(response.analytics);
      }
    }
  );
}

/**
 * Update dashboard display with analytics data
 */
function updateDashboardDisplay(analytics) {
  const { totals, efficiency, netScore, trend, dayBreakdown, currentStreak } = analytics;

  // Update efficiency
  const efficiencyEl = dashboardOverlay.querySelector('#efficiency-value');
  efficiencyEl.textContent = efficiency + '%';

  // Update score
  const scoreEl = dashboardOverlay.querySelector('#score-value');
  scoreEl.textContent = Math.round(netScore);

  // Update trend
  const trendEl = dashboardOverlay.querySelector('#trend-value');
  const trendText = trend ?
    (trend.direction === 'up' ? '↑ ' + trend.percentage + '%' :
     trend.direction === 'down' ? '↓ ' + trend.percentage + '%' :
     '→ 0%') : 'N/A';
  trendEl.textContent = trendText;

  // Update streak
  const streakEl = dashboardOverlay.querySelector('#streak-value');
  streakEl.textContent = currentStreak + ' days';

  // Draw chart
  drawBreakdownChart(totals);

  // Draw timeline
  drawTimeline(dayBreakdown);
}

/**
 * Draw breakdown chart (using canvas)
 */
function drawBreakdownChart(totals) {
  const canvas = dashboardOverlay.querySelector('#breakdown-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = 300;
  canvas.height = 200;

  const total = totals.green + totals.blue + totals.orange + totals.red;
  if (total === 0) {
    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    ctx.fillText('No data for this period', 80, 100);
    return;
  }

  const colors = ['#10b981', '#3b82f6', '#f97316', '#ef4444'];
  const labels = ['Focus', 'Audio', 'Distracted', 'Break'];
  const values = [totals.green, totals.blue, totals.orange, totals.red];

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 60;

  let currentAngle = 0;

  values.forEach((value, index) => {
    const sliceAngle = (value / total) * 2 * Math.PI;

    ctx.fillStyle = colors[index];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    // Draw label
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
    const labelY = centerY + Math.sin(labelAngle) * (radius + 20);

    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[index], labelX, labelY);

    currentAngle += sliceAngle;
  });
}

/**
 * Draw timeline visualization for days
 */
function drawTimeline(dayBreakdown) {
  const container = dashboardOverlay.querySelector('#timeline-container');
  if (!container) return;

  container.innerHTML = '';

  dayBreakdown.slice(-7).forEach((day) => {
    const dayEl = document.createElement('div');
    dayEl.className = 'timeline-day';

    const total = day.totals.green + day.totals.blue + day.totals.orange + day.totals.red;
    const dateStr = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    dayEl.innerHTML = `
      <div class="timeline-date">${dateStr}</div>
      <div class="timeline-bar">
        <div class="timeline-segment" style="width: ${(day.totals.green / total) * 100}%; background: #10b981;"></div>
        <div class="timeline-segment" style="width: ${(day.totals.blue / total) * 100}%; background: #3b82f6;"></div>
        <div class="timeline-segment" style="width: ${(day.totals.orange / total) * 100}%; background: #f97316;"></div>
        <div class="timeline-segment" style="width: ${(day.totals.red / total) * 100}%; background: #ef4444;"></div>
      </div>
      <div class="timeline-label">${formatMinutes(total / 60)}</div>
    `;

    container.appendChild(dayEl);
  });
}

/**
 * Format seconds to minutes display
 */
function formatMinutes(minutes) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours + 'h ' + mins + 'm';
  }
  return Math.floor(minutes) + 'm';
}

/**
 * Get dashboard CSS
 */
function getDashboardCSS() {
  return `
    #focuspulse-dashboard-overlay {
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

    .dashboard-container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 90%;
      max-width: 900px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .dashboard-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #1f2937;
    }

    .dashboard-close-btn {
      background: none;
      border: none;
      font-size: 32px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dashboard-close-btn:hover {
      color: #1f2937;
    }

    .dashboard-tabs {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      border-bottom: 1px solid #e5e7eb;
      overflow-x: auto;
    }

    .dashboard-tab {
      padding: 8px 16px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 14px;
      color: #6b7280;
      border-bottom: 3px solid transparent;
      transition: all 0.2s ease;
    }

    .dashboard-tab:hover {
      color: #1f2937;
    }

    .dashboard-tab.active {
      color: #10b981;
      border-bottom-color: #10b981;
    }

    .dashboard-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .dashboard-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .metric-card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
    }

    .metric-card h3 {
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }

    .chart-placeholder {
      width: 100%;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .metric-label {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }

    .metric-value {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      transition: all 0.3s ease;
    }

    .metric-value.animating {
      animation: metricPulse 0.6s ease;
    }

    @keyframes metricPulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.8;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .dashboard-timeline h3 {
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }

    .timeline-day {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .timeline-date {
      width: 70px;
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }

    .timeline-bar {
      flex: 1;
      height: 24px;
      display: flex;
      border-radius: 4px;
      overflow: hidden;
      background: #e5e7eb;
    }

    .timeline-segment {
      height: 100%;
      transition: width 0.3s ease;
    }

    .timeline-label {
      width: 50px;
      text-align: right;
      font-size: 12px;
      color: #6b7280;
    }

    @media (max-width: 768px) {
      .dashboard-metrics {
        grid-template-columns: 1fr;
      }
      .dashboard-container {
        width: 95%;
        max-height: 90vh;
      }
    }
  `;
}
