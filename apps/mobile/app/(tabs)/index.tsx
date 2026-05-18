import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../../src/components/Screen";
import { useSyncCartOnFocus } from "../../src/hooks/useSyncCartOnFocus";
import { useCartStore } from "../../src/store/cartStore";
import { useMenuStore } from "../../src/store/menuStore";
import { MenuItem } from "../../src/types";

const categories = ["All", "Starters", "Mains", "Sides", "Drinks", "Desserts"];

function tagColors(tag: string) {
  if (tag === "spicy") return { bg: "#E05252", text: "#2b0b0b" };
  if (tag === "vegetarian" || tag === "vegan") return { bg: "#52C78A", text: "#082515" };
  if (tag === "popular") return { bg: "#F5A623", text: "#111111" };
  return { bg: "#2a2a2a", text: "#cfc8bd" };
}

export default function MenuScreen() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const { addItem, updateQuantity, items } = useCartStore();

  useSyncCartOnFocus();

  const loadMenu = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const items = refresh
        ? await useMenuStore.getState().refresh()
        : await useMenuStore.getState().ensureLoaded();
      setMenu(items);
    } catch {
      setError("The kitchen menu did not load. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const filteredMenu = useMemo(
    () =>
      activeCategory === "All"
        ? menu
        : menu.filter((item) => item.category === activeCategory),
    [activeCategory, menu]
  );

  const quantityFor = useCallback(
    (itemId: string) => items.find((i) => i.item.id === itemId)?.quantity ?? 0,
    [items]
  );

  const renderItem = ({ item }: { item: MenuItem }) => {
    const quantity = quantityFor(item.id);
    const soldOut = !item.available;
    return (
      <View style={[styles.card, item.tags.includes("popular") && styles.popularCard, soldOut && styles.soldOutCard]}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.tagRow}>
            {item.tags.map((tag) => {
              const colors = tagColors(tag);
              return (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.itemAction}>
          <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          {soldOut ? (
            <View style={styles.soldOutPill}>
              <Text style={styles.soldOutText}>Unavailable</Text>
            </View>
          ) : quantity === 0 ? (
            <Pressable
              accessibilityLabel={`Add ${item.name}`}
              accessibilityRole="button"
              style={styles.roundButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const result = addItem(item, 1);
                if (!result.ok && result.message) {
                  Alert.alert("Cannot add", result.message);
                }
              }}
            >
              <Ionicons name="add" size={24} color="#111111" />
            </Pressable>
          ) : (
            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel={`Decrease ${item.name} quantity`}
                accessibilityRole="button"
                style={styles.stepButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const result = updateQuantity(item.id, quantity - 1);
                  if (!result.ok && result.message) {
                    Alert.alert("Cannot update", result.message);
                  }
                }}
              >
                <Ionicons name="remove" size={18} color="#111111" />
              </Pressable>
              <Text style={styles.quantity}>{quantity}</Text>
              <Pressable
                accessibilityLabel={`Increase ${item.name} quantity`}
                accessibilityRole="button"
                style={styles.stepButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const result = addItem(item, 1);
                  if (!result.ok && result.message) {
                    Alert.alert("Cannot add", result.message);
                  }
                }}
              >
                <Ionicons name="add" size={18} color="#111111" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color="#F5A623" size="large" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => loadMenu()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>The Intelligent Bistro</Text>
        <Text style={styles.subtitle}>Tap or ask the AI to order</Text>
      </View>
      <View style={styles.categoryWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => {
            const active = category === activeCategory;
            return (
              <Pressable
                accessibilityRole="button"
                key={category}
                style={[styles.categoryPill, active ? styles.categoryActive : styles.categoryInactive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveCategory(category);
                }}
              >
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        data={filteredMenu}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#F5A623"
            onRefresh={() => loadMenu(true)}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 14,
    flexDirection: "row",
    marginHorizontal: 14,
    marginVertical: 8,
    minHeight: 148,
    padding: 16,
  },
  categoryActive: {
    backgroundColor: "#F5A623",
  },
  categoryInactive: {
    backgroundColor: "#2a2a2a",
  },
  categoryPill: {
    borderRadius: 20,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryText: {
    color: "#888888",
    fontWeight: "700",
  },
  categoryTextActive: {
    color: "#111111",
  },
  categoryWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: "#F0EDE8",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  header: {
    borderBottomColor: "#2a2a2a",
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  itemAction: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: 104,
  },
  itemDescription: {
    color: "#888888",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    color: "#F0EDE8",
    fontSize: 18,
    fontWeight: "800",
  },
  listContent: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  popularCard: {
    borderLeftColor: "#F5A623",
    borderLeftWidth: 3,
  },
  soldOutCard: {
    opacity: 0.55,
  },
  soldOutPill: {
    backgroundColor: "#3a2a2a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  soldOutText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "700",
  },
  price: {
    color: "#F5A623",
    fontSize: 18,
    fontWeight: "800",
  },
  quantity: {
    color: "#F0EDE8",
    fontSize: 16,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#F5A623",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryText: {
    color: "#111111",
    fontWeight: "800",
  },
  roundButton: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
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
  subtitle: {
    color: "#888888",
    fontSize: 13,
    marginTop: 4,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: "#F0EDE8",
    fontSize: 30,
    fontWeight: "900",
  },
});
