import { create } from "zustand";
import { fetchOrders } from "../api/client";
import { PlacedOrder } from "../types";

type OrdersStore = {
  orders: PlacedOrder[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  prependOrder: (order: PlacedOrder) => void;
};

export const useOrdersStore = create<OrdersStore>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await fetchOrders();
      set({ orders, isLoading: false });
    } catch {
      set({
        isLoading: false,
        error: "Could not load your order history.",
      });
    }
  },

  prependOrder: (order) => {
    set({ orders: [order, ...get().orders.filter((o) => o.id !== order.id)] });
  },
}));
