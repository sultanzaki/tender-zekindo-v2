import { Button } from "./ui/button";

import { TRACKS, TRACK_LABELS, type Track } from "@/lib/types";
import styles from "./TrackSwitch.module.css";

export function TrackSwitch({
  current,
  basePath,
  params = {},
  param = "track",
}: {
  current: Track | "all";
  /** e.g. "/tenders" — needed to build a clean URL when no other filter is set. */
  basePath: string;
  params?: Record<string, string | undefined>;
  param?: string;
}) {
  return (
    <nav className={styles.bar} aria-label="Upstream or downstream">
      <div className={styles.group}>
        {(["all", ...TRACKS] as const).map((track) => {
          const query = new URLSearchParams();
          for (const [key, value] of Object.entries(params)) {
            if (value && key !== param) query.set(key, value);
          }
          if (track !== "upstream") query.set(param, track);
          const qs = query.toString();
          const active = track === current;
          return (
            <Button
              key={track}
              asChild
              size="sm"
              variant={active ? "secondary" : "ghost"}
            >
              <a
                href={qs ? `${basePath}?${qs}` : basePath}
                onClick={(event) => {
                  if (
                    event.button ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  if (!active)
                    window.history.pushState(
                      null,
                      "",
                      event.currentTarget.href,
                    );
                }}
                className={active ? styles.active : styles.item}
                aria-current={active ? "page" : undefined}
              >
                {track === "all" ? "All tenders" : TRACK_LABELS[track]}
              </a>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
