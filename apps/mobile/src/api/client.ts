import axios from "axios";
import {
  buildChatClientCacheKey,
  getClientChatCache,
  getClientParseCache,
  setClientChatCache,
  setClientParseCache,
} from "./aiClientCache";
import { CartAction, CartItem, MenuItem, PlacedOrder } from "../types";

const AI_TIMEOUT_MS = 90000;

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
): Promise<{ actions: CartAction[]; reply: string; cached?: boolean }> => {
  const normalized = message.trim().toLowerCase();
  const cached = getClientParseCache(normalized);
  if (cached) {
    return { ...cached, cached: true };
  }

  const res = await api.post("/ai/parse", { message }, { timeout: AI_TIMEOUT_MS });
  const data = res.data as { actions: CartAction[]; reply: string; cached?: boolean };
  setClientParseCache(normalized, data);
  return data;
};

export const sendChatMessage = async (
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  cart: CartItem[]
): Promise<{ reply: string; actions: CartAction[]; cached?: boolean }> => {
  const cacheKey = buildChatClientCacheKey(messages, cart);
  const cached = getClientChatCache(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const simplifiedCart = cart.map((c) => ({
    itemId: c.item.id,
    name: c.item.name,
    quantity: c.quantity,
    price: c.item.price,
  }));
  const res = await api.post("/ai/chat", { messages, cart: simplifiedCart }, { timeout: AI_TIMEOUT_MS });
  const data = res.data as { reply: string; actions: CartAction[]; cached?: boolean };
  setClientChatCache(cacheKey, data);
  return data;
};

export const placeOrder = async (cart: CartItem[]): Promise<PlacedOrder> => {
  const items = cart.map((c) => ({
    itemId: c.item.id,
    quantity: c.quantity,
  }));
  const res = await api.post("/orders", { items });
  return res.data;
};

export const fetchOrders = async (): Promise<PlacedOrder[]> => {
  const res = await api.get("/orders");
  return res.data;
};
