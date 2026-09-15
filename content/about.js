/**
 * FocusPulse About / Info overlay
 * Opened by clicking the "FocusPulse" title on the widget.
 * Explains what the extension is and how every metric is calculated.
 */

let aboutOverlay = null;

function showAbout() {
  if (aboutOverlay) {
    aboutOverlay.style.display = 'flex';
    return;
  }

  aboutOverlay = document.createElement('div');
  aboutOverlay.id = 'focuspulse-about-overlay';
  aboutOverlay.innerHTML = `
    <div class="about-container">
      <div class="about-header">
        <div>
          <h2>FocusPulse</h2>
          <p class="about-sub">Excellence follows integrity.</p>
        </div>
        <button class="about-close" aria-label="Close">&times;</button>
      </div>

      <div class="about-body">
        <section>
          <p class="about-lead">FocusPulse is a focus tracker built on one idea: you are the sensor.
          With a single click you say what you are actually doing, and it turns those honest calls into a
          clear picture of your day. Nothing is guessed and nothing runs in the background, so the numbers
          are worth exactly as much as your honesty. That is the whole point.</p>
        </section>

        <section>
          <h3>The four states</h3>
          <div class="about-tags">
            <div class="about-tag"><span class="tag-dot" style="background:#10b981"></span>
              <div><b>Flow</b><span>Deep, undistracted work. The time that actually moves things forward.</span></div></div>
            <div class="about-tag"><span class="tag-dot" style="background:#f97316"></span>
              <div><b>Noise</b><span>Working with divided attention, like coding with a podcast on. Still counts, just less.</span></div></div>
            <div class="about-tag"><span class="tag-dot" style="background:#ef4444"></span>
              <div><b>Lost</b><span>Unintended distraction. Log it honestly and a 10 minute penalty is added on top.</span></div></div>
            <div class="about-tag"><span class="tag-dot" style="background:#3b82f6"></span>
              <div><b>Rest</b><span>Intentional breaks. Rest is not a failure, so it is never held against you.</span></div></div>
          </div>
        </section>

        <section>
          <h3>How a day works</h3>
          <p>Press <b>Start</b> to open your day, then tap a state whenever what you're doing changes.
          The active state ticks up live, and <b>Total</b> is the sum of all tracked time. Press
          <b>End</b> to close the day (everything freezes and un-highlights), or <b>Reset</b> to clear
          today and begin again. You can also switch with <b>Alt&nbsp;+&nbsp;1 to 4</b>.</p>
        </section>

        <section>
          <h3>How the metrics are calculated</h3>

          <div class="formula">
            <div class="formula-name">Efficiency</div>
            <div class="formula-eq">Flow ÷ Total tracked × 100</div>
            <p>The share of tracked time spent in real Flow. 85% means roughly six of every seven tracked minutes were deep work.</p>
          </div>

          <div class="formula">
            <div class="formula-name">Productivity Score <span>0 to 100</span></div>
            <div class="formula-eq">(Flow &minus; Lost + &frac14;&middot;Noise) &divide; Total &times; 100</div>
            <p>One number for the quality of your time. Flow counts in full, Noise earns a quarter (working
            with audio is still working), and only Lost carries a penalty. Rest is neutral. The result is
            capped at 0 and 100.</p>
          </div>

          <div class="formula">
            <div class="formula-name">Current Streak</div>
            <div class="formula-eq">Consecutive days where Flow &ge; 40% of that day's tracked time</div>
            <p>Clear 40% and the day counts. Miss it and the streak resets. It rewards showing up
            consistently, not one hero day followed by silence.</p>
          </div>

          <div class="formula">
            <div class="formula-name">Trend</div>
            <div class="formula-eq">Change in efficiency vs the previous period</div>
            <p>Today against yesterday, this week against last week. If your focus share beats the last
            period it points up, if it slips it points down. No prior data reads as New.</p>
          </div>
        </section>

        <section>
          <h3>Totals vs averages</h3>
          <p>On single-day views the Breakdown ring shows that day's totals. On multi-day views it switches
          to your average per active day, so a busy week and a light week can be compared fairly. Hover any
          bar in Daily Activity to see that day's split plus its own efficiency and score.</p>
        </section>

        <section>
          <h3>Your data</h3>
          <p>Everything stays on your device in local browser storage. There is no account, no server, and
          no tracking by anyone but you. Export or clear it any time from Settings.</p>
        </section>

        <p class="about-foot">FocusPulse · self-reported focus, honestly tracked.</p>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = getAboutCSS();
  aboutOverlay.appendChild(style);
  document.body.appendChild(aboutOverlay);

  aboutOverlay.querySelector('.about-close').addEventListener('click', hideAbout);
  aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) hideAbout(); });
}

function hideAbout() {
  if (aboutOverlay) aboutOverlay.style.display = 'none';
}

function getAboutCSS() {
  return `
    #focuspulse-about-overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center; z-index: 2147483646;
      font-family: -apple-system, 'SF Pro Display', 'SF Pro Text', BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #focuspulse-about-overlay * { box-sizing: border-box; font-weight: 400; }
    .about-container {
      background: #ffffff; color: #0f172a; border-radius: 18px;
      width: 560px; max-width: 94vw; max-height: 88vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 24px 70px rgba(0,0,0,0.32);
    }
    .about-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 22px 24px 16px; border-bottom: 1px solid #eceef1;
    }
    .about-header h2 { margin: 0; font-size: 22px; font-weight: 500; letter-spacing: -0.3px; }
    .about-sub { margin: 3px 0 0; font-size: 12px; color: #94a3b8; }
    .about-close { background: none; border: none; font-size: 26px; cursor: pointer; color: #94a3b8; width: 34px; height: 34px; border-radius: 8px; line-height: 1; }
    .about-close:hover { background: #f1f5f9; color: #0f172a; }

    .about-body { padding: 20px 24px 24px; overflow-y: auto; }
    .about-body section { margin-bottom: 22px; }
    .about-body h3 { margin: 0 0 12px; font-size: 12px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.7px; }
    .about-body p { margin: 0; font-size: 14px; line-height: 1.6; color: #475569; }
    .about-lead { font-size: 14.5px; color: #334155; }
    .about-body b { font-weight: 500; color: #0f172a; }

    .about-tags { display: flex; flex-direction: column; gap: 12px; }
    .about-tag { display: flex; gap: 12px; align-items: flex-start; }
    .tag-dot { width: 12px; height: 12px; border-radius: 4px; margin-top: 4px; flex-shrink: 0; }
    .about-tag div { display: flex; flex-direction: column; gap: 2px; }
    .about-tag span:not(.tag-dot) { font-size: 13px; color: #64748b; line-height: 1.45; }

    .formula { padding: 14px 16px; background: #f7f8fa; border: 1px solid #eceef1; border-radius: 12px; margin-bottom: 12px; }
    .formula-name { font-size: 14px; color: #0f172a; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .formula-name span { font-size: 11px; color: #94a3b8; border: 1px solid #e2e8f0; padding: 1px 7px; border-radius: 20px; }
    .formula-eq { font-family: 'SF Mono', ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 13px; color: #0f766e; background: #ecfdf5; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
    .formula p { font-size: 13px; color: #64748b; line-height: 1.5; }

    .about-foot { text-align: center; font-size: 12px; color: #b0b8c4; margin-top: 8px; }
  `;
}
