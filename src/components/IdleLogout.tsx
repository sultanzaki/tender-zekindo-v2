"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { keepSessionAlive, logoutIdle } from "@/lib/auth/actions";
import {
  ACTIVITY_TOUCH_MS,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
} from "@/lib/auth/session-policy";
import { Button } from "./ui/button";
import { Modal } from "./Modal";

/** A full page load, not router.push: it also discards the client router
 * cache, which still holds the tender data of pages already visited. */
function leave(reason: "idle" | "expired") {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?reason=${reason}`);
}

const STORAGE_KEY = "zk-last-activity";
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

/** Signs the user out after IDLE_TIMEOUT_MS without input in any tab, with a
 * one-minute warning. While the user is active, the server's last-seen time
 * is refreshed so its own idle check (src/lib/auth/session.ts) agrees. */
export function IdleLogout() {
  const lastActivity = useRef(0);
  const lastTouch = useRef(0);
  const warningRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const now = Date.now();
    lastActivity.current = now;
    lastTouch.current = now;
    let ended = false;

    const shared = () =>
      Math.max(lastActivity.current, Number(localStorage.getItem(STORAGE_KEY)) || 0);

    function heartbeat() {
      lastTouch.current = Date.now();
      keepSessionAlive()
        .then((alive) => {
          if (!alive && !ended) {
            ended = true;
            leave("expired");
          }
        })
        .catch(() => {});
    }

    function activity() {
      // Once the warning shows, only "Stay signed in" keeps the session.
      if (warningRef.current) return;
      const t = Date.now();
      if (t - lastActivity.current < 5000) return;
      lastActivity.current = t;
      localStorage.setItem(STORAGE_KEY, String(t));
      if (t - lastTouch.current > ACTIVITY_TOUCH_MS) heartbeat();
    }

    function check() {
      if (ended) return;
      const idle = Date.now() - shared();
      if (idle >= IDLE_TIMEOUT_MS) {
        ended = true;
        startTransition(async () => {
          try {
            await logoutIdle();
          } catch {
            leave("idle");
          }
        });
      } else if (idle >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS) {
        warningRef.current = true;
        setSecondsLeft(Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000));
      } else if (warningRef.current) {
        // Another tab was used: the warning no longer applies.
        warningRef.current = false;
        setSecondsLeft(null);
      }
    }

    for (const e of ACTIVITY_EVENTS)
      window.addEventListener(e, activity, { passive: true, capture: true });
    window.addEventListener("storage", check);
    const timer = window.setInterval(check, 1000);
    return () => {
      for (const e of ACTIVITY_EVENTS)
        window.removeEventListener(e, activity, { capture: true });
      window.removeEventListener("storage", check);
      window.clearInterval(timer);
    };
  }, []);

  function stay() {
    const t = Date.now();
    warningRef.current = false;
    lastActivity.current = t;
    lastTouch.current = t;
    localStorage.setItem(STORAGE_KEY, String(t));
    setSecondsLeft(null);
    keepSessionAlive()
      .then((alive) => {
        if (!alive) leave("expired");
      })
      .catch(() => {});
  }

  return (
    <Modal
      open={secondsLeft !== null}
      title="Still there?"
      onClose={stay}
    >
      <p className="text-sm" role="timer" aria-live="polite">
        For security, you will be signed out in {secondsLeft ?? 0} seconds
        because of inactivity.
      </p>
      <div className="dialog-actions">
        <Button
          variant="outline"
          onClick={() => startTransition(async () => logoutIdle())}
        >
          Sign out now
        </Button>
        <Button onClick={stay}>Stay signed in</Button>
      </div>
    </Modal>
  );
}
