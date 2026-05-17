export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  available: boolean;
};

export type CartItem = {
  item: MenuItem;
  quantity: number;
};

export type CartAction = {
  type: "ADD" | "REMOVE" | "UPDATE_QTY";
  itemId: string;
  quantity: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: CartAction[];
};
