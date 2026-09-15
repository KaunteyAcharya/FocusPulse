/**
 * FocusPulse Dashboard
 * Draggable / resizable analytics overlay with a doughnut breakdown,
 * key metrics, and an interactive stacked daily-activity chart.
 * Light / dark theme, SF Pro type, fully interactive charts.
 */

let dashboardOverlay = null;
let currentDashboardTab = 'today';
let dashboardTheme = 'light';
let lastAnalytics = null;
let dashTransform = { x: 0, y: 0 };
let doughnutGeom = null;
let dayCols = null;

const DASH_TAGS = [
  { key: 'green', label: 'Flow', color: '#10b981' },
  { key: 'orange', label: 'Noise', color: '#f97316' },
  { key: 'red', label: 'Lost', color: '#ef4444' },
  { key: 'blue', label: 'Rest', color: '#3b82f6' }
];

// Concrete font stack for <canvas> (ctx.font cannot resolve CSS variables)
const FP_FONT = "-apple-system, 'SF Pro Display', 'SF Pro Text', BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function themeColors() {
  return dashboardTheme === 'dark'
    ? { text: '#f1f5f9', muted: '#8b95a5', grid: 'rgba(255,255,255,0.09)', ring: '#2a2f3a' }
    : { text: '#0f172a', muted: '#94a3b8', grid: 'rgba(17,24,39,0.08)', ring: '#e5e7eb' };
}

function showDashboard() {
  if (dashboardOverlay) {
    dashboardOverlay.style.display = 'flex';
    switchDashboardTab(currentDashboardTab);
    return;
  }

  dashboardOverlay = document.createElement('div');
  dashboardOverlay.id = 'focuspulse-dashboard-overlay';
  dashboardOverlay.innerHTML = `
    <div class="dashboard-container theme-light">
      <div class="dashboard-header" id="dash-drag">
        <div>
          <h2>Analytics</h2>
          <p class="dashboard-sub">Excellence follows integrity.</p>
        </div>
        <div class="dashboard-header-actions">
          <button class="dash-theme-btn" title="Toggle theme" aria-label="Toggle theme"></button>
          <button class="dashboard-close-btn" aria-label="Close">&times;</button>
        </div>
      </div>

      <div class="dashboard-tabs">
        <button class="dashboard-tab active" data-tab="today">Today</button>
        <button class="dashboard-tab" data-tab="thisWeek">This Week</button>
        <button class="dashboard-tab" data-tab="thisMonth">This Month</button>
        <button class="dashboard-tab" data-tab="thisYear">This Year</button>
        <button class="dashboard-tab" data-tab="allTime">All Time</button>
      </div>

      <div class="dashboard-content">
        <div class="dashboard-row">
          <div class="metric-card card-breakdown">
            <h3 id="breakdown-title">Breakdown</h3>
            <div class="breakdown-wrap">
              <canvas id="breakdown-chart"></canvas>
              <div class="breakdown-legend" id="breakdown-legend"></div>
            </div>
          </div>

          <div class="metric-card card-metrics">
            <h3>Key Metrics</h3>
            <div class="metrics-grid">
              <div class="metric-item"><span class="metric-label">Efficiency</span><span class="metric-value" id="efficiency-value">&middot;</span></div>
              <div class="metric-item"><span class="metric-label">Productivity Score</span><span class="metric-value" id="score-value">&middot;</span></div>
              <div class="metric-item"><span class="metric-label">Trend</span><span class="metric-value" id="trend-value">&middot;</span><span class="metric-sub" id="trend-hint"></span></div>
              <div class="metric-item"><span class="metric-label">Current Streak</span><span class="metric-value" id="streak-value">&middot;</span></div>
            </div>
          </div>
        </div>

        <div class="metric-card card-daily">
          <h3>Daily Activity <span class="daily-hint">scroll sideways for earlier days</span></h3>
          <div class="daily-scroll"><canvas id="daily-chart"></canvas></div>
        </div>
      </div>
    </div>
    <div class="chart-tooltip" id="chart-tooltip" hidden></div>
  `;

  const style = document.createElement('style');
  style.textContent = getDashboardCSS();
  dashboardOverlay.appendChild(style);
  document.body.appendChild(dashboardOverlay);

  const container = dashboardOverlay.querySelector('.dashboard-container');
  applyDashTransform();

  dashboardOverlay.querySelector('.dashboard-close-btn').addEventListener('click', hideDashboard);
  dashboardOverlay.querySelector('.dash-theme-btn').addEventListener('click', toggleTheme);
  dashboardOverlay.querySelectorAll('.dashboard-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => switchDashboardTab(e.target.dataset.tab));
  });
  dashboardOverlay.addEventListener('click', (e) => {
    if (e.target === dashboardOverlay) hideDashboard();
  });

  setupDashboardDrag(dashboardOverlay.querySelector('#dash-drag'), container);
  setupChartInteractivity();

  // Redraw charts when the (resizable) container changes size
  const ro = new ResizeObserver(() => { if (lastAnalytics) renderCharts(lastAnalytics); });
  ro.observe(container);

  // Load persisted theme, then render
  chrome.storage.local.get('dashboardTheme', (r) => {
    dashboardTheme = r && r.dashboardTheme === 'dark' ? 'dark' : 'light';
    applyTheme();
    switchDashboardTab('today');
  });
}

function hideDashboard() {
  if (dashboardOverlay) dashboardOverlay.style.display = 'none';
}

function toggleTheme() {
  dashboardTheme = dashboardTheme === 'dark' ? 'light' : 'dark';
  chrome.storage.local.set({ dashboardTheme });
  applyTheme();
  if (lastAnalytics) renderCharts(lastAnalytics);
}

function applyTheme() {
  const container = dashboardOverlay.querySelector('.dashboard-container');
  container.classList.toggle('theme-dark', dashboardTheme === 'dark');
  container.classList.toggle('theme-light', dashboardTheme === 'light');
  dashboardOverlay.classList.toggle('theme-dark', dashboardTheme === 'dark');
  const btn = dashboardOverlay.querySelector('.dash-theme-btn');
  btn.innerHTML = dashboardTheme === 'dark'
    ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`
    : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
}

function applyDashTransform() {
  const container = dashboardOverlay.querySelector('.dashboard-container');
  container.style.transform = `translate(${dashTransform.x}px, ${dashTransform.y}px)`;
}

function setupDashboardDrag(handle, container) {
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    ox = dashTransform.x; oy = dashTransform.y;
    e.preventDefault();
    const move = (ev) => {
      if (!dragging) return;
      dashTransform.x = ox + (ev.clientX - sx);
      dashTransform.y = oy + (ev.clientY - sy);
      container.style.transform = `translate(${dashTransform.x}px, ${dashTransform.y}px)`;
    };
    const up = () => {
      dragging = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function switchDashboardTab(tabName) {
  currentDashboardTab = tabName;
  dashboardOverlay.querySelectorAll('.dashboard-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  loadDashboardData(tabName);
}

function loadDashboardData(period) {
  chrome.runtime.sendMessage({ type: 'GET_ANALYTICS', period }, (response) => {
    if (response && response.success) {
      lastAnalytics = response.analytics;
      updateDashboardDisplay(response.analytics);
    }
  });
}

function updateDashboardDisplay(analytics) {
  const { efficiency, netScore, trend, currentStreak } = analytics;

  dashboardOverlay.querySelector('#efficiency-value').textContent = efficiency + '%';
  dashboardOverlay.querySelector('#score-value').textContent = Math.round(netScore);

  const trendEl = dashboardOverlay.querySelector('#trend-value');
  const trendHint = dashboardOverlay.querySelector('#trend-hint');
  if (!trend) { trendEl.textContent = '·'; trendEl.style.color = ''; }
  else if (trend.direction === 'new') { trendEl.textContent = 'New'; trendEl.style.color = ''; }
  else if (trend.direction === 'up') { trendEl.textContent = '↑ ' + trend.points + ' pts'; trendEl.style.color = '#10b981'; }
  else if (trend.direction === 'down') { trendEl.textContent = '↓ ' + trend.points + ' pts'; trendEl.style.color = '#ef4444'; }
  else { trendEl.textContent = 'Even'; trendEl.style.color = ''; }
  if (trendHint) trendHint.textContent = trend && trend.vs ? 'efficiency vs ' + trend.vs : 'efficiency';

  dashboardOverlay.querySelector('#streak-value').textContent = currentStreak + (currentStreak === 1 ? ' day' : ' days');

  renderCharts(analytics);
}

function renderCharts(analytics) {
  const days = (analytics.dayBreakdown || []).length || 1;
  const titleEl = dashboardOverlay.querySelector('#breakdown-title');
  if (titleEl) titleEl.textContent = days > 1 ? 'Daily Average' : 'Breakdown';
  drawDoughnut(dashboardOverlay.querySelector('#breakdown-chart'), analytics.totals, days);
  drawLegend(dashboardOverlay.querySelector('#breakdown-legend'), analytics.totals, days);
  drawDailyBars(dashboardOverlay.querySelector('#daily-chart'), analytics.dayBreakdown || []);
}

/* ------------------------------ Doughnut ------------------------------ */
function drawDoughnut(canvas, totals, divisor) {
  divisor = divisor || 1;
  const size = 168;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const tc = themeColors();
  const cx = size / 2, cy = size / 2, rOuter = 72, rInner = 46;
  const values = DASH_TAGS.map((t) => totals[t.key] || 0);
  const total = values.reduce((a, b) => a + b, 0);
  doughnutGeom = { cx, cy, rInner, rOuter, slices: [] };

  if (total === 0) {
    ctx.beginPath();
    ctx.strokeStyle = tc.ring;
    ctx.lineWidth = rOuter - rInner;
    ctx.arc(cx, cy, (rOuter + rInner) / 2, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = tc.muted;
    ctx.font = '400 12px ' + FP_FONT + '';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('No data yet', cx, cy);
    return;
  }

  let start = -Math.PI / 2;
  DASH_TAGS.forEach((tag, i) => {
    const val = values[i];
    if (val <= 0) return;
    const ang = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, start, start + ang);
    ctx.arc(cx, cy, rInner, start + ang, start, true);
    ctx.closePath();
    ctx.fillStyle = tag.color;
    ctx.fill();
    doughnutGeom.slices.push({ start, end: start + ang, label: tag.label, color: tag.color, seconds: val, pct: Math.round((val / total) * 100) });
    start += ang;
  });

  ctx.fillStyle = tc.text;
  ctx.font = '500 18px ' + FP_FONT + '';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(formatMinutes((total / divisor) / 60), cx, cy - 5);
  ctx.fillStyle = tc.muted;
  ctx.font = '400 9px ' + FP_FONT + '';
  ctx.fillText(divisor > 1 ? 'AVG / DAY' : 'TOTAL', cx, cy + 12);
}

function drawLegend(container, totals, divisor) {
  divisor = divisor || 1;
  const total = DASH_TAGS.reduce((a, t) => a + (totals[t.key] || 0), 0);
  container.innerHTML = DASH_TAGS.map((tag) => {
    const val = totals[tag.key] || 0;
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    return `
      <div class="legend-row">
        <span class="legend-dot" style="background:${tag.color}"></span>
        <span class="legend-name">${tag.label}</span>
        <span class="legend-val">${formatMinutes((val / divisor) / 60)}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
  }).join('');
}

/* --------------------------- Stacked daily bars --------------------------- */
function drawDailyBars(canvas, dayBreakdown) {
  // Show every day in the period, oldest to newest, and let it scroll sideways.
  const days = dayBreakdown.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const H = 184;
  const padL = 40, padR = 12, padT = 10, padB = 28;
  const SLOT = 60; // fixed width per day so older days remain reachable by scrolling
  const avail = (canvas.parentElement && canvas.parentElement.clientWidth) || 560;
  const needed = padL + padR + Math.max(1, days.length) * SLOT;
  const W = Math.max(avail, needed);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const tc = themeColors();
  dayCols = [];

  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  if (days.length === 0) {
    ctx.fillStyle = tc.muted;
    ctx.font = '400 13px ' + FP_FONT + '';
    ctx.textAlign = 'center';
    ctx.fillText('No activity yet', W / 2, H / 2);
    return;
  }

  const totalsPerDay = days.map((d) => DASH_TAGS.reduce((a, t) => a + (d.totals[t.key] || 0), 0));
  const maxMinutes = Math.max(1, ...totalsPerDay) / 60;
  const step = niceStep(maxMinutes);
  const axisMax = Math.max(step, Math.ceil(maxMinutes / step) * step);

  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.font = '400 10px ' + FP_FONT + '';
  for (let v = 0; v <= axisMax + 0.001; v += step) {
    const y = padT + chartH - (v / axisMax) * chartH;
    ctx.strokeStyle = tc.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    ctx.fillStyle = tc.muted;
    ctx.fillText(v >= 60 ? (v / 60) + 'h' : v + 'm', padL - 8, y);
  }

  const slot = SLOT;
  const barW = Math.min(42, slot - 14);

  days.forEach((d, i) => {
    // Dates arrive as ISO strings after chrome messaging serialisation, so coerce.
    const dt = new Date(d.date);
    const slotX = padL + i * slot;
    const x = slotX + (slot - barW) / 2;
    let y = padT + chartH;
    let isBottom = true;
    DASH_TAGS.forEach((tag) => {
      const val = d.totals[tag.key] || 0;
      if (val <= 0) return;
      const h = (val / 60 / axisMax) * chartH;
      ctx.fillStyle = tag.color;
      roundRectTop(ctx, x, y - h, barW, h, isBottom ? 3 : 0);
      y -= h;
      isBottom = false;
    });

    // DD/MM label, e.g. 15/09 for 15 Sept
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    ctx.fillStyle = tc.muted;
    ctx.font = '400 10px ' + FP_FONT + '';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(dd + '/' + mm, x + barW / 2, padT + chartH + 8);

    // Full-column hover region → per-day summary tooltip
    dayCols.push({
      x0: slotX, x1: slotX + slot, top: padT, bottom: padT + chartH,
      totals: d.totals,
      label: isNaN(dt) ? String(d.date) : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    });
  });
}

/** Per-period/day metrics using the same formulas as the service worker. */
function metricsFor(t) {
  const total = (t.green || 0) + (t.orange || 0) + (t.red || 0) + (t.blue || 0);
  if (!total) return { total: 0, eff: 0, score: 0 };
  const eff = Math.round((t.green || 0) / total * 100);
  const score = Math.max(0, Math.min(100, Math.round(((t.green || 0) - (t.red || 0) + 0.25 * (t.orange || 0)) / total * 100)));
  return { total, eff, score };
}

function dayTooltipHTML(col) {
  const t = col.totals;
  const m = metricsFor(t);
  const rows = DASH_TAGS.map((tag) =>
    `<div class="tt-row"><span class="tt-dot" style="background:${tag.color}"></span>${tag.label}<span class="tt-v">${formatMinutes((t[tag.key] || 0) / 60)}</span></div>`
  ).join('');
  return `<div class="tt-title">${col.label}</div>${rows}` +
    `<div class="tt-sep"></div>` +
    `<div class="tt-row tt-metric">Efficiency<span class="tt-v">${m.eff}%</span></div>` +
    `<div class="tt-row tt-metric">Score<span class="tt-v">${m.score}</span></div>`;
}

/* ------------------------------ Interactivity ------------------------------ */
function setupChartInteractivity() {
  const tooltip = dashboardOverlay.querySelector('#chart-tooltip');
  const daily = dashboardOverlay.querySelector('#daily-chart');
  const dough = dashboardOverlay.querySelector('#breakdown-chart');

  const showTip = (html, e) => {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const pad = 14;
    let left = e.clientX + pad, top = e.clientY + pad;
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    if (left + w > window.innerWidth - 8) left = e.clientX - w - pad;
    if (top + h > window.innerHeight - 8) top = e.clientY - h - pad;
    tooltip.style.left = Math.max(8, left) + 'px';
    tooltip.style.top = Math.max(8, top) + 'px';
  };
  const hideTip = () => { tooltip.hidden = true; };

  daily.addEventListener('mousemove', (e) => {
    if (!dayCols) return;
    const rect = daily.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const col = dayCols.find((c) => mx >= c.x0 && mx <= c.x1 && my >= c.top && my <= c.bottom);
    if (col) {
      daily.style.cursor = 'pointer';
      showTip(dayTooltipHTML(col), e);
    } else { daily.style.cursor = 'default'; hideTip(); }
  });
  daily.addEventListener('mouseleave', hideTip);

  dough.addEventListener('mousemove', (e) => {
    if (!doughnutGeom) return;
    const rect = dough.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const dx = mx - doughnutGeom.cx, dy = my - doughnutGeom.cy;
    const r = Math.hypot(dx, dy);
    if (r < doughnutGeom.rInner || r > doughnutGeom.rOuter) { dough.style.cursor = 'default'; hideTip(); return; }
    let ang = Math.atan2(dy, dx);
    // normalise so slices starting at -PI/2 compare correctly
    const norm = (a) => { while (a < -Math.PI / 2) a += 2 * Math.PI; while (a >= 1.5 * Math.PI) a -= 2 * Math.PI; return a; };
    ang = norm(ang);
    const hit = doughnutGeom.slices.find((s) => ang >= norm(s.start) - 1e-6 && ang <= norm(s.start) + (s.end - s.start) + 1e-6);
    if (hit) {
      dough.style.cursor = 'pointer';
      showTip(`<span class="tt-dot" style="background:${hit.color}"></span><b>${hit.label}</b><br><span class="tt-val">${formatMinutes(hit.seconds / 60)} · ${hit.pct}%</span>`, e);
    } else { dough.style.cursor = 'default'; hideTip(); }
  });
  dough.addEventListener('mouseleave', hideTip);
}

function roundRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

function niceStep(maxMinutes) {
  if (maxMinutes <= 10) return 2;
  if (maxMinutes <= 30) return 5;
  if (maxMinutes <= 60) return 15;
  if (maxMinutes <= 180) return 30;
  if (maxMinutes <= 480) return 60;
  return 120;
}

function formatMinutes(minutes) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours + 'h ' + mins + 'm';
  }
  return Math.floor(minutes) + 'm';
}

function getDashboardCSS() {
  return `
    #focuspulse-dashboard-overlay {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483646;
      --fp-font: -apple-system, 'SF Pro Display', 'SF Pro Text', BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-family: var(--fp-font);
    }
    .dashboard-container {
      --bg: #ffffff; --card: #f7f8fa; --border: #eceef1;
      --text: #0f172a; --text2: #475569; --text3: #94a3b8;
      --tab-bg: #0f172a; --tab-fg: #ffffff; --hover: #f1f5f9;
      background: var(--bg);
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(0,0,0,0.32);
      width: 860px; max-width: 96vw; height: 600px; max-height: 92vh;
      min-width: 520px; min-height: 460px;
      display: flex; flex-direction: column; overflow: hidden;
      resize: both;
      font-weight: 400;
      color: var(--text);
    }
    .dashboard-container.theme-dark {
      --bg: #16181d; --card: #1e2229; --border: #2a2f39;
      --text: #f1f5f9; --text2: #b4bdca; --text3: #7c8798;
      --tab-bg: #f1f5f9; --tab-fg: #0f172a; --hover: #262b34;
      box-shadow: 0 24px 70px rgba(0,0,0,0.55);
    }
    .dashboard-container * { font-family: var(--fp-font); font-weight: 400; box-sizing: border-box; }

    .dashboard-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 20px 22px 14px; border-bottom: 1px solid var(--border); cursor: grab;
    }
    .dashboard-header:active { cursor: grabbing; }
    .dashboard-header h2 { margin: 0; font-size: 20px; font-weight: 500; color: var(--text); letter-spacing: -0.2px; }
    .dashboard-sub { margin: 3px 0 0; font-size: 12px; color: var(--text3); }
    .dashboard-header-actions { display: flex; align-items: center; gap: 6px; }
    .dash-theme-btn, .dashboard-close-btn {
      background: none; border: none; cursor: pointer; color: var(--text2);
      width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    }
    .dashboard-close-btn { font-size: 24px; line-height: 1; }
    .dash-theme-btn:hover, .dashboard-close-btn:hover { background: var(--hover); color: var(--text); }
    .dash-theme-btn svg { display: block; }

    .dashboard-tabs { display: flex; gap: 4px; padding: 12px 22px; border-bottom: 1px solid var(--border); overflow-x: auto; }
    .dashboard-tab {
      padding: 7px 14px; border: none; background: none; cursor: pointer;
      font-size: 13px; color: var(--text2); border-radius: 8px; white-space: nowrap;
    }
    .dashboard-tab:hover { background: var(--hover); color: var(--text); }
    .dashboard-tab.active { color: var(--tab-fg); background: var(--tab-bg); }

    .dashboard-content { flex: 1; overflow-y: auto; padding: 18px 22px 22px; }
    .dashboard-row { display: flex; gap: 14px; align-items: stretch; flex-wrap: nowrap; }

    .metric-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
    .card-breakdown { flex: 0 0 auto; }
    .card-metrics { flex: 1 1 auto; min-width: 200px; }
    .card-daily { margin-top: 14px; }
    .metric-card h3 { margin: 0 0 14px; font-size: 11px; font-weight: 500; color: var(--text3); text-transform: uppercase; letter-spacing: 0.7px; }
    .daily-hint { color: var(--text3); text-transform: none; letter-spacing: 0; font-size: 11px; }
    .daily-scroll { overflow-x: auto; overflow-y: hidden; }
    .daily-scroll::-webkit-scrollbar { height: 8px; }
    .daily-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }

    .breakdown-wrap { display: flex; align-items: center; gap: 14px; }
    .breakdown-legend { display: flex; flex-direction: column; gap: 9px; }
    .legend-row { display: flex; align-items: center; gap: 8px; font-size: 13px; white-space: nowrap; }
    .legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
    .legend-name { color: var(--text2); width: 42px; }
    .legend-val { color: var(--text); margin-left: 6px; font-variant-numeric: tabular-nums; min-width: 52px; }
    .legend-pct { color: var(--text3); width: 34px; text-align: right; font-variant-numeric: tabular-nums; }

    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 14px; }
    .metric-item { display: flex; flex-direction: column; gap: 4px; }
    .metric-label { font-size: 12px; color: var(--text2); }
    .metric-value { font-size: 24px; font-weight: 500; color: var(--text); font-variant-numeric: tabular-nums; letter-spacing: -0.3px; }
    .metric-sub { font-size: 10.5px; color: var(--text3); }

    .card-daily canvas { display: block; }

    .chart-tooltip {
      position: fixed; z-index: 2147483647; pointer-events: none;
      background: #0f172a; color: #ffffff;
      padding: 9px 11px; border-radius: 10px; font-size: 12px; line-height: 1.35;
      box-shadow: 0 8px 24px rgba(0,0,0,0.32); white-space: nowrap; min-width: 156px;
    }
    #focuspulse-dashboard-overlay.theme-dark .chart-tooltip { background: #f1f5f9; color: #16181d; }
    .chart-tooltip b { font-weight: 500; }
    .chart-tooltip .tt-title { font-weight: 500; margin-bottom: 7px; font-size: 12.5px; }
    .chart-tooltip .tt-row { display: flex; align-items: center; gap: 7px; font-size: 12px; line-height: 1.7; opacity: 0.92; }
    .chart-tooltip .tt-row.tt-metric { opacity: 1; }
    .chart-tooltip .tt-row .tt-v { margin-left: auto; padding-left: 16px; font-variant-numeric: tabular-nums; }
    .chart-tooltip .tt-dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
    .chart-tooltip .tt-val { opacity: 0.85; }
    .chart-tooltip .tt-sep { height: 1px; background: currentColor; opacity: 0.18; margin: 6px 0; }

    @media (max-width: 760px) {
      .dashboard-container { min-width: 0; width: 96vw; }
      .dashboard-row { flex-wrap: wrap; }
      .card-breakdown, .card-metrics, .card-daily { flex: 1 1 100%; }
    }
  `;
}
