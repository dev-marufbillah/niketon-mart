"use client";

import { useEffect } from "react";

// Multiple overlays may overlap while the mobile menu hands off to a drawer.
// Only the final release restores the value that existed before the first lock.
let locks = 0;
let originalOverflow = "";

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (locks === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = originalOverflow;
    };
  }, [locked]);
}
