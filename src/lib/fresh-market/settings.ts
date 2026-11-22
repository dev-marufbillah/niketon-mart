/**
 * Fresh market settings
 * ---------------------
 * Admin-owned knobs that shape how cut/cleaned products behave on the
 * storefront. Stored on the singleton settings document (`settings.freshMarket`)
 * and edited at `/admin/settings` → Fresh market. Missing values fall back to
 * `freshMarketDefaults`, so an older database keeps working.
 */

export type FreshMarketSettings = {
  /** Default character limit for a shopper's cutting/preparation instructions. */
  maxInstructionLength: number;
  /** Rendered under the preparation picker on the product page. */
  preparationNote: string;
  /** Rendered when a product is priced from an estimated weight. */
  weightDisclaimer: string;
  /** Whether cut, cleaned or minced items can be returned. */
  preparedItemsReturnable: boolean;
  /** Replacement text for the return policy when prepared items are exempt. */
  preparedReturnNote: string;
};

export const freshMarketDefaults: FreshMarketSettings = {
  maxInstructionLength: 160,
  preparationNote:
    "Our fishmongers and butchers clean, cut and pack your order the same morning. Preparation charges are added per kilogram or piece.",
  weightDisclaimer:
    "Fresh items are weighed before packing. A lower actual price may reduce the total; any increase requires your explicit approval before it is charged.",
  preparedItemsReturnable: false,
  preparedReturnNote:
    "Cut, cleaned or minced items cannot be resold and are not eligible for return unless the item was spoiled or the preparation was wrong.",
};
