import { z } from "zod";

export const MenuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  category: z.string(),
  tags: z.array(
    z.enum(["spicy", "vegetarian", "vegan", "gluten-free", "popular"])
  ),
  available: z.boolean(),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;

export const CartActionSchema = z.object({
  type: z.enum(["ADD", "REMOVE", "UPDATE_QTY"]),
  itemId: z.string(),
  quantity: z.number().int().min(0),
});

export type CartAction = z.infer<typeof CartActionSchema>;
