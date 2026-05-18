import axios from "axios";
import {
  buildChatClientCacheKey,
  buildMealPlanClientCacheKey,
  getClientChatCache,
  getClientMealPlanCache,
  getClientParseCache,
  setClientChatCache,
  setClientMealPlanCache,
  setClientParseCache,
} from "./aiClientCache";
import { CartAction, CartItem, MenuItem, PlacedOrder } from "../types";
import { useCartStore } from "../store/cartStore";
import { useMenuStore } from "../store/menuStore";
import { validateCartForCheckout } from "../utils/cartValidation";

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

function simplifyCart(cart: CartItem[]) {
  return cart.map((c) => ({
    itemId: c.item.id,
    name: c.item.name,
    quantity: c.quantity,
    price: c.item.price,
  }));
}

export const sendChatMessage = async (
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  cart: CartItem[],
  dietaryPreferences?: string
): Promise<{ reply: string; actions: CartAction[]; cached?: boolean }> => {
  const prefs = dietaryPreferences?.trim() ?? "";
  const menu = await useMenuStore.getState().ensureLoaded();
  useCartStore.getState().syncWithMenu(menu);
  const syncedItems = useCartStore.getState().items;
  const cacheKey = buildChatClientCacheKey(messages, syncedItems, prefs);
  const cached = getClientChatCache(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const syncedCart = simplifyCart(syncedItems);
  const res = await api.post(
    "/ai/chat",
    { messages, cart: syncedCart, dietaryPreferences: prefs || undefined },
    { timeout: AI_TIMEOUT_MS }
  );
  const data = res.data as { reply: string; actions: CartAction[]; cached?: boolean };
  setClientChatCache(cacheKey, data);
  return data;
};

export const buildMealPlan = async (
  budget: number,
  cart: CartItem[],
  dietaryPreferences?: string
): Promise<{ reply: string; actions: CartAction[]; cached?: boolean }> => {
  const prefs = dietaryPreferences?.trim() ?? "";
  const menu = await useMenuStore.getState().ensureLoaded();
  useCartStore.getState().syncWithMenu(menu);
  const syncedItems = useCartStore.getState().items;
  const cacheKey = buildMealPlanClientCacheKey(budget, syncedItems, prefs);
  const cached = getClientMealPlanCache(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const res = await api.post(
    "/ai/meal-plan",
    { budget, cart: simplifyCart(syncedItems), dietaryPreferences: prefs || undefined },
    { timeout: AI_TIMEOUT_MS }
  );
  const data = res.data as { reply: string; actions: CartAction[]; cached?: boolean };
  setClientMealPlanCache(cacheKey, data);
  return data;
};

export const placeOrder = async (
  cart: CartItem[],
  menu: MenuItem[]
): Promise<PlacedOrder> => {
  const validation = validateCartForCheckout(cart, menu);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const items = validation.items.map((line) => ({
    itemId: line.item.id,
    quantity: line.quantity,
  }));
  const res = await api.post("/orders", { items });
  return res.data;
};

export const fetchOrders = async (): Promise<PlacedOrder[]> => {
  const res = await api.get("/orders");
  return res.data;
};
