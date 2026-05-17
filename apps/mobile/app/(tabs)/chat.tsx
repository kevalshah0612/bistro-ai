import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { fetchMenu, sendChatMessage } from "../../src/api/client";
import { useCartStore } from "../../src/store/cartStore";
import { useChatStore } from "../../src/store/chatStore";
import { ChatMessage, MenuItem } from "../../src/types";

function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0.35)).current, useRef(new Animated.Value(0.35)).current, useRef(new Animated.Value(0.35)).current];

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.35, duration: 350, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.typingBubble}>
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const [inputText, setInputText] = useState("");
  const menuRef = useRef<MenuItem[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const cartItems = useCartStore((state) => state.items);
  const applyActions = useCartStore((state) => state.applyActions);

  const loadMenu = useCallback(async () => {
    try {
      menuRef.current = await fetchMenu();
    } catch {
      menuRef.current = [];
    }
  }, []);

  useEffect(() => {
    loadMenu();
    if (messages.length === 0) {
      addMessage({
        role: "assistant",
        content:
          'Hi! I\'m your AI waiter at The Intelligent Bistro. You can say things like "Add two spicy chicken sandwiches and a large water" or "Remove the salad from my cart". What can I get you today?',
      });
    }
  }, [addMessage, loadMenu, messages.length]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }, [])
  );

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, isLoading]);

  async function applyActionsWithMenuRetry(actions: Awaited<ReturnType<typeof sendChatMessage>>["actions"]) {
    if (actions.length === 0) return;
    if (menuRef.current.length === 0) {
      await loadMenu();
    }
    applyActions(actions, menuRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");
    addMessage({ role: "user", content: text });
    setLoading(true);
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user" as const, content: text });
      const result = await sendChatMessage(history, cartItems);
      await applyActionsWithMenuRetry(result.actions);
      addMessage({
        role: "assistant",
        content: result.reply,
        actions: result.actions,
      });
    } catch {
      addMessage({
        role: "assistant",
        content: "Sorry, I couldn't reach the kitchen right now. Please try again.",
      });
    } finally {
      setLoading(false);
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRight : styles.messageLeft]}>
        <View style={{ maxWidth: width * 0.75 }}>
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
            <Text style={[styles.bubbleText, isUser ? styles.userText : styles.assistantText]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.timestamp, isUser && styles.timestampRight]}>
            {item.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </Text>
          {!isUser && item.actions && item.actions.length > 0 ? (
            <View style={styles.updatedChip}>
              <Text style={styles.updatedChipText}>Cart updated</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.title}>AI Waiter</Text>
        </View>
        <Text style={styles.subtitle}>Powered by Claude</Text>
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListFooterComponent={isLoading ? <TypingIndicator /> : null}
      />
      <View style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          autoFocus
          multiline
          maxLength={500}
          placeholder="Ask me to update your order..."
          placeholderTextColor="#555555"
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          disabled={inputText.trim().length === 0 || isLoading}
          style={[styles.sendButton, (inputText.trim().length === 0 || isLoading) && styles.sendDisabled]}
          onPress={handleSend}
        >
          <Ionicons name="send" size={24} color="#F5A623" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  assistantBubble: {
    backgroundColor: "#2a2a2a",
    borderTopRightRadius: 6,
  },
  assistantText: {
    color: "#F0EDE8",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  container: {
    backgroundColor: "#111111",
    flex: 1,
  },
  dot: {
    backgroundColor: "#888888",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  header: {
    backgroundColor: "#111111",
    borderBottomColor: "#2a2a2a",
    borderBottomWidth: 1,
    padding: 16,
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 24,
    color: "#F0EDE8",
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputBar: {
    alignItems: "flex-end",
    backgroundColor: "#1a1a1a",
    borderTopColor: "#2a2a2a",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  messageLeft: {
    justifyContent: "flex-start",
  },
  messageList: {
    backgroundColor: "#111111",
    padding: 14,
    paddingBottom: 20,
  },
  messageRight: {
    justifyContent: "flex-end",
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 6,
  },
  onlineDot: {
    backgroundColor: "#F5A623",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  sendButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 44,
  },
  sendDisabled: {
    opacity: 0.3,
  },
  subtitle: {
    color: "#888888",
    fontSize: 12,
    marginLeft: 16,
    marginTop: 3,
  },
  timestamp: {
    color: "#555555",
    fontSize: 10,
    marginTop: 4,
  },
  timestampRight: {
    textAlign: "right",
  },
  title: {
    color: "#F0EDE8",
    fontSize: 18,
    fontWeight: "800",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  typingBubble: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#2a2a2a",
    borderRadius: 18,
    borderTopRightRadius: 6,
    flexDirection: "row",
    gap: 5,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  updatedChip: {
    alignSelf: "flex-start",
    backgroundColor: "#1a3a2a",
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  updatedChipText: {
    color: "#52C78A",
    fontSize: 11,
    fontWeight: "800",
  },
  userBubble: {
    backgroundColor: "#F5A623",
    borderTopLeftRadius: 6,
  },
  userText: {
    color: "#111111",
  },
});
