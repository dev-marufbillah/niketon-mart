"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartLine } from "@/lib/types/domain";
import { useRouter } from "next/navigation";
import { registrationHref } from "@/lib/auth/return-to";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { cartLineKey, defaultSelection, unitPrice, unitStock, linePreparationCharge } from "@/lib/store/cart-line";
import { loadWishlistAction, syncWishlistAction } from "@/lib/actions/wishlist";

/**
 * Cart / wishlist / recently-viewed store.
 *
 * Deliberately shaped like a server-cart client: every mutation goes through a
 * single reducer so it can later be mirrored by a `/api/cart` call or optimistic
 * server action without touching UI components.
 */

/** A coupon that passed server validation on the cart page. */
export type AppliedCoupon = {
  code: string;
  description?: string;
  discount: number;
  freeShipping: boolean;
};

type State = {
  cart: CartLine[];
  wishlist: string[];
  /** productId → ISO date the shopper saved it (shown as "Date added"). */
  wishlistMeta: Record<string, string>;
  recentlyViewed: string[];
  coupon: AppliedCoupon | null;
};

type Action =
  | {
      type: "cart/add";
      productId: string;
      quantity: number;
      variantLabel?: string;
      variantPrice?: number;
      preparation?: CartLine["preparation"];
    }
  | { type: "cart/remove"; key: string }
  | { type: "cart/quantity"; key: string; quantity: number }
  | { type: "cart/clear" }
  | { type: "coupon/apply"; coupon: AppliedCoupon }
  | { type: "coupon/clear" }
  | { type: "wishlist/toggle"; productId: string }
  | { type: "wishlist/set"; ids: string[]; meta: Record<string, string> }
  | { type: "wishlist/clear" }
  | { type: "wishlist/meta"; meta: Record<string, string> }
  | { type: "recently/push"; productId: string }
  | { type: "hydrate"; state: State };

const initialState: State = {
  cart: [],
  wishlist: [],
  wishlistMeta: {},
  recentlyViewed: [],
  coupon: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "cart/add": {
      const key = cartLineKey(action);
      const existing = state.cart.find((line) => cartLineKey(line) === key);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((line) =>
            cartLineKey(line) === key
              ? { ...line, quantity: line.quantity + action.quantity }
              : line,
          ),
        };
      }
      return {
        ...state,
        cart: [
          ...state.cart,
          {
            productId: action.productId,
            quantity: action.quantity,
            variantLabel: action.variantLabel,
            variantPrice: action.variantPrice,
            preparation: action.preparation,
          },
        ],
      };
    }
    case "cart/remove":
      return {
        ...state,
        cart: state.cart.filter((line) => cartLineKey(line) !== action.key),
      };
    case "cart/quantity":
      return {
        ...state,
        cart: state.cart
          .map((line) =>
            cartLineKey(line) === action.key
              ? { ...line, quantity: Math.max(1, action.quantity) }
              : line,
          )
          .filter((line) => line.quantity > 0),
      };
    case "cart/clear":
      // An emptied basket can never keep a coupon: the discount would be
      // stranded on a zero subtotal.
      return { ...state, cart: [], coupon: null };
    case "coupon/apply":
      return { ...state, coupon: action.coupon };
    case "coupon/clear":
      return { ...state, coupon: null };
    case "wishlist/toggle": {
      const saved = state.wishlist.includes(action.productId);
      const meta = { ...state.wishlistMeta };
      if (saved) delete meta[action.productId];
      else meta[action.productId] = new Date().toISOString();
      return {
        ...state,
        wishlist: saved
          ? state.wishlist.filter((id) => id !== action.productId)
          : [...state.wishlist, action.productId],
        wishlistMeta: meta,
      };
    }
    case "wishlist/set":
      return { ...state, wishlist: action.ids, wishlistMeta: action.meta };
    case "wishlist/clear":
      return { ...state, wishlist: [], wishlistMeta: {} };
    case "wishlist/meta":
      return { ...state, wishlistMeta: action.meta };
    case "recently/push":
      return {
        ...state,
        recentlyViewed: [
          action.productId,
          ...state.recentlyViewed.filter((id) => id !== action.productId),
        ].slice(0, 6),
      };
    default:
      return state;
  }
}

type Toast = { id: number; title: string; description?: string; tone: "success" | "info" };

type StoreContextValue = {
  isSignedIn: boolean;
  isAdmin: boolean;
  requireShopping: (next: string) => boolean;
  wishlistReady: boolean;
  wishlistError: string | null;
  retryWishlist: () => void;
  cart: CartLine[];
  wishlist: string[];
  /** productId → ISO date saved, for the wishlist table. */
  wishlistMeta: Record<string, string>;
  /** Server list that backs this browser's wishlist (null until the first save). */
  wishlistToken: string | null;
  /** True while a wishlist change is being written to the database. */
  wishlistSaving: boolean;
  clearWishlist: () => void;
  /** Adopts a shared/new list into this browser and saves it. */
  importWishlist: (ids: string[]) => boolean;
  recentlyViewed: string[];
  cartCount: number;
  subtotal: number;
  cartOpen: boolean;
  wishlistOpen: boolean;
  isHydrated: boolean;
  toasts: Toast[];
  coupon: AppliedCoupon | null;
  applyCoupon: (coupon: AppliedCoupon) => void;
  clearCoupon: () => void;
  addToCart: (
    productId: string,
    quantity?: number,
    variantLabel?: string,
    preparation?: CartLine["preparation"],
  ) => Promise<void> | void;
  removeFromCart: (line: Pick<CartLine, "productId" | "variantLabel" | "preparation">) => void;
  updateQuantity: (
    line: Pick<CartLine, "productId" | "variantLabel" | "preparation">,
    quantity: number,
  ) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  pushRecentlyViewed: (productId: string) => void;
  setCartOpen: (open: boolean) => void;
  setWishlistOpen: (open: boolean) => void;
  dismissToast: (id: number) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);
// The old unscoped storage keys are deliberately left untouched. Silently
// adopting them would attach a previous browser user's cart/list to a new login.
const STORAGE_KEY = "grocery.store.v2:";
const AUTH_MARKER_KEY = "nm.active-shopper.v1";

/** Tolerates every older shape that has ever been written to this key. */
function normalisePersisted(parsed: Partial<State> | null): State {
  return {
    cart: Array.isArray(parsed?.cart) ? parsed!.cart : [],
    wishlist: Array.isArray(parsed?.wishlist) ? parsed!.wishlist : [],
    wishlistMeta:
      parsed?.wishlistMeta && typeof parsed.wishlistMeta === "object" ? parsed.wishlistMeta : {},
    recentlyViewed: Array.isArray(parsed?.recentlyViewed) ? parsed!.recentlyViewed : [],
    coupon: parsed?.coupon && typeof parsed.coupon.code === "string" ? parsed.coupon : null,
  };
}

export function StoreProvider({ children, shopperId, isAdmin }: { children: ReactNode; shopperId: string | null; isAdmin: boolean }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [cartOpen, setCartOpenState] = useState(false);
  const [wishlistOpen, setWishlistOpenState] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isHydrated, setHydrated] = useState(false);
  const [wishlistReady, setWishlistReady] = useState(false);
  const [wishlistShareToken, setWishlistShareToken] = useState<string | null>(null);
  const [wishlistSaving, setWishlistSaving] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const toastId = useRef(0);
  const lastPushed = useRef<string | null>(null);
  const saveInFlight = useRef(false);
  const { getProduct } = useCatalogue();
  const router = useRouter();
  const storageKey = shopperId ? `${STORAGE_KEY}${shopperId}` : null;

  const requireShopping = useCallback((next: string) => {
    if (shopperId) return true;
    setCartOpenState(false);
    setWishlistOpenState(false);
    router.push(registrationHref(next));
    return false;
  }, [router, shopperId]);

  const setCartOpen = useCallback((open: boolean) => {
    if (open && !requireShopping("/cart")) return;
    setCartOpenState(open);
  }, [requireShopping]);
  const setWishlistOpen = useCallback((open: boolean) => {
    if (open && !requireShopping("/wishlist")) return;
    setWishlistOpenState(open);
  }, [requireShopping]);

  // Restore only this account's browser-local cart. Wishlist always comes from
  // the server; legacy unscoped guest state is preserved but never auto-claimed.
  useEffect(() => {
    try {
      const raw = storageKey ? window.localStorage.getItem(storageKey) : null;
      if (raw) {
        const saved = normalisePersisted(JSON.parse(raw) as Partial<State>);
        dispatch({ type: "hydrate", state: { ...saved, wishlist: [], wishlistMeta: {} } });
      }
    } catch {
      /* corrupted or blocked storage — start clean */
    }
    queueMicrotask(() => setHydrated(true));
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...state, wishlist: [], wishlistMeta: {} }));
    } catch {
      /* storage full or blocked */
    }
  }, [state, isHydrated, storageKey]);

  // Keep local carts in step across tabs of the same account. Never hydrate a
  // different account's key or replace a server-backed wishlist from storage.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!storageKey || event.key !== storageKey || !event.newValue) return;
      try {
        const saved = normalisePersisted(JSON.parse(event.newValue) as Partial<State>);
        dispatch({ type: "hydrate", state: { ...saved, wishlist: state.wishlist, wishlistMeta: state.wishlistMeta } });
      } catch { /* malformed payload */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, state.wishlist, state.wishlistMeta]);

  // A login/logout in another tab changes the site's shared cookie. Reload this
  // tab so an old identity, drawer or admin shortcut is not left on screen.
  useEffect(() => {
    const marker = `${shopperId ?? "guest"}:${isAdmin ? "staff" : "customer"}`;
    try { window.localStorage.setItem(AUTH_MARKER_KEY, marker); } catch { /* optional storage */ }
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_MARKER_KEY && event.newValue && event.newValue !== marker) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [shopperId, isAdmin]);

  // Fetch the authoritative account list before allowing edits. A load failure
  // remains visible and never overwrites the remote list with an empty one.
  useEffect(() => {
    if (!isHydrated || !shopperId) return;
    let active = true;
    void (async () => {
      try {
        const result = await loadWishlistAction(shopperId);
        if (!active) return;
        if (!result.ok) {
          setWishlistError(result.error);
          return;
        }
        const meta: Record<string, string> = {};
        for (const item of result.items) meta[item.productId] = item.addedAt;
        lastPushed.current = result.items.map((item) => `${item.productId}:${item.addedAt}`).join("|");
        dispatch({ type: "wishlist/set", ids: result.items.map((item) => item.productId), meta });
        setWishlistShareToken(result.shareToken);
        setWishlistError(null);
        setWishlistReady(true);
      } catch {
        if (active) setWishlistError("We could not load your wishlist. Check your connection and try again.");
      }
    })();
    return () => { active = false; };
  }, [shopperId, isHydrated, loadAttempt]);

  const wishlistSignature = useMemo(
    () => state.wishlist.map((id) => `${id}:${state.wishlistMeta[id] ?? ""}`).join("|"),
    [state.wishlist, state.wishlistMeta],
  );

  // Debounce and serialise writes, so an older response cannot overwrite a
  // newer click. Each action checks the session and rejects stale-tab ids.
  useEffect(() => {
    if (!shopperId || !isHydrated || !wishlistReady || lastPushed.current === wishlistSignature) return;
    const timer = window.setTimeout(async () => {
      if (saveInFlight.current) return;
      saveInFlight.current = true;
      setWishlistSaving(true);
      try {
        const result = await syncWishlistAction({
          expectedShopperId: shopperId,
          items: state.wishlist.map((productId) => ({ productId, addedAt: state.wishlistMeta[productId] })),
        });
        if (!result.ok) {
          setWishlistError(result.error);
          return;
        }
        lastPushed.current = wishlistSignature;
        setWishlistShareToken(result.shareToken);
        setWishlistError(null);
        // If another click happened during the request, run the effect again.
        setSaveAttempt((value) => value + 1);
      } catch {
        setWishlistError("We could not save your wishlist. Check your connection and try again.");
      } finally {
        saveInFlight.current = false;
        setWishlistSaving(false);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [shopperId, isHydrated, wishlistReady, wishlistSignature, state.wishlist, state.wishlistMeta, saveAttempt]);

  const retryWishlist = useCallback(() => {
    setWishlistError(null);
    if (wishlistReady) setSaveAttempt((value) => value + 1);
    else setLoadAttempt((value) => value + 1);
  }, [wishlistReady]);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  /**
   * Cart mutations are stock-aware: the catalogue is the single source of truth
   * for availability, so a stale UI can never add more units than exist.
   */
  const addToCart = useCallback(
    (
      productId: string,
      quantity = 1,
      selectedLabel?: string,
      preparation?: CartLine["preparation"],
    ) => {
      const product = getProduct(productId);
      if (!product) return;
      if (!requireShopping(`/product/${encodeURIComponent(product.slug)}`)) return;

      // Grid "Add" buttons use the default variation so the cart always shows
      // exactly what is being bought and at which price.
      const variantLabel = selectedLabel ?? defaultSelection(product)?.value;

      // Variations may have their own stock; otherwise the product stock applies.
      const stock = unitStock(product, variantLabel);
      const optionName = variantLabel ? `${product.name} (${variantLabel})` : product.name;

      if (stock === 0) {
        pushToast({
          title: `${optionName} is out of stock`,
          description: "We'll restock it soon — try another option.",
          tone: "info",
        });
        return;
      }

      // Preparation is part of the line identity, so two cuts of the same fish
      // are two rows and each one is capped by the same stock.
      const lineIdentity = cartLineKey({ productId, variantLabel, preparation });
      const inCart =
        state.cart
          .filter((line) => cartLineKey(line) === lineIdentity)
          .reduce((sum, line) => sum + line.quantity, 0) || 0;
      const allowed = Math.min(quantity, stock - inCart);

      if (allowed <= 0) {
        pushToast({
          title: "Stock limit reached",
          description: `Only ${stock} available for this option.`,
          tone: "info",
        });
        return;
      }

      const price = unitPrice(product, variantLabel);
      dispatch({
        type: "cart/add",
        productId,
        quantity: allowed,
        variantLabel,
        variantPrice: price,
        preparation,
      });
      pushToast({
        title: `${product.name} added to cart`,
        description: `${allowed} × ${variantLabel ?? product.unit}${
          preparation?.options.length ? ` · ${preparation.options.map((option) => option.label).join(", ")}` : ""
        }`,
        tone: "success",
      });
    },
    [getProduct, pushToast, state.cart, requireShopping],
  );

  const removeFromCart = useCallback((line: Pick<CartLine, "productId" | "variantLabel" | "preparation">) => {
    dispatch({ type: "cart/remove", key: cartLineKey(line) });
  }, []);

  const updateQuantity = useCallback(
    (line: Pick<CartLine, "productId" | "variantLabel" | "preparation">, quantity: number) => {
      const product = getProduct(line.productId);
      const stock = product ? unitStock(product, line.variantLabel) : 0;
      const next = Math.max(0, Math.min(quantity, stock));
      dispatch({ type: "cart/quantity", key: cartLineKey(line), quantity: next });
    },
    [getProduct],
  );

  const clearCart = useCallback(() => dispatch({ type: "cart/clear" }), []);

  const applyCoupon = useCallback((coupon: AppliedCoupon) => {
    dispatch({ type: "coupon/apply", coupon });
  }, []);

  const clearCoupon = useCallback(() => dispatch({ type: "coupon/clear" }), []);

  const toggleWishlist = useCallback(
    (productId: string) => {
      const product = getProduct(productId);
      if (!product || !requireShopping(`/product/${encodeURIComponent(product.slug)}`)) return;
      if (!wishlistReady) {
        pushToast({ title: "Wishlist is not ready", description: wishlistError ?? "Please wait for your saved products to load.", tone: "info" });
        return;
      }
      const wasSaved = state.wishlist.includes(productId);
      dispatch({ type: "wishlist/toggle", productId });
      if (product) {
        pushToast({
          title: wasSaved ? "Removed from wishlist" : "Saved to wishlist",
          description: product.name,
          tone: wasSaved ? "info" : "success",
        });
      }
    },
    [getProduct, pushToast, state.wishlist, requireShopping, wishlistReady, wishlistError],
  );

  const clearWishlist = useCallback(() => {
    if (!requireShopping("/wishlist") || !wishlistReady) return;
    dispatch({ type: "wishlist/clear" });
  }, [requireShopping, wishlistReady]);

  /** Imports a shared list into the authenticated account. */
  const importWishlist = useCallback((ids: string[]) => {
    if (!requireShopping("/wishlist") || !wishlistReady) {
      if (shopperId) pushToast({ title: "Wishlist is not ready", description: wishlistError ?? "Please wait for your saved products to load.", tone: "info" });
      return false;
    }
    const meta: Record<string, string> = {};
    const stamp = new Date().toISOString();
    for (const id of ids) meta[id] = stamp;
    dispatch({ type: "wishlist/set", ids: Array.from(new Set(ids)), meta });
    return true;
  }, [requireShopping, wishlistReady, shopperId, pushToast, wishlistError]);

  const pushRecentlyViewed = useCallback((productId: string) => {
    if (shopperId) dispatch({ type: "recently/push", productId });
  }, [shopperId]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const cartCount = useMemo(
    () => state.cart.reduce((total, line) => total + line.quantity, 0),
    [state.cart],
  );

  const subtotal = useMemo(
    () =>
      state.cart.reduce((total, line) => {
        const product = getProduct(line.productId);
        // Live catalogue price wins over the snapshot taken when the line was
        // added, so an admin price change is reflected without a re-add.
        const unit = product
          ? unitPrice(product, line.variantLabel)
          : (line.variantPrice ?? 0);
        return total + Math.round((unit + linePreparationCharge(line)) * 100) * line.quantity;
      }, 0) / 100,
    [state.cart, getProduct],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      isSignedIn: Boolean(shopperId),
      isAdmin,
      requireShopping,
      wishlistReady,
      wishlistError,
      retryWishlist,
      cart: state.cart,
      wishlist: state.wishlist,
      wishlistMeta: state.wishlistMeta,
      // Only the read-only share token is exposed to UI components.
      wishlistToken: wishlistShareToken,
      wishlistSaving,
      clearWishlist,
      importWishlist,
      recentlyViewed: state.recentlyViewed,
      cartCount,
      subtotal,
      cartOpen,
      wishlistOpen,
      isHydrated,
      toasts,
      coupon: state.coupon,
      applyCoupon,
      clearCoupon,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleWishlist,
      pushRecentlyViewed,
      setCartOpen,
      setWishlistOpen,
      dismissToast,
    }),
    [
      shopperId,
      isAdmin,
      requireShopping,
      wishlistReady,
      wishlistError,
      retryWishlist,
      state,
      cartCount,
      subtotal,
      cartOpen,
      wishlistOpen,
      isHydrated,
      toasts,
      wishlistShareToken,
      wishlistSaving,
      clearWishlist,
      importWishlist,
      applyCoupon,
      clearCoupon,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleWishlist,
      pushRecentlyViewed,
      setCartOpen,
      setWishlistOpen,
      dismissToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside <StoreProvider>");
  return context;
}
