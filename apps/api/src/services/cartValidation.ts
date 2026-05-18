import { CartAction, CartActionSchema, MenuItem } from "../schemas/menu";

export const MAX_LINE_QUANTITY = 99;
export const MAX_ADD_QUANTITY = 20;

export function clampLineQuantity(quantity: number) {
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.floor(quantity)));
}

function menuItemMap(menu: MenuItem[]) {
  return new Map(menu.map((item) => [item.id, item]));
}

/** Drop or fix AI cart actions against the live menu. */
export function sanitizeCartActions(actions: unknown[], menu: MenuItem[]): CartAction[] {
  const byId = menuItemMap(menu);
  const sanitized: CartAction[] = [];

  for (const raw of actions) {
    const parsed = CartActionSchema.safeParse(raw);
    if (!parsed.success) continue;

    const action = parsed.data;
    const menuItem = byId.get(action.itemId);
    if (!menuItem?.available) continue;

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

    if (action.type === "UPDATE_QTY" && quantity > 0) {
      sanitized.push({ type: "UPDATE_QTY", itemId: action.itemId, quantity });
    }
  }

  return sanitized;
}

type ClientCartLine = {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
};

/** Keep only cart lines that still exist on the menu (for AI context). */
export function sanitizeClientCart(cart: ClientCartLine[], menu: MenuItem[]) {
  const byId = menuItemMap(menu);
  return cart
    .map((line) => {
      const menuItem = byId.get(line.itemId);
      if (!menuItem?.available) return null;
      const quantity = clampLineQuantity(line.quantity);
      if (quantity <= 0) return null;
      return {
        itemId: menuItem.id,
        name: menuItem.name,
        quantity,
        price: menuItem.price,
      };
    })
    .filter((line): line is ClientCartLine => line !== null);
}

export function validateOrderItems(
  items: Array<{ itemId: string; quantity: number }>,
  menu: MenuItem[]
) {
  if (items.length === 0) {
    throw new Error("Cart must include at least one item.");
  }

  const byId = menuItemMap(menu);
  const seen = new Set<string>();

  for (const line of items) {
    if (!line.itemId?.trim()) {
      throw new Error("Each order line must include a menu item id.");
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Invalid quantity for ${line.itemId}.`);
    }
    if (line.quantity > MAX_LINE_QUANTITY) {
      throw new Error(`Quantity for ${line.itemId} cannot exceed ${MAX_LINE_QUANTITY}.`);
    }
    if (seen.has(line.itemId)) {
      throw new Error(`Duplicate item in order: ${line.itemId}.`);
    }
    seen.add(line.itemId);

    const menuItem = byId.get(line.itemId);
    if (!menuItem?.available) {
      throw new Error(`Menu item is unavailable or does not exist: ${line.itemId}`);
    }
  }
}
