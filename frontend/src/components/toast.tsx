import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./ui";
import { colors, radius } from "../theme";

type ToastType = "error" | "success" | "info";
type ToastItem = { id: number; message: string; type: ToastType };

type ToastCtxType = {
  show: (message: string, type?: ToastType) => void;
  error: (message: string) => void;
  success: (message: string) => void;
};

const ToastCtx = createContext<ToastCtxType>({
  show: () => {},
  error: () => {},
  success: () => {},
});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const error = useCallback((m: string) => show(m, "error"), [show]);
  const success = useCallback((m: string) => show(m, "success"), [show]);

  return (
    <ToastCtx.Provider value={{ show, error, success }}>
      {children}
      <View style={[styles.wrap, { top: insets.top + 8 }]}>
        {toasts.map((t) => (
          <TouchableOpacity
            key={t.id}
            activeOpacity={0.9}
            onPress={() => dismiss(t.id)}
            testID={`toast-${t.type}`}
            style={[
              styles.toast,
              t.type === "error"
                ? { borderColor: colors.danger, backgroundColor: "#2A1416" }
                : t.type === "success"
                ? { borderColor: colors.success, backgroundColor: "#0F2418" }
                : { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons
              name={t.type === "error" ? "alert-circle" : t.type === "success" ? "checkmark-circle" : "information-circle"}
              size={18}
              color={t.type === "error" ? colors.danger : t.type === "success" ? colors.success : colors.textSecondary}
            />
            <AppText style={{ color: colors.text, fontSize: 13, marginLeft: 8, flex: 1 }}>{t.message}</AppText>
          </TouchableOpacity>
        ))}
      </View>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 520,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
});
