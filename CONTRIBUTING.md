# Contributing to FocusPulse

Thank you for your interest in contributing to FocusPulse! This document outlines how to get started.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally: `git clone https://github.com/YOUR_USERNAME/FocusPulse.git`
3. **Create a feature branch**: `git checkout -b feature/your-feature-name`
4. **Load the extension locally** for testing (see README.md)

## Development Workflow

### Running Locally

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the FocusPulse folder
5. Make changes to the code
6. Click the refresh icon on the extension card to reload

### Testing

- Test across multiple websites to ensure the widget works everywhere
- Check that state persists across tab switches
- Verify keyboard shortcuts work (Alt+1-4 or MacCtrl+1-4)
- Test the dashboard and settings panel
- Ensure data exports work correctly

### Code Style

- Use consistent indentation (2 spaces)
- Write descriptive comments for complex logic
- Keep functions focused and small
- Use descriptive variable and function names

## Architecture

FocusPulse uses a **service worker + content script** architecture:

- **Service Worker** (`background/service-worker.js`): Single source of truth for state, persisted to `chrome.storage.local`
- **Content Scripts** (`content/*.js`): Render UI and sync with service worker
- **Analytics** (`background/analytics.js`): Compute metrics from session history

### Key Concepts

1. **State Persistence**: All state persists to `chrome.storage.local` and survives browser restart
2. **Tab Sync**: Messages broadcast to all tabs to keep widget in sync
3. **Session History**: Every color switch is logged with timestamp and duration for later analytics
4. **Non-Punitive Design**: Copy and interactions are always warm and encouraging

## Making Changes

### Adding a Feature

1. Identify which files need changes (widget, dashboard, service worker, etc.)
2. Make your changes
3. Test thoroughly on multiple sites
4. Commit with clear message: `git commit -m "Add feature: description"`
5. Push to your fork and create a Pull Request

### Common Tasks

**Adding a new color or state:**
- Update `manifest.json` if adding permissions
- Update service worker `DEFAULT_STATE`
- Add UI elements to `content/widget.js`
- Update dashboard analytics in `background/analytics.js`

**Adding a new dashboard metric:**
- Compute in `background/analytics.js`
- Add display in `content/dashboard.js`
- Show in the appropriate tabs (Today, Week, Month, etc.)

**Adding keyboard shortcuts:**
- Add to `manifest.json` under `commands`
- Handle in service worker `chrome.commands.onCommand.addListener`
- Broadcast changes to content scripts

## Behavioral Design Principles

FocusPulse is designed around these psychological principles:

1. **Goal-Gradient Effect**: Visible progress toward milestones nudges users forward
2. **Loss Aversion**: Warnings about "streak at risk" prevent setbacks
3. **Variable Reinforcement**: Random encouragement (not fixed timer) is more addictive
4. **Non-Punitive Framing**: Never shame users; frame challenges as opportunities
5. **Real-Time Feedback**: Immediate response to actions reinforces behavior
6. **Personal Bests**: Celebrate individual achievements, not just totals

When making changes, consider: **Does this encourage good focus habits and make the tool feel alive?**

## Submitting a Pull Request

1. **Test thoroughly** on multiple browsers and sites
2. **Write a clear PR description** explaining what and why
3. **Reference any issues** you're addressing
4. **Keep commits atomic** (one feature/fix per commit)
5. **Use present tense** ("Add feature" not "Added feature")

### PR Checklist

- [ ] Code follows the existing style
- [ ] Changes are tested on multiple websites
- [ ] No console errors or warnings
- [ ] Dark mode and light mode both work
- [ ] Mobile width (~375px) is tested
- [ ] Commit message is clear and descriptive

## Questions?

Open an issue on GitHub describing your question or suggestion. We're here to help!

## Philosophy

FocusPulse is built on the belief that **tracking focus is a behavioral tool, not a surveillance tool**. 

- You control what you log
- No tracking by us, only by you
- All data stays local on your machine
- The goal is to help you understand your patterns and build better habits

Contributions should maintain this philosophy: helpful, not judgmental; encouraging, not shaming; local, not cloud-dependent.

---

**Thank you for contributing to FocusPulse!** ✨
