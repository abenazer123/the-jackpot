/**
 * HostPresenceProvider — session-scoped "Abe is / was online" timeline.
 *
 * One shared source of truth so every HostPresence indicator on the page
 * (hero, sticky header, peek card, booking funnel) shows the *same* state
 * at the *same* moment. Consumers read via `useHostPresence()`.
 *
 * --- Timeline (per visit, starting when this provider mounts) ----------
 *
 *    t=0 ........... WARMUP (3s) ............ first online window starts
 *    |  offline     |       online for ONLINE_SPAN (3 min)              |
 *    |  X min ago   |                                                    |
 *    (X frozen)     |                                                    |
 *                   |                                                    |
 *                   +---- then offline for OFFLINE_SPAN (4 min) ---------+
 *                        minutesAgo = 1, 2, 3, 4 (capped at 4)
 *                   +---- then online again for 3 min, offline 4 min… ---+
 *                        (repeats forever while the tab is open)
 *
 * The first offline window (before the warmup flip) shows a FROZEN random
 * 1..4 "minutes ago" to create the "he just came back" micro-moment — we
 * don't count up during this tiny 3-second window. All subsequent offline
 * windows count up 1→2→3→4 over their 4 minutes.
 *
 * We use setTimeout keyed to the next transition boundary (not a polling
 * interval) so there's exactly one re-render per state change — minute
 * ticks during offline, online→offline flips, offline→online flips.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const WARMUP_MS = 3_000;
const ONLINE_MS = 3 * 60_000;
const OFFLINE_MS = 4 * 60_000;
const CYCLE_MS = ONLINE_MS + OFFLINE_MS;
const MAX_MINUTES_AGO = 4;

export interface HostPresence {
  online: boolean;
  /** Minutes since Abe last went offline, capped at 4. 0 when online. */
  minutesAgo: number;
}

function computePresence(
  mountTime: number,
  now: number,
  initialOffset: number,
): HostPresence {
  const elapsed = now - mountTime;
  if (elapsed < WARMUP_MS) {
    return { online: false, minutesAgo: initialOffset };
  }
  const inCycle = (elapsed - WARMUP_MS) % CYCLE_MS;
  if (inCycle < ONLINE_MS) {
    return { online: true, minutesAgo: 0 };
  }
  const offlineElapsed = inCycle - ONLINE_MS;
  return {
    online: false,
    minutesAgo: Math.min(
      MAX_MINUTES_AGO,
      1 + Math.floor(offlineElapsed / 60_000),
    ),
  };
}

/** Milliseconds until the next state change relative to mountTime. */
function msUntilNextTransition(mountTime: number, now: number): number {
  const elapsed = now - mountTime;
  if (elapsed < WARMUP_MS) {
    return WARMUP_MS - elapsed;
  }
  const inCycle = (elapsed - WARMUP_MS) % CYCLE_MS;
  if (inCycle < ONLINE_MS) {
    // Next boundary: online → offline.
    return ONLINE_MS - inCycle;
  }
  // Inside offline window — next boundary is either the next minute tick
  // (counter bumps) or the offline → online flip, whichever comes first.
  const offlineElapsed = inCycle - ONLINE_MS;
  const msToNextMinute = 60_000 - (offlineElapsed % 60_000);
  const msToOnline = OFFLINE_MS - offlineElapsed;
  return Math.min(msToNextMinute, msToOnline);
}

const PresenceContext = createContext<HostPresence>({
  online: false,
  minutesAgo: 1,
});

export function HostPresenceProvider({ children }: { children: ReactNode }) {
  // Both `mountTime` and `initialOffset` depend on non-deterministic values
  // (Date.now / Math.random). If we seeded them in useState initializers they
  // would evaluate differently on the server and on first client paint,
  // producing a hydration mismatch. Instead we start as `null` — SSR and
  // first client paint render the same deterministic fallback below — and
  // initialize once on client mount via useEffect.
  const [mountTime, setMountTime] = useState<number | null>(null);
  const [initialOffset, setInitialOffset] = useState<number | null>(null);
  const [tickCount, setTickCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setMountTime(Date.now());
    setInitialOffset(1 + Math.floor(Math.random() * MAX_MINUTES_AGO));
  }, []);

  useEffect(() => {
    if (mountTime == null) return;
    const schedule = () => {
      const delay = msUntilNextTransition(mountTime, Date.now());
      timerRef.current = window.setTimeout(() => {
        setTickCount((n) => n + 1);
        schedule();
      }, Math.max(100, delay));
    };
    schedule();
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [mountTime]);

  const value = useMemo(() => {
    // Deterministic fallback for SSR + pre-mount client paint (HYDRATION-SAFE).
    if (mountTime == null || initialOffset == null) {
      return { online: false, minutesAgo: 2 };
    }
    return computePresence(mountTime, Date.now(), initialOffset);
    // tickCount changes each time we cross a boundary, forcing a recompute
    // even though Date.now() isn't React-observable by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountTime, initialOffset, tickCount]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function useHostPresence(): HostPresence {
  return useContext(PresenceContext);
}
