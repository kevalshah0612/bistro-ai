import { create } from "zustand";
import { fetchMenu } from "../api/client";
import { MenuItem } from "../types";
import { useCartStore } from "./cartStore";

type MenuStore = {
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
  setItems: (items: MenuItem[]) => void;
  refresh: () => Promise<MenuItem[]>;
  ensureLoaded: () => Promise<MenuItem[]>;
};

export const useMenuStore = create<MenuStore>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  setItems: (items) => set({ items, error: null }),

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await fetchMenu();
      set({ items, isLoading: false });
      useCartStore.getState().syncWithMenu(items);
      return items;
    } catch {
      set({
        isLoading: false,
        error: "Could not refresh the menu.",
      });
      return get().items;
    }
  },

  ensureLoaded: async () => {
    if (get().items.length > 0) {
      useCartStore.getState().syncWithMenu(get().items);
      return get().items;
    }
    return get().refresh();
  },
}));
