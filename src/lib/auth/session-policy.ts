// Dependency-free so client components (the idle timer) and the server share
// the same numbers. Change them here only.

/** Signed out after this long without any activity in any tab. */
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

/** Hard limit on one session, however active: sign in again at least daily. */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

/** How often an active browser refreshes the server's last-seen time. Idle
 * time is therefore measured with up to this much slack. */
export const ACTIVITY_TOUCH_MS = 5 * 60 * 1000; // 5 minutes

/** The warning shown before an idle sign-out. */
export const IDLE_WARNING_MS = 60 * 1000; // 1 minute
