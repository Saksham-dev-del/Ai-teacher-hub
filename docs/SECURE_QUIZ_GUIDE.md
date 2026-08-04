# Secure Quiz & Resource View Upgrade

## Added
- Camera permission and local preview before a proctored quiz starts.
- Fullscreen enforcement, focus/tab monitoring, clipboard/context-menu/shortcut blocking.
- Camera continuity and obstruction checks; optional browser-local face presence where supported.
- Server-side integrity event log, risk score, counters and automatic cancellation.
- Teacher attempt report with cancellation reason and integrity counters.
- Strict PDF/PNG/JPG extension, MIME and magic-byte validation.
- Reliable Resource Hub View that fetches the complete resource from MongoDB and shows visible errors instead of an empty modal.

## Privacy
Camera footage is not uploaded or recorded. The browser only performs local continuity checks. The database stores event types, timestamps, counters and cancellation reasons.

## Important limitation
Normal websites cannot enumerate or disable installed browser extensions. For high-stakes exams use a managed browser, kiosk mode or institutional lockdown browser. This project adds the strongest controls available to a standard web application without invasive surveillance.
