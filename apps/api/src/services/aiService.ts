import { CartAction, CartActionSchema, MenuItem } from "../schemas/menu";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicResponse = {
  content: AnthropicTextBlock[];
};

async function callAnthropic(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system,
      messages,
    }),
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
}

function sanitizeMessage(value: string) {
  return value.trim().slice(0, 500);
}

export async function parseOrderIntent(
  userMessage: string,
  menuItems: MenuItem[]
): Promise<{ actions: CartAction[]; reply: string }> {
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
    return {
      actions: CartActionSchema.array().parse(parsed.actions ?? []),
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

export async function runChatTurn(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  cart: Array<{ itemId: string; name: string; quantity: number; price: number }>,
  menuItems: MenuItem[]
): Promise<{ reply: string; actions: CartAction[] }> {
  const system = `You are an AI waiter at The Intelligent Bistro, an upscale bistro restaurant.
You are warm, knowledgeable about the menu, and helpful.

You have access to the customer's current cart and the full menu.

When you want to make changes to the cart, you MUST include a <cart_action> JSON block
in your reply. Example:
<cart_action>{"actions":[{"type":"ADD","itemId":"spicy-chicken-sandwich","quantity":2}]}</cart_action>

Rules for cart actions:
- Only include a <cart_action> block when the customer actually asks to change their order.
- The JSON inside <cart_action> must match: { "actions": [{ "type": "ADD"|"REMOVE"|"UPDATE_QTY", "itemId": string, "quantity": number }] }
- After the block, continue your natural reply as normal.

Current cart:
${JSON.stringify(cart, null, 2)}

Full menu:
${JSON.stringify(menuItems, null, 2)}`;

  const safeMessages = messages.map((message) => ({
    role: message.role,
    content: sanitizeMessage(message.content),
  }));
  const replyText = await callAnthropic(system, safeMessages);
  const actionMatch = replyText.match(/<cart_action>([\s\S]*?)<\/cart_action>/);
  let actions: CartAction[] = [];

  if (actionMatch?.[1]) {
    const parsed = JSON.parse(actionMatch[1]) as { actions?: CartAction[] };
    actions = CartActionSchema.array().parse(parsed.actions ?? []);
  }

  const cleanReply = replyText
    .replace(/<cart_action>[\s\S]*?<\/cart_action>/, "")
    .trim();

  return { reply: cleanReply, actions };
}
