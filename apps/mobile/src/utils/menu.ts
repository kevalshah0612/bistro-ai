import { MenuItem } from "../types";

export function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function getPopularItems(menu: MenuItem[], limit = 6) {
  return menu.filter((item) => item.tags.includes("popular")).slice(0, limit);
}

export const CHAT_SUGGESTIONS = [
  "Add a bistro burger and truffle fries",
  "What's popular tonight?",
  "Show me vegetarian mains",
  "Remove everything from my cart",
] as const;
