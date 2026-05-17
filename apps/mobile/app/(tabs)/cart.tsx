import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { placeOrder } from "../../src/api/client";
import { useCartStore } from "../../src/store/cartStore";
import { CartItem } from "../../src/types";

export default function CartScreen() {
  const router = useRouter();
  const [placingOrder, setPlacingOrder] = useState(false);
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCartStore();

  const handlePlaceOrder = async () => {
    if (placingOrder) return;

    setPlacingOrder(true);
    try {
      const order = await placeOrder(items);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Order Placed",
        `Thank you! Your order #${order.id.slice(-6).toUpperCase()} is on its way.`
      );
      clearCart();
    } catch {
      Alert.alert("Order Not Sent", "The kitchen could not receive your order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="cart-outline" size={72} color="#444444" />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Use the menu or AI chat to add items</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.browseButton}
          onPress={() => router.push("/(tabs)/")}
        >
          <Text style={styles.browseText}>Browse Menu</Text>
        </Pressable>
      </View>
    );
  }

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartRow}>
      <View style={styles.lineInfo}>
        <Text style={styles.lineName}>{item.item.name}</Text>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{item.item.category}</Text>
        </View>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel={`Decrease ${item.item.name} quantity`}
          accessibilityRole="button"
          style={styles.stepButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            updateQuantity(item.item.id, item.quantity - 1);
          }}
        >
          <Ionicons name="remove" size={18} color="#111111" />
        </Pressable>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <Pressable
          accessibilityLabel={`Increase ${item.item.name} quantity`}
          accessibilityRole="button"
          style={styles.stepButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            updateQuantity(item.item.id, item.quantity + 1);
          }}
        >
          <Ionicons name="add" size={18} color="#111111" />
        </Pressable>
      </View>
      <View style={styles.lineTotalWrap}>
        <Text style={styles.lineTotal}>${(item.item.price * item.quantity).toFixed(2)}</Text>
        <Pressable
          accessibilityLabel={`Remove ${item.item.name}`}
          accessibilityRole="button"
          style={styles.trashButton}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            removeItem(item.item.id);
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#E05252" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
      <View style={styles.footer}>
        <Text style={styles.summaryLabel}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryMain}>{totalItems()} items</Text>
          <Text style={styles.summaryMain}>${totalPrice().toFixed(2)}</Text>
        </View>
        <Text style={styles.summarySubtext}>Tax and service charge not included</Text>
        <Pressable
          accessibilityRole="button"
          disabled={placingOrder}
          style={[styles.placeButton, placingOrder && styles.placeButtonDisabled]}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.placeText}>{placingOrder ? "Sending Order..." : "Place Order"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  browseButton: {
    backgroundColor: "#F5A623",
    borderRadius: 12,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  browseText: {
    color: "#111111",
    fontWeight: "800",
  },
  cartRow: {
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    minHeight: 98,
    padding: 12,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: "#444444",
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    color: "#F0EDE8",
    fontSize: 10,
    fontWeight: "700",
  },
  container: {
    backgroundColor: "#111111",
    flex: 1,
  },
  empty: {
    alignItems: "center",
    backgroundColor: "#111111",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  emptySubtitle: {
    color: "#555555",
    fontSize: 13,
    marginTop: 6,
  },
  emptyTitle: {
    color: "#888888",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 18,
  },
  footer: {
    backgroundColor: "#1a1a1a",
    borderTopColor: "#2a2a2a",
    borderTopWidth: 1,
    padding: 16,
  },
  lineInfo: {
    flex: 1,
  },
  lineName: {
    color: "#F0EDE8",
    fontSize: 16,
    fontWeight: "800",
  },
  lineTotal: {
    color: "#F5A623",
    fontSize: 16,
    fontWeight: "800",
  },
  lineTotalWrap: {
    alignItems: "flex-end",
    width: 78,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 12,
    paddingTop: 12,
  },
  placeButton: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    marginTop: 14,
  },
  placeButtonDisabled: {
    opacity: 0.55,
  },
  placeText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
  },
  quantity: {
    color: "#F0EDE8",
    fontSize: 16,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  summaryLabel: {
    color: "#888888",
    fontSize: 14,
  },
  summaryMain: {
    color: "#F0EDE8",
    fontSize: 20,
    fontWeight: "900",
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summarySubtext: {
    color: "#555555",
    fontSize: 11,
    marginTop: 4,
  },
  trashButton: {
    marginTop: 12,
    padding: 4,
  },
});
