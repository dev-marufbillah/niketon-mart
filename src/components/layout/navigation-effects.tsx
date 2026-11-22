"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store/store-provider";
import { shopFilterNavigationEvent } from "@/lib/ui/navigation-events";

function routeKey(url: URL): string {
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

const scrollStateKey = "__niketonStorefrontScroll";
type ScrollPosition = { x: number; y: number };
type HistoryDestination = { route: string; position: ScrollPosition | null };

function readScrollPosition(state: unknown): ScrollPosition | null {
  if (!state || typeof state !== "object") return null;
  const position = (state as Record<string, unknown>)[scrollStateKey];
  if (!position || typeof position !== "object") return null;
  const { x, y } = position as Record<string, unknown>;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
    ? { x: Math.max(0, x), y: Math.max(0, y) } : null;
}

/** Each browser history entry owns its scroll position. Retain Next's private
 * state instead of replacing it; never put customer information in history. */
function saveScrollPosition(): void {
  try {
    window.history.replaceState({ ...window.history.state, [scrollStateKey]: { x: window.scrollX, y: window.scrollY } }, "", window.location.href);
  } catch {
    // If a browser disallows history writes, its native restoration is better
    // than breaking navigation. This state is only a UX enhancement.
  }
}

/** Keep persistent drawers and page scroll in sync with storefront navigation.
 * A new pathname or query is normally a navigation, including router.push from
 * the search bar. Filter controls explicitly mark their in-place URL edits. */
export function NavigationEffects() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const currentRoute = `${pathname}${search ? `?${search}` : ""}`;
  const previousRoute = useRef(currentRoute);
  const historyDestination = useRef<HistoryDestination | null>(null);
  const filterDestination = useRef<string | null>(null);
  const { setCartOpen, setWishlistOpen } = useStore();

  useEffect(() => {
    let saveTimer: number | undefined;
    const cancelSave = () => { if (saveTimer !== undefined) window.clearTimeout(saveTimer); saveTimer = undefined; };
    const onScroll = () => {
      cancelSave();
      saveTimer = window.setTimeout(() => {
        if (!historyDestination.current) saveScrollPosition();
      }, 100);
    };
    const onPopState = (event: PopStateEvent) => {
      cancelSave();
      // Native scroll restoration may happen while the old page is still on
      // screen. Save the target entry's position, then restore it once the new
      // content commits, avoiding a scroll-anchor jump when its height changes.
      historyDestination.current = { route: routeKey(new URL(window.location.href)), position: readScrollPosition(event.state) };
      filterDestination.current = null;
    };
    const onFilterUrl = (event: Event) => {
      const href = (event as CustomEvent<unknown>).detail;
      if (typeof href !== "string") return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin && !url.hash) filterDestination.current = routeKey(url);
      } catch {
        filterDestination.current = null;
      }
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      cancelSave();
      // A link or button can navigate before the debounced scroll event runs.
      // Commit the outgoing entry's actual position before Next pushes a route.
      historyDestination.current = null;
      filterDestination.current = null;
      saveScrollPosition();
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const rawHref = link.getAttribute("href") ?? "";
      if (rawHref.startsWith("#")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash) return;
      if (routeKey(url) === routeKey(new URL(window.location.href))) {
        // The same-page link has no route transition to trigger the effect.
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        saveScrollPosition();
      }
      // Do not scroll a different destination here: Next must save the old
      // history position first, and the old content must remain in place.
    };
    const onSubmit = () => {
      cancelSave();
      historyDestination.current = null;
      filterDestination.current = null;
      saveScrollPosition();
    };
    saveScrollPosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener(shopFilterNavigationEvent, onFilterUrl);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      cancelSave();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(shopFilterNavigationEvent, onFilterUrl);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // React commits the new page before paint. Reset route transitions here, not
  // after an effect frame, so a previous footer position is not shown first.
  useLayoutEffect(() => {
    const before = previousRoute.current;
    if (before === currentRoute) return;
    previousRoute.current = currentRoute;
    const pathChanged = before.split("?")[0] !== pathname;
    if (pathChanged) {
      setCartOpen(false);
      setWishlistOpen(false);
    }
    const traversal = historyDestination.current;
    const fromHistory = traversal?.route === currentRoute && routeKey(new URL(window.location.href)) === currentRoute;
    const fromFilter = filterDestination.current === currentRoute;
    historyDestination.current = null;
    filterDestination.current = null;
    if (window.location.hash) return; // Let deliberate fragment navigation win.
    if (fromHistory && traversal.position) {
      // Next can update the URL before its destination content has streamed.
      // Keep anchoring paused until that content changes and settles; otherwise
      // a taller replacement page shifts a correctly restored position down.
      const root = document.documentElement;
      const previousAnchor = root.style.overflowAnchor;
      root.style.overflowAnchor = "none";
      window.scrollTo({ top: traversal.position.y, left: traversal.position.x, behavior: "instant" });
      let restored = false;
      let settleTimer: number | undefined;
      const restoreAnchor = () => {
        if (restored) return;
        restored = true;
        root.style.overflowAnchor = previousAnchor;
        observer.disconnect();
      };
      const observer = new MutationObserver(() => {
        if (settleTimer !== undefined) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(restoreAnchor, 300);
      });
      const main = document.querySelector("main");
      if (main) observer.observe(main, { childList: true, subtree: true });
      // If nothing changes (or a request fails), never leave the style pinned.
      const fallback = window.setTimeout(restoreAnchor, 5000);
      return () => {
        if (settleTimer !== undefined) window.clearTimeout(settleTimer);
        window.clearTimeout(fallback);
        restoreAnchor();
      };
    } else if (!fromHistory && !fromFilter) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      // A newly-pushed entry may inherit custom state from Next. Give this
      // entry its own top position, without altering the outgoing entry.
      saveScrollPosition();
    }
  }, [currentRoute, pathname, setCartOpen, setWishlistOpen]);

  return null;
}
