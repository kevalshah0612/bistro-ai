import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useCartStore } from "../store/cartStore";
import { useMenuStore } from "../store/menuStore";
import { formatSyncMessage } from "../utils/cartValidation";

/** Refreshes menu from API and reconciles the cart whenever a tab gains focus. */
export function useSyncCartOnFocus() {
  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await useMenuStore.getState().refresh();
        const result = useCartStore.getState().lastSyncResult;
        if (!result) return;

        const message = formatSyncMessage(result);
        if (!message) return;

        if (isFirstFocus.current) {
          isFirstFocus.current = false;
          return;
        }

        Alert.alert("Cart updated", message);
      })();
    }, [])
  );
}
