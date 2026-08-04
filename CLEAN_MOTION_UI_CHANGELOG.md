# Clean Motion UI Upgrade

## What changed

- Replaced the paper/notebook-heavy visual style with a clean academic SaaS interface.
- Unified card, input, button, modal, sidebar, and dashboard styling.
- Added a Ctrl/Cmd + K command palette for quick module navigation.
- Added API request progress feedback, route transition feedback, active navigation rail, scroll-to-top control, and dashboard shortcuts.
- Added subtle spring entrances, card lift, button press, modal reveal, and progress animations using the bundled Motion engine.
- Reduced cursor glow, removed aggressive card tilt, and slowed decorative motion for a more realistic interface.
- Preserved all IDs, data attributes, backend routes, security, quiz proctoring, identity checks, RAG, PDF/PPT, and Phase 1–10 feature modules.
- Updated PWA cache to include the new clean UI assets.
- Added `npm run test:ui`.

## Why Motion instead of a full React migration?

The current frontend is a large vanilla-JavaScript application. Motion is the current name of the Framer Motion ecosystem and provides an official JavaScript animation engine. Using that local engine lets the project gain realistic motion without rewriting or risking the existing feature modules.

## Keyboard shortcut

- `Ctrl + K` / `Cmd + K`: open quick navigation.
- Arrow keys: move through results.
- Enter: open module.
- Escape: close.
