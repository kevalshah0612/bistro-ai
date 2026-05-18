import { LayoutAnimation } from "react-native";
import { create } from "zustand";
import { CartAction, CartItem, MenuItem } from "../types";
import {
  ApplyActionsResult,
  CartMutationResult,
  CartSyncResult,
  MAX_ADD_QUANTITY,
  MAX_LINE_QUANTITY,
  clampLineQuantity,
  sanitizeCartActions,
  syncCartWithMenu,
} from "../utils/cartValidation";

type CartStore = {
  items: CartItem[];
  lastSyncResult: CartSyncResult | null;
  addItem: (item: MenuItem, quantity?: number) => CartMutationResult;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => CartMutationResult;
  clearCart: () => void;
  syncWithMenu: (menu: MenuItem[]) => CartSyncResult;
  applyActions: (actions: CartAction[], menu: MenuItem[]) => ApplyActionsResult;
  totalItems: () => number;
  totalPrice: () => number;
};

function animateCartChange() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  lastSyncResult: null,

  addItem: (item, quantity = 1) => {
    if (!item.available) {
      return { ok: false, message: `${item.name} is not available right now.` };
    }

    const delta = Math.min(MAX_ADD_QUANTITY, Math.max(1, clampLineQuantity(quantity)));
    const existing = get().items.find((line) => line.item.id === item.id);
    const nextQty = (existing?.quantity ?? 0) + delta;

    if (nextQty > MAX_LINE_QUANTITY) {
      return {
        ok: false,
        message: `Maximum ${MAX_LINE_QUANTITY} per item (${item.name}).`,
      };
    }

    animateCartChange();
    set((state) => {
      if (existing) {
        return {
          items: state.items.map((line) =>
            line.item.id === item.id
              ? { ...line, item, quantity: line.quantity + delta }
              : line
          ),
        };
      }
      return { items: [...state.items, { item, quantity: delta }] };
    });

    return { ok: true };
  },

  removeItem: (itemId) => {
    animateCartChange();
    set((state) => ({
      items: state.items.filter((line) => line.item.id !== itemId),
    }));
  },

  updateQuantity: (itemId, quantity) => {
    const qty = clampLineQuantity(quantity);
    const line = get().items.find((entry) => entry.item.id === itemId);

    if (!line) {
      return { ok: false, message: "Item is not in your cart." };
    }
    if (!line.item.available) {
      get().removeItem(itemId);
      return { ok: false, message: `${line.item.name} is no longer available.` };
    }
    if (qty > MAX_LINE_QUANTITY) {
      return { ok: false, message: `Maximum ${MAX_LINE_QUANTITY} per item.` };
    }

    animateCartChange();
    set((state) => {
      if (qty <= 0) {
        return { items: state.items.filter((entry) => entry.item.id !== itemId) };
      }
      return {
        items: state.items.map((entry) =>
          entry.item.id === itemId ? { ...entry, quantity: qty } : entry
        ),
      };
    });

    return { ok: true };
  },

  clearCart: () => {
    animateCartChange();
    set({ items: [], lastSyncResult: null });
  },

  syncWithMenu: (menu) => {
    const result = syncCartWithMenu(get().items, menu);
    const changed =
      result.removed.length > 0 ||
      result.priceUpdated.length > 0 ||
      result.items.length !== get().items.length;

    if (changed) {
      animateCartChange();
      set({ items: result.items, lastSyncResult: result });
    } else {
      set({ lastSyncResult: result });
    }

    return result;
  },

  applyActions: (actions, menu) => {
    const { actions: sanitized, warnings: sanitizeWarnings } = sanitizeCartActions(actions, menu);
    const warnings = [...sanitizeWarnings];
    let applied = 0;

    sanitized.forEach((action) => {
      const menuItem = menu.find((entry) => entry.id === action.itemId);
      if (!menuItem?.available) return;

      if (action.type === "ADD") {
        const result = get().addItem(menuItem, action.quantity);
        if (result.ok) applied += 1;
        else if (result.message) warnings.push(result.message);
        return;
      }

      if (action.type === "REMOVE") {
        if (get().items.some((line) => line.item.id === action.itemId)) {
          get().removeItem(action.itemId);
          applied += 1;
        }
        return;
      }

      const inCart = get().items.some((line) => line.item.id === action.itemId);
      if (!inCart && action.quantity > 0) {
        const result = get().addItem(menuItem, action.quantity);
        if (result.ok) applied += 1;
        else if (result.message) warnings.push(result.message);
        return;
      }

      const result = get().updateQuantity(action.itemId, action.quantity);
      if (result.ok) applied += 1;
      else if (result.message) warnings.push(result.message);
    });

    get().syncWithMenu(menu);

    return { applied, warnings: [...new Set(warnings)] };
  },

  totalItems: () => get().items.reduce((sum, line) => sum + line.quantity, 0),

  totalPrice: () =>
    Math.round(
      get().items.reduce((sum, line) => sum + line.item.price * line.quantity, 0) * 100
    ) / 100,
}));
