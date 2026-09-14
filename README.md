# FocusPulse

A neuro-informed, self-reported productivity tracker Chrome extension. Track your focus in real time with a persistent, floating widget that nudges you toward deep work through behavioral feedback loops.

## 🎯 Core Concept

FocusPulse helps you build better focus habits by letting **you** decide what you're doing, right now:

- 🟢 **Green** = Deep focus / pure work
- 🔵 **Blue** = Working + listening to music/podcast (productive, not pure focus)
- 🟠 **Orange** = Mindless distraction / tab-switching (you estimate the time wasted, we add a 10-minute penalty)
- 🔴 **Red** = Break / not productive

**Why self-reporting?** Watching your own color ratio update in real-time creates a dopamine-driven feedback loop. You're not being tracked—you're tracking yourself, and that matters.

## ✨ Key Features (Phase 1 MVP)

- ✅ **Persistent floating widget** that never disappears—stays visible across all tabs, even after browser restart
- ✅ **4 color-coded buttons** to log your current activity state
- ✅ **Live progress bar** showing today's time breakdown by color
- ✅ **Freely draggable** anywhere on screen; position persists
- ✅ **Collapsed "pill" mode** for a minimal footprint when you need less distraction
- ✅ **Frosted-glass aesthetic** with blur, rounded corners, and subtle shadows
- ✅ **100% local storage**—no backend, no account, no tracking by us
- ✅ **MIT licensed** and open source

## 🚀 Installation & Testing

### Step 1: Load the Extension in Chrome

1. **Open Chrome** and go to `chrome://extensions/`
2. **Toggle "Developer mode"** in the top-right corner
3. **Click "Load unpacked"** 
4. **Select the folder** containing this `FocusPulse` project (the folder with `manifest.json`)
5. **FocusPulse is now installed!** You should see the icon in your extensions area.

### Step 2: Verify the Widget Appears

1. **Open any website** (e.g., google.com)
2. **Look for a small frosted-glass circle** in the top-left corner (the "pill" is the default collapsed view)
3. Click the pill to expand the widget and see all 4 color buttons.

### Step 3: Test Basic Features

#### Test Color Switching
- Click each color button (Green, Blue, Orange, Red) and watch the active button highlight
- The live progress bar at the bottom updates as you log time

#### Test Orange Time Logging
- Click the **Orange ("Distracted")** button
- A prompt appears asking "How many minutes do you think you wasted?"
- Enter a number (e.g., `5`)
- The widget automatically adds a 10-minute penalty (so 5 → 15 minutes total logged under orange)

#### Test Dragging
- Hover over the widget header (in expanded view) or the pill itself
- Click and drag to move the widget anywhere on screen
- **Reload the page** — the widget should stay in the exact position you left it

#### Test Persistence Across Tabs
- **Open the widget in expanded mode** on this tab
- **Open a new tab** (Ctrl+T or Cmd+T)
- **Verify the widget appears on the new tab** with the same state (same color active, same time breakdown)
- Click a different color on the new tab
- **Go back to the first tab** — the widget should show the new color as active
- ✅ This proves the widget state stays in sync across tabs!

#### Test Collapsed/Expanded Toggle
- Click the **−** (minus) button in the widget header to collapse it
- The widget shrinks to a small colored dot (the "pill")
- Click the pill to expand it again
- Refresh the page — it stays in whatever mode you left it

## 🛠 How It Works (Architecture)

### Single Source of Truth
The **background service worker** (`background/service-worker.js`) holds the complete state:
- Current active color
- Today's accumulated time per color (in seconds)
- Widget position
- Collapsed/expanded state
- Full session history

All state persists to `chrome.storage.local` on every change.

### Widget Synchronization
The **content script** (`content/widget.js`) runs on every tab and:

1. **Fetches initial state** from the service worker on page load
2. **Renders the widget** with the current state
3. **Listens for state updates** via:
   - `chrome.runtime.onMessage` — direct messages from the service worker when it broadcasts state changes
   - `chrome.storage.onChanged` — detects storage changes (backup mechanism for multi-tab sync)
4. **Sends user actions** (color clicks, drag position, collapse toggle) to the service worker
5. **Updates the UI** based on the latest state

### Why It Never Disappears
- The widget is injected into **every tab** (`matches: ["<all_urls>"]` in manifest)
- When you open a new tab, the content script runs immediately and fetches the latest state
- When you navigate within a tab, the content script reinitializes if the widget got removed
- State persists across browser restarts because it's stored in `chrome.storage.local`

## 📊 Data Stored Locally

In `chrome://extensions/`, click "Details" on the FocusPulse extension, then scroll down to "Storage" to see:
- `chrome.storage.local` contains:
  - `activeColor`: current color state
  - `sessionStartTime`: timestamp of when current session started
  - `widgetPosition`: x/y coordinates of widget on screen
  - `isCollapsed`: boolean for expanded/collapsed state
  - `todaysSessions`: object with `{ green: X, blue: Y, orange: Z, red: W }` (all in seconds)
  - `lastSessionDate`: today's date (used to reset daily totals)
  - `sessionHistory`: array of all logged sessions (for analytics in later phases)

## 🧠 Design Philosophy

FocusPulse is built on behavioral science principles:
- **Honesty-based**: Only you know if you're truly focused; the tool trusts your self-assessment
- **Real-time feedback**: Watching your color ratio updates in real-time taps into the goal-gradient effect
- **Non-punitive**: Orange/red time is framed as recoverable, never as failure
- **Dopamine loop**: Chasing more green/blue creates intrinsic motivation

## 🗂 Project Structure

```
FocusPulse/
├── manifest.json              # Extension config (Manifest V3)
├── background/
│   └── service-worker.js      # Single source of truth for state
├── content/
│   ├── widget.js              # Widget UI & user interactions
│   └── widget.css             # Frosted-glass styling
├── assets/                    # Icons (to be added in Phase 2)
├── README.md                  # This file
└── LICENSE                    # MIT License
```

## 🚧 What's NOT in Phase 1

- Expanded analytics dashboard (Phase 2)
- Streak tracking & notifications (Phase 2 & 3)
- Animated micro-toasts & polished interactions (Phase 3)
- Keyboard shortcuts (Phase 3)
- Data export, idle detection, settings (Phase 4)

Phase 1 focuses solely on proving the widget persists correctly and logs basic time.

## 🐛 Troubleshooting

### Widget doesn't appear
1. Check `chrome://extensions/` to confirm FocusPulse is installed and enabled
2. Reload the tab (Ctrl+Shift+R or Cmd+Shift+R for hard refresh)
3. Check the console (F12 → Console) for any errors

### Widget resets when I switch tabs
1. Go to `chrome://extensions/` → FocusPulse → Details → Storage
2. Verify `chrome.storage.local` has data
3. If it's empty, the service worker may have crashed. Disable/re-enable the extension (toggle the switch on the extension card)

### Color doesn't stay active on other tabs
1. This suggests the message passing between the content script and service worker failed
2. Check the console (F12) for errors
3. Try disabling/re-enabling the extension

### Widget position doesn't persist after reload
1. Hard refresh the page (Ctrl+Shift+R)
2. Verify the `widgetPosition` entry exists in `chrome://extensions/` → FocusPulse → Details → Storage

## 📝 Next Steps

Once you confirm Phase 1 is working reliably, we'll move to:

- **Phase 2**: Expanded dashboard with analytics, streak tracking, period views (Today/Week/Month/YTD/All-Time)
- **Phase 3**: Behavioral polish (animations, micro-toasts, encouraging nudges, end-of-day summaries)
- **Phase 4**: Export, settings, idle detection, and prepare for public release

## 📄 License

MIT License © 2025 Kauntey Acharya

FocusPulse is free and open-source software. You can use, modify, and distribute it freely under the terms of the MIT License.

## 🤝 Contributing

Feedback and contributions are welcome. Please feel free to open issues or PRs on the GitHub repository.

---

**Happy focusing! 🎯**
