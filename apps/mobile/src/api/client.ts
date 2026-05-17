import axios from "axios";
import { CartAction, CartItem, MenuItem, PlacedOrder } from "../types";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (__DEV__) console.error("[API Error]", err.message, err.response?.data);
    return Promise.reject(err);
  }
);

export const fetchMenu = async (): Promise<MenuItem[]> => {
  const res = await api.get("/menu");
  return res.data;
};

export const parseOrder = async (
  message: string
): Promise<{ actions: CartAction[]; reply: string }> => {
  const res = await api.post("/ai/parse", { message });
  return res.data;
};

export const sendChatMessage = async (
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  cart: CartItem[]
): Promise<{ reply: string; actions: CartAction[] }> => {
  const simplifiedCart = cart.map((c) => ({
    itemId: c.item.id,
    name: c.item.name,
    quantity: c.quantity,
    price: c.item.price,
  }));
  const res = await api.post("/ai/chat", { messages, cart: simplifiedCart });
  return res.data;
};

export const placeOrder = async (cart: CartItem[]): Promise<PlacedOrder> => {
  const items = cart.map((c) => ({
    itemId: c.item.id,
    quantity: c.quantity,
  }));
  const res = await api.post("/orders", { items });
  return res.data;
};
