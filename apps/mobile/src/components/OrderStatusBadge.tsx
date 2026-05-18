import { StyleSheet, Text, View } from "react-native";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PLACED: { bg: "#2a3a4a", text: "#7eb8ff", label: "Placed" },
  PREPARING: { bg: "#3a2f1a", text: "#F5A623", label: "Preparing" },
  READY: { bg: "#1a3a2a", text: "#52C78A", label: "Ready" },
  COMPLETED: { bg: "#1e2e1e", text: "#888888", label: "Completed" },
  CANCELLED: { bg: "#3a1a1a", text: "#E05252", label: "Cancelled" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PLACED;
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
