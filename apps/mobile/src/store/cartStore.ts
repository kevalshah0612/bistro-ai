import { LayoutAnimation } from "react-native";
import { create } from "zustand";
import { CartAction, CartItem, MenuItem } from "../types";

type CartStore = {
  items: CartItem[];
  addItem: (item: MenuItem, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  applyActions: (actions: CartAction[], menu: MenuItem[]) => void;
  totalItems: () => number;
  totalPrice: () => number;
};

function animateCartChange() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item, quantity = 1) => {
    animateCartChange();
    set((state) => {
      const existing = state.items.find((i) => i.item.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.item.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
          ),
        };
      }
      return { items: [...state.items, { item, quantity }] };
    });
  },

  removeItem: (itemId) => {
    animateCartChange();
    set((state) => ({
      items: state.items.filter((i) => i.item.id !== itemId),
    }));
  },

  updateQuantity: (itemId, quantity) => {
    animateCartChange();
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.item.id !== itemId) };
      }
      return {
        items: state.items.map((i) =>
          i.item.id === itemId ? { ...i, quantity } : i
        ),
      };
    });
  },

  clearCart: () => {
    animateCartChange();
    set({ items: [] });
  },

  applyActions: (actions, menu) => {
    actions.forEach((action) => {
      const menuItem = menu.find((m) => m.id === action.itemId);
      if (!menuItem) return;
      const inCart = get().items.some((i) => i.item.id === action.itemId);
      if (action.type === "ADD") get().addItem(menuItem, action.quantity);
      if (action.type === "REMOVE") get().removeItem(action.itemId);
      if (action.type === "UPDATE_QTY") {
        if (!inCart && action.quantity > 0) {
          get().addItem(menuItem, action.quantity);
        } else {
          get().updateQuantity(action.itemId, action.quantity);
        }
      }
    });
  },

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalPrice: () =>
    Math.round(
      get().items.reduce((sum, i) => sum + i.item.price * i.quantity, 0) * 100
    ) / 100,
}));
