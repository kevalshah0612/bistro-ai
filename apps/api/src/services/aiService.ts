import { CartAction, CartActionSchema, MenuItem } from "../schemas/menu";
import { sanitizeCartActions } from "./cartValidation";
import {
  buildChatCacheKey,
  buildMealPlanCacheKey,
  buildParseCacheKey,
  getCached,
  menuFingerprint,
  setCached,
} from "./aiCache";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 60000);
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES ?? 3);

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicResponse = {
  content: AnthropicTextBlock[];
};

export type ParseOrderResult = { actions: CartAction[]; reply: string };
export type ChatTurnResult = { reply: string; actions: CartAction[] };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatNetworkError(error: unknown) {
  if (error instanceof Error) {
    const withCause = error as Error & { cause?: unknown };
    const cause =
      withCause.cause instanceof Error
        ? withCause.cause.message
        : typeof withCause.cause === "string"
          ? withCause.cause
          : "";
    return cause ? `${error.message} (${cause})` : error.message;
  }
  return String(error);
}

async function callAnthropic(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured in apps/api/.env");
  }

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system,
          messages,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic request failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as AnthropicResponse;
      return data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await sleep(400 * attempt);
      }
    }
  }

  throw new Error(
    `Anthropic network error: ${formatNetworkError(lastError)}. Check your internet connection, firewall/VPN, and API key.`
  );
}

function sanitizeMessage(value: string) {
  return value.trim().slice(0, 500);
}

function parseCartActionsFromReply(replyText: string, menuItems: MenuItem[]): CartAction[] {
  const actionMatch = replyText.match(/<cart_action>([\s\S]*?)<\/cart_action>/);
  if (!actionMatch?.[1]) return [];
  try {
    const parsed = JSON.parse(actionMatch[1]) as { actions?: unknown[] };
    const raw = CartActionSchema.array().parse(parsed.actions ?? []);
    return sanitizeCartActions(raw, menuItems);
  } catch {
    return [];
  }
}

function cleanChatReply(replyText: string) {
  return replyText.replace(/<cart_action>[\s\S]*?<\/cart_action>/, "").trim();
}

function formatDietaryPreferencesBlock(dietaryPreferences?: string) {
  const trimmed = dietaryPreferences?.trim();
  if (!trimmed) return "";
  return `
Customer dietary preferences (always honor; never suggest items that conflict with these):
${trimmed}
`;
}

type SimplifiedCartLine = {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
};

function cartSubtotal(cart: SimplifiedCartLine[]) {
  return Math.round(cart.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100;
}

async function callParseOrderIntent(
  userMessage: string,
  menuItems: MenuItem[]
): Promise<ParseOrderResult> {
  const system = `You are an order parsing assistant for The Intelligent Bistro restaurant.
You will receive a customer's natural language order request and a list of available menu items.

Your job is to parse the request and return ONLY a valid JSON object. No other text, no markdown, no explanation.

The JSON must match this exact shape:
{
  "actions": [
    { "type": "ADD" | "REMOVE" | "UPDATE_QTY", "itemId": "<exact item id from the menu>", "quantity": <integer> }
  ],
  "reply": "<a short, warm, friendly confirmation message to show the customer>"
}

Rules:
- Match item names to the menu provided. Use fuzzy matching for minor spelling differences.
- If the customer asks for something not on the menu, return an empty actions array and explain in the reply.
- If no quantity is mentioned, assume 1 for ADD actions.
- For UPDATE_QTY, quantity is the new total quantity, not the delta.
- For REMOVE, set quantity to 0.
- The reply should be warm, brief, and conversational. Max 2 sentences.
- Return ONLY the JSON. No preamble, no markdown fences.

Menu:
${JSON.stringify(menuItems, null, 2)}`;

  const rawText = await callAnthropic(system, [
    { role: "user", content: sanitizeMessage(userMessage) },
  ]);

  try {
    const parsed = JSON.parse(rawText) as { actions: CartAction[]; reply: string };
    const raw = CartActionSchema.array().parse(parsed.actions ?? []);
    return {
      actions: sanitizeCartActions(raw, menuItems),
      reply: String(parsed.reply ?? ""),
    };
  } catch (error) {
    console.error("Failed to parse order intent JSON:", rawText, error);
    return {
      actions: [],
      reply: "I had trouble understanding that. Could you rephrase your order?",
    };
  }
}

async function callChatTurn(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  cart: SimplifiedCartLine[],
  menuItems: MenuItem[],
  dietaryPreferences?: string
): Promise<ChatTurnResult> {
  const system = `You are an AI waiter at The Intelligent Bistro, an upscale bistro restaurant.
You are warm, knowledgeable about the menu, and helpful.

You have access to the customer's current cart and the full menu.
${formatDietaryPreferencesBlock(dietaryPreferences)}

When you want to make changes to the cart, you MUST include a <cart_action> JSON block
in your reply. Example:
<cart_action>{"actions":[{"type":"ADD","itemId":"spicy-chicken-sandwich","quantity":2}]}</cart_action>

Rules for cart actions:
- Only include a <cart_action> block when the customer actually asks to change their order.
- The JSON inside <cart_action> must match: { "actions": [{ "type": "ADD"|"REMOVE"|"UPDATE_QTY", "itemId": string, "quantity": number }] }
- After the block, continue your natural reply as normal.

IMPORTANT — cart is the source of truth:
- Only the "Current cart" JSON below reflects what is in the cart right now. Ignore items or quantities from earlier messages; they may be from an order already placed.
- If the current cart is empty [], start fresh: use ADD (default quantity 1) for new items. Do not mention or carry over items from prior turns unless they appear in the current cart.
- Use ADD when the customer asks to add an item (quantity is how many to add). Use UPDATE_QTY only when the item is already in the current cart and they want a specific total quantity.
- In your reply, list only items that appear in the current cart after your actions (or will appear after ADD), not items from old conversation.

Current cart:
${JSON.stringify(cart, null, 2)}

Full menu:
${JSON.stringify(menuItems, null, 2)}`;

  const safeMessages = messages.map((message) => ({
    role: message.role,
    content: sanitizeMessage(message.content),
  }));
  const replyText = await callAnthropic(system, safeMessages);
  const actions = parseCartActionsFromReply(replyText, menuItems);
  return { reply: cleanChatReply(replyText), actions };
}

async function callMealPlan(
  budget: number,
  cart: SimplifiedCartLine[],
  menuItems: MenuItem[],
  dietaryPreferences?: string
): Promise<ChatTurnResult> {
  const spent = cartSubtotal(cart);
  const remaining = Math.max(0, Math.round((budget - spent) * 100) / 100);

  const system = `You are a meal-planning assistant at The Intelligent Bistro.
Pick a small, balanced combination of menu items (typically 2–4 dishes) that fits the customer's budget.
${formatDietaryPreferencesBlock(dietaryPreferences)}
When you add items to the cart, you MUST include a <cart_action> JSON block:
<cart_action>{"actions":[{"type":"ADD","itemId":"item-id","quantity":1}]}</cart_action>

Rules:
- Use only items from the menu below. Use exact itemId values.
- Budget is based on menu prices only (no tax). The customer already has $${spent.toFixed(2)} in their cart.
- New items you add must keep the total cart at or under $${budget.toFixed(2)} (about $${remaining.toFixed(2)} left to spend).
- Prefer a sensible meal: e.g. main + side or drink, or starter + main — not five duplicates.
- Only ADD items not already in the cart (or ADD more quantity only if it still fits the budget).
- In your reply, briefly list what you chose and the estimated cart subtotal. Be warm and concise.

Current cart:
${JSON.stringify(cart, null, 2)}

Full menu:
${JSON.stringify(menuItems, null, 2)}`;

  const userPrompt =
    remaining <= 0
      ? `My cart is already at $${spent.toFixed(2)}. Suggest a swap or smaller adjustment to stay near $${budget.toFixed(2)} if possible, or explain kindly that the budget is full.`
      : `Build me a satisfying meal. I have about $${remaining.toFixed(2)} left within my $${budget.toFixed(2)} budget.`;

  const replyText = await callAnthropic(system, [{ role: "user", content: userPrompt }]);
  const actions = parseCartActionsFromReply(replyText, menuItems);
  return { reply: cleanChatReply(replyText), actions };
}

export async function parseOrderIntent(
  userMessage: string,
  menuItems: MenuItem[],
  options?: { skipCache?: boolean }
): Promise<ParseOrderResult & { cacheHit: boolean }> {
  const cacheKey = buildParseCacheKey(userMessage, menuItems);
  if (!options?.skipCache) {
    const cached = getCached<ParseOrderResult>(cacheKey);
    if (cached) {
      console.log("[ai-cache] HIT parse", cacheKey.slice(0, 12));
      return { ...cached, cacheHit: true };
    }
  }

  try {
    const result = await callParseOrderIntent(userMessage, menuItems);
    setCached(cacheKey, result);
    return { ...result, cacheHit: false };
  } catch (error) {
    const stale = getCached<ParseOrderResult>(cacheKey, { allowStale: true });
    if (stale) {
      console.warn("[ai-cache] STALE parse fallback after API error");
      return { ...stale, cacheHit: true };
    }
    throw error;
  }
}

export async function runChatTurn(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  cart: SimplifiedCartLine[],
  menuItems: MenuItem[],
  options?: { skipCache?: boolean; dietaryPreferences?: string }
): Promise<ChatTurnResult & { cacheHit: boolean }> {
  const dietary = options?.dietaryPreferences ?? "";
  const cacheKey = buildChatCacheKey(messages, cart, menuItems, dietary);
  if (!options?.skipCache) {
    const cached = getCached<ChatTurnResult>(cacheKey);
    if (cached) {
      console.log("[ai-cache] HIT chat", cacheKey.slice(0, 12));
      return { ...cached, cacheHit: true };
    }
  }

  try {
    const result = await callChatTurn(messages, cart, menuItems, dietary);
    setCached(cacheKey, result);
    return { ...result, cacheHit: false };
  } catch (error) {
    const stale = getCached<ChatTurnResult>(cacheKey, { allowStale: true });
    if (stale) {
      console.warn("[ai-cache] STALE chat fallback after API error");
      return { ...stale, cacheHit: true };
    }
    throw error;
  }
}

export async function runMealPlan(
  budget: number,
  cart: SimplifiedCartLine[],
  menuItems: MenuItem[],
  options?: { skipCache?: boolean; dietaryPreferences?: string }
): Promise<ChatTurnResult & { cacheHit: boolean }> {
  const dietary = options?.dietaryPreferences ?? "";
  const cacheKey = buildMealPlanCacheKey(budget, cart, menuItems, dietary);
  if (!options?.skipCache) {
    const cached = getCached<ChatTurnResult>(cacheKey);
    if (cached) {
      console.log("[ai-cache] HIT meal-plan", cacheKey.slice(0, 12));
      return { ...cached, cacheHit: true };
    }
  }

  try {
    const result = await callMealPlan(budget, cart, menuItems, dietary);
    setCached(cacheKey, result);
    return { ...result, cacheHit: false };
  } catch (error) {
    const stale = getCached<ChatTurnResult>(cacheKey, { allowStale: true });
    if (stale) {
      console.warn("[ai-cache] STALE meal-plan fallback after API error");
      return { ...stale, cacheHit: true };
    }
    throw error;
  }
}

export function getAiCacheMenuFingerprint(menuItems: MenuItem[]) {
  return menuFingerprint(menuItems);
}
