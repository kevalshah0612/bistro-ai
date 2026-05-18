import { CartAction, CartItem } from "../types";

type AiChatResult = { reply: string; actions: CartAction[]; cached?: boolean };

const chatCache = new Map<string, AiChatResult>();
const parseCache = new Map<string, AiChatResult>();
const mealPlanCache = new Map<string, AiChatResult>();

function cartFingerprint(cart: CartItem[]) {
  return cart
    .map((line) => `${line.item.id}:${line.quantity}`)
    .sort()
    .join("|");
}

export function buildChatClientCacheKey(
  messages: Array<{ role: string; content: string }>,
  cart: CartItem[],
  dietaryPreferences = ""
) {
  const transcript = messages.map((m) => `${m.role}:${m.content.trim().toLowerCase()}`).join("||");
  return `${transcript}::${cartFingerprint(cart)}::${dietaryPreferences.trim().toLowerCase()}`;
}

export function buildMealPlanClientCacheKey(
  budget: number,
  cart: CartItem[],
  dietaryPreferences = ""
) {
  return `meal:${budget}::${cartFingerprint(cart)}::${dietaryPreferences.trim().toLowerCase()}`;
}

export function getClientMealPlanCache(key: string) {
  return mealPlanCache.get(key);
}

export function setClientMealPlanCache(key: string, value: AiChatResult) {
  if (mealPlanCache.size > 50) {
    const firstKey = mealPlanCache.keys().next().value;
    if (firstKey) mealPlanCache.delete(firstKey);
  }
  mealPlanCache.set(key, value);
}

export function getClientChatCache(key: string) {
  return chatCache.get(key);
}

export function setClientChatCache(key: string, value: AiChatResult) {
  if (chatCache.size > 100) {
    const firstKey = chatCache.keys().next().value;
    if (firstKey) chatCache.delete(firstKey);
  }
  chatCache.set(key, value);
}

export function getClientParseCache(message: string) {
  return parseCache.get(message.trim().toLowerCase());
}

export function setClientParseCache(message: string, value: AiChatResult) {
  parseCache.set(message.trim().toLowerCase(), value);
}

export function clearAiClientCaches() {
  chatCache.clear();
  parseCache.clear();
  mealPlanCache.clear();
}
