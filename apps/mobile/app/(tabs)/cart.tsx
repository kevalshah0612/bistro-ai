import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../../src/components/Screen";
import { OrderStatusBadge } from "../../src/components/OrderStatusBadge";
import { placeOrder } from "../../src/api/client";
import { useSyncCartOnFocus } from "../../src/hooks/useSyncCartOnFocus";
import { useCartStore } from "../../src/store/cartStore";
import { useMenuStore } from "../../src/store/menuStore";
import { useOrdersStore } from "../../src/store/ordersStore";
import { validateCartForCheckout } from "../../src/utils/cartValidation";
import { CartItem, PlacedOrder } from "../../src/types";
import { formatMoney } from "../../src/utils/menu";
import { resetOrderingSession } from "../../src/utils/orderingSession";

const TAX_RATE = 0.08875;

function formatOrderDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function OrderCard({ order }: { order: PlacedOrder }) {
  const itemSummary = order.items
    .map((i) => `${i.quantity}× ${i.name}`)
    .slice(0, 3)
    .join(", ");
  const more = order.items.length > 3 ? ` +${order.items.length - 3} more` : "";

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardHeader}>
        <View>
          <Text style={styles.orderId}>Order #{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.orderDate}>{formatOrderDate(order.createdAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>
      <Text style={styles.orderItems} numberOfLines={2}>
        {itemSummary}
        {more}
      </Text>
      <View style={styles.orderFooter}>
        <Text style={styles.orderItemCount}>
          {order.items.reduce((sum, i) => sum + i.quantity, 0)} items
        </Text>
        <Text style={styles.orderTotal}>{formatMoney(order.total)}</Text>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const [placingOrder, setPlacingOrder] = useState(false);
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCartStore();
  const { orders, isLoading: ordersLoading, error: ordersError, fetchOrders, prependOrder } =
    useOrdersStore();

  useSyncCartOnFocus();

  const subtotal = totalPrice();
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const estimatedTotal = Math.round((subtotal + tax) * 100) / 100;
  const itemCount = totalItems();

  useFocusEffect(
    useCallback(() => {
      void fetchOrders();
    }, [fetchOrders])
  );

  const handlePlaceOrder = async () => {
    if (placingOrder || items.length === 0) return;

    setPlacingOrder(true);
    try {
      const menu = await useMenuStore.getState().ensureLoaded();
      const validation = validateCartForCheckout(items, menu);
      if (!validation.ok) {
        useCartStore.getState().syncWithMenu(menu);
        Alert.alert("Cannot place order", validation.message);
        return;
      }
      if (validation.removed.length > 0 || validation.priceUpdated.length > 0) {
        useCartStore.getState().syncWithMenu(menu);
      }

      const order = await placeOrder(validation.items, menu);
      prependOrder(order);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const lines = order.items.map((i) => `• ${i.quantity}× ${i.name}`).join("\n");
      Alert.alert(
        "Order placed",
        `Order #${order.id.slice(-6).toUpperCase()} is in the kitchen.\n\n${lines}\n\nTotal: ${formatMoney(order.total)}`,
        [{ text: "OK" }]
      );
      resetOrderingSession();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The kitchen could not receive your order.";
      Alert.alert("Order not sent", message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const renderCartLine = (line: CartItem) => {
    const lineTotal = line.item.price * line.quantity;
    return (
      <View key={line.item.id} style={styles.cartRow}>
        <View style={styles.lineMain}>
          <View style={styles.lineTop}>
            <Text style={styles.lineName}>{line.item.name}</Text>
            <Text style={styles.lineTotal}>{formatMoney(lineTotal)}</Text>
          </View>
          <Text style={styles.lineDescription} numberOfLines={2}>
            {line.item.description}
          </Text>
          <View style={styles.lineMeta}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{line.item.category}</Text>
            </View>
            <Text style={styles.unitPrice}>
              {formatMoney(line.item.price)} each
            </Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel={`Decrease ${line.item.name} quantity`}
              accessibilityRole="button"
              style={styles.stepButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const result = updateQuantity(line.item.id, line.quantity - 1);
                if (!result.ok && result.message) {
                  Alert.alert("Cannot update", result.message);
                }
              }}
            >
              <Ionicons name="remove" size={18} color="#111111" />
            </Pressable>
            <Text style={styles.quantity}>{line.quantity}</Text>
            <Pressable
              accessibilityLabel={`Increase ${line.item.name} quantity`}
              accessibilityRole="button"
              style={styles.stepButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const result = updateQuantity(line.item.id, line.quantity + 1);
                if (!result.ok && result.message) {
                  Alert.alert("Cannot update", result.message);
                }
              }}
            >
              <Ionicons name="add" size={18} color="#111111" />
            </Pressable>
            <Pressable
              accessibilityLabel={`Remove ${line.item.name}`}
              accessibilityRole="button"
              style={styles.removeButton}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                removeItem(line.item.id);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#E05252" />
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Your cart</Text>
          <Text style={styles.pageSubtitle}>
            {itemCount > 0
              ? `${itemCount} item${itemCount === 1 ? "" : "s"} ready to send to the kitchen`
              : "Add dishes from the menu or AI waiter"}
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <Ionicons name="cart-outline" size={56} color="#444444" />
            <Text style={styles.emptyTitle}>Nothing in your cart yet</Text>
            <Text style={styles.emptySubtitle}>
              Browse the menu or ask the AI waiter to build your order
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => router.push("/(tabs)/")}
              >
                <Ionicons name="restaurant-outline" size={18} color="#111111" />
                <Text style={styles.primaryButtonText}>Browse menu</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => router.push("/(tabs)/chat")}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#F5A623" />
                <Text style={styles.secondaryButtonText}>Ask AI waiter</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {items.map(renderCartLine)}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Order summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal ({itemCount} items)</Text>
                <Text style={styles.summaryValue}>{formatMoney(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Est. tax (8.875%)</Text>
                <Text style={styles.summaryValue}>{formatMoney(tax)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryTotalLabel}>Estimated total</Text>
                <Text style={styles.summaryTotalValue}>{formatMoney(estimatedTotal)}</Text>
              </View>
              <Text style={styles.summaryNote}>Final total confirmed when the kitchen accepts your order.</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={placingOrder}
              style={[styles.placeButton, placingOrder && styles.placeButtonDisabled]}
              onPress={handlePlaceOrder}
            >
              {placingOrder ? (
                <ActivityIndicator color="#111111" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#111111" />
                  <Text style={styles.placeText}>
                    Place order · {formatMoney(estimatedTotal)}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.clearButton}
              onPress={() => {
                Alert.alert("Clear cart?", "Remove all items from your cart?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                      clearCart();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.clearText}>Clear cart</Text>
            </Pressable>
          </>
        )}

        <View style={styles.ordersSection}>
          <View style={styles.ordersSectionHeader}>
            <Text style={styles.ordersSectionTitle}>Recent orders</Text>
            <Pressable accessibilityRole="button" onPress={() => void fetchOrders()}>
              <Ionicons name="refresh" size={20} color="#888888" />
            </Pressable>
          </View>

          {ordersLoading && orders.length === 0 ? (
            <ActivityIndicator color="#F5A623" style={styles.ordersLoader} />
          ) : null}

          {ordersError ? <Text style={styles.ordersError}>{ordersError}</Text> : null}

          {!ordersLoading && orders.length === 0 ? (
            <Text style={styles.ordersEmpty}>Placed orders will appear here.</Text>
          ) : null}

          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartRow: {
    backgroundColor: "#1e1e1e",
    borderRadius: 14,
    marginBottom: 10,
    marginHorizontal: 14,
    padding: 14,
  },
  categoryPill: {
    backgroundColor: "#333333",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: "#cfc8bd",
    fontSize: 10,
    fontWeight: "700",
  },
  clearButton: {
    alignItems: "center",
    marginBottom: 8,
    marginHorizontal: 14,
    paddingVertical: 10,
  },
  clearText: {
    color: "#888888",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  emptyCart: {
    alignItems: "center",
    marginHorizontal: 14,
    paddingVertical: 28,
  },
  emptySubtitle: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#888888",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
  },
  lineDescription: {
    color: "#888888",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  lineMain: {
    flex: 1,
  },
  lineMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  lineName: {
    color: "#F0EDE8",
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
  },
  lineTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  lineTotal: {
    color: "#F5A623",
    fontSize: 17,
    fontWeight: "800",
  },
  orderCard: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  orderCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderDate: {
    color: "#666666",
    fontSize: 12,
    marginTop: 2,
  },
  orderFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  orderId: {
    color: "#F0EDE8",
    fontSize: 15,
    fontWeight: "800",
  },
  orderItemCount: {
    color: "#888888",
    fontSize: 12,
  },
  orderItems: {
    color: "#aaaaaa",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  ordersEmpty: {
    color: "#555555",
    fontSize: 14,
    fontStyle: "italic",
  },
  ordersError: {
    color: "#E05252",
    fontSize: 13,
    marginBottom: 8,
  },
  ordersLoader: {
    marginVertical: 16,
  },
  ordersSection: {
    borderTopColor: "#2a2a2a",
    borderTopWidth: 1,
    marginTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 14,
    paddingTop: 20,
  },
  ordersSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  ordersSectionTitle: {
    color: "#F0EDE8",
    fontSize: 18,
    fontWeight: "800",
  },
  orderTotal: {
    color: "#F5A623",
    fontSize: 16,
    fontWeight: "800",
  },
  pageHeader: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  pageSubtitle: {
    color: "#888888",
    fontSize: 14,
    marginTop: 4,
  },
  pageTitle: {
    color: "#F0EDE8",
    fontSize: 26,
    fontWeight: "900",
  },
  placeButton: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    height: 54,
    justifyContent: "center",
    marginBottom: 4,
    marginHorizontal: 14,
    marginTop: 4,
  },
  placeButtonDisabled: {
    opacity: 0.6,
  },
  placeText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#111111",
    fontWeight: "800",
  },
  quantity: {
    color: "#F0EDE8",
    fontSize: 16,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "center",
  },
  removeButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeText: {
    color: "#E05252",
    fontSize: 12,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#F5A623",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#F5A623",
    fontWeight: "800",
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  summaryCard: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 14,
    marginTop: 6,
    padding: 16,
  },
  summaryLabel: {
    color: "#888888",
    fontSize: 14,
  },
  summaryNote: {
    color: "#555555",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  summaryTitle: {
    color: "#F0EDE8",
    fontSize: 16,
    fontWeight: "800",
  },
  summaryTotalLabel: {
    color: "#F0EDE8",
    fontSize: 16,
    fontWeight: "900",
  },
  summaryTotalRow: {
    borderTopColor: "#2a2a2a",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  summaryTotalValue: {
    color: "#F5A623",
    fontSize: 20,
    fontWeight: "900",
  },
  summaryValue: {
    color: "#F0EDE8",
    fontSize: 14,
    fontWeight: "600",
  },
  unitPrice: {
    color: "#666666",
    fontSize: 12,
  },
});
