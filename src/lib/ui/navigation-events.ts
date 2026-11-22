/** Internal signal: a shop filter edits the current URL in place rather than
 * navigating to a new page. Only scroll behavior depends on this event. */
export const shopFilterNavigationEvent = "niketon:shop-filter-url";

export function markShopFilterNavigation(href: string): void {
  window.dispatchEvent(new CustomEvent(shopFilterNavigationEvent, { detail: href }));
}
