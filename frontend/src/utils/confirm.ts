import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation dialog. Returns true if the user confirms.
 * Web uses the native browser confirm; native uses Alert with Cancel/confirm.
 */
export function confirmAsync(
  title: string,
  message?: string,
  confirmText = "Delete",
  destructive = true
): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
    }
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
