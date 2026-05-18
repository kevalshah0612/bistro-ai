import { Router } from "express";
import { z } from "zod";
import { parseOrderIntent, runChatTurn, runMealPlan } from "../services/aiService";
import { sanitizeClientCart } from "../services/cartValidation";
import { getMenuItems } from "../services/menuService";

const router = Router();

const parseRequestSchema = z.object({
  message: z.string().min(1).max(500),
});

const simplifiedCartSchema = z.array(
  z.object({
    itemId: z.string(),
    name: z.string(),
    quantity: z.number(),
    price: z.number(),
  })
);

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
  cart: simplifiedCartSchema,
  dietaryPreferences: z.string().max(200).optional(),
});

const mealPlanRequestSchema = z.object({
  budget: z.number().positive().max(500),
  cart: simplifiedCartSchema,
  dietaryPreferences: z.string().max(200).optional(),
});

function logAiRequest(route: string, startedAt: number, length: number) {
  const responseTime = Date.now() - startedAt;
  console.log(
    `[${new Date().toISOString()}] ${route} messageLength=${length} responseTimeMs=${responseTime}`
  );
}

router.post("/parse", async (req, res) => {
  const startedAt = Date.now();
  try {
    const parsed = parseRequestSchema.parse(req.body);
    const message = parsed.message.trim().slice(0, 500);
    const menuItems = await getMenuItems();
    const result = await parseOrderIntent(message, menuItems);
    logAiRequest("/api/ai/parse", startedAt, message.length);
    res.setHeader("X-AI-Cache", result.cacheHit ? "HIT" : "MISS");
    res.json({ actions: result.actions, reply: result.reply, cached: result.cacheHit });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown AI service error";
    logAiRequest("/api/ai/parse", startedAt, 0);
    res.status(500).json({ error: "AI service error", message });
  }
});

router.post("/chat", async (req, res) => {
  const startedAt = Date.now();
  try {
    const parsed = chatRequestSchema.parse(req.body);
    const messages = parsed.messages.map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 500),
    }));
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    const menuItems = await getMenuItems();
    const cart = sanitizeClientCart(parsed.cart, menuItems);
    const result = await runChatTurn(messages, cart, menuItems, {
      dietaryPreferences: parsed.dietaryPreferences,
    });
    logAiRequest("/api/ai/chat", startedAt, lastUserMessage?.content.length ?? 0);
    res.setHeader("X-AI-Cache", result.cacheHit ? "HIT" : "MISS");
    res.json({ reply: result.reply, actions: result.actions, cached: result.cacheHit });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown AI service error";
    logAiRequest("/api/ai/chat", startedAt, 0);
    res.status(500).json({ error: "AI service error", message });
  }
});

router.post("/meal-plan", async (req, res) => {
  const startedAt = Date.now();
  try {
    const parsed = mealPlanRequestSchema.parse(req.body);
    const menuItems = await getMenuItems();
    const cart = sanitizeClientCart(parsed.cart, menuItems);
    const result = await runMealPlan(parsed.budget, cart, menuItems, {
      dietaryPreferences: parsed.dietaryPreferences,
    });
    logAiRequest("/api/ai/meal-plan", startedAt, String(parsed.budget).length);
    res.setHeader("X-AI-Cache", result.cacheHit ? "HIT" : "MISS");
    res.json({ reply: result.reply, actions: result.actions, cached: result.cacheHit });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown AI service error";
    logAiRequest("/api/ai/meal-plan", startedAt, 0);
    res.status(500).json({ error: "AI service error", message });
  }
});

export default router;
