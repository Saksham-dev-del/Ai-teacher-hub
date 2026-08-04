# Face-absence grace updated to 2 seconds

- Default face-absence grace is now **2 seconds**.
- The teacher UI selects 2 seconds by default.
- Backend validation accepts a minimum of 2 seconds.
- Local face checks now run every 500 ms for faster cancellation.
- If no face is detected continuously for 2 seconds, the secure quiz sends a severe integrity event and cancels the attempt when auto-cancel is enabled.
