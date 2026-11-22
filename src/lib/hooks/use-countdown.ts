"use client";

import { useEffect, useState } from "react";

export type Countdown = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  ended: boolean;
};

const pad = (value: number) => String(Math.max(0, value)).padStart(2, "0");

/** A countdown runs only when an explicit, valid target is supplied. */
export function useCountdown(targetTime: number | null): Countdown | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (targetTime === null) return;
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [targetTime]);

  if (targetTime === null) return null;
  if (now === null) {
    return { days: "00", hours: "00", minutes: "00", seconds: "00", ended: false };
  }

  const diff = Math.max(0, targetTime - now);
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: pad(Math.floor(totalSeconds / 86400)),
    hours: pad(Math.floor((totalSeconds % 86400) / 3600)),
    minutes: pad(Math.floor((totalSeconds % 3600) / 60)),
    seconds: pad(totalSeconds % 60),
    ended: diff === 0,
  };
}
