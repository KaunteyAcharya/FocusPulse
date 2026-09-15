/**
 * FocusPulse Analytics
 *
 * Compute metrics from session history stored in chrome.storage.local
 * - Period totals (Today, This Week, This Month, YTD, All-Time)
 * - Net productivity score
 * - Efficiency % (green / total tracked time)
 * - Streak logic (consecutive days where green >= 40% of tracked time)
 */

/**
 * Get date range boundaries
 */
function getDateRanges() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const monthStart = new Date(today);
  monthStart.setDate(1);

  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

  const yearStart = new Date(today);
  yearStart.setMonth(0, 1);

  return {
    today: { start: today, end: new Date(today.getTime() + 86400000) },
    yesterday: { start: yesterday, end: today },
    thisWeek: { start: weekStart, end: new Date(weekStart.getTime() + 7 * 86400000) },
    lastWeek: { start: lastWeekStart, end: weekStart },
    thisMonth: { start: monthStart, end: new Date(monthStart.getTime() + 30 * 86400000) },
    lastMonth: { start: lastMonthStart, end: monthStart },
    thisYear: { start: yearStart, end: new Date(today.getTime() + 86400000) },
    allTime: { start: new Date(0), end: new Date(today.getTime() + 86400000) }
  };
}

/**
 * Get sessions within a date range
 */
function getSessionsInRange(sessions, startDate, endDate) {
  return sessions.filter((session) => {
    const sessionDate = new Date(session.startTime);
    return sessionDate >= startDate && sessionDate < endDate;
  });
}

/**
 * Calculate totals for a period
 */
function calculatePeriodTotals(sessions) {
  const totals = { green: 0, blue: 0, orange: 0, red: 0 };

  sessions.forEach((session) => {
    totals[session.color] = (totals[session.color] || 0) + session.durationSeconds;
  });

  return totals;
}

/**
 * Calculate net productivity score
 * Formula: (Flow − Lost + 0.25×Noise) / total tracked × 100, clamped 0–100.
 * Noise (working while listening to audio, etc.) earns partial credit rather
 * than being fully penalised; Lost is the only fully negative state; Rest is
 * neutral (counted in the denominator but neither rewarded nor penalised).
 *   green = Flow, orange = Noise, red = Lost, blue = Rest
 */
function calculateNetProductivityScore(totals) {
  const total =
    totals.green +
    totals.blue +
    totals.orange +
    totals.red;

  if (total === 0) return 0;

  const score = totals.green - totals.red + 0.25 * totals.orange;
  const normalizedScore = (score / total) * 100;

  return Math.max(0, Math.min(100, normalizedScore));
}

/**
 * Calculate efficiency % (green / total tracked time)
 */
function calculateEfficiency(totals) {
  const total =
    totals.green +
    totals.blue +
    totals.orange +
    totals.red;

  if (total === 0) return 0;

  return Math.round((totals.green / total) * 100);
}

/**
 * Get breakdown by day for a period
 * Returns array of { date, totals, greenDominant }
 */
function getDayBreakdown(sessions) {
  const dayMap = {};

  sessions.forEach((session) => {
    const date = new Date(session.startTime).toDateString();
    if (!dayMap[date]) {
      dayMap[date] = { green: 0, blue: 0, orange: 0, red: 0 };
    }
    dayMap[date][session.color] += session.durationSeconds;
  });

  return Object.entries(dayMap).map(([date, totals]) => {
    const total = totals.green + totals.blue + totals.orange + totals.red;
    const greenPercentage = total > 0 ? totals.green / total : 0;
    const greenDominant = greenPercentage >= 0.4; // 40% threshold

    return {
      date: new Date(date),
      totals,
      greenDominant,
      greenPercentage
    };
  });
}

/**
 * Calculate current and longest streak
 * A day counts as a streak day if green >= 40% of that day's tracked time
 */
function calculateStreaks(sessions) {
  const dayBreakdown = getDayBreakdown(sessions);
  dayBreakdown.sort((a, b) => a.date - b.date);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Iterate through days
  const allDays = dayBreakdown.map((d) => d.date.toDateString());

  for (let i = 0; i < allDays.length; i++) {
    const currentDay = new Date(allDays[i]);
    const dayData = dayBreakdown.find((d) => d.date.toDateString() === allDays[i]);

    if (dayData.greenDominant) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);

      // Check if this is recent (within last 1 day)
      const daysSinceNow = Math.floor(
        (today.getTime() - currentDay.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceNow <= 1) {
        currentStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
}

/**
 * Calculate trend vs previous period
 * Returns { percentage, direction } e.g. { percentage: 15, direction: 'up' }
 */
function calculateTrend(currentTotal, previousTotal) {
  if (previousTotal === 0) {
    return { percentage: 0, direction: 'neutral' };
  }

  const change = ((currentTotal - previousTotal) / previousTotal) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';

  return { percentage: Math.abs(Math.round(change)), direction };
}

/**
 * Get full analytics for a period
 */
function getAnalyticsForPeriod(sessionHistory, periodKey) {
  const ranges = getDateRanges();
  const period = ranges[periodKey];

  if (!period) {
    console.error('Invalid period:', periodKey);
    return null;
  }

  const sessions = getSessionsInRange(sessionHistory, period.start, period.end);
  const totals = calculatePeriodTotals(sessions);

  let previousTotals = null;
  let previousLabel = null;
  let trend = null;

  // Identify the comparison period
  if (periodKey === 'today') {
    previousTotals = calculatePeriodTotals(getSessionsInRange(sessionHistory, ranges.yesterday.start, ranges.yesterday.end));
    previousLabel = 'yesterday';
  } else if (periodKey === 'thisWeek') {
    previousTotals = calculatePeriodTotals(getSessionsInRange(sessionHistory, ranges.lastWeek.start, ranges.lastWeek.end));
    previousLabel = 'last week';
  } else if (periodKey === 'thisMonth') {
    previousTotals = calculatePeriodTotals(getSessionsInRange(sessionHistory, ranges.lastMonth.start, ranges.lastMonth.end));
    previousLabel = 'last month';
  }

  const efficiency = calculateEfficiency(totals);

  // Trend = change in EFFICIENCY (percentage points) vs the previous period.
  if (previousTotals) {
    const prevTracked = previousTotals.green + previousTotals.blue + previousTotals.orange + previousTotals.red;
    if (prevTracked === 0) {
      trend = { direction: 'new', points: 0, vs: previousLabel };
    } else {
      const prevEff = calculateEfficiency(previousTotals);
      const pts = efficiency - prevEff;
      trend = {
        direction: pts > 0 ? 'up' : pts < 0 ? 'down' : 'neutral',
        points: Math.abs(pts),
        vs: previousLabel
      };
    }
  }

  const netScore = calculateNetProductivityScore(totals);
  const dayBreakdown = getDayBreakdown(sessions);

  return {
    period: periodKey,
    sessions,
    totals,
    efficiency,
    netScore,
    trend,
    dayBreakdown
  };
}

/**
 * Get all analytics (all periods at once)
 */
function getAllAnalytics(sessionHistory) {
  return {
    today: getAnalyticsForPeriod(sessionHistory, 'today'),
    thisWeek: getAnalyticsForPeriod(sessionHistory, 'thisWeek'),
    thisMonth: getAnalyticsForPeriod(sessionHistory, 'thisMonth'),
    thisYear: getAnalyticsForPeriod(sessionHistory, 'thisYear'),
    allTime: getAnalyticsForPeriod(sessionHistory, 'allTime')
  };
}
