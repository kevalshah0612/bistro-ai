import { clearAiClientCaches } from "../api/aiClientCache";
import { useCartStore } from "../store/cartStore";
import { useChatStore } from "../store/chatStore";

/** Clears cart and chat so a placed order does not leak into the next one. */
export function resetOrderingSession() {
  useCartStore.getState().clearCart();
  useChatStore.getState().clearMessages();
  clearAiClientCaches();
}
