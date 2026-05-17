import { nanoid } from "nanoid/non-secure";
import { create } from "zustand";
import { ChatMessage } from "../types";

type ChatStore = {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setLoading: (v: boolean) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: nanoid(), timestamp: new Date() },
      ],
    })),

  setLoading: (v) => set({ isLoading: v }),
  clearMessages: () => set({ messages: [] }),
}));
