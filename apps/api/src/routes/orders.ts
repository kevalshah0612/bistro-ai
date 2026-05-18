import { Router } from "express";
import { z } from "zod";
import { createOrder, listOrdersResponse } from "../services/orderService";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const orders = await listOrdersResponse();
    res.json(orders);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load orders";
    res.status(500).json({ error: "Order service error", message });
  }
});

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
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : "Could not create order";
    if (message.includes("unavailable") || message.includes("Invalid") || message.includes("Cart must")) {
      res.status(400).json({ error: "Invalid order", message });
      return;
    }
    res.status(500).json({ error: "Order service error", message });
  }
});

export default router;
