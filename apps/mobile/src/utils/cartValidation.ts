import { CartAction, CartItem, MenuItem } from "../types";

export const MAX_LINE_QUANTITY = 99;
export const MAX_ADD_QUANTITY = 20;

export type CartSyncResult = {
  items: CartItem[];
  removed: string[];
  priceUpdated: string[];
};

export type ApplyActionsResult = {
  applied: number;
  warnings: string[];
};

export type CartMutationResult = {
  ok: boolean;
  message?: string;
};

function menuById(menu: MenuItem[]) {
  return new Map(menu.map((item) => [item.id, item]));
}

export function clampLineQuantity(quantity: number) {
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.floor(quantity)));
}

export function isValidCartAction(action: CartAction) {
  if (!action.itemId?.trim()) return false;
  if (!Number.isInteger(action.quantity) || action.quantity < 0) return false;
  if (action.type === "ADD" && action.quantity < 1) return false;
  if (action.quantity > MAX_LINE_QUANTITY) return false;
  return action.type === "ADD" || action.type === "REMOVE" || action.type === "UPDATE_QTY";
}

/** Normalize AI actions before applying to the local cart. */
export function sanitizeCartActions(actions: CartAction[], menu: MenuItem[]) {
  const byId = menuById(menu);
  const sanitized: CartAction[] = [];
  const warnings: string[] = [];

  for (const action of actions) {
    if (!isValidCartAction(action)) {
      warnings.push("Skipped an invalid cart update from the AI.");
      continue;
    }

    const menuItem = byId.get(action.itemId);
    if (!menuItem) {
      warnings.push(`"${action.itemId}" is not on the menu.`);
      continue;
    }
    if (!menuItem.available) {
      warnings.push(`${menuItem.name} is unavailable.`);
      continue;
    }

    if (action.type === "REMOVE") {
      sanitized.push({ type: "REMOVE", itemId: action.itemId, quantity: 0 });
      continue;
    }

    const quantity = clampLineQuantity(action.quantity);
    if (action.type === "ADD") {
      const addQty = Math.min(MAX_ADD_QUANTITY, Math.max(1, quantity));
      sanitized.push({ type: "ADD", itemId: action.itemId, quantity: addQty });
      continue;
    }

    if (quantity > 0) {
      sanitized.push({ type: "UPDATE_QTY", itemId: action.itemId, quantity });
    }
  }

  return { actions: sanitized, warnings };
}

/** Align cart lines with the latest menu (prices, availability). */
export function syncCartWithMenu(cartItems: CartItem[], menu: MenuItem[]): CartSyncResult {
  const byId = menuById(menu);
  const removed: string[] = [];
  const priceUpdated: string[] = [];
  const items: CartItem[] = [];

  for (const line of cartItems) {
    const fresh = byId.get(line.item.id);
    if (!fresh?.available) {
      removed.push(line.item.name);
      continue;
    }

    const quantity = clampLineQuantity(line.quantity);
    if (quantity <= 0) continue;

    if (fresh.price !== line.item.price) {
      priceUpdated.push(fresh.name);
    }

    items.push({ item: fresh, quantity });
  }

  return { items, removed, priceUpdated };
}

export function validateCartForCheckout(cartItems: CartItem[], menu: MenuItem[]) {
  const synced = syncCartWithMenu(cartItems, menu);
  if (synced.items.length === 0) {
    return {
      ok: false as const,
      message: "Your cart is empty or every item is unavailable. Please update your order.",
      ...synced,
    };
  }
  return { ok: true as const, ...synced };
}

export function formatSyncMessage(result: CartSyncResult) {
  const parts: string[] = [];
  if (result.removed.length > 0) {
    parts.push(`Removed unavailable: ${result.removed.join(", ")}`);
  }
  if (result.priceUpdated.length > 0) {
    parts.push(`Updated prices: ${result.priceUpdated.join(", ")}`);
  }
  return parts.join("\n");
}
