import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../src/components/Screen";
import { fetchMenu, sendChatMessage } from "../../src/api/client";
import { useCartStore } from "../../src/store/cartStore";
import { useChatStore } from "../../src/store/chatStore";
import { CartAction, ChatMessage, MenuItem } from "../../src/types";
import { CHAT_SUGGESTIONS, formatMoney, getPopularItems } from "../../src/utils/menu";

const TAB_BAR_BASE = 52;

function TypingIndicator() {
  const dots = [
    useRef(new Animated.Value(0.35)).current,
    useRef(new Animated.Value(0.35)).current,
    useRef(new Animated.Value(0.35)).current,
  ];

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

function describeActions(actions: CartAction[], menu: MenuItem[]) {
  return actions
    .map((action) => {
      const item = menu.find((m) => m.id === action.itemId);
      const name = item?.name ?? action.itemId;
      if (action.type === "ADD") return `+${action.quantity} ${name}`;
      if (action.type === "REMOVE") return `Removed ${name}`;
      return `${name} → qty ${action.quantity}`;
    })
    .join(" · ");
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const menuRef = useRef<MenuItem[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const getTotalItems = useCartStore((state) => state.totalItems);
  const getTotalPrice = useCartStore((state) => state.totalPrice);
  const applyActions = useCartStore((state) => state.applyActions);

  const tabBarOffset = TAB_BAR_BASE + Math.max(insets.bottom, Platform.OS === "android" ? 12 : 8);
  const keyboardVerticalOffset = Platform.OS === "ios" ? tabBarOffset : 0;
  const popularItems = getPopularItems(menu);

  const scrollToBottom = useCallback((animated = true) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated });
      });
    });
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const items = await fetchMenu();
      menuRef.current = items;
      setMenu(items);
    } catch {
      menuRef.current = [];
      setMenu([]);
    }
  }, []);

  useEffect(() => {
    loadMenu();
    if (messages.length === 0) {
      addMessage({
        role: "assistant",
        content:
          "Hi! I'm your AI waiter. Tap a suggestion below, pick a popular dish, or tell me what you'd like — I'll update your cart instantly. After you place an order from the Cart tab, we start fresh here.",
      });
    }
  }, [addMessage, loadMenu, messages.length]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => scrollToBottom(true)
    );
    return () => showSub.remove();
  }, [scrollToBottom]);

  async function applyActionsWithMenuRetry(actions: Awaited<ReturnType<typeof sendChatMessage>>["actions"]) {
    if (actions.length === 0) return;
    if (menuRef.current.length === 0) {
      await loadMenu();
    }
    applyActions(actions, menuRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInputText("");
    Keyboard.dismiss();
    addMessage({ role: "user", content: trimmed });
    setLoading(true);
    scrollToBottom(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user" as const, content: trimmed });
      const currentCart = useCartStore.getState().items;
      const result = await sendChatMessage(history, currentCart);
      await applyActionsWithMenuRetry(result.actions);
      addMessage({
        role: "assistant",
        content: result.reply,
        actions: result.actions,
        cached: result.cached,
      });
    } catch {
      addMessage({
        role: "assistant",
        content: "Sorry, I couldn't reach the kitchen right now. Please try again.",
      });
    } finally {
      setLoading(false);
      scrollToBottom(true);
    }
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    const actionSummary =
      !isUser && item.actions && item.actions.length > 0
        ? describeActions(item.actions, menuRef.current)
        : null;

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRight : styles.messageLeft]}>
        <View style={{ maxWidth: width * 0.82 }}>
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
            <Text style={[styles.bubbleText, isUser ? styles.userText : styles.assistantText]}>
              {item.content}
            </Text>
          </View>
          {actionSummary ? (
            <View style={styles.actionDetail}>
              <Ionicons name="cart" size={12} color="#52C78A" />
              <Text style={styles.actionDetailText}>{actionSummary}</Text>
            </View>
          ) : null}
          {!isUser && item.cached ? (
            <View style={styles.cachedChip}>
              <Ionicons name="flash" size={11} color="#F5A623" />
              <Text style={styles.cachedChipText}>Saved reply</Text>
            </View>
          ) : null}
          <Text style={[styles.timestamp, isUser && styles.timestampRight]}>
            {item.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.flex}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.title}>AI Waiter</Text>
          </View>
          <Text style={styles.subtitle}>Ask in plain English — I'll update your cart</Text>
          {getTotalItems() > 0 ? (
            <Pressable
              accessibilityRole="button"
              style={styles.cartBanner}
              onPress={() => router.push("/(tabs)/cart")}
            >
              <Ionicons name="cart" size={18} color="#F5A623" />
              <Text style={styles.cartBannerText}>
                {getTotalItems()} item{getTotalItems() === 1 ? "" : "s"} in cart · {formatMoney(getTotalPrice())}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#888888" />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messageScroll}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollToBottom(false)}
          ListFooterComponent={isLoading ? <TypingIndicator /> : <View style={styles.listFooter} />}
        />

        <View style={styles.composer}>
          <Text style={styles.composerLabel}>Try asking</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
          >
            {CHAT_SUGGESTIONS.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={suggestion}
                style={styles.chip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void sendMessage(suggestion);
                }}
              >
                <Text style={styles.chipText}>{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {popularItems.length > 0 ? (
            <>
              <Text style={[styles.composerLabel, styles.popularLabel]}>Popular picks</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipRow}
              >
                {popularItems.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item.id}
                    style={styles.popularChip}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      void sendMessage(`Add one ${item.name}`);
                    }}
                  >
                    <Text style={styles.popularChipName}>{item.name}</Text>
                    <Text style={styles.popularChipPrice}>{formatMoney(item.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              multiline
              maxLength={500}
              placeholder="Type your order..."
              placeholderTextColor="#555555"
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              onFocus={() => scrollToBottom(true)}
              onContentSizeChange={() => scrollToBottom(false)}
            />
            <Pressable
              accessibilityLabel="Send message"
              accessibilityRole="button"
              disabled={inputText.trim().length === 0 || isLoading}
              style={[styles.sendButton, (inputText.trim().length === 0 || isLoading) && styles.sendDisabled]}
              onPress={() => void sendMessage(inputText)}
            >
              <Ionicons name="send" size={22} color="#111111" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionDetail: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#1a2e22",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionDetailText: {
    color: "#52C78A",
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "600",
  },
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
  cachedChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  cachedChipText: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "600",
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  cartBanner: {
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderColor: "#3a3020",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cartBannerText: {
    color: "#F0EDE8",
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  chip: {
    backgroundColor: "#2a2a2a",
    borderColor: "#3a3a3a",
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipRow: {
    paddingBottom: 4,
    paddingRight: 8,
  },
  chipText: {
    color: "#cfc8bd",
    fontSize: 13,
    fontWeight: "600",
  },
  composer: {
    backgroundColor: "#1a1a1a",
    borderTopColor: "#2a2a2a",
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  composerLabel: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  dot: {
    backgroundColor: "#888888",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  flex: {
    flex: 1,
  },
  header: {
    borderBottomColor: "#2a2a2a",
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 22,
    color: "#F0EDE8",
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  inputBar: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  listFooter: {
    height: 8,
  },
  messageLeft: {
    justifyContent: "flex-start",
  },
  messageList: {
    flexGrow: 1,
    padding: 14,
    paddingBottom: 8,
  },
  messageRight: {
    justifyContent: "flex-end",
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 5,
  },
  messageScroll: {
    flex: 1,
  },
  onlineDot: {
    backgroundColor: "#52C78A",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  popularChip: {
    backgroundColor: "#252015",
    borderColor: "#F5A623",
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    maxWidth: 160,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  popularChipName: {
    color: "#F0EDE8",
    fontSize: 13,
    fontWeight: "800",
  },
  popularChipPrice: {
    color: "#F5A623",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  popularLabel: {
    marginTop: 10,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sendDisabled: {
    opacity: 0.35,
  },
  subtitle: {
    color: "#888888",
    fontSize: 13,
    marginLeft: 16,
    marginTop: 2,
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
  userBubble: {
    backgroundColor: "#F5A623",
    borderTopLeftRadius: 6,
  },
  userText: {
    color: "#111111",
  },
});
