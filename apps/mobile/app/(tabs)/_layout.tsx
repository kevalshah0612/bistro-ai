import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useCartStore } from "../../src/store/cartStore";

type IconName = keyof typeof Ionicons.glyphMap;

function CartIcon({ color, focused }: { color: string; focused: boolean }) {
  const totalItems = useCartStore((state) => state.totalItems());
  const previousTotal = useRef(totalItems);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (totalItems > previousTotal.current) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.4, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    previousTotal.current = totalItems;
  }, [scale, totalItems]);

  return (
    <View>
      <Ionicons name={focused ? "cart" : "cart-outline"} size={24} color={color} />
      {totalItems > 0 ? (
        <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
          <Animated.Text style={styles.badgeText}>{totalItems}</Animated.Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function tabIcon(outline: IconName, filled: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={24} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F5A623",
        tabBarInactiveTintColor: "#666666",
        tabBarStyle: {
          backgroundColor: "#111111",
          borderTopColor: "#2a2a2a",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Menu",
          tabBarIcon: tabIcon("restaurant-outline", "restaurant"),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, focused }) => <CartIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "AI Order",
          tabBarIcon: tabIcon("chatbubble-ellipses-outline", "chatbubble-ellipses"),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: "#F5A623",
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: -10,
    top: -6,
  },
  badgeText: {
    color: "#111111",
    fontSize: 10,
    fontWeight: "800",
  },
});
