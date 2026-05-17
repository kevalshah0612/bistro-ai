import { Router } from "express";
import { z } from "zod";
import { createOrder } from "../services/orderService";

const router = Router();

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .min(1),
});

router.post("/", async (req, res) => {
  try {
    const parsed = createOrderSchema.parse(req.body);
    const order = await createOrder(parsed.items);
    res.status(201).json({
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        itemId: item.menuItemId,
        name: item.menuItem.name,
        quantity: item.quantity,
        priceAtOrder: item.priceAtOrder,
        category: item.menuItem.category.name,
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : "Could not create order";
    res.status(500).json({ error: "Order service error", message });
  }
});

export default router;
